<script lang="ts">
  import { afterUpdate, tick } from 'svelte';
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
    getComputedStylesFromHtml,
    autoGrow
  } from './lib/editor-utils';

  const dispatch = createEventDispatcher();

  // Define line types for better structure
  export interface Line {
    id: number;
    text: string;
    renderedHtml: string;
    computedStyles?: { fontSize: string | null; fontWeight: string | null };
  }

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

  let textareaRefs: HTMLTextAreaElement[] = [];
  let previewRefs: HTMLDivElement[] = []; 

  let pendingFocusIndex: number | null = null;
  let pendingFocusPos: number | null = null;
  let editingLineIndex: number | null = null;


  // Unified function to activate a line for editing
  function activateLineForEditing(targetIndex: number, targetCursorPos: number) {
    if (targetIndex < 0 || targetIndex >= lines.length) {
        return;
    }
    editingLineIndex = targetIndex; 
    pendingFocusIndex = targetIndex;
    pendingFocusPos = targetCursorPos;
  }

  function handleFocus(index: number) {
    editingLineIndex = index;
  }

  function handleBlur() {
    if (!debugMode) {
      editingLineIndex = null;
    }
  }

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const textarea = event.target as HTMLTextAreaElement;
    const { selectionStart, selectionEnd, value } = textarea;

    const isCurrentLineCodeBlock = isCodeBlockFence(lines[index].text);

    if (event.key === 'Enter') {
      if (isCurrentLineCodeBlock) {
        // Allow native textarea Enter behavior for code blocks (multi-line input)
        // The on:input handler for code blocks will handle content updates, including adding closing ```
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

    } else if (event.key === 'Backspace') {
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
    } else if (event.key === 'ArrowUp') {
      if (isCurrentLineCodeBlock) {
        // For code blocks: move up if cursor is on the first visual line
        const firstNewlineIndex = value.indexOf('\n');
        const shouldMoveUp = (selectionStart <= firstNewlineIndex || firstNewlineIndex === -1);

        if (shouldMoveUp && index > 0) {
          event.preventDefault();
          activateLineForEditing(index - 1, 0);
        } else {
          // Allow default behavior
        }
      } else {
        // For regular lines: always move up if not the first line
        if (index > 0) {
          event.preventDefault();
          activateLineForEditing(index - 1, 0);
        }
      }
    } else if (event.key === 'ArrowDown') {
      if (isCurrentLineCodeBlock) {
        // For code blocks: move down if cursor is on the last visual line
        const lastNewlineIndex = value.lastIndexOf('\n');
        const shouldMoveDown = (selectionStart >= lastNewlineIndex + 1 || (lastNewlineIndex === -1 && selectionStart === value.length)); // If no newline, cursor must be at end

        if (shouldMoveDown && index < lines.length - 1) { 
          event.preventDefault(); 
          activateLineForEditing(index + 1, 0);
        } else {
          // Allow default behavior (move cursor vertically within current textarea)
        }
      } else {
        // For regular lines: always move down if not the last line
        if (index < lines.length - 1) { 
          event.preventDefault(); 
          activateLineForEditing(index + 1, 0);
        } else {
          // Allow default behavior (move cursor vertically within current textarea)
          // This else block is technically not needed for single-line textareas if it's the last line,
          // but keeping it for consistency if any default behavior is desired.
        }
      }
    }
  }

    afterUpdate(async () => {
      if (pendingFocusIndex !== null && pendingFocusIndex >= 0 && pendingFocusIndex < lines.length) {
        if (editingLineIndex !== pendingFocusIndex) {
          editingLineIndex = pendingFocusIndex;
          await tick();
        }
  
        const targetTextarea = textareaRefs[pendingFocusIndex];
        if (targetTextarea) {
          const stylesToApply = lines[pendingFocusIndex].computedStyles;
          if (stylesToApply) {
              targetTextarea.style.fontSize = stylesToApply.fontSize || '';
              targetTextarea.style.fontWeight = stylesToApply.fontWeight || '';
          } else {
              targetTextarea.style.fontSize = '';
              targetTextarea.style.fontWeight = '';
          }
  
          autoGrow(targetTextarea);
  
          targetTextarea.focus();
          if (pendingFocusPos !== null) {
              const adjustedPos = Math.min(pendingFocusPos, targetTextarea.value.length);
              targetTextarea.setSelectionRange(adjustedPos, adjustedPos);
          }
        }
  
        pendingFocusIndex = null;
        pendingFocusPos = null;
      }
      mermaid.run(); // Initialize and render Mermaid diagrams
    });</script>

<main>
  <div class="editor">
    {#each lines as line, index (line.id)}
      {@const isCurrentLineCodeBlock = isCodeBlockFence(line.text)}
      <div class="line" class:editing={editingLineIndex === index} class:code-block={line.text.trim().startsWith('```')}>
        {#if editingLineIndex === index && line.text.trim().startsWith('```')}
          <!-- When editing a code block, show 2-pane -->
          <div class="code-editor-panes">
            <textarea
              bind:this={textareaRefs[index]}
              value={isCodeBlockFence(line.text) ? line.text.replace(/\n```$/, '') : line.text}
              on:keydown={(e) => handleKeyDown(e, index)}
                            on:input={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                const currentCursorPos = target.selectionStart;
                                let editedContent = target.value;
              
                                if (!isCodeBlockFence(editedContent)) {
                                    lines[index].text = editedContent;
                                    lines[index].renderedHtml = renderMarkdown(editedContent);
                                } else {
                                    let lang = getCodeBlockLanguage(editedContent) || '';
                                    lines[index].text = `${editedContent}\n\`\`\``;
                                    lines[index].renderedHtml = renderMarkdown(lines[index].text);
                                }
                                lines[index].computedStyles = getComputedStylesFromHtml(lines[index].renderedHtml); // Added
                                autoGrow(target);
                                lines = lines;
                                dispatch('update', { lines }); // Emit update event
                                pendingFocusIndex = index;
                                pendingFocusPos = currentCursorPos;
                            }}              on:focus={() => handleFocus(index)}
              on:blur={handleBlur}
            ></textarea>
            <div class="code-preview-pane markdown-preview" bind:this={previewRefs[index]}>
              {@html line.renderedHtml}
            </div>
          </div>
        {:else if editingLineIndex === index}
          <!-- When editing a regular line, show single textarea -->
          <textarea
            bind:this={textareaRefs[index]}
            value={line.text}
            on:keydown={(e) => handleKeyDown(e, index)}
            on:input={(e) => {
                const target = e.target as HTMLTextAreaElement;
                const currentCursorPos = target.selectionStart;

                lines[index].text = target.value;
                lines[index].renderedHtml = renderMarkdown(lines[index].text);
                lines[index].computedStyles = getComputedStylesFromHtml(lines[index].renderedHtml); // Added
                autoGrow(target);
                lines = lines;
                dispatch('update', { lines }); // Emit update event
                pendingFocusIndex = index;
                pendingFocusPos = currentCursorPos;
            }}
            on:focus={() => handleFocus(index)}
            on:blur={handleBlur}
          ></textarea>
        {/if}

        {#if editingLineIndex !== index}
          <!-- When not editing, show markdown preview -->
          <div
            class="markdown-preview"
            bind:this={previewRefs[index]}
            on:click={() => {
              activateLineForEditing(index, 0);
            }}
          >
            {@html line.renderedHtml}
          </div>
        {/if}

      </div>
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
