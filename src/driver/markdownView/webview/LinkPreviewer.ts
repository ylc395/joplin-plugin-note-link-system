import tippy, { Instance, roundArrow } from 'tippy.js';
import delegate from 'delegate';
import type { Note } from 'model/Referrer';
import {
  FetchNoteHtmlRequest,
  MARKDOWN_SCRIPT_ID,
  PREVIEWER_ENABLED_SETTING,
  QuerySettingRequest,
  QueryNoteRequest,
} from 'driver/constants';
import { REFERENCE_CLASS_NAME, ROOT_ELEMENT_ID } from './constants';

const PREVIEWER_CLASS = 'note-link-previewer';
const LOCAL_PREVIEWER_TITLE_CLASS = 'note-link-previewer-local-title';
const LOCAL_PREVIEWER_BODY_CLASS = 'note-link-previewer-local-body';
const REMOTE_PREVIEWER_CLASS = 'note-link-previewer-remote';
const LOCAL_PREVIEWER_CLASS = 'note-link-previewer-local';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: FetchNoteHtmlRequest | QuerySettingRequest | QueryNoteRequest,
  ) => Promise<T>;
};

export class LinkPreviewer {
  private tooltip?: Instance;
  ready = this.init();

  private async init() {
    const enabled = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: PREVIEWER_ENABLED_SETTING },
    });

    if (!enabled) {
      return;
    }

    delegate(`a`, 'mouseover', (e: any) => this.addPreviewerOf(e.delegateTarget));
  }

  private async addPreviewerOf(linkEl: HTMLAnchorElement) {
    if (linkEl.matches(`.${PREVIEWER_CLASS} *`)) {
      return;
    }

    const url = linkEl.href;
    const containerEl = document.createElement('div');
    containerEl.classList.add(PREVIEWER_CLASS);

    if (url.startsWith('http')) {
      this.addRemotePreviewerOf(linkEl, containerEl);
    } else {
      const hasContent = await this.addLocalPreviewerOf(linkEl, containerEl);

      if (!hasContent) {
        return;
      }
    }

    if (this.tooltip) {
      this.tooltip.destroy();
    }

    this.tooltip = tippy(linkEl, {
      duration: [300, 0],
      content: containerEl,
      theme: 'note-link-previewer',
      interactive: true,
      placement: 'top',
      arrow: roundArrow,
      showOnCreate: true,
      trigger: 'mouseenter',
      maxWidth: '90vw',
      appendTo: () => document.getElementById(ROOT_ELEMENT_ID)!,
      popperOptions: {
        modifiers: [
          {
            name: 'flip',
            options: {
              fallbackPlacements: ['bottom'],
            },
          },
        ],
      },
    });

    this.tooltip.show();
  }

  private addRemotePreviewerOf(linkEl: HTMLAnchorElement, containerEl: HTMLElement) {
    const url = linkEl.href;
    const iframeEl = document.createElement('iframe');

    iframeEl.src = url;
    containerEl.appendChild(iframeEl);
    containerEl.classList.add(REMOTE_PREVIEWER_CLASS);

    // todo: handle websites which hax x-frame-options
    // todo: prefetch webpage
  }

  private async addLocalPreviewerOf(linkEl: HTMLAnchorElement, containerEl: HTMLElement) {
    const url = parseUrlFromLinkEl(linkEl);

    if (!url || linkEl.classList.contains(REFERENCE_CLASS_NAME)) {
      return false;
    }

    const [noteId, elementId] = url.split('#');
    // todo: process image and link inside content
    const noteContent = await webviewApi.postMessage<string>(MARKDOWN_SCRIPT_ID, {
      event: 'fetchNoteHtml',
      payload: { id: noteId },
    });

    const { path } = await webviewApi.postMessage<Required<Note>>(MARKDOWN_SCRIPT_ID, {
      event: 'queryNote',
      payload: { id: noteId },
    });

    containerEl.classList.add(LOCAL_PREVIEWER_CLASS);

    const titleEl = document.createElement('div');
    titleEl.classList.add(LOCAL_PREVIEWER_TITLE_CLASS);
    titleEl.innerHTML = path;

    const bodyEl = document.createElement('article');
    bodyEl.classList.add(LOCAL_PREVIEWER_BODY_CLASS);
    bodyEl.innerHTML = noteContent;
    bodyEl.style.position = 'relative'; // make offsetParent correct

    containerEl.append(titleEl, bodyEl);

    // scroll to element
    if (elementId) {
      const targetElement = bodyEl.querySelector(`#${elementId}`);

      if (targetElement) {
        window.requestAnimationFrame(() => {
          bodyEl.scrollTop = (targetElement as HTMLElement).offsetTop;
        });
      }
    }

    return true;
  }
}

function parseUrlFromLinkEl(linkEl: HTMLAnchorElement) {
  if (linkEl.dataset.noteLinkReferrerId) {
    return linkEl.dataset.noteLinkReferrerId;
  }

  if (linkEl.href.startsWith('#')) {
    return linkEl.href;
  }

  const onclickString = linkEl.onclick?.toString();

  if (!onclickString) {
    return;
  }

  return onclickString.match(/\("joplin:\/\/(.+?)",/)?.[1];
}
