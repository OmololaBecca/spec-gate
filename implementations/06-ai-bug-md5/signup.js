// User signup service. Plays the role of code written by an AI agent from specs/signup.spec.json.
const crypto = require('node:crypto');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('md5').update(salt + password).digest('hex');
  return `md5$${salt}$${hash}`;
}

function validate(input) {
  const errors = [];
  const { email, username, password } = input || {};

  if (typeof email !== 'string' || email.trim().length === 0) errors.push('email is required');
  else if (email.trim().length > 254 || !EMAIL_RE.test(email.trim())) errors.push('email is invalid');

  if (typeof username !== 'string') errors.push('username is required');
  else if (username.length < 3 || username.length > 20 || !USERNAME_RE.test(username)) errors.push('username must be 3-20 letters, digits or _');

  if (typeof password !== 'string') errors.push('password is required');
  else if (password.length < 12 || password.length > 128) errors.push('password must be 12-128 characters');
  else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) errors.push('password must contain a letter and a digit');

  return errors;
}

module.exports = function createSignupService() {
  const users = new Map();
  let nextId = 1;

  return {
    signup(input) {
      const errors = validate(input);
      if (errors.length > 0) return { status: 400, body: { errors } };

      const email = input.email.trim().toLowerCase();
      if (users.has(email)) return { status: 409, body: { errors: ['email already registered'] } };

      const user = { id: nextId++, email, username: input.username, passwordHash: hashPassword(input.password) };
      users.set(email, user);
      return { status: 201, body: { id: user.id, email: user.email, username: user.username } };
    },

    // Test hook: lets the gate check what is actually stored.
    inspectStore() {
      return [...users.values()];
    },
  };
};
