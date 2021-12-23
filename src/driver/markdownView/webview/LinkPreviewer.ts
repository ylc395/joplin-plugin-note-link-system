import tippy, { Instance, roundArrow } from 'tippy.js';
import delegate from 'delegate';
import type { Note, File } from 'model/Referrer';
import {
  FetchNoteHtmlRequest,
  MARKDOWN_SCRIPT_ID,
  PREVIEWER_ENABLED_SETTING,
  PREVIEWER_HOVER_DELAY_SETTING,
  QuerySettingRequest,
  QueryNoteRequest,
  QueryNoteResourcesRequest,
} from 'driver/constants';
import { REFERENCE_CLASS_NAME, ROOT_ELEMENT_ID } from './constants';

interface ResourcesMap {
  [resourceId: string]: File;
}

const PREVIEWER_CLASS = 'note-link-previewer';
const LOCAL_PREVIEWER_TITLE_CLASS = 'note-link-previewer-local-title';
const LOCAL_PREVIEWER_BODY_CLASS = 'note-link-previewer-local-body';
const REMOTE_PREVIEWER_CLASS = 'note-link-previewer-remote';
const LOCAL_PREVIEWER_CLASS = 'note-link-previewer-local';

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

export class LinkPreviewer {
  constructor() {
    this.init();
  }

  private tooltip?: Instance;
  private hoverDelay?: number;
  private tooltipTimer?: ReturnType<typeof setTimeout>;

  private async init() {
    const enabled = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: PREVIEWER_ENABLED_SETTING },
    });

    if (!enabled) {
      return;
    }

    this.hoverDelay = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: PREVIEWER_HOVER_DELAY_SETTING },
    });
    delegate(`a`, 'mouseover', (e: any) => this.addPreviewerOf(e.delegateTarget));
    delegate(`a`, 'mouseout', () => this.cancelPreview());
  }

  private async cancelPreview() {
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = undefined;
    }
  }

  private async addPreviewerOf(linkEl: HTMLAnchorElement) {
    if (linkEl.matches(`.${PREVIEWER_CLASS} *`)) {
      return;
    }

    const url = linkEl.href;
    const containerEl = document.createElement('div');
    const isRemote = url.startsWith('http');

    containerEl.classList.add(PREVIEWER_CLASS);

    if (isRemote) {
      this.addRemotePreviewerOf(linkEl, containerEl);
    } else {
      const hasContent = await this.addLocalPreviewerOf(linkEl, containerEl);

      if (!hasContent) {
        return;
      }
    }

    this.createTooltip(linkEl, containerEl, !isRemote);
  }

  private createTooltip(linkEl: HTMLAnchorElement, content: HTMLElement, isLocal: boolean) {
    this.cancelPreview();

    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = undefined;
    }

    this.tooltipTimer = setTimeout(() => {
      this.tooltipTimer = undefined;
      this.tooltip = tippy(linkEl, {
        duration: [300, 0],
        content,
        theme: 'note-link-previewer',
        interactive: true,
        placement: 'top',
        arrow: roundArrow,
        interactiveBorder: 30,
        showOnCreate: true,
        trigger: 'mouseenter',
        appendTo: () => document.getElementById(ROOT_ELEMENT_ID)!,
        popperOptions: {
          modifiers: [
            {
              name: 'flip',
              options: {
                fallbackPlacements: ['bottom'],
              },
            },
            {
              name: 'preventOverflow',
              options: {
                tether: false,
                boundary: document.getElementById(ROOT_ELEMENT_ID),
              },
            },
          ],
        },
      });

      if (isLocal) {
        const elementId = parseUrlFromLinkEl(linkEl)?.elementId;
        // scroll to element
        if (elementId) {
          const bodyEl = this.tooltip.popper.querySelector(`.${LOCAL_PREVIEWER_BODY_CLASS}`)!;
          const targetElement = bodyEl.querySelector(`#${elementId}`);

          if (targetElement) {
            window.requestAnimationFrame(() => {
              bodyEl.scrollTop = (targetElement as HTMLElement).offsetTop;
            });
          }
        }
      }
    }, this.hoverDelay);
  }

  private async addRemotePreviewerOf(linkEl: HTMLAnchorElement, containerEl: HTMLElement) {
    const url = linkEl.href;
    const iframeEl = document.createElement('iframe');

    iframeEl.src = url;
    containerEl.append(iframeEl);
    containerEl.classList.add(REMOTE_PREVIEWER_CLASS);

    const { headers } = await fetch(url);

    if (headers.has('x-frame-options')) {
      iframeEl.remove();
      containerEl.append('This website prevents us from previewing.');
    }

    // todo: prefetch webpage
  }

  private async addLocalPreviewerOf(linkEl: HTMLAnchorElement, containerEl: HTMLElement) {
    const noteId = parseUrlFromLinkEl(linkEl)?.noteId;

    if (!noteId || linkEl.classList.contains(REFERENCE_CLASS_NAME)) {
      return false;
    }

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

    const { path, title } = await webviewApi.postMessage<Required<Note>>(MARKDOWN_SCRIPT_ID, {
      event: 'queryNote',
      payload: { id: noteId },
    });

    containerEl.classList.add(LOCAL_PREVIEWER_CLASS);

    const titleEl = document.createElement('div');
    titleEl.classList.add(LOCAL_PREVIEWER_TITLE_CLASS);
    titleEl.innerHTML = `${path}/${title}`;

    const bodyEl = document.createElement('article');
    bodyEl.classList.add(LOCAL_PREVIEWER_BODY_CLASS);
    bodyEl.innerHTML = noteContent;
    bodyEl.style.position = 'relative'; // make offsetParent correct

    containerEl.append(titleEl, bodyEl);

    return true;
  }
}

