import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { escape } from 'html-escaper';
import targetIcon from 'bootstrap-icons/icons/box-arrow-in-left.svg';
import { MAIN_MARK_CLASS_NAME } from 'driver/constants';

const parser = unified().use(remarkParse);
function getMatches(keyword: string, content: string) {
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

function extractMention(keyword: string, content: string, prefixLength: number) {
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

export default function extractMentions(
  keyword: string,
  content: string,
  mentionTextLength: number,
) {
  const mentions: string[] = [];
  const matches = getMatches(keyword, content);

  for (const match of matches) {
    const { index, length } = match;

    if (typeof index === 'undefined') {
      continue;
    }

    if (!mentionTextLength) {
      mentions.push('');
      continue;
    }

    const start = Math.max(0, index - Math.ceil(mentionTextLength / 2));
    const end = Math.min(content.length, index + length + Math.ceil(mentionTextLength / 2));
    const textFragment = escape(content.slice(start, end));
    const prefixLength = index - start;
    const { text, mainMarkFound } = extractMention(keyword, textFragment, prefixLength);

    if (mainMarkFound) {
      mentions.push(text);
    }
  }

  return mentions;
}
