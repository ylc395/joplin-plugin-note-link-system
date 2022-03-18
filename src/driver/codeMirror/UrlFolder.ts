import debounce from 'lodash.debounce';
import type { Editor } from 'codemirror';
import { URL_FOLD_ICON_SETTING } from 'driver/constants';
import type { Context } from './index';
import { FoldUrlIconType } from './constants';
import { UrlIcon } from '../UrlIcon';

const MARKER_CLASS_NAME = 'note-link-folded-url';

export default class UrlFolder {
  constructor(private readonly context: Context, private readonly editor: Editor) {
    this.init();
  }
  private foldType?: FoldUrlIconType;

  private async init() {
    this.foldType = await this.context.postMessage({
      event: 'querySetting',
      payload: { key: URL_FOLD_ICON_SETTING },
    });

    if (this.foldType !== FoldUrlIconType.None) {
      this.foldAll();
      this.editor.on('cursorActivity', this.unfoldAtCursor.bind(this));
      this.editor.on('cursorActivity', debounce(this.foldAll.bind(this), 200));
    }
  }
  private async foldAll() {
    const doc = this.editor.getDoc();
    const cursor = this.editor.getCursor();
    const tokenTypeAtCursor = this.editor.getTokenTypeAt(cursor);

    doc.eachLine((line) => {
      const lineNo = doc.getLineNumber(line);

      if (lineNo === null) {
        return;
      }

      const lineTokens = this.editor.getLineTokens(lineNo);

      for (const token of lineTokens) {
        if (!token.type?.includes('string url') || token.string.length === 1) {
          continue;
        }

        if (
          this.editor
            .findMarksAt({ line: lineNo, ch: token.start })
            .find((marker) => marker.className === MARKER_CLASS_NAME)
        ) {
          continue;
        }

        if (
          tokenTypeAtCursor?.includes('string url') &&
          cursor.line === lineNo &&
          cursor.ch <= token.end &&
          cursor.ch >= token.start
        ) {
          continue;
        }

        doc.markText(
          { line: lineNo, ch: token.start },
          { line: lineNo, ch: token.end },
          {
            replacedWith: this.createFoldMarker(token.string),
            handleMouseEvents: true,
            className: MARKER_CLASS_NAME, // class name is not renderer in DOM
          },
        );
      }
    });
  }
  private unfoldAtCursor() {
    const cursor = this.editor.getCursor();
    const markers = this.editor.findMarksAt(cursor);

    for (const marker of markers) {
      if (marker.className === MARKER_CLASS_NAME) {
        marker.clear();
      }
    }
  }

  private createFoldMarker(href: string) {
    const markEl = document.createElement('span');
    markEl.classList.add(MARKER_CLASS_NAME);

    if (this.foldType === FoldUrlIconType.Ellipsis) {
      markEl.classList.add('fa', 'fa-ellipsis-h', 'fa-xs');
    }

    if (this.foldType === FoldUrlIconType.Icon) {
      if (href.startsWith(':/')) {
        const iconEl = document.createElement('span');
        iconEl.classList.add('note-link-joplin-icon');
        markEl.appendChild(iconEl);
      } else {
        new UrlIcon(href, markEl);
      }
    }

    return markEl;
  }
}
