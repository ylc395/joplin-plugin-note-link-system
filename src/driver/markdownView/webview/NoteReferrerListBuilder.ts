import debounce from 'lodash.debounce';
import template from 'lodash.template';
import { Referrer } from 'model/Referrer';
import {
  REFERRER_LIST_HEADING_SETTING,
  REFERRER_AUTO_LIST_POSITION_SETTING,
  MARKDOWN_SCRIPT_ID,
  REFERRER_LIST_MENTION_TEXT_MAX_LENGTH,
  QuerySettingRequest,
  SearchReferrersRequest,
  SearchNoteReferrersResponse,
} from 'driver/constants';
import {
  ReferrersAutoListPosition,
  ReferenceListExpandMode,
  MarkdownViewEvents,
  ROOT_ELEMENT_ID,
  REFERRER_TITLE_CONTAINER_CLASS_NAME,
  REFERRER_TITLE_CLASS_NAME,
  REFERENCE_CLASS_NAME,
  REFERENCE_ITEM_CLASS_NAME,
} from './constants';
import listTemplate from './templates/noteReferrerList.ejs';
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
  private referrers?: Referrer[];
  private readonly ready = this.init();
  private maxTextLength?: number;

  private async init() {
    this.view.on(MarkdownViewEvents.NewNoteOpen, () => (this.referrers = undefined));
    this.view.on(MarkdownViewEvents.NoteDidUpdate, debounce(this.insert.bind(this), 500));

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

    if (typeof this.listPosition === 'undefined' || typeof this.listHeadingText === 'undefined') {
      throw new Error('can not auto insert');
    }

    const listHeadingEls = this.prepareHeadings();

    if (listHeadingEls.length === 0) {
      return;
    }

    if (!this.referrers) {
      this.referrers = await webviewApi.postMessage<SearchNoteReferrersResponse>(
        MARKDOWN_SCRIPT_ID,
        {
          event: 'searchReferrers',
          payload: { type: 'note' },
        },
      );
    }

    this.insertListAfterHeadings(listHeadingEls);
  }

  private prepareHeadings() {
    if (typeof this.listHeadingText === 'undefined' || typeof this.listPosition === 'undefined') {
      throw new Error('can not auto insert');
    }

    if (!this.listHeadingText) {
      return [];
    }

    const rootEl = document.getElementById(ROOT_ELEMENT_ID)!;
    const allHeadingELs = [...rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')] as HTMLElement[];
    const listHeadingEls = allHeadingELs.filter((el) => el.innerText === this.listHeadingText);

    if (listHeadingEls.length === 0 && this.listPosition !== ReferrersAutoListPosition.None) {
      const minLevel = Math.min(...allHeadingELs.map((el) => Number(el.tagName[1])));
      const headingEl = document.createElement(`h${Number.isFinite(minLevel) ? minLevel : 1}`);

      headingEl.innerText = this.listHeadingText;
      listHeadingEls.push(headingEl);
      rootEl.insertAdjacentElement(
        this.listPosition === ReferrersAutoListPosition.Top ? 'afterbegin' : 'beforeend',
        headingEl,
      );
    }

    return listHeadingEls;
  }

  private async insertListAfterHeadings(listHeadingEls: HTMLElement[]) {
    if (!this.referrers || typeof this.view.expandMode === 'undefined') {
      throw new Error('can not insert list');
    }

    const hasReferrers = this.referrers.length > 0;
    const listHtml = NoteReferrerListBuilder.renderList({
      currentNoteId: this.view.currentNoteId,
      notes: this.referrers,
      textLength: this.maxTextLength,
      expand: [
        ReferenceListExpandMode.ExpandBoth,
        ReferenceListExpandMode.ExpandNoteListOnly,
      ].includes(this.view.expandMode),
      REFERRER_TITLE_CONTAINER_CLASS_NAME,
      REFERRER_TITLE_CLASS_NAME,
      REFERENCE_CLASS_NAME,
      REFERENCE_ITEM_CLASS_NAME,
      REFERRER_LIST_REFERENCE_COUNT_CLASS_NAME,
    });

    for (const headingEl of listHeadingEls) {
      const sectionEl = hasReferrers ? document.createElement('ol') : document.createElement('p');

      sectionEl.innerHTML = hasReferrers ? listHtml : '<p>No referrers.</p>';
      headingEl.classList.add(REFERRER_LIST_HEADING_CLASS_NAME);
      headingEl.insertAdjacentElement('afterend', sectionEl);
    }
  }

  private static renderList = template(listTemplate);
}
