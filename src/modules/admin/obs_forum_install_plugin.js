const extract = require("extract-zip");
const path = require("path");
const fsSync = require("fs");
const process = require("process");

const args = process.argv.splice(0);
const pluginPath = args[2];
const obsPath = args[3];

console.log("pluginPath: " + pluginPath);
console.log("obsPath: " + obsPath);

main();

async function main() {
  try {
    if (path.extname(pluginPath) !== ".zip")
      returnProcess(1, "File is not a zip file.");
    await extract(pluginPath, {
      dir: obsPath,
    });
    fsSync.unlinkSync(pluginPath);

    returnProcess(0, "success");
  } catch (e) {
    returnProcess(1, e);
  }
}

function returnProcess(code, msg) {
  let returnMsg = "child_res: ";
  if (code === 1) {
    returnMsg += "ERROR|";
  }

  console.log(returnMsg + msg);
  process.exit(code);
}

// if (path.extname(pluginFilePath) !== ".zip") {
//   throw new Error("File is not a zip file.");
// }
// await extract(pluginFilePath, {
//   dir: obsPath,
// });
// fsSync.unlinkSync(pluginFilePath);
