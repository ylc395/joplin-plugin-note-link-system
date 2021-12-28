export enum ReferrersAutoListPosition {
  Top,
  Bottom,
  None,
}

export enum ReferrersListNumberType {
  ReferrersCount,
  ReferencesCount,
  Both,
}

export enum MarkdownViewEvents {
  NoteDidUpdate = 'NoteDidUpdate',
  NewNoteOpen = 'NewNoteOpen',
}

export enum ReferenceListExpandMode {
  ExpandNoteListOnly,
  ExpandElementListOnly,
  ExpandBoth,
  ExpandNone,
}

export const ROOT_ELEMENT_ID = 'rendered-md';

export const SCROLL_ANCHOR_ID = 'note-link-scroll-anchor';

export const REFERRER_TITLE_CONTAINER_CLASS_NAME = 'note-link-referrer-title-container';
export const REFERRER_TITLE_CLASS_NAME = 'note-link-referrer-title';
export const REFERENCE_ITEM_CLASS_NAME = 'note-link-reference-item';
export const REFERENCE_CLASS_NAME = 'note-link-reference';

export const TODO_CHECKBOX_ID_PREFIX = 'cb-label-md-checkbox-';
