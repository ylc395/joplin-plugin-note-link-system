import tippy, { Instance, roundArrow } from 'tippy.js';
import delegate from 'delegate';
import {
  FetchNoteHtmlRequest,
  MARKDOWN_SCRIPT_ID,
  PREVIEWER_ENABLED_SETTING,
  PREVIEWER_HOVER_DELAY_SETTING,
  QuerySettingRequest,
  QueryNoteRequest,
  QueryNoteResourcesRequest,
} from 'driver/constants';
import { REFERENCE_CLASS_NAME, ROOT_ELEMENT_ID } from '../constants';
import { Box, LocalBox, RemoteBox } from './Box';
import { parseUrlFromLinkEl } from './utils';

const PREVIEWER_CLASS = 'note-link-previewer';

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
    const isRemote = url.startsWith('http');
    let box: Box;

    if (isRemote) {
      box = new RemoteBox(url);
    } else {
      const urlParts = parseUrlFromLinkEl(linkEl);

      if (!urlParts || linkEl.classList.contains(REFERENCE_CLASS_NAME)) {
        return;
      }

      box = new LocalBox(urlParts);
    }

    this.createTooltip(linkEl, box);
  }

  private createTooltip(linkEl: HTMLAnchorElement, box: Box) {
    this.cancelPreview();

    const { containerEl } = box;

    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = undefined;
    }

    this.tooltipTimer = setTimeout(() => {
      this.tooltipTimer = undefined;
      this.tooltip = tippy(linkEl, {
        duration: [300, 0],
        content: containerEl,
        theme: 'note-link-previewer',
        interactive: true,
        placement: 'top',
        arrow: roundArrow,
        interactiveBorder: 30,
        showOnCreate: true,
        trigger: 'mouseenter',
        appendTo: () => document.getElementById(ROOT_ELEMENT_ID)!,
        onUntrigger: () => {
          if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = undefined;
          }
        },
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

      if (box instanceof LocalBox) {
        window.requestAnimationFrame(() => {
          box.scrollToElement();
        });
      }
    }, this.hoverDelay);
  }
}
