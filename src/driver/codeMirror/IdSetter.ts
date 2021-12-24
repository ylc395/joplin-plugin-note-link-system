import type { Editor, Range } from 'codemirror';

export default class IdSetter {
  constructor(private readonly editor: Editor) {}
  private readonly doc = this.editor.getDoc();
  setElementId() {
    const [selection] = this.doc.listSelections();
    const { anchor, head } = selection;
    this.editor.focus();

    if (anchor.line !== head.line) {
      return;
    }
    const line = anchor.line;

    if (anchor.ch === head.ch) {
      const placeholder = 'id-of-block';
      const lineContent = this.doc.getLine(line);

      this.doc.replaceRange(` {#${placeholder}}`, { line, ch: lineContent.length });
      this.doc.setSelection(
        { line, ch: lineContent.length + ` {#`.length },
        { line, ch: lineContent.length + ` {#${placeholder}`.length },
      );
    } else {
      const placeholder = 'id-of-element';

      const text = this.doc.getRange({ line, ch: anchor.ch }, { line, ch: head.ch });

      this.doc.replaceRange(
        `[${text}]{#${placeholder}}`,
        { line, ch: anchor.ch },
        { line, ch: head.ch },
      );

      this.doc.setSelection(
        { line, ch: anchor.ch + `[${text}]{#`.length },
        { line, ch: anchor.ch + ` [${text}]{#${placeholder}`.length - 1 },
      );
    }
  }
}
