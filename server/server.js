/*
 * FuturePayCA · 回测后端 (zero-dependency HTTP server)
 * ───────────────────────────────────────────────────────────────────────
 * 同时做两件事：
 *   1) 静态服务器 —— 把整个项目目录当站点提供（http://localhost:3000/rc-backtest.html）。
 *   2) 回测 API   —— /api/rules · /api/sweep · /api/backtest · /api/health。
 *
 * 启动：  node server/server.js        （或  PORT=8080 node server/server.js）
 * 前端会优先调用这些 API；若后端没开（如 file:// 直接打开页面），自动回退到浏览器内本地计算。
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const engine = require('./engine');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

function sendJson(res, obj, code = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function handleApi(pathname, q, res) {
  try {
    if (pathname === '/api/health') return sendJson(res, { ok: true, ts: Date.now() });
    if (pathname === '/api/rules')  return sendJson(res, engine.rulesList());

    const ruleId = q.get('ruleId');
    const rule = ruleId ? engine.getRule(ruleId) : null;
    if (!rule) return sendJson(res, { error: 'rule_not_found', ruleId: ruleId || null }, 404);

    if (pathname === '/api/sweep')    return sendJson(res, engine.sweep(rule));
    if (pathname === '/api/backtest') return sendJson(res, engine.backtest(rule, q.get('window'), q.get('baseline')));
    return sendJson(res, { error: 'unknown_endpoint', pathname }, 404);
  } catch (e) {
    return sendJson(res, { error: 'engine_error', message: String((e && e.message) || e) }, 500);
  }
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');

  if (u.pathname.startsWith('/api/')) return handleApi(u.pathname, u.searchParams, res);

  // 静态文件（限定在项目目录内，防目录穿越）
  let rel = decodeURIComponent(u.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('403 Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found: ' + rel); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  FuturePayCA 回测后端已启动`);
  console.log(`  → 应用:  http://localhost:${PORT}/rc-backtest.html`);
  console.log(`  → API :  /api/rules · /api/sweep?ruleId=RULE-003 · /api/backtest?ruleId=RULE-003&window=1&baseline=online`);
  console.log(`  把真实交易放到 server/data/<ruleId>.csv (列: score,label) 即可跑真实数据。\n`);
});
