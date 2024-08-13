const { app, dialog, BrowserWindow } = require("electron");
const utils = require("./utils");

const genDummy = () => {
  return new BrowserWindow({
    alwaysOnTop: true,
    center: true,
    show: false,
    focusable: true,
  });
};

module.exports = {
  async showMsg(settings) {
    await app.whenReady();
    const dummy = genDummy();

    let defs = {
      type: "info",
      buttons: [],
      title: "Sando Helper",
      noLink: true,
    };

    // console.log('Showing message type', finalSettings.type)
    // console.log(finalSettings.message)
    const dialogRes = await dialog.showMessageBox(dummy, { ...defs, ...settings });
    dummy.destroy();
    return dialogRes;
  },
  async showOpen(settings = {}, dialogProps = []) {
    await app.whenReady();
    const dummy = genDummy();

    let defs = {
      title: "Sando Helper: Open",
      properties: dialogProps,
    };

    const res = await dialog.showOpenDialog(dummy, { ...defs, ...settings });
    dummy.destroy();
    return res;
  },
  async showSave(settings = {}, dialogProps = []) {
    await app.whenReady();
    const dummy = genDummy();

    let defs = {
      title: "Sando Helper: Save",
      properties: dialogProps,
    };

    const res = await dialog.showSaveDialog(dummy, { ...defs, ...settings });
    dummy.destroy();
    return res;
  },
};
