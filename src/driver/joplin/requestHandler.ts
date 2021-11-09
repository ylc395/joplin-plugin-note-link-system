import joplin from 'api';
import type { Request } from 'driver/constants';
import { SearchEngine } from './SearchEngine';

let searchEngine: SearchEngine;

export default async function requestHandler(request: Request) {
  if (!searchEngine) {
    searchEngine = new SearchEngine();
  }

  switch (request.event) {
    case 'querySetting':
      return joplin.settings.value(request.payload.key);
    case 'openNote':
      return joplin.commands.execute('openNote', request.payload.noteId);
    case 'searchReferrers':
      const selectedNoteId = (await joplin.workspace.selectedNote()).id;

      return request.payload?.elementIds
        ? searchEngine.searchReferrersOfElements(selectedNoteId, request.payload.elementIds)
        : { noteId: selectedNoteId, referrers: await searchEngine.searchReferrers(selectedNoteId) };
    default:
      break;
  }
}
