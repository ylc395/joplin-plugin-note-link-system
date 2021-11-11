import type CodeMirror from 'codemirror';
import { Context, QuickLinkMonitor, ExtendedEditor } from './QuickLinkMonitor';

export default function (context: Context) {
  return {
    plugin: function (codemirror: typeof CodeMirror) {
      codemirror.defineOption('quickLinks', false, (cm) => {
        new QuickLinkMonitor(context, cm as ExtendedEditor);
      });
    },
    codeMirrorOptions: {
      quickLinks: true,
    },
    codeMirrorResources: ['addon/hint/show-hint'],
    assets: () => [{ name: './style.css' }],
  };
}
