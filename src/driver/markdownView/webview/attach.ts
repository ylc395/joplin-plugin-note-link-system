const REFERRERS_HIDE_CLASS_NAME = 'note-link-referrers-hidden';

export function attach(attachTargetEl: HTMLElement, listContainerEl: HTMLElement) {
  // currently, wo only handle h1-h6 as attach target
  if (!['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(attachTargetEl.tagName)) {
    return;
  }

  attachTargetEl.appendChild(listContainerEl);
}
