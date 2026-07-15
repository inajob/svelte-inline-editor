import * as awarenessProtocol from 'y-protocols/awareness';
import type { WSSharedDoc } from '../types.js';
import type { WebSocket } from 'ws';

export function handleAwarenessMessage(
  message: Uint8Array,
  doc: WSSharedDoc,
  sender: WebSocket
): void {
  awarenessProtocol.applyAwarenessUpdate(
    doc.awareness,
    message,
    sender
  );
}

export function getAwarenessStates(doc: WSSharedDoc): Map<number, unknown> {
  const states = doc.awareness.getStates();
  const result = new Map<number, unknown>();
  states.forEach((state, clientId) => {
    if (clientId !== doc.awareness.clientID) {
      result.set(clientId, state);
    }
  });
  return result;
}

export function removeDisconnectedClient(doc: WSSharedDoc, clientId: number): void {
  awarenessProtocol.removeAwarenessStates(doc.awareness, [clientId], null);
}
