import delegate from 'delegate';
import { ElementReferrerListBuilder } from './ElementReferrerListBuilder';
import { NoteReferrerListBuilder } from './NoteReferrerListBuilder';
import { IdentifierBuilder } from './IdentifierBuilder';
import { MARKDOWN_SCRIPT_ID, OpenNoteRequest } from 'driver/constants';

declare const webviewApi: {
  postMessage: <T>(id: string, payload: OpenNoteRequest) => Promise<T>;
};

delegate('[data-note-link-referrer-id]', 'click', (e: any) => {
  const target = e.delegateTarget as HTMLElement;
  const noteId = target.dataset.noteLinkReferrerId;

  if (!noteId) {
    throw new Error('no noteId');
  }

  webviewApi.postMessage(MARKDOWN_SCRIPT_ID, { event: 'openNote', payload: { noteId } });
});

new ElementReferrerListBuilder();
new NoteReferrerListBuilder();
new IdentifierBuilder();
