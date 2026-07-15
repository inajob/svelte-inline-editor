import type { IncomingMessage, ServerResponse } from 'http';
import * as db from '../database.js';
import { destroyYDoc, getYDoc } from '../document-manager.js';
import type { CreatePageRequest, UpdatePageRequest } from '../types.js';

export async function handlePagesRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const method = req.method;
  const path = url.pathname;

  if (path === '/api/pages') {
    switch (method) {
      case 'GET':
        return handleListPages(res);
      case 'POST':
        return await handleCreatePage(req, res);
    }
  }

  const backlinksMatch = path.match(/^\/api\/pages\/(.+)\/backlinks$/);
  if (backlinksMatch && method === 'GET') {
    const title = decodeURIComponent(backlinksMatch[1]);
    return handleGetBacklinks(res, title);
  }

  const pageMatch = path.match(/^\/api\/pages\/(.+)$/);
  if (pageMatch) {
    const title = decodeURIComponent(pageMatch[1]);
    switch (method) {
      case 'DELETE':
        return handleDeletePage(res, title);
      case 'PUT':
        return await handleRenamePage(req, res, title);
    }
  }

  return false;
}

function handleListPages(res: ServerResponse): boolean {
  const pages = db.listPages();
  sendJson(res, 200, pages);
  return true;
}

async function handleCreatePage(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  try {
    const body = await readBody<CreatePageRequest>(req);
    if (!body?.title) {
      sendJson(res, 400, { error: 'Title is required' });
      return true;
    }

    const existing = db.getPage(body.title);
    if (existing) {
      sendJson(res, 409, { error: 'Page already exists' });
      return true;
    }

    const page = db.upsertPage(body.title);
    getYDoc(body.title);
    sendJson(res, 201, page);
    return true;
  } catch (_e) {
    sendJson(res, 500, { error: 'Internal server error' });
    return true;
  }
}

function handleDeletePage(res: ServerResponse, title: string): boolean {
  const deleted = db.deletePage(title);
  if (deleted) {
    destroyYDoc(title);
    sendJson(res, 200, { success: true });
  } else {
    sendJson(res, 404, { error: 'Page not found' });
  }
  return true;
}

async function handleRenamePage(
  req: IncomingMessage,
  res: ServerResponse,
  oldTitle: string
): Promise<boolean> {
  try {
    const body = await readBody<UpdatePageRequest>(req);
    if (!body?.newTitle) {
      sendJson(res, 400, { error: 'New title is required' });
      return true;
    }

    const success = db.renamePage(oldTitle, body.newTitle);
    if (success) {
      sendJson(res, 200, { title: body.newTitle });
    } else {
      sendJson(res, 409, { error: 'New title already exists' });
    }
    return true;
  } catch (_e) {
    sendJson(res, 500, { error: 'Internal server error' });
    return true;
  }
}

function handleGetBacklinks(res: ServerResponse, title: string): boolean {
  const backlinks = db.getBacklinks(title);
  sendJson(res, 200, backlinks);
  return true;
}

function readBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString();
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
