<script lang="ts">
  import { afterUpdate, tick } from 'svelte';

  let lines = [
    { id: 1, text: "# Large Heading" },
    { id: 2, text: "This is a normal paragraph." },
    { id: 3, text: "" }, // Empty line between a heading and a paragraph
    { id: 4, text: "Another paragraph." },
    { id: 5, text: "    " }, // Line with only spaces
    { id: 6, text: "" }, // Another empty line
    { id: 7, text: "" }, // A third empty line
    { id: 8, text: "## Smaller Heading" },
    { id: 9, text: "A very long line of text that will definitely wrap to the next line, which should give it a significant height. Let's see how the editor handles the measurement of a line like this when we navigate to or from it. This is a crucial test case." },
    { id: 10, text: "" }, // Empty line after a tall, wrapped line
    { id: 11, text: "Final line." },
  ];
  let nextId = lines.length > 0 ? Math.max(...lines.map(l => l.id)) + 1 : 1;

  let debugMode = false;
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    debugMode = urlParams.get('debug') === 'true';
  }

  let textareaRefs: HTMLTextAreaElement[] = [];
  let previewRefs: HTMLDivElement[] = []; // Preview elements references
  
  // Store calculated font styles for each preview div
  let allPreviewFontStyles: { fontSize: string | null; fontWeight: string | null }[] = [];

  let pendingFocusIndex: number | null = null;
  let pendingFocusPos: number | null = null;
  let editingLineIndex: number | null = null;

  function autoGrow(textarea: HTMLTextAreaElement) {
    if (!textarea) return;

    if (textarea.value.trim() === '') {
      textarea.style.height = '35px'; // Pragmatic adjustment to target 40px computed height
      return;
    }

    textarea.style.height = '1px';
    textarea.style.height = `${textarea.scrollHeight - 5}px`; // Apply -5px adjustment
  }



  // 指定されたプレビュー要素の最初のブロック要素のfont-sizeとfont-weightを取得
  function getRenderedFontStyles(index: number): { fontSize: string | null; fontWeight: string | null } {
    if (previewRefs[index]) {
      const previewElement = previewRefs[index];
      const childElements = previewElement.querySelectorAll('h1, h2, p, strong, em, code');
      const targetElement = childElements.length > 0 ? childElements[0] : previewElement;
      const computedStyle = window.getComputedStyle(targetElement);
      return {
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight,
      };
    }
    return { fontSize: null, fontWeight: null };
  }

  // Unified function to activate a line for editing
  function activateLineForEditing(targetIndex: number, targetCursorPos: number) {
    if (targetIndex < 0 || targetIndex >= lines.length) {
        return;
    }
    editingLineIndex = targetIndex; // Set editingLineIndex directly to trigger CSS class change
    pendingFocusIndex = targetIndex;
    pendingFocusPos = targetCursorPos;
  }

  function handleFocus(index: number) {
    editingLineIndex = index;
  }

  function handleBlur() {
    editingLineIndex = null;
  }

    function handleKeyDown(event: KeyboardEvent, index: number) {

      const textarea = event.target as HTMLTextAreaElement;

      const { selectionStart, selectionEnd, value } = textarea;

  

      if (event.key === 'Enter') {

        event.preventDefault();

  

        const currentLine = lines[index];

        const textBeforeCursor = value.substring(0, selectionStart);

        const textAfterCursor = value.substring(selectionEnd);

  

        currentLine.text = textBeforeCursor;

  

        const newLine = { id: nextId++, text: textAfterCursor };

        lines = [...lines.slice(0, index + 1), newLine, ...lines.slice(index + 1)];

  

        activateLineForEditing(index + 1, 0);

  

      } else if (event.key === 'Backspace') {

        if (selectionStart === 0 && selectionEnd === 0 && index > 0) {

          event.preventDefault();

  

          const previousLine = lines[index - 1];

          const currentLine = lines[index];

          const combinedText = previousLine.text + currentLine.text;

          previousLine.text = combinedText;

  

          lines = lines.filter((_, i) => i !== index);

  

          activateLineForEditing(index - 1, previousLine.text.length);

        }

      } else if (event.key === 'ArrowUp') {

        event.preventDefault();

        if (index > 0) {

          activateLineForEditing(index - 1, selectionStart);

        }

      } else if (event.key === 'ArrowDown') {

        event.preventDefault();

        if (index < lines.length - 1) {

          activateLineForEditing(index + 1, selectionStart);

        }

      }

    }

  function renderMarkdown(text: string): string {
    // For empty or whitespace-only lines, render a non-breaking space
    // to ensure the div has a stable, measurable height.
    if (text.trim() === '') {
      return '&nbsp;';
    }

    // Helper to sanitize captured content
    const sanitizeContent = (content: string) => content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    let processedHtml = text;
    let markdownApplied = false;

    // Headings
    processedHtml = processedHtml.replace(/^#\s(.+)/, (fullMatch) => {
        markdownApplied = true;
        return `<h1>${sanitizeContent(fullMatch)}</h1>`;
    });
    processedHtml = processedHtml.replace(/^##\s(.+)/, (fullMatch) => {
        markdownApplied = true;
        return `<h2>${sanitizeContent(fullMatch)}</h2>`;
    });

    // Inline formatting
    processedHtml = processedHtml.replace(/\*\*(.*?)\*\*/g, (_, content) => {
        markdownApplied = true;
        return `<strong>${sanitizeContent(content)}</strong>`;
    });
    processedHtml = processedHtml.replace(/\*(.*?)\*/g, (_, content) => {
        markdownApplied = true;
        return `<em>${sanitizeContent(content)}</em>`;
    });
    processedHtml = processedHtml.replace(/`(.*?)`/g, (_, content) => {
        markdownApplied = true;
        return `<code>${sanitizeContent(content)}</code>`;
    });

    // If no markdown was applied, sanitize the entire text and wrap it in a paragraph tag
    if (!markdownApplied) {
        return `<p>${sanitizeContent(text)}</p>`;
    }

    return processedHtml;
  }


  afterUpdate(async () => {
    // Phase 1: Update preview font styles
    // This loop runs after every DOM update, ensuring these arrays are always current
    previewRefs.forEach((preview, idx) => {
        if (preview) { // Ensure preview element exists
            // Capture font styles.
            const currentFontStyles = getRenderedFontStyles(idx);
            // Check if font styles have changed to avoid unnecessary reactivity
            if (
                allPreviewFontStyles[idx]?.fontSize !== currentFontStyles.fontSize ||
                allPreviewFontStyles[idx]?.fontWeight !== currentFontStyles.fontWeight
            ) {
                allPreviewFontStyles[idx] = currentFontStyles;
                allPreviewFontStyles = [...allPreviewFontStyles]; // Trigger Svelte reactivity
            }
        }
    });

    // Phase 2: Handle pending focus changes
    if (pendingFocusIndex !== null && pendingFocusIndex >= 0 && pendingFocusIndex < lines.length) {
      if (editingLineIndex !== pendingFocusIndex) {
        editingLineIndex = pendingFocusIndex;
        await tick(); // Wait for DOM to update with new editingLineIndex
      }

      const targetTextarea = textareaRefs[pendingFocusIndex];
      if (targetTextarea) {
        // 1. Apply font styles first, so scrollHeight can be calculated correctly.
        const stylesToApply = allPreviewFontStyles[pendingFocusIndex];
        if (stylesToApply) {
            targetTextarea.style.fontSize = stylesToApply.fontSize || '';
            targetTextarea.style.fontWeight = stylesToApply.fontWeight || '';
        } else {
            targetTextarea.style.fontSize = ''; // Reset to default
            targetTextarea.style.fontWeight = ''; // Reset to default
        }

        // 2. Now, calculate height with the correct font styles applied.
        autoGrow(targetTextarea);
        
        // 3. Finally, focus the textarea.
        targetTextarea.focus();
        if (pendingFocusPos !== null) {
            const adjustedPos = Math.min(pendingFocusPos, targetTextarea.value.length);
            targetTextarea.setSelectionRange(adjustedPos, adjustedPos);
        }
      }
      
      pendingFocusIndex = null;
      pendingFocusPos = null;
    }
  });
