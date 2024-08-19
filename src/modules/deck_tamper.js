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

module.exports = {
  register(deckId) {
    const observeId = `anti_tamper_${deckId}`
    observe.file(
      path.join(__dirname, "json", "decks_data.json"),
      observeId
    );
    observe.events.on(`changed:${observeId}`, async filepath => {
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
          "The developer of this Deck has requested that you do not tamper with this deck!\n\nDoing so will have unintended side effects. Please refer to the developer's documentation to learn how to properly use their extension.",
      });

      console.log("changed!");
    });
  },
};
