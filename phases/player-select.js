/**
 * Legacy player1.html selection (name cycle + random pick) as JS.
 * selectKind: firstCard | deployOrder | cardPlay
 */
(function () {
  "use strict";

  var STYLE_ID = "risque-player-select-styles";

  /**
   * DEV — after the roulette picks randomly, swap the winner to this laptop slot.
   * 1 = Guido, 2 = Mictor, 3 = Nooch. URL ?rigSetup=3 or ?rigSetup=random (fair, no swap).
   */
  var RISQUE_POST_ROULETTE_SWAP_SLOT = 0;
  var RISQUE_DEV_RIG_SLOT_NAMES = { 1: "GUIDO", 2: "MICTOR", 3: "NOOCH" };

  function normSelectName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function isSetupSelectKind(selectKind) {
    selectKind = String(selectKind || "");
    return selectKind === "firstCard" || selectKind === "deployOrder" || selectKind === "cardPlay";
  }

  function setupRigUsesRandom(selectKind) {
    if (typeof window.risqueArtemisRigSetupUsesRandom === "function") {
      return window.risqueArtemisRigSetupUsesRandom(window.gameState);
    }
    if (window.risqueArtemisRigSetupRandom) return true;
    try {
      if (sessionStorage.getItem("risqueArtemisRigSetupRandom") === "1") return true;
    } catch (eSsRand) {
      /* ignore */
    }
    try {
      var q = new URL(window.location.href).searchParams;
      if (q.get("rigSetup") === "random") return true;
      if (String(selectKind || "") === "deployOrder" && q.get("rigDeploy") === "random") return true;
      if (String(selectKind || "") === "cardPlay" && q.get("rigCardPlay") === "random") return true;
      if (q.get("rigPick") === "random") return true;
    } catch (eRand) {
      /* ignore */
    }
    return false;
  }

  /** Which slot to swap the random winner to (after spin). */
  function resolvePostRouletteSwapSlot(selectKind) {
    if (!isSetupSelectKind(selectKind)) return 0;
    if (setupRigUsesRandom(selectKind)) return 0;
    if (typeof window.risqueArtemisResolveRigSwapSlot === "function") {
      return window.risqueArtemisResolveRigSwapSlot(window.gameState);
    }
    if (typeof window.risqueArtemisRigSetupSlot === "number") {
      var rigWin = Number(window.risqueArtemisRigSetupSlot);
      if (rigWin >= 1 && rigWin <= (window.risqueArtemisMaxSlots || 6)) return rigWin;
    }
    try {
      var ssRig = sessionStorage.getItem("risqueArtemisRigSetupSlot");
      if (ssRig === "1" || ssRig === "2" || ssRig === "3") return parseInt(ssRig, 10);
    } catch (eSsRig) {
      /* ignore */
    }
    try {
      var q = new URL(window.location.href).searchParams;
      var setupQ = q.get("rigSetup");
      if (setupQ === "1" || setupQ === "2" || setupQ === "3") {
        return parseInt(setupQ, 10);
      }
    } catch (eSetupQ) {
      /* ignore */
    }
    return RISQUE_POST_ROULETTE_SWAP_SLOT >= 1 ? RISQUE_POST_ROULETTE_SWAP_SLOT : 0;
  }

  function playerForRigSlot(players, gameState, rigSlot) {
    if (!rigSlot || rigSlot < 1 || !Array.isArray(players) || !players.length) return null;
    if (gameState && Array.isArray(gameState.artemisRoster)) {
      var rosterHit = gameState.artemisRoster.find(function (r) {
        return Number(r.slot) === rigSlot;
      });
      if (rosterHit && rosterHit.name) {
        var want = normSelectName(rosterHit.name);
        var byRoster = players.find(function (p) {
          return normSelectName(p.name) === want;
        });
        if (byRoster) return byRoster;
      }
    }
    var byOrder = players.find(function (p) {
      return Number(p.playerOrder) === rigSlot;
    });
    if (byOrder) return byOrder;
    var fallbackName = RISQUE_DEV_RIG_SLOT_NAMES[rigSlot];
    if (fallbackName) {
      var byFallback = players.find(function (p) {
        return normSelectName(p.name) === fallbackName;
      });
      if (byFallback) return byFallback;
    }
    if (players[rigSlot - 1]) return players[rigSlot - 1];
    return null;
  }

  function pickRandomRouletteWinner(players) {
    if (!players || !players.length) return null;
    return players[Math.floor(Math.random() * players.length)];
  }

  function shufflePlayersForTurnOrder(players) {
    var out = (players || []).slice();
    for (var i = out.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /**
   * After any roulette winner: full turn order is random (winner first, remaining seats shuffled).
   * Applies to firstCard, deployOrder, and cardPlay — not just the named first player.
   */
  function buildTurnOrderAfterRouletteWinner(win, players, selectKind) {
    var rest = (players || []).filter(function (p) {
      return p && p.name && win && p.name !== win.name;
    });
    if (rest.length > 1) {
      rest = shufflePlayersForTurnOrder(rest);
    }
    return [win.name].concat(
      rest.map(function (p) {
        return p.name;
      })
    );
  }

  function colorHexForSelect(color) {
    if (window.gameUtils && window.gameUtils.colorMap && color && window.gameUtils.colorMap[color]) {
      return window.gameUtils.colorMap[color];
    }
    return "#ffffff";
  }

  function playerByNameForSelect(players, name) {
    var want = normSelectName(name);
    return (players || []).find(function (p) {
      return p && normSelectName(p.name) === want;
    }) || null;
  }

  function rouletteOrderTitle(selectKind) {
    if (selectKind === "firstCard") return "FIRST CARD";
    if (selectKind === "deployOrder") return "FIRST TO DEPLOY";
    if (selectKind === "cardPlay") return "PLAYER ONE";
    return "PLAYER ORDER";
  }

  function appendRouletteOrderRow(parentEl, turnOrder, playersOrColors, opts) {
    opts = opts || {};
    if (!parentEl || !Array.isArray(turnOrder) || turnOrder.length < 2) return;
    var row = document.createElement("div");
    row.className = "player-select-turn-order player-select-turn-order--row";
    var thenLab = document.createElement("div");
    thenLab.className = "player-select-turn-order-title";
    thenLab.textContent = opts.thenLabel || "THEN";
    row.appendChild(thenLab);
    var track = document.createElement("div");
    track.className = "player-select-turn-order-track";
    turnOrder.forEach(function (nm, idx) {
      if (idx === 0) return;
      var chip = document.createElement("span");
      chip.className = "player-select-turn-order-chip";
      var ord = document.createElement("span");
      ord.className = "player-select-turn-order-chip-ord";
      ord.textContent = String(idx + 1);
      var nameEl = document.createElement("span");
      nameEl.className = "player-select-turn-order-chip-name";
      nameEl.textContent = String(nm || "").toUpperCase();
      var colorName = "";
      if (Array.isArray(playersOrColors)) {
        if (playersOrColors[0] && typeof playersOrColors[0] === "object") {
          var pl = playerByNameForSelect(playersOrColors, nm);
          colorName = pl && pl.color ? String(pl.color) : "";
          chip.style.color = colorHexForSelect(colorName);
        } else {
          colorName = playersOrColors[idx] != null ? String(playersOrColors[idx]) : "";
          chip.style.color =
            window.gameUtils && window.gameUtils.colorMap && window.gameUtils.colorMap[colorName]
              ? window.gameUtils.colorMap[colorName]
              : colorHexForSelect(colorName);
        }
      }
      chip.appendChild(ord);
      chip.appendChild(nameEl);
      track.appendChild(chip);
    });
    row.appendChild(track);
    parentEl.appendChild(row);
  }

  /** Temporarily grow control voice so winner + THEN chips are not clipped. */
  function setRouletteRevealVoiceExpanded(on) {
    var cv = document.getElementById("control-voice");
    if (cv && cv.classList) {
      if (on) cv.classList.add("ucp-control-voice--roulette-reveal");
      else cv.classList.remove("ucp-control-voice--roulette-reveal");
    }
    try {
      if (document.body && document.body.classList) {
        document.body.classList.toggle("risque-roulette-reveal-cv", !!on);
      }
    } catch (eBody) {
      /* ignore */
    }
  }
  window.risqueSetRouletteRevealVoiceExpanded = setRouletteRevealVoiceExpanded;

  /** Paint winner + remaining order side-by-side (host + local). */
  function paintRouletteResultVoice(opts) {
    opts = opts || {};
    var win = opts.win;
    var turnOrder = Array.isArray(opts.turnOrder) ? opts.turnOrder : [];
    var players = opts.players || [];
    var selectKind = String(opts.selectKind || "");
    var instruction = String(opts.instruction || rouletteOrderTitle(selectKind)).trim();
    var vt = document.getElementById("control-voice-text");
    if (!vt || !win) return;
    setRouletteRevealVoiceExpanded(true);
    vt.innerHTML = "";
    var ins = document.createElement("div");
    ins.className = "player-select-voice-instruction";
    ins.textContent = instruction;
    vt.appendChild(ins);
    var cyc = document.createElement("div");
    cyc.className =
      "player-select-cycle-name player-select-cycle-name--hud-primary player-select-cycle-name--winner";
    cyc.textContent = String(win.name || "").toUpperCase();
    cyc.style.color = colorHexForSelect(win.color);
    cyc.style.animation = "none";
    vt.appendChild(cyc);
    appendRouletteOrderRow(vt, turnOrder, players, { thenLabel: "THEN" });
    var vr = document.getElementById("control-voice-report");
    if (vr) {
      vr.textContent = "";
      vr.style.display = "none";
      vr.className = "ucp-voice-report";
    }
  }

  /**
   * Inject after random pick: replace whoever won with the configured slot (default Nooch).
   * Roulette animation may have landed on Guido — game state from here on uses the swap target.
   */
  function applyPostRouletteWinnerSwap(players, gameState, randomWin, selectKind) {
    if (!randomWin || !players || !players.length) return randomWin;
    selectKind = String(selectKind || "");
    if (!isSetupSelectKind(selectKind) || setupRigUsesRandom(selectKind)) return randomWin;
    var swapSlot = resolvePostRouletteSwapSlot(selectKind);
    if (!(swapSlot >= 1)) swapSlot = RISQUE_POST_ROULETTE_SWAP_SLOT;
    var swapped = playerForRigSlot(players, gameState, swapSlot);
    if (!swapped) return randomWin;
    if (normSelectName(swapped.name) === normSelectName(randomWin.name)) return randomWin;
    try {
      window.__risqueArtemisLastPostRouletteSwap = {
        selectKind: selectKind,
        randomName: randomWin.name,
        swapSlot: swapSlot,
        finalName: swapped.name
      };
      console.info(
        "[ARTEMIS] post-roulette swap " +
          randomWin.name +
          " → " +
          swapped.name +
          " (" +
          selectKind +
          ")"
      );
    } catch (eSwapLog) {
      /* ignore */
    }
    return swapped;
  }

  window.risqueArtemisApplyPostRouletteWinnerSwap = applyPostRouletteWinnerSwap;
  window.RISQUE_POST_ROULETTE_SWAP_SLOT = RISQUE_POST_ROULETTE_SWAP_SLOT;
  window.risqueArtemisPlayerForSwapSlot = playerForRigSlot;

  function loginRecoveryHref() {
    return window.risqueLoginRecoveryUrl();
  }

  function logLines(msg, logFn) {
    var ts = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    var line = "[" + ts + "] [PlayerSelect] " + msg;
    console.log(line);
    if (typeof logFn === "function") logFn(line);
    try {
      var logs = JSON.parse(localStorage.getItem("gameLogs") || "[]");
      if (!Array.isArray(logs)) logs = [];
      logs.push(line);
      localStorage.setItem("gameLogs", JSON.stringify(logs));
    } catch (e) {
      /* ignore */
    }
  }

  function validatePlayers(gameState) {
    return !!(
      gameState &&
      gameState.players &&
      gameState.players.length >= 2 &&
      gameState.turnOrder &&
      gameState.turnOrder.length === gameState.players.length &&
      gameState.players.every(function (p) {
        return p.name && p.color;
      })
    );
  }

  /** URL / saved state may drift in casing; keys must match voiceMap + navigation. */
  function canonicalSelectKind(raw) {
    var s = String(raw || "").trim();
    if (!s) return null;
    var lower = s.toLowerCase().replace(/_/g, "");
    if (lower === "firstcard") return "firstCard";
    if (lower === "deployorder") return "deployOrder";
    if (lower === "cardplay") return "cardPlay";
    return null;
  }

  /** Legacy fallback if #risque-phase-content is missing (full-board overlay). */
  function injectLegacyCanvasStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      "#risque-player-select-root{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;pointer-events:none;}" +
      "#risque-player-select-root .ps-inner{width:1920px;height:1080px;position:relative;pointer-events:none;}" +
      "#risque-player-select-root .title-text,#risque-player-select-root .name-cycle,#risque-player-select-root .result-text{" +
      "position:absolute;top:540px;left:1500px;transform:translateX(-50%);font-size:48px;font-weight:bold;text-align:center;" +
      "max-width:840px;white-space:nowrap;-webkit-text-stroke:2px #000000;pointer-events:none;}" +
      "#risque-player-select-root .title-text{top:400px;}" +
      "#risque-player-select-root .result-text{display:none;}";
    document.head.appendChild(s);
  }

  /** Prefer same-document game.html navigation (no full reload); fallback fade or location. */
  function navigateGameHtmlPreferSoft(url) {
    try {
      if (typeof window.risqueNavigateGameHtmlSoft === "function" && window.risqueNavigateGameHtmlSoft(url)) {
        return;
      }
    } catch (eNav) {
      /* ignore */
    }
    if (window.risqueNavigateWithFade) {
      window.risqueNavigateWithFade(url);
    } else {
      window.location.href = url;
    }
  }

  function colorHex(colorName) {
    if (typeof window.risqueColorHex === "function") {
      return window.risqueColorHex(colorName);
    }
    var colors = {
      blue: "#87bfff",
      red: "#ff0000",
      green: "#8fd8a8",
      yellow: "#ffff00",
      white: "#f8fafc",
      pink: "#ff69b4"
    };
    return colors[colorName] || "#ffffff";
  }

  /**
   * @param {HTMLElement} stageHost - .runtime-stage-host
   * @param {{ selectKind: string, log?: function }} opts
   */
  function mount(stageHost, opts) {
    opts = opts || {};
    if (window.risqueArtemisMode && window.risqueArtemisNetClient && !window.risqueArtemisHost) {
      logLines("ARTEMIS client — roulette voice via host mirror (no local remount)", opts.log);
      if (typeof window.risquePublicApplyVoiceAndLogMirror === "function" && window.gameState) {
        window.risquePublicApplyVoiceAndLogMirror(window.gameState);
      }
      return;
    }
    var selectKindRaw = opts.selectKind != null ? opts.selectKind : "firstCard";
    var selectKind = canonicalSelectKind(selectKindRaw);
    var logFn = opts.log;

    var gameState = null;
    try {
      var raw = localStorage.getItem("gameState");
      if (!raw) throw new Error("no state");
      gameState = JSON.parse(raw);
    } catch (e) {
      logLines("No game state: " + e.message, logFn);
      window.location.href = loginRecoveryHref();
      return;
    }

    if (!validatePlayers(gameState)) {
      logLines("Invalid player data", logFn);
      window.location.href = loginRecoveryHref();
      return;
    }

    if (typeof window.risqueArtemisSyncRigFromGameState === "function") {
      window.risqueArtemisSyncRigFromGameState(gameState);
    }

    if (!selectKind) {
      logLines("Invalid selectKind: " + selectKindRaw, logFn);
      window.location.href = loginRecoveryHref();
      return;
    }

    var mountGuardKey = "ps:" + selectKind;
    if (window.__risquePlayerSelectMountGuard === mountGuardKey) {
      logLines("mount skipped — duplicate " + selectKind + " roulette already running", logFn);
      return;
    }
    window.__risquePlayerSelectMountGuard = mountGuardKey;
    if (typeof window.__risquePlayerSelectClearTimers === "function") {
      try {
        window.__risquePlayerSelectClearTimers();
      } catch (eClrT) {
        /* ignore */
      }
    }
    var selectTimers = [];
    window.__risquePlayerSelectClearTimers = function () {
      selectTimers.forEach(function (tid) {
        try {
          clearTimeout(tid);
        } catch (eCt) {
          /* ignore */
        }
      });
      selectTimers = [];
    };
    function scheduleSelect(fn, ms) {
      var tid = setTimeout(fn, ms);
      selectTimers.push(tid);
      return tid;
    }

    var phaseSaved = String(gameState.selectionPhase || "").trim();
    if (phaseSaved !== selectKind) {
      var canonSaved = canonicalSelectKind(phaseSaved);
      if (canonSaved === selectKind) {
        gameState.selectionPhase = selectKind;
        try {
          localStorage.setItem("gameState", JSON.stringify(gameState));
        } catch (eCanon) {
          /* ignore */
        }
      } else if (
        selectKind === "firstCard" &&
        (!phaseSaved ||
          canonSaved === "deployOrder" ||
          canonSaved === "cardPlay")
      ) {
        /*
         * After LOG IN, roster is fresh but selectionPhase can still say deployOrder/cardPlay if an older
         * session wrote localStorage and the new login save failed or raced. firstCard URL means setup entry —
         * align state instead of bouncing back to an empty login screen.
         */
        gameState.selectionPhase = "firstCard";
        try {
          localStorage.setItem("gameState", JSON.stringify(gameState));
        } catch (eFix) {
          /* ignore */
        }
      } else {
        logLines(
          "State selectionPhase " + gameState.selectionPhase + " !== URL " + selectKind,
          logFn
        );
        window.location.href = loginRecoveryHref();
        return;
      }
    }

    /*
     * Canonical phase for this screen. Persisted state can still say "deal" (legacy), "cardplay"
     * (deploy confirm used to set that before this URL), etc. The public TV only renders
     * risquePublicPlayerSelectFlash when phase === "playerSelect" (game-shell.js).
     */
    gameState.phase = "playerSelect";

    window.gameState = gameState;
    /* URL selectKind (e.g. firstCard) for public mirror — not always present on saved state */
    gameState.risquePublicUiSelectKind = selectKind;

    var canvas = document.getElementById("canvas");
    if (!canvas) {
      logLines("Missing #canvas", logFn);
      return;
    }

    var oldBanner = document.getElementById("risque-deal-banner");
    if (oldBanner) oldBanner.remove();

    var existing = document.getElementById("risque-player-select-root");
    if (existing) existing.remove();

    var phaseSlot = document.getElementById("risque-phase-content");
    var mountParent = phaseSlot;
    if (!phaseSlot) {
      logLines("Missing #risque-phase-content — canvas fallback", logFn);
      injectLegacyCanvasStyles();
      mountParent = canvas;
    }

    var root = document.createElement("div");
    root.id = "risque-player-select-root";
    root.className = phaseSlot ? "risque-player-select-root--hud" : "risque-player-select-root--legacy-canvas";
    root.setAttribute("aria-live", "polite");
    root.innerHTML =
      '<div class="ps-inner">' +
      '<div class="title-text" id="ps-title"></div>' +
      '<div class="name-cycle" id="ps-name-cycle"></div>' +
      '<div class="result-text" id="ps-result"></div>' +
      "</div>";
    mountParent.appendChild(root);

    var titleText = root.querySelector("#ps-title");
    var nameCycle = root.querySelector("#ps-name-cycle");
    var resultText = root.querySelector("#ps-result");

    /* HUD: instruction in control voice primary, flashing name in report; legacy canvas keeps cycle in slot */
    var voiceMap = {
      firstCard: "SELECTING WHO GETS THE FIRST CARD",
      deployOrder: "SELECTING WHO DEPLOYS FIRST",
      cardPlay: "SELECTING PLAYER ONE"
    };
    var voicePrimary = voiceMap[selectKind] || "PLAYER SELECTION";
    if (titleText) {
      titleText.textContent = "";
      titleText.setAttribute("aria-hidden", "true");
    }
    var useVoiceCycle =
      !!(
        phaseSlot &&
        window.risqueRuntimeHud &&
        typeof window.risqueRuntimeHud.setControlVoiceText === "function"
      );

    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
      window.risqueRuntimeHud.setControlVoiceText(voicePrimary, "");
    } else if (typeof window.risqueMirrorPushGameState === "function") {
      window.risqueMirrorPushGameState();
    }

    function showCyclingName(player) {
      if (useVoiceCycle) {
        var vt = document.getElementById("control-voice-text");
        if (vt) {
          vt.innerHTML = "";
          var ins = document.createElement("div");
          ins.className = "player-select-voice-instruction";
          ins.textContent = String(voicePrimary || "").replace(/\n/g, " ").trim();
          var cyc = document.createElement("div");
          cyc.className = "player-select-cycle-name player-select-cycle-name--hud-primary";
          cyc.textContent = String(player.name || "").toUpperCase();
          cyc.style.color = colorHex(player.color);
          vt.appendChild(ins);
          vt.appendChild(cyc);
        }
        var vr = document.getElementById("control-voice-report");
        if (vr) {
          vr.textContent = "";
          vr.style.display = "none";
          vr.className = "ucp-voice-report";
        }
        if (nameCycle) {
          nameCycle.textContent = "";
          nameCycle.className = "name-cycle";
        }
        try {
          gameState.risqueControlVoice = {
            primary: String(voicePrimary || ""),
            report: "",
            reportClass: ""
          };
        } catch (eCv) {
          /* ignore */
        }
        gameState.risquePublicUiSelectKind = selectKind;
        gameState.risquePublicPlayerSelectFlash = {
          name: String(player.name || ""),
          color: String(player.color || ""),
          selectKind: String(selectKind || "")
        };
        if (window.risqueArtemisMode && typeof window.risqueFlushMirrorPush === "function") {
          window.risqueFlushMirrorPush();
        } else if (typeof window.risqueMirrorPushGameState === "function") {
          window.risqueMirrorPushGameState();
        }
      } else {
        nameCycle.textContent = player.name;
        nameCycle.style.color = colorHex(player.color);
        nameCycle.className = "name-cycle " + player.color;
      }
    }

    var loadCore = selectKind === "deployOrder" || selectKind === "cardPlay";
    if (loadCore && window.gameUtils) {
      window.gameUtils.initGameView();
      window.gameUtils.renderAll(gameState, null, {});
      try {
        window.gameUtils.renderStats(gameState);
      } catch (eStats) {
        /* ignore */
      }
      logLines("Map rendered for " + selectKind, logFn);
    } else if (window.gameUtils) {
      window.gameUtils.initGameView();
      var stageImage = document.querySelector(".stage-image");
      if (stageImage) stageImage.classList.add("visible");
      logLines("Stage only (first card)", logFn);
    }

    function syncHudAfterLayout() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (window.gameUtils && window.gameUtils.resizeCanvas) {
            window.gameUtils.resizeCanvas();
          }
          if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
            window.risqueRuntimeHud.syncPosition();
          }
        });
      });
    }
    syncHudAfterLayout();
    setTimeout(function () {
      if (window.gameUtils && window.gameUtils.resizeCanvas) {
        window.gameUtils.resizeCanvas();
      }
      if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
        window.risqueRuntimeHud.syncPosition();
      }
    }, 120);

    var players = gameState.players;
    var swapSlotUsed = resolvePostRouletteSwapSlot(selectKind);
    if (!(swapSlotUsed >= 1)) swapSlotUsed = RISQUE_POST_ROULETTE_SWAP_SLOT;
    var cycleDuration = 2000;
    var cyclesPerSecond = 10;
    var totalCycles = (cycleDuration * cyclesPerSecond) / 1000;

    function cycleNames() {
      var currentIndex = 0;
      var cycleCount = 0;
      function cycle() {
        showCyclingName(players[currentIndex]);
        currentIndex = (currentIndex + 1) % players.length;
        cycleCount += 1;
        if (cycleCount < totalCycles) {
          scheduleSelect(cycle, 1000 / cyclesPerSecond);
        } else {
          var randomWin = pickRandomRouletteWinner(players);
          showCyclingName(randomWin);
          scheduleSelect(function () {
            var win = applyPostRouletteWinnerSwap(players, gameState, randomWin, selectKind);
            if (normSelectName(win.name) !== normSelectName(randomWin.name)) {
              showCyclingName(win);
              scheduleSelect(function () {
                finishRoulettePick(win);
              }, 350);
            } else {
              finishRoulettePick(win);
            }
          }, 400);
        }
      }

      function finishRoulettePick(win) {
          if (
            !setupRigUsesRandom(selectKind) &&
            isSetupSelectKind(selectKind) &&
            typeof window.risqueArtemisForcePostRouletteWinner === "function"
          ) {
            var hard = window.risqueArtemisForcePostRouletteWinner(gameState, selectKind, players);
            if (hard) win = hard;
          }
          if (window.risqueArtemisMode && selectKind === "deployOrder" && resolvePostRouletteSwapSlot(selectKind) >= 1) {
            try {
              console.info(
                "[ARTEMIS] deploy-order winner:",
                win.name,
                "(slot " + swapSlotUsed + ")"
              );
            } catch (eRigLog) {
              /* ignore */
            }
          }
          gameState.currentPlayer = win.name;
          gameState.turnOrder = buildTurnOrderAfterRouletteWinner(win, players, selectKind);
          var orderColors = gameState.turnOrder.map(function (nm) {
            var plOrd = playerByNameForSelect(players, nm);
            return plOrd && plOrd.color ? String(plOrd.color) : "";
          });
          var resultInstruction = rouletteOrderTitle(selectKind);
          var waitDeployLine =
            "WAITING FOR " + String(win.name || "NEXT").toUpperCase() + " TO DEPLOY";
          var cardPlayEntry =
            window.risqueArtemisMode
              ? "game.html?phase=cardplay&legacyNext=income.html&postReceive=1"
              : "game.html?phase=cardplay&legacyNext=income.html";
          var nextByKind = {
            firstCard: "game.html?phase=deal",
            deployOrder: "game.html?phase=deploy&kind=setup",
            cardPlay: cardPlayEntry
          };
          /*
           * Stay on playerSelect for the reveal hold. Jumping to deal/deploy immediately
           * clears the flash and mounts deploy "WAITING FOR…" over the order UI.
           */
          gameState.phase = "playerSelect";
          gameState.selectionPhase =
            selectKind === "firstCard"
              ? "deployOrder"
              : selectKind === "deployOrder"
                ? "cardPlay"
                : "cardPlay";

          if (selectKind === "cardPlay") {
            gameState.setupComplete = true;
          }

          if (window.risqueArtemisMode && (selectKind === "deployOrder" || selectKind === "cardPlay")) {
            if (selectKind === "deployOrder") {
              gameState.risqueArtemisControlSeq = Math.max(Number(gameState.risqueArtemisControlSeq) || 0, 1);
              gameState.risqueArtemisSetupDeployWinner = String(win.name || "").toUpperCase();
              if (!setupRigUsesRandom(selectKind) && swapSlotUsed >= 1) {
                gameState.risqueArtemisSetupDeploySlot = swapSlotUsed;
                gameState.artemisControlSlot = swapSlotUsed;
              } else if (typeof window.risqueArtemisForceControlSlotFromCurrentPlayer === "function") {
                /* Fair random: control must follow the named winner's roster seat (not stale host slot 1). */
                var winSlot = window.risqueArtemisForceControlSlotFromCurrentPlayer(gameState);
                gameState.risqueArtemisSetupDeploySlot = winSlot >= 1 ? winSlot : 0;
              } else if (typeof window.risqueArtemisStampControlSlot === "function") {
                window.risqueArtemisStampControlSlot(gameState);
                gameState.risqueArtemisSetupDeploySlot = Number(gameState.artemisControlSlot) || 0;
              }
            }
            if (selectKind === "cardPlay" && typeof window.risqueArtemisStampControlSlot === "function") {
              window.risqueArtemisStampControlSlot(gameState);
            }
          }

          if (window.risqueArtemisMode && selectKind === "cardPlay") {
            gameState.risquePublicUiSelectKind = "cardPlay";
          } else if (selectKind === "firstCard" || selectKind === "deployOrder") {
            gameState.risquePublicUiSelectKind = selectKind;
          } else {
            delete gameState.risquePublicUiSelectKind;
          }
          try {
            localStorage.setItem("gameState", JSON.stringify(gameState));
          } catch (e2) {
            logLines("save failed: " + e2.message, logFn);
          }
          window.gameState = gameState;
          if (typeof window.risqueHostReplaceShellGameState === "function") {
            window.risqueHostReplaceShellGameState(gameState);
          }
          gameState.risquePublicPlayerSelectFlash = {
            name: String(win.name || ""),
            color: String(win.color || ""),
            selectKind: String(selectKind || ""),
            turnOrder: gameState.turnOrder.slice(),
            turnOrderColors: orderColors,
            instruction: resultInstruction,
            final: true
          };
          try {
            gameState.risqueControlVoice = {
              primary: resultInstruction,
              report: "",
              reportClass: selectKind === "deployOrder"
                ? "ucp-voice-report ucp-voice-report--public-deploy"
                : ""
            };
          } catch (eCvFinal) {
            /* ignore */
          }
          if (useVoiceCycle) {
            if (nameCycle) {
              nameCycle.style.display = "none";
              nameCycle.textContent = "";
            }
            if (resultText) {
              resultText.style.display = "none";
              resultText.textContent = "";
            }
            paintRouletteResultVoice({
              win: win,
              turnOrder: gameState.turnOrder,
              players: players,
              selectKind: selectKind,
              instruction: resultInstruction
            });
          } else {
            nameCycle.style.display = "none";
            resultText.textContent = win.name + " Selected";
            resultText.style.color = colorHex(win.color);
            resultText.style.display = "block";
          }
          if (typeof window.risquePersistHostGameState === "function") {
            window.risquePersistHostGameState(gameState);
          }
          if (window.risqueArtemisMode && selectKind === "deployOrder") {
            /* Defer deploy chrome / wait banner until after reveal — only mirror the flash. */
            if (typeof window.risqueFlushMirrorPush === "function") {
              try {
                window.risqueFlushMirrorPush();
              } catch (eDepMir) {
                /* ignore */
              }
            }
            if (typeof window.risqueArtemisSetupMilestone === "function") {
              window.risqueArtemisSetupMilestone(
                "M4-deployOrder-winner",
                gameState.currentPlayer + " deploys first"
              );
            }
          }

          logLines(
            "Selected: " + gameState.currentPlayer + " (" + selectKind + ")" +
              (resolvePostRouletteSwapSlot(selectKind) >= 1
                ? " [swap slot " + swapSlotUsed + "]"
                : ""),
            logFn
          );
          if (window.risqueArtemisMode && selectKind === "firstCard") {
            if (typeof window.risqueArtemisStampControlSlot === "function") {
              window.risqueArtemisStampControlSlot(gameState);
            }
            if (typeof window.risqueArtemisSetupMilestone === "function") {
              window.risqueArtemisSetupMilestone(
                "M2-firstCard-winner",
                gameState.currentPlayer + " deals first"
              );
            }
          }
          if (window.risqueArtemisMode && selectKind === "cardPlay") {
            if (typeof window.risqueArtemisSetupMilestone === "function") {
              window.risqueArtemisSetupMilestone(
                "M5-cardPlay-winner",
                gameState.currentPlayer + " plays first"
              );
            }
            if (typeof window.risqueFlushMirrorPush === "function") {
              window.risqueFlushMirrorPush();
            }
          }

          var navigateDelayMs = window.risqueArtemisMode ? 3200 : 1800;
          scheduleSelect(function () {
            try {
              delete window.__risquePlayerSelectMountGuard;
            } catch (eGuardClr) {
              /* ignore */
            }
            try {
              delete gameState.risquePublicPlayerSelectFlash;
            } catch (eFlashDel) {
              /* ignore */
            }
            setRouletteRevealVoiceExpanded(false);
            if (window.risqueArtemisMode && selectKind === "cardPlay") {
              gameState.phase = "cardplay";
              if (typeof window.risquePersistHostGameState === "function") {
                window.risquePersistHostGameState(gameState);
              }
            }
            if (selectKind === "firstCard") {
              gameState.phase = "deal";
              if (typeof window.risquePersistHostGameState === "function") {
                window.risquePersistHostGameState(gameState);
              }
            }
            if (selectKind === "deployOrder") {
              gameState.phase = "deploy";
              if (window.risqueArtemisMode) {
                gameState.risqueMirrorDeployRoute = "setup";
                try {
                  gameState.risquePublicDeployBanner = waitDeployLine;
                  gameState.risquePublicDeployReport = "";
                  gameState.risqueControlVoice = {
                    primary: waitDeployLine,
                    report: "",
                    reportClass: "ucp-voice-report ucp-voice-report--public-deploy"
                  };
                } catch (eDepBannerNav) {
                  /* ignore */
                }
                if (typeof window.risqueArtemisApplySetupDeployWinnerLock === "function") {
                  window.risqueArtemisApplySetupDeployWinnerLock(gameState);
                }
                if (typeof window.risqueSetMirrorDeployRoute === "function") {
                  window.risqueSetMirrorDeployRoute("setup");
                }
                if (typeof window.risquePersistHostGameState === "function") {
                  window.risquePersistHostGameState(gameState);
                }
                if (typeof window.risqueFlushMirrorPush === "function") {
                  window.__risqueArtemisForceDeployMirrorPush = true;
                  try {
                    window.risqueFlushMirrorPush();
                  } catch (eDepMirNav) {
                    /* ignore */
                  } finally {
                    window.__risqueArtemisForceDeployMirrorPush = false;
                  }
                }
              } else if (typeof window.risquePersistHostGameState === "function") {
                window.risquePersistHostGameState(gameState);
              }
            }
            navigateGameHtmlPreferSoft(nextByKind[selectKind]);
          }, navigateDelayMs);
      }
      scheduleSelect(function () {
        cycle();
      }, 200);
    }

    cycleNames();
  }

  window.risquePhases = window.risquePhases || {};
  window.risquePhases.playerSelect = {
    mount: mount
  };
})();
