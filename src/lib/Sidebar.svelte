<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { PageInfo } from './types';
  import { WikiProvider } from './yjs-provider';

  export let currentPage: string = '';

  const dispatch = createEventDispatcher();

  let pages: PageInfo[] = [];
  let newPageTitle = '';
  let isCreating = false;
  let searchQuery = '';
  let isLoading = false;
  let error: string | null = null;

  $: filteredPages = pages.filter((page) =>
    page.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  onMount(async () => {
    await loadPages();
  });

  async function loadPages(): Promise<void> {
    isLoading = true;
    error = null;
    try {
      pages = await WikiProvider.listPages();
    } catch (e) {
      error = 'Failed to load pages';
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  async function handleCreatePage(): Promise<void> {
    if (!newPageTitle.trim()) return;

    isCreating = true;
    error = null;
    try {
      const success = await WikiProvider.createPage(newPageTitle.trim());
      if (success) {
        const pageTitle = newPageTitle.trim();
        newPageTitle = '';
        await loadPages();
        dispatch('select', { title: pageTitle });
      } else {
        error = 'Failed to create page';
      }
    } catch (e) {
      error = 'Failed to create page';
      console.error(e);
    } finally {
      isCreating = false;
    }
  }

  async function handleDeletePage(title: string, event: Event): Promise<void> {
    event.stopPropagation();
    if (!confirm(`Delete "${title}"?`)) return;

    try {
      const success = await WikiProvider.deletePage(title);
      if (success) {
        await loadPages();
        if (currentPage === title) {
          dispatch('select', { title: '' });
        }
      }
    } catch (e) {
      error = 'Failed to delete page';
      console.error(e);
    }
  }

  function handleSelectPage(title: string): void {
    dispatch('select', { title });
  }
</script>

<aside class="sidebar">
  <div class="sidebar-header">
    <h2>Wiki Pages</h2>
  </div>

  <div class="search-box">
    <input
      type="text"
      placeholder="Search pages..."
      bind:value={searchQuery}
      class="search-input"
    />
  </div>

  <div class="create-form">
    <input
      type="text"
      placeholder="New page title..."
      bind:value={newPageTitle}
      on:keydown={(e) => e.key === 'Enter' && handleCreatePage()}
      disabled={isCreating}
      class="create-input"
    />
    <button
      on:click={handleCreatePage}
      disabled={isCreating || !newPageTitle.trim()}
      class="create-button"
    >
      {isCreating ? '...' : '+'}
    </button>
  </div>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  <div class="page-list">
    {#if isLoading}
      <div class="loading">Loading...</div>
    {:else if filteredPages.length === 0}
      <div class="empty-state">
        {#if searchQuery}
          No pages match "{searchQuery}"
        {:else}
          No pages yet. Create one above.
        {/if}
      </div>
    {:else}
      {#each filteredPages as page (page.title)}
        <div
          class="page-item"
          class:active={currentPage === page.title}
          on:click={() => handleSelectPage(page.title)}
          role="button"
          tabindex="0"
          on:keydown={(e) => e.key === 'Enter' && handleSelectPage(page.title)}
        >
          <span class="page-title">{page.title}</span>
          <button
            class="delete-button"
            on:click={(e) => handleDeletePage(page.title, e)}
            title="Delete page"
          >
            x
          </button>
        </div>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    width: 280px;
    height: 100%;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    background: #fafafa;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid #e0e0e0;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #333;
  }

  .search-box {
    padding: 12px 16px;
    border-bottom: 1px solid #e0e0e0;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    background: white;
  }

  .search-input:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
  }

  .create-form {
    padding: 12px 16px;
    display: flex;
    gap: 8px;
    border-bottom: 1px solid #e0e0e0;
  }

  .create-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    background: white;
  }

  .create-input:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
  }

  .create-button {
    padding: 8px 16px;
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
  }

  .create-button:hover:not(:disabled) {
    background: #0052a3;
  }

  .create-button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .error-message {
    padding: 8px 16px;
    background: #fee;
    color: #c00;
    font-size: 13px;
    border-bottom: 1px solid #fcc;
  }

  .page-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .loading,
  .empty-state {
    padding: 24px 16px;
    text-align: center;
    color: #888;
    font-size: 14px;
  }

  .page-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    color: #333;
    transition: background-color 0.15s;
  }

  .page-item:hover {
    background: #e8e8e8;
  }

  .page-item.active {
    background: #0066cc;
    color: white;
  }

  .page-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-button {
    opacity: 0;
    padding: 2px 6px;
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 12px;
    border-radius: 4px;
    transition: opacity 0.15s;
  }

  .page-item:hover .delete-button {
    opacity: 1;
  }

  .delete-button:hover {
    background: #fcc;
    color: #c00;
  }

  .page-item.active .delete-button:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }
</style>
