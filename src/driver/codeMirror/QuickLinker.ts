import { Editor, Position } from 'codemirror';
import {
  QuerySettingRequest,
  SearchNotesRequest,
  QUICK_LINK_ENABLED_SETTING,
  QUICK_LINK_SYMBOL_SETTING,
} from 'driver/constants';
import type { SearchedNote } from 'model/Referrer';

export interface Context {
  postMessage: <T>(request: QuerySettingRequest | SearchNotesRequest) => Promise<T>;
}

// @see https://codemirror.net/doc/manual.html#addon_show-hint
interface Completion {
  text: string;
  displayText?: string;
  className?: string;
}

export type ExtendedEditor = Editor & {
  showHint(options?: {
    completeSingle: boolean;
    hint: (cm: Editor) => Promise<{ from: Position; to: Position; list: (Completion | string)[] }>;
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
    this.cm.on('cursorActivity', this.triggerHints.bind(this));
  }

  private readonly doc = this.cm.getDoc();

  private triggerSymbol?: string;
  private symbolRange?: { from: Position; to: Position };

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

  private async getHints() {
    if (!this.symbolRange) {
      throw new Error('no symbolRange');
    }

    const { line, ch } = this.symbolRange.to;
    const { line: cursorLine, ch: cursorCh } = this.doc.getCursor();
    const keyword = this.doc.getRange({ line, ch }, { line: cursorLine, ch: cursorCh });

    const notes = await this.context.postMessage<SearchedNote[]>({
      event: 'searchNotes',
      payload: { keyword: keyword },
    });

    return {
      from: this.symbolRange.from,
      to: { line, ch: ch + keyword.length },
      list: notes.map(({ title, id }) => ({ text: `[${title}](:/${id})`, displayText: title })),
    };
  }
}
