const wss = require("./modules/wss.js");
const dialog = require("./modules/dialog.js");
const sandoWindow = require("./modules/sando_window.js");
const window = require("./modules/window.js");
const { app, ipcMain, BrowserWindow, shell } = require("electron");
const { powerSaveBlocker } = require("electron");
const sammiPoller = require("./modules/sammi_poller.js");
//const deckTamper = require('./modules/deck_tamper.js')
const obsForum = require("./modules/obs_forum.js");
const utils = require("./modules/utils.js");
const path = require("path");
const obs = require("./modules/obs.js");
const sammi = require("./modules/sammi/main.js");
const fsSync = require("fs");
const fsP = require("fs").promises;
const obsws = require("./modules/obs_ws.js");

powerSaveBlocker.start("prevent-app-suspension");
// app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  await main();
});

//windows are only opened when using the Sando: Custom Window, makes no sense to close the app when none are visible.
app.on("window-all-closed", e => {
  e.preventDefault();
});

async function main() {
  try {
    sammiPoller.start();
    await sammi.initDecks();
    await obsws.connect();
  } catch (e) {
    dialog.showMsg({ type: "error", message: e.message });
    return;
  }
  //await ws.connect(`ws://127.0.0.1:${SANDO_RELAY_PORT}/sando-helper`);
  const startupPass = await wss.startup();
  if (!startupPass) {
    dialog.showMsg({ type: "error", message: "Relay server could not start." });
    return;
  }

  // await obsws.scenesPack('[Gacha]', [], path.join(__dirname, 'gacha_test.obspkg'))
  // utils.debug = true;
  await obsws.scenesUnpack(
    `C:\\Cloud\\Google Drive (Business)\\SAMMI (Product Development)\\landies_extensions\\landituber\\obsScenes.spkg`
  );
  dialog.showMsg({ type: "info", message: "done" });
  // wss.sendToBridge(
  //   JSON.stringify({
  //     event: "SandoDevServerOperationalAndConnected",
  //   })
  // );
}

