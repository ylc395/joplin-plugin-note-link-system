export interface Note {
  id: string;
  title: string;
  created_time: string;
  updated_time: string;
  parent_id: string;
  path?: string;
  body: string;
}

export type Referrer = Note & {
  mentions: string[];
};

export type SearchResult = Pick<Note, 'id' | 'title' | 'parent_id' | 'path'> & {
  isCurrent?: boolean;
};

export interface Notebook {
  id: string;
  parent_id: string;
  title: string;
  children?: Notebook[];
}

export interface Reference {
  toNoteId?: string;
  toElementId?: string;
  index: number; // start from 1
}
