import { ElementReferrerBuilder } from './ElementReferrerBuilder';
import { ReferrerListInserter } from './ReferrerListInserter';
import { MARKDOWN_SCRIPT_ID } from 'driver/constants';
import type { OpenNoteRequest } from '../type';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: OpenNoteRequest) => Promise<T>;
};

document.addEventListener('click', (e) => {
  let target: HTMLElement | null = e.target as HTMLElement;
  const selector = '[data-note-link-referrer-id]';

  if (target.matches(`${selector} *`)) {
    while (target && !target.matches(selector)) {
      target = target.parentElement!;
    }
  }

  if (target?.matches(selector)) {
    const noteId = target.dataset.noteLinkReferrerId;

    if (!noteId) {
      throw new Error('no noteId');
    }

    webviewApi.postMessage(MARKDOWN_SCRIPT_ID, { event: 'openNote', payload: { noteId } });
  }
});

new ElementReferrerBuilder().init();
new ReferrerListInserter().init();
