export interface Note {
  id: string;
  title: string;
  created_time: string;
  updated_time: string;
  body: string;
}

export type Referrer = Note & {
  mentionCount: number;
};

export type SearchedNote = Pick<Note, 'id' | 'title'> & {
  parent_id: string;
  path?: string;
};

export interface Notebook {
  id: string;
  parent_id: string;
  title: string;
  children?: Notebook[];
}
