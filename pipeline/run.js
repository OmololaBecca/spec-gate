#!/usr/bin/env node
// CLI: node pipeline/run.js <change.json | changes-folder>
// Prints a summary and writes evidence/report.md + evidence/results.json.
// With a single change file, the exit code is 0 = approved, 1 = blocked, 2 = needs human (CI-friendly).

const fs = require('node:fs');
const path = require('node:path');
const { evaluateChange, ROOT } = require('./gate');

const COLORS = { AUTO_APPROVED: '\x1b[32m', BLOCKED: '\x1b[31m', NEEDS_HUMAN: '\x1b[33m' };
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

function loadChanges(target) {
  const abs = path.resolve(process.cwd(), target);
  const files = fs.statSync(abs).isDirectory()
    ? fs.readdirSync(abs).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(abs, f))
    : [abs];
  return files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
}

function printResult(r) {
  console.log(`\n${COLORS[r.verdict]}■ ${r.verdict}${RESET}  ${r.id} - ${r.title}  ${DIM}(${r.durationMs} ms)${RESET}`);
  console.log(`  ${r.reason}`);
  const s = r.stages;
  if (s.specTests) console.log(`${DIM}  spec tests: ${s.specTests.total - s.specTests.failed.length}/${s.specTests.total} passed` +
    (s.mutation && !s.mutation.skipped ? ` | mutation score: ${Math.round(s.mutation.score * 100)}% (${s.mutation.killed}/${s.mutation.total})` : '') +
    ` | security violations: ${s.securityRules.violations.length}${RESET}`);
  r.feedback.slice(0, 6).forEach((f) => console.log(`  → ${f}`));
  if (r.feedback.length > 6) console.log(`  → ...and ${r.feedback.length - 6} more`);
  if (r.verdict === 'NEEDS_HUMAN' && s.risk.sensitive.length) {
    console.log('  Human only needs to review these lines:');
    s.risk.sensitive.forEach((l) => console.log(`    ${l.kind} ${l.text}`));
  }
}

function writeReport(results) {
  const lines = ['# Gate Report', '', `Generated: ${new Date().toISOString()}`, '',
    '| Change | Verdict | Expected | Tests | Mutation | Security | Time |', '|---|---|---|---|---|---|---|'];
  for (const r of results) {
    const s = r.stages;
    const tests = s.specTests ? `${s.specTests.total - s.specTests.failed.length}/${s.specTests.total}` : '-';
    const mut = s.mutation && !s.mutation.skipped ? `${Math.round(s.mutation.score * 100)}%` : '-';
    const sec = s.securityRules ? String(s.securityRules.violations.length) : '-';
    const match = r.expectedVerdict ? (r.expectedVerdict === r.verdict ? '✅' : '❌') + ' ' + r.expectedVerdict : '-';
    lines.push(`| ${r.id} | **${r.verdict}** | ${match} | ${tests} | ${mut} | ${sec} | ${r.durationMs} ms |`);
  }
  for (const r of results) {
    lines.push('', `## ${r.id} - ${r.title}`, '', `**Verdict:** ${r.verdict} - ${r.reason}`, '');
    if (r.story) lines.push(`_${r.story}_`, '');
    if (r.feedback.length) lines.push('**Feedback sent back automatically:**', '', ...r.feedback.map((f) => `- ${f}`), '');
    const sens = r.stages.risk && r.stages.risk.sensitive;
    if (r.verdict === 'NEEDS_HUMAN' && sens && sens.length) lines.push('**Lines a human must review:**', '', '```diff', ...sens.map((l) => `${l.kind} ${l.text}`), '```', '');
    const surv = r.stages.mutation && r.stages.mutation.survivors;
    if (surv && surv.length) lines.push('**Surviving mutants (blind spots in the tests):**', '', ...surv.map((m) => `- line ${m.line} (${m.operator}): \`${m.mutated}\``), '');
  }
  fs.mkdirSync(path.join(ROOT, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'evidence', 'report.md'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(ROOT, 'evidence', 'results.json'), JSON.stringify(results, null, 2) + '\n');
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node pipeline/run.js <change.json | changes-folder>');
    process.exit(64);
  }
  const changes = loadChanges(target);
  const results = [];
  for (const change of changes) {
    const r = { ...(await evaluateChange(change)), story: change.story, expectedVerdict: change.expectedVerdict };
    printResult(r);
    results.push(r);
  }
  writeReport(results);

  const count = (v) => results.filter((r) => r.verdict === v).length;
  const total = results.reduce((sum, r) => sum + r.durationMs, 0);
  console.log(`\nSummary: ${count('AUTO_APPROVED')} auto-approved, ${count('BLOCKED')} blocked, ${count('NEEDS_HUMAN')} need a human - total ${(total / 1000).toFixed(1)}s`);
  console.log('Evidence written to evidence/report.md');

  if (changes.length === 1) process.exit({ AUTO_APPROVED: 0, BLOCKED: 1, NEEDS_HUMAN: 2 }[results[0].verdict]);
}

main().catch((err) => {
  console.error(err);
  process.exit(70);
});
