import { MARKDOWN_SCRIPT_ID } from 'driver/constants';
import { Note } from 'model/Note';
import type { SearchReferrersRequest, SearchReferrersResponse, OpenNoteRequest } from '../type';
import { attach } from './attach';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: SearchReferrersRequest | OpenNoteRequest) => Promise<T>;
};

const LIST_CONTAINER_CLASS_NAME = 'note-link-referrers-container';
const ICON_CLASS_NAME = 'note-link-referrers-icon';
const LIST_CLASS_NAME = 'note-link-referrers-list';
const LIST_ITEM_CLASS_NAME = 'note-link-referrers-list=item';

export class ElementReferrerBuilder {
  init() {
    document.addEventListener('joplin-noteDidUpdate', this.attachReferrers.bind(this));
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

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
      const el = document.getElementById(elId)!;
      const referrers = referrersMap[elId];
      const containerEl = this.createReferrerListContainer(referrers);

      attach(el, containerEl);
    }
  }

  private createReferrerListContainer(notes: Note[]) {
    function getListItemHtml() {
      let html = '';
      for (const note of notes) {
        html += `<li class="${LIST_ITEM_CLASS_NAME}" data-note-link-referrer-id="${note.id}">${note.title}</li>`;
      }
      return html;
    }

    const listContainer = document.createElement('div');
    listContainer.classList.add(LIST_CONTAINER_CLASS_NAME);

    listContainer.innerHTML = `
      <span class="${ICON_CLASS_NAME}">${notes.length}</span>
      <ol class="${LIST_CLASS_NAME}">
        ${getListItemHtml()}
      </ol>`;

    return listContainer;
  }
}
