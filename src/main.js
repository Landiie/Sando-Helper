const utils = require("./modules/utils.js");
const eWindow = require("./modules/window.js");
const ws = require("./modules/ws.js");
const sandoWindow = require("./modules/sando_window.js");
const { app, BrowserWindow, ipcMain } = require("electron");
const process = require("process");
const { request } = require("http");

// const SANDO_RELAY_PORT = utils.getArgValue('sandoRelayPort', process.argv)
const SANDO_RELAY_PORT = 6626;

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

//result of this is in the ws message handler below
ipcMain.on(
  "SandoGetVariable",
  (e, targetVar, targetButton, getVarHash, windowHash) => {
    console.log("SandoGetVariable was called, that is progress");
    console.log(
      "heres stuff:",
      e,
      targetVar,
      targetButton,
      getVarHash,
      windowHash
    );
    ws.sendMessage(
      JSON.stringify({
        event: "SandoDevGetVariableCustomWindow",
        button: targetButton,
        variable: targetVar,
        hash: getVarHash,
        windowHash: windowHash,
      })
    );
  }
);

ipcMain.on("SandoSetVariable", (e, button, variable, instance, value) => {
  console.log("Set Variable was called from window.");
  sandoSetVariable(button, variable, instance, value);
});

ipcMain.on("SandoSetStatus", (e, button, variable, instance, value) => {
  console.log("Set Status was called from window.");
  sandoSetVariable(button, variable, instance, value);
  const win = sandoWindow.getWindow(button, instance, variable);
  if (!win) {
    console.error("No window was found to close after setting status.");
    return;
  }
  //destroy, so it doesn't fire "close" event, which is how we listen to the "X" button being fired for SAMMI
  win.destroy();
});

ipcMain.on("log", (e, value) => {
  console.log(value);
});

ipcMain.on("ws-message", async e => {
  console.log("wsmessage", e);
  switch (e.event) {
    case "NewWindow": {
      //console.log("i should create a window here");
      sandoWindow.create(
        e.htmlPath,
        e.windowConfig,
        e.sammiBtn,
        e.sammiInstance,
        e.data,
        e.sammiVar
      );
      break;
    }
    case "GetVariableResult": {
      console.log("got a variable result!");
      console.log(e);
      const requestedWin = sandoWindow.getWindowFromHash(e.windowHash);
      console.log("web contents of window:");
      console.log(requestedWin);
      requestedWin.webContents.send(e.hash, e.value);
      break;
    }
    default: {
        console.log('unknown event ', e.event)
      break;
    }
  }
});

function sandoSetVariable(button, variable, instance, value) {
  console.log("btn", button);
  console.log("var", variable);
  console.log("inst", instance);
  console.log("value", value);

  ws.sendMessage(
    JSON.stringify({
      event: "SandoDevSetVariableCustomWindow",
      button: button,
      variable: variable,
      instance: instance,
      value: value,
    })
  );
}
