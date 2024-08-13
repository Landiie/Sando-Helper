const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const { EventEmitter } = require("events");
const dialog = require("./dialog");

// checkIfRunning();

const server = http.createServer(express);

const configs = argsToObj();
if (!configs.port) configs.port = 6626;

server.listen(configs.port, function () {
  // console.log(`Relay server is listening on ${configs.port}!`);
});

const wss = new WebSocket.Server({ server });
const events = new EventEmitter();

module.exports = {
  events: events,
  startup() {
    return new Promise((resolve, reject) => {
      fs.writeFileSync("server.status", "running", "utf-8");

      wss.on("connection", function connection(ws, req) {
        console.log("connected: ", req.url);
        ws.sammi_identifier = req.url;

        if (req.url === "/sammi-bridge") {
          module.exports.sendToBridge(
            JSON.stringify({
              event: "SandoDevHelperConnected",
            })
          );
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
                console.log("sending right to the helper emitter");
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
          // console.log(`closed ${ws}`);
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
