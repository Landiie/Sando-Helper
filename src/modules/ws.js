// websocket.js
const WebSocket = require("ws");
const sandoWindow = require("./sando_window");

let ws;
const DELAY = 3; //seconds

const socketDelay = ms => new Promise(res => setTimeout(res, ms));

module.exports = {
  connect(url) {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(url);

      ws.on("open", () => {
        console.log("WebSocket connection opened");
        resolve();
      });

      ws.on("message", message => {
        console.log("Received message:", message.toString());
        const payload = JSON.parse(message.toString())
        console.log("i should create a window here");
        sandoWindow.create(payload.htmlPath, {}, payload.sammiBtn, payload.sammiInstance, payload.data, payload.sammiVar)
      });

      ws.on("close", async () => {
        console.log("WebSocket connection closed");
        console.log(`Retrying in ${DELAY * 1000} seconds.`);
        await socketDelay(DELAY * 1000);
        this.connect(url);
      });

      ws.on("error", error => {
        console.error("WebSocket error:", error);
      });
    });
  },

  sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    } else {
      console.error("WebSocket is not open. Ready state:", ws.readyState);
    }
  },
};
