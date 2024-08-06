const eWindow = require("./window.js");
const path = require("path");

module.exports = {
  create(fileUrl, settings, sammiBtn, sammiInstance, sammiPayload, sammiVar) {
    const ws = require("./ws.js");
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

    win.on("ready-to-show", () => {
      win.show();
    });

    win.on("closed", () => {
      ws.sendMessage(
        JSON.stringify({
          event: "SandoDevSetVariableCustomWindow",
          variable: `${sammiBtn}.${sammiVar}`,
          instance: sammiInstance,
        })
      );
    });
  },
};
