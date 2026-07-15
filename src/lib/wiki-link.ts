export interface WikiLink {
  raw: string;
  title: string;
  startIndex: number;
  endIndex: number;
}

export function parseWikiLinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  const regex = /\[([^\]]+)\](?!\()/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    links.push({
      raw: match[0],
      title: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return links;
}

export function renderWikiLinksAsHtml(
  text: string,
  onLinkClick?: (title: string) => void
): string {
  const links = parseWikiLinks(text);
  if (links.length === 0) return text;

  let result = '';
  let lastIndex = 0;

  for (const link of links) {
    result += escapeHtml(text.slice(lastIndex, link.startIndex));
    const encodedTitle = encodeURIComponent(link.title);
    result += `<a href="/wiki/${encodedTitle}" class="wiki-link" data-title="${escapeHtml(link.title)}" onclick="event.preventDefault(); window.__wikiNavigate?.('${escapeHtml(link.title)}')">${escapeHtml(link.title)}</a>`;
    lastIndex = link.endIndex;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}

export function renderWikiLinksAsMarkdown(
  text: string,
  baseUrl: string = '/wiki'
): string {
  return text.replace(/\[([^\]]+)\](?!\()/g, (_match, title: string) => {
    const encodedTitle = encodeURIComponent(title);
    return `[${title}](${baseUrl}/${encodedTitle})`;
  });
}

export function hasWikiLinks(text: string): boolean {
  return /\[[^\]]+\](?!\()/.test(text);
}

export function extractWikiLinkTitles(text: string): string[] {
  const links = parseWikiLinks(text);
  return links.map((link) => link.title);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
