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
    await setupSetting();
    await setupCodeMirror();
    await setupToolbar();
    await setupMarkdownView();
    await setupPanel();
  },
});
