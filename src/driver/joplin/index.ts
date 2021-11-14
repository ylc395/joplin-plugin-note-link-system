import joplin from 'api';
import { ContentScriptType, ToolbarButtonLocation } from 'api/types';
import {
  Request,
  CreateNoteRequest,
  SearchReferrersRequest,
  OpenNoteRequest,
  MARKDOWN_SCRIPT_ID,
  CODE_MIRROR_SCRIPT_ID,
  REFERRER_LIST_HEADING_SETTING,
} from 'driver/constants';
import { SearchEngine } from './SearchEngine';
import setting, { SECTION_NAME } from './setting';
import { PanelView } from '../panelView';
import { Reference } from 'model/Referrer';

export default class App {
  private searchEngine?: SearchEngine;
  private justStartApp = true;
  private reference?: Reference;
  async init() {
    await this.setupSetting();

    this.searchEngine = new SearchEngine();

    await this.setupCodeMirror();
    await this.setupToolbar();
    await this.setupMarkdownView();
    await this.setupPanel();
  }

  private async openNote({ noteId, reference }: OpenNoteRequest['payload']) {
    const selectedNoteId = (await joplin.workspace.selectedNote()).id;

    if (reference) {
      this.reference = { ...reference, toNoteId: selectedNoteId };
    }

    joplin.commands.execute('openNote', noteId);
  }

  private getReference() {
    const reference = this.reference;
    this.reference = undefined;

    return reference;
  }

  private async searchReferrers(payload: SearchReferrersRequest['payload']) {
    if (!this.searchEngine) {
      throw new Error('no search engine');
    }

    const selectedNoteId = (await joplin.workspace.selectedNote()).id;

    return payload?.elementIds
      ? this.searchEngine.searchReferrersOfElements(selectedNoteId, payload.elementIds)
      : this.searchEngine.searchReferrers(selectedNoteId);
  }

  private queryIsJustStart() {
    const result = this.justStartApp;
    this.justStartApp = false;

    return result;
  }

  async requestHandler(request: Request) {
    if (!this.searchEngine) {
      throw new Error('no search engine');
    }

    switch (request.event) {
      case 'querySetting':
        return joplin.settings.value(request.payload.key);
      case 'openNote':
        return this.openNote(request.payload);
      case 'queryFromReference':
        return this.getReference();
      case 'writeClipboard':
        return joplin.clipboard.writeText(request.payload.content);
      case 'searchReferrers':
        return this.searchReferrers(request.payload);
      case 'queryCurrentNote':
        return joplin.workspace.selectedNote();
      case 'searchNotes':
        return this.searchEngine.searchNotes(request.payload.keyword);
      case 'fetchNote':
        return joplin.data.get(['notes', request.payload.id], { fields: 'body' });
      case 'createNote':
        return App.createNote(request.payload);
      case 'queryJustStartApp':
        return this.queryIsJustStart();
      case 'scrollToHash':
        return joplin.commands.execute('scrollToHash', request.payload.hash);
      default:
        break;
    }
  }

  async setupMarkdownView() {
    await joplin.contentScripts.register(
      ContentScriptType.MarkdownItPlugin,
      MARKDOWN_SCRIPT_ID,
      './driver/markdownView/index.js',
    );

    await joplin.contentScripts.onMessage(MARKDOWN_SCRIPT_ID, this.requestHandler.bind(this));
  }

  async setupPanel() {
    if (!this.searchEngine) {
      throw new Error('no search engine');
    }

    const panelId = await joplin.views.panels.create('panel');
    await joplin.views.panels.addScript(panelId, './driver/panelView/script.js');
    await joplin.views.panels.addScript(panelId, './driver/panelView/style.css');
    await joplin.views.panels.onMessage(panelId, this.requestHandler.bind(this));

    new PanelView(panelId, this.searchEngine);
  }

  async setupCodeMirror() {
    await joplin.contentScripts.register(
      ContentScriptType.CodeMirrorPlugin,
      CODE_MIRROR_SCRIPT_ID,
      './driver/codeMirror/index.js',
    );

    await joplin.contentScripts.onMessage(CODE_MIRROR_SCRIPT_ID, this.requestHandler.bind(this));
  }

  async setupSetting() {
    await joplin.settings.registerSection(SECTION_NAME, {
      label: SECTION_NAME,
    });

    await joplin.settings.registerSettings(setting);
  }

  async setupToolbar() {
    const commandName = 'insertReferrersList';

    await joplin.commands.register({
      name: commandName,
      label: 'Insert a referrers list',
      iconName: 'fas fa-hand-point-left',
      execute: async () => {
        const text = await joplin.settings.value(REFERRER_LIST_HEADING_SETTING);
        joplin.commands.execute('replaceSelection', `# ${text}`);
      },
    });

    await joplin.views.toolbarButtons.create(
      'insert-referrers-list',
      commandName,
      ToolbarButtonLocation.EditorToolbar,
    );
  }
  private static async createNote({ title, type }: CreateNoteRequest['payload']) {
    const currentNote = await joplin.workspace.selectedNote();
    const currentNotebook = await joplin.data.get(['folders', currentNote.parent_id]);

    return joplin.data.post(['notes'], null, {
      is_todo: type === 'todo',
      title: title,
      parent_id: currentNotebook.id,
    });
  }
}
