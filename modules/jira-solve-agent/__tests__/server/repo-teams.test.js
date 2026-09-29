import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const { REPO_TEAMS, AGENT_REPOS, REPO_TEAM_BY_NAME, TEAM_REPOS } = require('../../server/github/prs')

const here = dirname(fileURLToPath(import.meta.url))
const vuePath = resolve(here, '../../client/components/AgentContent.vue')

function clientTeamKeys() {
  const vue = readFileSync(vuePath, 'utf8')
  const block = vue.match(/const TEAMS = \[([\s\S]*?)\n\];/)
  if (!block) throw new Error('TEAMS list not found in AgentContent.vue')
  return [...block[1].matchAll(/key: '([^']+)'/g)].map(m => m[1])
}

describe('REPO_TEAMS', () => {
  it('derives one entry per repo from TEAM_REPOS', () => {
    const declared = Object.values(TEAM_REPOS).reduce((n, r) => n + r.length, 0)
    expect(REPO_TEAMS).toHaveLength(declared)
  })

  it('lists every repo exactly once', () => {
    expect(new Set(AGENT_REPOS).size).toBe(AGENT_REPOS.length)
  })

  it('fully qualifies every repo under the openshift org', () => {
    for (const { repo } of REPO_TEAMS) {
      expect(repo).toMatch(/^openshift\/[a-z0-9][a-z0-9._-]*$/)
    }
  })

  it('maps every repo back to its team', () => {
    for (const { repo, team } of REPO_TEAMS) {
      expect(REPO_TEAM_BY_NAME[repo]).toBe(team)
    }
  })

  it('keeps the teams that already had repos wired up', () => {
    expect(REPO_TEAM_BY_NAME['openshift/machine-config-operator']).toBe('mco')
    expect(REPO_TEAM_BY_NAME['openshift/cluster-ingress-operator']).toBe('ingress')
    expect(REPO_TEAM_BY_NAME['openshift/installer']).toBe('installer')
    expect(REPO_TEAM_BY_NAME['openshift/hypershift']).toBe('hypershift')
    expect(REPO_TEAM_BY_NAME['openshift/origin']).toBe('trt')
  })

  it('puts the OTA repos in their own team', () => {
    expect(TEAM_REPOS.ota).toEqual(['cluster-version-operator', 'cincinnati-graph-data'])
    expect(REPO_TEAM_BY_NAME['openshift/cluster-version-operator']).toBe('ota')
    expect(REPO_TEAM_BY_NAME['openshift/cincinnati-graph-data']).toBe('ota')
  })

  it('wires Edge & Ecosystem repos to edge-ecosystem', () => {
    // Edge
    expect(REPO_TEAM_BY_NAME['openshift/microshift']).toBe('edge-ecosystem')
    expect(REPO_TEAM_BY_NAME['openshift/lvm-operator']).toBe('edge-ecosystem')
    // OAP
    expect(REPO_TEAM_BY_NAME['openshift/cert-manager-operator']).toBe('edge-ecosystem')
    expect(REPO_TEAM_BY_NAME['openshift/external-secrets-operator']).toBe('edge-ecosystem')
    // Metal Platform
    expect(REPO_TEAM_BY_NAME['openshift/baremetal-operator']).toBe('edge-ecosystem')
    expect(REPO_TEAM_BY_NAME['openshift/ironic-image']).toBe('edge-ecosystem')
    // Multi Architecture
    expect(REPO_TEAM_BY_NAME['openshift/multiarch-tuning-operator']).toBe('edge-ecosystem')
    // CID
    expect(REPO_TEAM_BY_NAME['openshift/mirror-gui']).toBe('edge-ecosystem')
  })

  it('does not double-claim repos already assigned to other teams', () => {
    // These repos belong to the Edge & Ecosystem pillar in the org data but
    // are already wired to a different team in this module.
    expect(REPO_TEAM_BY_NAME['openshift/secrets-store-csi-driver']).toBe('storage')
    expect(REPO_TEAM_BY_NAME['openshift/oc-mirror']).toBe('cluster-lifecycle')
    expect(REPO_TEAM_BY_NAME['openshift/installer']).toBe('installer')
    expect(REPO_TEAM_BY_NAME['openshift/hypershift']).toBe('hypershift')
    expect(REPO_TEAM_BY_NAME['openshift/must-gather']).toBe('support')
  })

  it('excludes the SRE-platform and lightspeed repos', () => {
    const excluded = [
      'osd-network-verifier', 'managed-cluster-config', 'managed-cluster-validating-webhooks',
      'managed-notifications', 'rbac-permissions-operator', 'certman-operator',
      'cloud-ingress-operator', 'ocm-agent', 'rosa',
      'lightspeed-agentic-operator', 'lightspeed-agentic-sandbox'
    ]
    for (const name of excluded) {
      expect(AGENT_REPOS).not.toContain(`openshift/${name}`)
    }
  })

  it('gives every team a matching button in the client TEAMS list', () => {
    const clientKeys = clientTeamKeys()
    for (const team of Object.keys(TEAM_REPOS)) {
      expect(clientKeys).toContain(team)
    }
  })
})