</script>

<main>
  <div class="editor">
    {#each lines as line, index (line.id)}
      <div class="line" class:editing={editingLineIndex === index || debugMode}>
        <textarea
          bind:this={textareaRefs[index]}
          bind:value={line.text}
          on:keydown={(e) => handleKeyDown(e, index)}
          on:input={(e) => autoGrow(e.target as HTMLTextAreaElement)}
          on:focus={() => handleFocus(index)}
          on:blur={handleBlur}
        ></textarea>
        <div
          class="markdown-preview"
          bind:this={previewRefs[index]}
          on:click={() => {
            activateLineForEditing(index, 0);
          }}
        >
          {@html renderMarkdown(line.text)}
        </div>
      </div>
    {/each}

  </div>
</main>

<style>
  * {
    margin: 0;
    padding: 0;
  }

  .editor {
    width: 100%;
    max-width: 800px;
    padding: 2rem;
    font-family: sans-serif;
  }

  /* --- Layout --- */
  .line {
    position: relative; /* Crucial for positioning children */
    margin-bottom: 0.5rem;
    min-height: 18px;
  }

  /* --- Default State (Preview is visible) --- */
  .markdown-preview {
    position: relative; /* In layout flow */
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    word-wrap: break-word;
    cursor: text;
    box-sizing: border-box;
    min-height: 18px;
  }

  textarea {
    /* Hidden and out of layout flow */
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    visibility: hidden;
    pointer-events: none;

    /* Visual styles */
    padding: 0.5rem;
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

  /* --- Editing State --- */
  .line.editing .markdown-preview {
    /* Hidden and out of layout flow */
    position: absolute;
    visibility: hidden;
    pointer-events: none;
  }

  .line.editing textarea {
    /* Visible and in layout flow */
    position: relative;
    visibility: visible;
    pointer-events: auto;
    height: auto; /* Let autoGrow function handle the height */
  }

  /* --- Other Styles --- */
  textarea:focus {
    outline: none;
    /* border-color: #007bff; Removed */
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

  .markdown-preview :global(h1) {
    font-size: 2em;
    font-weight: bold;
    line-height: normal;
  }

  .markdown-preview :global(h2) {
    font-size: 1.5em;
    font-weight: bold;
    line-height: normal;
  }

  .markdown-preview :global(p),
  .markdown-preview :global(strong),
  .markdown-preview :global(em),
  .markdown-preview :global(code) {
    font-size: 1em;
    line-height: normal;
  }


  .markdown-preview :global(code) {
    background-color: #eee;
    padding: 0.1em 0.3em;
    border-radius: 3px;
    font-family: monospace;
  }
</style>
