const { app, BrowserWindow } = require("electron");
const path = require("path");
module.exports = {
  create(settings) {
    defs = {
      icon: path.join(__dirname, "..", "img", "icon.ico"),
    };
    const win = new BrowserWindow({ ...defs, ...settings });
    return win;
  },
};
