const { ipcRenderer } = require("electron");
//?preload inherits process by default if node integration is disabled
console.log(process.argv);
const deckName = getArgValue("deckname", process.argv) || "Unknown";
const plugins = JSON.parse(getArgValue("plugins", process.argv));

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(
    ".header p"
  ).innerText = `SAMMI Deck "${deckName}" is trying to install/update the following OBS Plugins:`;

  let pluginsList = "";
  plugins.forEach(plugin => {
    pluginsList += `<li>${plugin}</li>`;
  });
  document.querySelector("ul").innerHTML = pluginsList;

  promptConfirm.addEventListener("click", () => {
    ipcRenderer.send("consent-data", true);
  });
  promptCancel.addEventListener("click", () => {
    ipcRenderer.send("consent-data", false);
  });
});

function getArgValue(query, args) {
  const arg = args.filter(p => p.indexOf(query) >= 0)[0];
  if (arg === undefined) return undefined;
  return arg.substring(arg.indexOf("=") + 1);
}
