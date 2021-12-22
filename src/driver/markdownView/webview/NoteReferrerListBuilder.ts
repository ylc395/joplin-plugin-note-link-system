import debounce from 'lodash.debounce';
import template from 'lodash.template';
import { Referrer } from 'model/Referrer';
import {
  REFERRER_LIST_HEADING_SETTING,
  REFERRER_AUTO_LIST_POSITION_SETTING,
  MARKDOWN_SCRIPT_ID,
  REFERRER_AUTO_LIST_ENABLED_SETTING,
  REFERRER_LIST_MENTION_TEXT_MAX_LENGTH,
  QuerySettingRequest,
  SearchReferrersRequest,
  SearchNoteReferrersResponse,
} from 'driver/constants';
import { truncateMention } from 'driver/utils';
import {
  ReferrersAutoListPosition,
  ReferrersAutoListEnabled,
  ReferenceListExpandMode,
  MarkdownViewEvents,
  ROOT_ELEMENT_ID,
  REFERRER_TITLE_CONTAINER_CLASS_NAME,
  REFERRER_TITLE_CLASS_NAME,
  REFERENCE_CLASS_NAME,
  REFERENCE_ITEM_CLASS_NAME,
} from './constants';
import type { MarkdownView } from './index';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: QuerySettingRequest | SearchReferrersRequest) => Promise<T>;
};

const REFERRER_LIST_HEADING_CLASS_NAME = 'note-link-referrers-list-heading';
const REFERRER_LIST_REFERENCE_COUNT_CLASS_NAME = 'note-link-referrers-list-count';

export class NoteReferrerListBuilder {
  constructor(private readonly view: MarkdownView) {}
  private listHeadingText?: string;
  private listPosition?: ReferrersAutoListPosition;
  private autoInsertionEnabled?: ReferrersAutoListEnabled;
  private referrers?: Referrer[];
  private readonly ready = this.init();
  private maxTextLength?: number;
  private listHeadingEls?: HTMLElement[];

  private async init() {
    this.view.addEventListener(MarkdownViewEvents.NewNoteOpen, () => (this.referrers = undefined));
    this.view.addEventListener(
      MarkdownViewEvents.NoteDidUpdate,
      debounce(this.insert.bind(this), 500),
    );

    this.autoInsertionEnabled = await webviewApi.postMessage<ReferrersAutoListEnabled>(
      MARKDOWN_SCRIPT_ID,
      {
        event: 'querySetting',
        payload: { key: REFERRER_AUTO_LIST_ENABLED_SETTING },
      },
    );

    this.maxTextLength = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_LIST_MENTION_TEXT_MAX_LENGTH },
    });

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
  }

  private async insert() {
    await this.ready;

    if (
      typeof this.autoInsertionEnabled === 'undefined' ||
      typeof this.listHeadingText === 'undefined'
    ) {
      throw new Error('can not auto insert');
    }

    if (!this.listHeadingText) {
      return;
    }

    const rootEl = document.getElementById(ROOT_ELEMENT_ID)!;
    const allHeadingEls = [...rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')] as HTMLElement[];

    if (
      allHeadingEls.length === 0 &&
      this.autoInsertionEnabled === ReferrersAutoListEnabled.Disabled
    ) {
      return;
    }

    this.listHeadingEls = allHeadingEls.filter((el) => el.innerText === this.listHeadingText);

    if (!this.referrers) {
      this.referrers = await webviewApi.postMessage<SearchNoteReferrersResponse>(
        MARKDOWN_SCRIPT_ID,
        {
          event: 'searchReferrers',
        },
      );
    }

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
      this.autoInsertionEnabled === ReferrersAutoListEnabled.Disabled ||
      (this.autoInsertionEnabled === ReferrersAutoListEnabled.EnabledWhenNoManual &&
        this.listHeadingEls.length > 0)
    ) {
      return;
    }

    const rootEl = document.getElementById(ROOT_ELEMENT_ID)!;
    const allHeadingELs = [...rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')] as HTMLElement[];
    const minLevel = Math.min(...allHeadingELs.map((el) => Number(el.tagName[1])));
    const headingEl = document.createElement(`h${Number.isFinite(minLevel) ? minLevel : 1}`);

    headingEl.innerText = this.listHeadingText;
    this.listHeadingEls.push(headingEl);
    rootEl.insertAdjacentElement(
      this.listPosition === ReferrersAutoListPosition.Top ? 'afterbegin' : 'beforeend',
      headingEl,
    );
  }

  private async insertListAfterHeadings() {
    if (!this.referrers || !this.listHeadingEls || typeof this.view.expandMode === 'undefined') {
      throw new Error('can not insert list');
    }

    const hasReferrers = this.referrers.length > 0;
    const listHtml = NoteReferrerListBuilder.renderList({
      currentNoteId: this.view.currentNoteId,
      notes: this.referrers,
      truncateMention,
      textLength: this.maxTextLength,
      expand: [
        ReferenceListExpandMode.ExpandBoth,
        ReferenceListExpandMode.ExpandNoteListOnly,
      ].includes(this.view.expandMode),
    });

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
        <% if (textLength) { %>
        <details<%= expand ? ' open' : '' %>>
          <summary class="${REFERRER_TITLE_CONTAINER_CLASS_NAME}">
        <% } %>
            <a 
              data-note-link-referrer-id="<%= note.id %>"
              <%= currentNoteId === note.id ? 'data-is-self' : '' %>
              class="${REFERRER_TITLE_CLASS_NAME}"
            >
              <span class="resource-icon fa-joplin"></span>
              <%= note.title  %>
            </a>
            <span
              title="<%= note.mentions.length %> reference<%= note.mentions.length > 1 ? 's' : '' %> from this note"
              class="${REFERRER_LIST_REFERENCE_COUNT_CLASS_NAME}"
            >
              <%= note.mentions.length %>
            </span>
        <% if (textLength) { %>
          </summary>
          <ol>
            <% for (const [index, mention] of note.mentions.entries()) { %>
              <li class="${REFERENCE_ITEM_CLASS_NAME}">
                <a
                  class="${REFERENCE_CLASS_NAME}"
                  data-note-link-referrer-id="<%= note.id %>"
                  data-note-link-reference-index="<%= index + 1 %>"
                  <%= currentNoteId === note.id ? 'data-is-self' : '' %>
                >
                    <%= truncateMention(mention, textLength) %>
                </a>
              </li>
            <% } %>
          </ol>
        </details>
        <% } %>
      </li>
    <% } %>
  `);
}
