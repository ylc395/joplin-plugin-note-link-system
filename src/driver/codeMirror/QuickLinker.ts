import type { Editor, Position } from 'codemirror';
import type CodeMirror from 'codemirror';
import h1Icon from 'bootstrap-icons/icons/type-h1.svg';
import h2Icon from 'bootstrap-icons/icons/type-h2.svg';
import h3Icon from 'bootstrap-icons/icons/type-h3.svg';
import cardHeadingIcon from 'bootstrap-icons/icons/card-heading.svg';
import boxIcon from 'bootstrap-icons/icons/box.svg';
import plusIcon from 'bootstrap-icons/icons/file-earmark-plus.svg';
import {
  QUICK_LINK_SYMBOL_SETTING,
  QUICK_LINK_ELEMENTS_ENABLED_SETTING,
  QUICK_LINK_AFTER_COMPLETION_SETTING,
  QUICK_LINK_CREATE_NOTE_SETTING,
  FOOTNOTE_ID_PREFIX,
  FOOTNOTE_ITEM_CLASS_NAME,
} from 'driver/constants';
import type { SearchResult, Note } from 'model/Referrer';
import { ActionAfterCompletion } from './constants';
import type { Context } from './index';

// @see https://codemirror.net/doc/manual.html#addon_show-hint
interface Hint {
  text: string;
  displayText?: string;
  className?: string;
  render?: (container: Element, completion: Completion, hint: Hint) => void;
  hint?: (cm: typeof CodeMirror, completion: Completion, hint: Hint) => void;
}

interface NoteHint extends Hint {
  note: SearchResult;
}

interface ElHint extends Hint {
  elId: string;
}

interface Completion {
  from: Position;
  to: Position;
  list: (Hint | string)[];
  selectedHint?: number;
}

export type ExtendedEditor = {
  showHint(options: {
    completeSingle: boolean;
    closeCharacters: RegExp;
    closeOnUnfocus: boolean;
    hint: (cm: Editor) => Completion | undefined | Promise<Completion | undefined>;
  }): void;
};

const HINT_ITEM_CLASS = 'note-link-hint';
const HINT_ITEM_PATH_CLASS = 'note-link-hint-path';
const HINT_ITEM_SELF_CLASS = 'note-link-hint-self';
function isNoteHint(hint: Hint): hint is NoteHint {
  return 'note' in hint;
}

function isFootnote(el: HTMLElement) {
  return el.id.startsWith(FOOTNOTE_ID_PREFIX) || el.classList.contains(FOOTNOTE_ITEM_CLASS_NAME);
}

export default class QuickLinker {
  constructor(
    private readonly context: Context,
    private readonly editor: ExtendedEditor & Editor,
    private readonly cm: typeof CodeMirror,
  ) {
    this.editor.on('cursorActivity', this.triggerHints.bind(this));
    // hack: don't know why fetching must happen in next micro task
    setTimeout(this.init.bind(this), 100);
  }

  async init() {
    this.triggerSymbol = await this.context.postMessage<string>({
      event: 'querySetting',
      payload: { key: QUICK_LINK_SYMBOL_SETTING },
    });

    if (!this.triggerSymbol) {
      return;
    }

    this.linkToElementEnabled = await this.context.postMessage<boolean>({
      event: 'querySetting',
      payload: { key: QUICK_LINK_ELEMENTS_ENABLED_SETTING },
    });
    this.actionAfterCompletion = await this.context.postMessage<ActionAfterCompletion>({
      event: 'querySetting',
      payload: { key: QUICK_LINK_AFTER_COMPLETION_SETTING },
    });
    this.createNoteEnabled = await this.context.postMessage<boolean>({
      event: 'querySetting',
      payload: { key: QUICK_LINK_CREATE_NOTE_SETTING },
    });
  }

  private readonly doc = this.editor.getDoc();
  private triggerSymbol?: string;
  private symbolRange?: { from: Position; to: Position };
  private linkToElementEnabled?: boolean;
  private actionAfterCompletion?: ActionAfterCompletion;
  private createNoteEnabled?: boolean;
  private isUrlOnly?: boolean;

  private isUrlToken() {
    return this.editor.getTokenTypeAt(this.editor.getCursor())?.includes('string url') || false;
  }

