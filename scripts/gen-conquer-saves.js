/*
 * Generates conquer-test mock saves at repo root.
 *
 * Attack phase — one elimination away per chain (attacker 4 cards, defenders 5):
 *   conquer-guido.json, conquer-mictor-guido.json, conquer-mictor-nooch.json, conquer-nooch-guido.json
 *
 * Cardplay phase — final win via territory card (2 valid books + 3 loose, incl. finisher):
 *   conquer-*-cardplay.json (same four chains)
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

const cardTypes = {
  afghanistan: "infantry", alaska: "artillery", alberta: "artillery", argentina: "infantry",
  brazil: "infantry", central_america: "infantry", china: "artillery", congo: "artillery",
  east_africa: "infantry", eastern_australia: "cavalry", eastern_united_states: "artillery",
  egypt: "cavalry", great_britain: "infantry", greenland: "cavalry", iceland: "cavalry",
  india: "cavalry", indonesia: "infantry", irkutsk: "artillery", japan: "cavalry",
  kamchatka: "artillery", madagascar: "cavalry", middle_east: "artillery", mongolia: "cavalry",
  new_guinea: "cavalry", north_africa: "infantry", northern_europe: "cavalry",
  northwest_territory: "cavalry", ontario: "artillery", peru: "cavalry", quebec: "artillery",
  scandinavia: "infantry", siam: "cavalry", siberia: "infantry", south_africa: "artillery",
  southern_europe: "infantry", ukraine: "infantry", ural: "infantry", venezuela: "cavalry",
  western_australia: "artillery", western_europe: "infantry", western_united_states: "artillery",
  yakutsk: "artillery", wildcard1: "wildcard", wildcard2: "wildcard"
};

const colors = { GUIDO: "red", MICTOR: "blue", NOOCH: "green" };
const turnOrder = ["GUIDO", "MICTOR", "NOOCH"];

function isValidRisqueThreeCardSet(cardIds) {
  if (!Array.isArray(cardIds) || cardIds.length !== 3) return false;
  var ct = { infantry: 0, cavalry: 0, artillery: 0, wildcard: 0 };
  cardIds.forEach(function (id) {
    var t = cardTypes[id] || "wildcard";
    if (t === "wildcard") ct.wildcard++;
    else if (t === "infantry") ct.infantry++;
    else if (t === "cavalry") ct.cavalry++;
    else if (t === "artillery") ct.artillery++;
  });
  var w = ct.wildcard;
  var i = ct.infantry;
  var c = ct.cavalry;
  var a = ct.artillery;
  if (i + w >= 3 || c + w >= 3 || a + w >= 3) return true;
  if (i > 1 || c > 1 || a > 1) return false;
  if (i + c + a + w !== 3) return false;
  var need = (i === 0 ? 1 : 0) + (c === 0 ? 1 : 0) + (a === 0 ? 1 : 0);
  return w >= need;
}

function countValidBooks(hand) {
  var n = hand.length;
  var count = 0;
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      for (var k = j + 1; k < n; k++) {
        if (isValidRisqueThreeCardSet([hand[i], hand[j], hand[k]])) count++;
      }
    }
  }
  return count;
}

/** Two books (infantry ×3 + cavalry ×3) plus 3 loose cards; finisher must match victim last territory. */
function buildCardplayFinisherHand(finishCard) {
  var used = {};
  function take(list) {
    list.forEach(function (c) {
      if (used[c]) throw new Error("duplicate card " + c);
      used[c] = true;
    });
    return list.slice();
  }
  var book1 = take(["brazil", "indonesia", "north_africa"]);
  var book2 = take(["eastern_australia", "new_guinea", "greenland"]);
  var loose = [finishCard, "japan", "irkutsk"];
  if (used[loose[1]]) loose[1] = "congo";
  if (used[loose[2]]) loose[2] = "madagascar";
  loose.forEach(function (c) {
    if (used[c]) throw new Error("duplicate loose card " + c);
    used[c] = true;
  });
  return book1.concat(book2).concat(loose);
}

