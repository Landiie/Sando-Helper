const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const fsP = require("fs").promises;
const { EventEmitter } = require("events");
const dialog = require("./dialog");
const { app, BrowserWindow, ipcMain } = require("electron");
const utils = require("./utils");
const path = require("path");
const rawBody = require("raw-body");

const expressApp = express();

let obsInstallFinished = false;

expressApp.use((req, res, next) => {
  rawBody(
    req,
    {
      length: req.headers["content-length"],
      encoding: req.charset || "utf-8",
    },
    (err, string) => {
      if (err) return next(err);
      req.body = string;
      next();
    }
  );
});

// Handle HTTP POST requests
expressApp.post("/obs-install-plugins", async (req, res) => {
  res.json({ status: "OK" });
  const obs = require("./obs");
  const data = JSON.parse(req.body);
  const deckName = data.source;
  const pluginNames = data.plugins.map(plugin => plugin.name);

  const consentWindow = () => {
    return new Promise((resolve, reject) => {
      const consentWin = new BrowserWindow({
        title: "Sando: OBS Plugin Download Consent",
        width: 683,
        height: 416,
        center: true,
        alwaysOnTop: true,
        minimizable: false,
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
          preload: path.join(
            __dirname,
            "..",
            "pages",
            "OBS_Plugin_Install_Consent_preload.js"
          ),
          nodeIntegration: false,
          contextIsolation: true,
          additionalArguments: [
            `--deckName=${deckName}`,
            `--plugins=${JSON.stringify(pluginNames)}`,
          ],
        },
      });

      consentWin.loadFile(
        path.join(__dirname, "..", "pages", "OBS_Plugin_Install_Consent.html")
      );

      consentWin.on("ready-to-show", () => {
        consentWin.show();
      });

      consentWin.on("close", () => {
        resolve(false);
      });

      ipcMain.once("consent-data", (event, data) => {
        consentWin.destroy();
        resolve(data);
      });
    });
  };

  const consentResponse = await consentWindow();
  if (!consentResponse) {
    obsInstallFinished = "cancelled";
    return;
  }

  const installResults = [];
  for (let i = 0; i < data.plugins.length; i++) {
    const plugin = data.plugins[i];
    const res = await obs.installPlugin(plugin.name, plugin.path, data.obsPath);
    installResults.push(res);
  }

  console.log("install results", installResults);
  obsInstallFinished = installResults;

  // try {
  //   const result = await vm.runInNewContext(req.body, { require, console, __dirname, __filename });
  //   res.json(result);
  // } catch (e) {
  //   res.json(e.message)
  // }
  //console.log(result);
});

expressApp.get("/obs-install-plugins-status", (req, res) => {
  if (obsInstallFinished === false) {
    res.json({ status: "pending" });
    return;
  }
  res.json({ status: obsInstallFinished });
  obsInstallFinished = false;
});

const server = http.createServer(expressApp);

let serverPort = 6626;

if (app.isPackaged) {
  serverPort = utils.getArgValue("--port", process.argv);
} else {
  console.log("dev mode, using default port", serverPort);
}

server.listen(serverPort, "127.0.0.1", function () {
  console.log(`Relay server is listening on ${serverPort}!`);
});

const wss = new WebSocket.Server({ server });
const events = new EventEmitter();

