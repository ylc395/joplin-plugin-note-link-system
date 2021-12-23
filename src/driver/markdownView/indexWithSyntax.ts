import type MarkdownIt from 'markdown-it';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItBracketedSpans from 'markdown-it-bracketed-spans';
import { MAKRDOWN_IT_ATTRS_CONFIG } from './markdownConfig';
import getConfig from './index';

export default function () {
  const config = getConfig();
  config.plugin = (markdownIt: MarkdownIt) =>
    markdownIt.use(markdownItAttrs, MAKRDOWN_IT_ATTRS_CONFIG).use(markdownItBracketedSpans);

  return config;
}
