// Stage 4 - Test the tests (mutation testing).
// We deliberately plant small bugs ("mutants") in the code and re-run the spec tests.
// If a planted bug survives, our tests have a blind spot - so a green test run cannot be trusted yet.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCases } = require('./derive-tests');

const OPERATORS = [
  { name: 'flip comparison', re: / (<=|>=|<|>) /g, to: (m) => ({ ' < ': ' <= ', ' <= ': ' < ', ' > ': ' >= ', ' >= ': ' > ' }[m]) },
  { name: 'shift boundary', re: /(?<=[<>]=? )\d+/g, to: (m) => String(Number(m) + 1) },
  { name: 'invert equality', re: /===|!==/g, to: (m) => (m === '===' ? '!==' : '===') },
  { name: 'swap and/or', re: /&&|\|\|/g, to: (m) => (m === '&&' ? '||' : '&&') },
  { name: 'drop negation', re: /!(?=[\w/(])/g, to: () => '' },
  { name: 'drop normalisation', re: /\.(trim|toLowerCase)\(\)/g, to: () => '' },
  { name: 'bypass transform', re: /\w+\((input\.\w+)\)/g, to: (m) => m.replace(/^\w+\((.*)\)$/, '$1') },
  { name: 'change status code', re: /(?<=status: )\d{3}/g, to: (m) => (m.startsWith('2') ? '400' : '201') },
];

function generateMutants(source) {
  const lines = source.split('\n');
  const mutants = [];
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    for (const op of OPERATORS) {
      for (const match of line.matchAll(op.re)) {
        const mutatedLine = line.slice(0, match.index) + op.to(match[0]) + line.slice(match.index + match[0].length);
        if (mutatedLine === line) continue;
        const copy = [...lines];
        copy[i] = mutatedLine;
        mutants.push({ operator: op.name, line: i + 1, original: line.trim(), mutated: mutatedLine.trim(), source: copy.join('\n') });
      }
    }
  });
  return mutants;
}

async function runMutationCheck(source, cases) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-gate-'));
  const mutants = generateMutants(source);
  const survivors = [];
  let killed = 0;
  let invalid = 0;

  try {
    for (const [i, m] of mutants.entries()) {
      const file = path.join(dir, `mutant-${i}.js`);
      fs.writeFileSync(file, m.source);
      let createService;
      try {
        createService = require(file);
      } catch {
        invalid++;
        continue;
      }
      const results = await runCases(createService, cases, { stopOnFirstFailure: true });
      if (results.some((r) => !r.passed)) killed++;
      else survivors.push({ operator: m.operator, line: m.line, original: m.original, mutated: m.mutated });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const valid = mutants.length - invalid;
  return { total: valid, killed, score: valid ? killed / valid : 1, survivors };
}

module.exports = { runMutationCheck, generateMutants };
