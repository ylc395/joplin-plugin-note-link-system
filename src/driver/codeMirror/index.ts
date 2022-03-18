import type CodeMirror from 'codemirror';
import type { Editor } from 'codemirror';
import type {
  QuerySettingRequest,
  SearchNotesRequest,
  FetchNoteHtmlRequest,
  CreateNoteRequest,
  QueryCurrentNoteRequest,
} from 'driver/constants';
import QuickLinker, { ExtendedEditor } from './QuickLinker';
import UrlFolder from './UrlFolder';
import IdSetter from './IdSetter';

export interface Context {
  postMessage: <T>(
    request:
      | QuerySettingRequest
      | SearchNotesRequest
      | FetchNoteHtmlRequest
      | CreateNoteRequest
      | QueryCurrentNoteRequest,
  ) => Promise<T>;
}

export default function (context: Context) {
  return {
    plugin: function (codemirror: typeof CodeMirror) {
      codemirror.defineOption('noteLinkSystem', false, (cm) => {
        new QuickLinker(context, cm as Editor & ExtendedEditor, codemirror);
        new UrlFolder(context, cm);
        const idSetter = new IdSetter(cm);

        codemirror.defineExtension('setElementId', idSetter.setElementId.bind(idSetter));
      });
    },
    codeMirrorOptions: {
      noteLinkSystem: true,
    },
    codeMirrorResources: ['addon/hint/show-hint'],
    assets: () => [{ name: './style.css' }],
  };
}
