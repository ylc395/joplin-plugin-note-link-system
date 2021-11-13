import debounce from 'lodash.debounce';
import { Referrer } from 'model/Referrer';
import {
  REFERRER_LIST_HEADING_SETTING,
  REFERRER_AUTO_LIST_POSITION_SETTING,
  MARKDOWN_SCRIPT_ID,
  REFERRER_AUTO_LIST_ENABLED_SETTING,
  QuerySettingRequest,
  SearchReferrersRequest,
  SearchNoteReferrersResponse,
} from 'driver/constants';
import { ReferrersAutoListPosition, ReferrersAutoListEnabled } from './constants';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: QuerySettingRequest | SearchReferrersRequest) => Promise<T>;
};

const REFERRER_LIST_HEADING_CLASS_NAME = 'note-link-referrers-list-heading';
const REFERRER_LIST_REFERENCE_COUNT_CLASS_NAME = 'note-link-referrers-list-count';

export class ReferrerListInserter {
  private listHeadingText?: string;
  private listPosition?: ReferrersAutoListPosition;
  private autoInsertionEnabled?: ReferrersAutoListEnabled;
  private referrers?: Referrer[];
  private refererHeadingEls?: HTMLElement[];

  async init() {
    this.autoInsertionEnabled = await webviewApi.postMessage<ReferrersAutoListEnabled>(
      MARKDOWN_SCRIPT_ID,
      {
        event: 'querySetting',
        payload: { key: REFERRER_AUTO_LIST_ENABLED_SETTING },
      },
    );

    this.listPosition = await webviewApi.postMessage<ReferrersAutoListPosition>(
      MARKDOWN_SCRIPT_ID,
      {
        event: 'querySetting',
        payload: { key: REFERRER_AUTO_LIST_POSITION_SETTING },
      },
    );

    this.listHeadingText = await webviewApi.postMessage<string>(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_LIST_HEADING_SETTING },
    });

    document.addEventListener('joplin-noteDidUpdate', debounce(this.insert.bind(this), 1500));
    this.insert();
  }

  private async insert() {
    if (typeof this.autoInsertionEnabled === 'undefined') {
      throw new Error('can not auto insert');
    }

    if (!this.listHeadingText) {
      return;
    }

    const rootEl = document.getElementById('rendered-md')!;
    const headingELs = [...rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')] as HTMLElement[];

    if (
      this.autoInsertionEnabled === ReferrersAutoListEnabled.Disabled &&
      headingELs.length === 0
    ) {
      return;
    }

    if (
      this.autoInsertionEnabled === ReferrersAutoListEnabled.EnabledWhenNoManual &&
      headingELs.length > 0
    ) {
      return;
    }

    this.refererHeadingEls = headingELs.filter((el) => el.innerText === this.listHeadingText);
    this.referrers = await webviewApi.postMessage<SearchNoteReferrersResponse>(MARKDOWN_SCRIPT_ID, {
      event: 'searchReferrers',
    });

    await this.prepareHeadings();
    await this.insertListAfterHeadings();
  }

  private async prepareHeadings() {
    if (
      typeof this.listHeadingText === 'undefined' ||
      typeof this.listPosition === 'undefined' ||
      !this.refererHeadingEls
    ) {
      throw new Error('can not auto insert');
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
  }

  private referrerToHtmlLink(note: Referrer) {
    return `<a data-note-link-referrer-id="${
      note.id
    }"><span class="resource-icon fa-joplin"></span>${note.title}</a><span title="${
      note.mentionCount
    } reference${
      note.mentionCount > 1 ? 's' : ''
    } from this note" class="${REFERRER_LIST_REFERENCE_COUNT_CLASS_NAME}">${
      note.mentionCount
    }</span>`;
  }
}
