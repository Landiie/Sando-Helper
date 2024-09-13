const cheerio = require("cheerio");
const semver = require("semver");
const fsSync = require("fs");
const fs = require("fs").promises;
const path = require("path");
const utils = require("./utils.js");
const { app, BrowserWindow, ipcMain } = require("electron");
const extract = require("extract-zip");
const sudo = require("sudo-prompt");
const child_process = require("child_process");
const ft = import("../../node_modules/file-type/core.js");
const { sFetch } = require("./rate_limiter.js");
module.exports = {
  async downloadPluginsManual(plguinIds) {
    console.log("downloading plugin file: ", downloadLink);
    const pluginPath = path.join(app.getAppPath(), "plugins_manual");
    // const pluginFilePath = path.join(
    //   pluginPath,
    //   utils.createHash(pluginId) + ".zip"
    // );
    pluginPathExists = fsSync.existsSync(pluginPath);
    if (!pluginPathExists) {
      await fs.mkdir(pluginPath);
    }
  },
  async downloadPlugin(
    pluginId,
    whitelist,
    blacklist,
    name,
    version = "latest"
  ) {
    try {
      console.log(
        "download plugin begin, data: ",
        pluginId,
        whitelist,
        blacklist,
        name,
        version
      );
      console.log("parsing plugin versions");
      const pluginVersions = await parsePluginVersions(
        `https://obsproject.com/forum/resources/${pluginId}/`
      );
      console.log("parsing plugin versions DONE");

      if (version === "latest") version = Object.keys(pluginVersions)[0];
      let link = pluginVersions[version];

      if (link === undefined) {
        throw new Error(
          `Version "${version}" not found in retrieved plugin history.`
        );
      }
      let downloadLink = null;
      try {
        console.log(
          "parsing plugin download page: ",
          "https://obsproject.com" + link
        );
        downloadLink = await parsePluginDownloadPage(
          "https://obsproject.com" + link,
          whitelist,
          blacklist,
          version
        );
        console.log("parsing plugin download page DONE");
      } catch (e) {
        throw new Error("obs_forum.downloadPlugin: " + e);
      }

      try {
        console.log("downloading plugin file: ", downloadLink);
        const pluginPath = path.join(app.getAppPath(), "plugins");
        const pluginFilePath = path.join(
          pluginPath,
          utils.createHash(pluginId) + ".zip"
        );
        pluginPathExists = fsSync.existsSync(pluginPath);
        if (!pluginPathExists) {
          await fs.mkdir(pluginPath);
        }

        await utils.downloadFile(downloadLink, pluginFilePath);
        console.log("downloading plugin file DONE");
        console.log("finished! return.");

        return {
          name: name,
          status: "OK",
          version: version,
          path: pluginFilePath,
        };
      } catch (e) {
        throw new Error("could not download plugin file: " + e);
      }
    } catch (e) {
      console.error(e);
      // throw new Error("obs_forum.downloadPlugin: " + e);
      return {
        name: name,
        status: "ERROR",
        message: e.message,
        id: pluginId,
        version: version
      };
    }
  },
  async comparePluginVersion(pluginLogPos, url, targetVersion) {
    const pluginVersions = await parsePluginVersions(url);
  },
};

async function parsePluginDownloadPage(url, whitelist, blacklist, version) {
  //version here is used to build a github release link!
  console.log("plugin download page link recieved: ", url);
  const res = await sFetch(url, {}, 2000);
  if (res.status !== 200) {
    throw new Error("Could not fetch download page: " + res.statusText);
  }
  url = res.url;
  const resClone = res.clone();

  // console.log('redirected url: ', res.url);

  const rawText = await res.text();
  fsSync.writeFileSync("website.txt", rawText, "utf-8");

  console.log("before");
  if (!rawText.includes("<!DOCTYPE html>")) {
    console.log("after");

    //check what the heck it is
    //! this is really ugly, trying to use es6 module in commonjs. eugh.
    try {
      const fileType = await (
        await ft
      ).fileTypeFromBuffer(await resClone.arrayBuffer());
      if (!fileType?.ext === "zip" || fileType === undefined) {
        throw new Error(
          "Parsed download page was actually a file, but not a zip file."
        );
      }
      return url; //this is the download link
    } catch (e) {
      throw new Error(e);
    }
  }

  const websiteType = getWebsiteType(rawText);
  let foundLink = null;
  switch (websiteType) {
    case "obs":
      const $ = cheerio.load(rawText);
      let listItems;
      try {
        listItems = $(".block-body").children();
      } catch (e) {
        throw new Error(e);
      }

      if (listItems.length === 0) {
        throw new Error("No list items found in block body.");
      }

      for (let i = 0; i < listItems.length; i++) {
        const item = listItems[i];
        const $item = $(item);
        const link = $item.find(".contentRow-extra a").attr("href");
        const title = $item.find(".contentRow-title").text().toLowerCase();
        if (!link || !title) {
          throw new Error("Could not find link or title in list item.");
        }

        const matched = isMatchingPlugin(title, whitelist, blacklist);
        if (matched === null) continue;

        foundLink = "https://obsproject.com" + link;
        break;
      }

      break;
    case "github": {
      console.log("githubUrl: ", url);

      // prepareWebview(url);

      const query = "/releases";
      const releasesPos = url.indexOf(query);
      if (releasesPos === -1) {
        throw new Error("URL is not a github release page.");
      }

      let githubUrl = url.substring(0, releasesPos + query.length);
      githubUrl += "/tag/" + version;

      const rawHtml = await grabGithubAssetsUl(
        githubUrl,
        `const { ipcRenderer } = require("electron");
      
      document.addEventListener("DOMContentLoaded", () => {
      document.getElementById("webview").addEventListener("dom-ready", () => {
      setTimeout(() => {
        document
          .getElementById("webview")
          .executeJavaScript(\`document.querySelector('.Box-footer ul').outerHTML\`)
          .then(res => {
            ipcRenderer.send("webview-data", res);
          })
          .catch(error => {
            console.error("Failed to execute script in webview:", error);
          });
      }, 3000);
      });
      });`
      );

      // const rawHtml = await res.text();
      // fsSync.writeFileSync("github.txt", rawHtml, "utf-8");
      const $ = cheerio.load(rawHtml);
      try {
        const fileItems = $("ul").children();
        console.log("fileItems: ", fileItems.html());
        for (let i = 0; i < fileItems.length; i++) {
          const item = fileItems[i];
          const $item = $(item);
          const link = $item.find("a").attr("href");

          const matched = isMatchingPlugin(link, whitelist, blacklist);

          if (matched === null) continue;
          foundLink = "https://github.com" + link;
          break;
        }
      } catch (e) {
        throw new Error(e);
      }
      break;
    }
    default:
      break;
  }

  if (foundLink === null) {
    throw new Error("No matching download link found in list items.");
  }
  console.log("FOUND LINK: ", foundLink);
  return foundLink;
}

