const { createJiraClient } = require('../../../../shared/server/jira');
const {
  fetchAgentData,
  computeMetrics,
  dedupeAgentWork,
  fetchIssueStatusesByKeys,
  CHAI_BACKPORT_LABEL
} = require('./jira/fetcher');
const { fetchAgentPrs, hydrateLinkedPrStates, TEAM_REPOS } = require('./github/prs');
const { fetchLinkedPrsForKeys } = require('./jira/remote-links');

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;

  context.registerScopes([
    { key: 'jira-solve-agent:read', label: 'OpenShift Jira Solve Agent (Read)', description: 'Read agent data', category: 'OpenShift Jira Solve Agent' },
    { key: 'jira-solve-agent:write', label: 'OpenShift Jira Solve Agent (Write)', description: 'Refresh agent data', category: 'OpenShift Jira Solve Agent' }
  ]);

  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  const jira = createJiraClient({
    email: (context.secrets && context.secrets.JIRA_EMAIL) || '',
    token: (context.secrets && context.secrets.JIRA_TOKEN) || '',
    host: process.env.JIRA_HOST
  });
  const { jiraRequest, JIRA_HOST } = jira;

  const GITHUB_TOKEN = (context.secrets && context.secrets.GITHUB_TOKEN) || '';

  // Placeholder key for a bot PR that carries no Jira reference at all.
  const NO_JIRA_KEY = 'NO-JIRA';

  // Map a bot PR's GitHub state to the app's agent-state vocabulary, used only
  // for NO-JIRA rows (which have no Jira ticket to read a status from).
  function agentStateFromPrState(state) {
    const s = (state || '').toUpperCase();
    if (s === 'MERGED' || s === 'CLOSED') return 'closed';
    if (s === 'OPEN') return 'in-progress';
    return 'other';
  }

  // Build a synthetic issue row for a net-new-keyed bot PR (a Jira ticket that
  // exists but lacks the issue-for-agent label). Status/assignee come from a live
  // Jira lookup so the row reflects the real ticket state.
  function rowFromKeyedPr(pr, statusByKey) {
    const info = statusByKey.get(pr.jiraKey) || {};
    const status = info.status || 'Unknown';
    return {
      key: pr.jiraKey,
      summary: pr.title || pr.jiraKey,
      status,
      issueType: 'Unknown',
      priority: 'None',
      created: pr.createdAt || null,
      updated: pr.createdAt || null,
      labels: [],
      components: [],
      assignee: info.assignee || null,
      agentState: classifyPrRowState(status),
      processed: false,
      source: 'chai-bot-pr',
      prUrl: pr.url,
      prState: pr.state || null,
      team: pr.team || null
    };
  }

  // Build a synthetic NO-JIRA row for a bot PR with no Jira key at all.
  function rowFromNoKeyPr(pr) {
    return {
      key: NO_JIRA_KEY,
      summary: pr.title || NO_JIRA_KEY,
      status: null, // no Jira ticket to read a status from
      issueType: 'Unknown',
      priority: 'None',
      created: pr.createdAt || null,
      updated: pr.createdAt || null,
      labels: [],
      components: [],
      assignee: null,
      agentState: agentStateFromPrState(pr.state),
      processed: false,
      source: 'chai-bot-pr',
      prUrl: pr.url,
      prState: pr.state || null,
      team: pr.team || null
    };
  }

  // Reuse the fetcher's status-category classification for a live Jira status
  // name. We only have the status name here (no category), so map common names.
  function classifyPrRowState(statusName) {
    const s = (statusName || '').toLowerCase();
    if (['closed', 'done', 'resolved', 'verified'].includes(s)) return 'closed';
    if (['in progress', 'code review', 'review', 'on_dev', 'on dev'].includes(s)) return 'in-progress';
    if (['new', 'to do', 'open', 'backlog'].includes(s)) return 'new';
    return 'other';
  }

  /**
   * @openapi
   * /api/modules/hp-automation/solve/data:
   *   get:
   *     tags: [OpenShift Jira Solve Agent]
   *     summary: Get cached OpenShift Jira Solve Agent data with computed metrics
   *     responses:
   *       200:
   *         description: Agent data with metrics and issues
   */
  router.get('/data', requireScope('jira-solve-agent:read'), async function(req, res) {
    const data = await readFromStorage('jira-solve-agent/data.json');
    if (!data || !data.issues) {
      return res.json({
        fetchedAt: null,
        jiraHost: JIRA_HOST,
        teamRepos: TEAM_REPOS,
        metrics: { totalIssues: 0, byState: {}, processedCount: 0, processedRate: 0 },
        issues: []
      });
    }

    const metrics = computeMetrics(data.issues);

    res.json({
      fetchedAt: data.fetchedAt,
      jiraHost: JIRA_HOST,
      // The repos each team tracks, so the client can show them on hover
      // without duplicating (and drifting from) the server's mapping.
      teamRepos: TEAM_REPOS,
      metrics,
      issues: data.issues
    });
  });

  const refreshState = { running: false, lastResult: null };

  /**
   * @openapi
   * /api/modules/hp-automation/solve/refresh:
   *   post:
   *     tags: [OpenShift Jira Solve Agent]
   *     summary: Fetch fresh OpenShift Jira Solve Agent data from Jira and update cache
   *     responses:
   *       200:
   *         description: Refresh completed
   */
  router.post('/refresh', requireAdmin, requireScope('jira-solve-agent:write'), async function(req, res) {
    if (refreshState.running) {
      return res.status(409).json({ error: 'Refresh already running' });
    }

    refreshState.running = true;
    try {
      await runRefresh();
      res.json({ status: 'ok', result: refreshState.lastResult });
    } catch (err) {
      console.error('[jira-solve-agent] Refresh failed:', err);
      refreshState.lastResult = {
        status: 'error',
        message: err.message,
        completedAt: new Date().toISOString()
      };
      res.status(500).json({ error: err.message });
    } finally {
      refreshState.running = false;
    }
  });

  async function runRefresh() {
    if (DEMO_MODE) return;

    // 1. Jira issues carrying the issue-for-agent label.
    const jiraIssues = await fetchAgentData(jiraRequest);

    // 2. PRs opened by the bot across the wired-up repos (all states).
    let botPrs = [];
    if (GITHUB_TOKEN) {
      try {
        botPrs = await fetchAgentPrs({ token: GITHUB_TOKEN });
      } catch (err) {
        console.warn(`[jira-solve-agent] Failed to fetch bot PRs: ${err.message}`);
      }
    }

    // 3. Resolve Jira keys before de-duplication. Backport issues belong to the
    //    backport tracker even when the same Chai bot account opened the PR.
    let statusByKey = new Map();
    const botPrKeys = botPrs.map(pr => pr.jiraKey).filter(Boolean);
    if (botPrKeys.length) {
      try {
        statusByKey = await fetchIssueStatusesByKeys(jiraRequest, botPrKeys);
        botPrs = botPrs.filter(pr => {
          if (!pr.jiraKey) return true;
          const issue = statusByKey.get(pr.jiraKey);
          return issue && !issue.labels.includes(CHAI_BACKPORT_LABEL);
        });
      } catch (err) {
        console.warn(`[jira-solve-agent] Failed to classify bot PR Jira keys: ${err.message}`);
        // Do not let keyed PRs leak into Jira Solve when Jira cannot prove they
        // are unrelated to the backport workflow. Keyless PRs remain safe.
        botPrs = botPrs.filter(pr => !pr.jiraKey);
      }
    }

    // 4. De-duplicate the remaining bot PRs against the tracked Jira issues. Overlapping
    //    PRs are already represented by their Jira issue; net-new-keyed and
    //    no-key PRs each become their own row that counts toward the total.
    const dedup = dedupeAgentWork(jiraIssues, botPrs);

    // 5. Linked PRs from Jira remote issue links (GitHub-for-Jira integration).
    const keysForLinkedPrs = [
      ...jiraIssues.map(i => i.key),
      ...dedup.netNewKeyedPrs.map(pr => pr.jiraKey).filter(Boolean)
    ];
    let linkedByKey = new Map();
    try {
      linkedByKey = await fetchLinkedPrsForKeys(jiraRequest, keysForLinkedPrs);
      try {
        await hydrateLinkedPrStates(linkedByKey, { token: GITHUB_TOKEN || '' });
      } catch (err) {
        console.warn(`[jira-solve-agent] Linked PR state hydration failed: ${err.message}`);
      }
      for (const issue of jiraIssues) {
        const linked = linkedByKey.get(issue.key);
        if (linked && linked.length) issue.linkedPrs = linked;
      }
    } catch (err) {
      console.warn(`[jira-solve-agent] Remote-link sweep failed: ${err.message}`);
    }

    // 6. Reuse that Jira metadata to populate net-new keyed rows.
    const keyedRows = dedup.netNewKeyedPrs.map(pr => rowFromKeyedPr(pr, statusByKey));
    for (const row of keyedRows) {
      const linked = linkedByKey.get(row.key);
      if (linked && linked.length) row.linkedPrs = linked;
    }
    // One NO-JIRA row per keyless bot PR, de-duplicated by PR url.
    const seenNoKeyUrls = new Set();
    const noKeyRows = [];
    for (const pr of dedup.noKeyPrs) {
      if (pr.url && seenNoKeyUrls.has(pr.url)) continue;
      if (pr.url) seenNoKeyUrls.add(pr.url);
      noKeyRows.push(rowFromNoKeyPr(pr));
    }

    const issues = [...jiraIssues, ...keyedRows, ...noKeyRows];

    await writeToStorage('jira-solve-agent/data.json', {
      fetchedAt: new Date().toISOString(),
      issues,
      prs: botPrs,
      combined: dedup.combined
    });

    refreshState.lastResult = {
      status: 'ok',
      issueCount: issues.length,
      prCount: botPrs.length,
      combined: dedup.combined,
      completedAt: new Date().toISOString()
    };
  }

  if (context.registerRefresh) {
    context.registerRefresh('refresh', {
      order: 60,
      timeout: 300000,
      handler: async function() {
        await runRefresh();
      }
    });
  }

  context.registerDiagnostics(async function() {
    const data = await readFromStorage('jira-solve-agent/data.json');
    return {
      status: data && data.issues ? 'ok' : 'no-data',
      issueCount: data && data.issues ? data.issues.length : 0,
      fetchedAt: data ? data.fetchedAt : null
    };
  });
};
