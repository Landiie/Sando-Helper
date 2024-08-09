const eWindow = require("./window.js");
const path = require("path");
const crypto = require("crypto");

module.exports = {
  currentWindows: {},
  create(fileUrl, settings, sammiBtn, sammiInstance, sammiPayload, sammiVar) {
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

    const finalSettings = { ...defs, ...settings };
    const win = eWindow.create(finalSettings);

    win.loadURL(fileUrl);

    const windowHash = this.createHash(sammiBtn, sammiInstance, sammiVar);
    this.currentWindows[`window-${windowHash}`] = win;

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
    });
  },
  getWindow(btn, instance, variable) {
    const windowHash = this.createHash(btn, instance, variable);
    const win = this.currentWindows[`window-${windowHash}`];
    if (!win) return null;
    return win;
  },
  getWindowFromHash(windowHash) {
    const win = this.currentWindows[`window-${windowHash}`];
    if (!win) return null;
    return win;
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
};
