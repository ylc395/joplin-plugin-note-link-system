import joplin from 'api';
import { ContentScriptType, ToolbarButtonLocation } from 'api/types';
import MarkdownIt from 'markdown-it';
import uslug from 'uslug';
import markdownItAnchor from 'markdown-it-anchor';
import {
  Request,
  CreateNoteRequest,
  SearchReferrersRequest,
  OpenNoteRequest,
  MARKDOWN_SCRIPT_ID,
  CODE_MIRROR_SCRIPT_ID,
  REFERRER_LIST_HEADING_SETTING,
} from 'driver/constants';
import SearchEngine, { getResourcesOf } from './SearchEngine';
import setting, { SECTION_NAME } from './setting';
import { ReferrerPanelView } from '../referrerPanelView';
import { Reference } from 'model/Referrer';

export default class App {
  private searchEngine?: SearchEngine;
  private reference?: Reference;
  // @see https://github.com/laurent22/joplin/blob/725c79d1ec03a712d671498417b0061a1da3073b/packages/renderer/MdToHtml.ts#L560
  private readonly md = new MarkdownIt({ html: true }).use(markdownItAnchor, { slugify: uslug });
  private referrerPanel?: ReferrerPanelView;
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

  private async getNoteHtml(noteId: string) {
    const { body } = await joplin.data.get(['notes', noteId], { fields: 'body' });
    return this.md.render(body);
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
      case 'fetchNoteHtml':
        return this.getNoteHtml(request.payload.id);
      case 'createNote':
        return App.createNote(request.payload);
      case 'scrollToHash':
        return joplin.commands.execute('scrollToHash', request.payload.hash);
      case 'queryNote':
        return this.searchEngine.getNote(request.payload.id, true);
      case 'queryNoteResources':
        return getResourcesOf(request.payload.noteId);
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
    await joplin.views.panels.addScript(panelId, './driver/referrerPanelView/script.js');
    await joplin.views.panels.addScript(panelId, './driver/referrerPanelView/style.css');
    await joplin.views.panels.onMessage(panelId, this.requestHandler.bind(this));

    this.referrerPanel = new ReferrerPanelView(panelId, this.searchEngine);
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
    const insertList = 'insertReferrersList';
    const toggleReferrersPanel = 'toggleReferrersPanel';

    await joplin.commands.register({
      name: insertList,
      label: 'Insert a referrers list',
      iconName: 'fas fa-hand-point-left',
      execute: this.insertReferrerList.bind(this),
    });

    await joplin.commands.register({
      name: toggleReferrersPanel,
      label: 'Toggle referrers panel ',
      iconName: 'fas fa-hand-point-left',
      execute: async () => {
        if (!this.referrerPanel) {
          throw new Error('no referrer panel');
        }

        this.referrerPanel.toggle();
      },
    });

    await joplin.views.toolbarButtons.create(
      'insert-referrers-list',
      insertList,
      ToolbarButtonLocation.EditorToolbar,
    );

    await joplin.views.toolbarButtons.create(
      'toggle-referrers-panel',
      toggleReferrersPanel,
      ToolbarButtonLocation.NoteToolbar,
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
      'replaceSelection',
      `\n${'#'.repeat(Number.isFinite(minLevel) ? minLevel : 1)} ${text}`,
    );
  }
}
