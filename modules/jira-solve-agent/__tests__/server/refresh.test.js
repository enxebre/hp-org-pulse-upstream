import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import { createRequire } from 'module'

// runRefresh's control flow is tested here without real Jira/GitHub calls.
//
// index.js is CommonJS and `require`s its data-source modules at load time.
// Vitest's vi.mock only rewrites ESM `import`, not CJS `require`, so we inject
// the fakes via Node's require.cache instead.
const require = createRequire(import.meta.url)

const SERVER_DIR = path.resolve(__dirname, '../../server')
const FETCHER_PATH = require.resolve(path.join(SERVER_DIR, 'jira/fetcher'))
const PRS_PATH = require.resolve(path.join(SERVER_DIR, 'github/prs'))
const REMOTE_LINKS_PATH = require.resolve(path.join(SERVER_DIR, 'jira/remote-links'))
const INDEX_PATH = require.resolve(path.join(SERVER_DIR, 'index'))

const { createTestContext } = require('../../../../shared/server/module-context')

const fetcher = {
  fetchAgentData: vi.fn(),
  fetchIssueStatusesByKeys: vi.fn(),
  computeMetrics: vi.fn(),
  dedupeAgentWork: vi.fn(),
  CHAI_BACKPORT_LABEL: 'chai-backport'
}
const prsModule = {
  fetchAgentPrs: vi.fn(),
  hydrateLinkedPrStates: vi.fn().mockResolvedValue(undefined)
}
const remoteLinksModule = {
  fetchLinkedPrsForKeys: vi.fn()
}

function stubModule(resolvedPath, exports) {
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports
  }
}

function loadIndex() {
  stubModule(FETCHER_PATH, fetcher)
  stubModule(PRS_PATH, prsModule)
  stubModule(REMOTE_LINKS_PATH, remoteLinksModule)
  delete require.cache[INDEX_PATH]
  return require(INDEX_PATH)
}

function setup({ token = 'gh-token', initialData = null } = {}) {
  const store = { 'jira-solve-agent/data.json': initialData };
  const writes = [];
  let refreshHandler = null;

  const context = createTestContext({
    storage: {
      readFromStorage: (key) => store[key] || null,
      writeToStorage: (key, data) => { store[key] = data; if (key === 'jira-solve-agent/data.json') writes.push(data); },
      deleteFromStorage: () => {}
    },
    secrets: { JIRA_EMAIL: 'a@b.com', JIRA_TOKEN: 't', GITHUB_TOKEN: token },
    registerRefresh: (_id, cfg) => { refreshHandler = cfg.handler; }
  });

  const registerRoutes = loadIndex();
  const router = { get: () => {}, post: () => {} };
  registerRoutes(router, context);
  return { store, writes, runRefresh: refreshHandler };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetcher.fetchIssueStatusesByKeys.mockResolvedValue(new Map());
  fetcher.dedupeAgentWork.mockImplementation((issues) => ({
    overlapPrs: [],
    netNewKeyedPrs: [],
    noKeyPrs: [],
    combined: { jiraIssues: (issues || []).length, prsCounted: 0, prsOverlap: 0, netNewKeyed: 0, noKey: 0, total: (issues || []).length }
  }));
  prsModule.fetchAgentPrs.mockResolvedValue([]);
  remoteLinksModule.fetchLinkedPrsForKeys.mockResolvedValue(new Map());
});

