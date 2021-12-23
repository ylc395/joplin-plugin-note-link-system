export default function () {
  return {
    plugin: (() => {}) as any,
    assets: function () {
      return [{ name: 'webview/index.js' }, { name: 'webview/style.css' }];
    },
  };
}
