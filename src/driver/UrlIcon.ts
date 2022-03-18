import globeIcon from 'bootstrap-icons/icons/globe.svg';
import hashIcon from 'bootstrap-icons/icons/hash.svg';
import { getRemoteUrl, parseHtml } from './utils';

const DEFAULT_ICON = 'DEFAULT';
const EXTERNAL_WEBSITE_ICON_CLASS_NAME = 'note-link-external-website-icon';

export class UrlIcon {
  constructor(private readonly href: string, private readonly containerEl: HTMLElement) {
    this.pageUrl = getRemoteUrl(this.href);

    try {
      this.origin = new URL(this.pageUrl).origin;
    } catch {
      this.origin = '';
    }

    this.iconEl = this.createIconEl();
    this.loadIcon();
  }

  private iconEl: HTMLSpanElement;
  private readonly pageUrl: string;
  private iconUrl?: string;
  private readonly origin: string;
  private abortController?: AbortController;
  private get faviconUrl() {
    return `${this.origin}/favicon.ico`;
  }

  private isHash() {
    return this.href.startsWith('#') && this.href.length > 1;
  }

  private createIconEl() {
    const iconEl = this.containerEl.querySelector(`.${EXTERNAL_WEBSITE_ICON_CLASS_NAME}`);

    if (iconEl) {
      iconEl.remove();
    }

    const el = document.createElement('span');

    el.innerHTML = this.isHash() ? hashIcon : globeIcon;
    el.classList.add(EXTERNAL_WEBSITE_ICON_CLASS_NAME);
    this.containerEl.prepend(el);

    return el;
  }

  private setIconUrl(src: string) {
    const imgEl = document.createElement('img');
    imgEl.src = src;

    this.iconEl.innerHTML = imgEl.outerHTML;
    this.iconUrl = src;
  }

  private async loadIcon() {
    if (!this.origin || this.isHash()) {
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
        this.setIconUrl(URL.createObjectURL(icon));
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
        const iconUrl = URL.createObjectURL(icon);
        this.setIconUrl(iconUrl);
        localStorage.setItem(iconKey, iconUrl);
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

    if (this.iconUrl) {
      URL.revokeObjectURL(this.iconUrl);
    }
  }

  private static getIconKey(origin: string) {
    return `note-link-system-icon-url-${origin}`;
  }
}
