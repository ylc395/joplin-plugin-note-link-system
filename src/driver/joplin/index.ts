import joplin from 'api';
import { ContentScriptType, SettingItemType } from 'api/types';
import {
  NOTE_SEARCH_PATTERN_PLACEHOLDER,
  NOTE_SEARCH_PATTERN_SETTING,
  REFERRER_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_SETTING,
  MARKDOWN_SCRIPT_ID,
  CODE_MIRROR_SCRIPT_ID,
  REFERRER_LIST_HEADING_SETTING,
  REFERRER_AUTO_LIST_SETTING,
  ReferrersAutoListPosition,
} from 'driver/constants';
import type { Request as CodeMirrorRequest } from 'driver/codeMirror/type';
import type { Request as MarkdownViewRequest } from 'driver/markdownView/type';
import { SearchEngine } from './SearchEngine';

export async function setupSetting() {
  const SECTION_NAME = 'Note Link';

  await joplin.settings.registerSection(SECTION_NAME, {
    label: SECTION_NAME,
  });

  await joplin.settings.registerSettings({
    [REFERRER_LIST_HEADING_SETTING]: {
      label: 'Referrers - View: Referrers List Heading',
      type: SettingItemType.String,
      public: true,
      value: 'Backlinks', // compatible with [Automatic backlinks Plugin](https://discourse.joplinapp.org/t/insert-referencing-notes-backlinks-plugin/13632)
      section: SECTION_NAME,
      description:
        'Text in Headings(h1-h6) representing for referrers list(need to restart Joplin). You can always insert a referrers list heading manually to display the list',
    },
    [REFERRER_AUTO_LIST_SETTING]: {
      label: 'Referrers - View: Auto Referrers List Insertion',
      type: SettingItemType.Int,
      isEnum: true,
      public: true,
      value: ReferrersAutoListPosition.NoteEnd,
      section: SECTION_NAME,
      options: {
        [ReferrersAutoListPosition.None]: 'Disabled',
        [ReferrersAutoListPosition.NoteStart]: 'Displayed in note start',
        [ReferrersAutoListPosition.NoteEnd]: 'Displayed in note end',
      },
      description:
        'Auto insertion will always be disabled if there are manual insertions in a note',
    },
    [REFERRER_SEARCH_PATTERN_SETTING]: {
      label: 'Referrers: Search Filter',
      type: SettingItemType.String,
      public: true,
      advanced: true,
      section: SECTION_NAME,
      value: 'body: (:/$noteId)',
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

export async function setupMarkdownView() {
  const searchEngine = new SearchEngine();

  await joplin.contentScripts.register(
    ContentScriptType.MarkdownItPlugin,
    MARKDOWN_SCRIPT_ID,
    './driver/markdownView/index.js',
  );

  await joplin.contentScripts.onMessage(
    MARKDOWN_SCRIPT_ID,
    async (request: MarkdownViewRequest) => {
      switch (request.event) {
        case 'querySetting':
          return joplin.settings.value(request.payload.key);
        case 'openNote':
          return joplin.commands.execute('openNote', request.payload.noteId);
        case 'searchReferrers':
          return request.payload?.elementIds
            ? searchEngine.searchReferrersOfElements(
                (await joplin.workspace.selectedNote()).id,
                request.payload.elementIds,
              )
            : searchEngine.searchReferrers((await joplin.workspace.selectedNote()).id);
        default:
          break;
      }
    },
  );
}

export async function setupCodeMirror() {
  await joplin.contentScripts.register(
    ContentScriptType.CodeMirrorPlugin,
    CODE_MIRROR_SCRIPT_ID,
    './driver/codeMirror/index.js',
  );

  await joplin.contentScripts.onMessage(CODE_MIRROR_SCRIPT_ID, (request: CodeMirrorRequest) => {
    switch (request.event) {
      default:
        break;
    }
  });
}
