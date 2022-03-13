import type MarkdownIt from 'markdown-it';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItBracketedSpans from 'markdown-it-bracketed-spans';
import { MAKRDOWN_IT_ATTRS_CONFIG } from './markdownConfig';

export default function () {
  return {
    plugin: (markdownIt: MarkdownIt) =>
      markdownIt.use(markdownItAttrs, MAKRDOWN_IT_ATTRS_CONFIG).use(markdownItBracketedSpans),
    assets: function () {
      return [{ name: 'webview/index.js' }, { name: 'webview/style.css' }];
    },
  };
}
