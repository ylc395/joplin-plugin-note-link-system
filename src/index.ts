import joplin from 'api';
import App from './driver/joplin';

const app = new App();

joplin.plugins.register({
  onStart: app.init.bind(app),
});
