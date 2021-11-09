import {
  SearchReferrersRequest,
  OpenNoteRequest,
  QuerySettingRequest,
  SearchNoteReferrersResponse,
  REFERRER_PANEL_TITLE_SETTING,
} from 'driver/constants';

declare const webviewApi: {
  postMessage: <T>(
    payload: SearchReferrersRequest | OpenNoteRequest | QuerySettingRequest,
  ) => Promise<T>;
};

const rootEl = document.getElementById('joplin-plugin-content')!;
let lastSelectedNoteId = '';

const refresh = async () => {
  const { noteId, referrers } = await webviewApi.postMessage<SearchNoteReferrersResponse>({
    event: 'searchReferrers',
  });

  if (lastSelectedNoteId === noteId) {
    return;
  }

  const listEl = document.querySelector('ol')!;
  listEl.innerHTML = '';

  for (const note of referrers) {
    listEl.innerHTML += `<li data-note-id="${note.id}">${note.title}</li>`;
  }

  lastSelectedNoteId = noteId;
};

(async function init() {
  const title = await webviewApi.postMessage<string>({
    event: 'querySetting',
    payload: { key: REFERRER_PANEL_TITLE_SETTING },
  });
  rootEl.innerHTML = `<h1>${title}<h1><ol></ol>`;
  refresh();
})();

setInterval(refresh, 500);
