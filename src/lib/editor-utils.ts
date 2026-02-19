import hljs from 'highlight.js';
import mermaid from 'mermaid';

// Define line types for better structure
export type Line = {
  id: number;
  text: string;
  renderedHtml: string;
  computedStyles?: { fontSize: string | null; fontWeight: string | null };
};

export function isCodeBlockFence(text: string): boolean {
  return text.trim().startsWith('```');
}

export function getCodeBlockLanguage(text: string): string | null {
  const match = text.trim().match(/^```(\w*)/);
  return match ? match[1] || 'plaintext' : null;
}

export function parseListItem(text: string): { indent: number; bullet: string; content: string; isListItem: boolean } {
  // Matches leading spaces, then -, *, or +, then a space, then content
  const listItemRegex = /^( *)(?:(-|\*|\+))\s(.*)/; 
  const match = text.match(listItemRegex);

  if (match) {
    const leadingSpaces = match[1];
    const bulletChar = match[2];
    const content = match[3];
    // Assuming 2 spaces per indent level for simplicity.
    // If Markdown supports other indentations (e.g., tabs), this needs adjustment.
    const indent = leadingSpaces.length / 2; 

    return {
      indent,
      bullet: bulletChar,
      content,
      isListItem: true,
    };
  }

  return {
    indent: 0,
    bullet: '',
    content: text,
    isListItem: false,
  };
}

export function parseIndentation(text: string): { indent: number; content: string } {
  const match = text.match(/^( *)(.*)/s); // Use 's' flag to allow . to match newline
  if (match) {
    const leadingSpaces = match[1] || '';
    const content = match[2] || '';
    // Use Math.floor because odd numbers of spaces might not be intentional indentation
    const indent = Math.floor(leadingSpaces.length / 2); 
    return { indent, content };
  }
  return { indent: 0, content: text };
}

export function renderMarkdown(text: string): string {
  console.log('renderMarkdown received text:', text); // DEBUG LOG
  // For empty or whitespace-only lines, render a non-breaking space
  // to ensure the div has a stable, measurable height.
  if (text.trim() === '') {
    return '&nbsp;';
  }

  // Helper to sanitize captured content
  const sanitizeContent = (content: string) => content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, ">") // Allow > for markdown rendering
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const isCodeBlock = text.startsWith('```');
      if (isCodeBlock) {
        const codeBlockMatch = text.match(/^```(\w*)([\s\S]*?)```$/);
        
        // Handle unclosed code blocks: render the raw text in a pre tag
        if (!codeBlockMatch) {
          const language = getCodeBlockLanguage(text) || 'plaintext';
          // Render the entire raw text, including the opening ```
          let highlightedCode = text; // Default to raw text
          try {
            highlightedCode = hljs.highlight(text, {language: language}).value;
          } catch (e) {
            highlightedCode = hljs.highlight(text, {language: 'plaintext'}).value;
          }
          return `<pre><code class="language-${language}">${highlightedCode}</code></pre>`;
        }
  
        // Existing logic for closed code blocks
        let code = '';
        let language = 'plaintext';
  
        // The codeBlockMatch is guaranteed to exist here due to the `if (!codeBlockMatch)` check above.
        language = codeBlockMatch[1] || 'plaintext';
        code = codeBlockMatch[2];
    if (language === 'mermaid') {
      try {
        // Mermaid needs an ID for its container
        const id = 'mermaid-' + Math.random().toString(36).substring(2, 9);
        return `<div class="mermaid">${code}</div>`;

      } catch (e) {
        console.error("Mermaid rendering failed:", e);
        return `<pre><code class="language-plaintext">Error rendering Mermaid:
${code}</code></pre>`;
      }
    } else {
      let highlightedCode = code;
      try {
        highlightedCode = hljs.highlight(code, {language: language}).value;
      } catch (e) {
        highlightedCode = hljs.highlight(code, {language: 'plaintext'}).value;
      }
      return `<pre><code class="language-${language}">${highlightedCode}</code></pre>`;
    }
  }


  let markdownApplied = false;
  let resultHtml = text; 

  // Headings
  resultHtml = resultHtml.replace(/^(#+)\s(.+)/, (fullMatch, hashes, content) => {
      markdownApplied = true;
      const level = hashes.length;
      return `<h${level}>${sanitizeContent(content)}</h${level}>`;
  });

  // List items (rendering for preview to match editing style)
  const parsed = parseListItem(text);
  if (parsed.isListItem) {
    markdownApplied = true;
    const indentPixels = parsed.indent * 16; // Assuming 16px per indent level (8px per space)
    return `
      <div style="display: flex; align-items: flex-start; padding-left: ${indentPixels}px;">
        <div style="flex-shrink: 0; width: 20px; text-align: center; padding-top: 2px;">•</div>
        <div>${sanitizeContent(parsed.content)}</div>
      </div>
    `;
  }

  // Inline formatting
  resultHtml = resultHtml.replace(/\*\*(.*?)\*\*/g, (_, content) => {
      markdownApplied = true;
      return `<strong>${sanitizeContent(content)}</strong>`;
  });
  resultHtml = resultHtml.replace(/\*(.*?)\*/g, (_, content) => {
      markdownApplied = true;
      return `<em>${sanitizeContent(content)}</em>`;
  });
  resultHtml = resultHtml.replace(/`(.*?)`/g, (_, content) => {
      markdownApplied = true;
      return `<code>${sanitizeContent(content)}`;
  });

  if (!markdownApplied) {
      return `<p>${sanitizeContent(text)}</p>`;
  }

  return resultHtml;
}

export function autoGrow(textarea: HTMLTextAreaElement) {
  if (!textarea) return;

  if (textarea.value.trim() === '') {
    textarea.style.height = '24px'; 
    return;
  }

  textarea.style.height = '1px';
  textarea.style.height = `${textarea.scrollHeight}px`; 
}

export function getComputedStylesFromHtml(htmlContent: string): { fontSize: string | null; fontWeight: string | null } {
  if (typeof document === 'undefined') { // Ensure this runs only in browser
    return { fontSize: null, fontWeight: null };
  }
      const tempDiv = document.createElement('div');
      tempDiv.classList.add('markdown-preview'); // Added markdown-preview class
      tempDiv.style.position = 'absolute';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.height = '0';
      tempDiv.style.width = '0';
      tempDiv.style.overflow = 'hidden';
      document.body.appendChild(tempDiv);      tempDiv.innerHTML = htmlContent;

  const childElements = tempDiv.querySelectorAll('h1, h2, p, strong, em, code, pre, div'); // Added div for list items
  const targetElement = childElements.length > 0 ? childElements[0] : tempDiv;
  const computedStyle = window.getComputedStyle(targetElement);

  const styles = {
    fontSize: computedStyle.fontSize,
    fontWeight: computedStyle.fontWeight,
  };
  document.body.removeChild(tempDiv);
  return styles;
}
