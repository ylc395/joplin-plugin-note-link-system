import joplin from 'api';
import { Note } from 'model/Note';
import {
  REFERRER_SEARCH_PATTERN_SETTING,
  NOTE_SEARCH_PATTERN_SETTING,
  NOTE_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_PLACEHOLDER,
} from 'driver/constants';
import { SearchReferrersResponse } from 'driver/markdownView/type';

interface SearchedNote {
  id: string;
  title: string;
}

export class SearchEngine {
  private noteSearchPattern?: string;
  private referrerSearchPattern?: string;
  private async init(isFirstTime: boolean) {
    this.noteSearchPattern = await joplin.settings.value(NOTE_SEARCH_PATTERN_SETTING);
    this.referrerSearchPattern = await joplin.settings.value(REFERRER_SEARCH_PATTERN_SETTING);

    if (isFirstTime) {
      joplin.settings.onChange(({ keys }) => {
        const needInit =
          keys.includes(REFERRER_SEARCH_PATTERN_SETTING) ||
          keys.includes(NOTE_SEARCH_PATTERN_SETTING);

        if (needInit) {
          this.init(false);
        }
      });
    }
  }

  async searchNotes(keyword: string) {
    if (!this.noteSearchPattern) {
      throw new Error('no search pattern');
    }

    try {
      const notes = await SearchEngine.searchNotes(
        this.noteSearchPattern.replaceAll(NOTE_SEARCH_PATTERN_PLACEHOLDER, keyword),
      );
      return notes;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async searchReferrers(noteId: string) {
    if (!this.referrerSearchPattern) {
      throw new Error('no search pattern');
    }

    try {
      const keyword = this.referrerSearchPattern.replaceAll(
        REFERRER_SEARCH_PATTERN_PLACEHOLDER,
        noteId,
      );
      const notes = await SearchEngine.searchNotes(keyword);

      return notes;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async searchReferrersOfElements(noteId: string, elementIds: string[]) {
    if (!this.referrerSearchPattern) {
      throw new Error('no search pattern');
    }

    try {
      const result = {} as SearchReferrersResponse;

      for (const elementId of elementIds) {
        const keyword = this.referrerSearchPattern.replaceAll(
          REFERRER_SEARCH_PATTERN_PLACEHOLDER,
          `${noteId}#${elementId}`,
        );
        const referrers = await SearchEngine.searchNotes(keyword);

        if (referrers.length > 0) {
          result[elementId] = referrers;
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

  private static async searchNotes(query: string): Promise<SearchedNote[]> {
    let result: Note[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { items, has_more } = await joplin.data.get(['search'], {
        query,
        type: 'note',
        page: page++,
      });

      result = result.concat(items);
      hasMore = has_more;
    }

    return result;
  }
}
