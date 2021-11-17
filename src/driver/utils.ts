import { MAIN_MARK_CLASS_NAME } from './constants';

const isElement = (el: Node): el is HTMLElement => el.nodeType === Node.ELEMENT_NODE;
// used in webview
export function truncateMention(mention: string, maxLength: number) {
  const nodes = new DOMParser().parseFromString(mention, 'text/html').body.childNodes;
  const halfLength = Math.ceil(maxLength / 2);
  const markIndex = [...nodes].findIndex((node) => {
    return node.nodeName === 'MARK' && (node as Element).classList.contains(MAIN_MARK_CLASS_NAME);
  });
  if (markIndex < 0) {
    throw new Error('no mark element');
  }

  const htmlFragments: string[] = [(nodes[markIndex] as HTMLElement).outerHTML];

  let prefix = '';
  for (let i = markIndex - 1; i >= 0; i--) {
    const node = nodes[i];
    const text = node.textContent!;

    if (text.length + prefix.length < halfLength) {
      htmlFragments.unshift(isElement(node) ? node.outerHTML : node.textContent!);
      prefix = text + prefix;
    } else if (isElement(node)) {
      break;
    } else {
      const offset = halfLength - prefix.length;
      const slicedText = node.textContent!.slice(-offset);

      htmlFragments.unshift(slicedText);
      prefix = slicedText + text;
      break;
    }
  }

  let suffix = '';
  for (let i = markIndex + 1; i < nodes.length; i++) {
    const node = nodes[i];
    const text = node.textContent!;

    if (text.length + suffix.length < halfLength) {
      htmlFragments.push(isElement(node) ? node.outerHTML : node.textContent!);
      suffix += text;
    } else if (isElement(node)) {
      break;
    } else {
      const offset = halfLength - suffix.length;
      const slicedText = node.textContent!.slice(0, offset);

      htmlFragments.push(slicedText);
      suffix += slicedText;
      break;
    }
  }

  if (prefix) {
    htmlFragments.unshift('...');
  }

  if (suffix) {
    htmlFragments.push('...');
  }

  return htmlFragments.join('');
}
