// Stage 2 - Static security rules.
// Hard rules that block a change no matter what the tests say. Some dangerous code
// (for example MD5 password hashing) passes every functional test, so tests alone are not enough.

const BUILT_IN_RULES = [
  { pattern: 'eval(', reason: 'eval() runs arbitrary code' },
  { pattern: 'new Function(', reason: 'new Function() runs arbitrary code' },
  { pattern: 'child_process', reason: 'a signup service must not run shell commands' },
];

function checkSecurityRules(source, spec) {
  const rules = [...BUILT_IN_RULES, ...((spec.security && spec.security.forbiddenPatterns) || [])];
  const violations = [];

  source.split('\n').forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    for (const rule of rules) {
      if (line.toLowerCase().includes(rule.pattern.toLowerCase())) {
        violations.push({ line: i + 1, code: line.trim(), pattern: rule.pattern, reason: rule.reason });
      }
    }
  });

  return violations;
}

module.exports = { checkSecurityRules };
