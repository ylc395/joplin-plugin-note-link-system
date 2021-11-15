import joplin from 'api';
import debounce from 'lodash.debounce';
import targetIcon from 'bootstrap-icons/icons/box-arrow-in-left.svg';
import type { Referrer, SearchedNote, Note, Notebook } from 'model/Referrer';
import {
  REFERRER_SEARCH_PATTERN_SETTING,
  QUICK_LINK_SEARCH_PATTERN_SETTING,
  NOTE_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_PLACEHOLDER,
  QUICK_LINK_SHOW_PATH_SETTING,
  SearchElementReferrersResponse,
} from 'driver/constants';

function escapeHtml(html: string) {
  return html.replace(/[\u00A0-\u9999<>&]/gim, (i) => {
    return '&#' + i.charCodeAt(0) + ';';
  });
}

export class SearchEngine {
  private notebooksIndex: Record<string, Notebook> = {};
  private isBuildingIndex = false;
  private noteSearchPattern?: string;
  private referrerSearchPattern?: string;
  private needNotebooks?: boolean;
  private mentionTextLength = 200;

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
    buildNoteIndex();

    if (isFirstTime) {
      joplin.workspace.onSyncComplete(buildNoteIndex);
      joplin.workspace.onNoteSelectionChange(buildNoteIndex);

      joplin.settings.onChange(({ keys }) => {
        const needInit =
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

    if (this.needNotebooks) {
      for (const note of notes) {
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

      return notes.map((note) => ({
        ...note,
        mentions: this.extractMentions(noteId, note.body),
      }));
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
          result[elementId] = referrers.map((referrer) => ({
            ...referrer,
            mentions: this.extractMentions(`${noteId}#${elementId}`, referrer.body),
          }));
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
    const keywordLength = keyword.length;
    const mentions = [];
    let index = 0;

    while (true) {
      const currentIndex = content.indexOf(keyword, index);

      if (currentIndex < 0) {
        break;
      }

      const textFragment = escapeHtml(
        content.slice(
          Math.max(0, currentIndex - Math.ceil(this.mentionTextLength / 2)),
          Math.min(
            content.length - 1,
            currentIndex + keyword.length + Math.ceil(this.mentionTextLength / 2),
          ),
        ),
      );

      const mention = textFragment.replace(
        new RegExp(`\\[([^\\[\\]]*)\\]\\(:/(${keyword}.*?)\\)`, 'g'),
        (_, $1, $2) => {
          const elementId = keyword.includes('#') ? '' : $2.split('#').slice(1).join('#');
          const button = elementId
            ? `<button data-note-link-element-id="${elementId}">${targetIcon}</button>`
            : '';
          return `<mark class="note-link-mark">${$1}${button}</mark>`;
        },
      );

      mentions.push(mention);
      index = currentIndex + keywordLength;
    }

    return mentions;
  }
}
