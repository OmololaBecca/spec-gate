// Stage 3 - Tests derived from the SPEC, never from the code.
// The AI that wrote the code never sees or writes these tests, so it cannot "agree with itself".
// Each case returns null when it passes, or a failure message the AI agent can act on.

function sample(field, length) {
  if (field.format === 'email') {
    const domain = '@example.com';
    return 'a'.repeat(Math.max(1, length - domain.length)) + domain;
  }
  const tail = (field.mustContain || []).includes('digit') ? '1' : 'a';
  return 'a'.repeat(Math.max(0, length - 1)) + tail;
}

function deriveCases(spec) {
  const cases = [];
  const OK = spec.responses.success.status;
  const BAD = spec.responses.validationError.status;
  const DUP = spec.responses.duplicate && spec.responses.duplicate.status;
  const call = (service, input) => service[spec.operation](input);
  const withField = (name, value) => ({ ...spec.example, [name]: value });

  const add = (id, rule, run) => cases.push({ id, rule, run });
  const expectStatus = (id, rule, makeInput, status) =>
    add(id, rule, async (service) => {
      const res = await call(service, makeInput());
      return res.status === status ? null : `expected status ${status}, got ${res.status}`;
    });

  // Happy path
  add('happy-path', 'example input succeeds with the documented fields', async (service) => {
    const res = await call(service, { ...spec.example });
    if (res.status !== OK) return `expected status ${OK}, got ${res.status}`;
    const missing = spec.responses.success.bodyFields.filter((f) => !(res.body && f in res.body));
    return missing.length ? `response is missing fields: ${missing.join(', ')}` : null;
  });

  // Input rules
  for (const [name, f] of Object.entries(spec.inputs)) {
    if (f.required) {
      expectStatus(`${name}-missing`, `inputs.${name}.required`, () => {
        const input = { ...spec.example };
        delete input[name];
        return input;
      }, BAD);
      if (f.type === 'string') expectStatus(`${name}-blank`, `inputs.${name}.required`, () => withField(name, '   '), BAD);
    }
    if (f.type === 'string') expectStatus(`${name}-wrong-type`, `inputs.${name}.type`, () => withField(name, 12345), BAD);

    if (f.minLength) {
      expectStatus(`${name}-below-min`, `inputs.${name}.minLength`, () => withField(name, sample(f, f.minLength - 1)), BAD);
      expectStatus(`${name}-at-min`, `inputs.${name}.minLength`, () => withField(name, sample(f, f.minLength)), OK);
    }
    if (f.maxLength) {
      expectStatus(`${name}-above-max`, `inputs.${name}.maxLength`, () => withField(name, sample(f, f.maxLength + 1)), BAD);
      expectStatus(`${name}-at-max`, `inputs.${name}.maxLength`, () => withField(name, sample(f, f.maxLength)), OK);
    }
    if (f.pattern) {
      const bad = sample(f, Math.max(f.minLength || 3, 3)).slice(0, -1) + '!';
      if (!new RegExp(f.pattern).test(bad)) expectStatus(`${name}-bad-characters`, `inputs.${name}.pattern`, () => withField(name, bad), BAD);
    }
    if (f.format === 'email') {
      ['not-an-email', 'ada@', '@example.com', 'ada@example', 'ada lovelace@example.com'].forEach((value, i) =>
        expectStatus(`${name}-bad-format-${i + 1}`, `inputs.${name}.format`, () => withField(name, value), BAD));
    }
    const len = f.minLength || 12;
    if ((f.mustContain || []).includes('letter')) expectStatus(`${name}-no-letter`, `inputs.${name}.mustContain`, () => withField(name, '1'.repeat(len)), BAD);
    if ((f.mustContain || []).includes('digit')) expectStatus(`${name}-no-digit`, `inputs.${name}.mustContain`, () => withField(name, 'a'.repeat(len)), BAD);

    if (f.unique && DUP) {
      add(`${name}-duplicate`, `inputs.${name}.unique`, async (service) => {
        await call(service, { ...spec.example });
        const res = await call(service, { ...spec.example, username: 'someone_else' });
        return res.status === DUP ? null : `second signup with same ${name}: expected ${DUP}, got ${res.status}`;
      });
      if (f.normalize) {
        add(`${name}-duplicate-normalized`, `inputs.${name}.normalize`, async (service) => {
          await call(service, { ...spec.example });
          let variant = spec.example[name];
          if (f.normalize.includes('lowercase')) variant = variant.toUpperCase();
          if (f.normalize.includes('trim')) variant = `  ${variant}  `;
          const res = await call(service, { ...spec.example, [name]: variant, username: 'someone_else' });
          return res.status === DUP ? null : `"${variant}" should count as a duplicate: expected ${DUP}, got ${res.status}`;
        });
      }
    }
  }

  // Security rules
  const secrets = Object.entries(spec.inputs).filter(([, f]) => f.secret).map(([n]) => n);
  const neverReturn = spec.security.neverReturn || [];

  add('response-hides-secrets', 'security.neverReturn', async (service) => {
    const res = await call(service, { ...spec.example });
    const text = JSON.stringify(res.body);
    const leakedKeys = neverReturn.filter((k) => text.includes(`"${k}"`));
    const leakedValues = secrets.filter((s) => text.includes(spec.example[s]));
    if (leakedKeys.length) return `response exposes: ${leakedKeys.join(', ')}`;
    return leakedValues.length ? `response contains the raw value of: ${leakedValues.join(', ')}` : null;
  });

  for (const s of secrets) {
    add(`${s}-not-stored-in-plain-text`, `security.storage.${s}`, async (service) => {
      await call(service, { ...spec.example });
      const stored = JSON.stringify(service.inspectStore());
      return stored.includes(spec.example[s]) ? `the raw ${s} is stored in plain text` : null;
    });
    add(`${s}-hash-is-salted`, `security.storage.${s}`, async (service) => {
      await call(service, { ...spec.example });
      await call(service, { ...spec.example, email: 'grace@example.com', username: 'grace_hopper' });
      const [a, b] = service.inspectStore().map((u) => JSON.stringify(Object.values(u).filter((v) => typeof v === 'string' && v.length > 30)));
      return a && a === b ? `two users with the same ${s} have identical stored hashes (no salt)` : null;
    });
  }

  return cases;
}

// Runs cases against a service factory. stopOnFirstFailure is used by mutation testing for speed.
async function runCases(createService, cases, { stopOnFirstFailure = false } = {}) {
  const results = [];
  for (const c of cases) {
    let failure;
    try {
      failure = await c.run(createService());
    } catch (err) {
      failure = `threw an error: ${err.message}`;
    }
    results.push({ id: c.id, rule: c.rule, passed: !failure, failure: failure || null });
    if (failure && stopOnFirstFailure) break;
  }
  return results;
}

module.exports = { deriveCases, runCases };
