import delegate from 'delegate';
import {
  MARKDOWN_SCRIPT_ID,
  OpenNoteRequest,
  QueryFromReferenceRequest,
  ScrollToHashRequest,
} from 'driver/constants';
import { Reference } from 'model/Referrer';
import { MarkdownViewEvents } from './constants';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: OpenNoteRequest | QueryFromReferenceRequest | ScrollToHashRequest,
  ) => Promise<T>;
};

const SCROLL_ANCHOR_ID = 'note-link-scroll-anchor';

export class NoteRouter {
  constructor(view: EventTarget) {
    delegate('[data-note-link-referrer-id]', 'click', this.handleLinkClick);
    view.addEventListener(MarkdownViewEvents.NoteDidUpdate, () => {});
    view.addEventListener(MarkdownViewEvents.NewNoteOpen, this.focusOnReference.bind(this));
  }

  private handleLinkClick(e: any) {
    const target = e.delegateTarget as HTMLElement;
    const noteId = target.dataset.noteLinkReferrerId;

    if (!noteId) {
      throw new Error('no noteId');
    }

    webviewApi.postMessage(MARKDOWN_SCRIPT_ID, { event: 'openNote', payload: { noteId } });
  }

  private async focusOnReference() {
    const reference = await webviewApi.postMessage<Reference | undefined>(MARKDOWN_SCRIPT_ID, {
      event: 'queryFromReference',
    });

    if (!reference) {
      return;
    }

    const { index, toElementId, toNoteId } = reference;
    const url = toElementId ? `${toNoteId}#${toElementId}` : toNoteId;

    if (!url) {
      throw new Error('no url when locating reference');
    }

    const referenceEls = (
      [...document.querySelectorAll('a[data-from-md][data-resource-id][onclick]')] as HTMLElement[]
    ).filter((el) => el.onclick?.toString().includes(url));

    const referenceEl = referenceEls[index - 1];

    if (!referenceEl) {
      throw new Error('can not find referenceEl');
    }

    referenceEls[index - 1].id = SCROLL_ANCHOR_ID;
    await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'scrollToHash',
      payload: { hash: SCROLL_ANCHOR_ID },
    });
  }
}
