import delegate from 'delegate';
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

    // this event will be triggered twice within 1s. debounce function will cause an ignorable delay
    document.addEventListener('joplin-noteDidUpdate', this.attach.bind(this));
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
      const identifierEl = document.createElement('button');
      identifierEl.classList.add(IDENTIFIER_CLASS_NAME);
      identifierEl.dataset.noteLinkElementId = el.id;
      identifierEl.innerText = '#';

      el.prepend(identifierEl);
    }
  }
}
