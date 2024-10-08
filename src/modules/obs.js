const utils = require("./utils");
const path = require("path");
const fsP = require("fs").promises;
const fs = require("fs");
const { app } = require("electron");
const process = require("process");
const sammi = require("./sammi/main.js");
const observe = require("./observe.js");
const findProcess = require("find-process");
const obsws = require("./obs_ws.js");

let obsExe = "C:\\Cloud\\Google Drive (Business)\\OBS\\bin\\64bit\\obs64.exe";

if (app.isPackaged) {
  obsExe = utils.getArgValue("--obsExe", process.argv);
}

module.exports = {
  async pluginVersionCheck(
    pluginName,
    targetVersion,
    logPath,
    pluginTargetStart,
    pluginTargetEnd = null
  ) {
    try {
      if (!fs.existsSync(logPath))
        throw new Error(`Log file "${logPath}" not found.`);
      let log = await fsP.readFile(logPath, "utf8");
      const pos = log.indexOf(pluginTargetStart);
      if (pos === -1) throw new Error("Plugin Start Not Found");

      let pluginVersion = null;
      if (pluginTargetEnd) {
        const posEnd = log.indexOf(pluginTargetEnd, pos);
        if (posEnd === -1) throw new Error("Plugin End Not Found");
        pluginVersion = log.substring(pos + pluginTargetStart.length, posEnd);
      } else {
        // Ensure all line endings are CRLF (\r\n)
        log = log.replace(/((?<!\r)\n|\r(?!\n))/g, "\r\n");
        pluginVersion = log.substring(
          pos + pluginTargetStart.length,
          log.indexOf("\r\n", pos + pluginTargetStart.length)
        );
      }

      pluginVersion = pluginVersion.trim();

      const currentIsHigher = compareVersions(pluginVersion, targetVersion);

      if (currentIsHigher)
        return {
          name: pluginName,
          status: "OK",
          currentVersion: pluginVersion,
          targetVersion: targetVersion,
        };

      return {
        name: pluginName,
        status: "OUTDATED",
        currentVersion: pluginVersion,
        targetVersion: targetVersion,
      };
    } catch (e) {
      if (
        e.message === "Plugin Start Not Found" ||
        e.message === "Plugin End Not Found"
      ) {
        return {
          name: pluginName,
          status: "OUTDATED",
          currentVersion: "NOT FOUND",
          targetVersion: targetVersion,
          message: e.message,
        };
      }
      return {
        name: pluginName,
        status: "ERROR",
        message: e.message,
      };
    }
  },
  async installPlugin(name, pluginFilePath, obsPath) {
    try {
      const res = await utils.runAdminScript(
        "obs_forum_install_plugin.js",
        `"${path.resolve(pluginFilePath)}" "${path.resolve(obsPath)}"`
      );
      console.log(res);
      return {
        name: name,
        status: "OK",
      };
    } catch (e) {
      return {
        name: name,
        status: "ERROR",
        message: e.message,
      };
    }
  },
  async restart() {
    const resRestartSet = await sammi.api("setVariable", {
      name: "obsRestarting",
      value: true,
      buttonID: "Sando",
    });

    if (resRestartSet.status !== 200) {
      return {
        status: resRestartSet.status,
        data: "could not set obsRestarting variable",
      };
    }

    const closeRes = await module.exports.close();

    if (closeRes.status !== 200) {
      console.log(closeRes);
      return {
        status: closeRes.status,
        data: closeRes.data
      };
    }

    const openRes = await module.exports.open();

    if (openRes.status !== 200) {
      console.log(openRes);
      return {
        status: openRes.status,
        data: openRes.data
      };
    }

    const resRestartReset = await sammi.api("setVariable", {
      name: "obsRestarting",
      value: false,
      buttonID: "Sando",
    });

    if (resRestartReset.status !== 200) {
      return {
        status: resRestartReset.status,
        data: "could not set obsRestarting variable",
      };
    }
    return {
      status: 200,
      data: "OK",
    };
  },
  async close() {
    let obsPid;
    try {
      const res = await utils.runShell(
        `powershell -Command "Get-Process | Where-Object { $_.Path -eq '${obsExe}' } | Select-Object Id, Name, Path | ConvertTo-Json"`
      );
      const resObj = utils.parseJson(res);
      if (!resObj) throw new Error("Could not find PID for path");
      console.log(resObj);
      obsPid = resObj.Id;
      if (!obsPid) throw new Error("Recieved a result, but could not get PID.");
    } catch (e) {
      console.log(e);
      return {
        status: 404,
        data: e.message,
      };
    }

    try {
      let exists = true;
      let timeout = 0;
      while (exists && timeout < 10) {
        console.log("attempting");
        await utils.runShell(`taskkill /PID ${obsPid}`);
        await utils.wait(1000);
        const res = await findProcess("pid", obsPid, true);
        if (res.length === 0) {
          exists = false;
          break;
        }
        await utils.wait(3000);
      }
    } catch (e) {
      console.log(e);
      return {
        status: 404,
        data: e.message,
      };
    }

    return {
      status: 200,
      data: "Ok",
    };
  },
  async open() {
    utils.runShell(
      `cd /d "${obsExe.replace(
        "obs64.exe",
        ""
      )}" && start "" "obs64.exe" --disable-shutdown-check`
    );

    while (!utils.bridgeConnected || !obsws.connected) {
      console.log("bridge:", utils.bridgeConnected);
      console.log("obsws:", obsws.connected);
      console.log("waiting...");
      await utils.wait(1000);
    }

    console.log("reconnections successful");
    await utils.wait(1000);
    //TODO replace sando's latest log with new one, create restart polling endpoint if restart takes longer than http specification

    const configPathRes = await sammi.api("getVariable", {
      name: "Sando.obs_connections.Main.config_path",
    });

    if (configPathRes.status !== 200) {
      return {
        status: configPathRes.status,
        data: "Could not fetch config path from obs connections in Sando SAMMI",
      };
    }

    const logsPath = path.join(configPathRes.data, "logs");
    const logs = fs.readdirSync(logsPath, "utf-8");
    const latestLog = logs[logs.length - 1];
    const setLatestLog = await sammi.api("setVariable", {
      name: "obs_connections.Main.latest_log_path",
      value: latestLog,
      buttonID: "Sando",
    });

    if (setLatestLog.status !== 200) {
      return {
        status: setLatestLog.status,
        data: "could not set latestlog variable",
      };
    }

    return {
      status: 200,
      data: "OK",
    };
  },
};

function compareVersions(current, target) {
  const currentParts = current.split(".");
  const targetParts = target.split(".");

  for (let i = 0; i < currentParts.length; i++) {
    const currentPart = parseInt(currentParts[i]);
    const targetPart = parseInt(targetParts[i]);

    if (currentPart > targetPart) return true;
    if (currentPart < targetPart) return false;
  }

  return true;
}
