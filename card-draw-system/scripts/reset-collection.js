const fs = require("fs");
const path = require("path");

const statePath = path.join(__dirname, "..", "data", "state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

state.collection = [];
state.history = [];
state.usedCards = {};
state.starterGiftClaimed = false;
state.bonusDrawsRemaining = 0;
state.customCards = state.customCards && typeof state.customCards === "object" ? state.customCards : {};

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

console.log(JSON.stringify({
  collection: state.collection.length,
  history: state.history.length,
  usedCards: Object.keys(state.usedCards).length,
  customCardsPreserved: Object.keys(state.customCards).length
}, null, 2));
