const observe = require("./observe");
const path = require("path");
const utils = require("./utils");
const fs = require("fs").promises;

const dialog = require("./dialog");

const deckJsonPath =
  "C:\\Cloud\\Google Drive (Business)\\SAMMI (Product Development)\\json\\decks_data.json";
const deckJsonId = utils.createHash(deckJsonPath);

const UNIQUE_ID = "20230416033014337115649";
let lastTamper = null;

observe.file(deckJsonPath, deckJsonId);

observe.events.on(`changed:${deckJsonId}`, async filepath => {
  const data = await fs.readFile(filepath);
  const decks = JSON.parse(data).default;
  const targetDeck = decks.find(deck => deck.unique_id === UNIQUE_ID);
  const targetHash = utils.createHash(JSON.stringify(targetDeck));
  if (lastTamper === null) {
    lastTamper = targetHash;
    return;
  }

  if (lastTamper === targetHash) return;
  lastTamper = targetHash;

  dialog.showMsg({
    type: "warning",
    title: "Sando",
    message:
      "Please do not tamper with the deck! Doing so will have unintended side effects. Please only use the Commands and Triggers given to you!",
  });

  console.log("changed!");
});
