import tippy, { roundArrow } from 'tippy.js';
import 'tippy.js/dist/svg-arrow.css';
import { Referrer } from 'model/Referrer';
import {
  REFERRER_LIST_HEADING_SETTING,
  REFERRER_AUTO_LIST_POSITION_SETTING,
  MARKDOWN_SCRIPT_ID,
  REFERRER_AUTO_LIST_ENABLED_SETTING,
  ReferrersAutoListPosition,
  ReferrersAutoListEnabled,
  QuerySettingRequest,
  SearchReferrersRequest,
  SearchNoteReferrersResponse,
} from 'driver/constants';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: QuerySettingRequest | SearchReferrersRequest) => Promise<T>;
};

const REFERRER_LIST_HEADING_CLASS_NAME = 'note-link-referrers-list-heading';
const REFERRER_LIST_REFERENCE_COUNT_CLASS_NAME = 'note-link-referrers-list-count';
const REFERRER_LIST_REFERENCE_TIP_CLASS_NAME = 'note-link-referrers-list-tip';

export class ReferrerListInserter {
  private listHeadingText?: string;
  private listPosition?: ReferrersAutoListPosition;
  private autoInsertionEnabled?: ReferrersAutoListEnabled;
  private referrers?: Referrer[];
  private refererHeadingEls?: HTMLElement[];

  init() {
    document.addEventListener('joplin-noteDidUpdate', this.insert.bind(this));
    this.insert();
  }

  private async fetchSetting() {
    if (typeof this.autoInsertionEnabled === 'undefined') {
      this.autoInsertionEnabled = await webviewApi.postMessage<ReferrersAutoListEnabled>(
        MARKDOWN_SCRIPT_ID,
        {
          event: 'querySetting',
          payload: { key: REFERRER_AUTO_LIST_ENABLED_SETTING },
        },
      );
    }

    if (typeof this.listPosition === 'undefined') {
      this.listPosition = await webviewApi.postMessage<ReferrersAutoListPosition>(
        MARKDOWN_SCRIPT_ID,
        {
          event: 'querySetting',
          payload: { key: REFERRER_AUTO_LIST_POSITION_SETTING },
        },
      );
    }

    if (typeof this.listHeadingText === 'undefined') {
      this.listHeadingText = await webviewApi.postMessage<string>(MARKDOWN_SCRIPT_ID, {
        event: 'querySetting',
        payload: { key: REFERRER_LIST_HEADING_SETTING },
      });
    }
  }

  private async insert() {
    await this.fetchSetting();

    if (!this.listHeadingText) {
      return;
    }

    this.referrers = await webviewApi.postMessage<SearchNoteReferrersResponse>(MARKDOWN_SCRIPT_ID, {
      event: 'searchReferrers',
    });

    const rootEl = document.getElementById('rendered-md')!;
    const headingELs = [...rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')] as HTMLElement[];

    this.refererHeadingEls = headingELs.filter((el) => el.innerText === this.listHeadingText);

    await this.prepareHeadings();
    await this.insertListAfterHeadings();
  }

  private async prepareHeadings() {
    if (
      typeof this.listHeadingText === 'undefined' ||
      typeof this.autoInsertionEnabled === 'undefined' ||
      typeof this.listPosition === 'undefined' ||
      !this.refererHeadingEls ||
      !this.referrers
    ) {
      throw new Error('can not auto insert');
    }

    if (this.autoInsertionEnabled === ReferrersAutoListEnabled.Disabled) {
      return;
    }

    if (
      this.refererHeadingEls.length > 0 &&
      this.autoInsertionEnabled === ReferrersAutoListEnabled.EnabledWhenNoManual
    ) {
      return;
    }

    const rootEl = document.getElementById('rendered-md')!;
    const headingELs = [...rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')] as HTMLElement[];
    const minLevel = Math.min(6, Math.min(...headingELs.map((el) => Number(el.tagName[1]))));
    const headingEl = document.createElement(`h${minLevel}`);
    headingEl.innerText = this.listHeadingText;

    this.refererHeadingEls.push(headingEl);
    rootEl.insertAdjacentElement(
      this.listPosition === ReferrersAutoListPosition.Top ? 'afterbegin' : 'beforeend',
      headingEl,
    );
  }

  private async insertListAfterHeadings() {
    if (!this.referrers || !this.refererHeadingEls) {
      throw new Error('can not insert list');
    }

    const listHtml = this.referrers
      .map((note) => `<li>${this.referrerToHtmlLink(note)}</li>`)
      .join('');

    for (const headingEl of this.refererHeadingEls) {
      const listEl = listHtml ? document.createElement('ol') : document.createElement('p');

      listEl.innerHTML = listHtml || '<p>No referrers.</p>';
      headingEl.classList.add(REFERRER_LIST_HEADING_CLASS_NAME);
      headingEl.insertAdjacentElement('afterend', listEl);
    }

    tippy(`.${REFERRER_LIST_REFERENCE_COUNT_CLASS_NAME}`, {
      content: (el) =>
        `<p class="${REFERRER_LIST_REFERENCE_TIP_CLASS_NAME}">${
          (el as HTMLElement).dataset.tip || ''
        }</p>`,
      allowHTML: true,
      arrow: roundArrow,
    });
  }

  private referrerToHtmlLink(note: Referrer) {
    return `<a data-note-link-referrer-id="${
      note.id
    }"><span class="resource-icon fa-joplin"></span>${note.title}</a><span data-tip="${
      note.mentionCount
    } reference${
      note.mentionCount > 1 ? 's' : ''
    } from this note" class="${REFERRER_LIST_REFERENCE_COUNT_CLASS_NAME}">${
      note.mentionCount
    }</span>`;
  }
}
