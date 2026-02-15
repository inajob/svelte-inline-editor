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
      .replace(/>/g, "&gt;")
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
        // Render mermaid and get the SVG
        // mermaid.render returns a promise, but we are in a synchronous function.
        // For now, we'll return a placeholder and rely on client-side rendering later.
        // Or, for initial render, we can do a synchronous render if possible, or mark for post-render processing.
        // For now, let's assume we can directly get the SVG.
        // This will require mermaid.run() or similar in afterUpdate.
        // For initial render, we'll just return a div that mermaid can target.
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
      return `<h${level}>${sanitizeContent(fullMatch)}</h${level}>`;
  });

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

  const childElements = tempDiv.querySelectorAll('h1, h2, p, strong, em, code, pre');
  const targetElement = childElements.length > 0 ? childElements[0] : tempDiv;
  const computedStyle = window.getComputedStyle(targetElement);

  const styles = {
    fontSize: computedStyle.fontSize,
    fontWeight: computedStyle.fontWeight,
  };
  document.body.removeChild(tempDiv);
  return styles;
}

