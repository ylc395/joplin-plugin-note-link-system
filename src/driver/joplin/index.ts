import joplin from 'api';
import { ContentScriptType, SettingItemType, ToolbarButtonLocation } from 'api/types';
import {
  NOTE_SEARCH_PATTERN_PLACEHOLDER,
  NOTE_SEARCH_PATTERN_SETTING,
  REFERRER_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_SETTING,
  MARKDOWN_SCRIPT_ID,
  CODE_MIRROR_SCRIPT_ID,
  REFERRER_LIST_HEADING_SETTING,
  REFERRER_ELEMENT_NUMBER_ENABLED,
  REFERRER_ELEMENT_NUMBER_TYPE,
  REFERRER_AUTO_LIST_POSITION_SETTING,
  REFERRER_AUTO_LIST_ENABLED_SETTING,
  REFERRER_PANEL_ENABLED_SETTING,
  REFERRER_PANEL_TITLE_SETTING,
  REFERRER_PANEL_STYLESHEET_SETTING,
  ReferrersAutoListPosition,
  ReferrersAutoListEnabled,
  ReferrersListNumberType,
} from 'driver/constants';
import requestHandler from './requestHandler';
import { PanelView } from '../panelView';

export async function setupSetting() {
  const SECTION_NAME = 'Note Link';

  await joplin.settings.registerSection(SECTION_NAME, {
    label: SECTION_NAME,
  });

  await joplin.settings.registerSettings({
    [REFERRER_LIST_HEADING_SETTING]: {
      label: 'Referrers - View: Referrers List Heading Text',
      type: SettingItemType.String,
      public: true,
      value: 'Backlinks', // compatible with [Automatic backlinks Plugin](https://discourse.joplinapp.org/t/insert-referencing-notes-backlinks-plugin/13632)
      section: SECTION_NAME,
      description: 'Text in Headings(h1-h6) for auto & manually inserted referrers list',
    },
    [REFERRER_AUTO_LIST_ENABLED_SETTING]: {
      label: 'Referrers - View: Enable/Disable Auto Referrers List Insertion',
      type: SettingItemType.Int,
      isEnum: true,
      public: true,
      value: ReferrersAutoListEnabled.EnabledWhenNoManual,
      section: SECTION_NAME,
      options: {
        [ReferrersAutoListEnabled.Enabled]: 'Always enabled',
        [ReferrersAutoListEnabled.EnabledWhenNoManual]:
          'Enabled only when no manual insertion is existing',
        [ReferrersAutoListEnabled.Disabled]: 'Always disabled',
      },
    },
    [REFERRER_AUTO_LIST_POSITION_SETTING]: {
      label: 'Referrers - View: Auto Inserted Referrers List Position',
      type: SettingItemType.Int,
      isEnum: true,
      public: true,
      value: ReferrersAutoListPosition.Bottom,
      section: SECTION_NAME,
      options: {
        [ReferrersAutoListPosition.Top]: 'Note Top',
        [ReferrersAutoListPosition.Bottom]: 'Note Bottom',
      },
    },
    [REFERRER_ELEMENT_NUMBER_ENABLED]: {
      label: 'Referrers - View: Enable Referrers Count Of Elements',
      type: SettingItemType.Bool,
      public: true,
      value: true,
      section: SECTION_NAME,
    },
    [REFERRER_ELEMENT_NUMBER_TYPE]: {
      label: 'Referrers - View: Which Number Should Be Displayed For Referred Elements',
      type: SettingItemType.Int,
      isEnum: true,
      public: true,
      value: ReferrersListNumberType.ReferencesCount,
      section: SECTION_NAME,
      options: {
        [ReferrersListNumberType.ReferrersCount]: "Referrers' Count",
        [ReferrersListNumberType.ReferencesCount]: "References' Count",
        [ReferrersListNumberType.Both]: 'Both',
      },
    },
    [REFERRER_PANEL_ENABLED_SETTING]: {
      label: 'Referrers - Panel: Enable',
      type: SettingItemType.Bool,
      public: true,
      value: false,
      section: SECTION_NAME,
    },
    [REFERRER_PANEL_TITLE_SETTING]: {
      label: 'Referrers - Panel: Title',
      type: SettingItemType.String,
      public: true,
      value: 'REFERRERS',
      section: SECTION_NAME,
    },
    [REFERRER_SEARCH_PATTERN_SETTING]: {
      label: 'Referrers: Search Filter',
      type: SettingItemType.String,
      public: true,
      advanced: true,
      section: SECTION_NAME,
      value: '/:/$noteId',
      description: `Search filter for searching for referrers. Filters can be found at https://joplinapp.org/help/#search-filters. ${REFERRER_SEARCH_PATTERN_PLACEHOLDER} is the placeholder for note id of current note.`,
    },
    [REFERRER_PANEL_STYLESHEET_SETTING]: {
      label: 'Referrers - Panel: Stylesheet',
      type: SettingItemType.String,
      public: true,
      advanced: true,
      section: SECTION_NAME,
      value: '',
      description: 'CSS For panel',
    },
    [NOTE_SEARCH_PATTERN_SETTING]: {
      section: SECTION_NAME,
      label: 'Quick Link: Search Filter',
      type: SettingItemType.String,
      public: true,
      value: 'title: $keyword',
      advanced: true,
      description: `Search filter for making quick links in editor. Filters can be found at https://joplinapp.org/help/#search-filters. ${NOTE_SEARCH_PATTERN_PLACEHOLDER} is the placeholder for keyword you typed in.`,
    },
  });
}

export async function setupToolbar() {
  const commandName = 'insert referrers list';

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

export async function setupMarkdownView() {
  await joplin.contentScripts.register(
    ContentScriptType.MarkdownItPlugin,
    MARKDOWN_SCRIPT_ID,
    './driver/markdownView/index.js',
  );

  await joplin.contentScripts.onMessage(MARKDOWN_SCRIPT_ID, requestHandler);
}

export async function setupPanel() {
  const panelId = await joplin.views.panels.create('panel');
  await joplin.views.panels.addScript(panelId, './driver/panelView/script.js');
  await joplin.views.panels.addScript(panelId, './driver/panelView/style.css');
  await joplin.views.panels.onMessage(panelId, requestHandler);

  new PanelView(panelId);
}

export async function setupCodeMirror() {
  await joplin.contentScripts.register(
    ContentScriptType.CodeMirrorPlugin,
    CODE_MIRROR_SCRIPT_ID,
    './driver/codeMirror/index.js',
  );

  await joplin.contentScripts.onMessage(CODE_MIRROR_SCRIPT_ID, requestHandler);
}
