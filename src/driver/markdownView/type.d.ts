import type { Note } from 'model/Note';

export type Request = SearchReferrersRequest | OpenNoteRequest | QuerySettingRequest;

export interface SearchReferrersRequest {
  event: 'searchReferrers';
  payload?: {
    elementIds: string[];
  };
}

export interface OpenNoteRequest {
  event: 'openNote';
  payload: {
    noteId: string;
  };
}

export interface SearchReferrersResponse {
  [index: string]: Note[];
}

export type SearchNoteReferrersResponse = Note[];

export interface QuerySettingRequest {
  event: 'querySetting';
  payload: { key: string };
}
