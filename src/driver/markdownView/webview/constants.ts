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
