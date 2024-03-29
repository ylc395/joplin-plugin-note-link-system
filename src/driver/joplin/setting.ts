import { SettingItem, SettingItemType } from 'api/types';
import {
  NOTE_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_SETTING,
  REFERRER_ELEMENT_NUMBER_ENABLED,
  REFERRER_ELEMENT_NUMBER_TYPE,
  REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH,
  REFERRER_LIST_HEADING_SETTING,
  REFERRER_LIST_MENTION_TEXT_MAX_LENGTH,
  REFERRER_AUTO_LIST_POSITION_SETTING,
  REFERRER_VIEW_REFERENCE_EXPAND_SETTING,
  REFERRER_PANEL_ENABLED_SETTING,
  REFERRER_PANEL_TITLE_SETTING,
  REFERRER_PANEL_STYLESHEET_SETTING,
  REFERRER_PANEL_REFERENCE_EXPAND_SETTING,
  REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH,
  REFERRER_IDENTIFIER_ENABLED_SETTING,
  QUICK_LINK_SYMBOL_SETTING,
  QUICK_LINK_SEARCH_PATTERN_SETTING,
  QUICK_LINK_ELEMENTS_ENABLED_SETTING,
  QUICK_LINK_AFTER_COMPLETION_SETTING,
  QUICK_LINK_SHOW_PATH_SETTING,
  QUICK_LINK_CREATE_NOTE_SETTING,
  PREVIEWER_ENABLED_SETTING,
  PREVIEWER_HOVER_DELAY_SETTING,
  EXTRA_SYNTAX_ENABLED_SETTING,
  URL_ICON_ENABLED_SETTING,
  PREVIEWER_URL_BLACKLIST_SETTING,
  PREVIEWER_URL_BLACKLIST_LOCAL,
  URL_FOLD_ICON_SETTING,
} from 'driver/constants';
import {
  ReferrersAutoListPosition,
  ReferrersListNumberType,
  ReferenceListExpandMode,
} from '../markdownView/webview/constants';
import { ActionAfterCompletion, FoldUrlIconType } from '../codeMirror/constants';

export const SECTION_NAME = 'Note Link';

