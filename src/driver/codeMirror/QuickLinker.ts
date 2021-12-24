import type { Editor, Position, Token } from 'codemirror';
import type CodeMirror from 'codemirror';
import h1Icon from 'bootstrap-icons/icons/type-h1.svg';
import h2Icon from 'bootstrap-icons/icons/type-h2.svg';
import h3Icon from 'bootstrap-icons/icons/type-h3.svg';
import cardHeadingIcon from 'bootstrap-icons/icons/card-heading.svg';
import boxIcon from 'bootstrap-icons/icons/box.svg';
import plusIcon from 'bootstrap-icons/icons/file-earmark-plus.svg';
import {
  QUICK_LINK_ENABLED_SETTING,
  QUICK_LINK_SYMBOL_SETTING,
  QUICK_LINK_ELEMENTS_ENABLED_SETTING,
  QUICK_LINK_AFTER_COMPLETION_SETTING,
  QUICK_LINK_CREATE_NOTE_SETTING,
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
  id?: string; // custom field for our app
  title?: string; // custom field for our app
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
    hint: (cm: Editor) => Completion | undefined | Promise<Completion | undefined>;
  }): void;
};

const HINT_ITEM_CLASS = 'note-link-hint';
const HINT_ITEM_PATH_CLASS = 'note-link-hint-path';

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
    this.enabled = await this.context.postMessage<boolean>({
      event: 'querySetting',
      payload: { key: QUICK_LINK_ENABLED_SETTING },
    });

    if (!this.enabled) {
      return;
    }

    this.triggerSymbol = await this.context.postMessage<string>({
      event: 'querySetting',
      payload: { key: QUICK_LINK_SYMBOL_SETTING },
    });
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
  private enabled?: boolean;
  private triggerSymbol?: string;
  private symbolRange?: { from: Position; to: Position };
  private linkToElementEnabled?: boolean;
  private actionAfterCompletion?: ActionAfterCompletion;
  private createNoteEnabled?: boolean;
  private isUrlOnly?: boolean;

  private triggerHints() {
    if (!this.triggerSymbol || !this.enabled) {
      return;
    }

    const pos = this.doc.getCursor();
    const symbolRange = [{ line: pos.line, ch: pos.ch - this.triggerSymbol.length }, pos] as const;
    const chars = this.doc.getRange(...symbolRange);

    if (chars === this.triggerSymbol) {
      this.symbolRange = { from: symbolRange[0], to: symbolRange[1] };
      this.isUrlOnly = this.editor.getTokenTypeAt(pos) === 'string url';
      this.editor.showHint({
        closeCharacters: /[()\[\]{};:>,]/,
        completeSingle: false,
        hint: this.getNoteCompletion.bind(this),
      });
    }
  }

  private async hintForElements(
    { id: noteId, title }: { id: string; title: string },
    start: Position,
    titleRange: [Position, Position],
  ) {
    const html = await this.context.postMessage<string>({
      event: 'fetchNoteHtml',
      payload: { id: noteId },
    });

    const document = new DOMParser().parseFromString(html, 'text/html');
    const isHeading = (el: Element) => ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName);
    const list: Hint[] = [...document.querySelectorAll('[id]')].map((el, index, els) => {
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
        text: `#${el.id}`,
        className: HINT_ITEM_CLASS,
        render: (container) => {
          container.innerHTML = `${' '.repeat(level - 1)}${icon}${el.id}`;
        },
      };
    });

    if (list.length === 0) {
      this.afterCompletion('note', titleRange);
      return;
    }

    this.editor.showHint({
      completeSingle: false,
      closeCharacters: /[()\[\]{};:>,]/,
      hint: () => {
        const { line: cursorLine, ch: cursorCh } = this.doc.getCursor();
        const { line, ch } = start;

        if (cursorLine < line || cursorCh < ch) {
          return;
        }

        const keyword = this.doc.getRange({ line, ch }, { line: cursorLine, ch: cursorCh });
        const completion = {
          from: { line: start.line, ch: start.ch },
          to: { line: start.line, ch: start.ch + keyword.length },
          list,
          selectedHint: list.findIndex(({ text }) => text.slice(1).includes(keyword)),
        };

        const handleClose: any = () => {
          if (!this.symbolRange) {
            throw new Error('no symbolRange');
          }

          const { from } = this.symbolRange;

          if (!keyword) {
            this.afterCompletion('element', [
              { line: from.line, ch: from.ch + 1 },
              { line: from.line, ch: from.ch + 1 + title.length },
            ]);
          }
        };

        this.cm.on(completion, 'close', handleClose);
        this.cm.on(completion, 'pick', (({ text }: Hint) => {
          this.cm.off(completion, 'close', handleClose);

          const { line: cursorLine, ch: cursorCh } = this.doc.getCursor();
          const titleEnd = cursorCh - (text.length + noteId.length + 4);

          if (!this.isUrlOnly) {
            this.doc.replaceRange(text, {
              line: cursorLine,
              ch: titleEnd,
            });
          }

          this.afterCompletion('element', [
            { line: cursorLine, ch: titleEnd - title.length },
            { line: cursorLine, ch: titleEnd + text.length },
          ]);
        }) as any);

        return completion;
      },
    });
  }

  private afterCompletion(source: 'note' | 'element', titleRange: [Position, Position]) {
    const { line, ch } = this.doc.getCursor();

    if (this.actionAfterCompletion === ActionAfterCompletion.MoveCursorToEnd || this.isUrlOnly) {
      if (source === 'element') {
        this.doc.setCursor({ line, ch: ch + 1 });
      }

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
      this.afterCompletion('note', [
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
    const notes = await this.context.postMessage<SearchResult[]>({
      event: 'searchNotes',
      payload: { keyword: keyword },
    });
    const { from } = this.symbolRange;
    const to = { line, ch: ch + keyword.length };
    const hintList: Hint[] = notes.map(({ title, id, path }) => ({
      text: this.isUrlOnly ? `:/${id}` : `[${title}](:/${id})`,
      className: HINT_ITEM_CLASS,
      render(container) {
        container.innerHTML =
          title + (path ? `<span class="${HINT_ITEM_PATH_CLASS}">${path}</span>` : '');
      },
      title,
      id,
    }));
    const isCreatingNewNote = hintList.length === 0 && this.createNoteEnabled;
    const completion: Completion = {
      from,
      to,
      list: isCreatingNewNote ? this.getNewNoteHints(keyword) : hintList,
    };

    if (!isCreatingNewNote) {
      this.cm.on(completion, 'pick', ((hint: Hint) => {
        const titleRange = [
          { line: to.line, ch: from.ch + 1 },
          { line: to.line, ch: from.ch + hint.title!.length + 1 },
        ] as [Position, Position];

        let positionAfterNoteId = {
          line: to.line,
          ch: from.ch + hint.text.length - 1,
        };

        if (this.isUrlOnly) {
          const token = this.editor.getTokenAt({ line: cursorLine, ch: cursorCh });
          this.doc.replaceRange(
            hint.text,
            { line: to.line, ch: token.start },
            { line: to.line, ch: token.end },
          );

          positionAfterNoteId.ch = token.start + hint.text.length;
        }

        if (!this.linkToElementEnabled) {
          this.afterCompletion('note', titleRange);
          return;
        }

        this.doc.setCursor(positionAfterNoteId);
        this.hintForElements({ id: hint.id!, title: hint.title! }, positionAfterNoteId, titleRange);
      }) as any);
    }

    return completion;
  }
}
