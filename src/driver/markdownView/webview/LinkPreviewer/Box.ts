import EventEmitter from 'eventemitter3';
import pinAngleIcon from 'bootstrap-icons/icons/pin-angle.svg';
import xIcon from 'bootstrap-icons/icons/x.svg';
import type { Note } from 'model/Referrer';
import {
  FetchNoteHtmlRequest,
  MARKDOWN_SCRIPT_ID,
  QuerySettingRequest,
  QueryNoteRequest,
  QueryNoteResourcesRequest,
} from 'driver/constants';
import { processNoteContent, ResourcesMap } from './utils';

const PREVIEWER_CLASS = 'note-link-previewer';
const PREVIEWER_PIN_BUTTON_CLASS = 'note-link-previewer-pin-button';

const LOCAL_PREVIEWER_CLASS = 'note-link-previewer-local';
const LOCAL_PREVIEWER_TITLE_CLASS = 'note-link-previewer-local-title';
const LOCAL_PREVIEWER_BODY_CLASS = 'note-link-previewer-local-body';

const REMOTE_PREVIEWER_CLASS = 'note-link-previewer-remote';
const REMOTE_PREVIEWER_TITLE_CLASS = 'note-link-previewer-remote-title';
const REMOTE_PREVIEWER_BODY_CLASS = 'note-link-previewer-remote-body';
const REMOTE_PREVIEWER_EMPTY_BODY_CLASS = 'note-link-previewer-remote-empty-body';

export enum BoxEvents {
  Pinned = 'PINNED',
  Unpinned = 'UNPINNED',
}

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload:
      | FetchNoteHtmlRequest
      | QuerySettingRequest
      | QueryNoteRequest
      | QueryNoteResourcesRequest,
  ) => Promise<T>;
};

export abstract class Box extends EventEmitter<BoxEvents> {
  readonly containerEl = document.createElement('div');
  protected readonly titleEl = document.createElement('div');
  protected abstract readonly bodyEl: HTMLElement;
  protected init() {
    this.containerEl.classList.add(PREVIEWER_CLASS);
    this.containerEl.append(this.titleEl, this.bodyEl);
  }

  private isPinned = false;

  protected initTitle() {
    const pinButtonEL = document.createElement('button');
    pinButtonEL.classList.add(PREVIEWER_PIN_BUTTON_CLASS);
    pinButtonEL.innerHTML = pinAngleIcon;
    pinButtonEL.addEventListener('click', () => {
      if (this.isPinned) {
        this.isPinned = false;
        this.emit(BoxEvents.Unpinned);
      } else {
        this.isPinned = true;
        this.emit(BoxEvents.Pinned);
        pinButtonEL.innerHTML = xIcon;
      }
    });
    this.titleEl.appendChild(pinButtonEL);
  }

  protected abstract initBody(): void;
}

export class LocalBox extends Box {
  protected readonly bodyEl = document.createElement('article');
  constructor(readonly url: { noteId: string; elementId?: string }) {
    super();
    this.init();
  }

  protected async init() {
    this.containerEl.classList.add(LOCAL_PREVIEWER_CLASS);
    this.initBody();
    this.initTitle();
    super.init();
  }

  protected async initBody() {
    const { noteId } = this.url;

    const resources = await webviewApi.postMessage<ResourcesMap>(MARKDOWN_SCRIPT_ID, {
      event: 'queryNoteResources',
      payload: { noteId },
    });

    const noteContent = processNoteContent(
      await webviewApi.postMessage<string>(MARKDOWN_SCRIPT_ID, {
        event: 'fetchNoteHtml',
        payload: { id: noteId },
      }),
      resources,
    );

    this.bodyEl.classList.add(LOCAL_PREVIEWER_BODY_CLASS);
    this.bodyEl.innerHTML = noteContent;
    this.bodyEl.style.position = 'relative'; // make offsetParent correct
  }

  protected async initTitle() {
    const { elementId, noteId } = this.url;

    const { path, title } = await webviewApi.postMessage<Required<Note>>(MARKDOWN_SCRIPT_ID, {
      event: 'queryNote',
      payload: { id: noteId },
    });

    this.titleEl.classList.add(LOCAL_PREVIEWER_TITLE_CLASS);
    this.titleEl.innerHTML = `${path}/${title}` + (elementId ? `#${elementId}` : '');
    super.initTitle();
  }

  scrollToElement() {
    if (!this.url.elementId) {
      return;
    }

    const targetElement = this.bodyEl.querySelector(`#${this.url.elementId}`);

    if (targetElement) {
      this.bodyEl.scrollTop = (targetElement as HTMLElement).offsetTop;
    }
  }
}

export class RemoteBox extends Box {
  private response?: ReturnType<typeof fetch>;
  constructor(private readonly url: string) {
    super();
    this.init();
  }
  protected readonly bodyEl = document.createElement('iframe');
  protected init() {
    this.response = fetch(this.url);
    this.initBody();
    this.initTitle();
    super.init();
    this.containerEl.classList.add(REMOTE_PREVIEWER_CLASS);
  }

  protected async initTitle() {
    if (!this.response) {
      throw Error('no request');
    }

    const res = await this.response;
    const html = await res.text();
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(html, 'text/html');

    this.titleEl.classList.add(REMOTE_PREVIEWER_TITLE_CLASS);
    this.titleEl.innerHTML = doc.title;
    super.initTitle();
  }

  protected async initBody() {
    if (!this.response) {
      throw Error('no request');
    }

    this.bodyEl.src = this.url;
    this.bodyEl.classList.add(REMOTE_PREVIEWER_BODY_CLASS);

    const { headers } = await this.response;

    if (headers.has('x-frame-options')) {
      const emptyBody = document.createElement('p');
      emptyBody.classList.add(REMOTE_PREVIEWER_EMPTY_BODY_CLASS);
      emptyBody.innerHTML = 'This website prevents us from previewing.';
      this.bodyEl.replaceWith(emptyBody);
    }
  }
}
