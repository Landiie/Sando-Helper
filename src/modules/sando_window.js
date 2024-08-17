const eWindow = require("./window.js");
const path = require("path");
const crypto = require("crypto");
const utils = require("./utils.js");
const { MenuItem } = require("electron");

module.exports = {
  events: {},
  currentWindows: {},
  create(
    fileUrl,
    settings,
    sammiBtn,
    sammiInstance,
    sammiPayload,
    sammiId,
    sammiVar
  ) {
    const wss = require("./wss.js");
    let defs = {
      title: "Sando Custom Window",
      center: true,
      alwaysOnTop: true,
      minimizable: false,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "sando_window_preload.js"),
        nodeIntegration: true,
        contextIsolation: false,
        additionalArguments: [
          `--sammiButton=${sammiBtn}`,
          `--sammiInstance=${sammiInstance}`,
          `--sammiPayload=${JSON.stringify(sammiPayload)}`,
          `--sammiVar=${sammiVar}`,
        ],
      },
    };

    if (sammiId !== "" && sammiId !== undefined)
      defs.webPreferences.additionalArguments.push(`--sammiId=${sammiId}`);

    const finalSettings = { ...defs, ...settings };
    const win = eWindow.create(finalSettings);

    win.loadURL(fileUrl);

    const windowHash = this.createHash(sammiBtn, sammiInstance, sammiVar);
    this.currentWindows[`window-${windowHash}`] = {};
    this.currentWindows[`window-${windowHash}`].win = win;

    this.currentWindows[`window-${windowHash}`].id =
      sammiId !== undefined ? sammiId : null;

    win.on("ready-to-show", () => {
      win.show();
    });

    win.on("close", () => {
      wss.sendToBridge(
        JSON.stringify({
          event: "SandoDevSetVariableCustomWindow",
          button: sammiBtn,
          variable: sammiVar,
          instance: sammiInstance,
          value: false,
        })
      );
      this.removeWindow(sammiBtn, sammiInstance, sammiVar)
    });
  },
  getWindow(btn, instance, variable) {
    const windowHash = this.createHash(btn, instance, variable);
    const win = this.currentWindows[`window-${windowHash}`]?.win;
    if (!win) return null;
    return win;
  },
  getWindowFromHash(windowHash) {
    const win = this.currentWindows[`window-${windowHash}`]?.win;
    if (!win) return null;
    return win;
  },
  getWindowsFromId(id) {
    const windows = [];
    const res = utils.searchObjofObjs(this.currentWindows, "id", id);
    //console.log('wins', this.currentWindows)
    //console.log('wins from id', res)
    res.forEach(item => {
      windows.push(item.win);
    });
    return windows;
  },
  getWindowList() {
    return this.currentWindows;
  },
  createHash(btn, instance, variable) {
    return crypto
      .createHash("md5")
      .update("" + btn + instance + variable)
      .digest("hex");
  },
  removeWindow(btn, instance, variable) {
    const windowHash = this.createHash(btn, instance, variable);
    if (this.currentWindows[`window-${windowHash}`])
      delete this.currentWindows[`window-${windowHash}`];
  },
};
