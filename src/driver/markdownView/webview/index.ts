import EventEmitter from 'eventemitter3';
import type { Note } from 'model/Referrer';
import { ElementReferrerListBuilder } from './ElementReferrerListBuilder';
import { NoteReferrerListBuilder } from './NoteReferrerListBuilder';
import { CopyAnchorBuilder } from './CopyAnchorBuilder';
import {
  MARKDOWN_SCRIPT_ID,
  REFERRER_VIEW_REFERENCE_EXPAND_SETTING,
  QueryCurrentNoteRequest,
  QuerySettingRequest,
} from 'driver/constants';
import { MarkdownViewEvents, ReferenceListExpandMode, ROOT_ELEMENT_ID } from './constants';
import { NoteRouter } from './NoteRouter';
import { LinkPreviewer } from './LinkPreviewer';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: QueryCurrentNoteRequest | QuerySettingRequest,
  ) => Promise<T>;
};

export class MarkdownView extends EventEmitter<MarkdownViewEvents> {
  // `this class will be instantiated when :
  // 1. start App(including return from setting panel)
  // 2. switch to note in another notebook
  constructor() {
    super();
    new NoteRouter(this);
    new ElementReferrerListBuilder(this);
    new NoteReferrerListBuilder(this);
    new CopyAnchorBuilder(this);
    new LinkPreviewer(this);
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

    this.emit(MarkdownViewEvents.NewNoteOpen);
    this.emit(MarkdownViewEvents.NoteDidUpdate, note);

    this.initGlobalStyle();

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
            this.emit(MarkdownViewEvents.NewNoteOpen);
          }

          this.emit(MarkdownViewEvents.NoteDidUpdate, currentNote);
        }
      } else {
        timer && clearTimeout(timer);
        this.currentNoteId = currentNote.id;
        currentNoteIdTimes = 1;

        // hack: don't know why sometimes joplin-noteDidUpdate just fire once when switching note.
        // use timer to make sure it fire
        timer = setTimeout(() => {
          this.emit(MarkdownViewEvents.NewNoteOpen);
          this.emit(MarkdownViewEvents.NoteDidUpdate, currentNote);
        }, 2000);
      }
    });
  }

  private initGlobalStyle() {
    const backgroundColor = getBackgroundColor();
    const css = `.tippy-box[data-theme^="note-link-"] { background-color: ${backgroundColor}}`;
    const styleEl = document.createElement('style');
    styleEl.innerHTML = css;

    document.head.appendChild(styleEl);
  }
}

function getBackgroundColor() {
  let el: HTMLElement = document.getElementById(ROOT_ELEMENT_ID)!;
  let color = getComputedStyle(el).backgroundColor;

  while (color === 'rgba(0, 0, 0, 0)' && el.parentElement) {
    el = el.parentElement;
    color = getComputedStyle(el).backgroundColor;
  }

  return color;
}

new MarkdownView();
