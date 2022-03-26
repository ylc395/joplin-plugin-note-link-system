import {
  TODO_CHECKBOX_ID_PREFIX,
  FOOTNOTE_ID_PREFIX,
  FOOTNOTE_ITEM_CLASS_NAME,
  SCROLL_ANCHOR_ID,
} from './constants';

export function isIgnoredIdElement(el: HTMLElement) {
  const { id, classList } = el;

  return (
    id.startsWith(TODO_CHECKBOX_ID_PREFIX) ||
    id.startsWith(FOOTNOTE_ID_PREFIX) ||
    id.startsWith(SCROLL_ANCHOR_ID) ||
    classList.contains(FOOTNOTE_ITEM_CLASS_NAME)
  );
}
