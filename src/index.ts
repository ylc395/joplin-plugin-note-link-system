import joplin from 'api';
import { setupCodeMirror, setupToolbar, setupMarkdownView, setupSetting } from './driver/joplin';

joplin.plugins.register({
  onStart: async function () {
    await setupSetting();
    // await setupCodeMirror();
    await setupToolbar();
    await setupMarkdownView();
  },
});
