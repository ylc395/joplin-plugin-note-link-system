module.exports = {
  default: function (context: unknown) {
    return {
      plugin: () => {},
      assets: function () {
        return [{ name: 'webview/index.js' }, { name: 'webview/style.css' }];
      },
    };
  },
};