  private triggerHints() {
    if (!this.triggerSymbol) {
      return;
    }

    const pos = this.doc.getCursor();
    const symbolRange = [{ line: pos.line, ch: pos.ch - this.triggerSymbol.length }, pos] as const;
    const chars = this.doc.getRange(...symbolRange);

    if (chars === this.triggerSymbol) {
      this.symbolRange = { from: symbolRange[0], to: symbolRange[1] };
      this.isUrlOnly = this.isUrlToken();
      this.editor.showHint({
        closeCharacters: /[()\[\]{};:>,]/,
        closeOnUnfocus: process.env.NODE_ENV === 'production',
        completeSingle: false,
        hint: this.getNoteCompletion.bind(this),
      });
    }
  }

  private async getElementsList(noteId: string, isLink: boolean): Promise<ElHint[]> {
    const html = await this.context.postMessage<string>({
      event: 'fetchNoteHtml',
      payload: { id: noteId },
    });

    const document = new DOMParser().parseFromString(html, 'text/html');
    const isHeading = (el: Element) => ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName);

    return ([...document.querySelectorAll('[id]')] as HTMLElement[])
      .filter((el) => !isFootnote(el))
      .map((el, index, els) => {
        const level = isHeading(el)
          ? Number(el.tagName[1])
          : (() => {
              for (let i = index; els[i]; i--) {
                if (isHeading(els[i])) {
                  return Number(els[i].tagName[1]);
                }
              }
              return 1;
            })();

        const icon = (() => {
          if (!isHeading(el)) {
            return boxIcon;
          }

          switch (level) {
            case 1:
              return h1Icon;
            case 2:
              return h2Icon;
            case 3:
              return h3Icon;
            default:
              return cardHeadingIcon;
          }
        })();

        return {
          text: (isLink && !this.isUrlOnly) ? `[${el.id}](#${el.id})` : `#${el.id}`,
          className: HINT_ITEM_CLASS,
          elId: el.id,
          render: (container) => {
            container.innerHTML = `${' '.repeat(level - 1)}${icon}${el.id}`;
          },
        };
      });
  }

  private async hintForElements(
    { id: noteId, title }: SearchResult,
    elementIdStart?: Position,
    titleRange?: [Position, Position],
  ) {
    if (!this.symbolRange) {
      throw new Error('no symbol');
    }

    const isHintingForSelf = !elementIdStart;
    const list = await this.getElementsList(noteId, isHintingForSelf);

    if (list.length === 0) {
      if (titleRange) {
        this.afterCompletion(titleRange);
      }
      return;
    }

    const keywordStart = elementIdStart || this.symbolRange.to;
    const completionStart = elementIdStart || this.symbolRange.from;

    this.editor.showHint({
      completeSingle: false,
      closeCharacters: /[()\[\]{};:>,]/,
      closeOnUnfocus: process.env.NODE_ENV === 'production',
      hint: () => {
        if (!isHintingForSelf && !this.isUrlToken()) {
          return;
        }

        const cursorPos = this.doc.getCursor();
        const keyword = this.doc.getRange(keywordStart, cursorPos);
        const selectedHint = list.findIndex(({ text }) => text.slice(1).includes(keyword));

        if (selectedHint < 0) {
          return;
        }

        const completion = {
          from: completionStart,
          to: cursorPos,
          list,
          selectedHint,
        };

        const handleClose: any = () => {
          if (!this.symbolRange) {
            throw new Error('no symbolRange');
          }

          const { from } = this.symbolRange;

          if (!isHintingForSelf && !keyword) {
            this.afterCompletion([
              { line: from.line, ch: from.ch + 1 },
              { line: from.line, ch: from.ch + 1 + title.length },
            ]);
          }
        };

        this.cm.on(completion, 'close', handleClose);
        this.cm.on(completion, 'pick', (({ text, elId }: ElHint) => {
          this.cm.off(completion, 'close', handleClose);

          const { line: cursorLine, ch: cursorCh } = this.doc.getCursor();

          if (isHintingForSelf) {
            this.afterCompletion([
              { line: cursorLine, ch: cursorCh - text.length + 1 },
              { line: cursorLine, ch: cursorCh - `](#${elId})`.length },
            ]);
            return;
          }

          const titleEnd = cursorCh - `(:/${noteId}${text})`.length;

          if (!this.isUrlOnly) {
            this.doc.replaceRange(text, {
              line: cursorLine,
              ch: titleEnd,
            });
          }

          this.afterCompletion([
            { line: cursorLine, ch: titleEnd - title.length },
            { line: cursorLine, ch: titleEnd + text.length },
          ]);
        }) as any);

        return completion;
      },
    });
  }

  private afterCompletion(titleRange: [Position, Position]) {
    const { line, ch } = this.doc.getCursor();

    if (this.actionAfterCompletion === ActionAfterCompletion.MoveCursorToEnd || this.isUrlOnly) {
      this.doc.setCursor({ line, ch: ch + 1 });
      return;
    }

    if (this.actionAfterCompletion === ActionAfterCompletion.SelectText) {
      this.doc.setSelection(...titleRange);
    }
  }

  private getNewNoteHints(keyword: string): Hint[] {
    const afterCreate = (note: Note) => {
      if (!this.symbolRange) {
        throw new Error('no symbolRange');
      }

      const { from, to } = this.symbolRange;

      if (this.isUrlOnly) {
        const token = this.editor.getTokenAt(from);
        this.doc.replaceRange(
          `:/${note.id}`,
          { line: from.line, ch: token.start },
          { line: from.line, ch: token.end },
        );
      } else {
        this.doc.replaceRange(`[${note.title}](:/${note.id})`, from, {
          line: to.line,
          ch: to.ch + keyword.length,
        });
      }
      this.afterCompletion([
        { line: from.line, ch: from.ch + 1 },
        { line: from.line, ch: from.ch + 1 + note.title.length },
      ]);
    };

    const hint = (type: 'todo' | 'note') => {
      return async () => {
        const note = await this.context.postMessage<Note>({
          event: 'createNote',
          payload: { title: keyword, type },
        });
        afterCreate(note);
      };
    };

    return [
      {
        className: HINT_ITEM_CLASS,
        text: '',
        render: (containerEl) => (containerEl.innerHTML = `${plusIcon}new Note: ${keyword}`),
        hint: hint('note'),
      },
      {
        text: '',
        className: HINT_ITEM_CLASS,
        render: (containerEl) => (containerEl.innerHTML = `${plusIcon}new Todo: ${keyword}`),
        hint: hint('todo'),
      },
    ];
  }

  private async getNoteCompletion(): Promise<Completion | undefined> {
    if (!this.symbolRange) {
      throw new Error('no symbolRange');
    }

    const { line, ch } = this.symbolRange.to;
    const { line: cursorLine, ch: cursorCh } = this.doc.getCursor();

    if (cursorLine < line || cursorCh < ch) {
      return;
    }

    const keyword = this.doc.getRange({ line, ch }, { line: cursorLine, ch: cursorCh });
    const isCreatingNewNote = keyword && this.createNoteEnabled;
    const notes = await this.context.postMessage<SearchResult[]>({
      event: 'searchNotes',
      payload: { keyword: keyword },
    });
    const hintList: Hint[] = notes.map((note) => ({
      text: this.isUrlOnly ? `:/${note.id}` : `[${note.title}](:/${note.id})`,
      className: HINT_ITEM_CLASS,
      render(container) {
        container.innerHTML =
          note.title +
          (note.isCurrent
            ? `<span class="${HINT_ITEM_SELF_CLASS}">SELF</span>`
            : note.path
            ? `<span class="${HINT_ITEM_PATH_CLASS}">${note.path}</span>`
            : '');
      },
      note,
      ...(note.isCurrent ? { hint: () => this.hintForElements(note) } : null),
    }));

    const { from: completionFrom } = this.symbolRange;
    const completionTo = { line, ch: ch + keyword.length };
    const completion: Completion = {
      from: completionFrom,
      to: completionTo,
      list: hintList.concat(isCreatingNewNote ? this.getNewNoteHints(keyword) : []),
    };

    this.cm.on(completion, 'pick', ((hint: Hint) => {
      // if is current note, just skip
      if (!isNoteHint(hint) || hint.note.isCurrent) {
        return;
      }
      const noteIdEnd = {
        line: completionTo.line,
        ch: completionFrom.ch + hint.text.length - 1,
      };

      if (this.isUrlOnly) {
        const token = this.editor.getTokenAt({ line: cursorLine, ch: cursorCh });
        this.doc.replaceRange(
          hint.text,
          { line: completionTo.line, ch: token.start },
          { line: completionTo.line, ch: token.end },
        );

        noteIdEnd.ch = token.start + hint.text.length;
      }

      const titleRange: [Position, Position] = [
        { line: completionTo.line, ch: completionFrom.ch + 1 },
        {
          line: completionTo.line,
          ch: completionFrom.ch + hint.note.title.length + 1,
        },
      ];

      if (!this.linkToElementEnabled) {
        this.afterCompletion(titleRange);
        return;
      }

      this.doc.setCursor(noteIdEnd);
      this.hintForElements(hint.note, noteIdEnd, titleRange);
    }) as any);

    return completion;
  }
}
