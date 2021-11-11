import joplin from 'api';
import type { Referrer, SearchedNote, Note } from 'model/Referrer';
import {
  REFERRER_SEARCH_PATTERN_SETTING,
  NOTE_SEARCH_PATTERN_SETTING,
  NOTE_SEARCH_PATTERN_PLACEHOLDER,
  REFERRER_SEARCH_PATTERN_PLACEHOLDER,
  SearchElementReferrersResponse,
} from 'driver/constants';

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

  async searchNotes(keyword?: string): Promise<SearchedNote[]> {
    if (typeof this.noteSearchPattern === 'undefined') {
      throw new Error('no note search pattern');
    }

    if (!this.noteSearchPattern) {
      return [];
    }

    if (keyword) {
      const _keyword = this.noteSearchPattern.replaceAll(NOTE_SEARCH_PATTERN_PLACEHOLDER, keyword);
      return SearchEngine.searchNotes(_keyword);
    } else {
      return (
        await joplin.data.get(['notes'], {
          fields: 'id,title',
          order_by: 'updated_time',
          order_dir: 'DESC',
          limit: 20,
        })
      ).items;
    }
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
      const notes = await SearchEngine.getDetailedNotes(await SearchEngine.searchNotes(keyword));

      return notes.map((note) => ({
        ...note,
        mentionCount: SearchEngine.getMentionCount(`:/${noteId}`, note.body),
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
        const keyword = this.referrerSearchPattern.replaceAll(
          REFERRER_SEARCH_PATTERN_PLACEHOLDER,
          `${noteId}#${elementId}`,
        );
        const referrers = await SearchEngine.getDetailedNotes(
          await SearchEngine.searchNotes(keyword),
        );

        if (referrers.length > 0) {
          result[elementId] = referrers.map((referrer) => ({
            ...referrer,
            mentionCount: SearchEngine.getMentionCount(`(:/${noteId}#${elementId})`, referrer.body),
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

  private static async searchNotes(query: string): Promise<SearchedNote[]> {
    let result: Referrer[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { items, has_more } = await joplin.data.get(['search'], {
        query,
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

  private static getMentionCount(keyword: string, content: string) {
    const keywordLength = keyword.length;
    let index = 0;
    let count = 0;

    while (true) {
      const currentIndex = content.indexOf(keyword, index);

      if (currentIndex < 0) {
        break;
      }

      index = currentIndex + keywordLength;
      count++;
    }

    return count;
  }
}