describe('runRefresh linked PRs via Jira remote links', () => {
  it('persists core issues when the remote-link sweep throws', async () => {
    fetcher.fetchAgentData.mockResolvedValue([{ key: 'CNTRLPLANE-507', status: 'Closed' }]);
    remoteLinksModule.fetchLinkedPrsForKeys.mockRejectedValue(new Error('boom'));

    const { store, writes, runRefresh } = setup();
    await runRefresh();

    const saved = store['jira-solve-agent/data.json'];
    expect(saved.issues).toHaveLength(1);
    expect(saved.issues[0].key).toBe('CNTRLPLANE-507');
    expect(writes.length).toBe(1);
  });

  it('attaches linkedPrs from Jira remote links before writing', async () => {
    fetcher.fetchAgentData.mockResolvedValue([{ key: 'CNTRLPLANE-507', status: 'Closed' }]);
    remoteLinksModule.fetchLinkedPrsForKeys.mockResolvedValue(new Map([
      ['CNTRLPLANE-507', [{ repo: 'openshift/hypershift', team: 'hypershift', number: 9137, url: 'https://github.com/openshift/hypershift/pull/9137', state: 'OPEN', author: null }]]
    ]));

    const { store, writes, runRefresh } = setup();
    await runRefresh();

    const saved = store['jira-solve-agent/data.json'];
    expect(saved.issues[0].linkedPrs).toHaveLength(1);
    expect(saved.issues[0].linkedPrs[0].number).toBe(9137);
    expect(prsModule.hydrateLinkedPrStates).toHaveBeenCalled();
    expect(writes.length).toBe(1);
  });

  it('fetches remote links for every tracked Jira issue key', async () => {
    fetcher.fetchAgentData.mockResolvedValue([
      { key: 'CNTRLPLANE-507', status: 'Closed' },
      { key: 'NE-2664', status: 'New' }
    ]);
    const botPrs = [
      { repo: 'openshift/cluster-ingress-operator', team: 'ingress', number: 1483, url: 'u', state: 'CLOSED', jiraKey: 'NE-2664' }
    ];
    prsModule.fetchAgentPrs.mockResolvedValue(botPrs);
    fetcher.dedupeAgentWork.mockReturnValue({
      overlapPrs: botPrs, netNewKeyedPrs: [], noKeyPrs: [],
      combined: { jiraIssues: 2, prsCounted: 0, prsOverlap: 1, netNewKeyed: 0, noKey: 0, total: 2 }
    });

    const { runRefresh } = setup();
    await runRefresh();

    const keys = remoteLinksModule.fetchLinkedPrsForKeys.mock.calls[0][1];
    expect(keys).toEqual(['CNTRLPLANE-507', 'NE-2664']);
  });

  it('refreshes linkedPrs from Jira on each run (no carry-forward from cache)', async () => {
    const initialData = {
      fetchedAt: '2026-08-27T09:00:00Z',
      issues: [{ key: 'CNTRLPLANE-507', status: 'Closed', linkedPrs: [{ repo: 'openshift/hypershift', team: 'hypershift', number: 9137, url: 'u', state: 'OPEN', author: null }] }],
      prs: []
    };
    fetcher.fetchAgentData.mockResolvedValue([{ key: 'CNTRLPLANE-507', status: 'Closed' }]);
    remoteLinksModule.fetchLinkedPrsForKeys.mockResolvedValue(new Map());

    const { store, runRefresh } = setup({ initialData });
    await runRefresh();

    const saved = store['jira-solve-agent/data.json'];
    expect(saved.issues[0].linkedPrs).toBeUndefined();
    expect(remoteLinksModule.fetchLinkedPrsForKeys.mock.calls[0][1]).toEqual(['CNTRLPLANE-507']);
  });

  it('hydrates linked PR state from GitHub when a token is configured', async () => {
    fetcher.fetchAgentData.mockResolvedValue([{ key: 'CNTRLPLANE-507', status: 'Closed' }]);

    const { store, runRefresh } = setup({ token: '' });
    await runRefresh();

    expect(remoteLinksModule.fetchLinkedPrsForKeys).toHaveBeenCalled();
    expect(prsModule.fetchAgentPrs).not.toHaveBeenCalled();
    expect(prsModule.hydrateLinkedPrStates).toHaveBeenCalled();
    expect(store['jira-solve-agent/data.json'].issues).toHaveLength(1);
  });
});