ipcMain.on("open-external-link", (e, link) => {
  shell.openExternal(link);
});

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

  console.log("message from sammi (PARSED): ", data);

  if (!data.event) {
    const msg = "invalid, or lack of event on bridge payload";
    dialog.showMsg({ type: "error", message: msg });
  }

  switch (data.event) {
    case "ScenePacker_Pack": {
      if (!obsws.sceneExists(data.sceneName)) {
        dialog.showMsg({
          type: "error",
          message: `The scene "${data.sceneName}" does not exist in OBS.`,
        });
        wss.sendToBridge({
          event: "Sando_ScenePacker_Pack",
          button: data.sammiBtn,
          variable: data.sammiVar,
          instance: data.sammiInstance,
          result: undefined,
        });
        return;
      }

      let res = null;
      try {
        res = await obsws.scenesPack(data.scene, data.denyList, data.path);
      } catch (e) {
        dialog.showMsg({ type: "error", message: e.message, details: e.stack });
        wss.sendToBridge({
          event: "Sando_ScenePacker_Pack",
          button: data.sammiBtn,
          variable: data.sammiVar,
          instance: data.sammiInstance,
          result: undefined,
        });
        break;
      }

      const exists = fsSync.existsSync(res);

      if (!exists) {
        dialog.showMsg({ type: "error", message: `output path of obspkg "${res}" was not created.` });
        wss.sendToBridge({
          event: "Sando_ScenePacker_Pack",
          button: data.sammiBtn,
          variable: data.sammiVar,
          instance: data.sammiInstance,
          result: undefined,
        });
        break;
      }

      wss.sendToBridge({
        event: "Sando_ScenePacker_Pack",
        button: data.sammiBtn,
        variable: data.sammiVar,
        instance: data.sammiInstance,
        result: res,
      });
      break;
    }
    case "OBS_Plugin_Version_Check": {
      const versionCheckPromises = [];
      data.plugins.forEach(plugin => {
        versionCheckPromises.push(
          obs.pluginVersionCheck(
            plugin.name,
            plugin.targetVersion,
            data.log,
            plugin.startPos,
            plugin?.endPos
          )
        );
      });

      const results = await Promise.all(versionCheckPromises);
      wss.sendToBridge(
        JSON.stringify({
          event: "Sando_OBS_Plugin_Version_Check",
          button: data.sammiBtn,
          variable: data.sammiVar,
          instance: data.sammiInstance,
          results: results,
        })
      );
      console.log(results);
      break;
    }
    case "OBS_Plugin_Install": {
      const installResults = [];
      for (let i = 0; i < data.plugins.length; i++) {
        const plugin = data.plugins[i];
        const res = await obs.installPlugin(
          plugin.name,
          plugin.path,
          data.obsPath
        );
        installResults.push(res);
      }

      wss.sendToBridge(
        JSON.stringify({
          event: "Sando_OBS_Plugin_Install",
          button: data.sammiBtn,
          variable: data.sammiVar,
          instance: data.sammiInstance,
          results: installResults,
        })
      );
      break;
    }
    case "OBS_Plugin_Download": {
      let autoDlRetry = true;
      let manualDl = false;
      let downloadResults = [];
      let erroredPlugins = [];
      while (autoDlRetry && !manualDl) {
        const downloadPromises = [];
        data.plugins.forEach(plugin => {
          downloadPromises.push(
            obsForum.downloadPlugin(
              plugin.link,
              plugin.whitelist,
              plugin.blacklist,
              plugin.name,
              (plugin.version = plugin.latest ? "latest" : plugin.version)
            )
          );
        });

        const results = await Promise.all(downloadPromises);

        console.log("results", results);

        erroredPlugins = [];
        erroredPlugins = erroredPlugins.concat(
          results.filter(res => res.status === "ERROR")
        );

        if (erroredPlugins.length === 0) {
          wss.sendToBridge(
            JSON.stringify({
              event: "Sando_OBS_Plugin_Download",
              button: data.sammiBtn,
              variable: data.sammiVar,
              instance: data.sammiInstance,
              results: results,
            })
          );
          console.log(results);
          return;
        }
        downloadResults = [];
        downloadResults = downloadResults.concat(
          results.filter(res => res.status === "OK")
        );
        //there were errors, inform and see if user wants to retry or attempt manual
        const retryRes = await dialog.showMsg({
          type: "error",
          message: `There were errors downloading the following plugins:\n\n ${erroredPlugins
            .map(p => `${p.name}: ${p.message}`)
            .join(
              "\n"
            )}\n\nWould you like to retry the download? If not, you can launch the manual installation process.`,
          buttons: ["Retry", "Manual Installation"],
        });
        if (retryRes.response === 1) {
          manualDl = true;
          break;
        }
      }
      if (!manualDl) {
        wss.sendToBridge(
          JSON.stringify({
            event: "Sando_OBS_Plugin_Download",
            button: data.sammiBtn,
            variable: data.sammiVar,
            instance: data.sammiInstance,
            results: "ABORTED",
          })
        );
        break;
      }
      //manual download
      let manualDlRetry = true;
      let manualPlugins = [];
      while (manualDlRetry) {
        const manualPluginWindow = () => {
          return new Promise((resolve, reject) => {
            const mpWin = new BrowserWindow({
              title: "Sando: OBS Plugin Download Manual",
              width: 896,
              height: 609,
              center: true,
              alwaysOnTop: true,
              minimizable: false,
              autoHideMenuBar: true,
              show: false,
              webPreferences: {
                preload: path.join(
                  __dirname,
                  "pages",
                  "OBS_Plugin_Download_Manual_preload.js"
                ),
                nodeIntegration: false,
                contextIsolation: true,
                additionalArguments: [
                  `--plugins=${JSON.stringify(erroredPlugins)}`,
                ],
              },
            });

            mpWin.loadFile(
              path.join(__dirname, "pages", "OBS_Plugin_Download_Manual.html")
            );

            ipcMain.once("plugin-manual-data", (event, data) => {
              mpWin.destroy();
              resolve(data);
            });

            mpWin.on("ready-to-show", () => {
              mpWin.show();
            });

            mpWin.on("close", () => {
              resolve(null);
            });
          });
        };

        const mpResp = await manualPluginWindow();

        if (mpResp === null) {
          const mpRespCancel = await dialog.showMsg({
            type: "warning",
            message:
              "Are you sure you want to abort manual installation?\n\n(The extension creator expects you to have the plugins, so unexpected behavior may occur!)",
            buttons: ["Yes", "No"],
            defaultId: 1,
          });

          if (mpRespCancel.response === 0) {
            wss.sendToBridge(
              JSON.stringify({
                event: "Sando_OBS_Plugin_Download",
                button: data.sammiBtn,
                variable: data.sammiVar,
                instance: data.sammiInstance,
                results: "ABORTED",
              })
            );

            manualDlRetry = false;
            return;
          }
        } else {
          manualPlugins = mpResp;
          break;
        }
      }

      //copy files to manual plugin folder
      const copyOperations = [];
      const manualPluginFolder = path.join(__dirname, "..", "manual_plugins");
      console.log(manualPluginFolder);

      if (!fsSync.existsSync(manualPluginFolder)) {
        fsSync.mkdirSync(manualPluginFolder);
      }

      console.log("STUFF", manualPlugins);
      manualPlugins.forEach(plugin => {
        copyOperations.push(
          fsP.copyFile(
            plugin.path,
            path.join(manualPluginFolder, path.basename(plugin.path))
          )
        );
        //while here, fix path to point to the manual plugin folder, and statuses to OK
        plugin.path = path.resolve(
          path.join(manualPluginFolder, path.basename(plugin.path))
        );
        plugin.status = "OK";
      });
      try {
        await Promise.all(copyOperations);
      } catch (e) {
        const msg =
          "There was an error copying the files to the manual plugin folder:\n\n" +
          e.message;
        await dialog.showMsg({ type: "error", message: msg });
        wss.sendToBridge(
          JSON.stringify({
            event: "Sando_OBS_Plugin_Download",
            button: data.sammiBtn,
            variable: data.sammiVar,
            instance: data.sammiInstance,
            results: "ABORTED",
          })
        );
      }
      downloadResults = downloadResults.concat(manualPlugins);

      console.log("final results", downloadResults);

      wss.sendToBridge(
        JSON.stringify({
          event: "Sando_OBS_Plugin_Download",
          button: data.sammiBtn,
          variable: data.sammiVar,
          instance: data.sammiInstance,
          results: downloadResults,
        })
      );

      break;
    }
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
      console.log("creating new window");
      await sandoWindow.create(
        data.htmlPath,
        data.windowConfig,
        data.sammiBtn,
        data.sammiInstance,
        data.payload,
        data.id,
        data.sammiVar
      );
      // console.log("window showing!");
      if (data.sammiVarVis === "" || data.sammiVarVis === undefined) return;
      wss.sendToBridge(
        JSON.stringify({
          event: "SandoDevWindowShowing",
          button: data.sammiBtn,
          variable: data.sammiVarVis,
          instance: data.sammiInstance,
        })
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
    case "SetWindowStatus": {
      const windows = sandoWindow.getWindowsFromId(data.id);

      //async required here for events with multiple listeners on one
      windows.forEach(async win => {
        await win.webContents.send("SandoForcedStatus", data.status);
      });
      break;
    }
    case "testing": {
      const result = await dialog.showOpen({});
      console.log(result);
      break;
    }
    case "current deck data": {
      console.log("current deck data: ", sammi.deckData);
      break;
    }
    case "getDeckNameButtonId": {
      console.log(sammi.getDeckNameFromButtonId(data.buttonId));
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

function sandoSetStatus(status, button, instance, variable) {}

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
