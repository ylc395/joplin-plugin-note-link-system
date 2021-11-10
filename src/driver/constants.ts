import type { Referrer } from 'model/Referrer';

export const NOTE_SEARCH_PATTERN_SETTING = 'NOTE_SEARCH_PATTERN_SETTING';
export const REFERRER_SEARCH_PATTERN_SETTING = 'REFERRER_SEARCH_PATTERN_SETTING';
export const REFERRER_LIST_HEADING_SETTING = 'REFERRER_LIST_HEADING_SETTING';
export const REFERRER_ELEMENT_NUMBER_ENABLED = 'REFERRER_ELEMENT_NUMBER_ENABLED';
export const REFERRER_ELEMENT_NUMBER_TYPE = 'REFERRER_ELEMENT_NUMBER_TYPE';
export const REFERRER_AUTO_LIST_ENABLED_SETTING = 'REFERRER_AUTO_LIST_ENABLED_SETTING';
export const REFERRER_AUTO_LIST_POSITION_SETTING = 'REFERRER_AUTO_LIST_POSITION_SETTING';
export const REFERRER_PANEL_ENABLED_SETTING = 'REFERRER_PANEL_ENABLED_SETTING';
export const REFERRER_PANEL_TITLE_SETTING = 'REFERRER_PANEL_TITLE_SETTING';
export const REFERRER_PANEL_STYLESHEET_SETTING = 'REFERRER_PANEL_STYLESHEET_SETTING';
export const REFERRER_IDENTIFIER_ENABLED_SETTING = 'REFERRER_IDENTIFIER_ENABLED_SETTING';

export const NOTE_SEARCH_PATTERN_PLACEHOLDER = '$keyword';
export const REFERRER_SEARCH_PATTERN_PLACEHOLDER = '$noteId';
export enum ReferrersAutoListPosition {
  Top,
  Bottom,
}

export enum ReferrersAutoListEnabled {
  Enabled,
  EnabledWhenNoManual,
  Disabled,
}

export enum ReferrersListNumberType {
  ReferrersCount,
  ReferencesCount,
  Both,
}

export const MARKDOWN_SCRIPT_ID = 'ylc395.noteLinkSystem.MARKDOWN_SCRIPT_ID';
export const CODE_MIRROR_SCRIPT_ID = 'ylc395.noteLinkSystem.CODE_MIRROR_SCRIPT_ID';

export type Request =
  | SearchReferrersRequest
  | OpenNoteRequest
  | QuerySettingRequest
  | WriteClipboardRequest
  | QueryCurrentNoteRequest;

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
