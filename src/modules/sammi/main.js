const observe = require("../observe");
const path = require("path");
const utils = require("../utils");
const fs = require("fs").promises;
const dialog = require("../dialog");
const { type } = require("os");
const { app } = require("electron");
const { query, json } = require("express");

const DECK_JSON_PATH =
  "C:\\Cloud\\Google Drive (Business)\\SAMMI (Product Development)\\json\\decks_data.json";
// const deckJsonId = utils.createHash(deckJsonPath);

let localApiPort = 9450;

if (app.isPackaged) {
  localApiPort = utils.getArgValue("--sammiApiPort", process.argv) || 9450;
}

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
  async api(request, data = {}) {
    let url = `http://127.0.0.1:${localApiPort}/api`;
    let method;
    let body = null;

    switch (request) {
      case "getVariable":
      case "getDeckStatus":
        method = "GET";
        url += `?request=${request}`;
        for (prop in data) {
          url += `&${prop}=${data[prop]}`;
        }
        break;
      case "setVariable":
      case "deleteVariable":
      case "insertArray":
      case "deleteArray":
      case "changeDeckStatus":
      case "triggerButton":
      case "releaseButton":
      case "modifyButton":
      case "alertMessage":
      case "popupMessage":
      case "notificationMessage":
        method = "POST";
        body = { request: request, ...data };
        break;
      default:
        return {
          status: 404,
          data: `Request "${request}" not found.`,
        };
        break;
    }

    const fetchObj = {
      method: method,
    };

    if (body) fetchObj.body = JSON.stringify(body);

    const res = await fetch(url, fetchObj);
    const json = await res.json();
    return {
      status: res.status,
      data: json.data,
    };
  },
};

async function loadDeck() {
  const data = await fs.readFile(DECK_JSON_PATH);
  return JSON.parse(data).default;
}
