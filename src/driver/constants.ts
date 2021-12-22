import type { Reference, Referrer } from 'model/Referrer';

export const QUICK_LINK_SEARCH_PATTERN_SETTING = 'QUICK_LINK_SEARCH_PATTERN_SETTING';
export const REFERRER_SEARCH_PATTERN_SETTING = 'REFERRER_SEARCH_PATTERN_SETTING';
export const REFERRER_LIST_HEADING_SETTING = 'REFERRER_LIST_HEADING_SETTING';
export const REFERRER_LIST_MENTION_TEXT_MAX_LENGTH = 'REFERRER_LIST_MENTION_TEXT_MAX_LENGTH';
export const REFERRER_ELEMENT_NUMBER_ENABLED = 'REFERRER_ELEMENT_NUMBER_ENABLED';
export const REFERRER_ELEMENT_NUMBER_TYPE = 'REFERRER_ELEMENT_NUMBER_TYPE';
export const REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH = 'REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH';
export const REFERRER_AUTO_LIST_ENABLED_SETTING = 'REFERRER_AUTO_LIST_ENABLED_SETTING';
export const REFERRER_AUTO_LIST_POSITION_SETTING = 'REFERRER_AUTO_LIST_POSITION_SETTING';
export const REFERRER_VIEW_REFERENCE_EXPAND_SETTING = 'REFERRER_VIEW_REFERENCE_EXPAND_SETTING';
export const REFERRER_PANEL_ENABLED_SETTING = 'REFERRER_PANEL_ENABLED_SETTING';
export const REFERRER_PANEL_TITLE_SETTING = 'REFERRER_PANEL_TITLE_SETTING';
export const REFERRER_PANEL_STYLESHEET_SETTING = 'REFERRER_PANEL_STYLESHEET_SETTING';
export const REFERRER_PANEL_REFERENCE_EXPAND_SETTING = 'REFERRER_PANEL_REFERENCE_EXPAND_SETTING';
export const REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH = 'REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH';
export const REFERRER_IDENTIFIER_ENABLED_SETTING = 'REFERRER_IDENTIFIER_ENABLED_SETTING';
export const QUICK_LINK_ENABLED_SETTING = 'QUICK_LINK_ENABLED_SETTING';
export const QUICK_LINK_SYMBOL_SETTING = 'QUICK_LINK_SYMBOL_SETTING';
export const QUICK_LINK_SHOW_PATH_SETTING = 'QUICK_LINK_SHOW_PATH_SETTING';
export const QUICK_LINK_ELEMENTS_ENABLED_SETTING = 'QUICK_LINK_ELEMENTS_ENABLED_SETTING';
export const QUICK_LINK_AFTER_COMPLETION_SETTING = 'QUICK_LINK_AFTER_COMPLETION_SETTING';
export const QUICK_LINK_CREATE_NOTE_SETTING = 'QUICK_LINK_CREATE_NOTE_SETTING';
export const PREVIEWER_ENABLED_SETTING = 'PREVIEWER_ENABLED_SETTING';
export const PREVIEWER_HOVER_DELAY_SETTING = 'PREVIEWER_HOVER_DELAY_SETTING';

export const NOTE_SEARCH_PATTERN_PLACEHOLDER = '$keyword';
export const REFERRER_SEARCH_PATTERN_PLACEHOLDER = '$noteId';
export const MAIN_MARK_CLASS_NAME = 'note-link-mark-main';

export const MARKDOWN_SCRIPT_ID = 'ylc395.noteLinkSystem.MARKDOWN_SCRIPT_ID';
export const CODE_MIRROR_SCRIPT_ID = 'ylc395.noteLinkSystem.CODE_MIRROR_SCRIPT_ID';

export type Request =
  | SearchNotesRequest
  | SearchReferrersRequest
  | OpenNoteRequest
  | QueryFromReferenceRequest
  | QuerySettingRequest
  | WriteClipboardRequest
  | FetchNoteHtmlRequest
  | CreateNoteRequest
  | QueryNoteRequest
  | ScrollToHashRequest
  | QueryNoteResourcesRequest
  | QueryCurrentNoteRequest;

export interface SearchNotesRequest {
  event: 'searchNotes';
  payload: { keyword: string };
}

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
    reference?: Reference;
  };
}

export interface QueryFromReferenceRequest {
  event: 'queryFromReference';
}

export interface ScrollToHashRequest {
  event: 'scrollToHash';
  payload: { hash: string };
}

export interface WriteClipboardRequest {
  event: 'writeClipboard';
  payload: {
    content: string;
  };
}

export interface SearchElementReferrersResponse {
  [index: string]: Referrer[];
}

export type SearchNoteReferrersResponse = Referrer[];

export interface QuerySettingRequest {
  event: 'querySetting';
  payload: { key: string };
}

export interface QueryCurrentNoteRequest {
  event: 'queryCurrentNote';
}

export interface FetchNoteHtmlRequest {
  event: 'fetchNoteHtml';
  payload: { id: string };
}

export interface CreateNoteRequest {
  event: 'createNote';
  payload: { title: string; type: 'todo' | 'note' };
}

export interface QueryNoteRequest {
  event: 'queryNote';
  payload: { id: string };
}

export interface QueryNoteResourcesRequest {
  event: 'queryNoteResources';
  payload: { noteId: string };
}
