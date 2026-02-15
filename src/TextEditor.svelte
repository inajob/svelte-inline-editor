<script lang="ts">
  import { afterUpdate } from 'svelte';
  import hljs from 'highlight.js'; // Import highlight.js
  // Import a more distinct theme
  import 'highlight.js/styles/github.css'; 

  // Import and register specific languages for highlighting
  import javascript from 'highlight.js/lib/languages/javascript';
  import python from 'highlight.js/lib/languages/python';
  import xml from 'highlight.js/lib/languages/xml'; // For HTML, XML
  import css from 'highlight.js/lib/languages/css';
  import typescript from 'highlight.js/lib/languages/typescript';
  import bash from 'highlight.js/lib/languages/bash';
  import mermaid from 'mermaid';
  import { createEventDispatcher } from 'svelte';
  import {
    isCodeBlockFence,
    getCodeBlockLanguage,
    renderMarkdown,
    getComputedStylesFromHtml
  } from './lib/editor-utils';
  import type { Line } from './lib/types';
  import LineComponent from './lib/Line.svelte';

  const dispatch = createEventDispatcher();

  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('html', xml); // 'xml' is often used for HTML
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('xml', xml); // Registering xml as xml too
  hljs.registerLanguage('ts', typescript); // For TypeScript
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('sh', bash);

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default'
  });

  export let initialLines: Omit<Line, 'renderedHtml'>[] = [
    { id: 1, text: "# Large Heading" },
    { id: 2, text: "This is a normal paragraph." },
    { id: 3, text: "" }, 
    { id: 4, text: "Another paragraph." },
    { id: 5, text: "    " }, 
    { id: 6, text: "" }, 
    { id: 7, text: "" }, 
    { id: 8, text: "## Smaller Heading" },
    { id: 9, text: "A very long line of text that will definitely wrap to the next line, which should give it a significant height. Let's see how the editor handles the measurement of a line like this when we navigate to or from it. This is a crucial test case." },
    { id: 10, text: "" }, 
    { id: 11, text: 
"```javascript" + "\n" +
"function greet(name) {" + "\n" +
"  console.log('Hello, ' + name);" + "\n" +
"}" + "\n" +
"greet('World');" + "\n" +
"```"
},
    { id: 12, text: "" },
    { id: 13, text: "Final line." },
  ];

  let lines: Line[];

  // Initialize lines from initialLines prop
  
  lines = initialLines.map(line => {
      const renderedHtml = renderMarkdown(line.text);
      return {
          ...line,
          renderedHtml: renderedHtml,
          computedStyles: getComputedStylesFromHtml(renderedHtml)
      };
  });
  

  let nextId = lines.length > 0 ? Math.max(...lines.map(l => l.id)) + 1 : 1;

  export let debugMode: boolean = false;

  let pendingFocusIndex: number | null = null;
  let pendingFocusPos: number | null = null;
  let editingLineIndex: number | null = null;

  // --- Component Event Handlers ---

  function handleLineActivate(index: number) {
    activateLineForEditing(index, 0);
  }

  function handleLineFocus(index: number) {
    editingLineIndex = index;
  }

  function handleLineBlur() {
    if (!debugMode) {
      editingLineIndex = null;
    }
  }

  function handleLineUpdate(event: CustomEvent, index: number) {
      const { text, cursorPos } = event.detail;
      const line = lines[index];

      let newText = text;
      // If the original line was a code block, ensure the new text is also treated as such
      // by re-attaching the closing fence. This is necessary because the textarea
      // for code blocks does not contain the closing fence during editing.
      if (isCodeBlockFence(line.text)) {
          newText = `${text}\n\`\`\``;
      }

      if (line.text !== newText) {
          line.text = newText;
          line.renderedHtml = renderMarkdown(line.text);
          line.computedStyles = getComputedStylesFromHtml(line.renderedHtml);
          lines = lines; // Trigger reactivity
          dispatch('update', { lines });
      }

      // Request focus to be set again on the updated line
      editingLineIndex = index;
      pendingFocusIndex = index;
      pendingFocusPos = cursorPos;
  }

  function handleLineKeyDown(event: CustomEvent, index: number) {
      const { key, event: keyboardEvent } = event.detail;

      // Default behavior is NOT prevented here.
      // The individual handlers below are responsible for calling `preventDefault()`
      // if and when it's appropriate for that specific key.
      switch (key) {
        case 'Enter':
          return handleEnterKey(keyboardEvent, index);
        case 'Backspace':
          return handleBackspaceKey(keyboardEvent, index);
        case 'ArrowUp':
          return handleArrowUpKey(keyboardEvent, index);
        case 'ArrowDown':
          return handleArrowDownKey(keyboardEvent, index);
      }
  }

  // --- Core Logic ---

  // Unified function to activate a line for editing
  function activateLineForEditing(targetIndex: number, targetCursorPos: number) {
    if (targetIndex < 0 || targetIndex >= lines.length) {
        return;
    }
    editingLineIndex = targetIndex; 
    pendingFocusIndex = targetIndex;
    pendingFocusPos = targetCursorPos;
  }

  function handleEnterKey(event: KeyboardEvent, index: number) {
    const textarea = event.target as HTMLTextAreaElement;
    const { selectionStart, selectionEnd, value } = textarea;
    const isCurrentLineCodeBlock = isCodeBlockFence(lines[index].text);

    if (isCurrentLineCodeBlock) {
      // Allow native textarea Enter behavior for code blocks
      return; 
    }
    // For regular lines: split the line
    event.preventDefault();

    const currentLine = lines[index];
    const textBeforeCursor = value.substring(0, selectionStart);
    const textAfterCursor = value.substring(selectionEnd);

    currentLine.text = textBeforeCursor;
    currentLine.renderedHtml = renderMarkdown(currentLine.text);

    const newLine: Line = { 
      id: nextId++, 
      text: textAfterCursor, 
      renderedHtml: renderMarkdown(textAfterCursor)
    };

    lines = [...lines.slice(0, index + 1), newLine, ...lines.slice(index + 1)];

    activateLineForEditing(index + 1, 0);
  }

  function handleBackspaceKey(event: KeyboardEvent, index: number) {
    const textarea = event.target as HTMLTextAreaElement;
    const { selectionStart, selectionEnd, value } = textarea;
    const isCurrentLineCodeBlock = isCodeBlockFence(lines[index].text);

    // If cursor is at the very beginning of a line
    if (selectionStart === 0 && selectionEnd === 0 && index > 0) {
      // If current line is a code block, allow native backspace (don't merge)
      if (isCurrentLineCodeBlock) {
          return;
      }

      const previousLine = lines[index - 1];
      const isPreviousLineCodeBlock = isCodeBlockFence(previousLine.text);
      
      // Prevent merging if the previous line is a code block
      if (isPreviousLineCodeBlock) {
          return;
      }

      // For regular lines: merge with previous line
      event.preventDefault(); 
      const combinedText = previousLine.text + value; // value is current line's text
      previousLine.text = combinedText;
      previousLine.renderedHtml = renderMarkdown(combinedText);
      lines = lines.filter((_, i) => i !== index);
      activateLineForEditing(index - 1, previousLine.text.length);
    }
  }

  function handleArrowUpKey(event: KeyboardEvent, index: number) {
    const textarea = event.target as HTMLTextAreaElement;
    const { selectionStart, value } = textarea;
    const isCurrentLineCodeBlock = isCodeBlockFence(lines[index].text);

    if (isCurrentLineCodeBlock) {
        // For code blocks: move up if cursor is on the first visual line
        const firstNewlineIndex = value.indexOf('\n');
        const shouldMoveUp = (selectionStart <= firstNewlineIndex || firstNewlineIndex === -1);

        if (shouldMoveUp && index > 0) {
          event.preventDefault();
          activateLineForEditing(index - 1, 0);
        }
    } else {
        // For regular lines: always move up if not the first line
        if (index > 0) {
          event.preventDefault();
          activateLineForEditing(index - 1, 0);
        }
    }
  }

  function handleArrowDownKey(event: KeyboardEvent, index: number) {
    const textarea = event.target as HTMLTextAreaElement;
    const { selectionStart, value } = textarea;
    const isCurrentLineCodeBlock = isCodeBlockFence(lines[index].text);

    if (isCurrentLineCodeBlock) {
      // For code blocks: move down if cursor is on the last visual line
      const lastNewlineIndex = value.lastIndexOf('\n');
      const shouldMoveDown = (selectionStart >= lastNewlineIndex + 1 || (lastNewlineIndex === -1 && selectionStart === value.length));

      if (shouldMoveDown && index < lines.length - 1) { 
        event.preventDefault(); 
        activateLineForEditing(index + 1, 0);
      }
    } else {
      // For regular lines: always move down if not the last line
      if (index < lines.length - 1) { 
        event.preventDefault(); 
        activateLineForEditing(index + 1, 0);
      }
    }
  }

  afterUpdate(() => {
    // Focus management logic has been moved to the Line.svelte component.
    // This parent component now only needs to ensure Mermaid diagrams are rendered
    // and to reset the pending focus state after an update cycle.
    mermaid.run(); 

    if (pendingFocusIndex !== null) {
      pendingFocusIndex = null;
      pendingFocusPos = null;
    }
  });
