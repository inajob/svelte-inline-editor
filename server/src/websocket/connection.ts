import type { IncomingMessage } from 'http';
import type WebSocket from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { getYDoc } from '../document-manager.js';
import type { WSSharedDoc } from '../types.js';

const messageSync = 0;
const messageAwareness = 1;

const CONN_TIMEOUT = 30000;
const docs = new Map<string, WSSharedDoc>();

export function handleConnection(
  conn: WebSocket,
  _req: IncomingMessage,
  docName: string,
  gc: boolean = true
): void {
  conn.binaryType = 'arraybuffer';

  const doc = getYDoc(docName, gc);
  doc.conns.add(conn);
  docs.set(docName, doc);

  // Send SyncStep1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  try {
    conn.send(encoding.toUint8Array(encoder));
  } catch (_e) {
    // Connection might be closed
  }

  // Send awareness states to new connection
  if (doc.awareness && doc.awareness.getStates().size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    const clientIds = Array.from(doc.awareness.getStates().keys());
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, clientIds)
    );
    try {
      conn.send(encoding.toUint8Array(awarenessEncoder));
    } catch (_e) {
      // Connection might be closed
    }
  }

  // Setup ping/pong keepalive
  let pingInterval: NodeJS.Timeout;
  let pingTimeout: NodeJS.Timeout;

  function setupPing(): void {
    pingInterval = setInterval(() => {
      try { conn.ping(); } catch (_e) {}
    }, 15000);
    pingTimeout = setTimeout(() => { conn.terminate(); }, CONN_TIMEOUT);
  }

  setupPing();

  conn.on('pong', () => {
    clearTimeout(pingTimeout);
    pingTimeout = setTimeout(() => { conn.terminate(); }, CONN_TIMEOUT);
  });

  conn.on('message', (message: Buffer | ArrayBuffer, _isBinary: boolean) => {
    try {
      const data = new Uint8Array(message);
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync: {
          const replyEncoder = encoding.createEncoder();
          encoding.writeVarUint(replyEncoder, messageSync);

          // Check if this is SyncStep1 to extract clientId
          const peekDecoder = decoding.createDecoder(data);
          decoding.readVarUint(peekDecoder);
          const innerType = decoding.readVarUint(peekDecoder);
          if (innerType === 0) {
            try {
              const svBytes = decoding.readVarUint8Array(peekDecoder);
              const sv = Y.decodeStateVector(svBytes);
              for (const [clientId] of sv) {
                doc.connToClientId.set(conn, clientId);
              }
            } catch (_e) {}
          }

          syncProtocol.readSyncMessage(decoder, replyEncoder, doc, conn);
          const replyBytes = encoding.toUint8Array(replyEncoder);
          if (encoding.length(replyEncoder) > 1) {
            try { conn.send(replyBytes); } catch (_e) {}
          }
          break;
        }
        case messageAwareness: {
          const awarenessData = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(doc.awareness, awarenessData, conn);
          break;
        }
      }
    } catch (_e) {
      // Ignore message errors
    }
  });

  // Broadcast awareness updates to all other connections
  if (doc.awareness) {
    doc.awareness.on('update', ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }) => {
      const changedClients = added.concat(updated).concat(removed);
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, messageAwareness);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(doc.awareness, changedClients)
      );
      const awarenessMsg = encoding.toUint8Array(awarenessEncoder);
      doc.conns.forEach((otherConn) => {
        if (otherConn !== conn) {
          try { otherConn.send(awarenessMsg); } catch (_e) {}
        }
      });
    });
  }

  conn.on('close', () => {
    clearInterval(pingInterval);
    clearTimeout(pingTimeout);
    doc.conns.delete(conn);
    doc.connToClientId.delete(conn);

    if (doc.awareness) {
      const clientIds = Array.from(doc.awareness.getStates().keys());
      for (const clientId of clientIds) {
        if (clientId !== doc.awareness.clientID) {
          awarenessProtocol.removeAwarenessStates(doc.awareness, [clientId], null);
        }
      }
    }

    if (doc.conns.size === 0) {
      docs.delete(docName);
      doc.destroy();
    }
  });
}
