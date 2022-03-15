import tippy, { Instance, roundArrow } from 'tippy.js';
import delegate from 'delegate';
import UrlMatch from '@fczbkk/url-match';
import {
  FetchNoteHtmlRequest,
  MARKDOWN_SCRIPT_ID,
  PREVIEWER_ENABLED_SETTING,
  PREVIEWER_HOVER_DELAY_SETTING,
  QuerySettingRequest,
  QueryNoteRequest,
  QueryNoteResourcesRequest,
  PREVIEWER_URL_BLACKLIST_SETTING,
  PREVIEWER_URL_BLACKLIST_LOCAL,
} from 'driver/constants';
import { REFERENCE_CLASS_NAME, ROOT_ELEMENT_ID, MarkdownViewEvents } from '../constants';
import { Box, LocalBox, RemoteBox, BoxEvents } from './Box';
import { parseUrlFromLinkEl } from './utils';
import type { MarkdownView } from '../index';
import { getRemoteUrl } from '../utils';

const PREVIEWER_CLASS = 'note-link-previewer';
const PINNED_PREVIEWER_CLASS = 'note-link-previewer-pinned';

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
  constructor(private readonly markdownView: MarkdownView) {
    this.init();
  }

  private tooltip?: Instance;
  private hoverDelay?: number;
  private urlBlackList?: string[];
  private urlMatcher?: any;
  private tooltipTimer?: ReturnType<typeof setTimeout>;
  private readonly pinnedTooltips = new Map<HTMLAnchorElement, Instance>();
  private activeBox?: Box;
  private zIndex = 1;

  private async init() {
    this.markdownView.on(MarkdownViewEvents.NewNoteOpen, () => this.pinnedTooltips.clear());
    const enabled = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: PREVIEWER_ENABLED_SETTING },
    });

    if (!enabled) {
      return;
    }

    this.urlBlackList = (
      await webviewApi.postMessage<string>(MARKDOWN_SCRIPT_ID, {
        event: 'querySetting',
        payload: { key: PREVIEWER_URL_BLACKLIST_SETTING },
      })
    ).split(',');

    this.urlMatcher = new UrlMatch(this.urlBlackList);

    this.hoverDelay = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: PREVIEWER_HOVER_DELAY_SETTING },
    });
    delegate(`a`, 'mouseover', (e: any) => this.preview(e.delegateTarget));
    delegate(`a`, 'mouseout', () => this.cancelPreview());
    delegate(
      `.${PINNED_PREVIEWER_CLASS}`,
      'click',
      (e: any) => (e.delegateTarget.style.zIndex = `${this.zIndex++}`),
    );
  }

  private async cancelPreview() {
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = undefined;
    }
  }

  private async preview(linkEl: HTMLAnchorElement) {
    if (linkEl.matches(`.${PREVIEWER_CLASS} *`)) {
      return;
    }

    if (this.pinnedTooltips.has(linkEl)) {
      const tooltip = this.pinnedTooltips.get(linkEl);
      tooltip!.popper.style.zIndex = `${this.zIndex++}`;
      return;
    }

    const href = linkEl.getAttribute('href');

    if (!href) {
      return;
    }

    const isRemote = !href.startsWith('#');

    if (isRemote) {
      const url = getRemoteUrl(href);

      if (this.urlMatcher.test(url)) {
        return;
      }

      this.activeBox = new RemoteBox(url);
    } else {
      if (this.urlBlackList?.includes(PREVIEWER_URL_BLACKLIST_LOCAL)) {
        return;
      }

      const urlParts = parseUrlFromLinkEl(linkEl);

      if (!urlParts || linkEl.classList.contains(REFERENCE_CLASS_NAME)) {
        return;
      }

      this.activeBox = new LocalBox(urlParts);
    }

    this.activeBox.on(BoxEvents.Pinned, () => this.pinTooltip(linkEl));
    this.activeBox.on(BoxEvents.Unpinned, () => this.unpinTooltip(linkEl));

    this.createTooltip(linkEl);
  }

  private pinTooltip(linkEl: HTMLAnchorElement) {
    if (!this.tooltip || !this.activeBox) {
      throw new Error('no tooltip');
    }

    this.pinnedTooltips.set(linkEl, this.tooltip);
    this.tooltip.popper.classList.add(PINNED_PREVIEWER_CLASS);
    this.tooltip.setProps({
      placement: this.tooltip.popperInstance!.state.placement,
    });
    this.tooltip.popperInstance!.setOptions((options) => ({
      ...options,
      modifiers: [...options.modifiers!, { name: 'flip', enabled: false }],
    }));
    this.tooltip.popper.style.zIndex = `${this.zIndex++}`;
    this.tooltip = undefined;
  }

  private unpinTooltip(linkEl: HTMLAnchorElement) {
    const tooltip = this.pinnedTooltips.get(linkEl);

    if (!tooltip) {
      throw new Error('no box');
    }

    this.pinnedTooltips.delete(linkEl);
    tooltip.destroy();
  }

  private createTooltip(linkEl: HTMLAnchorElement) {
    if (this.tooltip && ![...this.pinnedTooltips.values()].includes(this.tooltip)) {
      !this.tooltip.state.isDestroyed && this.tooltip.destroy();
      this.tooltip = undefined;
    }

    const handleClick = () => {
      this.cancelPreview();
      linkEl.removeEventListener('click', handleClick);
    };

    linkEl.addEventListener('click', handleClick);
    this.tooltipTimer = setTimeout(() => {
      if (!this.activeBox) {
        throw new Error('no box');
      }

      this.tooltipTimer = undefined;
      this.tooltip = tippy(linkEl, {
        duration: [300, 0],
        content: this.activeBox.containerEl,
        theme: 'note-link-previewer',
        interactive: true,
        placement: 'top',
        arrow: roundArrow,
        interactiveBorder: 30,
        showOnCreate: true,
        trigger: 'mouseenter',
        appendTo: () => document.getElementById(ROOT_ELEMENT_ID)!,
        onHidden: (instance) => instance.destroy(),
        onHide: () => (this.pinnedTooltips.has(linkEl) ? false : undefined),
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

      window.requestAnimationFrame(() => {
        if (this.activeBox instanceof LocalBox) {
          this.activeBox.scrollToElement();
        }
      });
    }, this.hoverDelay);
  }
}
