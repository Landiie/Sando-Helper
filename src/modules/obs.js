const utils = require("./utils");
const path = require("path");

module.exports = {
  async getPluginVersion(pluginName, pluginTargetStart, logPath) {

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
