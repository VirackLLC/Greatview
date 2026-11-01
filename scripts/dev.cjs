// Local preview only. Production continues to use Vercel static hosting + /api functions.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
if (result.status) process.exit(result.status);
const root = path.resolve('dist');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://preview').pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (['/api/config', '/api/content', '/api/quote'].includes(pathname)) {
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16000) return res.status(413).json({ error: 'Request too large' });
    }
    try {
      req.body = body ? JSON.parse(body) : {};
      // Preview deliberately refuses to send emails. No production-test switch exists on Vercel.
      if (pathname === '/api/quote') return res.status(503).json({ error: 'Email sending is disabled in local preview.' });
      return await require(`../api/${pathname.split('/').pop()}.js`)(req, res);
    } catch {
      return res.status(400).json({ error: 'Invalid request' });
    }
  }
  const route = pathname === '/' ? '/index.html' : /^\/admin\/?$/.test(pathname) ? '/admin/index.html' : pathname;
  const file = path.resolve(root, `.${route}`);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(5000, '0.0.0.0', () => console.log('Greatview preview listening on port 5000 (email disabled)'));
