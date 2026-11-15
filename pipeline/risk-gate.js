// Stage 5 - Risk gate.
// Humans should review what is risky, not everything. We compare the change against the last
// human-approved version and only escalate when the CHANGED lines touch sensitive code.

function changedLines(baseline, candidate) {
  const before = new Set(baseline.split('\n').map((l) => l.trim()).filter(Boolean));
  const after = new Set(candidate.split('\n').map((l) => l.trim()).filter(Boolean));
  const added = [...after].filter((l) => !before.has(l)).map((text) => ({ kind: '+', text }));
  const removed = [...before].filter((l) => !after.has(l)).map((text) => ({ kind: '-', text }));
  return [...removed, ...added];
}

function assessRisk(spec, candidateSource, baselineSource) {
  const keywords = spec.security.sensitiveKeywords || [];

  if (!baselineSource) {
    return {
      level: spec.riskLevel,
      reason: `brand-new implementation of a ${spec.riskLevel}-risk feature with no human-approved baseline`,
      changed: [],
      sensitive: [],
    };
  }

  const changed = changedLines(baselineSource, candidateSource);
  const sensitive = changed.filter((l) => keywords.some((k) => l.text.toLowerCase().includes(k)));

  return {
    level: sensitive.length ? 'high' : 'low',
    reason: sensitive.length
      ? `${sensitive.length} changed line(s) touch sensitive code (${keywords.join(', ')})`
      : `${changed.length} changed line(s), none touch sensitive code`,
    changed,
    sensitive,
  };
}

module.exports = { assessRisk, changedLines };
