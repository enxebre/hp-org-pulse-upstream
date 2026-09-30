import { describe, it, expect } from 'vitest';
import { classifyAIInvolvement } from '../../server/jira/label-parser.js';

const CREATED_LABEL = 'rfe-creator-auto-created';
const REVISED_LABEL = 'rfe-creator-auto-revised';
const TEST_LABEL = 'rfe-creator-skill-testing';

describe('classifyAIInvolvement', () => {
  it('returns "created" for exact created label only', () => {
    expect(classifyAIInvolvement(['rfe-creator-auto-created'], CREATED_LABEL, REVISED_LABEL, TEST_LABEL)).toBe('created');
  });

  it('returns "revised" for exact revised label only', () => {
    expect(classifyAIInvolvement(['rfe-creator-auto-revised'], CREATED_LABEL, REVISED_LABEL, TEST_LABEL)).toBe('revised');
  });

  it('returns "both" when both labels are present', () => {
    expect(classifyAIInvolvement(['rfe-creator-auto-created', 'rfe-creator-auto-revised'], CREATED_LABEL, REVISED_LABEL, TEST_LABEL)).toBe('both');
  });

  it('returns "none" when neither label is present', () => {
    expect(classifyAIInvolvement(['customer-request', 'strategic'], CREATED_LABEL, REVISED_LABEL, TEST_LABEL)).toBe('none');
  });

  it('returns "none" for empty labels', () => {
    expect(classifyAIInvolvement([], CREATED_LABEL, REVISED_LABEL, TEST_LABEL)).toBe('none');
  });

  it('returns "none" when only the test exclusion label is present', () => {
    expect(classifyAIInvolvement(['rfe-creator-skill-testing'], CREATED_LABEL, REVISED_LABEL, TEST_LABEL)).toBe('none');
  });

  it('does not match partial/prefix labels (exact match only)', () => {
    expect(classifyAIInvolvement(['rfe-creator-auto-created-extra'], CREATED_LABEL, REVISED_LABEL, TEST_LABEL)).toBe('none');
    expect(classifyAIInvolvement(['rfe-creator-auto-revised-extra'], CREATED_LABEL, REVISED_LABEL, TEST_LABEL)).toBe('none');
  });

  it('works with custom labels', () => {
    expect(classifyAIInvolvement(['my-created'], 'my-created', 'my-revised', 'my-test')).toBe('created');
    expect(classifyAIInvolvement(['my-revised'], 'my-created', 'my-revised', 'my-test')).toBe('revised');
    expect(classifyAIInvolvement(['my-created', 'my-revised'], 'my-created', 'my-revised', 'my-test')).toBe('both');
  });

  it('ignores non-matching labels alongside matching ones', () => {
    expect(classifyAIInvolvement(['rfe-creator-auto-created', 'unrelated-label'], CREATED_LABEL, REVISED_LABEL, TEST_LABEL)).toBe('created');
  });
});
