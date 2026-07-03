/*
 * One-shot generator for cards.json — a mock RISQUE/ARTEMIS save parked at the
 * start of round 4 cardplay, with every player holding a valid 3-card book so
 * the cardplay-removal bug can be reproduced in seconds.
 *
 * Shape mirrors Mock Game Maker's finalizeStateForExport() payload so the live
 * game loads it the same way an MGM export would.
 *
 * Run:  node scripts/gen-cards-save.js   (writes ../cards.json)
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const uuid = () => crypto.randomUUID();

// --- canonical board data (kept in sync with js/core.js) ---
const continents = {
  south_america: ["argentina", "brazil", "peru", "venezuela"],
  north_america: [
    "alaska", "alberta", "central_america", "eastern_united_states", "greenland",
    "northwest_territory", "ontario", "quebec", "western_united_states"
  ],
  africa: ["congo", "east_africa", "egypt", "madagascar", "north_africa", "south_africa"],
  europe: ["great_britain", "iceland", "northern_europe", "scandinavia", "southern_europe", "ukraine", "western_europe"],
  asia: [
    "afghanistan", "china", "india", "irkutsk", "japan", "kamchatka",
    "middle_east", "mongolia", "siam", "siberia", "ural", "yakutsk"
  ],
  australia: ["eastern_australia", "indonesia", "new_guinea", "western_australia"]
};
const continentBonus = {
  south_america: 2, north_america: 5, africa: 3, europe: 5, asia: 7, australia: 2
};
const allCardNames = [
  "afghanistan", "alaska", "alberta", "argentina", "brazil", "central_america", "china",
  "congo", "east_africa", "eastern_australia", "eastern_united_states", "egypt", "great_britain",
  "greenland", "iceland", "india", "indonesia", "irkutsk", "japan", "kamchatka", "madagascar",
  "middle_east", "mongolia", "new_guinea", "north_africa", "northern_europe", "northwest_territory",
  "ontario", "peru", "quebec", "scandinavia", "siam", "siberia", "south_africa", "southern_europe",
  "ukraine", "ural", "venezuela", "western_australia", "western_europe", "western_united_states",
  "yakutsk", "wildcard1", "wildcard2"
];

// --- territory ownership (every territory owned, 42 total) ---
const ownership = {
  GUIDO: [].concat(continents.north_america, continents.australia),          // 9 + 4 = 13
  MICTOR: [].concat(continents.asia, ["argentina", "brazil"]),               // 12 + 2 = 14
  NOOCH: [].concat(continents.africa, continents.europe, ["peru", "venezuela"]) // 6 + 7 + 2 = 15
};

// --- hands: each player holds a valid 3-of-a-kind (all infantry) book ---
const hands = {
  MICTOR: ["afghanistan", "argentina", "brazil"],
  GUIDO: ["central_america", "east_africa", "great_britain"],
  NOOCH: ["north_africa", "scandinavia", "siberia"]
};

const colors = { GUIDO: "red", MICTOR: "blue", NOOCH: "green" };
const turnOrder = ["GUIDO", "MICTOR", "NOOCH"];

const usedCardNames = new Set();
Object.values(hands).forEach((arr) => arr.forEach((n) => usedCardNames.add(n)));

const players = turnOrder.map((name, i) => {
  const territories = ownership[name].map((t) => ({ name: t, troops: 3 }));
  const cards = hands[name].map((n) => ({ name: n, id: uuid() }));
  return {
    name,
    color: colors[name],
    playerOrder: i + 1,
    bookValue: 0,
    continentValues: {},
    bankValue: 0,
    cardCount: cards.length,
    cards,
    territories,
    troopsTotal: territories.reduce((s, t) => s + t.troops, 0),
    confirmed: true
  };
});

const continentsObj = {};
Object.keys(continents).forEach((k) => {
  continentsObj[k] = { territories: continents[k].slice(), bonus: continentBonus[k] };
});

const gs = {
  phase: "cardplay",
  attackPhase: "attack",
  selectionPhase: "firstCard",
  players,
  turnOrder,
  currentPlayer: "GUIDO",
  round: 4,
  setupComplete: true,
  aerialAttack: false,
  aerialAttackEligible: false,
  aerialBridge: null,
  conquered: false,
  conqueredThisTurn: false,
  cardplayConquered: false,
  cardEarnedViaAttack: false,
  cardEarnedViaCardplay: false,
  cardAwardedThisTurn: false,
  bookPlayedThisTurn: false,
  bookValue: 0,
  lastCardDrawn: null,
  defeatedPlayer: null,
  winner: null,
  attackingTerritory: null,
  acquiredTerritory: null,
  minTroopsToTransfer: 0,
  transferredCardCount: 0,
  pendingNewContinents: [],
  isInitialDeploy: false,
  deck: allCardNames.filter((n) => !usedCardNames.has(n)),
  discardPile: [],
  continents: continentsObj,
  continentsSnapshot: {},
  continentCollectionCounts: {
    south_america: 0, north_america: 0, africa: 0, europe: 0, asia: 0, australia: 0
  },
  risquePlayedCardsGallery: [],
  risqueLuckyLedger: {
    byPlayer: turnOrder.reduce((m, n) => {
      m[n] = { dice: 0, sixes: 0, roundWins: 0, roundLosses: 0, roundTies: 0 };
      return m;
    }, {})
  },
  risqueLuckySessionRoster: turnOrder.slice()
};

const outPath = path.join(__dirname, "..", "cards.json");
fs.writeFileSync(outPath, JSON.stringify(gs, null, 2), "utf8");

// sanity checks
const ownedAll = [].concat(...Object.values(ownership));
console.log("territories owned:", ownedAll.length, "(expect 42)");
console.log("unique territories:", new Set(ownedAll).size, "(expect 42)");
console.log("deck size:", gs.deck.length, "(expect 35: 44 - 9 in hands)");
console.log("wrote:", outPath);
