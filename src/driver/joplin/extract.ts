import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { escape } from 'html-escaper';
import targetIcon from 'bootstrap-icons/icons/box-arrow-in-left.svg';
import { MAIN_MARK_CLASS_NAME } from 'driver/constants';

const parser = unified().use(remarkParse);
function getFragments(keyword: string, content: string, fragmentLength: number) {
  const rootNode = parser.parse(content);
  const matches: { textFragment: string; prefixLength: number }[] = [];

  const filterLink = (
    node: typeof rootNode | typeof rootNode.children[number],
    ancestors: (typeof rootNode | typeof rootNode.children[number])[],
  ) => {
    if (node.type === 'link') {
      if (node.url.includes(keyword)) {
        let depth = 1;
        let parent = ancestors[ancestors.length - depth];
        let textFragment = content.slice(node.position!.start.offset, node.position!.end.offset);
        let targetNode: typeof parent = node;
        let over = false;
        let prefixLength = 0;
        const maxLength = fragmentLength + `[](:/${node.url})`.length;

        while (parent) {
          if (!('children' in parent)) {
            throw new Error('no child in parent');
          }

          const index = parent.children.findIndex((n) => n === targetNode);
          let siblingOffset = 1;
          let sibling1 = parent.children[index - siblingOffset];
          let sibling2 = parent.children[index + siblingOffset];

          while (sibling1 || sibling2) {
            const prefix = sibling1
              ? content.slice(sibling1.position?.start.offset, targetNode.position?.start.offset)
              : '';

            if (`${prefix}${textFragment}`.length < maxLength) {
              textFragment = `${prefix}${textFragment}`;
              prefixLength += prefix.length;
            } else {
              over = true;
              break;
            }

            const suffix = sibling2
              ? content.slice(targetNode.position?.end.offset, sibling2.position?.end.offset)
              : '';

            if (`${suffix}${textFragment}`.length < maxLength) {
              textFragment = `${textFragment}${suffix}`;
            } else {
              over = true;
              break;
            }

            siblingOffset += 1;

            if (!('children' in parent)) {
              throw new Error('no child in parent');
            }

            sibling1 = parent.children[index - siblingOffset];
            sibling2 = parent.children[index + siblingOffset];
          }

          if (over) {
            break;
          }

          depth += 1;
          targetNode = parent;
          parent = ancestors[ancestors.length - depth];
        }

        matches.push({ textFragment: escape(textFragment), prefixLength });
      }

      return;
    }

    if ('children' in node) {
      for (const child of node.children) {
        filterLink(child, [...ancestors, node]);
      }
    }
  };

  filterLink(rootNode, []);
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

  if (mentionTextLength === 0) {
    return [...content.matchAll(new RegExp(`:/${keyword}`, 'g'))].map(() => '');
  }

  const fragments = getFragments(keyword, content, mentionTextLength);

  for (const { textFragment, prefixLength } of fragments) {
    const { text, mainMarkFound } = extractMention(keyword, textFragment, prefixLength);

    if (mainMarkFound) {
      mentions.push(text);
    }
  }

  return mentions;
}
