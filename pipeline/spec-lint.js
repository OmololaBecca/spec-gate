// Stage 1 - Spec lint.
// Rejects a spec that is too vague to build or test safely, BEFORE any code is written.
// Every problem here is a question an AI agent would otherwise silently guess the answer to.

const SECRET_NAME = /pass|secret|token|pin/i;

function lintSpec(spec) {
  const problems = [];
  const need = (ok, message) => { if (!ok) problems.push(message); };

  need(spec.feature, 'feature name is missing');
  need(spec.operation, 'operation (the function under test) is missing');
  need(spec.inputs && Object.keys(spec.inputs).length > 0, 'no inputs are defined');
  need(spec.example, 'no valid example input - tests cannot be derived without one');
  need(['low', 'high'].includes(spec.riskLevel), 'riskLevel must be "low" or "high"');

  const responses = spec.responses || {};
  const security = spec.security || {};
  need(responses.success && responses.success.status, 'responses.success.status is missing - what does success look like?');
  need(responses.validationError && responses.validationError.status, 'responses.validationError.status is missing - what happens on bad input?');
  need(spec.security, 'security section is missing - how are secrets stored and protected?');

  for (const [name, field] of Object.entries(spec.inputs || {})) {
    need(field.type, `inputs.${name}.type is missing`);
    need(typeof field.required === 'boolean', `inputs.${name}.required must be true or false`);

    if (field.type === 'string') {
      need(field.maxLength, `inputs.${name}.maxLength is missing - unbounded input is a denial-of-service and storage risk`);
    }
    if (field.unique) {
      need(responses.duplicate && responses.duplicate.status, `inputs.${name} is unique but there is no responses.duplicate - what happens on a duplicate?`);
      need(field.normalize, `inputs.${name} is unique but has no normalize rule - is "Ada@x.com" the same as "ada@x.com"?`);
    }
    if (SECRET_NAME.test(name)) {
      need(field.secret === true, `inputs.${name} looks like a secret but is not marked "secret": true`);
    }
    if (field.secret) {
      need(security.storage && security.storage[name] === 'hashed', `inputs.${name} is secret but security.storage.${name} is not "hashed"`);
      need((security.neverReturn || []).includes(name), `inputs.${name} is secret but is not listed in security.neverReturn`);
    }
    if (field.required && spec.example) {
      need(spec.example[name] !== undefined, `example is missing required input "${name}"`);
    }
  }

  return problems;
}

module.exports = { lintSpec };
