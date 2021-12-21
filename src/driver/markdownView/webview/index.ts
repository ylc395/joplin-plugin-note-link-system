import { ElementReferrerListBuilder } from './ElementReferrerListBuilder';
import { NoteReferrerListBuilder } from './NoteReferrerListBuilder';
import { CopyAnchorBuilder } from './CopyAnchorBuilder';
import {
  MARKDOWN_SCRIPT_ID,
  REFERRER_VIEW_REFERENCE_EXPAND_SETTING,
  QueryCurrentNoteRequest,
  QuerySettingRequest,
} from 'driver/constants';
import type { Note } from 'model/Referrer';
import { MarkdownViewEvents, ReferenceListExpandMode } from './constants';
import { NoteRouter } from './NoteRouter';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: QueryCurrentNoteRequest | QuerySettingRequest,
  ) => Promise<T>;
};

export class MarkdownView extends EventTarget {
  // `this class will be instantiated when :
  // 1. start App(including return from setting panel)
  // 2. switch to note in another notebook
  constructor() {
    super();
    new NoteRouter(this);
    new ElementReferrerListBuilder(this);
    new NoteReferrerListBuilder(this);
    new CopyAnchorBuilder(this);
  }

  ready = this.init();
  currentNoteId?: string;
  expandMode?: ReferenceListExpandMode;
  private async init() {
    this.expandMode = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_VIEW_REFERENCE_EXPAND_SETTING },
    });

    const note = await webviewApi.postMessage<Note>(MARKDOWN_SCRIPT_ID, {
      event: 'queryCurrentNote',
    });
    this.currentNoteId = note.id;
    let currentNoteIdTimes = 1;
    let timer: ReturnType<typeof setTimeout>;

    this.dispatchEvent(new CustomEvent(MarkdownViewEvents.NewNoteOpen));
    this.dispatchEvent(new CustomEvent(MarkdownViewEvents.NoteDidUpdate, { detail: note }));

    // this event doesn't fire on app start
    document.addEventListener('joplin-noteDidUpdate', async () => {
      timer && clearTimeout(timer);

      const currentNote = await webviewApi.postMessage<Note>(MARKDOWN_SCRIPT_ID, {
        event: 'queryCurrentNote',
      });

      if (currentNote.id === this.currentNoteId) {
        currentNoteIdTimes++;

        // hack: joplin-noteDidUpdate fires twice when switch to another note
        if (currentNoteIdTimes >= 2) {
          if (currentNoteIdTimes === 2) {
            this.dispatchEvent(new CustomEvent(MarkdownViewEvents.NewNoteOpen));
          }

          this.dispatchEvent(
            new CustomEvent(MarkdownViewEvents.NoteDidUpdate, { detail: currentNote }),
          );
        }
      } else {
        timer && clearTimeout(timer);
        this.currentNoteId = currentNote.id;
        currentNoteIdTimes = 1;

        // hack: don't know why sometimes joplin-noteDidUpdate just fire once when switching note.
        // use timer to make sure it fire
        timer = setTimeout(() => {
          this.dispatchEvent(new CustomEvent(MarkdownViewEvents.NewNoteOpen));
          this.dispatchEvent(
            new CustomEvent(MarkdownViewEvents.NoteDidUpdate, { detail: currentNote }),
          );
        }, 2000);
      }
    });
  }
}

new MarkdownView();
