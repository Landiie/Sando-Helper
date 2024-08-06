const { app, BrowserWindow } = require("electron");

module.exports = {
  create(settings) {
    const win = new BrowserWindow(settings);
    return win
  },
};
