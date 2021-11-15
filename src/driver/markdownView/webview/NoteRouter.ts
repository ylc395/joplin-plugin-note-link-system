import delegate from 'delegate';
import {
  MARKDOWN_SCRIPT_ID,
  OpenNoteRequest,
  QueryFromReferenceRequest,
  ScrollToHashRequest,
} from 'driver/constants';
import { Reference } from 'model/Referrer';
import { MarkdownViewEvents, SCROLL_ANCHOR_ID } from './constants';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: OpenNoteRequest | QueryFromReferenceRequest | ScrollToHashRequest,
  ) => Promise<T>;
};

export class NoteRouter {
  constructor(view: EventTarget) {
    delegate('[data-note-link-referrer-id]', 'click', this.handleLinkClick);
    delegate(
      '.note-link-mark > [data-note-link-element-id] ',
      'click',
      this.handleMarkClick.bind(this),
      true,
    );
    view.addEventListener(MarkdownViewEvents.NoteDidUpdate, () => {});
    view.addEventListener(MarkdownViewEvents.NewNoteOpen, this.focusOnReference.bind(this));
  }

  private handleLinkClick(e: any) {
    const target = e.delegateTarget as HTMLElement;
    const noteId = target.dataset.noteLinkReferrerId;
    const referenceIndex = Number(target.dataset.noteLinkReferenceIndex);
    const toElementId = target.dataset.noteLinkToElementId;

    if (!noteId) {
      throw new Error('no noteId');
    }

    webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'openNote',
      payload: {
        noteId,
        reference: referenceIndex
          ? {
              index: referenceIndex,
              toElementId,
            }
          : undefined,
      },
    });
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

  private handleMarkClick(e: any) {
    e.stopPropagation();

    const target = e.delegateTarget as HTMLElement;
    const elId = target.dataset.noteLinkElementId;

    if (!elId) {
      throw new Error('no element id');
    }

    if (!document.getElementById(elId)) {
      alert(`No such id in current note: ${elId}`);
      return;
    }

    webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'scrollToHash',
      payload: { hash: elId },
    });
  }
}
