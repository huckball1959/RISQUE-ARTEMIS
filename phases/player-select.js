/**
 * Legacy player1.html selection (name cycle + random pick) as JS.
 * selectKind: firstCard | deployOrder | cardPlay
 */
(function () {
  "use strict";

  var STYLE_ID = "risque-player-select-styles";

  /**
   * DEV ONLY — rig roulette winner while keeping the name cycle animation.
   * Set to laptop slot (1 = Guido/host, 2 = Mictor, 3 = Nooch) or null for true random.
   * Override at runtime: window.risqueArtemisRigSelectSlot = 1 | null
   * URL override: ?artemisPickSlot=1  or  ?rigPick=random  to disable rig.
   */
  var RISQUE_DEV_RIG_PLAYER_SELECT_SLOT = null;

  function normSelectName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function resolveRiggedSelectSlot(selectKind) {
    selectKind = String(selectKind || "");
    /*
     * ARTEMIS setup-deploy testing: force Guido (host / slot 1) as first deployer.
     * Does not affect firstCard or cardPlay roulettes. Disable: ?rigDeploy=random on host URL.
     */
    if (window.risqueArtemisMode && selectKind === "deployOrder") {
      try {
        if (new URL(window.location.href).searchParams.get("rigDeploy") === "random") {
          return 0;
        }
      } catch (eDepRand) {
        /* ignore */
      }
      if (typeof window.risqueArtemisRigDeployOrderSlot === "number") {
        var depSlot = Number(window.risqueArtemisRigDeployOrderSlot);
        return depSlot >= 1 ? depSlot : 1;
      }
      return 1;
    }
    /*
     * ARTEMIS cardplay-order testing: force Guido (host / slot 1) as first cardplayer.
     * Disable: ?rigCardPlay=random on host URL. Later: window.risqueArtemisRigCardPlaySlot = 2 for Mictor.
     */
    if (window.risqueArtemisMode && selectKind === "cardPlay") {
      try {
        if (new URL(window.location.href).searchParams.get("rigCardPlay") === "random") {
          return 0;
        }
      } catch (eCpRand) {
        /* ignore */
      }
      if (typeof window.risqueArtemisRigCardPlaySlot === "number") {
        var cpSlot = Number(window.risqueArtemisRigCardPlaySlot);
        return cpSlot >= 1 ? cpSlot : 1;
      }
      return 1;
    }
    if (typeof window.risqueArtemisRigSelectSlot === "number") {
      if (window.risqueArtemisRigSelectSlot < 1) return 0;
      return window.risqueArtemisRigSelectSlot;
    }
    try {
      var q = new URL(window.location.href).searchParams;
      if (q.get("rigPick") === "random") return 0;
      var qs = q.get("artemisPickSlot") || q.get("rigPickSlot");
      if (qs) {
        var n = parseInt(String(qs), 10);
        if (n >= 1) return n;
      }
      if (String(q.get("rigPick") || "").toLowerCase() === "guido") return 1;
    } catch (eQ) {
      /* ignore */
    }
    if (RISQUE_DEV_RIG_PLAYER_SELECT_SLOT == null) return 0;
    var rig = Number(RISQUE_DEV_RIG_PLAYER_SELECT_SLOT);
    return rig >= 1 ? rig : 0;
  }

  /** Pick winner — rigged slot when dev flag set, else random. */
  function pickRouletteWinner(players, gameState, selectKind) {
    var rigSlot = resolveRiggedSelectSlot(selectKind);
    if (rigSlot >= 1) {
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
      if (players[rigSlot - 1]) return players[rigSlot - 1];
    }
    return players[Math.floor(Math.random() * players.length)];
  }

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
      logLines("ARTEMIS client — player select via host mirror only", opts.log);
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

    if (!selectKind) {
      logLines("Invalid selectKind: " + selectKindRaw, logFn);
      window.location.href = loginRecoveryHref();
      return;
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
        if (typeof window.risqueMirrorPushGameState === "function") {
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
          setTimeout(cycle, 1000 / cyclesPerSecond);
        } else {
          var win = pickRouletteWinner(players, gameState, selectKind);
          if (window.risqueArtemisMode && selectKind === "deployOrder" && resolveRiggedSelectSlot(selectKind) >= 1) {
            try {
              console.info(
                "[ARTEMIS] deploy-order rigged — first deployer:",
                win.name,
                "(slot " + resolveRiggedSelectSlot(selectKind) + ")"
              );
            } catch (eRigLog) {
              /* ignore */
            }
          }
          gameState.currentPlayer = win.name;
          gameState.turnOrder = [win.name].concat(
            players
              .filter(function (p) {
                return p.name !== win.name;
              })
              .map(function (p) {
                return p.name;
              })
          );
          var cardPlayEntry =
            window.risqueArtemisMode
              ? "game.html?phase=cardplay&legacyNext=income.html&postReceive=1"
              : "game.html?phase=cardplay&legacyNext=income.html";
          var nextByKind = {
            firstCard: "game.html?phase=deal",
            deployOrder: "game.html?phase=deploy&kind=setup",
            cardPlay: cardPlayEntry
          };
          gameState.phase =
            selectKind === "firstCard"
              ? "deal"
              : selectKind === "deployOrder"
                ? "deploy"
                : "cardplay";
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
              gameState.risqueMirrorDeployRoute = "setup";
              gameState.risqueArtemisControlSeq = Math.max(Number(gameState.risqueArtemisControlSeq) || 0, 1);
            }
            if (typeof window.risqueArtemisStampControlSlot === "function") {
              window.risqueArtemisStampControlSlot(gameState);
            }
            if (selectKind === "deployOrder") {
              try {
                delete gameState.risqueControlVoice;
              } catch (eCv) {
                /* ignore */
              }
            }
          }

          delete gameState.risquePublicUiSelectKind;
          try {
            localStorage.setItem("gameState", JSON.stringify(gameState));
          } catch (e2) {
            logLines("save failed: " + e2.message, logFn);
          }
          window.gameState = gameState;
          if (typeof window.risqueHostReplaceShellGameState === "function") {
            window.risqueHostReplaceShellGameState(gameState);
          }
          if (window.risqueArtemisMode) {
            gameState.risquePublicPlayerSelectFlash = {
              name: String(win.name || ""),
              color: String(win.color || ""),
              selectKind: String(selectKind || "")
            };
          }
          if (typeof window.risquePersistHostGameState === "function") {
            window.risquePersistHostGameState(gameState);
          }

          logLines(
            "Selected: " + gameState.currentPlayer + " (" + selectKind + ")" +
              (resolveRiggedSelectSlot(selectKind) >= 1
                ? " [rig slot " + resolveRiggedSelectSlot(selectKind) + "]"
                : ""),
            logFn
          );
          if (window.risqueArtemisMode && selectKind === "firstCard") {
            if (typeof window.risqueArtemisSetupMilestone === "function") {
              window.risqueArtemisSetupMilestone(
                "M2-firstCard-winner",
                gameState.currentPlayer + " deals first"
              );
            }
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
          } else {
            nameCycle.style.display = "none";
            resultText.textContent = win.name + " Selected";
            resultText.style.color = colorHex(win.color);
            resultText.style.display = "block";
          }
          if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
            window.risqueRuntimeHud.setControlVoiceText(win.name.toUpperCase() + " SELECTED", "");
          }

          var navigateDelayMs = window.risqueArtemisMode ? 2200 : 1000;
          setTimeout(function () {
            try {
              delete gameState.risquePublicPlayerSelectFlash;
            } catch (eFlashDel) {
              /* ignore */
            }
            navigateGameHtmlPreferSoft(nextByKind[selectKind]);
          }, navigateDelayMs);
        }
      }
      setTimeout(function () {
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
