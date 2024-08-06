const ipc = require("electron").ipcRenderer;
const process = require("process");
const currentSandoWindows = require("./sando_window").currentWindows;
const utils = require("./utils.js");
const sammiBtn = utils.getArgValue("sammiButton", process.argv);
const sammiInstance = utils.getArgValue("sammiInstance", process.argv);
let sammiPayload = utils.getArgValue("sammiPayload", process.argv);
ipc.send('log', typeof sammiPayload)
if (sammiPayload !== 'undefined') {
  sammiPayload = JSON.parse(sammiPayload);
} else {
  sammiPayload = {};
}

const sammiVar = utils.getArgValue("sammiVar", process.argv);

ipc.send("log", sammiBtn);
ipc.send("log", sammiInstance);
ipc.send("log", sammiPayload);
ipc.send("log", sammiVar);

window.Sando = {
  // FromButton: currentSandoWindows
  payload: sammiPayload,
};
window.Sando.getVariable = name => {};
window.Sando.setVariable = (name, value) => {
  ipc.send("SandoSetVariable", sammiBtn, name, sammiInstance, value);
};
window.Sando.setStatus = status => {
  ipc.send(
    "SandoSetVariable",
    sammiBtn,
    sammiVar,
    sammiInstance,
    status
  );
};
