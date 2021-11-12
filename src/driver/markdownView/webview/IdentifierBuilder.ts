import delegate from 'delegate';
import debounce from 'lodash.debounce';
import hashIcon from 'bootstrap-icons/icons/hash.svg';
import type { Referrer } from 'model/Referrer';
import {
  MARKDOWN_SCRIPT_ID,
  WriteClipboardRequest,
  QueryCurrentNoteRequest,
  QuerySettingRequest,
  REFERRER_IDENTIFIER_ENABLED_SETTING,
} from 'driver/constants';

const IDENTIFIER_CLASS_NAME = 'note-link-identifier';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: WriteClipboardRequest | QueryCurrentNoteRequest | QuerySettingRequest,
  ) => Promise<T>;
};

export class IdentifierBuilder {
  async init() {
    const enabled = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_IDENTIFIER_ENABLED_SETTING },
    });

    if (!enabled) {
      return;
    }

    delegate(`.${IDENTIFIER_CLASS_NAME}`, 'click', (e: any) => {
      const target = e.delegateTarget as HTMLElement;
      this.copyUrl(target);
    });

    document.addEventListener('joplin-noteDidUpdate', debounce(this.attach.bind(this), 1500));
    this.attach();
  }

  private async copyUrl(identifier: HTMLElement) {
    const { id, title } = await webviewApi.postMessage<Referrer>(MARKDOWN_SCRIPT_ID, {
      event: 'queryCurrentNote',
    });

    const elId = identifier.dataset.noteLinkElementId;

    webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'writeClipboard',
      payload: { content: `[${title}#${elId}](:/${id}#${elId})` },
    });
  }

  private attach() {
    const rootEl = document.getElementById('rendered-md')!;
    const elsWithId = [...rootEl.querySelectorAll('[id]')];

    for (const el of elsWithId) {
      if (!el.id) {
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
