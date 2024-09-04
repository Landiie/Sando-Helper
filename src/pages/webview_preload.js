const { ipcRenderer } = require("electron");
      
      document.addEventListener("DOMContentLoaded", () => {
      document.getElementById("webview").addEventListener("dom-ready", () => {
      setTimeout(() => {
        document
          .getElementById("webview")
          .executeJavaScript(`document.querySelector('.Box-footer ul').outerHTML`)
          .then(res => {
            ipcRenderer.send("webview-data", res);
          })
          .catch(error => {
            console.error("Failed to execute script in webview:", error);
          });
      }, 3000);
      });
      });