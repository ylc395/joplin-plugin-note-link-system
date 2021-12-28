import delegate from 'delegate';
import debounce from 'lodash.debounce';
import hashIcon from 'bootstrap-icons/icons/hash.svg';
import type { Note } from 'model/Referrer';
import {
  MARKDOWN_SCRIPT_ID,
  WriteClipboardRequest,
  QueryCurrentNoteRequest,
  QuerySettingRequest,
  REFERRER_IDENTIFIER_ENABLED_SETTING,
} from 'driver/constants';
import {
  MarkdownViewEvents,
  ROOT_ELEMENT_ID,
  SCROLL_ANCHOR_ID,
  TODO_CHECKBOX_ID_PREFIX,
} from './constants';

const IDENTIFIER_CLASS_NAME = 'note-link-identifier';
const IDENTIFIER_PARENT_CLASS_NAME = 'note-link-identifier-parent';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: WriteClipboardRequest | QueryCurrentNoteRequest | QuerySettingRequest,
  ) => Promise<T>;
};

export class CopyAnchorBuilder {
  constructor(private readonly view: EventTarget) {}

  private currentNote?: Note;
  private enabled?: Boolean;
  private readonly ready = this.init();

  private async init() {
    delegate(
      `.${IDENTIFIER_CLASS_NAME}`,
      'click',
      (e: any) => {
        const target = e.delegateTarget as HTMLElement;
        this.copyUrl(target);
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );

    delegate(
      `.${IDENTIFIER_CLASS_NAME}`,
      'contextmenu',
      (e: any) => {
        const target = e.delegateTarget as HTMLElement;
        this.copyUrl(target, true);
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );

    delegate(`.${IDENTIFIER_CLASS_NAME}`, 'mouseover', this.handleMouseMove);
    delegate(`.${IDENTIFIER_CLASS_NAME}`, 'mouseout', this.handleMouseMove);

    const attach = debounce(this.attach.bind(this), 500);
    this.view.addEventListener(MarkdownViewEvents.NoteDidUpdate, attach);
    this.view.addEventListener(MarkdownViewEvents.NoteDidUpdate, (({
      detail: note,
    }: CustomEvent<Note>) => {
      this.currentNote = note;
    }) as EventListener);

    this.enabled = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_IDENTIFIER_ENABLED_SETTING },
    });

    if (!this.enabled) {
      this.view.removeEventListener(MarkdownViewEvents.NoteDidUpdate, attach);
    }
  }

  private async copyUrl(identifier: HTMLElement, urlOnly = false) {
    if (!this.currentNote) {
      throw new Error('no currentNote');
    }

    const { id, title } = this.currentNote;

    const elId = identifier.dataset.noteLinkElementId;

    webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'writeClipboard',
      payload: { content: urlOnly ? `:/${id}#${elId}` : `[${title}#${elId}](:/${id}#${elId})` },
    });
  }

  private async attach() {
    await this.ready;

    if (!this.enabled) {
      return;
    }

    const rootEl = document.getElementById(ROOT_ELEMENT_ID)!;
    const elsWithId = [...rootEl.querySelectorAll('[id]')];

    for (const el of elsWithId) {
      if (!el.id || el.id === SCROLL_ANCHOR_ID || el.id.startsWith(TODO_CHECKBOX_ID_PREFIX)) {
        continue;
      }

      const identifierEl = document.createElement('button');
      identifierEl.classList.add(IDENTIFIER_CLASS_NAME);
      identifierEl.dataset.noteLinkElementId = el.id;
      identifierEl.innerHTML = hashIcon;
      identifierEl.title = el.id;

      el.prepend(identifierEl);
    }
  }

  private handleMouseMove(e: any) {
    const target = (e.delegateTarget as HTMLElement).parentElement;

    if (!target) {
      return;
    }

    target.classList.toggle(IDENTIFIER_PARENT_CLASS_NAME);
  }
}
