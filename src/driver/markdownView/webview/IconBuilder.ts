import debounce from 'lodash.debounce';
import {
  MARKDOWN_SCRIPT_ID,
  URL_ICON_ENABLED_SETTING,
  QuerySettingRequest,
} from 'driver/constants';
import { MarkdownViewEvents, ROOT_ELEMENT_ID } from './constants';
import { UrlIcon } from '../../UrlIcon';
import type { MarkdownView } from './index';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: QuerySettingRequest) => Promise<T>;
};

export class IconBuilder {
  constructor(private readonly view: MarkdownView) {}

  private enabled?: Boolean;
  private readonly ready = this.init();
  private icons: UrlIcon[] = [];

  private async init() {
    const attach = debounce(this.attach.bind(this), 500);

    this.view.on(MarkdownViewEvents.NoteDidUpdate, attach);
    this.enabled = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: URL_ICON_ENABLED_SETTING },
    });

    if (!this.enabled) {
      this.view.off(MarkdownViewEvents.NoteDidUpdate, attach);
    }
  }

  private async attach() {
    await this.ready;

    this.icons.forEach((icon) => icon.destroy());

    if (!this.enabled) {
      return;
    }

    const rootEl = document.getElementById(ROOT_ELEMENT_ID)!;
    const linkEls = [...rootEl.querySelectorAll('a[href]:not([href^="#"])')] as HTMLAnchorElement[];
    const icons = [];

    for (const el of linkEls) {
      const href = el.getAttribute('href')!;
      icons.push(new UrlIcon(href, el));
    }

    this.icons = icons;
  }
}
