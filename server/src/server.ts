import http from 'http';
import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { handlePagesRoute } from './routes/pages.js';
import { handleConnection } from './websocket/connection.js';
import * as db from './database.js';
import { initDatabase } from './database.js';

const host = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '1234', 10);
const dataDir = process.env.DATA_DIR;

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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    if (await handlePagesRoute(req, res, url)) {
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
    console.log(`y-websocket server running at '${host}' on port ${port}`);
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