function isMatchingPlugin(source, whitelist, blacklist) {
  let matchCount = 0;
  whitelist.forEach(query => {
    if (source.includes(query.toLowerCase())) {
      matchCount++;
    }
  });

  if (matchCount === 0) {
    return null;
  }

  try {
    blacklist.forEach(word => {
      if (source.includes(word.toLowerCase())) {
        throw new Error(`Blacklisted term "${word}" found in title.`);
      }
    });
  } catch (e) {
    return null;
  }

  return true;
}

function grabGithubAssetsUl(url, script) {
  return new Promise(async (resolve, reject) => {
    prepareWebview(url, script);

    const win = new BrowserWindow({
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        webviewTag: true,
        nodeIntegration: true,
        contextIsolation: false,
        preload: path.join(__dirname, "..", "pages", "webview_preload.js"),
      },
    });
    win.loadFile(path.join(__dirname, "..", "pages", "webview.html"));

    ipcMain.once("webview-data", (event, data) => {
      win.close();
      resolve(data);
    });
  });
}

function prepareWebview(url, script) {
  fsSync.writeFileSync(
    path.join(__dirname, "..", "pages", "webview.html"),
    `<!DOCTYPE html>
<html lang="en">

<head>
</head>

<body>
    <webview id="webview" src="${url}"
        style="width: 100%; height: 600px;">
    </webview>
</body>

</html>`
  );
  fsSync.writeFileSync(
    path.join(__dirname, "..", "pages", "webview_preload.js"),
    script,
    "utf-8"
  );
}

function getWebsiteType(rawHtml) {
  const $ = cheerio.load(rawHtml);
  const title = $("title").text();
  if (title.includes("OBS Forums")) return "obs";
  if (title.includes("GitHub")) return "github";
  return null;
}

async function parsePluginVersions(url) {
  const pluginVersions = {};
  if (url.endsWith("/")) url = url.slice(0, -1);
  const res = await sFetch(url + "/history", {}, 2000);
  if (res.status !== 200) {
    throw new Error("Could not fetch URL.");
  }
  const rawHtml = await res.text();
  const $ = cheerio.load(rawHtml);
  const rows = $("tbody").children();
  if (rows.length === 0) {
    throw new Error(
      "No table body found in page; is this the right URL? example of valid url: https://obsproject.com/forum/resources/move.913"
    );
  }
  for (let i = 0; i < rows.length; i++) {
    if (i === 0) continue; //skip the first row
    const row = rows[i];

    let tempVersion = null;
    const rowCells = row.children;
    for (let i2 = 0; i2 < rowCells.length; i2++) {
      const rowCell = rowCells[i2];

      const cleanRowCell = $(rowCell)
        .text()
        .replace(/^[\n\t]+|[\n\t]+$/g, "");
      // second cell is the version
      if (i2 === 1) {
        // if (semver.valid(cleanRowCell) === null) {
        //   throw new Error(
        //     "Version is not valid semantic versioning. is this the right URL? example of valid url: https://obsproject.com/forum/resources/move.913"
        //   );
        // }
        tempVersion = cleanRowCell;
        continue;
      }

      //pushes download link
      if (cleanRowCell === "Download") {
        const downloadLink = $(rowCell).find("a").attr("href");
        pluginVersions[tempVersion] = downloadLink;
        continue;
      }
    }
  }
  return pluginVersions;
}
