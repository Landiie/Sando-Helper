const utils = require("./utils");
const path = require("path");
const fsP = require("fs").promises;
const fs = require("fs");

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
        log = log.replace(
          /((?<!\r)\n|\r(?!\n))/g,
          "\r\n"
        );
        pluginVersion = log.substring(pos + pluginTargetStart.length, log.indexOf("\r\n", pos + pluginTargetStart.length));
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
