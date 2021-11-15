import delegate from 'delegate';
import type {
  OpenNoteRequest,
  WriteClipboardRequest,
  ScrollToHashRequest,
  QueryCurrentNoteRequest,
} from 'driver/constants';

declare const webviewApi: {
  postMessage: <T>(
    payload:
      | OpenNoteRequest
      | WriteClipboardRequest
      | ScrollToHashRequest
      | QueryCurrentNoteRequest,
  ) => Promise<T>;
};

delegate('[data-note-id]', 'click', (e: any) => {
  const target = e.delegateTarget as HTMLElement;
  const noteId = target.dataset.noteId;
  const referenceIndex = Number(target.dataset.referenceIndex);

  if (!noteId) {
    throw new Error('no noteId');
  }

  const reference = referenceIndex ? { index: referenceIndex } : undefined;
  webviewApi.postMessage({ event: 'openNote', payload: { noteId, reference } });
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

delegate(
  'mark > [data-note-link-element-id]',
  'click',
  async (e: any) => {
    e.stopPropagation();

    const target = e.delegateTarget as HTMLElement;
    const elId = target.dataset.noteLinkElementId;

    if (!elId) {
      throw new Error('no element id');
    }

    // todo: if elId is not existing in note...
    webviewApi.postMessage({ event: 'scrollToHash', payload: { hash: elId } });
  },
  true,
);
