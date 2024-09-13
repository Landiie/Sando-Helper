const crypto = require("crypto");
const { app } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const child_process = require("child_process");
const { sFetch } = require("./rate_limiter.js");

let rateLimits = {};

module.exports = {
  getArgValue(query, args) {
    const arg = process.argv.filter(p => p.indexOf(query) >= 0)[0];
    if (arg === undefined) return undefined;
    return arg.substring(arg.indexOf("=") + 1);
  },
  arrayMerge(...others) {
    let mergedArr = [];
    for (let i = 0; i < others.length; i++) {
      const arr = others[i];
      mergedArr = Array.from(new Set(mergedArr.concat(arr)));
    }
    return mergedArr;
  },
  searchObjofObjs(targetObj, key, value) {
    const matched = [];
    const objs = Object.values(targetObj);
    objs.forEach(obj => {
      if (obj[key] === value) matched.push(obj);
    });
    return matched;
  },
  createHash(str) {
    return crypto.createHash("md5").update(str).digest("hex");
  },
  getAppPath() {
    if (app.isPackaged) {
      return path.join(app.getAppPath(), "..", "..");
    } else {
      return app.getAppPath();
    }
  },
  async copyFile(src, dest) {
    try {
      await fs.copyFile(src, dest);
    } catch (e) {
      throw new Error("Could not copy file: " + e);
    }
  },
  async downloadFile(url, path) {
    const res = await sFetch(url, {}, 2000);
    if (res.status !== 200) {
      throw new Error("Could not fetch download page.");
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    try {
      await fs.writeFile(path, buffer);
    } catch (e) {
      throw new Error("could not write downloaded file: " + e);
    }
  },
  runShell(command) {
    return new Promise((resolve, reject) => {
      try {
        child_process.exec(command, (err, stdout, stderr) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(stdout);
        });
      } catch (e) {
        reject(e);
      }
    });
  },
  async runAdminScript(scriptName, params) {
    const command = `cd src/modules/admin && admin.bat "${process.execPath}" "${scriptName}" ${params}`;
    try {
      const res = await this.runShell(command);

      const query = "child_res: ";
      const output = res.substring(res.indexOf(query) + query.length);
      const outputType = output.substring(0, output.indexOf("|"));
      const outputResult = output
        .substring(output.indexOf("|") + 1)
        .replace(/^[\n\t]+|[\n\t]+$/g, "");

      if (outputType === "ERROR") {
        throw new Error(outputResult);
      }
      return outputResult;
    } catch (e) {
      throw new Error("utils.runAdminScript: " + e.message);
    }
  },
  b64Encode(str) {
    return Buffer.from(str).toString("base64");
  },
  b64Decode(b64) {
    return Buffer.from(b64, "base64").toString();
  },
  // appendToUrl(url, append) {
  //   let pos = url.indexOf("?")
  //   if (pos === -1) {
  //     // throw new Error("Url cannot have query string to use this function.");

  //   }
  // },
};
