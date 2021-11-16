import delegate from 'delegate';
import {
  MAIN_MARK_CLASS_NAME,
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

export const OVERFLOW_ANCHOR_NONE_CLASS_NAME = 'note-link-overflow-anchor-none';

export class NoteRouter {
  private recoveryIdTimer?: ReturnType<typeof setTimeout>;
  constructor(view: EventTarget) {
    delegate('[data-note-link-referrer-id]', 'click', this.handleLinkClick.bind(this));
    delegate(
      `.${MAIN_MARK_CLASS_NAME} [data-note-link-element-id] `,
      'click',
      this.handleMarkClick.bind(this),
      true,
    );
    view.addEventListener(MarkdownViewEvents.NewNoteOpen, () => this.scrollToReference());
  }

  private handleLinkClick(e: any) {
    const target = e.delegateTarget as HTMLElement;
    const noteId = target.dataset.noteLinkReferrerId;
    const referenceIndex = Number(target.dataset.noteLinkReferenceIndex);
    const toElementId = target.dataset.noteLinkToElementId;
    const isSelf = typeof target.dataset.isSelf === 'string';

    if (!noteId) {
      throw new Error('no noteId');
    }

    if (isSelf && referenceIndex) {
      this.scrollToReference({ toElementId, index: referenceIndex, toNoteId: noteId });
    } else {
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
  }

  private async scrollToReference(localReference?: Reference) {
    this.recoveryIdTimer && clearTimeout(this.recoveryIdTimer);

    const reference =
      localReference ||
      (await webviewApi.postMessage<Reference | undefined>(MARKDOWN_SCRIPT_ID, {
        event: 'queryFromReference',
      }));

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

    const originId = referenceEl.id;

    referenceEl.id = SCROLL_ANCHOR_ID;
    const containerEl = document.getElementById('joplin-container-content')!;
    containerEl.classList.add(OVERFLOW_ANCHOR_NONE_CLASS_NAME);
    await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'scrollToHash',
      payload: { hash: SCROLL_ANCHOR_ID },
    });

    this.recoveryIdTimer = setTimeout(() => {
      containerEl.classList.remove(OVERFLOW_ANCHOR_NONE_CLASS_NAME);
      if (originId) {
        referenceEl.id = originId;
      } else {
        referenceEl.removeAttribute('id');
      }
    }, 3000);
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
