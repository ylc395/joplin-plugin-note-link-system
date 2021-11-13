import joplin from 'api';
import {
  setupCodeMirror,
  setupToolbar,
  setupMarkdownView,
  setupSetting,
  setupPanel,
} from './driver/joplin';

joplin.plugins.register({
  onStart: async function () {
    const { requestHandler, searchEngine } = await setupSetting();

    await setupCodeMirror(requestHandler);
    await setupToolbar();
    await setupMarkdownView(requestHandler);
    await setupPanel(requestHandler, searchEngine);
  },
});
