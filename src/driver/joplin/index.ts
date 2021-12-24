import joplin from 'api';
import { ContentScriptType, ToolbarButtonLocation } from 'api/types';
import MarkdownIt from 'markdown-it';
import uslug from 'uslug';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItBracketedSpans from 'markdown-it-bracketed-spans';
import {
  Request,
  CreateNoteRequest,
  SearchReferrersRequest,
  OpenNoteRequest,
  MARKDOWN_SCRIPT_ID,
  CODE_MIRROR_SCRIPT_ID,
  EXTRA_SYNTAX_ENABLED_SETTING,
} from 'driver/constants';
import SearchEngine, { getResourcesOf } from './SearchEngine';
import setting, { SECTION_NAME } from './setting';
import ContentEditor from './ContentEditor';
import { ReferrerPanelView } from '../referrerPanelView';
import { MAKRDOWN_IT_ATTRS_CONFIG } from '../markdownView/markdownConfig';
import { Reference } from 'model/Referrer';

export default class App {
  private searchEngine?: SearchEngine;
  private reference?: Reference;
  // @see https://github.com/laurent22/joplin/blob/725c79d1ec03a712d671498417b0061a1da3073b/packages/renderer/MdToHtml.ts#L560
  private readonly md = new MarkdownIt({ html: true }).use(markdownItAnchor, { slugify: uslug });
  private editor = new ContentEditor(this.md);
  private referrerPanel?: ReferrerPanelView;
  async init() {
    await this.setupSetting();

    if (await joplin.settings.value(EXTRA_SYNTAX_ENABLED_SETTING)) {
      this.md.use(markdownItAttrs, MAKRDOWN_IT_ATTRS_CONFIG).use(markdownItBracketedSpans);
    }

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
    const syntaxEnabled = await joplin.settings.value(EXTRA_SYNTAX_ENABLED_SETTING);
    const scriptPath = `./driver/markdownView/index${syntaxEnabled ? 'withSyntax' : ''}.js`;
    await joplin.contentScripts.register(
      ContentScriptType.MarkdownItPlugin,
      MARKDOWN_SCRIPT_ID,
      scriptPath,
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
    const toggleReferrersPanel = 'toggleReferrersPanel';

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
      'toggle-referrers-panel',
      toggleReferrersPanel,
      ToolbarButtonLocation.NoteToolbar,
    );
    await this.editor.setupToolbar();
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
