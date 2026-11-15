// Tests for the gate itself. If the gate is wrong, everything downstream is wrong.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateChange, ROOT, MUTATION_THRESHOLD } = require('../pipeline/gate');
const { lintSpec } = require('../pipeline/spec-lint');
const { deriveCases } = require('../pipeline/derive-tests');
const { runMutationCheck } = require('../pipeline/mutation-check');
const { checkSecurityRules } = require('../pipeline/security-rules');

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'specs/signup.spec.json'), 'utf8'));
const goodSource = fs.readFileSync(path.join(ROOT, 'implementations/01-initial/signup.js'), 'utf8');

test('the complete spec passes lint', () => {
  assert.deepStrictEqual(lintSpec(spec), []);
});

test('the rough spec is rejected with specific, actionable problems', () => {
  const rough = JSON.parse(fs.readFileSync(path.join(ROOT, 'specs/signup-incomplete.spec.json'), 'utf8'));
  const problems = lintSpec(rough);
  assert.ok(problems.some((p) => p.includes('password looks like a secret')));
  assert.ok(problems.some((p) => p.includes('no responses.duplicate')));
  assert.ok(problems.some((p) => p.includes('maxLength is missing')));
});

test('security rules ignore comments but catch real code', () => {
  assert.strictEqual(checkSecurityRules('// never use md5 here', spec).length, 0);
  assert.strictEqual(checkSecurityRules("crypto.createHash('md5')", spec).length, 1);
});

test('weak tests are detected: happy-path-only testing falls below the mutation threshold', async () => {
  const happyOnly = deriveCases(spec).filter((c) => c.id === 'happy-path');
  const weak = await runMutationCheck(goodSource, happyOnly);
  const full = await runMutationCheck(goodSource, deriveCases(spec));
  assert.ok(weak.score < MUTATION_THRESHOLD, `happy-path-only score ${weak.score} should be below threshold`);
  assert.ok(full.score >= MUTATION_THRESHOLD, `full score ${full.score} should meet threshold`);
});

// Every scenario in changes/ declares the verdict it should get. The gate must agree.
const changeFiles = fs.readdirSync(path.join(ROOT, 'changes')).filter((f) => f.endsWith('.json')).sort();
for (const file of changeFiles) {
  const change = JSON.parse(fs.readFileSync(path.join(ROOT, 'changes', file), 'utf8'));
  test(`scenario ${change.id} -> ${change.expectedVerdict}`, async () => {
    const result = await evaluateChange(change);
    assert.strictEqual(result.verdict, change.expectedVerdict, result.reason);
  });
}
