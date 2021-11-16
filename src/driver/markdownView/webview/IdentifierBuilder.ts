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
import { MarkdownViewEvents, ROOT_ELEMENT_ID, SCROLL_ANCHOR_ID } from './constants';

const IDENTIFIER_CLASS_NAME = 'note-link-identifier';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: WriteClipboardRequest | QueryCurrentNoteRequest | QuerySettingRequest,
  ) => Promise<T>;
};

export class IdentifierBuilder {
  constructor(private readonly view: EventTarget) {
    this.ready = this.init();
  }

  private currentNote?: Note;
  ready?: Promise<void>;

  private async init() {
    const enabled = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_IDENTIFIER_ENABLED_SETTING },
    });

    if (!enabled) {
      return;
    }

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

    this.view.addEventListener(
      MarkdownViewEvents.NoteDidUpdate,
      debounce(this.attach.bind(this), 500),
    );
    this.view.addEventListener(MarkdownViewEvents.NoteDidUpdate, (({
      detail: note,
    }: CustomEvent<Note>) => {
      this.currentNote = note;
    }) as EventListener);
  }

  private async copyUrl(identifier: HTMLElement) {
    if (!this.currentNote) {
      throw new Error('no currentNote');
    }

    const { id, title } = this.currentNote;

    const elId = identifier.dataset.noteLinkElementId;

    webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'writeClipboard',
      payload: { content: `[${title}#${elId}](:/${id}#${elId})` },
    });
  }

  private attach() {
    const rootEl = document.getElementById(ROOT_ELEMENT_ID)!;
    const elsWithId = [...rootEl.querySelectorAll('[id]')];

    for (const el of elsWithId) {
      if (!el.id || el.id === SCROLL_ANCHOR_ID) {
        continue;
      }

      const identifierEl = document.createElement('button');
      identifierEl.classList.add(IDENTIFIER_CLASS_NAME);
      identifierEl.dataset.noteLinkElementId = el.id;
      identifierEl.innerHTML = hashIcon;

      el.prepend(identifierEl);
    }
  }
}
