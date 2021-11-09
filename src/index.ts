import joplin from 'api';
import { setupCodeMirror, setupMarkdownView, setupSetting } from './driver/joplin';

joplin.plugins.register({
  onStart: async function () {
    await setupSetting();
    // await setupCodeMirror();
    await setupMarkdownView();
  },
});
