import { MARKDOWN_SCRIPT_ID } from 'driver/constants';
import { Note } from 'model/Note';
import type { SearchReferrersRequest, SearchReferrersResponse, OpenNoteRequest } from '../type';
import { attach } from './attach';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: SearchReferrersRequest | OpenNoteRequest) => Promise<T>;
};

const ICON_CLASS_NAME = 'note-link-referrers-icon';
const LIST_CLASS_NAME = 'note-link-referrers-list';
const LIST_ITEM_CLASS_NAME = 'note-link-referrers-list-item';

export class ElementReferrerBuilder {
  init() {
    document.addEventListener('joplin-noteDidUpdate', this.attachReferrers.bind(this));
    document.addEventListener('click', (e) => {
      let target = e.target as HTMLElement;

      if (target.matches(` .${LIST_ITEM_CLASS_NAME} *`)) {
        while (!target.classList.contains(LIST_ITEM_CLASS_NAME)) {
          target = target.parentElement!;
        }
      }

      if (target.classList.contains(LIST_ITEM_CLASS_NAME)) {
        const noteId = target.dataset.noteLinkReferrerId;

        if (!noteId) {
          throw new Error('no noteId');
        }

        webviewApi.postMessage(MARKDOWN_SCRIPT_ID, { event: 'openNote', payload: { noteId } });
      }
    });

    this.attachReferrers();
  }

  private async attachReferrers() {
    const rootEl = document.getElementById('rendered-md')!;
    const els = [...rootEl.querySelectorAll('[id]')] as HTMLElement[];
    const ids = els.map((el) => el.id);
    const referrersMap = await webviewApi.postMessage<SearchReferrersResponse>(MARKDOWN_SCRIPT_ID, {
      event: 'searchReferrers',
      payload: { elementIds: ids },
    });

    for (const elId of Object.keys(referrersMap)) {
      const idEl = document.getElementById(elId)!;
      const referrers = referrersMap[elId];
      const [iconEl, listEl] = this.createReferrerElements(referrers);

      attach(idEl, iconEl, listEl);
    }
  }

  private createReferrerElements(notes: Note[]) {
    const iconEl = document.createElement('span');
    iconEl.classList.add(ICON_CLASS_NAME);
    iconEl.textContent = String(notes.length);

    const olEL = document.createElement('ol');
    olEL.classList.add(LIST_CLASS_NAME);

    for (const note of notes) {
      olEL.innerHTML += `<li class="${LIST_ITEM_CLASS_NAME}" data-note-link-referrer-id="${note.id}">${note.title}</li>`;
    }

    return [iconEl, olEL];
  }
}
