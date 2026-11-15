// Local web UI for the gate. No dependencies.
// Start with: npm run web   then open http://localhost:3000
//   /         gate dashboard (run scenarios through the quality gate)
//   /signup   a real signup page that calls any of the AI-written implementations
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateChange, ROOT } = require('../pipeline/gate');

const PORT = Number(process.env.PORT) || 3000;
const CHANGES_DIR = path.join(ROOT, 'changes');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'specs/signup.spec.json'), 'utf8'));

const PAGES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/signup': ['signup.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};

function loadChanges() {
  return fs.readdirSync(CHANGES_DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(CHANGES_DIR, f), 'utf8')));
}

// Implementations that can run behind the signup page (one per change, using the main spec).
function implementations() {
  return loadChanges().filter((c) => c.spec === 'specs/signup.spec.json');
}

// One in-memory service per implementation, so duplicates are remembered between submits.
const services = new Map();
function serviceFor(change) {
  if (!services.has(change.id)) {
    const abs = path.join(ROOT, change.implementation);
    delete require.cache[require.resolve(abs)];
    services.set(change.id, require(abs)());
  }
  return services.get(change.id);
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 10_000) reject(new Error('request too large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('invalid JSON')); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && PAGES[url.pathname]) {
      const [file, type] = PAGES[url.pathname];
      res.writeHead(200, { 'Content-Type': type });
      return res.end(fs.readFileSync(path.join(__dirname, file)));
    }

    if (req.method === 'GET' && url.pathname === '/api/changes') {
      return sendJson(res, 200, loadChanges().map(({ id, title, story, expectedVerdict }) => ({ id, title, story, expectedVerdict })));
    }

    if (req.method === 'GET' && url.pathname === '/api/spec') return sendJson(res, 200, SPEC);

    if (req.method === 'GET' && url.pathname === '/api/implementations') {
      return sendJson(res, 200, implementations().map((c) => ({
        id: c.id, title: c.title, expectedVerdict: c.expectedVerdict, users: services.has(c.id) ? serviceFor(c).inspectStore().length : 0,
      })));
    }

    const run = url.pathname.match(/^\/api\/run\/([\w-]+)$/);
    if (req.method === 'POST' && run) {
      // Only ids that exist in changes/ can be run - no arbitrary file paths.
      const change = loadChanges().find((c) => c.id === run[1]);
      if (!change) return sendJson(res, 404, { error: 'unknown change' });
      const result = await evaluateChange(change);
      return sendJson(res, 200, { ...result, story: change.story, expectedVerdict: change.expectedVerdict });
    }

    if (req.method === 'POST' && url.pathname === '/api/signup') {
      const { implementation, input } = await readBody(req);
      const change = implementations().find((c) => c.id === implementation);
      if (!change) return sendJson(res, 404, { error: 'unknown implementation' });
      const service = serviceFor(change);
      const result = await service.signup(input);
      return sendJson(res, 200, { ...result, storedUsers: service.inspectStore().length });
    }

    if (req.method === 'POST' && url.pathname === '/api/reset') {
      services.clear();
      return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Spec Gate running:`);
  console.log(`  Dashboard    http://localhost:${PORT}`);
  console.log(`  Signup page  http://localhost:${PORT}/signup`);
  console.log('Press Ctrl+C to stop.');
});