const setting: Record<string, SettingItem> = {
  [REFERRER_LIST_HEADING_SETTING]: {
    label: 'Markdown View - Referrers: Referrers List Heading Text',
    type: SettingItemType.String,
    public: true,
    value: 'Backlinks', // compatible with [Automatic backlinks Plugin](https://discourse.joplinapp.org/t/insert-referencing-notes-backlinks-plugin/13632)
    section: SECTION_NAME,
    description: 'Text in Headings(h1-h6) for auto & manually inserted referrers list',
  },
  [REFERRER_AUTO_LIST_POSITION_SETTING]: {
    label: 'Markdown View - Referrers: Auto Inserted Referrers List Position',
    type: SettingItemType.Int,
    isEnum: true,
    public: true,
    value: ReferrersAutoListPosition.None,
    section: SECTION_NAME,
    description:
      'Select "None" to disabled auto insertion. Auto insertion will always be disabled when you insert referrers list manually in your note.',
    options: {
      [ReferrersAutoListPosition.None]: 'None',
      [ReferrersAutoListPosition.Top]: 'Note Top',
      [ReferrersAutoListPosition.Bottom]: 'Note Bottom',
    },
  },
  [REFERRER_LIST_MENTION_TEXT_MAX_LENGTH]: {
    label: 'Markdown View - Referrers: Max Text Length Of Digest Of Referrer Of Note',
    type: SettingItemType.Int,
    public: true,
    value: 120,
    section: SECTION_NAME,
    description: 'Left 0 to disabled digest to get better performance',
  },
  [REFERRER_ELEMENT_NUMBER_ENABLED]: {
    label: 'Markdown View - Referrers: Enable Searching Referrers For Elements',
    type: SettingItemType.Bool,
    public: true,
    value: true,
    section: SECTION_NAME,
  },
  [REFERRER_ELEMENT_NUMBER_TYPE]: {
    label: 'Markdown View - Referrers: Which Number Should Be Displayed For Referred Elements',
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
  [REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH]: {
    label: 'Markdown View - Referrers: Max Text Length Of Digest Of Referrer Of Elements',
    type: SettingItemType.Int,
    public: true,
    value: 120,
    section: SECTION_NAME,
    description: 'Left 0 to disabled digest to get better performance',
  },
  [REFERRER_VIEW_REFERENCE_EXPAND_SETTING]: {
    section: SECTION_NAME,
    public: true,
    label: 'Markdown View - Referrers: Expand reference list by default',
    type: SettingItemType.Int,
    isEnum: true,
    value: ReferenceListExpandMode.ExpandNone,
    options: {
      [ReferenceListExpandMode.ExpandBoth]: 'Expand all reference list',
      [ReferenceListExpandMode.ExpandNone]: "Don't expand any reference list",
      [ReferenceListExpandMode.ExpandElementListOnly]: 'Only expand reference list for elements',
      [ReferenceListExpandMode.ExpandNoteListOnly]: 'Only expand reference list for note',
    },
  },
  [REFERRER_IDENTIFIER_ENABLED_SETTING]: {
    label: 'Markdown View - Copy Anchor: Enable Identifier Icon For Copying Url',
    type: SettingItemType.Bool,
    public: true,
    value: true,
    section: SECTION_NAME,
  },
  [PREVIEWER_ENABLED_SETTING]: {
    label: 'Markdown Viewer - Previewer: Enable',
    type: SettingItemType.Bool,
    public: true,
    value: true,
    section: SECTION_NAME,
  },
  [PREVIEWER_HOVER_DELAY_SETTING]: {
    label: 'Markdown Viewer - Previewer: Hover Delay Time(ms)',
    type: SettingItemType.Int,
    public: true,
    value: 800,
    section: SECTION_NAME,
  },
  [URL_ICON_ENABLED_SETTING]: {
    label: 'Markdown View - Url Icon: Enable Icon for External Url',
    type: SettingItemType.Bool,
    public: true,
    value: true,
    section: SECTION_NAME,
  },
  [REFERRER_PANEL_ENABLED_SETTING]: {
    label: 'Panel: Enable',
    type: SettingItemType.Bool,
    public: false,
    value: false,
    section: SECTION_NAME,
    description: 'Display referrers in panel',
  },
  [REFERRER_PANEL_TITLE_SETTING]: {
    label: 'Referrers Panel: Title',
    type: SettingItemType.String,
    public: true,
    value: 'REFERRERS',
    section: SECTION_NAME,
  },
  [REFERRER_PANEL_REFERENCE_EXPAND_SETTING]: {
    label: 'Referrers Panel: Expand Reference List By Default',
    type: SettingItemType.Bool,
    public: true,
    value: false,
    section: SECTION_NAME,
  },
  [REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH]: {
    label: 'Referrers Panel: Max Text Length Of Digest Of Referrer',
    type: SettingItemType.Int,
    public: true,
    value: 120,
    section: SECTION_NAME,
    description: 'Left 0 to disabled digest to get better performance',
  },
  [QUICK_LINK_SYMBOL_SETTING]: {
    label: 'Editor - Quick Link: Symbols To Trigger',
    type: SettingItemType.String,
    public: true,
    value: '@@',
    description: 'Symbols to trigger Quick Link. Left empty to disabled Quick Link',
    section: SECTION_NAME,
  },
  [QUICK_LINK_SHOW_PATH_SETTING]: {
    label: 'Editor - Quick Link: Display Path Of Note',
    type: SettingItemType.Bool,
    public: true,
    value: false,
    section: SECTION_NAME,
  },
  [QUICK_LINK_ELEMENTS_ENABLED_SETTING]: {
    label: 'Editor - Quick Link: Enable Link To Element',
    type: SettingItemType.Bool,
    public: true,
    value: true,
    section: SECTION_NAME,
  },
  [QUICK_LINK_CREATE_NOTE_SETTING]: {
    label: 'Editor - Quick Link: Enable Create New Note',
    type: SettingItemType.Bool,
    public: true,
    value: false,
    section: SECTION_NAME,
  },
  [QUICK_LINK_AFTER_COMPLETION_SETTING]: {
    label: 'Editor - Quick Link: What Happen After Completion',
    isEnum: true,
    type: SettingItemType.Int,
    public: true,
    value: ActionAfterCompletion.SelectText,
    options: {
      [ActionAfterCompletion.MoveCursorToEnd]: 'Move cursor to link end',
      [ActionAfterCompletion.SelectText]: 'Select title of link',
    },
    section: SECTION_NAME,
  },
  [URL_FOLD_ICON_SETTING]: {
    label: 'Editor - Fold Url: Fold url of links and images in editor',
    isEnum: true,
    type: SettingItemType.Int,
    public: true,
    value: FoldUrlIconType.Ellipsis,
    options: {
      [FoldUrlIconType.None]: "Don't fold url",
      [FoldUrlIconType.Ellipsis]: 'Fold into ellipsis',
      [FoldUrlIconType.Icon]: 'Fold into icon',
    },
    section: SECTION_NAME,
  },
  [EXTRA_SYNTAX_ENABLED_SETTING]: {
    label: 'Extra Markdown Syntax: Enable(need to restart Joplin)',
    type: SettingItemType.Bool,
    public: true,
    value: true,
    section: SECTION_NAME,
    description:
      'Enable Bracketed Spans Syntax(https://github.com/mb21/markdown-it-bracketed-spans) And Id Attrs Syntax(https://github.com/arve0/markdown-it-attrs), to mark any text as link target easily.',
  },

  // below are advanced
  [REFERRER_PANEL_STYLESHEET_SETTING]: {
    label: 'Referrers Panel: Stylesheet',
    type: SettingItemType.String,
    public: true,
    advanced: true,
    section: SECTION_NAME,
    value: '',
    description: 'CSS For referrers panel',
  },
  [QUICK_LINK_SEARCH_PATTERN_SETTING]: {
    section: SECTION_NAME,
    label: 'Filter For Quick Link',
    type: SettingItemType.String,
    public: true,
    value: '$keyword*',
    advanced: true,
    description: `Search filter for making quick links in editor. Filters can be found at https://joplinapp.org/help/#search-filters. ${NOTE_SEARCH_PATTERN_PLACEHOLDER} is the placeholder for keyword you typed in.`,
  },
  [REFERRER_SEARCH_PATTERN_SETTING]: {
    label: 'Filter For Searching Referrers',
    type: SettingItemType.String,
    public: true,
    advanced: true,
    section: SECTION_NAME,
    value: '/":/$noteId"',
    description: `Search filter for searching for referrers. Filters can be found at https://joplinapp.org/help/#search-filters. ${REFERRER_SEARCH_PATTERN_PLACEHOLDER} is the placeholder for note id of current note.`,
  },
  [PREVIEWER_URL_BLACKLIST_SETTING]: {
    label: 'Markdown Viewer - Previewer: Url Blacklist',
    type: SettingItemType.String,
    public: true,
    advanced: true,
    section: SECTION_NAME,
    value: '',
    description: `Block previewer for specified URLs. ${PREVIEWER_URL_BLACKLIST_LOCAL} means internal links. Url syntaxs are in https://github.com/fczbkk/UrlMatch. Use comma as splitter`,
  },
};

export default setting;