const ATTACK_SCENARIOS = [
  {
    file: "conquer-guido.json",
    saveId: "conquer-guido",
    label: "CONQUER TEST — Guido eliminates Mictor, then Nooch (attack)",
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
      NOOCH: ["north_africa", "scandinavia", "siberia", "indonesia", "western_australia"]
    }
  },
  {
    file: "conquer-mictor-guido.json",
    saveId: "conquer-mictor-guido",
    label: "CONQUER TEST — Mictor eliminates Guido, then Nooch (attack)",
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
      MICTOR: ["argentina", "brazil", "peru", "alaska"],
      GUIDO: ["greenland", "ontario", "quebec", "alberta", "japan"],
      NOOCH: ["eastern_australia", "new_guinea", "siam", "madagascar", "congo"]
    }
  },
  {
    file: "conquer-mictor-nooch.json",
    saveId: "conquer-mictor-nooch",
    label: "CONQUER TEST — Mictor eliminates Nooch, then Guido (attack)",
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
      MICTOR: ["argentina", "brazil", "peru", "alaska"],
      NOOCH: ["eastern_australia", "new_guinea", "siam", "western_australia", "indonesia"],
      GUIDO: ["greenland", "ontario", "quebec", "alberta", "japan"]
    }
  },
  {
    file: "conquer-nooch-guido.json",
    saveId: "conquer-nooch-guido",
    label: "CONQUER TEST — Nooch eliminates Mictor, then Guido (attack)",
    currentPlayer: "NOOCH",
    attacker: "NOOCH",
    lastStand: [
      { owner: "MICTOR", name: "argentina", troops: 1 },
      { owner: "GUIDO", name: "alaska", troops: 1 }
    ],
    attackHubs: [
      { owner: "NOOCH", name: "brazil", troops: 50 },
      { owner: "NOOCH", name: "peru", troops: 50 }
    ],
    hands: {
      NOOCH: ["central_america", "east_africa", "great_britain", "iceland"],
      MICTOR: ["afghanistan", "alberta", "china", "congo", "egypt"],
      GUIDO: ["greenland", "ontario", "quebec", "alberta", "japan"]
    }
  }
];

/** Mictor chains that finish vs Guido via Alaska card — conqueror hand must include alaska. */
function assertMictorAlaskaForGuidoFinish(scenario) {
  if (!scenario.file || scenario.file.indexOf("mictor") === -1) return;
  if (scenario.file.indexOf("nooch-guido") !== -1 && scenario.file.indexOf("mictor-nooch") === -1) return;
  var isCardplay = scenario.file.indexOf("cardplay") !== -1;
  var mictorFinishesGuido =
    isCardplay &&
    scenario.conqueror === "MICTOR" &&
    scenario.finalVictim === "GUIDO" &&
    scenario.finishCard === "alaska";
  var mictorAttackVsGuido =
    !isCardplay && scenario.attacker === "MICTOR" && scenario.saveId && scenario.saveId.indexOf("mictor") !== -1;
  if (!mictorFinishesGuido && !mictorAttackVsGuido) return;
  var hands = isCardplay ? buildCardplayFinisherHand(scenario.finishCard) : scenario.hands && scenario.hands.MICTOR;
  if (!hands || hands.indexOf("alaska") === -1) {
    throw new Error(scenario.file + ": Mictor hand must include alaska for Guido finish");
  }
}

const CARDPLAY_SCENARIOS = [
  {
    file: "conquer-guido-cardplay.json",
    saveId: "conquer-guido-cardplay",
    label: "CONQUER TEST — Guido card-win vs Nooch (2 books + finisher)",
    conqueror: "GUIDO",
    priorEliminated: "MICTOR",
    finalVictim: "NOOCH",
    finalTerritory: { owner: "NOOCH", name: "western_australia", troops: 1 },
    finishCard: "western_australia",
    victimHand: ["scandinavia", "siberia", "indonesia", "madagascar", "congo"]
  },
  {
    file: "conquer-mictor-guido-cardplay.json",
    saveId: "conquer-mictor-guido-cardplay",
    label: "CONQUER TEST — Mictor card-win vs Nooch (2 books + finisher)",
    conqueror: "MICTOR",
    priorEliminated: "GUIDO",
    finalVictim: "NOOCH",
    finalTerritory: { owner: "NOOCH", name: "western_australia", troops: 1 },
    finishCard: "western_australia",
    victimHand: ["eastern_australia", "new_guinea", "siam", "madagascar", "congo"]
  },
  {
    file: "conquer-mictor-nooch-cardplay.json",
    saveId: "conquer-mictor-nooch-cardplay",
    label: "CONQUER TEST — Mictor card-win vs Guido (2 books + Alaska)",
    conqueror: "MICTOR",
    priorEliminated: "NOOCH",
    finalVictim: "GUIDO",
    finalTerritory: { owner: "GUIDO", name: "alaska", troops: 1 },
    finishCard: "alaska",
    victimHand: ["greenland", "ontario", "quebec", "alberta", "japan"]
  },
  {
    file: "conquer-nooch-guido-cardplay.json",
    saveId: "conquer-nooch-guido-cardplay",
    label: "CONQUER TEST — Nooch card-win vs Guido (2 books + Alaska)",
    conqueror: "NOOCH",
    priorEliminated: "MICTOR",
    finalVictim: "GUIDO",
    finalTerritory: { owner: "GUIDO", name: "alaska", troops: 1 },
    finishCard: "alaska",
    victimHand: ["greenland", "ontario", "quebec", "alberta", "japan"]
  }
];

