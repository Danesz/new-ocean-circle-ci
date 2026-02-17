import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '3000', 10);

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const CIRCLECI = 'https://circleci.com';

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  // --- API proxy: v2 ---
  if (path.startsWith('/api/circleci/')) {
    const target = `${CIRCLECI}/api/v2${path.replace('/api/circleci', '')}${url.search}`;
    return proxy(req, res, target);
  }

  // --- API proxy: v1.1 ---
  if (path.startsWith('/api/circleci-v1/')) {
    const target = `${CIRCLECI}/api/v1.1${path.replace('/api/circleci-v1', '')}${url.search}`;
    return proxy(req, res, target);
  }

  // --- Step log proxy (CORS workaround for S3 URLs) ---
  if (path === '/api/step-log') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
    }
    return proxy(req, res, targetUrl);
  }

  // --- Static files from dist/ ---
  await serveStatic(req, res, path);
});

/** Proxy a request to an upstream URL, forwarding Circle-Token header */
async function proxy(req, res, target) {
  try {
    const headers = {};
    if (req.headers['circle-token']) headers['Circle-Token'] = req.headers['circle-token'];
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

    // Read request body for POST/PUT
    let body;
    if (req.method === 'POST' || req.method === 'PUT') {
      body = await readBody(req);
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
    });

    const ct = upstream.headers.get('content-type');
    res.writeHead(upstream.status, {
      'Content-Type': ct ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(err) }));
  }
}

/** Read request body as a string */
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

/** Serve static files from dist/, falling back to index.html for SPA */
async function serveStatic(_req, res, urlPath) {
  // Try the exact file first
  let filePath = join(DIST, urlPath === '/' ? 'index.html' : urlPath);

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    // Not found — serve index.html for SPA routing
    filePath = join(DIST, 'index.html');
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found. Run "npm run build" first.');
  }
}

server.listen(PORT, () => {
  console.log(`Ocean CI running at http://localhost:${PORT}`);
});
