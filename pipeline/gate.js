// The gate: runs every stage for one change and returns one of three verdicts.
//   AUTO_APPROVED - safe to ship with no human involved
//   BLOCKED       - sent back automatically, with feedback the AI agent can act on
//   NEEDS_HUMAN   - everything passed, but a human must look at a small, focused set of lines

const fs = require('node:fs');
const path = require('node:path');
const { lintSpec } = require('./spec-lint');
const { checkSecurityRules } = require('./security-rules');
const { deriveCases, runCases } = require('./derive-tests');
const { runMutationCheck } = require('./mutation-check');
const { assessRisk } = require('./risk-gate');

const ROOT = path.resolve(__dirname, '..');
const MUTATION_THRESHOLD = 0.85;

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function loadImplementation(relPath) {
  const abs = path.join(ROOT, relPath);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}

async function evaluateChange(change) {
  const started = Date.now();
  const spec = JSON.parse(read(change.spec));
  const report = { id: change.id, title: change.title, stages: {}, feedback: [] };
  const finish = (verdict, reason) => ({ ...report, verdict, reason, durationMs: Date.now() - started });

  // 1. Spec lint - stop early: building from a vague spec is wasted work.
  const problems = lintSpec(spec);
  report.stages.specLint = { passed: problems.length === 0, problems };
  if (problems.length) {
    report.feedback.push(...problems.map((p) => `[spec] ${p}`));
    return finish('BLOCKED', `spec is incomplete (${problems.length} problems) - fix the spec before any code is written`);
  }

  const source = read(change.implementation);

  // 2. Static security rules
  const violations = checkSecurityRules(source, spec);
  report.stages.securityRules = { passed: violations.length === 0, violations };
  report.feedback.push(...violations.map((v) => `[security] line ${v.line}: "${v.pattern}" - ${v.reason}`));

  // 3. Spec-derived tests
  const cases = deriveCases(spec);
  const results = await runCases(loadImplementation(change.implementation), cases);
  const failed = results.filter((r) => !r.passed);
  report.stages.specTests = { passed: failed.length === 0, total: results.length, failed };
  report.feedback.push(...failed.map((f) => `[test] ${f.id} (${f.rule}): ${f.failure}`));

  // 4. Mutation check - only meaningful when the tests pass on the real code.
  if (failed.length === 0) {
    const m = await runMutationCheck(source, cases);
    report.stages.mutation = { passed: m.score >= MUTATION_THRESHOLD, threshold: MUTATION_THRESHOLD, ...m };
    if (m.score < MUTATION_THRESHOLD) {
      report.feedback.push(...m.survivors.map((s) => `[weak-tests] line ${s.line}: "${s.mutated}" was not detected - add a spec rule that covers it`));
    }
  } else {
    report.stages.mutation = { skipped: true, reason: 'spec tests failed' };
  }

  // 5. Risk gate
  const baseline = change.baseline ? read(change.baseline) : null;
  const risk = assessRisk(spec, source, baseline);
  report.stages.risk = risk;

  const blockedBy = ['securityRules', 'specTests', 'mutation'].filter((s) => report.stages[s].passed === false);
  if (blockedBy.length) return finish('BLOCKED', `failed: ${blockedBy.join(', ')} - returned to the AI agent with ${report.feedback.length} feedback item(s)`);
  if (risk.level === 'high') return finish('NEEDS_HUMAN', `all checks passed, but ${risk.reason}`);
  return finish('AUTO_APPROVED', `all checks passed and ${risk.reason}`);
}

module.exports = { evaluateChange, ROOT, MUTATION_THRESHOLD };
