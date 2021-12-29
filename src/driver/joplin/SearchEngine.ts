import joplin from 'api';
import debounce from 'lodash.debounce';
import type { Referrer, Note, Notebook, SearchResult, Resource, File } from 'model/Referrer';
import {
  REFERRER_SEARCH_PATTERN_SETTING,
  QUICK_LINK_SEARCH_PATTERN_SETTING,
  NOTE_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_PLACEHOLDER,
  QUICK_LINK_SHOW_PATH_SETTING,
  REFERRER_LIST_MENTION_TEXT_MAX_LENGTH,
  REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH,
  REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH,
  PREVIEWER_ENABLED_SETTING,
  SearchElementReferrersResponse,
} from 'driver/constants';
import extractMentions from './extract';

export default class SearchEngine {
  private notebooksIndex: Record<string, Notebook> = {};
  private isBuildingIndex = false;
  private noteSearchPattern?: string;
  private currentNoteId?: string;
  private referrerSearchPattern?: string;
  private needPathWhenSearching?: boolean;
  private previewEnabled?: boolean;
  private elementMentionTextLength?: number;
  private noteMentionTextLength?: number;
  private panelMentionTextLength?: number;

  private getMentionTextLength(type: 'element' | 'note' | 'panel') {
    return {
      element: this.elementMentionTextLength,
      note: this.noteMentionTextLength,
      panel: this.panelMentionTextLength,
    }[type];
  }

  private async buildNotebookIndex() {
    if ((!this.needPathWhenSearching && !this.previewEnabled) || this.isBuildingIndex) {
      return;
    }

    this.isBuildingIndex = true;
    this.notebooksIndex = {};
    const notebooks = await fetchAll<Notebook>(['folders']);

    const buildIndex = (notebooks: Notebook[]) => {
      for (const notebook of notebooks) {
        this.notebooksIndex[notebook.id] = notebook;

        if (notebook.children) {
          buildIndex(notebook.children);
        }
      }
    };

    buildIndex(notebooks);
    this.isBuildingIndex = false;
  }

  private async init(isFirstTime: boolean) {
    const buildNoteIndex = debounce(this.buildNotebookIndex.bind(this), 1000);

    [
      this.noteSearchPattern,
      this.referrerSearchPattern,
      this.needPathWhenSearching,
      this.previewEnabled,
      this.elementMentionTextLength,
      this.noteMentionTextLength,
      this.panelMentionTextLength,
    ] = await Promise.all([
      joplin.settings.value(QUICK_LINK_SEARCH_PATTERN_SETTING),
      joplin.settings.value(REFERRER_SEARCH_PATTERN_SETTING),
      joplin.settings.value(QUICK_LINK_SHOW_PATH_SETTING),
      joplin.settings.value(PREVIEWER_ENABLED_SETTING),
      joplin.settings.value(REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH),
      joplin.settings.value(REFERRER_LIST_MENTION_TEXT_MAX_LENGTH),
      joplin.settings.value(REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH),
    ]);

    buildNoteIndex();

    if (isFirstTime) {
      this.currentNoteId = (await joplin.workspace.selectedNote()).id;
      joplin.workspace.onSyncComplete(buildNoteIndex);
      joplin.workspace.onNoteSelectionChange(buildNoteIndex);
      joplin.workspace.onNoteSelectionChange(({ value }: { value: string[] }) => {
        if (value.length === 1) {
          this.currentNoteId = value[0];
        }
      });

      joplin.settings.onChange(({ keys }) => {
        const needInit =
          keys.includes(REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH) ||
          keys.includes(REFERRER_LIST_MENTION_TEXT_MAX_LENGTH) ||
          keys.includes(REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH) ||
          keys.includes(REFERRER_SEARCH_PATTERN_SETTING) ||
          keys.includes(QUICK_LINK_SHOW_PATH_SETTING) ||
          keys.includes(PREVIEWER_ENABLED_SETTING) ||
          keys.includes(QUICK_LINK_SEARCH_PATTERN_SETTING);

        if (needInit) {
          this.init(false);
        }
      });
    }
  }