</script>

<main>
  <div class="editor">
    {#each lines as line, index (line.id)}
      <LineComponent
        {line}
        isEditing={editingLineIndex === index}
        {debugMode}
        pendingFocusPos={pendingFocusIndex === index ? pendingFocusPos : null}
        on:activateline={() => handleLineActivate(index)}
        on:focusline={() => handleLineFocus(index)}
        on:blurline={handleLineBlur}
        on:update={(e) => handleLineUpdate(e, index)}
        on:linekeydown={(e) => handleLineKeyDown(e, index)}
      />
    {/each}
  </div>
</main>

<style>
  .editor {
    width: 100%;
    max-width: 800px;
    padding: 2rem;
    font-family: sans-serif;
  }

  /* --- Layout --- */
  .line {
    position: relative; 
    margin-bottom: 0.5rem;
    min-height: 18px;
  }

  /* --- Default State (Preview is visible) --- */
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
    display: none; /* Changed from position: absolute and visibility: hidden */
    background-color: transparent; /* Added */
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

  /* --- Editing State --- */
  .line.editing .markdown-preview:not(.code-preview-pane) {
    display: none; /* Changed from position: absolute, visibility: hidden, pointer-events: none */
  }

      .line.editing textarea {
        display: block; /* Changed from position: relative, visibility: visible, pointer-events: auto */
        pointer-events: auto;
        height: auto;
        width: 100%; /* Added to ensure full width for editing regular lines */
      }
  .line.editing {
    background-color: #f0f0f0; /* Light gray */
  }
  /* --- Other Styles --- */
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

  :global(.markdown-preview h1) {
    font-size: 2em;
    font-weight: bold;
    line-height: normal;
  }

  :global(.markdown-preview h2) {
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
  /* --- Code Block Specific Styles --- */
  .code-block.editing .code-editor-panes {
    display: flex;
    flex-direction: row; /* Explicitly define direction */
    gap: 1rem; 
    width: 100%; /* Ensure it takes full width of its parent (.line) */
    min-height: 100px; /* Give it a minimum height to be visible */
    box-sizing: border-box; /* Include padding and border in element's total width and height */
  }

  .code-editor-panes textarea,
  .code-editor-panes .code-preview-pane {
    flex: 1; 
    min-width: 0; /* Allow items to shrink */
    min-height: 50px; /* Ensure children are visible */
    visibility: visible; 
    display: block; 
    pointer-events: auto;
    position: relative; /* CRITICAL FIX: Override global absolute positioning */
  }

  .code-editor-panes textarea {
    height: auto; 
  }

  .code-editor-panes .code-preview-pane {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    overflow: auto; 
    background-color: #f6f8fa; 
  }

  .markdown-preview :global(pre) { 
    background-color: #f6f8fa;
    border-radius: 6px;
    padding: 0.75rem;
    overflow-x: auto;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    font-size: 0.875em;
    line-height: 1.4;
  }

  .markdown-preview :global(pre code) {
    background-color: transparent; 
    padding: 0;
    border-radius: 0;
  }
</style>
