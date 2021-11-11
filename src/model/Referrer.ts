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

export type SearchedNote = Pick<Note, 'id' | 'title'>;
