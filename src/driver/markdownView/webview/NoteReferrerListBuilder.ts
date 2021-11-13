import debounce from 'lodash.debounce';
import template from 'lodash.template';
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

export class NoteReferrerListBuilder {
  private listHeadingText?: string;
  private listPosition?: ReferrersAutoListPosition;
  private autoInsertionEnabled?: ReferrersAutoListEnabled;
  private referrers?: Referrer[];
  private listHeadingEls?: HTMLElement[];

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
    const allHeadingEls = [...rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')] as HTMLElement[];

    if (
      this.autoInsertionEnabled === ReferrersAutoListEnabled.Disabled &&
      allHeadingEls.length === 0
    ) {
      return;
    }

    this.listHeadingEls = allHeadingEls.filter((el) => el.innerText === this.listHeadingText);
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
      !this.listHeadingEls
    ) {
      throw new Error('can not auto insert');
    }

    if (
      this.autoInsertionEnabled === ReferrersAutoListEnabled.EnabledWhenNoManual &&
      this.listHeadingEls.length > 0
    ) {
      return;
    }

    const rootEl = document.getElementById('rendered-md')!;
    const allHeadingELs = [...rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')] as HTMLElement[];
    const minLevel = Math.min(6, Math.min(...allHeadingELs.map((el) => Number(el.tagName[1]))));
    const headingEl = document.createElement(`h${minLevel}`);

    headingEl.innerText = this.listHeadingText;
    this.listHeadingEls.push(headingEl);
    rootEl.insertAdjacentElement(
      this.listPosition === ReferrersAutoListPosition.Top ? 'afterbegin' : 'beforeend',
      headingEl,
    );
  }

  private async insertListAfterHeadings() {
    if (!this.referrers || !this.listHeadingEls) {
      throw new Error('can not insert list');
    }

    const hasReferrers = this.referrers.length > 0;
    const listHtml = NoteReferrerListBuilder.renderList({ notes: this.referrers });

    for (const headingEl of this.listHeadingEls) {
      const sectionEl = hasReferrers ? document.createElement('ol') : document.createElement('p');

      sectionEl.innerHTML = hasReferrers ? listHtml : '<p>No referrers.</p>';
      headingEl.classList.add(REFERRER_LIST_HEADING_CLASS_NAME);
      headingEl.insertAdjacentElement('afterend', sectionEl);
    }
  }

  private static renderList = template(`
    <% for (const note of notes) { %>
      <li>
        <a data-note-link-referrer-id="<%= note.id %>">
          <span class="resource-icon fa-joplin"></span>
          <%= note.title  %>
        </a>
        <span
          title="<%= note.mentions.length %> reference<%= note.mentions.length > 1 ? 's' : '' %> from this note"
          class="${REFERRER_LIST_REFERENCE_COUNT_CLASS_NAME}"><%= note.mentions.length %></span>
      </li>
    <% } %>
  `);
}
