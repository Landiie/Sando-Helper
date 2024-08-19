const findProcess = require("find-process");
const { app } = require("electron");
const utils = require("./utils");

let sammiPid = null;

if (app.isPackaged) sammiPid = utils.getArgValue("--sammiPid", process.argv);

module.exports = {
  async start() {
    if (sammiPid === null) {
      console.log("in dev mode, poller will not run");
      return;
    }
    setInterval(async () => {
      const res = await findProcess("pid", sammiPid, true);
      if (res.length === 0) app.quit();
      console.log(res);
    }, 500);
  },
};
