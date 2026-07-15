<script lang="ts">
  export let status: 'online' | 'offline' | 'synced' = 'offline';
</script>

<div class="status-indicator" class:online={status === 'online'} class:synced={status === 'synced'} class:offline={status === 'offline'}>
  <span class="status-dot"></span>
  <span class="status-text">
    {#if status === 'online'}
      Online
    {:else if status === 'synced'}
      Synced
    {:else}
      Offline - Changes saved locally
    {/if}
  </span>
</div>

<style>
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 13px;
    border-radius: 6px;
    margin: 8px 16px;
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffc107;
  }

  .status-indicator.online {
    background: #d4edda;
    color: #155724;
    border-color: #28a745;
  }

  .status-indicator.synced {
    background: #cce5ff;
    color: #004085;
    border-color: #007bff;
  }

  .status-indicator.offline {
    background: #fff3cd;
    color: #856404;
    border-color: #ffc107;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }

  .status-text {
    flex: 1;
  }
</style>
