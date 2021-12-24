import type MarkdownIt from 'markdown-it';
import { ToolbarButtonLocation } from 'api/types';
import joplin from 'api';
import { REFERRER_LIST_HEADING_SETTING } from 'driver/constants';
import { EXTRA_SYNTAX_ENABLED_SETTING } from 'driver/constants';

export default class ContentEditor {
  constructor(private readonly md: MarkdownIt) {}
  async setupToolbar() {
    const insertListCommand = 'insertReferrersList';

    await joplin.commands.register({
      name: insertListCommand,
      label: 'Insert a referrers list',
      iconName: 'fas fa-hand-point-left',
      execute: this.insertReferrerList.bind(this),
    });

    await joplin.views.toolbarButtons.create(
      'insert-referrers-list',
      insertListCommand,
      ToolbarButtonLocation.EditorToolbar,
    );

    if (await joplin.settings.value(EXTRA_SYNTAX_ENABLED_SETTING)) {
      const command = 'setElementId';

      await joplin.commands.register({
        name: command,
        label: 'Set Element Id',
        iconName: 'fas fa-hashtag',
        execute: this.setElementId.bind(this),
      });

      await joplin.views.toolbarButtons.create(
        'set-element-id',
        command,
        ToolbarButtonLocation.EditorToolbar,
      );
    }
  }

  private async insertReferrerList() {
    const text = await joplin.settings.value(REFERRER_LIST_HEADING_SETTING);
    const noteContent = (await joplin.workspace.selectedNote()).body;
    const tokens = this.md.parse(noteContent, {});
    const minLevel = Math.min(
      ...tokens
        .filter(({ tag }) => ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag))
        .map(({ tag }) => Number(tag[1])),
    );

    joplin.commands.execute(
      // https://github.com/laurent22/joplin/blob/c529b972e3fd7ebbb5383e6f1f8423b90ae3e69d/packages/app-desktop/gui/NoteEditor/editorCommandDeclarations.ts
      'replaceSelection',
      `\n${'#'.repeat(Number.isFinite(minLevel) ? minLevel : 1)} ${text}`,
    );
  }

  private setElementId() {
    return joplin.commands.execute('editor.execCommand', {
      name: 'setElementId',
    });
  }
}
