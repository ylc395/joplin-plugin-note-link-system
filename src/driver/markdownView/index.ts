module.exports = {
  default: function () {
    return {
      plugin: () => {},
      assets: function () {
        return [{ name: 'webview/index.js' }, { name: 'webview/style.css' }];
      },
    };
  },
};
