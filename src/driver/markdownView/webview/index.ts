import delegate from 'delegate';
import { ElementReferrerListBuilder } from './ElementReferrerListBuilder';
import { NoteReferrerListBuilder } from './NoteReferrerListBuilder';
import { IdentifierBuilder } from './IdentifierBuilder';
import {
  MARKDOWN_SCRIPT_ID,
  OpenNoteRequest,
  QueryCurrentNoteRequest,
  QueryJustStartApp,
} from 'driver/constants';
import type { Note } from 'model/Referrer';
import { MarkdownViewEvents } from './constants';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: OpenNoteRequest | QueryCurrentNoteRequest | QueryJustStartApp,
  ) => Promise<T>;
};

delegate('[data-note-link-referrer-id]', 'click', (e: any) => {
  const target = e.delegateTarget as HTMLElement;
  const noteId = target.dataset.noteLinkReferrerId;

  if (!noteId) {
    throw new Error('no noteId');
  }

  webviewApi.postMessage(MARKDOWN_SCRIPT_ID, { event: 'openNote', payload: { noteId } });
});

class MarkdownView extends EventTarget {
  private readonly builders = [
    new ElementReferrerListBuilder(this),
    new NoteReferrerListBuilder(this),
    new IdentifierBuilder(this),
  ];

  constructor() {
    super();
    this.init();
  }

  // `init` will be trigger when:
  // 1. start App
  // 2. switch to note in another notebook
  private async init() {
    const note = await webviewApi.postMessage<Note>(MARKDOWN_SCRIPT_ID, {
      event: 'queryCurrentNote',
    });
    let currentNoteId = note.id;
    let currentNoteIdTimes = 1;

    document.addEventListener('joplin-noteDidUpdate', async () => {
      const currentNote = await webviewApi.postMessage<Note>(MARKDOWN_SCRIPT_ID, {
        event: 'queryCurrentNote',
      });

      if (currentNote.id === currentNoteId) {
        currentNoteIdTimes++;

        // joplin-noteDidUpdate fires twice when switch to another note
        if (currentNoteIdTimes >= 2) {
          this.dispatchEvent(
            new CustomEvent(MarkdownViewEvents.NoteDidUpdate, { detail: currentNote }),
          );
        }
      } else {
        currentNoteId = currentNote.id;
        currentNoteIdTimes = 1;

        // don't know why sometimes joplin-noteDidUpdate just fire once.
        // use timer to make sure it fire
        setTimeout(() => {
          if (currentNoteId === currentNoteId && currentNoteIdTimes < 2) {
            this.dispatchEvent(
              new CustomEvent(MarkdownViewEvents.NoteDidUpdate, { detail: currentNote }),
            );
          }
        }, 2000);
      }
    });

    // if just started, joplin-noteDidUpdate won't fire. So we fire it manually
    const justStartApp = await webviewApi.postMessage<boolean>(MARKDOWN_SCRIPT_ID, {
      event: 'queryJustStartApp',
    });

    if (justStartApp) {
      // hack: don't know why dispatching must happen in next micro task
      setTimeout(() => {
        this.dispatchEvent(new CustomEvent(MarkdownViewEvents.NoteDidUpdate, { detail: note }));
      }, 10);
    }
  }
}

new MarkdownView();
