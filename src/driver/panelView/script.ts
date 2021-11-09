import delegate from 'delegate';
import type { OpenNoteRequest, WriteClipboardRequest } from 'driver/constants';

declare const webviewApi: {
  postMessage: <T>(payload: OpenNoteRequest | WriteClipboardRequest) => Promise<T>;
};

delegate('[data-note-id]', 'click', (e: any) => {
  const target = e.delegateTarget as HTMLElement;
  const noteId = target.dataset.noteId;

  if (!noteId) {
    throw new Error('no noteId');
  }

  webviewApi.postMessage({ event: 'openNote', payload: { noteId } });
});

delegate('[data-note-id]', 'contextmenu', (e: any) => {
  const target = e.delegateTarget as HTMLElement;
  const noteId = target.dataset.noteId;

  if (!noteId) {
    throw new Error('no noteId');
  }

  const copyContent = `[${target.innerText}](:/${noteId})`;
  const titleEl = document.querySelector('h1')!;
  const tip = 'Copy Successfully!';
  const title = titleEl.innerText;

  titleEl.innerText = tip;

  webviewApi.postMessage({ event: 'writeClipboard', payload: { content: copyContent } });

  if (title !== tip) {
    setTimeout(() => {
      titleEl.innerText = title;
    }, 1000);
  }
});
