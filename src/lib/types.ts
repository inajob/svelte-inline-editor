export interface Line {
  id: number;
  text: string;
  renderedHtml: string;
  computedStyles?: { fontSize: string | null; fontWeight: string | null };
}