module.exports = {
  events: events,
  startup() {
    return new Promise((resolve, reject) => {
      wss.on("connection", function connection(ws, req) {
        console.log("connected: ", req.url);
        ws.sammi_identifier = req.url;

        if (req.url === "/sammi-bridge") {
          module.exports.sendToBridge(
            JSON.stringify({
              event: "SandoDevHelperConnected",
            })
          );
          // try {
          //   dialog.showMsg({
          //     type: "info",
          //     message: 'writing to file',
          //   });
          //   fs.closeSync(fs.openSync(CONNECTED_FILE_PATH, 'w'));
          // } catch (e) {
          //   dialog.showMsg({
          //     type: "error",
          //     message: e,
          //   });
          // }
          resolve(true);
        }

        if (req.url === "/") {
          dialog.showMsg({
            type: "warning",
            message: `A new websocket client has connected to the relay, however, there is no identifier.\n\nIf you are a developer, please add a slash after the websocket URL, and give it a unique name! This will be used to listen for messages in SAMMI via Extension Triggers.\nExample:\n"ws://127.0.0.1:6626/chatbox"\n\nTriggers the Extension Trigger:\n\n"SandoRelay: chatbox"\n\nAnything sent from this websocket client will be sent under the Extension Trigger "SandoRelay: ???" in the meantime.`,
          });
        }

        ws.on("message", function incoming(data) {
          data = data.toString();
          // console.log("data recieved fom ws vvvv");
          // console.log(data);
          // console.log("source vvv");
          // console.log(req.url);
          // console.log("other info about the source vvv");
          // console.log(JSON.stringify(req));

          let builtPayload = null;
          switch (req.url) {
            case "/sammi-bridge": {
              //coming from bridge, should always have to parse
              // console.log("data coming from bridge, should always be parsable");
              let bridgeDataStructure;

              try {
                bridgeDataStructure = JSON.parse(data);
              } catch (e) {
                dialog.showMsg({
                  type: "error",
                  message:
                    "Sent from bridge, but not parsable. This should not be possible.",
                });
              }

              if (bridgeDataStructure.target_client_id === "Sando Helper") {
                //console.log(" right to the helper emitter");
                events.emit("sammi-bridge-message", bridgeDataStructure.data);
                return;
              }

              builtPayload = {
                source: "/sammi-bridge", //not needed
                target: "/" + bridgeDataStructure.target_client_id,
                data: bridgeDataStructure.data,
              };
              break;
            }
            case "/": {
              //no unique id
              builtPayload = {
                source: "???",
                target: "/sammi-bridge", //not needed
                data: data,
              };
              break;
            }

            default: {
              //custom id
              builtPayload = {
                source: req.url,
                target: "/sammi-bridge",
                data: data,
              };
              break;
            }
          }

          // console.log("built payload: vvvvv");
          // console.log(builtPayload);

          let passed = false;
          wss.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              if (
                builtPayload.source === "/sammi-bridge" &&
                builtPayload.target === client.sammi_identifier
              ) {
                //this is data being sent from bridge, look for specified target/client id
                // console.log(
                //  `sent data from bridge to ${client.sammi_identifier}`
                //);
                client.send(JSON.stringify(builtPayload.data));
                passed = true;
              } else if (
                builtPayload.target === "/sammi-bridge" &&
                client.sammi_identifier === "/sammi-bridge"
              ) {
                //this is data being sent to bridge, looped through until bridge was found
                // console.log(
                //  `sent data from client ${builtPayload.source} to bridge`
                //);
                client.send(JSON.stringify(builtPayload));
                passed = true;
              }
            }
          });

          if (!passed) {
            dialog.showMsg({
              type: "error",
              message: "could not find any client id connected to match",
            });
          }
          // // console.log("data recieved parsed:", bridgeData);

          // //check if just wanting to pass from bridge to helper
          // if (bridgeData !== null && bridgeData.target_client_id === "/Sando Helper") {
          //   //console.log("type of ws things", wss.clients, typeof wss.clients);
          //   events.emit("sammi-bridge-message", data);
          //   return;
          // }

          // wss.clients.forEach(function each(client) {
          //   if (client !== ws && client.readyState === WebSocket.OPEN) {
          //     if (
          //       bridgeData !== null &&
          //       bridgeData.target_client_id === client.sammi_identifier
          //     ) {
          //       //this is data being sent from bridge, look for specified target/client id
          //       console.log(
          //         `sent data from bridge to ${client.sammi_identifier}`
          //       );
          //       client.send(data);
          //     } else if (client.sammi_identifier === "/sammi-bridge") {
          //       //this is data being sent to bridge, loop through until bridge is found
          //       console.log(`sent data from client ${req.url} to bridge`);
          //       client.send(data);
          //     }
          //   }
          // });
        });
        ws.on("close", function closeConnection(ws, req) {
          if (req.url === "/sammi-bridge") {
            fs.rmSync(CONNECTED_FILE_PATH);
          }
        });
      });
    });
  },

  sendToBridge(message) {
    let bridgeClient = null;

    for (const client of wss.clients) {
      if (client.sammi_identifier === "/sammi-bridge") {
        bridgeClient = client;
        break;
      }
    }

    if (bridgeClient === null) {
      dialog.showMsg({
        type: "error",
        message: "could not find bridge in wss clients",
      });
      return;
    }

    // wss.clients.forEach(function each(client) {
    //   if (client.sammi_identifier === "/sammi-bridge") {
    //     client.send(message);
    //   }
    // });

    bridgeClient.send(message);
  },
};

function stringify(obj) {
  let cache = [];
  let str = JSON.stringify(obj, function (key, value) {
    if (typeof value === "object" && value !== null) {
      if (cache.indexOf(value) !== -1) {
        // Circular reference found, discard key
        return;
      }
      // Store value in our collection
      cache.push(value);
    }
    return value;
  });
  cache = null; // reset the cache
  return str;
}

function argsToObj() {
  let configs = [];
  let obj = {};
  const arguments = process.argv.slice(2);
  arguments.forEach(value => {
    if (value.includes("=")) {
      let [k, v] = value.split("=");
      obj[k] = v;
    }
  });
  return obj;
}

// async function checkIfRunning() {
//   while (true) {
//     await new Promise(resolve => setTimeout(resolve, 300));
//     // async loop code
//     if (fs.existsSync("server.status")) {
//       const data = fs.readFileSync("server.status", "utf8");
//       // console.log(data);
//       if (data === "stopped") {
//         process.exit();
//       }
//     }
//   }
// }

function statusError(error) {
  fs.writeFileSync("server.status", error, "utf-8");
}

function statusStopped() {
  fs.writeFileSync("server.status", "stopped", "utf-8");
}
