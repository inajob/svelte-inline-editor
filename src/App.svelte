<script lang="ts">
  import { onMount } from 'svelte';
  import TextEditor from './TextEditor.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import OfflineIndicator from './lib/OfflineIndicator.svelte';
  import { WikiProvider } from './lib/yjs-provider';
  import type { YjsLine } from './lib/yjs-provider';

  let currentPage = '';
  let connectionStatus: 'online' | 'offline' | 'synced' = 'offline';
  let provider: WikiProvider | null = null;
  let initialLines: YjsLine[] = [];
  let linesKey = 0;

  onMount(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      currentPage = decodeURIComponent(hash);
    }

    window.addEventListener('hashchange', () => {
      const newHash = window.location.hash.slice(1);
      const newPage = decodeURIComponent(newHash);
      if (newPage !== currentPage) {
        currentPage = newPage;
        connectToPage(currentPage);
      }
    });

    if (currentPage) {
      connectToPage(currentPage);
    }
  });

  async function connectToPage(title: string): Promise<void> {
    if (provider) {
      provider.disconnect();
    }

    if (!title) {
      initialLines = [];
      connectionStatus = 'offline';
      return;
    }

    provider = new WikiProvider();
    provider.onStatusChange((status) => {
      connectionStatus = status;
    });

    await provider.connect(title);

    const lines = provider.getLines();
    if (lines.length === 0) {
      initialLines = [{ id: crypto.randomUUID(), text: '' }];
    } else {
      initialLines = lines;
    }
    linesKey++;

    provider.onLinesChange((newLines) => {
      initialLines = newLines;
      linesKey++;
    });
  }

  function handlePageSelect(event: CustomEvent<{ title: string }>): void {
    const title = event.detail.title;
    currentPage = title;
    window.location.hash = title ? encodeURIComponent(title) : '';
    connectToPage(title);
  }

  function handleEditorUpdate(event: CustomEvent): void {
    const lines = event.detail.lines;
    if (provider) {
      provider.setLines(lines.map((l: any) => ({ id: String(l.id), text: l.text })));
    }
  }
</script>

<div class="app-container">
  <Sidebar {currentPage} on:select={handlePageSelect} />

  <main class="main-content">
    {#if currentPage}
      <div class="editor-header">
        <h1 class="page-title">{currentPage}</h1>
        <OfflineIndicator status={connectionStatus} />
      </div>

      <div class="editor-container">
        <TextEditor
          key={linesKey}
          initialLines={initialLines}
          on:update={handleEditorUpdate}
        />
      </div>
    {:else}
      <div class="welcome-screen">
        <h2>Welcome to Wiki</h2>
        <p>Select a page from the sidebar or create a new one.</p>
      </div>
    {/if}
  </main>
</div>

<style>
  .app-container {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-header {
    padding: 16px 24px;
    border-bottom: 1px solid #e0e0e0;
    background: white;
  }

  .page-title {
    margin: 0 0 12px 0;
    font-size: 24px;
    font-weight: 600;
    color: #333;
  }

  .editor-container {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .welcome-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
    text-align: center;
  }

  .welcome-screen h2 {
    margin-bottom: 8px;
    color: #333;
  }
</style>
