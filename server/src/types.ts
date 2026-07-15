import type * as Y from 'yjs';

export interface YjsLine {
  id: string;
  text: Y.Text;
}

export interface AwarenessState {
  userId: string;
  userName: string;
  color: string;
  editingLineId: string | null;
}

export interface PageInfo {
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePageRequest {
  title: string;
}

export interface UpdatePageRequest {
  newTitle: string;
}

export interface ConnectionInfo {
  docName: string;
  ws: import('ws').WebSocket;
  req: import('http').IncomingMessage;
}

export interface WSSharedDoc extends Y.Doc {
  name: string;
  conns: Set<import('ws').WebSocket>;
  awareness: import('y-protocols/awareness').Awareness;
  connToClientId: Map<import('ws').WebSocket, number>;
}
