import tippy, { roundArrow } from 'tippy.js';
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
  ReferrersListNumberType,
  REFERRER_ELEMENT_NUMBER_TYPE,
} from 'driver/constants';

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

    // this event will be triggered twice within 1s. debounce function will cause an ignorable delay
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
    const content = (() => {
      const referencesCount = notes
        .map(({ mentionCount }) => mentionCount)
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
    const olEL = document.createElement('ol');
    olEL.classList.add(LIST_CLASS_NAME);

    for (const note of notes) {
      olEL.innerHTML += `<li><a data-note-link-referrer-id="${note.id}">${
        note.title
      }</a><span title="${note.mentionCount} reference${
        note.mentionCount > 1 ? 's' : ''
      } from this note" class="${LIST_ITEM_COUNT_CLASS_NAME}">${note.mentionCount}</span></li>`;
    }

    return [iconEl, olEL];
  }
}
