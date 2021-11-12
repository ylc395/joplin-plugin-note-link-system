import type { Editor, EditorChangeCancellable, Position } from 'codemirror';
import MarkdownIt from 'markdown-it';
import uslug from 'uslug';
import h1Icon from 'bootstrap-icons/icons/type-h1.svg';
import h2Icon from 'bootstrap-icons/icons/type-h2.svg';
import h3Icon from 'bootstrap-icons/icons/type-h3.svg';
import cardHeadingIcon from 'bootstrap-icons/icons/card-heading.svg';
import boxIcon from 'bootstrap-icons/icons/box.svg';
import markdownItAnchor from 'markdown-it-anchor';
import {
  QuerySettingRequest,
  SearchNotesRequest,
  FetchNoteRequest,
  QUICK_LINK_ENABLED_SETTING,
  QUICK_LINK_SYMBOL_SETTING,
  QUICK_LINK_ELEMENTS_ENABLED_SETTING,
} from 'driver/constants';
import type { SearchedNote, Note } from 'model/Referrer';

export interface Context {
  postMessage: <T>(
    request: QuerySettingRequest | SearchNotesRequest | FetchNoteRequest,
  ) => Promise<T>;
}

// @see https://codemirror.net/doc/manual.html#addon_show-hint
interface Hint {
  text: string;
  displayText?: string;
  className?: string;
  render?: (container: Element, completion: Completion, hint: Hint) => void;
  id?: string; // custom field for our app
}

interface Completion {
  from: Position;
  to: Position;
  list: (Hint | string)[];
  selectedHint?: number;
}

export type ExtendedEditor = Editor & {
  showHint(options: {
    completeSingle: boolean;
    hint: (cm: Editor) => Completion | undefined | Promise<Completion | undefined>;
  }): void;
};

export class QuickLinker {
  constructor(private readonly context: Context, private readonly cm: ExtendedEditor) {
    this.init();
  }

  async init() {
    const enabled = await this.context.postMessage<boolean>({
      event: 'querySetting',
      payload: { key: QUICK_LINK_ENABLED_SETTING },
    });

    if (!enabled) {
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

    // @see https://github.com/laurent22/joplin/blob/725c79d1ec03a712d671498417b0061a1da3073b/packages/renderer/MdToHtml.ts#L560
    this.md = new MarkdownIt({ html: true }).use(markdownItAnchor, { slugify: uslug });
    this.cm.on('cursorActivity', this.triggerHints.bind(this));
  }

  private md?: MarkdownIt;
  private readonly doc = this.cm.getDoc();
  private triggerSymbol?: string;
  private symbolRange?: { from: Position; to: Position };
  private linkToElementEnabled?: boolean;

  private triggerHints() {
    if (!this.triggerSymbol) {
      return;
    }

    const to = this.doc.getCursor();

    const symbolRange = [{ line: to.line, ch: to.ch - this.triggerSymbol.length }, to] as const;
    const chars = this.doc.getRange(...symbolRange);

    if (chars === this.triggerSymbol) {
      this.symbolRange = { from: symbolRange[0], to: symbolRange[1] };
      this.cm.showHint({
        completeSingle: false,
        hint: this.getHints.bind(this),
      });
    }
  }

  private async hintForElements(noteId: string, start: Position) {
    if (!this.md) {
      throw new Error('no md');
    }

    const { body } = await this.context.postMessage<Pick<Note, 'body'>>({
      event: 'fetchNote',
      payload: { id: noteId },
    });

    const html = this.md.render(body);
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
        className: 'note-link-element-hint',
        render: (container) => {
          container.innerHTML = `${' '.repeat(level - 1)}${icon}${el.id}`;
        },
      };
    });

    this.cm.showHint({
      completeSingle: false,
      hint: () => {
        const { line: cursorLine, ch: cursorCh } = this.doc.getCursor();
        const { line, ch } = start;

        if (cursorLine < line || cursorCh < ch) {
          return;
        }

        this.setElementPicker(noteId);

        const keyword = this.doc.getRange({ line, ch }, { line: cursorLine, ch: cursorCh });

        return {
          from: { line: start.line, ch: start.ch },
          to: { line: start.line, ch: start.ch + keyword.length },
          list,
          selectedHint: list.findIndex(({ text }) => text.slice(1).includes(keyword)),
        };
      },
    });
  }

  private setNotePicker() {
    if (!this.linkToElementEnabled) {
      return;
    }

    const { completionActive } = this.cm.state;
    const originPick = completionActive.pick.bind(completionActive);

    completionActive.pick = (
      { from, list, to }: { from: Position; to: Position; list: Hint[] },
      index: number,
    ) => {
      originPick({ from, list, to }, index);

      const completion = list[index];
      const newCursorPosition = { line: to.line, ch: from.ch + completion.text.length - 1 };

      this.doc.setCursor(newCursorPosition);

      if (completion.id) {
        this.hintForElements(completion.id, newCursorPosition);
      }
    };
  }

  private setElementPicker(noteId: string) {
    const { completionActive } = this.cm.state;
    const originPick = completionActive.pick.bind(completionActive);

    completionActive.pick = (
      { from, list, to }: { from: Position; to: Position; list: Hint[] },
      index: number,
    ) => {
      originPick({ from, list, to }, index);

      const { text } = list[index];
      const { line: cursorLine, ch: cursorCh } = this.doc.getCursor();

      this.doc.replaceRange(text, {
        line: cursorLine,
        ch: cursorCh - (text.length + noteId.length + 4),
      });
    };
  }

  private async getHints() {
    if (!this.symbolRange) {
      throw new Error('no symbolRange');
    }

    const { line, ch } = this.symbolRange.to;
    const { line: cursorLine, ch: cursorCh } = this.doc.getCursor();

    if (cursorLine < line || cursorCh < ch) {
      return;
    }

    this.setNotePicker();

    const keyword = this.doc.getRange({ line, ch }, { line: cursorLine, ch: cursorCh });
    const notes = await this.context.postMessage<SearchedNote[]>({
      event: 'searchNotes',
      payload: { keyword: keyword },
    });

    return {
      from: this.symbolRange.from,
      to: { line, ch: ch + keyword.length },
      list: notes.map(({ title, id }) => ({ text: `[${title}](:/${id})`, displayText: title, id })),
    };
  }
}
