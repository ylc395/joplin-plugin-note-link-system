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
  REFERRER_AUTO_LIST_POSITION_SETTING,
  REFERRER_AUTO_LIST_ENABLED_SETTING,
  REFERRER_PANEL_ENABLED_SETTING,
  REFERRER_PANEL_TITLE_SETTING,
  ReferrersAutoListPosition,
  ReferrersAutoListEnabled,
} from 'driver/constants';
import requestHandler from './requestHandler';

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
    [REFERRER_PANEL_ENABLED_SETTING]: {
      label: 'Referrers - Panel: Enabled',
      type: SettingItemType.Bool,
      public: true,
      value: false,
      section: SECTION_NAME,
    },
    [REFERRER_PANEL_TITLE_SETTING]: {
      label: 'Referrers - Panel: Title',
      type: SettingItemType.String,
      public: true,
      value: 'Backlinks',
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
  let panelVisible = false;
  const panel = await joplin.views.panels.create('panel');
  const enabled = await joplin.settings.value(REFERRER_PANEL_ENABLED_SETTING);

  await joplin.views.panels.addScript(panel, './driver/panelView/index.js');
  await joplin.views.panels.onMessage(panel, requestHandler);

  joplin.settings.onChange(async ({ keys }) => {
    if (keys.includes(REFERRER_PANEL_ENABLED_SETTING)) {
      const enabled = await joplin.settings.value(REFERRER_PANEL_ENABLED_SETTING);

      if (!enabled && panelVisible) {
        joplin.views.panels.hide(panel);
      }

      if (enabled && !panelVisible) {
        joplin.views.panels.show(panel);
      }
    }
  });

  if (enabled) {
    await joplin.views.panels.show(panel);
  }
}

export async function setupCodeMirror() {
  await joplin.contentScripts.register(
    ContentScriptType.CodeMirrorPlugin,
    CODE_MIRROR_SCRIPT_ID,
    './driver/codeMirror/index.js',
  );

  await joplin.contentScripts.onMessage(CODE_MIRROR_SCRIPT_ID, requestHandler);
}
