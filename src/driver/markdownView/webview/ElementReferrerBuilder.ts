import tippy, { roundArrow } from 'tippy.js';
import 'tippy.js/dist/svg-arrow.css';
import referenceIcon from 'bootstrap-icons/icons/box-arrow-in-down-left.svg';
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
const LIST_ITEM_COUNT_CLASS_NAME = 'note-link-element-referrer-count';

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
    trigger: 'click',
    popperOptions: {
      modifiers: [
        {
          name: 'flip',
          options: {
            fallbackPlacements: ['top', 'bottom', 'right'],
          },
        },
      ],
    },
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
    // todo: and a setting to configure which number(notes.length / sum of mentions / both) should be displayed
    iconEl.innerHTML = `${notes.length}${referenceIcon}`;

    const olEL = document.createElement('ol');
    olEL.classList.add(LIST_CLASS_NAME);

    for (const note of notes) {
      olEL.innerHTML += `<li><a data-note-link-referrer-id="${note.id}">${note.title}</a><span class="${LIST_ITEM_COUNT_CLASS_NAME}">${note.mentionCount}</span></li>`;
    }

    return [iconEl, olEL];
  }
}
