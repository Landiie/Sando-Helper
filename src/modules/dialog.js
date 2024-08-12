const { app, dialog, BrowserWindow } = require("electron");

module.exports = {
  async showMsg(settings) {
    await app.whenReady();
    const dummy = new BrowserWindow({
      alwaysOnTop: true,
      center: true,
      show: false,
    });

    let defs = {
      type: "info",
      message: "default message",
      buttons: [],
      title: "Sando Helper",
      noLink: true,
    };

    const finalSettings = { ...defs, ...settings };
    // console.log('Showing message type', finalSettings.type)
    // console.log(finalSettings.message)
    const dialogRes = await dialog.showMessageBox(dummy, finalSettings);
    dummy.destroy();
    return dialogRes
  },
};
