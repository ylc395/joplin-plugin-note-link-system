import tippy, { roundArrow } from 'tippy.js';
import 'tippy.js/dist/svg-arrow.css';
import { Referrer } from 'model/Referrer';
import {
  MARKDOWN_SCRIPT_ID,
  SearchReferrersRequest,
  SearchElementReferrersResponse,
  OpenNoteRequest,
} from 'driver/constants';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: SearchReferrersRequest | OpenNoteRequest) => Promise<T>;
};

const ICON_CLASS_NAME = 'note-link-element-referrers-icon';
const LIST_CLASS_NAME = 'note-link-element-referrers-list';
const LIST_ITEM_CLASS_NAME = 'note-link-element-referrers-list-item';
function attach(attachTargetEl: HTMLElement, iconEl: HTMLElement, listEl: HTMLElement) {
  // currently, wo only handle h1-h6 as attach target
  if (!['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(attachTargetEl.tagName)) {
    return;
  }

  attachTargetEl.appendChild(iconEl);

  tippy(iconEl, {
    duration: [300, 0],
    content: listEl,
    interactive: true,
    placement: 'right',
    arrow: roundArrow,
    trigger: process.env.NODE_ENV === 'development' ? 'click' : 'mouseenter focus',
  });
}

export class ElementReferrerBuilder {
  init() {
    document.addEventListener('joplin-noteDidUpdate', this.attachReferrers.bind(this));
    this.attachReferrers();
  }

  private async attachReferrers() {
    const rootEl = document.getElementById('rendered-md')!;
    const els = [...rootEl.querySelectorAll('[id]')] as HTMLElement[];
    const ids = els.map((el) => el.id);
    const referrersMap = await webviewApi.postMessage<SearchElementReferrersResponse>(
      MARKDOWN_SCRIPT_ID,
      {
        event: 'searchReferrers',
        payload: { elementIds: ids },
      },
    );

    for (const elId of Object.keys(referrersMap)) {
      const idEl = document.getElementById(elId)!;
      const referrers = referrersMap[elId];
      const [iconEl, listEl] = this.createReferrerElements(referrers);

      attach(idEl, iconEl, listEl);
    }
  }

  private createReferrerElements(notes: Referrer[]) {
    const iconEl = document.createElement('span');
    iconEl.classList.add(ICON_CLASS_NAME);
    iconEl.textContent = String(notes.length);

    const olEL = document.createElement('ol');
    olEL.classList.add(LIST_CLASS_NAME);

    for (const note of notes) {
      olEL.innerHTML += `<li><a class="${LIST_ITEM_CLASS_NAME}" data-note-link-referrer-id="${note.id}">${note.title}</a><span>${note.mentionCount}</span></li>`;
    }

    return [iconEl, olEL];
  }
}
