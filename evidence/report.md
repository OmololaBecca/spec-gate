# Gate Report

Generated: 2026-11-14T14:37:44.542Z

| Change | Verdict | Expected | Tests | Mutation | Security | Time |
|---|---|---|---|---|---|---|
| 01-initial | **NEEDS_HUMAN** | ✅ NEEDS_HUMAN | 33/33 | 94% | 0 | 4782 ms |
| 02-username-message | **AUTO_APPROVED** | ✅ AUTO_APPROVED | 33/33 | 94% | 0 | 5000 ms |
| 03-ai-bug-weak-password | **BLOCKED** | ✅ BLOCKED | 32/33 | - | 0 | 453 ms |
| 04-ai-bug-case-duplicate | **BLOCKED** | ✅ BLOCKED | 32/33 | - | 0 | 466 ms |
| 05-ai-bug-leaks-hash | **BLOCKED** | ✅ BLOCKED | 32/33 | - | 0 | 417 ms |
| 06-ai-bug-md5 | **BLOCKED** | ✅ BLOCKED | 33/33 | 94% | 2 | 44 ms |
| 07-hash-upgrade | **NEEDS_HUMAN** | ✅ NEEDS_HUMAN | 33/33 | 94% | 0 | 4822 ms |
| 08-incomplete-spec | **BLOCKED** | ✅ BLOCKED | - | - | - | 1 ms |
| 09-honest-miss-input-log | **AUTO_APPROVED** | ✅ AUTO_APPROVED | 33/33 | 94% | 0 | 4829 ms |

## 01-initial - AI builds the signup feature from the spec

**Verdict:** NEEDS_HUMAN - all checks passed, but brand-new implementation of a high-risk feature with no human-approved baseline

_First version of a high-risk feature. Everything passes, but with no approved baseline a human signs it off once. After that it becomes the baseline._

**Surviving mutants (blind spots in the tests):**

- line 17 (drop normalisation): `if (typeof email !== 'string' || email.length === 0) errors.push('email is required');`
- line 18 (drop normalisation): `else if (email.length > 254 || !EMAIL_RE.test(email.trim())) errors.push('email is invalid');`


## 02-username-message - AI rewords the username error message

**Verdict:** AUTO_APPROVED - all checks passed and 2 changed line(s), none touch sensitive code

_Low-risk change. All checks pass and no sensitive code was touched, so it ships with zero human time._

**Surviving mutants (blind spots in the tests):**

- line 17 (drop normalisation): `if (typeof email !== 'string' || email.length === 0) errors.push('email is required');`
- line 18 (drop normalisation): `else if (email.length > 254 || !EMAIL_RE.test(email.trim())) errors.push('email is invalid');`


## 03-ai-bug-weak-password - AI "simplifies" the password rule to 8 characters

**Verdict:** BLOCKED - failed: specTests - returned to the AI agent with 1 feedback item(s)

_A classic AI drift: the model falls back on a common default (8 chars) instead of the spec (12). The boundary test derived from the spec catches it._

**Feedback sent back automatically:**

- [test] password-below-min (inputs.password.minLength): expected status 400, got 201


## 04-ai-bug-case-duplicate - AI refactor drops email lower-casing

**Verdict:** BLOCKED - failed: specTests - returned to the AI agent with 1 feedback item(s)

_Subtle bug: Ada@example.com and ada@example.com become two accounts (account takeover / duplicate risk). Caught by the normalize rule in the spec._

**Feedback sent back automatically:**

- [test] email-duplicate-normalized (inputs.email.normalize): "  ADA@EXAMPLE.COM  " should count as a duplicate: expected 409, got 201


## 05-ai-bug-leaks-hash - AI returns the whole user object for convenience

**Verdict:** BLOCKED - failed: specTests - returned to the AI agent with 1 feedback item(s)

_Security bug: the password hash is sent back to the client. Caught by the security.neverReturn rule._

**Feedback sent back automatically:**

- [test] response-hides-secrets (security.neverReturn): response exposes: passwordHash


## 06-ai-bug-md5 - AI switches password hashing to MD5 "for speed"

**Verdict:** BLOCKED - failed: securityRules - returned to the AI agent with 2 feedback item(s)

_Every functional test PASSES here - the hash is salted and not plain text. Only the static security rules catch it. Shows why tests alone are not enough._

**Feedback sent back automatically:**

- [security] line 9: "md5" - MD5 is broken and must never be used for passwords
- [security] line 10: "md5" - MD5 is broken and must never be used for passwords

**Surviving mutants (blind spots in the tests):**

- line 17 (drop normalisation): `if (typeof email !== 'string' || email.length === 0) errors.push('email is required');`
- line 18 (drop normalisation): `else if (email.length > 254 || !EMAIL_RE.test(email.trim())) errors.push('email is invalid');`


## 07-hash-upgrade - AI strengthens hashing (32 -> 64 byte key)

**Verdict:** NEEDS_HUMAN - all checks passed, but 2 changed line(s) touch sensitive code (password, hash, crypto, scrypt, salt, secret)

_A correct change, but it touches password hashing. The gate escalates it and shows the human only the 2 lines that changed, not the whole file._

**Lines a human must review:**

```diff
- const hash = crypto.scryptSync(password, salt, 32).toString('hex');
+ const hash = crypto.scryptSync(password, salt, 64).toString('hex');
```

**Surviving mutants (blind spots in the tests):**

- line 17 (drop normalisation): `if (typeof email !== 'string' || email.length === 0) errors.push('email is required');`
- line 18 (drop normalisation): `else if (email.length > 254 || !EMAIL_RE.test(email.trim())) errors.push('email is invalid');`


## 08-incomplete-spec - Rough ticket goes straight to the AI

**Verdict:** BLOCKED - spec is incomplete (8 problems) - fix the spec before any code is written

_The spec itself is vague (no max lengths, no duplicate rule, password not marked secret). Blocked before any code runs - the cheapest place to find a defect._

**Feedback sent back automatically:**

- [spec] responses.validationError.status is missing - what happens on bad input?
- [spec] security section is missing - how are secrets stored and protected?
- [spec] inputs.email.maxLength is missing - unbounded input is a denial-of-service and storage risk
- [spec] inputs.email is unique but there is no responses.duplicate - what happens on a duplicate?
- [spec] inputs.email is unique but has no normalize rule - is "Ada@x.com" the same as "ada@x.com"?
- [spec] inputs.username.maxLength is missing - unbounded input is a denial-of-service and storage risk
- [spec] inputs.password.maxLength is missing - unbounded input is a denial-of-service and storage risk
- [spec] inputs.password looks like a secret but is not marked "secret": true


## 09-honest-miss-input-log - AI adds an "analytics" list of recent signups

**Verdict:** AUTO_APPROVED - all checks passed and 2 changed line(s), none touch sensitive code

_KNOWN MISS. The code keeps raw signup input - including plain-text passwords - in memory. No rule, test or keyword catches it, so it is auto-approved. See directive.md for how to close this gap._

**Surviving mutants (blind spots in the tests):**

- line 17 (drop normalisation): `if (typeof email !== 'string' || email.length === 0) errors.push('email is required');`
- line 18 (drop normalisation): `else if (email.length > 254 || !EMAIL_RE.test(email.trim())) errors.push('email is invalid');`

