const observe = require("../observe");
const path = require("path");
const utils = require("../utils");
const fs = require("fs").promises;
const dialog = require("../dialog");
const { type } = require("os");

const DECK_JSON_PATH =
  "C:\\Cloud\\Google Drive (Business)\\SAMMI (Product Development)\\json\\decks_data.json";
// const deckJsonId = utils.createHash(deckJsonPath);

module.exports = {
  deckData: null,
  initDecks() {
    return new Promise(async (resolve, reject) => {
      module.exports.deckData = await loadDeck();
      resolve();
      const observeId = `sammi_deck_data`;
      observe.file(DECK_JSON_PATH, observeId);
      observe.events.on(`changed:${observeId}`, async filepath => {
        module.exports.deckData = await loadDeck();
        console.log("changed!");
      });
    });
  },
  async getDeckNameFromButtonId(buttonId) {
    for (let i = 0; i < module.exports.deckData.length; i++) {
      const deck = module.exports.deckData[i];

      if (typeof deck !== "object") continue; //anything else is an encrypted deck
      
      for (let i2 = 0; i2 < deck.button_list.length; i2++) {
        const button = deck.button_list[i2];
        if (button.button_id === buttonId) {
          return deck.deck_name;
        }
      }
    }
    return null;
  },
};

async function loadDeck() {
  const data = await fs.readFile(DECK_JSON_PATH);
  return JSON.parse(data).default;
}
