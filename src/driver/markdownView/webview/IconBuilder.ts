import debounce from 'lodash.debounce';
import delegate from 'delegate';
import globeIcon from 'bootstrap-icons/icons/globe.svg';
import {
  MARKDOWN_SCRIPT_ID,
  URL_ICON_ENABLED_SETTING,
  QuerySettingRequest,
} from 'driver/constants';
import { MarkdownViewEvents, ROOT_ELEMENT_ID } from './constants';
import { parseHtml, getRemoteUrl } from './utils';
import type { MarkdownView } from './index';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: QuerySettingRequest) => Promise<T>;
};

const DEFAULT_URL = 'DEFAULT';
const EXTERNAL_WEBSITE_ICON_CLASS_NAME = 'note-link-external-website-icon';

export class IconBuilder {
  constructor(private readonly view: MarkdownView) {}

  private enabled?: Boolean;
  private readonly ready = this.init();

  private async init() {
    const attach = debounce(this.attach.bind(this), 500);
    const delegation = delegate(
      `img.${EXTERNAL_WEBSITE_ICON_CLASS_NAME}`,
      'error',
      this.fallback.bind(this),
      true,
    );
    this.view.on(MarkdownViewEvents.NoteDidUpdate, attach);

    this.enabled = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: URL_ICON_ENABLED_SETTING },
    });

    if (!this.enabled) {
      this.view.off(MarkdownViewEvents.NoteDidUpdate, attach);
      delegation.destroy();
    }
  }

  private async fallback(e: ErrorEvent) {
    const iconEl = e.target as HTMLImageElement;
    const iconElSrc = iconEl.src;

    IconBuilder.useDefaultIcon(iconEl);

    const pageUrl = new URL((iconEl.parentElement as HTMLAnchorElement).href);
    const isFaviconFailed = IconBuilder.getFaviconUrl(pageUrl.origin) === iconElSrc;
    let iconLinkEl;

    if (isFaviconFailed) {
      const res = await fetch(pageUrl.toString());
      const html = await res.text();
      const doc = parseHtml(html);
      iconLinkEl = doc.querySelector('link[rel="icon"]');
    }

    if (iconLinkEl) {
      const href = iconLinkEl.getAttribute('href');

      if (href) {
        iconEl.src = new URL(href, pageUrl).toString();
        localStorage.setItem(IconBuilder.getIconKey(pageUrl.origin), iconEl.src);
        return;
      }
    }

    localStorage.setItem(IconBuilder.getIconKey(pageUrl.origin), DEFAULT_URL);
  }

  private static getFaviconUrl(origin: string) {
    return `${origin}/favicon.ico`;
  }

  private static useDefaultIcon(iconEl: HTMLImageElement) {
    iconEl.src = `data:image/svg+xml;utf8,${globeIcon}`;
  }

  private static getIconKey(origin: string) {
    return `note-link-system-icon-url-${origin}`;
  }

  private async attach() {
    await this.ready;

    if (!this.enabled) {
      return;
    }

    const rootEl = document.getElementById(ROOT_ELEMENT_ID)!;
    const linkEls = [...rootEl.querySelectorAll('a[href]:not([href^="#"])')] as HTMLAnchorElement[];

    for (const el of linkEls) {
      const iconEl = document.createElement('img');
      const href = el.getAttribute('href')!;
      let pageUrl: URL;

      try {
        pageUrl = new URL(getRemoteUrl(href));
      } catch (error) {
        continue;
      }

      const iconUrl = localStorage.getItem(IconBuilder.getIconKey(pageUrl.origin));

      if (iconUrl === DEFAULT_URL) {
        IconBuilder.useDefaultIcon(iconEl);
      } else {
        iconEl.src = iconUrl || IconBuilder.getFaviconUrl(pageUrl.origin);
      }
      iconEl.classList.add(EXTERNAL_WEBSITE_ICON_CLASS_NAME);
      el.prepend(iconEl);
    }
  }
}
