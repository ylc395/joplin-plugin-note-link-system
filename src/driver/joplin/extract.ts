import { unified } from 'unified';
import remarkParse from 'remark-parse';
import targetIcon from 'bootstrap-icons/icons/box-arrow-in-left.svg';
import { MAIN_MARK_CLASS_NAME } from 'driver/constants';

// Regex in javascript can not handle markdown link perfectly. For example, [aa[b]ccc](url)
// see https://medium.com/@michael_perrin/match-markdown-links-with-advanced-regex-features-fc5f9f4122bc
const getRegex = (keyword: string) => new RegExp(`\\[([^\\[\\]]*)\\]\\(:/(${keyword}.*?)\\)`, 'g');

export function getMatchesWithRegex(keyword: string, content: string) {
  return [...content.matchAll(getRegex(keyword))].map((match) => ({
    index: match.index,
    length: match[0].length,
  }));
}

export function extractMentionsWithRegex(keyword: string, content: string, prefixLength: number) {
  const regex = getRegex(keyword);
  let mainMarkFound = false;
  const text = content
    .replace(regex, (_, $1, $2, offset) => {
      let isMainMark = false;

      // find main mark on such text:
      // `dddddddd..ddddd [aaa](a-url),[aaa](a-url) dddd...dddd`
      if (offset + `${$1}](${$2})`.length >= prefixLength && !mainMarkFound) {
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

  return {
    text,
    mainMarkFound,
  };
}

const parser = unified().use(remarkParse);
export function getMatchesWithParser(keyword: string, content: string) {
  const rootNode = parser.parse(content);
  const matches: { index?: number; length: number }[] = [];
  const filterLink = (node: typeof rootNode | typeof rootNode.children[number]) => {
    if (node.type === 'link') {
      if (!node.url.includes(keyword)) {
        return;
      }

      const { start, end } = node.position!;
      matches.push({ index: start.offset, length: end.offset! - start.offset! });
      return;
    }

    if ('children' in node) {
      for (const child of node.children) {
        filterLink(child);
      }
    }
  };

  filterLink(rootNode);
  return matches;
}

export function extractMentionsWithParser(keyword: string, content: string, prefixLength: number) {
  const rootNode = parser.parse(content);
  const links: {
    startOffset: number;
    endOffset: number;
    isMain: boolean;
    elementId?: string;
    text: string;
  }[] = [];
  let mainLinkFound = false;

  const findMarks = (node: typeof rootNode | typeof rootNode.children[number]) => {
    if (node.type !== 'link') {
      if ('children' in node) {
        for (const child of node.children) {
          findMarks(child);
        }
      }
      return;
    }

    if (!node.url.includes(keyword)) {
      return;
    }

    let isMain = false;
    const { end, start } = node.position!;
    const elementId = keyword.includes('#') ? '' : node.url.split('#').slice(1).join('#');
    const text = node.children[0].type === 'text' ? node.children[0].value : null;

    if (text === null) {
      throw new Error('no text');
    }

    // find main mark on such text:
    // `dddddddd..ddddd [aaa](a-url),[aaa](a-url) dddd...dddd`
    if (end.offset! >= prefixLength && !mainLinkFound) {
      mainLinkFound = true;
      isMain = true;
    }

    links.push({ startOffset: start.offset!, endOffset: end.offset!, isMain, text, elementId });
  };

  findMarks(rootNode);

  let text = '';
  let offset = 0;
  for (let i = 0; i < links.length; i++) {
    const { startOffset, endOffset, elementId, isMain, text: linkText } = links[i];
    text += content.slice(offset, startOffset);

    const button =
      elementId && isMain
        ? `<button data-note-link-element-id="${elementId}">${targetIcon}</button>`
        : '';

    text += `<mark class="${
      isMain ? MAIN_MARK_CLASS_NAME : 'note-link-mark'
    }">${linkText}${button}</mark>`;

    offset += endOffset;
  }

  text += content.slice(offset);

  return {
    mainMarkFound: mainLinkFound,
    text,
  };
}
