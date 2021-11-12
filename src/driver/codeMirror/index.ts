import type CodeMirror from 'codemirror';
import { Context, QuickLinker, ExtendedEditor } from './QuickLinker';

export default function (context: Context) {
  return {
    plugin: function (codemirror: typeof CodeMirror) {
      codemirror.defineOption('quickLinks', false, (cm) => {
        new QuickLinker(context, cm as ExtendedEditor, codemirror);
      });
    },
    codeMirrorOptions: {
      quickLinks: true,
    },
    codeMirrorResources: ['addon/hint/show-hint'],
    assets: () => [{ name: './style.css' }],
  };
}
