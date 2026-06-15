/**
 * ARTEMIS dev presets — skip setup, inject mid-game state for 3-laptop phase testing.
 * Enable with ?artemisPreset=guidoR2Cardplay on the HOST URL (see START-ARTEMIS-PRESET.bat).
 */
(function () {
  "use strict";

  if (!window.risqueArtemisMode) return;

  var TERRITORIES = [
    "afghanistan", "alaska", "alberta", "argentina", "brazil", "central_america", "china", "congo",
    "east_africa", "eastern_australia", "eastern_united_states", "egypt", "great_britain", "greenland",
    "iceland", "india", "indonesia", "irkutsk", "japan", "kamchatka", "madagascar", "middle_east",
    "mongolia", "new_guinea", "north_africa", "northern_europe", "northwest_territory", "ontario",
    "peru", "quebec", "scandinavia", "siam", "siberia", "south_africa", "southern_europe", "ukraine",
    "ural", "venezuela", "western_australia", "western_europe", "western_united_states", "yakutsk"
  ];

  var TERRITORY_CARDS = TERRITORIES.slice();

  function normName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFromOpts(opts) {
    opts = opts || {};
    if (opts.seed != null && opts.seed !== "") {
      var s = parseInt(String(opts.seed), 10);
      if (!isNaN(s)) return mulberry32(s);
    }
    return Math.random;
  }

  function shuffle(arr, rand) {
    var a = arr.slice();
    var i;
    for (i = a.length - 1; i > 0; i -= 1) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function randInt(rand, min, max) {
    return min + Math.floor(rand() * (max - min + 1));
  }

  function deckList() {
    return TERRITORY_CARDS.concat(["wildcard1", "wildcard2"]);
  }

  function buildBaseState(artemisRoster) {
    var rows = (artemisRoster || []).map(function (r) {
      return { name: r.name, color: r.color };
    });
    if (
      window.risquePhases &&
      window.risquePhases.login &&
      typeof window.risquePhases.login.buildGameStateFromRows === "function"
    ) {
      return window.risquePhases.login.buildGameStateFromRows(rows);
    }
    return null;
  }

  function dealRandomBoard(gs, rand) {
    var players = gs.players || [];
    var pool = shuffle(TERRITORIES, rand);
    players.forEach(function (p) {
      p.territories = [];
      p.troopsTotal = 0;
    });
    pool.forEach(function (terr, idx) {
      var p = players[idx % players.length];
      if (!p) return;
      var troops = randInt(rand, 1, 20);
      p.territories.push({ name: terr, troops: troops });
      p.troopsTotal = (Number(p.troopsTotal) || 0) + troops;
    });
  }

  function makePresetCardId() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function pushPresetCard(hand, cardName) {
    if (!cardName) return;
    hand.push({
      name: String(cardName).trim().toLowerCase(),
      id: makePresetCardId()
    });
  }

  function assignHands(gs, rand) {
    var deck = shuffle(deckList(), rand);
    var used = {};
    var leadName = normName(gs.currentPlayer);
    if (!leadName && gs.turnOrder && gs.turnOrder[0]) {
      leadName = normName(gs.turnOrder[0]);
    }
    (gs.players || []).forEach(function (p) {
      var hand = [];
      var pn = normName(p.name);
      if (leadName && pn === leadName) {
        pushPresetCard(hand, "alaska");
        used.alaska = true;
      } else if (pn === "MICTOR") {
        if (deck.length && rand() > 0.5) {
          var c2 = deck.shift();
          if (c2) {
            pushPresetCard(hand, c2);
            used[c2] = true;
          }
        }
      }
      p.cards = hand;
      p.cardCount = hand.length;
      p.bankValue = 0;
      p.bookValue = randInt(rand, 5, 45);
    });
    gs.deck = deck.filter(function (c) {
      return !used[c];
    });
  }

  function resolvePresetId(gs) {
    if (gs && gs.risqueArtemisPresetId) return String(gs.risqueArtemisPresetId);
    if (window.risqueArtemisPresetMode) return String(window.risqueArtemisPresetMode);
    try {
      var stored = sessionStorage.getItem("risqueArtemisPresetId");
      if (stored) return String(stored);
    } catch (eStore) {
      /* ignore */
    }
    return "";
  }

  function activePlayerHandCount(gs) {
    if (!gs) return 0;
    var leadName = normName(gs.currentPlayer);
    if (!leadName && gs.turnOrder && gs.turnOrder[0]) {
      leadName = normName(gs.turnOrder[0]);
    }
    var player = (gs.players || []).find(function (p) {
      return normName(p && p.name) === leadName;
    });
    if (!player) return 0;
    if (Array.isArray(player.cards) && player.cards.length) return player.cards.length;
    return Number(player.cardCount) || 0;
  }

  function ensureDeckForHydrate(gs) {
    if (Array.isArray(gs.deck) && gs.deck.length) return gs.deck.slice();
    if (
      window.gameUtils &&
      typeof window.gameUtils.risqueMaybeReshuffleDiscardIntoDeck === "function"
    ) {
      try {
        window.gameUtils.risqueMaybeReshuffleDiscardIntoDeck(gs);
      } catch (eResh) {
        /* ignore */
      }
    }
    if (Array.isArray(gs.deck) && gs.deck.length) return gs.deck.slice();
    return shuffle(deckList(), Math.random);
  }

  /**
   * Normal game: mirror/soft-nav often drops card objects while cardCount remains.
   * Rebuild the active player's hand on the owning client (or host mount) from cardCount + deck.
   */
  window.risqueArtemisEnsureClientCardplayHand = function (gs) {
    if (!gs || String(gs.phase || "") !== "cardplay") return gs;
    if (window.__risqueArtemisLeavingCardplay) return gs;
    if (
      window.risqueArtemisPhaseTransition &&
      String(window.risqueArtemisPhaseTransition.target || "") !== "cardplay"
    ) {
      return gs;
    }
    var leadName = normName(gs.currentPlayer);
    if (!leadName) return gs;
    var player = (gs.players || []).find(function (p) {
      return normName(p && p.name) === leadName;
    });
    if (!player) return gs;

    var haveCards = Array.isArray(player.cards) ? player.cards.length : 0;
    var wantCount = Number(player.cardCount) || 0;
    if (
      !wantCount &&
      typeof window.risquePublicSpectatorHandCountFromGs === "function" &&
      normName(gs.currentPlayer) === leadName
    ) {
      wantCount = Math.max(0, Number(window.risquePublicSpectatorHandCountFromGs(gs)) || 0);
    }
    if (!wantCount && gs.risquePublicCardplaySpectatorHandCount != null) {
      var mirName = normName(gs.risquePublicCardplaySpectatorPlayer);
      if (mirName && mirName === leadName) {
        wantCount = Math.max(0, Number(gs.risquePublicCardplaySpectatorHandCount) || 0);
      }
    }
    if (wantCount < haveCards) {
      player.cards = player.cards.slice(0, wantCount);
      player.cardCount = player.cards.length;
      haveCards = player.cards.length;
    }
    if (haveCards >= wantCount && wantCount > 0) {
      player.cardCount = haveCards;
      return gs;
    }
    if (wantCount <= 0) {
      if (haveCards > 0) {
        player.cards = [];
        player.cardCount = 0;
      }
      return gs;
    }

    if (window.risqueArtemisNetClient && !window.risqueArtemisHost) {
      var mine =
        (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) ||
        (typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
          window.risqueArtemisClientNameMatchesCurrent(gs));
      if (!mine) return gs;
    }

    if (!Array.isArray(player.cards)) player.cards = [];
    var deck = ensureDeckForHydrate(gs);
    while (player.cards.length < wantCount && deck.length) {
      pushPresetCard(player.cards, deck.shift());
    }
    player.cardCount = player.cards.length;
    gs.deck = deck;
    try {
      console.info(
        "[ARTEMIS cardplay] hydrated hand for",
        player.name,
        "count=" + player.cardCount
      );
    } catch (eLog) {
      /* ignore */
    }
    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag(
        "cardplay_hand_hydrate",
        "Hydrated " + player.name + " hand to " + player.cardCount,
        {
          currentPlayer: gs.currentPlayer,
          cardCount: player.cardCount,
          wanted: wantCount,
        }
      );
    }
    return gs;
  };

  /** Re-apply preset hand if mirror/soft-nav dropped cards for the active player. */
  window.risqueArtemisEnsurePresetCardplayHands = function (gs) {
    if (!gs) return gs;
    if (String(gs.phase || "") !== "cardplay") return gs;
    if (window.__risqueArtemisLeavingCardplay) return gs;
    if (
      window.risqueArtemisPhaseTransition &&
      String(window.risqueArtemisPhaseTransition.target || "") !== "cardplay"
    ) {
      return gs;
    }
    var presetId = resolvePresetId(gs);
    if (!presetId) return gs;
    if (!gs.risqueArtemisPresetId) {
      gs.risqueArtemisPresetId = presetId;
    }
    if (presetId !== "guidoR2Cardplay" && presetId !== "guidoR2") return gs;

    var leadName = normName(gs.currentPlayer);
    if (!leadName && gs.turnOrder && gs.turnOrder[0]) {
      leadName = normName(gs.turnOrder[0]);
      gs.currentPlayer = gs.turnOrder[0];
    }
    var player = (gs.players || []).find(function (p) {
      return normName(p && p.name) === leadName;
    });
    if (!player) return gs;

    var have = Array.isArray(player.cards) ? player.cards.length : Number(player.cardCount) || 0;
    if (have >= 1) {
      player.cardCount = have;
      return gs;
    }

    var deck = Array.isArray(gs.deck) && gs.deck.length ? gs.deck.slice() : shuffle(deckList(), Math.random);
    pushPresetCard(player.cards || (player.cards = []), deck.shift() || TERRITORY_CARDS[0]);
    player.cardCount = player.cards.length;
    gs.deck = deck;
    try {
      console.info(
        "[ARTEMIS preset] restored cardplay hand for",
        player.name,
        "count=" + player.cardCount
      );
    } catch (eLog) {
      /* ignore */
    }
    return gs;
  };

  /**
   * Guido · round 2 · cardplay · 1 card · random troops 1–20 on full board.
   */
  function applyGuidoR2CardplayPreset(gs, opts) {
    if (!gs) return gs;
    var rand = rngFromOpts(opts);
    var order = (gs.artemisRoster || []).map(function (r) {
      return r.name;
    });
    if (!order.length) {
      order = (gs.players || []).map(function (p) {
        return p.name;
      });
    }
    if (!order.length) {
      order = ["GUIDO", "MICTOR", "NOOCH"];
    }

    gs.turnOrder = order.slice();
    gs.currentPlayer = order[0] || "GUIDO";
    gs.round = 2;
    gs.setupComplete = true;
    gs.isInitialDeploy = false;
    gs.selectionPhase = "cardPlay";
    gs.risquePublicUiSelectKind = "cardPlay";
    gs.aerialAttack = false;
    gs.aerialAttackEligible = false;
    gs.aerialBridge = null;
    gs.conquered = false;
    gs.cardplayConquered = false;
    gs.cardEarnedViaAttack = false;
    gs.cardEarnedViaCardplay = false;
    gs.cardAwardedThisTurn = false;
    gs.lastCardDrawn = null;
    gs.risquePlayedCardsGallery = gs.risquePlayedCardsGallery || [];
    gs.risqueLuckyLedger = gs.risqueLuckyLedger || { byPlayer: {} };
    gs.risqueLuckySessionRoster = order.slice();
    gs.risqueLuckyEliminatedNames = gs.risqueLuckyEliminatedNames || [];
    gs.risqueArtemisPresetId = "guidoR2Cardplay";
    gs.risqueArtemisPresetLabel = "DEV — Guido R2 cardplay (1 card, random map)";
    try {
      sessionStorage.setItem("risqueArtemisPresetId", "guidoR2Cardplay");
    } catch (ePresetStore) {
      /* ignore */
    }

    dealRandomBoard(gs, rand);
    assignHands(gs, rand);

    gs.phase = "cardplay";
    gs.risqueArtemisControlSeq = Number(gs.risqueArtemisControlSeq) || 1;
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (!gs.artemisControlSlot) {
      gs.artemisControlSlot = 1;
    }

    try {
      console.info(
        "[ARTEMIS preset] guidoR2Cardplay — round",
        gs.round,
        "ctrl=P" + gs.artemisControlSlot,
        "Guido cards:",
        ((gs.players || []).find(function (p) {
          return normName(p.name) === "GUIDO";
        }) || {}).cardCount
      );
    } catch (eLog) {
      /* ignore */
    }
    return gs;
  }

  var PRESETS = {
    guidoR2Cardplay: applyGuidoR2CardplayPreset,
    guidoR2: applyGuidoR2CardplayPreset
  };

  window.risqueArtemisApplyMidgamePreset = function (gs, presetId, opts) {
    if (!gs || !presetId) return gs;
    var fn = PRESETS[String(presetId)];
    if (!fn) {
      try {
        console.warn("[ARTEMIS preset] unknown preset:", presetId);
      } catch (eWarn) {
        /* ignore */
      }
      return gs;
    }
    return fn(gs, opts || {});
  };

  window.risqueArtemisPresetStartToCardplay = function (gs) {
    if (!window.risqueArtemisHost || !gs) return false;
    var presetId = window.risqueArtemisPresetMode;
    if (!presetId) return false;

    var seed = null;
    try {
      seed = new URL(window.location.href).searchParams.get("artemisPresetSeed");
    } catch (eSeed) {
      /* ignore */
    }

    if (!gs.artemisRoster || !gs.artemisRoster.length) {
      try {
        var stored = sessionStorage.getItem("risqueArtemisRoster");
        if (stored) gs.artemisRoster = JSON.parse(stored);
      } catch (eRos) {
        /* ignore */
      }
    }

    window.risqueArtemisApplyMidgamePreset(gs, presetId, { seed: seed });
    if (typeof window.risqueArtemisEnsurePresetCardplayHands === "function") {
      window.risqueArtemisEnsurePresetCardplayHands(gs);
    }

    if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    } else {
      window.gameState = gs;
    }

    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      return false;
    }

    if (typeof window.risqueArtemisEnsurePresetCardplayHands === "function") {
      window.risqueArtemisEnsurePresetCardplayHands(gs);
      try {
        localStorage.setItem("gameState", JSON.stringify(gs));
      } catch (eLs2) {
        /* ignore */
      }
    }

    if (typeof window.risqueSetMirrorDeployRoute === "function") {
      window.risqueSetMirrorDeployRoute(null);
    }

    if (typeof window.risqueArtemisSetTopStatus === "function") {
      window.risqueArtemisSetTopStatus(
        "ARTEMIS PRESET — " + String(gs.currentPlayer) + " R" + gs.round + " cardplay",
        "ok"
      );
    }

    var url = "game.html?phase=cardplay&legacyNext=income.html&postReceive=1";
    if (typeof window.risqueArtemisAppendSessionParams === "function") {
      url = window.risqueArtemisAppendSessionParams(url);
    }
    try {
      var q = new URL(window.location.href).searchParams;
      if (q.get("artemisPreset")) {
        url += (url.indexOf("?") >= 0 ? "&" : "?") + "artemisPreset=" + encodeURIComponent(q.get("artemisPreset"));
      }
      if (q.get("artemisPresetSeed")) {
        url += "&artemisPresetSeed=" + encodeURIComponent(q.get("artemisPresetSeed"));
      }
    } catch (eQ) {
      /* ignore */
    }

    if (typeof window.risqueNavigateGameHtmlSoft === "function" && window.risqueNavigateGameHtmlSoft(url)) {
      if (typeof window.risquePersistHostGameState === "function") {
        window.risquePersistHostGameState(window.gameState || gs);
      } else if (typeof window.risqueMirrorPushGameState === "function") {
        window.risqueMirrorPushGameState();
      }
      return true;
    }
    if (typeof window.risqueNavigateWithFade === "function") {
      window.risqueNavigateWithFade(url);
    } else {
      window.location.href = url;
    }
    if (typeof window.risquePersistHostGameState === "function") {
      window.risquePersistHostGameState(window.gameState || gs);
    } else if (typeof window.risqueMirrorPushGameState === "function") {
      window.risqueMirrorPushGameState();
    }
    return true;
  };

  window.risqueArtemisPresetList = function () {
    return Object.keys(PRESETS);
  };
})();
