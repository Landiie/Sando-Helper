const dialog = require("./dialog");

module.exports = {
  async create(config, sammiBtn, sammiVar, sammiInstance) {
    let result = await dialog.showMsg(config);
    if (!config?.checkboxLabel) delete result.checkboxChecked;
    wss.sendToBridge(
      JSON.stringify({
        event: "SandoDevDialog",
        button: sammiBtn,
        variable: sammiVar,
        instance: sammiInstance,
        result: result,
      })
    );
  },
};
