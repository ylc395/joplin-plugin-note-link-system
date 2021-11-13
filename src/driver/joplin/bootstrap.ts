import joplin from 'api';
import type { Request, CreateNoteRequest } from 'driver/constants';
import { SearchEngine } from './SearchEngine';

export default function bootstrap() {
  const searchEngine = new SearchEngine();

  return {
    searchEngine,
    requestHandler: async (request: Request) => {
      switch (request.event) {
        case 'querySetting':
          return joplin.settings.value(request.payload.key);
        case 'openNote':
          return joplin.commands.execute('openNote', request.payload.noteId);
        case 'writeClipboard':
          return joplin.clipboard.writeText(request.payload.content);
        case 'searchReferrers':
          const selectedNoteId = (await joplin.workspace.selectedNote()).id;

          return request.payload?.elementIds
            ? searchEngine.searchReferrersOfElements(selectedNoteId, request.payload.elementIds)
            : searchEngine.searchReferrers(selectedNoteId);
        case 'queryCurrentNote':
          return joplin.workspace.selectedNote();
        case 'searchNotes':
          return searchEngine.searchNotes(request.payload.keyword);
        case 'fetchNote':
          return joplin.data.get(['notes', request.payload.id], { fields: 'body' });
        case 'createNote':
          return createNote(request.payload);
        default:
          break;
      }
    },
  };
}

export type RequestHandler = ReturnType<typeof bootstrap>['requestHandler'];

async function createNote({ title, type }: CreateNoteRequest['payload']) {
  const currentNote = await joplin.workspace.selectedNote();
  const currentNotebook = await joplin.data.get(['folders', currentNote.parent_id]);

  return joplin.data.post(['notes'], null, {
    is_todo: type === 'todo',
    title: title,
    parent_id: currentNotebook.id,
  });
}
