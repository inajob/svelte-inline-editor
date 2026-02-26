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
    getComputedStylesFromHtml,
    parseListItem, // Import parseListItem
    parseIndentation // Import parseIndentation
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
    { id: 5, text: "" }, 
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

  function updateLineText(index: number, newText: string) {
    const line = lines[index];
    line.text = newText;
    line.renderedHtml = renderMarkdown(line.text);
    line.computedStyles = getComputedStylesFromHtml(line.renderedHtml);
    lines = lines; // Trigger reactivity
  }

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

      // --- List Item Auto-De-listify Logic ---
      const wasListItem = parseListItem(line.text).isListItem;
      const isNowListItem = parseListItem(newText).isListItem;

      if (wasListItem && !isNowListItem) {
        // If it was a list item, but the user's edit (e.g., deleting '- ')
        // made it no longer a list item, then we should also remove the indentation.
        newText = newText.trimStart();
      }
      // --- End List Item Auto-De-listify Logic ---

      // If the current text from the textarea starts with a code fence
      if (text.startsWith('```')) {
          // And it does NOT end with a code fence (meaning it's an unclosed code block)
          // Then, for rendering purposes, append a closing fence with a single newline.
          if (!text.endsWith('```')) {
              // Check if there's already a newline at the end before adding another one
              const needsNewline = !text.endsWith('\n');
              newText = `${text}${needsNewline ? '\n' : ''}\`\`\``;
          }
          // If it already ends with '```', newText remains `text` (it's already a closed block).
      }


      if (line.text !== newText) {
          updateLineText(index, newText);
          dispatch('update', { lines });
      }

      // Request focus to be set again on the updated line
      editingLineIndex = index;
      pendingFocusIndex = index;
      // Adjust cursor position if we de-listified the line
      const finalCursorPos = newText.length < text.length ? Math.max(0, cursorPos - (text.length - newText.length)) : cursorPos;
      pendingFocusPos = finalCursorPos;
  }

  function handleLineKeyDown(event: CustomEvent, index: number) {
      const { key, event: keyboardEvent } = event.detail;

      if (keyboardEvent.isComposing || keyboardEvent.keyCode === 229) {
        return;
      }

      // Default behavior is NOT prevented here.
      // The individual handlers below are responsible for calling `preventDefault()`
      // if and when it's appropriate for that specific key.
      switch (key) {
        case 'Enter':
          return handleEnterKey(keyboardEvent, index);
        case 'Backspace':
            // Try to dedent first. If dedent handles the event, stop.
            if (handleBackspaceDedent(keyboardEvent, index)) {
                return;
            }
            // Otherwise, fall through to original handleBackspaceKey
            return handleBackspaceKey(keyboardEvent, index);
        case 'ArrowUp':
          return handleArrowUpKey(keyboardEvent, index);
        case 'ArrowDown':
          return handleArrowDownKey(keyboardEvent, index);
        case 'Tab':
          return handleTabKey(keyboardEvent, index);
        case 'Shift+Tab':
          return handleShiftTabKey(keyboardEvent, index);
        case ' ':
          return handleSpaceKey(keyboardEvent, index);
      }
  }

  function handleBackspaceDedent(event: KeyboardEvent, index: number): boolean {
      const textarea = event.target as HTMLTextAreaElement;
      const { selectionStart, selectionEnd } = textarea;

      // Only act if no selection and cursor is at or before index 2
      if (selectionStart !== selectionEnd || selectionStart > 2) {
          return false; // Not handled by this function, let other handlers process
      }

      const line = lines[index];
      const parsedLine = parseListItem(line.text);

      if (parsedLine.isListItem) {
          event.preventDefault(); // This event is handled by dedenting
          
          let newText = line.text;
          let newCursorPos = selectionStart; 

          if (parsedLine.indent > 0) {
              newText = newText.substring(2); // Remove two spaces
          } else {
              // Level 0 list item, remove the bullet and its space
              newText = parsedLine.content; 
          }
          
          updateLineText(index, newText);
          activateLineForEditing(index, newCursorPos);
          return true; // Successfully handled
      }
      return false; // Not a list item or not at specified position, not handled
  }

  function handleSpaceKey(event: KeyboardEvent, index: number) {
      const textarea = event.target as HTMLTextAreaElement;
      const { selectionStart, selectionEnd } = textarea;

      // Do nothing if there's a selection
      if (selectionStart !== selectionEnd) {
          return;
      }

      const line = lines[index];
      const { isListItem } = parseListItem(line.text);

      // Requirement 2: Indent list item if space is pressed near the start
      if (isListItem && selectionStart <= 2) {
          event.preventDefault();
          const newText = '  ' + line.text; // Add two spaces for indentation
          updateLineText(index, newText);
          activateLineForEditing(index, selectionStart + 2); // Move cursor past the new spaces
          return;
      }

      // Requirement 1: Create list item if space is pressed at the very start of a non-list line
      if (!isListItem && selectionStart === 0) {
          event.preventDefault();
          const newText = '- ' + line.text; // Prepend bullet
          updateLineText(index, newText);
          activateLineForEditing(index, 2); // Cursor at start of content
          return;
      }
  }

  // --- Indentation Logic ---

  function handleTabKey(event: KeyboardEvent, index: number) {
    event.preventDefault();
    const line = lines[index];
    const parsedLine = parseListItem(line.text);
    let newText = line.text;
    const actualCursorPos = (event.target as HTMLTextAreaElement).selectionStart; // Cursor position in textarea content
    let newCursorPos = actualCursorPos; 

    if (parsedLine.isListItem) {
        newText = '  ' + line.text; // Increase indentation
        // newCursorPos remains actualCursorPos as per user's request for existing list items
    } else {
        // Convert the line to a list item
        newText = '- ' + newText;
        newCursorPos = actualCursorPos + 2; // Cursor moves after the newly added "- "
    }

    updateLineText(index, newText);
    activateLineForEditing(index, newCursorPos);
  }

  function handleShiftTabKey(event: KeyboardEvent, index: number) {
    event.preventDefault();
    const line = lines[index];
    const parsedLine = parseListItem(line.text);
    let newText = line.text;
    const actualCursorPos = (event.target as HTMLTextAreaElement).selectionStart; // Cursor position in textarea content
    let newCursorPos = actualCursorPos; // Cursor should stay at the same visual position

    if (parsedLine.isListItem) {
        if (parsedLine.indent > 0) {
            newText = newText.substring(2); // Remove two spaces for dedentation
            // newCursorPos does not need to change relative to the content in the textarea
        } else {
            // If it's a list item at indent 0, remove the bullet and its space
            newText = parsedLine.content; 
            // The textarea content changes from "- content" to "content",
            // so we must adjust the cursor position to account for the removed bullet and space.
            newCursorPos = Math.max(0, actualCursorPos - (parsedLine.bullet.length + 1));
        }
    }
    // No action for non-list items, as per the new requirement
    
    // Only update if text has changed
    if (newText !== line.text) {
      updateLineText(index, newText);
      activateLineForEditing(index, newCursorPos);
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
    event.preventDefault();
    
    const textarea = event.target as HTMLTextAreaElement;
    const { selectionStart, value } = textarea;
    const currentLine = lines[index];

    // Check for code blocks first
    if (isCodeBlockFence(currentLine.text)) {
      // Manual newline insertion for code blocks when preventDefault is called
      const originalText = currentLine.text;
      const newText = originalText.slice(0, selectionStart) + '\n' + originalText.slice(selectionStart);
      updateLineText(index, newText);
      lines = lines; // Trigger reactivity
      activateLineForEditing(index, selectionStart + 1);
      return; 
    }

    const { indent, content: originalContentWithoutLeadingSpaces } = parseIndentation(currentLine.text);
    const { isListItem, bullet } = parseListItem(currentLine.text);
    const leadingSpaces = '  '.repeat(indent);
    
    // Case 1: Pressing Enter on an empty list item (`- |`)
    if (isListItem && value.trim() === bullet) {
      currentLine.text = leadingSpaces.trimEnd(); // Remove bullet, keep indentation
      updateLineText(index, currentLine.text);
      activateLineForEditing(index, leadingSpaces.length);
      return;
    }

    // Split the displayed content at the cursor
    const contentBeforeCursor = value.substring(0, selectionStart);
    const contentAfterCursor = value.substring(selectionStart);

    // Update the current line's text
    currentLine.text = leadingSpaces + contentBeforeCursor;
    updateLineText(index, currentLine.text);
    
    // Create the new line's text
    let newLineText;
    if (isListItem) {
      // New line should also be a list item with same indentation
      newLineText = leadingSpaces + bullet + ' ' + contentAfterCursor;
    } else {
      // New line just inherits indentation
      newLineText = leadingSpaces + contentAfterCursor;
    }

    const newLine: Line = { 
      id: nextId++, 
      text: newLineText, 
      renderedHtml: renderMarkdown(newLineText),
      computedStyles: getComputedStylesFromHtml(renderMarkdown(newLineText))
    };

    lines = [...lines.slice(0, index + 1), newLine, ...lines.slice(index + 1)];

    // Activate the new line, placing cursor at the start of its editable content
    const newCursorPos = (isListItem ? bullet.length + 1 : 0); // +1 for the space after bullet
    activateLineForEditing(index + 1, newCursorPos);
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
      const combinedText = previousLine.text + lines[index].text; // Use lines[index].text instead of value
      previousLine.text = combinedText;
      previousLine.renderedHtml = renderMarkdown(combinedText);
      lines = lines.filter((_, i) => i !== index);
      activateLineForEditing(index - 1, previousLine.text.length - lines[index].text.length);
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