function assertConquerHandCounts(scenario) {
  var atk = scenario.attacker;
  var atkN = (scenario.hands[atk] || []).length;
  if (atkN !== 4) {
    throw new Error(scenario.file + ": attacker " + atk + " must have 4 cards (has " + atkN + ")");
  }
  var defenders = [];
  scenario.lastStand.forEach(function (ls) {
    if (defenders.indexOf(ls.owner) === -1) defenders.push(ls.owner);
  });
  defenders.forEach(function (def) {
    var n = (scenario.hands[def] || []).length;
    if (n !== 5) {
      throw new Error(scenario.file + ": defender " + def + " must have 5 cards (has " + n + ")");
    }
  });
}

function assertCardplayHand(scenario, hand) {
  if (hand.length !== 9) {
    throw new Error(scenario.file + ": conqueror hand must have 9 cards (has " + hand.length + ")");
  }
  var books = countValidBooks(hand);
  if (books < 2) {
    throw new Error(scenario.file + ": conqueror hand must contain at least 2 valid books (has " + books + ")");
  }
  if (hand.indexOf(scenario.finishCard) === -1) {
    throw new Error(scenario.file + ": conqueror hand missing finisher " + scenario.finishCard);
  }
}

function baseMeta(scenario, currentPlayer) {
  return {
    selectionPhase: "firstCard",
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
    discardPile: [],
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
      var idx = turnOrder.indexOf(currentPlayer);
      return idx >= 0 ? idx + 1 : 1;
    })(),
    risqueArtemisControlSeq: 2,
    risqueConquestChainActive: true
  };
}

function buildAttackScenario(scenario) {
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

  return Object.assign(baseMeta(scenario, scenario.currentPlayer), {
    phase: "attack",
    attackPhase: "attack",
    players,
    turnOrder: turnOrder.slice(),
    currentPlayer: scenario.currentPlayer,
    deck: allCardNames.filter(function (n) {
      return !usedCardNames.has(n);
    }),
    continents: continentsObj
  });
}

function buildCardplayScenario(scenario) {
  const conqueror = scenario.conqueror;
  const finalVictim = scenario.finalVictim;
  const priorEliminated = scenario.priorEliminated;
  const conquerorHand = buildCardplayFinisherHand(scenario.finishCard);
  assertCardplayHand(scenario, conquerorHand);

  const territoryOwner = {};
  const territoryTroops = {};
  territoryOwner[scenario.finalTerritory.name] = scenario.finalTerritory.owner;
  territoryTroops[scenario.finalTerritory.name] = scenario.finalTerritory.troops;

  allTerritories.forEach(function (t) {
    if (territoryOwner[t]) return;
    territoryOwner[t] = conqueror;
    territoryTroops[t] = 3;
  });

  const usedCardNames = new Set(conquerorHand);
  (scenario.victimHand || []).forEach(function (n) {
    usedCardNames.add(n);
  });

  const activeOrder = [conqueror, finalVictim];
  const players = turnOrder.map(function (name, i) {
    var territories = allTerritories
      .filter(function (t) {
        return territoryOwner[t] === name;
      })
      .map(function (t) {
        return { name: t, troops: territoryTroops[t] };
      });
    var cards = [];
    if (name === conqueror) {
      cards = conquerorHand.map(function (n) {
        return { name: n, id: uuid() };
      });
    } else if (name === finalVictim) {
      cards = (scenario.victimHand || []).map(function (n) {
        return { name: n, id: uuid() };
      });
    }
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

  return Object.assign(baseMeta(scenario, conqueror), {
    phase: "cardplay",
    attackPhase: null,
    players,
    turnOrder: activeOrder.slice(),
    currentPlayer: conqueror,
    deck: allCardNames.filter(function (n) {
      return !usedCardNames.has(n);
    }),
    continents: continentsObj,
    risqueConquestElimCardplayFinal: true,
    risqueConquestPriorEliminated: priorEliminated
  });
}

const root = path.join(__dirname, "..");

ATTACK_SCENARIOS.forEach(function (scenario) {
  assertConquerHandCounts(scenario);
  assertMictorAlaskaForGuidoFinish(scenario);
  const gs = buildAttackScenario(scenario);
  const outPath = path.join(root, scenario.file);
  fs.writeFileSync(outPath, JSON.stringify(gs, null, 2), "utf8");
  console.log("wrote:", outPath, "| attack |", gs.currentPlayer);
  gs.players.forEach(function (p) {
    console.log("  ", p.name, "territories:", p.territories.length, "cards:", p.cards.length);
  });
});

CARDPLAY_SCENARIOS.forEach(function (scenario) {
  assertMictorAlaskaForGuidoFinish(scenario);
  const gs = buildCardplayScenario(scenario);
  const outPath = path.join(root, scenario.file);
  fs.writeFileSync(outPath, JSON.stringify(gs, null, 2), "utf8");
  console.log("wrote:", outPath, "| cardplay |", gs.currentPlayer, "→", scenario.finalVictim);
  gs.players.forEach(function (p) {
    if (p.territories.length || p.cards.length) {
      console.log("  ", p.name, "territories:", p.territories.length, "cards:", p.cards.length);
    }
  });
});
