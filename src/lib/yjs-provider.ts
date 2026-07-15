import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import { v7 as uuidv7 } from 'uuid';
import type { AwarenessState, PageInfo } from './types';

export interface YjsLine {
  id: string;
  text: string;
}

function getDefaultWsUrl(): string {
  if (import.meta.env.DEV) {
    return 'ws://localhost:1234';
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

export class WikiProvider {
  private doc: Y.Doc;
  private wsProvider: WebsocketProvider | null = null;
  private idbProvider: IndexeddbPersistence | null = null;
  private lines: Y.Array<Y.Map<unknown>>;
  private statusCallback: ((status: 'online' | 'offline' | 'synced') => void) | null = null;
  private linesChangeCallback: ((lines: YjsLine[]) => void) | null = null;
  private awarenessChangeCallback: ((states: AwarenessState[]) => void) | null = null;
  private currentPageTitle: string = '';
  private userId: string = uuidv7();
  private userName: string = `User-${Math.floor(Math.random() * 1000)}`;
  private userColor: string = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
  private isLocalUpdate = false;

  constructor(private serverUrl: string = getDefaultWsUrl()) {
    this.doc = new Y.Doc();
    this.lines = this.doc.getArray<Y.Map<unknown>>('lines');
  }

  async connect(pageTitle: string): Promise<void> {
    this.disconnect();
    this.currentPageTitle = pageTitle;

    this.doc = new Y.Doc();
    this.lines = this.doc.getArray<Y.Map<unknown>>('lines');

    this.idbProvider = new IndexeddbPersistence(`wiki-${pageTitle}`, this.doc);
    await this.idbProvider.whenSynced;

    const encodedTitle = encodeURIComponent(pageTitle);
    this.wsProvider = new WebsocketProvider(
      this.serverUrl,
      encodedTitle,
      this.doc,
      {
        connect: true,
        awareness: new Awareness(this.doc),
      }
    );

    this.wsProvider.awareness.setLocalState({
      userId: this.userId,
      userName: this.userName,
      color: this.userColor,
      editingLineId: null,
    });

    this.wsProvider.on('sync', (synced: boolean) => {
      this.statusCallback?.(synced ? 'synced' : 'offline');
    });

    this.wsProvider.on('status', ({ status }: { status: string }) => {
      this.statusCallback?.(status === 'connected' ? 'online' : 'offline');
    });

    this.doc.on('update', (_update: Uint8Array, origin: any) => {
      if (origin === this.wsProvider) {
        const currentLines = this.getLines();
        this.linesChangeCallback?.(currentLines);
      }
    });

    this.wsProvider.awareness.on('change', () => {
      const states = this.getRemoteAwarenessStates();
      this.awarenessChangeCallback?.(states);
    });
  }

  disconnect(): void {
    if (this.wsProvider) {
      this.wsProvider.disconnect();
      this.wsProvider.destroy();
      this.wsProvider = null;
    }
    if (this.idbProvider) {
      this.idbProvider.destroy();
      this.idbProvider = null;
    }
    if (this.doc) {
      this.doc.destroy();
    }
  }

  getLines(): YjsLine[] {
    const lines: YjsLine[] = [];
    for (let i = 0; i < this.lines.length; i++) {
      const lineMap = this.lines.get(i);
      const id = lineMap.get('id') as string;
      const text = lineMap.get('text') as Y.Text;
      lines.push({
        id,
        text: text ? text.toString() : '',
      });
    }
    return lines;
  }

  setLines(lines: { id: string; text: string }[]): void {
    this.isLocalUpdate = true;
    this.doc.transact(() => {
      const currentLength = this.lines.length;
      const newLength = lines.length;

      // Update existing lines in place
      const minLen = Math.min(currentLength, newLength);
      for (let i = 0; i < minLen; i++) {
        const lineMap = this.lines.get(i);
        const oldId = lineMap.get('id') as string;
        const yText = lineMap.get('text') as Y.Text;
        const newLine = lines[i];

        if (oldId !== newLine.id) {
          const newLineMap = new Y.Map();
          newLineMap.set('id', newLine.id);
          const newYText = new Y.Text();
          newYText.insert(0, newLine.text);
          newLineMap.set('text', newYText);
          this.lines.delete(i, 1);
          this.lines.insert(i, [newLineMap]);
        } else if (yText.toString() !== newLine.text) {
          yText.delete(0, yText.length);
          yText.insert(0, newLine.text);
        }
      }

      if (currentLength > newLength) {
        this.lines.delete(newLength, currentLength - newLength);
      }

      for (let i = currentLength; i < newLength; i++) {
        const lineMap = new Y.Map();
        lineMap.set('id', lines[i].id);
        const yText = new Y.Text();
        yText.insert(0, lines[i].text);
        lineMap.set('text', yText);
        this.lines.push([lineMap]);
      }
    });
    this.isLocalUpdate = false;
  }

  addLine(index: number, id?: string, text: string = ''): string {
    const lineId = id || uuidv7();
    const lineMap = new Y.Map();
    lineMap.set('id', lineId);
    const yText = new Y.Text();
    yText.insert(0, text);
    lineMap.set('text', yText);
    this.lines.insert(index, [lineMap]);
    return lineId;
  }

  removeLine(index: number): void {
    if (index >= 0 && index < this.lines.length) {
      this.lines.delete(index, 1);
    }
  }

  updateLineText(index: number, text: string): void {
    if (index >= 0 && index < this.lines.length) {
      const lineMap = this.lines.get(index);
      const yText = lineMap.get('text') as Y.Text;
      if (yText) {
        this.isLocalUpdate = true;
        yText.delete(0, yText.length);
        yText.insert(0, text);
        this.isLocalUpdate = false;
      }
    }
  }

  setEditingLine(lineId: string | null): void {
    if (this.wsProvider?.awareness) {
      this.wsProvider.awareness.setLocalStateField('editingLineId', lineId);
    }
  }

  getRemoteAwarenessStates(): AwarenessState[] {
    if (!this.wsProvider?.awareness) return [];
    const states = this.wsProvider.awareness.getStates();
    const result: AwarenessState[] = [];
    states.forEach((state, clientId) => {
      if (clientId !== this.wsProvider!.awareness.clientID) {
        result.push(state as AwarenessState);
      }
    });
    return result;
  }

  get isOnline(): boolean {
    return this.wsProvider?.wsconnected ?? false;
  }

  get syncStatus(): { local: boolean; server: boolean } {
    return {
      local: this.idbProvider?.synced ?? false,
      server: this.wsProvider?.synced ?? false,
    };
  }

  onStatusChange(callback: (status: 'online' | 'offline' | 'synced') => void): void {
    this.statusCallback = callback;
  }

  onLinesChange(callback: (lines: YjsLine[]) => void): void {
    this.linesChangeCallback = callback;
  }

  onRemoteEditingChange(callback: (states: AwarenessState[]) => void): void {
    this.awarenessChangeCallback = callback;
  }

  static async listPages(): Promise<PageInfo[]> {
    try {
      const response = await fetch('/api/pages');
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  static async createPage(title: string): Promise<boolean> {
    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static async deletePage(title: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/pages/${encodeURIComponent(title)}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static async getBacklinks(title: string): Promise<PageInfo[]> {
    try {
      const response = await fetch(
        `/api/pages/${encodeURIComponent(title)}/backlinks`
      );
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }
}
