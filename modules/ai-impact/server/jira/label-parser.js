function classifyAIInvolvement(labels, createdLabel, revisedLabel, testLabel) {
  const isTest = labels.includes(testLabel);
  if (isTest) return 'none'; // safety net (also excluded in JQL)

  const hasCreated = labels.some(l => l === createdLabel && l !== testLabel);
  const hasRevised = labels.some(l => l === revisedLabel);

  if (hasCreated && hasRevised) return 'both';
  if (hasCreated) return 'created';
  if (hasRevised) return 'revised';
  return 'none';
}

module.exports = { classifyAIInvolvement };