  async searchNotes(keyword?: string): Promise<SearchResult[]> {
    if (typeof this.noteSearchPattern === 'undefined') {
      throw new Error('no note search pattern');
    }

    if (!this.noteSearchPattern) {
      return [];
    }

    let notes: SearchResult[];
    if (keyword) {
      const _keyword = this.noteSearchPattern.replaceAll(NOTE_SEARCH_PATTERN_PLACEHOLDER, keyword);
      notes = await fetchAll<SearchResult>(['search'], { query: _keyword });
    } else {
      notes = (
        await joplin.data.get(['notes'], {
          fields: 'id,title,parent_id',
          order_by: 'updated_time',
          order_dir: 'DESC',
          limit: 20,
        })
      ).items;
    }

    for (const note of notes) {
      note.isCurrent = note.id === this.currentNoteId;

      if (this.needPathWhenSearching) {
        note.path = this.getPathOfNote(note);
      }
    }

    return notes;
  }

  private getPathOfNote(note: { parent_id: string }) {
    let parentId = note.parent_id;
    let path = '';

    while (this.notebooksIndex[parentId]) {
      path = '/' + this.notebooksIndex[parentId].title + path;
      parentId = this.notebooksIndex[parentId].parent_id;
    }

    return path;
  }

  async searchReferrers(noteId: string, type: 'note' | 'panel'): Promise<Referrer[]> {
    if (typeof this.referrerSearchPattern === 'undefined') {
      throw new Error('no referrers search pattern');
    }

    if (!this.referrerSearchPattern) {
      return [];
    }

    const mentionTextLength = this.getMentionTextLength(type);

    if (typeof mentionTextLength === 'undefined') {
      throw new Error('no mentionTextLength');
    }

    try {
      const keyword = this.referrerSearchPattern.replaceAll(
        REFERRER_SEARCH_PATTERN_PLACEHOLDER,
        noteId,
      );
      const searchResults = await fetchAll<SearchResult>(['search'], {
        query: keyword,
      });
      const notes = await this.getNotes(searchResults.map(({ id }) => id));

      return notes
        .map((note) => ({
          ...note,
          mentions: extractMentions(noteId, note.body, mentionTextLength),
        }))
        .filter(({ mentions }) => mentions.length > 0);
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async searchReferrersOfElements(
    noteId: string,
    elementIds: string[],
  ): Promise<SearchElementReferrersResponse> {
    if (typeof this.referrerSearchPattern === 'undefined') {
      throw new Error('no element referrers search pattern');
    }

    if (!this.referrerSearchPattern) {
      return {};
    }

    const mentionTextLength = this.getMentionTextLength('element');

    if (typeof mentionTextLength === 'undefined') {
      throw new Error('no mentionTextLength');
    }

    try {
      const result = {} as SearchElementReferrersResponse;

      for (const elementId of elementIds) {
        if (!elementId) {
          continue;
        }

        const keyword = this.referrerSearchPattern.replaceAll(
          REFERRER_SEARCH_PATTERN_PLACEHOLDER,
          `${noteId}#${elementId}`,
        );
        const searchResults = await fetchAll<SearchResult>(['search'], {
          query: keyword,
        });
        const referrers = await this.getNotes(searchResults.map(({ id }) => id));

        if (referrers.length > 0) {
          result[elementId] = referrers
            .map((referrer) => ({
              ...referrer,
              mentions: extractMentions(`${noteId}#${elementId}`, referrer.body, mentionTextLength),
            }))
            .filter(({ mentions }) => mentions.length > 0);
        }
      }

      return result;
    } catch (error) {
      console.error(error);
      return {};
    }
  }

  constructor() {
    this.init(true);
  }

  getNote(id: string, needPath: true): Promise<Required<Note>>;
  getNote(id: string, needPath?: false): Promise<Note>;
  async getNote(id: string, needPath = false) {
    const note = (await joplin.data.get(['notes', id], {
      fields: 'id,title,created_time,updated_time,body,parent_id',
    })) as Note;

    if (needPath) {
      note.path = this.getPathOfNote(note);
    }

    return note;
  }

  private getNotes(ids: string[]) {
    return Promise.all(ids.map((id) => this.getNote(id)));
  }
}

async function fetchAll<T>(path: string[], query?: Record<string, unknown>): Promise<T[]> {
  let result: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { items, has_more } = await joplin.data.get(path, {
      ...query,
      page: page++,
    });

    result = result.concat(items);
    hasMore = has_more;
  }

  return result;
}

export async function getResourcesOf(noteId: string) {
  const resources = await fetchAll<Resource>(['notes', noteId, 'resources'], { fields: 'id,mime' });

  if (resources.length === 0) {
    return {};
  }

  const files: File[] = await Promise.all(
    resources.map(({ id }) => joplin.data.get(['resources', id, 'file'])),
  );

  return resources.reduce((result, { id }, index) => {
    result[id] = files[index];
    return result;
  }, {} as Record<string, File>);
}
