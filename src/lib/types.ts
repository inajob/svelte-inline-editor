export interface Line {
  id: number;
  text: string;
  renderedHtml: string;
  computedStyles?: { fontSize: string | null; fontWeight: string | null };
}

export interface AwarenessState {
  userId: string;
  userName: string;
  color: string;
  editingLineId: string | null;
}

export interface PageInfo {
  title: string;
  createdAt: string;
  updatedAt: string;
}
