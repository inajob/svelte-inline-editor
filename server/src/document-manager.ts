import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type WebSocket from 'ws';
import * as db from './database.js';
import type { WSSharedDoc } from './types.js';

const docs = new Map<string, WSSharedDoc>();

export function getYDoc(docName: string, gc: boolean = true): WSSharedDoc {
  const existingDoc = docs.get(docName);
  if (existingDoc) return existingDoc;

  const doc = new Y.Doc({ gc }) as WSSharedDoc;
  doc.name = docName;
  doc.conns = new Set();
  doc.awareness = new Awareness(doc);
  doc.connToClientId = new Map();

  const persistedUpdates = db.getUpdates(docName);
  if (persistedUpdates.length > 0) {
    Y.transact(doc, () => {
      for (const update of persistedUpdates) {
        Y.applyUpdate(doc, update);
      }
    });
  }

  doc.on('update', (update: Uint8Array, origin: any) => {
    const clientId = (origin && typeof origin === 'number')
      ? origin
      : (doc.connToClientId.get(origin) ?? undefined);
    try {
      db.storeUpdate(docName, update, clientId);
    } catch (_e) {
      // Ignore store errors
    }
    broadcastUpdate(doc, update, clientId);
  });

  docs.set(docName, doc);
  return doc;
}

export function getYDocIfLoaded(docName: string): WSSharedDoc | undefined {
  return docs.get(docName);
}

export function destroyYDoc(docName: string): void {
  const doc = docs.get(docName);
  if (doc) {
    doc.conns.clear();
    doc.awareness.destroy();
    doc.destroy();
    docs.delete(docName);
    db.clearUpdates(docName);
    db.deletePage(docName);
  }
}

export function isOfflineConflict(
  serverDoc: Y.Doc,
  clientStateVector: Uint8Array
): boolean {
  const serverMap = Y.decodeStateVector(Y.encodeStateVector(serverDoc));
  const clientMap = Y.decodeStateVector(clientStateVector);

  for (const [clientID] of serverMap) {
    if (clientMap.has(clientID)) {
      return false;
    }
  }
  return true;
}

export function concatenateDocuments(
  serverDoc: Y.Doc,
  clientDoc: Y.Doc
): Y.Doc {
  const merged = new Y.Doc();
  const mergedLines = merged.getArray<Y.Map<unknown>>('lines');

  const serverLines = serverDoc.getArray<Y.Map<unknown>>('lines');
  for (const line of serverLines) {
    const newLine = new Y.Map();
    const id = line.get('id');
    const text = line.get('text') as Y.Text;
    newLine.set('id', id);
    newLine.set('text', new Y.Text());
    if (text) {
      (newLine.get('text') as Y.Text).insert(0, text.toString());
    }
    mergedLines.push([newLine]);
  }

  const clientLines = clientDoc.getArray<Y.Map<unknown>>('lines');
  for (const line of clientLines) {
    const newLine = new Y.Map();
    const id = line.get('id');
    const text = line.get('text') as Y.Text;
    newLine.set('id', id);
    newLine.set('text', new Y.Text());
    if (text) {
      (newLine.get('text') as Y.Text).insert(0, text.toString());
    }
    mergedLines.push([newLine]);
  }

  return merged;
}

function broadcastUpdate(doc: WSSharedDoc, update: Uint8Array, excludeClientId?: number): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0);
  encoding.writeVarUint(encoder, 2);
  encoding.writeVarUint8Array(encoder, update);
  const message = encoding.toUint8Array(encoder);

  doc.conns.forEach((conn: WebSocket) => {
    if (excludeClientId !== undefined && doc.connToClientId.get(conn) === excludeClientId) {
      return;
    }
    try {
      conn.send(message);
    } catch (_e) {
      // Connection might be closed
    }
  });
}

export function getDocNames(): string[] {
  return Array.from(docs.keys());
}

export function getDocCount(): number {
  return docs.size;
}
