import { SettingItem, SettingItemType } from 'api/types';
import {
  NOTE_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_SETTING,
  REFERRER_ELEMENT_NUMBER_ENABLED,
  REFERRER_ELEMENT_NUMBER_TYPE,
  REFERRER_LIST_HEADING_SETTING,
  REFERRER_AUTO_LIST_POSITION_SETTING,
  REFERRER_AUTO_LIST_ENABLED_SETTING,
  REFERRER_VIEW_REFERENCE_LIST_SETTING,
  REFERRER_PANEL_ENABLED_SETTING,
  REFERRER_PANEL_TITLE_SETTING,
  REFERRER_PANEL_STYLESHEET_SETTING,
  REFERRER_IDENTIFIER_ENABLED_SETTING,
  QUICK_LINK_ENABLED_SETTING,
  QUICK_LINK_SYMBOL_SETTING,
  QUICK_LINK_SEARCH_PATTERN_SETTING,
  QUICK_LINK_ELEMENTS_ENABLED_SETTING,
  QUICK_LINK_AFTER_COMPLETION_SETTING,
  QUICK_LINK_SHOW_PATH_SETTING,
  QUICK_LINK_CREATE_NOTE_SETTING,
} from 'driver/constants';
import {
  ReferrersAutoListPosition,
  ReferrersAutoListEnabled,
  ReferrersListNumberType,
  ReferenceListExpandMode,
} from '../markdownView/webview/constants';
import { ActionAfterCompletion } from '../codeMirror/constants';

export const SECTION_NAME = 'Note Link';

const setting: Record<string, SettingItem> = {
  [REFERRER_LIST_HEADING_SETTING]: {
    label: 'Markdown View: Referrers List Heading Text',
    type: SettingItemType.String,
    public: true,
    value: 'Backlinks', // compatible with [Automatic backlinks Plugin](https://discourse.joplinapp.org/t/insert-referencing-notes-backlinks-plugin/13632)
    section: SECTION_NAME,
    description: 'Text in Headings(h1-h6) for auto & manually inserted referrers list',
  },
  [REFERRER_AUTO_LIST_ENABLED_SETTING]: {
    label: 'Markdown View: Enable/Disable Auto Referrers List Insertion',
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
    label: 'Markdown View: Auto Inserted Referrers List Position',
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
    label: 'Markdown View: Enable Referrers Count Of Elements',
    type: SettingItemType.Bool,
    public: true,
    value: true,
    section: SECTION_NAME,
  },
  [REFERRER_ELEMENT_NUMBER_TYPE]: {
    label: 'Markdown View: Which Number Should Be Displayed For Referred Elements',
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
  [REFERRER_VIEW_REFERENCE_LIST_SETTING]: {
    section: SECTION_NAME,
    public: true,
    label: 'Markdown View: Expand reference list by default',
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
    label: 'Markdown View: Enable Identifier Icon For Copying Url',
    type: SettingItemType.Bool,
    public: true,
    value: true,
    section: SECTION_NAME,
  },
  [REFERRER_PANEL_ENABLED_SETTING]: {
    label: 'Panel: Enable',
    type: SettingItemType.Bool,
    public: true,
    value: false,
    section: SECTION_NAME,
    description: 'Display referrers in panel',
  },
  [REFERRER_PANEL_TITLE_SETTING]: {
    label: 'Panel: Title',
    type: SettingItemType.String,
    public: true,
    value: 'REFERRERS',
    section: SECTION_NAME,
  },
  [QUICK_LINK_ENABLED_SETTING]: {
    label: 'Quick Link: Enable',
    type: SettingItemType.Bool,
    public: true,
    value: true,
    section: SECTION_NAME,
  },
  [QUICK_LINK_SHOW_PATH_SETTING]: {
    label: 'Quick Link: Display Path Of Note',
    type: SettingItemType.Bool,
    public: true,
    value: false,
    section: SECTION_NAME,
  },
  [QUICK_LINK_ELEMENTS_ENABLED_SETTING]: {
    label: 'Quick Link: Enable Link To Element',
    type: SettingItemType.Bool,
    public: true,
    value: true,
    section: SECTION_NAME,
  },
  [QUICK_LINK_CREATE_NOTE_SETTING]: {
    label: 'Quick Link: Enable Create New Note',
    type: SettingItemType.Bool,
    public: true,
    value: false,
    section: SECTION_NAME,
  },
  [QUICK_LINK_SYMBOL_SETTING]: {
    label: 'Quick Link: Symbols To Trigger',
    type: SettingItemType.String,
    public: true,
    value: '@@',
    section: SECTION_NAME,
  },
  [QUICK_LINK_AFTER_COMPLETION_SETTING]: {
    label: 'Quick Link: What Happen After Completion',
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

  // below are advanced
  [REFERRER_PANEL_STYLESHEET_SETTING]: {
    label: 'Panel: Stylesheet',
    type: SettingItemType.String,
    public: true,
    advanced: true,
    section: SECTION_NAME,
    value: '',
    description: 'CSS For panel',
  },
  [QUICK_LINK_SEARCH_PATTERN_SETTING]: {
    section: SECTION_NAME,
    label: 'Filter For Quick Link',
    type: SettingItemType.String,
    public: true,
    value: 'title: $keyword*',
    advanced: true,
    description: `Search filter for making quick links in editor. Filters can be found at https://joplinapp.org/help/#search-filters. ${NOTE_SEARCH_PATTERN_PLACEHOLDER} is the placeholder for keyword you typed in.`,
  },
  [REFERRER_SEARCH_PATTERN_SETTING]: {
    label: 'Filter For Searching Referrers',
    type: SettingItemType.String,
    public: true,
    advanced: true,
    section: SECTION_NAME,
    value: '/:/$noteId',
    description: `Search filter for searching for referrers. Filters can be found at https://joplinapp.org/help/#search-filters. ${REFERRER_SEARCH_PATTERN_PLACEHOLDER} is the placeholder for note id of current note.`,
  },
};

export default setting;
