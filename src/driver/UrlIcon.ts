import globeIcon from 'bootstrap-icons/icons/globe.svg';
import hashIcon from 'bootstrap-icons/icons/hash.svg';
import { getRemoteUrl, parseHtml } from './utils';

const DEFAULT_ICON = 'DEFAULT';
const EXTERNAL_WEBSITE_ICON_CLASS_NAME = 'note-link-external-website-icon';

export class UrlIcon {
  constructor(private readonly href: string, containerEl: HTMLElement) {
    this.pageUrl = getRemoteUrl(this.href);

    try {
      this.origin = new URL(this.pageUrl).origin;
    } catch {
      this.origin = '';
    }

    this.iconEl =
      containerEl.querySelector(`.${EXTERNAL_WEBSITE_ICON_CLASS_NAME}`) ||
      UrlIcon.createIconEl(containerEl);

    this.loadIcon();
  }

  private readonly iconEl: HTMLImageElement;
  private readonly pageUrl: string;
  private readonly origin: string;
  private abortController?: AbortController;
  private get faviconUrl() {
    return `${this.origin}/favicon.ico`;
  }
  private isHash() {
    return this.href.startsWith('#') && this.href.length > 1;
  }

  private async loadIcon() {
    if (this.isHash()) {
      this.iconEl.src = UrlIcon.getHashIcon();
      return;
    }

    this.iconEl.src = UrlIcon.getDefaultIcon();

    if (!this.origin) {
      return;
    }

    const iconKey = UrlIcon.getIconKey(this.origin);
    const persistedIcon = localStorage.getItem(iconKey);

    if (persistedIcon === DEFAULT_ICON) {
      return;
    }

    this.abortController = new AbortController();

    let res;
    try {
      res = await fetch(persistedIcon || this.faviconUrl, {
        signal: this.abortController.signal,
      });
    } catch (error) {
      return;
    }

    if (res.status === 200) {
      const icon = await res.blob();

      if (icon.type.includes('image')) {
        this.iconEl.src = URL.createObjectURL(icon);
        return;
      }
    }

    try {
      const res = await fetch(this.pageUrl, { signal: this.abortController.signal });
      const html = await res.text();
      const doc = parseHtml(html);
      const iconLinkEl = doc.querySelector('link[rel="icon"]');

      if (!iconLinkEl) {
        throw new Error('no icon linkEl');
      }

      const iconUrl = new URL(iconLinkEl.getAttribute('href')!, this.pageUrl).toString();
      const iconRes = await fetch(iconUrl, {
        signal: this.abortController.signal,
        redirect: 'error',
      });

      if (iconRes.status !== 200) {
        throw new Error('fetch icon failed');
      }

      const icon = await iconRes.blob();

      if (icon.type.includes('image')) {
        this.iconEl.src = URL.createObjectURL(icon);
        localStorage.setItem(iconKey, this.iconEl.src);
      } else {
        throw new Error('fetch icon failed');
      }
    } catch {
      localStorage.setItem(iconKey, DEFAULT_ICON);
    }
    this.abortController = undefined;
  }

  destroy() {
    if (this.abortController) {
      this.abortController.abort();
    }

    URL.revokeObjectURL(this.iconEl.src);
  }

  private static getIconKey(origin: string) {
    return `note-link-system-icon-url-${origin}`;
  }
  private static getDefaultIcon() {
    return `data:image/svg+xml;utf8,${globeIcon}`;
  }
  private static getHashIcon() {
    return `data:image/svg+xml;utf8,${hashIcon}`;
  }

  private static createIconEl(containerEl: HTMLElement) {
    const el = document.createElement('img');
    el.classList.add(EXTERNAL_WEBSITE_ICON_CLASS_NAME);
    containerEl.prepend(el);

    return el;
  }
}
