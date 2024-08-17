const utils = require("./modules/utils.js");
const eWindow = require("./modules/window.js");
const dialog = require("./modules/dialog.js");
const wss = require("./modules/wss.js");
const sandoWindow = require("./modules/sando_window.js");
const sandoDialog = require("./modules/sando_dialog.js");
const { app, BrowserWindow, ipcMain } = require("electron");
const process = require("process");
const { request } = require("http");
const { powerSaveBlocker } = require("electron");

//prevent cold boot of custom windows
//ongoing issue...
powerSaveBlocker.start("prevent-app-suspension"); //didn't work
app.disableHardwareAcceleration();

// const SANDO_RELAY_PORT = utils.getArgValue('sandoRelayPort', process.argv)
const SANDO_RELAY_PORT = 6626;
main();

app.whenReady().then(async () => {
  // const win = sandoWindow.create(
  //   "file:///F:/Projects/GitHub%20Repos/Electron-Testing/index.html",
  //   {},
  //   "wawa"
  // );
  // win.on("ready-to-show", () => {
  //   win.show();
  // });
});

//windows are only opened when using the Sando: Custom Window, makes no sense to close the app when none are visible.
app.on("window-all-closed", e => {
  e.preventDefault();
});

async function main() {
  //await ws.connect(`ws://127.0.0.1:${SANDO_RELAY_PORT}/sando-helper`);
  const startupPass = await wss.startup();
  if (!startupPass) {
    dialog.showMsg({ type: "error", message: "Relay server could not start." });
    return;
  }
  wss.sendToBridge(
    JSON.stringify({
      event: "SandoDevServerOperationalAndConnected",
    })
  );
}

ipcMain.on("SandoTriggerExt", (e, extTrigger, params) => {
  // console.log("SandoTriggerExt was called.");
  wss.sendToBridge(
    JSON.stringify({
      event: "SandoDevTriggerExtCustomWindow",
      extTrigger: extTrigger,
      params: params,
    })
  );
});
ipcMain.on("SandoTriggerButton", (e, button) => {
  // console.log("SandoTriggerButton was called.");
  wss.sendToBridge(
    JSON.stringify({
      event: "SandoDevTriggerButtonCustomWindow",
      button: button,
    })
  );
});

//result of this is in the ws message handler below
ipcMain.on(
  "SandoGetVariable",
  (e, targetVar, targetButton, getVarHash, windowHash) => {
    // console.log("SandoGetVariable was called, that is progress");
    // console.log(
    //   "heres stuff:",
    //   e,
    //   targetVar,
    //   targetButton,
    //   getVarHash,
    //   windowHash
    // );
    wss.sendToBridge(
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
  // console.log("Set Variable was called from window.");
  sandoSetVariable(button, variable, instance, value);
});

ipcMain.on("SandoSetStatus", (e, button, variable, instance, value) => {
  // console.log("Set Status was called from window.");
  sandoSetVariable(button, variable, instance, value);
  const win = sandoWindow.getWindow(button, instance, variable);
  if (!win) {
    console.error("No window was found to close after setting status.");
    return;
  }
  //destroy, so it doesn't fire "close" event, which is how we listen to the "X" button being fired for SAMMI
  win.destroy();
  sandoWindow.removeWindow(button, instance, variable);
});

ipcMain.on("log", (e, value) => {
  console.log(value);
});

wss.events.on("sammi-bridge-message", async e => {
  let data;

  // console.log("message from sammi: ", e);

  try {
    data = JSON.parse(e);
  } catch {
    const msg =
      "Landie you malformed the json string sent to the helper. dummy.";
    dialog.showMsg({ type: "error", message: msg });
    return;
  }

  // console.log("message from sammi (PARSED): ", data);

  if (!data.event) {
    const msg = "invalid, or lack of event on bridge payload";
    dialog.showMsg({ type: "error", message: msg });
  }

  switch (data.event) {
    case "NewFileSave": {
      const res = await dialog.showSave(data.config);
      wss.sendToBridge(
        JSON.stringify({
          event: "SandoDevFileSave",
          button: data.sammiBtn,
          variable: data.sammiVar,
          instance: data.sammiInstance,
          result: res,
        })
      );
      break;
    }
    case "NewFileOpen": {
      const res = await dialog.showOpen(data.config);
      wss.sendToBridge(
        JSON.stringify({
          event: "SandoDevFileOpen",
          button: data.sammiBtn,
          variable: data.sammiVar,
          instance: data.sammiInstance,
          result: res,
        })
      );
      break;
    }
    case "NewDialog": {
      let result = await dialog.showMsg(data.dialogConfig);
      if (!data.dialogConfig?.checkboxLabel) delete result.checkboxChecked;
      wss.sendToBridge(
        JSON.stringify({
          event: "SandoDevDialog",
          button: data.sammiBtn,
          variable: data.sammiVar,
          instance: data.sammiInstance,
          result: result,
        })
      );
      break;
    }
    case "NewWindow": {
      sandoWindow.create(
        data.htmlPath,
        data.windowConfig,
        data.sammiBtn,
        data.sammiInstance,
        data.payload,
        data.id,
        data.sammiVar
      );
      break;
    }
    case "GetVariableResult": {
      console.log("got a variable result!");
      console.log(data);
      const requestedWin = sandoWindow.getWindowFromHash(data.windowHash);
      // console.log("web contents of window:");
      // console.log(requestedWin);
      requestedWin.webContents.send(data.hash, data.value);
      break;
    }
    case "EmitEventWindow": {
      //console.log("emitting event", data);
      const windows = sandoWindow.getWindowsFromId(data.id);
      //console.log("returned windows", windows);

      //async required here for events with multiple listeners on one
      windows.forEach(async win => {
        await win.webContents.send(
          "SandoTriggerListener",
          data.eventToEmit,
          data.payload
        );
      });
      break;
    }
    case "testing": {
      const result = await dialog.showOpen({});
      console.log(result);
      break;
    }
    default: {
      const msg = `unknown event from bridge: "${data.event}"`;
      dialog.showMsg({ type: "warning", message: msg });
      break;
    }
  }
});

// ipcMain.on("ws-message", async e => {
//   //console.log("wsmessage", e);
// });

function sandoSetVariable(button, variable, instance, value) {
  // console.log("btn", button);
  // console.log("var", variable);
  // console.log("inst", instance);
  // console.log("value", value);

  wss.sendToBridge(
    JSON.stringify({
      event: "SandoDevSetVariableCustomWindow",
      button: button,
      variable: variable,
      instance: instance,
      value: value,
    })
  );
}
