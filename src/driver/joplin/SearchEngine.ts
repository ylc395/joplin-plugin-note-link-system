import joplin from 'api';
import debounce from 'lodash.debounce';
import { escape } from 'html-escaper';
import targetIcon from 'bootstrap-icons/icons/box-arrow-in-left.svg';
import type { Referrer, SearchedNote, Note, Notebook } from 'model/Referrer';
import {
  REFERRER_SEARCH_PATTERN_SETTING,
  QUICK_LINK_SEARCH_PATTERN_SETTING,
  NOTE_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_PLACEHOLDER,
  QUICK_LINK_SHOW_PATH_SETTING,
  REFERRER_LIST_MENTION_TEXT_MAX_LENGTH,
  REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH,
  REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH,
  MAIN_MARK_CLASS_NAME,
  SearchElementReferrersResponse,
} from 'driver/constants';

export class SearchEngine {
  private notebooksIndex: Record<string, Notebook> = {};
  private isBuildingIndex = false;
  private noteSearchPattern?: string;
  private currentNoteId?: string;
  private referrerSearchPattern?: string;
  private needNotebooks?: boolean;
  private mentionTextLength?: number;

  private async buildNotebookIndex() {
    if (!this.needNotebooks || this.isBuildingIndex) {
      return;
    }

    this.isBuildingIndex = true;
    this.notebooksIndex = {};
    const notebooks = await SearchEngine.fetchAll<Notebook>(['folders']);

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

    this.noteSearchPattern = await joplin.settings.value(QUICK_LINK_SEARCH_PATTERN_SETTING);
    this.referrerSearchPattern = await joplin.settings.value(REFERRER_SEARCH_PATTERN_SETTING);
    this.needNotebooks = await joplin.settings.value(QUICK_LINK_SHOW_PATH_SETTING);
    this.mentionTextLength = Math.max(
      await joplin.settings.value(REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH),
      await joplin.settings.value(REFERRER_LIST_MENTION_TEXT_MAX_LENGTH),
      await joplin.settings.value(REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH),
    );
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
          keys.includes(QUICK_LINK_SEARCH_PATTERN_SETTING);

        if (needInit) {
          this.init(false);
        }
      });
    }
  }

  async searchNotes(keyword?: string): Promise<SearchedNote[]> {
    if (typeof this.noteSearchPattern === 'undefined') {
      throw new Error('no note search pattern');
    }

    if (!this.noteSearchPattern) {
      return [];
    }

    let notes: SearchedNote[];
    if (keyword) {
      const _keyword = this.noteSearchPattern.replaceAll(NOTE_SEARCH_PATTERN_PLACEHOLDER, keyword);
      notes = await SearchEngine.fetchAll<SearchedNote>(['search'], { query: _keyword });
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
      if (this.needNotebooks) {
        note.path = this.getPathOfNote(note);
      }
    }

    return notes;
  }

  private getPathOfNote(note: SearchedNote) {
    let parentId = note.parent_id;
    let path = '';

    while (this.notebooksIndex[parentId]) {
      path = '/' + this.notebooksIndex[parentId].title + path;
      parentId = this.notebooksIndex[parentId].parent_id;
    }

    return path;
  }

  async searchReferrers(noteId: string): Promise<Referrer[]> {
    if (typeof this.referrerSearchPattern === 'undefined') {
      throw new Error('no referrers search pattern');
    }

    if (!this.referrerSearchPattern) {
      return [];
    }

    try {
      const keyword = this.referrerSearchPattern.replaceAll(
        REFERRER_SEARCH_PATTERN_PLACEHOLDER,
        noteId,
      );
      const notes = await SearchEngine.getDetailedNotes(
        await SearchEngine.fetchAll(['search'], { query: keyword }),
      );

      return notes
        .map((note) => ({
          ...note,
          mentions: this.extractMentions(noteId, note.body),
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
        const referrers = await SearchEngine.getDetailedNotes(
          await SearchEngine.fetchAll(['search'], { query: keyword }),
        );

        if (referrers.length > 0) {
          result[elementId] = referrers
            .map((referrer) => ({
              ...referrer,
              mentions: this.extractMentions(`${noteId}#${elementId}`, referrer.body),
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

  private static async fetchAll<T>(path: string[], query?: Record<string, unknown>): Promise<T[]> {
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

  private static getDetailedNotes(notes: SearchedNote[]) {
    return Promise.all(
      notes.map(({ id }) =>
        joplin.data.get(['notes', id], {
          fields: 'id,title,created_time,updated_time,body',
        }),
      ),
    ) as Promise<Note[]>;
  }

  private extractMentions(keyword: string, content: string) {
    const mentions = [];
    const regex = new RegExp(`\\[([^\\[\\]]*)\\]\\(:/(${keyword}.*?)\\)`, 'g');
    const matches = [...content.matchAll(regex)];

    for (const match of matches) {
      const { index } = match;

      if (typeof index === 'undefined') {
        continue;
      }

      if (!this.mentionTextLength) {
        mentions.push('');
        continue;
      }

      const start = Math.max(0, index - Math.ceil(this.mentionTextLength / 2));
      const end = Math.min(
        content.length,
        index + match[0].length + Math.ceil(this.mentionTextLength / 2),
      );
      const textFragment = escape(content.slice(start, end));
      const prefixLength = index - start;

      let mainMarkFound = false;
      const mention = textFragment
        .replace(regex, (_, $1, $2, offset) => {
          const realOffset = offset + `${$1}](${$2})`.length;
          let isMainMark = false;

          if (realOffset >= prefixLength && !mainMarkFound) {
            mainMarkFound = true;
            isMainMark = true;
          }

          const elementId = keyword.includes('#') ? '' : $2.split('#').slice(1).join('#');
          const button =
            elementId && isMainMark
              ? `<button data-note-link-element-id="${elementId}">${targetIcon}</button>`
              : '';
          return `<mark class="${
            isMainMark ? MAIN_MARK_CLASS_NAME : 'note-link-mark'
          }">${$1}${button}</mark>`;
        })
        .trim();

      if (mainMarkFound) {
        mentions.push(mention);
      }
    }

    return mentions;
  }
}