describe('runRefresh chai-bot PR accounting', () => {
  it('discards a bot PR whose Jira issue is a Chai-driven backport', async () => {
    fetcher.fetchAgentData.mockResolvedValue([]);
    const backportPr = {
      repo: 'openshift/origin', team: 'trt', number: 8,
      url: 'https://github.com/openshift/origin/pull/8',
      title: '[release-4.20] OCPBUGS-99: fix', state: 'OPEN', jiraKey: 'OCPBUGS-99'
    };
    prsModule.fetchAgentPrs.mockResolvedValue([backportPr]);
    fetcher.fetchIssueStatusesByKeys.mockResolvedValue(new Map([
      ['OCPBUGS-99', { status: 'POST', assignee: null, labels: ['chai-backport'] }]
    ]));

    const { store, runRefresh } = setup();
    await runRefresh();

    expect(fetcher.dedupeAgentWork).toHaveBeenCalledWith([], []);
    expect(store['jira-solve-agent/data.json'].issues).toEqual([]);
    expect(store['jira-solve-agent/data.json'].prs).toEqual([]);
  });

  it('fails closed for keyed bot PRs when Jira classification fails', async () => {
    fetcher.fetchAgentData.mockResolvedValue([]);
    const keyedPr = { repo: 'openshift/origin', number: 9, url: 'keyed', jiraKey: 'OCPBUGS-100' };
    const keylessPr = { repo: 'openshift/origin', number: 10, url: 'keyless', jiraKey: null };
    prsModule.fetchAgentPrs.mockResolvedValue([keyedPr, keylessPr]);
    fetcher.fetchIssueStatusesByKeys.mockRejectedValue(new Error('Jira unavailable'));

    const { store, runRefresh } = setup();
    await runRefresh();

    expect(fetcher.dedupeAgentWork).toHaveBeenCalledWith([], [keylessPr]);
    expect(store['jira-solve-agent/data.json'].prs).toEqual([keylessPr]);
  });

  it('adds a net-new keyed PR as its own counted row', async () => {
    fetcher.fetchAgentData.mockResolvedValue([{ key: 'CNTRLPLANE-507', status: 'Closed', agentState: 'closed' }]);
    const botPrs = [
      { repo: 'openshift/machine-config-operator', team: 'mco', number: 42, url: 'https://github.com/openshift/machine-config-operator/pull/42', title: 'MCO-999: fix', state: 'OPEN', jiraKey: 'MCO-999' }
    ];
    prsModule.fetchAgentPrs.mockResolvedValue(botPrs);
    fetcher.dedupeAgentWork.mockReturnValue({
      overlapPrs: [], netNewKeyedPrs: botPrs, noKeyPrs: [],
      combined: { jiraIssues: 1, prsCounted: 1, prsOverlap: 0, netNewKeyed: 1, noKey: 0, total: 2 }
    });
    fetcher.fetchIssueStatusesByKeys.mockResolvedValue(new Map([
      ['MCO-999', { status: 'In Progress', assignee: 'Ada', labels: [] }]
    ]));
    remoteLinksModule.fetchLinkedPrsForKeys.mockResolvedValue(new Map([
      ['MCO-999', [{ repo: 'openshift/machine-config-operator', team: 'mco', number: 99, url: 'https://github.com/openshift/machine-config-operator/pull/99', state: 'OPEN', author: null }]]
    ]));

    const { store, runRefresh } = setup();
    await runRefresh();

    const saved = store['jira-solve-agent/data.json'];
    expect(saved.issues).toHaveLength(2);
    const row = saved.issues.find(i => i.key === 'MCO-999');
    expect(row).toBeTruthy();
    expect(row.status).toBe('In Progress');
    expect(row.assignee).toBe('Ada');
    expect(row.prUrl).toBe('https://github.com/openshift/machine-config-operator/pull/42');
    expect(row.linkedPrs[0].number).toBe(99);
    expect(saved.combined.total).toBe(2);
  });

  it('adds a keyless bot PR as a NO-JIRA row', async () => {
    fetcher.fetchAgentData.mockResolvedValue([{ key: 'CNTRLPLANE-507', status: 'Closed' }]);
    const botPrs = [
      { repo: 'openshift/origin', team: 'trt', number: 7, url: 'https://github.com/openshift/origin/pull/7', title: 'docs: chai was here', state: 'MERGED', jiraKey: null }
    ];
    prsModule.fetchAgentPrs.mockResolvedValue(botPrs);
    fetcher.dedupeAgentWork.mockReturnValue({
      overlapPrs: [], netNewKeyedPrs: [], noKeyPrs: botPrs,
      combined: { jiraIssues: 1, prsCounted: 1, prsOverlap: 0, netNewKeyed: 0, noKey: 1, total: 2 }
    });

    const { store, runRefresh } = setup({ token: '' });
    await runRefresh();

    const saved = store['jira-solve-agent/data.json'];
    const noJira = saved.issues.filter(i => i.key === 'NO-JIRA');
    expect(noJira).toHaveLength(1);
    expect(noJira[0].prUrl).toBe('https://github.com/openshift/origin/pull/7');
    expect(noJira[0].agentState).toBe('closed');
    expect(saved.issues).toHaveLength(2);
  });
})