function parseUrlFromLinkEl(
  linkEl: HTMLAnchorElement,
): { noteId: string; elementId?: string } | undefined {
  if (linkEl.dataset.noteLinkReferrerId) {
    return { noteId: linkEl.dataset.noteLinkReferrerId };
  }

  const onclickString = linkEl.onclick?.toString();
  const url = onclickString?.match(/\("joplin:\/\/(.+?)",/)?.[1];

  if (!url) {
    return;
  }

  const [noteId, elementId] = url.split('#');

  return { noteId, elementId };
}

// handle <a> and resources
function processNoteContent(content: string, resources: ResourcesMap) {
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(content, 'text/html');
  const noteLinkEls = [...doc.querySelectorAll('a[href^=":/"]')] as HTMLAnchorElement[];

  for (const linkEl of noteLinkEls) {
    const iconEl = document.createElement('span');
    const url = linkEl.getAttribute('href')!.slice(2);

    if (resources[url]) {
      const resource = resources[url];
      const resourceType = resource.contentType.split('/')[0]; // 'video'
      let mediaEl: HTMLVideoElement | HTMLAudioElement | undefined = undefined;

      if (resourceType === 'video') {
        mediaEl = document.createElement('video');
      }

      if (resourceType === 'audio') {
        mediaEl = document.createElement('audio');
      }

      if (mediaEl) {
        mediaEl.controls = true;
        mediaEl.src = window.URL.createObjectURL(new Blob([resource.body]));
        linkEl.after(mediaEl);
      }
    }

    const noteId = url.split('#')[0];
    const iconClassName = (() => {
      const mime = resources[url]?.contentType || '';

      if (mime.startsWith('video')) {
        return 'fa-file-video';
      }

      if (mime.startsWith('audio')) {
        return 'fa-file-audio';
      }

      return 'fa-joplin';
    })();

    linkEl.setAttribute(
      'onclick',
      `ipcProxySendToHost("joplin://${url}", { resourceId: "${noteId}" }); return false;`,
    );
    linkEl.href = '#';
    iconEl.classList.add('resource-icon', iconClassName);
    linkEl.prepend(iconEl);
  }

  const imgEls = [...doc.querySelectorAll('img[src^=":/"]')] as HTMLImageElement[];

  for (const imgEl of imgEls) {
    const resourceId = imgEl.getAttribute('src')!.slice(2);
    const image = resources[resourceId];
    imgEl.src = window.URL.createObjectURL(new Blob([image.body]));
  }

  return doc.body.innerHTML;
}
