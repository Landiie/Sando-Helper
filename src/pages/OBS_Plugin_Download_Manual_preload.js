const { ipcRenderer } = require("electron");
//?preload inherits process by default if node integration is disabled
console.log(process.argv);
// const deckName = getArgValue("deckname", process.argv) || "Unknown";
const plugins = JSON.parse(getArgValue("plugins", process.argv));

document.addEventListener("DOMContentLoaded", () => {
  const pluginList = document.querySelector(".plugin-containers");

  generatePluginList();

  function addPlugin(name, path) {
    if (!path.endsWith(".zip")) {
      alert(`Provided file "${path}" is not a zip file.`);
      return;
    }

    const pluginPos = getPluginPos(name);
    if (pluginPos === -1) return;

    plugins[pluginPos].path = path;

    generatePluginList();
  }

  function removePlugin(name) {
    const pos = getPluginPos(name);
    if (pos === -1) return;
    plugins[pos].path = null;

    generatePluginList();
  }

  function getPluginPos(name) {
    for (let i = 0; i < plugins.length; i++) {
      if (plugins[i].name === name) {
        return i;
      }
    }
    return -1;
  }
  function generatePluginList() {
    let children = "";
    for (const plugin of plugins) {
      children += `
      <li>
                        <div class="plugin-container-header">
                            <h1>${plugin.name}</h1>
                            <h4>${plugin.version}</h4>
                            <a class="btn btn-secondary" href="https://obsproject.com/forum/resources/${plugin.id}/"
                                target="_blank" rel="noopener noreferrer">Download Page<svg
                                    xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                                    class="bi bi-box-arrow-up-right" viewBox="0 0 16 16">
                                    <path fill-rule="evenodd"
                                        d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5" />
                                    <path fill-rule="evenodd"
                                        d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z" />
                                </svg></a>
                        </div>
                        <div class="file-container">
                            <div>
                                <input type="file" id="file-input" name="file-input">
                                <p>or</p>
                                <p>Drag .zip file here!</p>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="black"
                                class="bi bi-file-earmark-zip" viewBox="0 0 16 16">
                                <path
                                    d="M5 7.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v.938l.4 1.599a1 1 0 0 1-.416 1.074l-.93.62a1 1 0 0 1-1.11 0l-.929-.62a1 1 0 0 1-.415-1.074L5 8.438zm2 0H6v.938a1 1 0 0 1-.03.243l-.4 1.598.93.62.929-.62-.4-1.598A1 1 0 0 1 7 8.438z" />
                                <path
                                    d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1h-2v1h-1v1h1v1h-1v1h1v1H6V5H5V4h1V3H5V2h1V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z" />
                            </svg>
                        </div>
                        <div class="file-container-filled" style="display: none;">
                            <button class="btn btn-danger">X</button>
                            <p>my-zip.name-here</p>
                        </div>
                    </li>
      `;
    }
    pluginList.innerHTML = children;

    const pluginsInList = pluginList.children;
    for (let i = 0; i < pluginsInList.length; i++) {
      const pluginNode = pluginsInList[i];

      pluginNode.querySelector("a").addEventListener("click", e => {
        e.preventDefault();
        ipcRenderer.send("open-external-link", e.target.href);
      });

      const pluginName = pluginNode.querySelector("h1").textContent;
      const pos = getPluginPos(pluginName);
      if (pos === -1) continue;
      if (plugins[pos].path) {
        pluginNode.querySelector(".file-container-filled").style.display =
          "flex";
        pluginNode.querySelector(".file-container").style.display = "none";

        pluginNode.querySelector(".file-container-filled p").textContent =
          plugins[pos].path;

        const deleteButton = pluginNode.querySelector(
          ".file-container-filled button"
        );
        deleteButton.addEventListener("click", e => {
          const pluginName = deleteButton
            .closest("li")
            .querySelector("h1").textContent;

          console.log("clicked X for plugin: ", pluginName);
          removePlugin(pluginName);
        });
      } else {
        pluginNode.querySelector(".file-container-filled").style.display =
          "none";
        pluginNode.querySelector(".file-container").style.display = "flex";

        const fileZone = pluginNode.querySelector(".file-container");
        fileZone.addEventListener("dragover", e => {
          e.stopPropagation();
          e.preventDefault();
          fileZone.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
        });
        fileZone.addEventListener("dragleave", e => {
          e.stopPropagation();
          e.preventDefault();
          fileZone.style.backgroundColor = "transparent";
        });
        fileZone.addEventListener("drop", e => {
          console.log(e);
          e.stopPropagation();
          e.preventDefault();
          fileZone.style.backgroundColor = "transparent";
          const pluginName = fileZone
            .closest("li")
            .querySelector("h1").textContent;
          const filePath = e.dataTransfer.files[0].path;
          console.log("adding: ", pluginName, filePath);

          addPlugin(pluginName, filePath);
        });

        const fileInput = pluginNode.querySelector(".file-container input");
        fileInput.addEventListener("change", e => {
          console.log(e);
          const pluginName = fileInput
            .closest("li")
            .querySelector("h1").textContent;
          const filePath = e.target.files[0].path;
          console.log("adding: ", pluginName, filePath);

          addPlugin(pluginName, filePath);
        });
      }
    }
  }

  promptConfirm.addEventListener("click", () => {
    if (plugins.some(p => !p.path)) {
      alert("Please provide a path for all plugins!");
      return;
    }

    plugins.forEach(plugin => {
      plugin.status = 'OK'
    });
    
    ipcRenderer.send("plugin-manual-data", plugins);
  });
  promptCancel.addEventListener("click", () => {
    ipcRenderer.send("plugin-manual-data", null);
  });
});

function getArgValue(query, args) {
  const arg = args.filter(p => p.indexOf(query) >= 0)[0];
  if (arg === undefined) return undefined;
  return arg.substring(arg.indexOf("=") + 1);
}
