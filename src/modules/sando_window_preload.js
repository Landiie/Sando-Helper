const ipc = require("electron").ipcRenderer;
const process = require("process");
const crypto = require("crypto");
const sandoWindow = require("./sando_window");
const utils = require("./utils.js");
const sammiBtn = utils.getArgValue("sammiButton", process.argv);
const sammiInstance = utils.getArgValue("sammiInstance", process.argv);
const sammiId = utils.getArgValue("sammiId", process.argv);
let sammiPayload = utils.getArgValue("sammiPayload", process.argv);
ipc.send("log", typeof sammiPayload);
if (sammiPayload !== "undefined") {
  sammiPayload = JSON.parse(sammiPayload);
} else {
  sammiPayload = {};
}

const sammiVar = utils.getArgValue("sammiVar", process.argv);

ipc.send("log", sammiBtn);
ipc.send("log", sammiInstance);
ipc.send("log", sammiPayload);
ipc.send("log", sammiVar);
ipc.send("log", sammiId);

window.Sando = {
  // FromButton: currentSandoWindows
  payload: sammiPayload,
};

window.Sando.on = (eventName, callback) => {
  if (!sammiId)
    throw new Error(
      "This window has no ID! Please give it one when calling it using the SAMMI command."
    );
  if (!sandoWindow.events[sammiId]) sandoWindow.events[sammiId] = {};
  if (!sandoWindow.events[sammiId][eventName])
    sandoWindow.events[sammiId][eventName] = [];

  sandoWindow.events[sammiId][eventName].push(callback);
};

ipc.on("SandoTriggerListener", (e, eventName, payload) => {
  if (
    !sammiId ||
    !sandoWindow.events[sammiId] ||
    !sandoWindow.events[sammiId][eventName] ||
    sandoWindow.events[sammiId][eventName].length === 0
  )
    return;
  sandoWindow.events[sammiId][eventName].forEach(callback => {
    callback(payload);
  });
});

window.Sando.triggerExt = (extTrigger, params = {}) => {
  ipc.send("SandoTriggerExt", extTrigger, params);
};
window.Sando.triggerButton = button => {
  ipc.send("SandoTriggerButton", button);
};

window.Sando.getVariable = async (name, button) => {
  const result = await getVariable(button, name);
  return result;
};
window.Sando.setVariable = (name, value, button, instance) => {
  if (!button) {
    ipc.send("SandoSetVariable", sammiBtn, name, sammiInstance, value);
  } else {
    ipc.send("SandoSetVariable", button, name, instance, value);
  }
};

window.Sando.setStatus = status => {
  ipc.send("SandoSetStatus", sammiBtn, sammiVar, sammiInstance, status);
};

function getVariable(targetButton, targetVar) {
  if (!targetButton) targetButton = sammiBtn;
  const getVarHash = createGetVariableHash(
    sammiBtn,
    sammiVar,
    sammiInstance,
    targetButton,
    targetVar
  );
  const windowHash = sandoWindow.createHash(sammiBtn, sammiInstance, sammiVar);
  return new Promise((resolve, reject) => {
    ipc.once(getVarHash, (e, value) => {
      ipc.send("log", "got something, sending this: " + value);
      resolve(value);
    });
    ipc.send(
      "SandoGetVariable",
      targetVar,
      targetButton,
      getVarHash,
      windowHash
    );
  });
}

function createGetVariableHash(
  currentButton,
  currentVar,
  currentInstance,
  targetButton,
  targetVar
) {
  return crypto
    .createHash("md5")
    .update(
      "" +
        currentButton +
        currentVar +
        currentInstance +
        targetButton +
        targetVar +
        Math.random()
    )
    .digest("hex");
}
