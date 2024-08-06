const utils = require('./modules/utils.js')
const eWindow = require("./modules/window.js");
const ws = require("./modules/ws.js");
const sandoWindow = require("./modules/sando_window.js");
const { app, BrowserWindow, ipcMain } = require("electron");
const process = require("process");

// const SANDO_RELAY_PORT = utils.getArgValue('sandoRelayPort', process.argv)
const SANDO_RELAY_PORT = 6626

main();

app.whenReady().then(() => {
//   const win = sandoWindow.create(
//     "file:///F:/Projects/GitHub%20Repos/Electron-Testing/index.html",
//     {},
//     "wawa"
//   );

  //   win.on("ready-to-show", () => {
  //     win.show();
  //   });
});

//windows are only opened when using the Sando: Custom Window, makes no sense to close the app when none are visible.
app.on("window-all-closed", e => {
  e.preventDefault();
});

async function main() {
  await ws.connect(`ws://127.0.0.1:${SANDO_RELAY_PORT}/sando-helper`);
}

ipcMain.on("SandoSetVariable", (e, variable, instance, value) => {
  console.log("Set Variable was called from window.");
  ws.sendMessage(
    JSON.stringify({
      event: "SandoDevSetVariableCustomWindow",
      variable: variable,
      instance: instance,
      value: value,
    })
  );
});

ipcMain.on("log", (e, value) => {
  console.log(value);
});
