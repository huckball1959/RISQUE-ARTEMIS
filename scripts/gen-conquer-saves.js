/*
 * Generates conquer-test mock saves at repo root — attack phase, one elimination
 * away from the first conquest, second victim also down to a single border territory.
 *
 * Scenarios:
 *   conquer-guido.json        — Guido → Mictor → Nooch
 *   conquer-mictor-guido.json — Mictor → Guido → Nooch
 *   conquer-mictor-nooch.json — Mictor → Nooch → Guido
 *
 * Run:  node scripts/gen-conquer-saves.js
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const uuid = () => crypto.randomUUID();

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
const allTerritories = [].concat(
  continents.south_america,
  continents.north_america,
  continents.africa,
  continents.europe,
  continents.asia,
  continents.australia
);
const allCardNames = [
  "afghanistan", "alaska", "alberta", "argentina", "brazil", "central_america", "china",
  "congo", "east_africa", "eastern_australia", "eastern_united_states", "egypt", "great_britain",
  "greenland", "iceland", "india", "indonesia", "irkutsk", "japan", "kamchatka", "madagascar",
  "middle_east", "mongolia", "new_guinea", "north_africa", "northern_europe", "northwest_territory",
  "ontario", "peru", "quebec", "scandinavia", "siam", "siberia", "south_africa", "southern_europe",
  "ukraine", "ural", "venezuela", "western_australia", "western_europe", "western_united_states",
  "yakutsk", "wildcard1", "wildcard2"
];

const colors = { GUIDO: "red", MICTOR: "blue", NOOCH: "green" };
const turnOrder = ["GUIDO", "MICTOR", "NOOCH"];

const SCENARIOS = [
  {
    file: "conquer-guido.json",
    saveId: "conquer-guido",
    label: "CONQUER TEST — Guido eliminates Mictor, then Nooch",
    currentPlayer: "GUIDO",
    attacker: "GUIDO",
    lastStand: [
      { owner: "MICTOR", name: "argentina", troops: 1 },
      { owner: "NOOCH", name: "peru", troops: 1 }
    ],
    attackHubs: [{ owner: "GUIDO", name: "brazil", troops: 50 }],
    hands: {
      GUIDO: ["central_america", "east_africa", "great_britain", "iceland"],
      MICTOR: ["afghanistan", "alberta", "china", "congo", "egypt"],
      NOOCH: ["north_africa", "scandinavia", "siberia"]
    }
  },
  {
    file: "conquer-mictor-guido.json",
    saveId: "conquer-mictor-guido",
    label: "CONQUER TEST — Mictor eliminates Guido, then Nooch",
    currentPlayer: "MICTOR",
    attacker: "MICTOR",
    lastStand: [
      { owner: "GUIDO", name: "alaska", troops: 1 },
      { owner: "NOOCH", name: "western_australia", troops: 1 }
    ],
    attackHubs: [
      { owner: "MICTOR", name: "kamchatka", troops: 50 },
      { owner: "MICTOR", name: "indonesia", troops: 50 }
    ],
    hands: {
      MICTOR: ["argentina", "brazil", "peru", "venezuela", "japan"],
      GUIDO: ["greenland", "ontario", "quebec"],
      NOOCH: ["eastern_australia", "new_guinea", "siam"]
    }
  },
  {
    file: "conquer-mictor-nooch.json",
    saveId: "conquer-mictor-nooch",
    label: "CONQUER TEST — Mictor eliminates Nooch, then Guido",
    currentPlayer: "MICTOR",
    attacker: "MICTOR",
    lastStand: [
      { owner: "NOOCH", name: "western_australia", troops: 1 },
      { owner: "GUIDO", name: "alaska", troops: 1 }
    ],
    attackHubs: [
      { owner: "MICTOR", name: "indonesia", troops: 50 },
      { owner: "MICTOR", name: "kamchatka", troops: 50 }
    ],
    hands: {
      MICTOR: ["argentina", "brazil", "peru", "venezuela", "japan"],
      NOOCH: ["eastern_australia", "new_guinea", "siam"],
      GUIDO: ["greenland", "ontario", "quebec"]
    }
  }
];

function buildScenario(scenario) {
  const territoryOwner = {};
  const territoryTroops = {};

  scenario.lastStand.forEach(function (ls) {
    territoryOwner[ls.name] = ls.owner;
    territoryTroops[ls.name] = ls.troops;
  });
  scenario.attackHubs.forEach(function (hub) {
    territoryOwner[hub.name] = hub.owner;
    territoryTroops[hub.name] = hub.troops;
  });

  allTerritories.forEach(function (t) {
    if (territoryOwner[t]) return;
    territoryOwner[t] = scenario.attacker;
    territoryTroops[t] = 3;
  });

  const usedCardNames = new Set();
  Object.values(scenario.hands).forEach(function (arr) {
    arr.forEach(function (n) {
      usedCardNames.add(n);
    });
  });

  const players = turnOrder.map(function (name, i) {
    const territories = allTerritories
      .filter(function (t) {
        return territoryOwner[t] === name;
      })
      .map(function (t) {
        return { name: t, troops: territoryTroops[t] };
      });
    const cards = (scenario.hands[name] || []).map(function (n) {
      return { name: n, id: uuid() };
    });
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
      troopsTotal: territories.reduce(function (s, t) {
        return s + t.troops;
      }, 0),
      confirmed: true
    };
  });

  const continentsObj = {};
  Object.keys(continents).forEach(function (k) {
    continentsObj[k] = { territories: continents[k].slice(), bonus: continentBonus[k] };
  });

  return {
    phase: "attack",
    attackPhase: "attack",
    selectionPhase: "firstCard",
    players,
    turnOrder: turnOrder.slice(),
    currentPlayer: scenario.currentPlayer,
    round: 6,
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
    deck: allCardNames.filter(function (n) {
      return !usedCardNames.has(n);
    }),
    discardPile: [],
    continents: continentsObj,
    continentsSnapshot: {},
    continentCollectionCounts: {
      south_america: 0,
      north_america: 0,
      africa: 0,
      europe: 0,
      asia: 0,
      australia: 0
    },
    risquePlayedCardsGallery: [],
    risqueLuckyLedger: {
      byPlayer: turnOrder.reduce(function (m, n) {
        m[n] = { dice: 0, sixes: 0, roundWins: 0, roundLosses: 0, roundTies: 0 };
        return m;
      }, {})
    },
    risqueLuckySessionRoster: turnOrder.slice(),
    risqueArtemisAutoSaveId: scenario.saveId,
    risqueArtemisAutoSaveLabel: scenario.label,
    artemisRoster: turnOrder.map(function (name, i) {
      return { slot: i + 1, name: name, color: colors[name] };
    }),
    artemisControlSlot: (function () {
      var idx = turnOrder.indexOf(scenario.currentPlayer);
      return idx >= 0 ? idx + 1 : 1;
    })(),
    risqueArtemisControlSeq: 2
  };
}

const root = path.join(__dirname, "..");
SCENARIOS.forEach(function (scenario) {
  const gs = buildScenario(scenario);
  const outPath = path.join(root, scenario.file);
  fs.writeFileSync(outPath, JSON.stringify(gs, null, 2), "utf8");
  const owned = [].concat.apply(
    [],
    gs.players.map(function (p) {
      return p.territories.map(function (t) {
        return t.name;
      });
    })
  );
  console.log("wrote:", outPath);
  console.log(
    "  currentPlayer:",
    gs.currentPlayer,
    "| territories:",
    owned.length,
    "| deck:",
    gs.deck.length
  );
  gs.players.forEach(function (p) {
    console.log(
      "  ",
      p.name,
      "territories:",
      p.territories.length,
      "cards:",
      p.cards.length,
      "troops:",
      p.troopsTotal
    );
  });
});
