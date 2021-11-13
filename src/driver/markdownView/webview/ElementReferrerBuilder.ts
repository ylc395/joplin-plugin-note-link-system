import tippy, { roundArrow } from 'tippy.js';
import debounce from 'lodash.debounce';
import 'tippy.js/dist/svg-arrow.css';
import referenceIcon from 'bootstrap-icons/icons/box-arrow-in-down-left.svg';
import { Referrer } from 'model/Referrer';
import {
  MARKDOWN_SCRIPT_ID,
  SearchReferrersRequest,
  SearchElementReferrersResponse,
  OpenNoteRequest,
  QuerySettingRequest,
  REFERRER_ELEMENT_NUMBER_ENABLED,
  REFERRER_ELEMENT_NUMBER_TYPE,
} from 'driver/constants';
import { ReferrersListNumberType } from './constants';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: SearchReferrersRequest | OpenNoteRequest | QuerySettingRequest,
  ) => Promise<T>;
};

const ICON_CLASS_NAME = 'note-link-element-referrers-icon';
const LIST_CLASS_NAME = 'note-link-element-referrers-list';
const LIST_ITEM_COUNT_CLASS_NAME = 'note-link-element-referrer-count';

function attach(attachTargetEl: HTMLElement, iconEl: HTMLElement, listEl: HTMLElement) {
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
  private numberType?: ReferrersListNumberType;
  async init() {
    const enabled = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_ELEMENT_NUMBER_ENABLED },
    });

    if (!enabled) {
      return;
    }

    this.numberType = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_ELEMENT_NUMBER_TYPE },
    });

    document.addEventListener(
      'joplin-noteDidUpdate',
      debounce(this.attachReferrers.bind(this), 1500),
    );
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
      const iconEl = this.createReferrerIconElement(referrers);
      const listEl = this.createReferrerListElement(referrers);

      attach(idEl, iconEl, listEl);
    }
  }

  private createReferrerIconElement(notes: Referrer[]) {
    const iconEl = document.createElement('span');
    iconEl.classList.add(ICON_CLASS_NAME);
    const content = (() => {
      const referencesCount = notes
        .map(({ mentions }) => mentions.length)
        .reduce((count, num) => count + num, 0);

      const referrersCount = notes.length;

      if (this.numberType === ReferrersListNumberType.ReferencesCount) {
        return referencesCount;
      }

      if (this.numberType === ReferrersListNumberType.ReferrersCount) {
        return referrersCount;
      }

      if (this.numberType === ReferrersListNumberType.Both) {
        return `${referrersCount}(${referencesCount})`;
      }
    })();

    iconEl.innerHTML = `${content}${referenceIcon}`;

    return iconEl;
  }

  private createReferrerListElement(notes: Referrer[]) {
    const olEL = document.createElement('ol');
    olEL.classList.add(LIST_CLASS_NAME);

    for (const note of notes) {
      const mentionCount = note.mentions.length;
      olEL.innerHTML += `<li><a data-note-link-referrer-id="${note.id}">${
        note.title
      }</a><span title="${mentionCount} reference${
        mentionCount > 1 ? 's' : ''
      } from this note" class="${LIST_ITEM_COUNT_CLASS_NAME}">${mentionCount}</span></li>`;
    }

    return olEL;
  }
}
