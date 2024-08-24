const cheerio = require("cheerio");
const semver = require("semver");
const fs = require("fs");

module.exports = {
  async downloadPlugin(url, whitelist, blacklist, version = "latest") {
    const pluginVersions = await parsePluginVersions(url);
  },
  async comparePluginVersion(pluginLogPos, url, targetVersion) {
    const pluginVersions = await parsePluginVersions(url);
  },
};

async function parsePluginVersions(url) {
  const pluginVersions = {};
  const res = await fetch(url + "/history");
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
        if (semver.valid(cleanRowCell) === null) {
          throw new Error(
            "Version is not valid semver. is this the right URL? example of valid url: https://obsproject.com/forum/resources/move.913"
          );
        }
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
