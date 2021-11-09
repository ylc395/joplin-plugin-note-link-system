import {
  REFERRER_LIST_HEADING_SETTING,
  REFERRER_AUTO_LIST_SETTING,
  ReferrersAutoListPosition,
  MARKDOWN_SCRIPT_ID,
} from 'driver/constants';
import { Note } from 'model/Note';
import type {
  QuerySettingRequest,
  SearchReferrersRequest,
  SearchNoteReferrersResponse,
} from '../type';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: QuerySettingRequest | SearchReferrersRequest) => Promise<T>;
};

export class ReferrerListInserter {
  private listHeading?: string;
  private autoListPosition?: ReferrersAutoListPosition;
  private referrers?: Note[];

  init() {
    document.addEventListener('joplin-noteDidUpdate', this.insert.bind(this));
    this.insert();
  }

  private async insert() {
    if (typeof this.autoListPosition === 'undefined') {
      this.autoListPosition = await webviewApi.postMessage<ReferrersAutoListPosition>(
        MARKDOWN_SCRIPT_ID,
        {
          event: 'querySetting',
          payload: { key: REFERRER_AUTO_LIST_SETTING },
        },
      );
    }

    if (typeof this.listHeading === 'undefined') {
      this.listHeading = await webviewApi.postMessage<string>(MARKDOWN_SCRIPT_ID, {
        event: 'querySetting',
        payload: { key: REFERRER_LIST_HEADING_SETTING },
      });
    }

    this.referrers = await webviewApi.postMessage<SearchNoteReferrersResponse>(MARKDOWN_SCRIPT_ID, {
      event: 'searchReferrers',
    });

    const hasInserted = await this.insertListAfterHeadings();

    if (!hasInserted) {
      await this.insertAutoList();
    }
  }

  private async insertAutoList() {
    if (
      typeof this.listHeading === 'undefined' ||
      typeof this.autoListPosition === 'undefined' ||
      !this.referrers
    ) {
      throw new Error('can not auto insert');
    }

    if (this.autoListPosition === ReferrersAutoListPosition.None) {
      return;
    }

    const rootEl = document.getElementById('rendered-md')!;
    const headingELs = [...rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')] as HTMLElement[];
    const minLevel = Math.max(1, Math.min(...headingELs.map((el) => Number(el.tagName[1]))));
    const headingEl = document.createElement(`h${minLevel}`);
    headingEl.innerText = this.listHeading;

    const listEl = document.createElement('ol');

    for (const note of this.referrers) {
      listEl.innerHTML += `<li>${note.title}</li>`;
    }

    rootEl.insertAdjacentElement(
      this.autoListPosition === ReferrersAutoListPosition.NoteStart ? 'afterbegin' : 'beforeend',
      headingEl,
    );

    headingEl.insertAdjacentElement('afterend', listEl);
  }

  private async insertListAfterHeadings(): Promise<boolean> {
    if (!this.referrers || typeof this.listHeading === 'undefined') {
      throw new Error('can not insert list');
    }

    if (!this.listHeading || this.referrers.length === 0) {
      return false;
    }

    const rootEl = document.getElementById('rendered-md')!;
    const headingELs = [...rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')] as HTMLElement[];
    let inserted = false;

    for (const el of headingELs) {
      if (el.innerText !== this.listHeading) {
        continue;
      }

      inserted = true;
      const listEl = document.createElement('ol');

      for (const note of this.referrers) {
        listEl.innerHTML += `<li>${note.title}</li>`;
      }

      el.insertAdjacentElement('afterend', listEl);
    }

    return inserted;
  }
}
