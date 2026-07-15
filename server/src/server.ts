import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { handlePagesRoute } from './routes/pages.js';
import { handleConnection } from './websocket/connection.js';
import * as db from './database.js';
import { initDatabase } from './database.js';

const host = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '1234', 10);
const dataDir = process.env.DATA_DIR;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', '..', 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webp': 'image/webp',
  '.map': 'application/json',
};

function serveStaticFile(res: http.ServerResponse, filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

function serveIndex(res: http.ServerResponse): void {
  const indexPath = path.join(distDir, 'index.html');
  try {
    const content = fs.readFileSync(indexPath);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Frontend not built. Run "npm run build" first.' }));
  }
}

export function createServer(): { server: http.Server; wss: WebSocketServer } {
  initDatabase(dataDir);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      if (req.method === 'GET' && url.pathname === '/') {
        serveIndex(res);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    if (await handlePagesRoute(req, res, url)) {
      return;
    }

    if (req.method === 'GET') {
      const filePath = path.join(distDir, url.pathname);
      if (serveStaticFile(res, filePath)) return;

      serveIndex(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const docName = decodeURIComponent(url.pathname.slice(1));

    if (!docName) {
      ws.close(1008, 'Document name required');
      return;
    }

    handleConnection(ws, req, docName, true);
  });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  server.listen(port, host, () => {
    console.log(`Server running at '${host}' on port ${port}`);
  });

  return { server, wss };
}

process.on('SIGINT', () => {
  console.log('Shutting down...');
  db.closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  db.closeDatabase();
  process.exit(0);
});
