<script lang="ts">
  import { afterUpdate, createEventDispatcher } from 'svelte';
  import type { Line } from './types';
  import {
    isCodeBlockFence,
    renderMarkdown,
    getComputedStylesFromHtml,
    autoGrow
  } from './editor-utils';

  export let line: Line;
  export let isEditing: boolean;
  export let debugMode: boolean = false;
  export let pendingFocusPos: number | null = null;

  const dispatch = createEventDispatcher();

  let textareaRef: HTMLTextAreaElement;
  let previewRef: HTMLDivElement;

  // Move @const to a reactive declaration inside the script block
  $: isCurrentLineCodeBlock = isCodeBlockFence(line.text);

  function handleKeyDown(event: KeyboardEvent) {
    // 特定のキー操作を親に通知する
    if (['Enter', 'Backspace', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        dispatch('linekeydown', { key: event.key, event });
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const currentCursorPos = target.selectionStart;
    const editedContent = target.value;

    // テキストの更新を親に通知する
    dispatch('update', { 
        text: editedContent, 
        cursorPos: currentCursorPos 
    });
    
    // 入力に応じてテキストエリアの高さを調整
    autoGrow(target);
  }

  function handleFocus() {
    dispatch('focusline');
  }

  function handleBlur() {
    if (!debugMode) {
      dispatch('blurline');
    }
  }

  function handlePreviewClick() {
    dispatch('activateline');
  }

  afterUpdate(() => {
    // この行が編集モードになった時にフォーカスやスタイルを適用する
    if (isEditing && textareaRef) {
      const stylesToApply = line.computedStyles;
      if (stylesToApply) {
          textareaRef.style.fontSize = stylesToApply.fontSize || '';
          textareaRef.style.fontWeight = stylesToApply.fontWeight || '';
      } else {
          textareaRef.style.fontSize = '';
          textareaRef.style.fontWeight = '';
      }

      autoGrow(textareaRef);
      textareaRef.focus();

      if (pendingFocusPos !== null) {
        const adjustedPos = Math.min(pendingFocusPos, textareaRef.value.length);
        textareaRef.setSelectionRange(adjustedPos, adjustedPos);
      }
    }
  });
</script>


<div class="line" class:editing={isEditing} class:code-block={isCurrentLineCodeBlock}>
  {#if isEditing}
    {#if isCurrentLineCodeBlock}
      <!-- コードブロック編集中 -->
      <div class="code-editor-panes">
        <textarea
          bind:this={textareaRef}
          value={line.text.startsWith('```') && line.text.endsWith('\n```')
            ? line.text.substring(0, line.text.length - 4) // Remove '\n```'
            : line.text}
          on:keydown={handleKeyDown}
          on:input={handleInput}
          on:focus={handleFocus}
          on:blur={handleBlur}
        ></textarea>
        <div class="code-preview-pane markdown-preview" bind:this={previewRef}>
          {@html line.renderedHtml}
        </div>
      </div>
    {:else}
      <!-- 通常行編集中 -->
      <textarea
        bind:this={textareaRef}
        value={line.text}
        on:keydown={handleKeyDown}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
      ></textarea>
    {/if}
  {:else}
    <!-- 非編集中 (プレビュー表示) -->
    <div
      class="markdown-preview"
      bind:this={previewRef}
      on:click={handlePreviewClick}
    >
      {@html line.renderedHtml}
    </div>
  {/if}
</div>

<style>
  .line {
    position: relative; 
    margin-bottom: 0.5rem;
    min-height: 18px;
  }

  .markdown-preview {
    position: relative; 
    padding: 0;
    border: none;
    border-radius: 4px;
    word-wrap: break-word;
    cursor: text;
    box-sizing: border-box;
    min-height: 18px;
  }

  textarea {
    display: none;
    background-color: transparent;
    padding: 0;
    border: none;
    border-radius: 4px;
    box-sizing: border-box;
    resize: none;
    overflow: hidden;
    font-family: sans-serif;
    font-size: inherit;
    line-height: normal;
    outline: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    box-shadow: none;
  }

  .line.editing .markdown-preview:not(.code-preview-pane) {
    display: none;
  }

  .line.editing textarea {
    display: block;
    pointer-events: auto;
    height: auto;
    width: 100%;
  }
  
  .line.editing {
    background-color: #f0f0f0;
  }

  textarea:focus {
    outline: none;
  }

  .markdown-preview :global(h1),
  .markdown-preview :global(h2),
  .markdown-preview :global(p),
  .markdown-preview :global(strong),
  .markdown-preview :global(em),
  .markdown-preview :global(code) {
    margin: 0;
    padding: 0;
  }

  :global(.markdown-preview h1) { font-size: 2em; font-weight: bold; line-height: normal; }
  :global(.markdown-preview h2) { font-size: 1.5em; font-weight: bold; line-height: normal; }
  .markdown-preview :global(p),
  .markdown-preview :global(strong),
  .markdown-preview :global(em),
  .markdown-preview :global(code) { font-size: 1em; line-height: normal; }
  .markdown-preview :global(code) { background-color: #eee; padding: 0.1em 0.3em; border-radius: 3px; font-family: monospace; }

  .code-block.editing .code-editor-panes {
    display: flex;
    flex-direction: row;
    gap: 1rem; 
    width: 100%;
    min-height: 100px;
    box-sizing: border-box;
  }

  .code-editor-panes textarea,
  .code-editor-panes .code-preview-pane {
    flex: 1; 
    min-width: 0;
    min-height: 50px;
    visibility: visible; 
    display: block; 
    pointer-events: auto;
    position: relative;
  }

  .code-editor-panes textarea { height: auto; }

  .code-editor-panes .code-preview-pane {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    overflow: auto; 
    background-color: #f6f8fa; 
  }
</style>
