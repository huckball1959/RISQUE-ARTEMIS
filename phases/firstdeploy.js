/**
 * First setup deployment — all players deploy starting armies in turn order.
 * Sequential handoff (Guido -> Mictor -> Nooch). Turn/income deploy: phases/deploy.js.
 */
(function () {
  "use strict";
  var artemisSetupDeploySession = null;

  /** ARTEMIS: remove wheel/keyboard listeners before remounting setup deploy on another laptop or player. */
  window.risqueTeardownArtemisSetupDeploy = function (clearPhaseSlot) {
    var sess = artemisSetupDeploySession;
    if (sess) {
      if (sess.svg && sess.onWheel) {
        try {
          sess.svg.removeEventListener("wheel", sess.onWheel, { passive: false });
        } catch (eWh) {
          /* ignore */
        }
      }
      if (sess.onKeyDown) {
        try {
          document.removeEventListener("keydown", sess.onKeyDown);
        } catch (eKd) {
          /* ignore */
        }
      }
      artemisSetupDeploySession = null;
    }
    window.risqueDeploy1Active = false;
    window.risqueGetAuxMouseMenu = null;
    if (clearPhaseSlot !== false) {
      var slot = document.getElementById("risque-phase-content");
      if (slot) slot.innerHTML = "";
      var dock = document.getElementById("risque-artemis-deploy-dock");
      if (dock) {
        dock.innerHTML = "";
        dock.hidden = true;
      }
    }
  };

  /** ARTEMIS: refresh live deploy session when host mirror arrives after first mount. */
  window.risqueArtemisRefreshSetupDeploySession = function (mirrorGs) {
    var sess = artemisSetupDeploySession;
    if (!sess || typeof sess.refreshFromMirror !== "function") return false;
    return sess.refreshFromMirror(mirrorGs);
  };

  /** True when setup deploy can mount (territories dealt, bank available for current deployer). */
  window.risqueArtemisSetupDeployMirrorReady = function (gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return false;
    if (
      window.risqueArtemisDeployPushLocked ||
      Number(window.risqueArtemisDeployHandoffPending) > 0 ||
      Number(window.risqueArtemisDeployRelinquishedSeq) > 0
    ) {
      return true;
    }
    if (typeof window.risqueArtemisEnsureRosterOnState === "function") {
      window.risqueArtemisEnsureRosterOnState(gs);
    }
    var mySlot = Number(window.risqueArtemisPlayerSlot) || 0;
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      ctrl = Number(window.risqueArtemisResolveOwnerSlot(gs)) || ctrl;
    }
    if (mySlot >= 1 && ctrl >= 1 && mySlot !== ctrl) {
      return true;
    }
    var player = deployResolveCurrentPlayer(gs);
    if (!player || !player.territories || !player.territories.length) return false;
    var activeBank = deploySyncActiveBankFromBoard(gs, player);
    var expectedBank = deployExpectedSetupBank(gs, player);
    if (activeBank > 0 || expectedBank > 0) return true;
    /* Active deployer finished placing — ready to mount CONFIRM (bank drained). */
    return deployBankDeployedOnBoard(player) > 0 || (player.territories || []).length > 0;
  };

  window.risqueArtemisLogSetupDeployBank = deployLogBankStatus;

  /** Setup/turn deploy: do not stringify the full replay tape into localStorage on every wheel click. */
  function persistGameStateLite(gs) {
    var target = gs && typeof gs === "object" ? gs : window.gameState;
    if (!target) return;
    if (typeof window.risqueWriteGameStateLocalStorageLite === "function") {
      window.risqueWriteGameStateLocalStorageLite(target);
      return;
    }
    try {
      localStorage.setItem("gameState", JSON.stringify(target));
    } catch (err) {
      console.warn("[Deploy] Failed to save game state.");
    }
  }

  function artemisLocalPlayBlocked() {
    return (
      typeof window.risqueArtemisCanLocalPlay === "function" &&
      !window.risqueArtemisCanLocalPlay()
    );
  }

  function artemisNormName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function deployFindPlayer(gs, name) {
    if (!gs || !Array.isArray(gs.players)) return null;
    var want = artemisNormName(name);
    if (!want) return null;
    return (
      gs.players.find(function (p) {
        return p && artemisNormName(p.name) === want;
      }) || null
    );
  }

  function deployStoredRoster() {
    try {
      var raw = sessionStorage.getItem("risqueArtemisRoster");
      return raw ? JSON.parse(raw) : null;
    } catch (eRos) {
      return null;
    }
  }

  /** Active deployer by ARTEMIS control slot (matches HUD turn banner). */
  function deployResolvePlayerByControlSlot(gs) {
    if (!gs || !Array.isArray(gs.players)) return null;
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (ctrl < 1 || ctrl > 3) return null;
    var roster =
      gs.artemisRoster && Array.isArray(gs.artemisRoster) && gs.artemisRoster.length
        ? gs.artemisRoster
        : deployStoredRoster();
    if (roster && Array.isArray(roster)) {
      var hit = roster.find(function (r) {
        return Number(r.slot) === ctrl;
      });
      if (hit && hit.name) {
        var byRoster = deployFindPlayer(gs, hit.name);
        if (byRoster) return byRoster;
      }
    }
    var byOrder = gs.players.find(function (p) {
      return Number(p.playerOrder) === ctrl;
    });
    if (byOrder) return byOrder;
    if (gs.players[ctrl - 1]) return gs.players[ctrl - 1];
    return null;
  }

  function artemisIsTurnDeployRouteGs(gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return false;
    var route = String(gs.risqueMirrorDeployRoute || "");
    if (route === "turn" || route === "deploy2") return true;
    try {
      var rkTd = localStorage.getItem("risqueMirrorDeployRoute");
      if (rkTd === "turn" || rkTd === "deploy2") return true;
    } catch (eRkTd) {
      /* ignore */
    }
    if (gs.setupComplete === true) {
      var banksTd = 0;
      (gs.players || []).forEach(function (p) {
        if ((Number(p.bankValue) || 0) > 0) banksTd += 1;
      });
      if (banksTd <= 1) return true;
    }
    return false;
  }

  /** Resolve active setup deployer — ARTEMIS: control slot first (matches HUD banner + bank). */
  function deployResolveCurrentPlayer(gs) {
    if (!gs || !Array.isArray(gs.players)) return null;
    if (
      window.risqueArtemisMode &&
      String(gs.phase || "") === "deploy" &&
      artemisIsTurnDeployRouteGs(gs) &&
      Number(gs.artemisControlSlot) >= 1
    ) {
      var turnPlayer = deployResolvePlayerByControlSlot(gs);
      if (turnPlayer) {
        gs.currentPlayer = turnPlayer.name;
        return turnPlayer;
      }
    }
    if (
      window.risqueArtemisMode &&
      typeof window.risqueArtemisHostHasSetupDeployWinnerLock === "function" &&
      window.risqueArtemisHostHasSetupDeployWinnerLock(gs) &&
      typeof window.risqueArtemisApplySetupDeployWinnerLock === "function" &&
      window.risqueArtemisApplySetupDeployWinnerLock(gs)
    ) {
      var locked = deployFindPlayer(gs, gs.currentPlayer);
      if (locked) {
        deployRepairSetupBankIfNeeded(gs, locked);
        return locked;
      }
    }
    var player = null;
    if (
      window.risqueArtemisMode &&
      String(gs.phase || "") === "deploy" &&
      Number(gs.artemisControlSlot) >= 1 &&
      !(
        typeof window.risqueArtemisHostHasSetupDeployWinnerLock === "function" &&
        window.risqueArtemisHostHasSetupDeployWinnerLock(gs)
      )
    ) {
      player = deployResolvePlayerByControlSlot(gs);
      if (player) {
        gs.currentPlayer = player.name;
        deployRepairSetupBankIfNeeded(gs, player);
        return player;
      }
    }
    player = deployFindPlayer(gs, gs.currentPlayer);
    if (player) {
      deployRepairSetupBankIfNeeded(gs, player);
      return player;
    }
    player = deployResolvePlayerByControlSlot(gs);
    if (player) {
      gs.currentPlayer = player.name;
      deployRepairSetupBankIfNeeded(gs, player);
      return player;
    }
    return null;
  }

  function deployStartingBankForPlayerCount(n) {
    return n === 2 ? 40 : n === 3 ? 35 : n === 4 ? 30 : n === 5 ? 25 : 20;
  }

  /** Troops already moved from bank onto the map (above the 1 baseline per territory). */
  function deployBankDeployedOnBoard(player) {
    var deployed = 0;
    (player.territories || []).forEach(function (t) {
      deployed += Math.max(0, (Number(t.troops) || 0) - 1);
    });
    return deployed;
  }

  function deployExpectedSetupBank(gs, player) {
    if (!gs || !player) return 0;
    var terr = (player.territories || []).length;
    if (terr === 0) return 0;
    var start = deployStartingBankForPlayerCount((gs.players || []).length);
    var onBoard = deployBankDeployedOnBoard(player);
    return Math.max(0, start - terr - onBoard);
  }

  /**
   * Hot-seat truth: remaining bank = startingBank âˆ’ territories âˆ’ extra troops on board.
   * ARTEMIS mirrors often ship bankValue=0 while territory counts are correct â€” sync from board math.
   */
  function deploySyncActiveBankFromBoard(gs, player) {
    if (!gs || !player) return 0;
    var remaining = deployExpectedSetupBank(gs, player);
    player.bankValue = remaining;
    player.troopsTotal = (player.territories || []).length + remaining;
    return remaining;
  }

  window.risqueArtemisSyncActiveSetupBankFromBoard = deploySyncActiveBankFromBoard;

  /**
   * Fix mirror desync at setup deploy start only â€” never refill bank after troops are placed.
   * expected = startingBank âˆ’ territories âˆ’ troopsAlreadyDeployedFromBank.
   */
  function deployRepairSetupBankIfNeeded(gs, player) {
    if (!gs || !player) return false;
    var terr = (player.territories || []).length;
    if (terr === 0) return false;
    var onBoard = deployBankDeployedOnBoard(player);
    var bank = Number(player.bankValue) || 0;
    var expected = deployExpectedSetupBank(gs, player);
    /* Only repair pristine post-deal mirror (nothing deployed yet, bank wrong). */
    if (onBoard > 0) return false;
    if (bank === expected) return false;
    if (expected > 0) {
      player.bankValue = expected;
      player.troopsTotal = terr + expected;
      return true;
    }
    return false;
  }

  function deployRepairAllSetupBanks(gs) {
    if (!gs || !Array.isArray(gs.players)) return;
    gs.players.forEach(function (p) {
      deployRepairSetupBankIfNeeded(gs, p);
    });
  }

  /** Repair + force expected bank for the active setup deployer (handoff mount). */
  function deployEnsureActivePlayerSetupBank(gs) {
    if (!gs) return null;
    var player = deployResolveCurrentPlayer(gs);
    if (!player) return null;
    deploySyncActiveBankFromBoard(gs, player);
    return player;
  }

  window.risqueArtemisRepairAllSetupDeployBanks = deployRepairAllSetupBanks;
  window.risqueArtemisEnsureActiveSetupDeployBank = deployEnsureActivePlayerSetupBank;
  window.risqueArtemisDeployResolveCurrentPlayer = deployResolveCurrentPlayer;

  function deployLogBankStatus(gs, tag) {
    if (!window.risqueArtemisMode) return;
    try {
      var player = deployResolveCurrentPlayer(gs);
      var terr = player && player.territories ? player.territories.length : 0;
      var onBoard = player ? deployBankDeployedOnBoard(player) : 0;
      var expected = player ? deployExpectedSetupBank(gs, player) : 0;
      console.info(
        "[ARTEMIS deploy] " + (tag || "bank") +
          " currentPlayer=" + String(gs && gs.currentPlayer) +
          " resolved=" + (player ? player.name : "?") +
          " bank=" + (player ? player.bankValue : "?") +
          " territories=" + terr +
          " deployedOnBoard=" + onBoard +
          " expectedBank=" + expected +
          " controlSlot=" + String(gs && gs.artemisControlSlot)
      );
    } catch (eLog) {
      /* ignore */
    }
  }

  function artemisStampControlSlotForCurrentPlayer(gs) {
    if (!gs || !window.risqueArtemisMode) return 0;
    var slot = 0;
    if (Array.isArray(gs.artemisRoster)) {
      var hit = gs.artemisRoster.find(function (r) {
        return artemisNormName(r && r.name) === artemisNormName(gs.currentPlayer);
      });
      if (hit) slot = Number(hit.slot) || 0;
    }
    if (!slot && typeof window.risqueArtemisActivePlayerSlot === "function") {
      slot = Number(window.risqueArtemisActivePlayerSlot(gs)) || 0;
    }
    if (slot >= 1 && slot <= 3) {
      gs.artemisControlSlot = slot;
    }
    return slot;
  }

  function loginRecoveryHref() {
    return window.risqueLoginRecoveryViaPrivacyUrl();
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

  function mountSetupDeployHandoff(playerName, kind, onContinue, logFn) {
    /* ARTEMIS: each laptop owns its turn â€” no hot-seat tablet handoff overlay. */
    if (window.risqueArtemisMode) {
      if (typeof onContinue === "function") onContinue();
      return;
    }
    var label = (playerName || "the next player").toString();
    var msg =
      kind === "first"
        ? "Setup deployment\n\nHand the tablet to " +
          label +
          ".\n\nOnly this player should tap Continue."
        : "Hand the tablet to " +
          label +
          " for deployment.\n\nOnly this player should tap Continue.";
    if (
      !window.risquePhases ||
      !window.risquePhases.privacyGate ||
      typeof window.risquePhases.privacyGate.mount !== "function"
    ) {
      if (typeof logFn === "function") {
        logFn("[DeploySetup] Privacy gate unavailable; skipping handoff overlay.");
      }
      if (typeof onContinue === "function") onContinue();
      return;
    }
    window.risquePhases.privacyGate.mount(document.body, {
      message: msg,
      buttonLabel: "Continue",
      onContinue: function () {
        if (typeof onContinue === "function") onContinue();
      },
      onLog: logFn
    });
  }

  function logLineSetup(message, logFn) {
    var ts = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    var line = "[" + ts + "] [DeploySetup] " + message;
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

  function runFirstDeploy(stageHost, opts) {
    opts = opts || {};
    var logFn = opts.log;
    if (window.risqueArtemisMode && typeof window.risqueTeardownArtemisSetupDeploy === "function") {
      window.risqueTeardownArtemisSetupDeploy(false);
    }
    window.viewTroopsActive = false;
    if (typeof window.risqueSetMirrorDeployRoute === "function") {
      window.risqueSetMirrorDeployRoute("setup");
    }

    var canvas = document.getElementById("canvas");
    var uiOverlay = document.getElementById("ui-overlay");
    if (!canvas || !uiOverlay || !window.gameUtils) {
      logLineSetup("Missing canvas, ui-overlay, or gameUtils", logFn);
      window.risqueDeploy1Active = false;
      return;
    }

    var phaseSlot = null;
    if (window.risqueArtemisMode && typeof window.risqueArtemisEnsureDeployDock === "function") {
      phaseSlot = window.risqueArtemisEnsureDeployDock();
    }
    if (!phaseSlot) {
      phaseSlot = document.getElementById("risque-phase-content");
    }
    if (!phaseSlot) {
      logLineSetup("Missing deploy mount target (setup HUD not ready)", logFn);
      window.risqueDeploy1Active = false;
      return;
    }

    window.risqueDeploy1Active = true;

    var psFromSelect = document.getElementById("risque-player-select-root");
    if (psFromSelect && psFromSelect.parentNode) psFromSelect.parentNode.removeChild(psFromSelect);

    uiOverlay.className = "ui-overlay visible";
    uiOverlay.classList.remove("fade-out");

    phaseSlot.innerHTML =
      '<div class="deploy2-compact-root">' +
      '<div class="deploy2-bank-row">' +
      '<span class="deploy2-bank-label">Bank</span>' +
      '<span id="deploy1-bank-number" class="deploy2-bank-number">000</span>' +
      "</div>" +
      '<p class="deploy2-hint">Select a territory. Scroll the wheel or type a number and press Enter. Use âˆ’ for removals.</p>' +
      '<div class="deploy2-actions deploy1-deploy-actions deploy1-deploy-actions--hud-row">' +
      '<button type="button" id="deploy1-reset" class="deploy1-action-btn">RESET</button>' +
      '<button type="button" id="deploy1-add-2" class="deploy1-action-btn">+2</button>' +
      '<button type="button" id="deploy1-add-5" class="deploy1-action-btn">+5</button>' +
      '<button type="button" id="deploy1-add-10" class="deploy1-action-btn">+10</button>' +
      '<button type="button" id="deploy1-add-all" class="deploy1-action-btn">ALL</button>' +
      '<button type="button" id="deploy1-confirm" class="deploy1-action-btn">CONFIRM</button>' +
      "</div>" +
      "</div>";

    var bankNumber = document.getElementById("deploy1-bank-number");
    var confirmButton = document.getElementById("deploy1-confirm");
    var resetButton = document.getElementById("deploy1-reset");

    var gameState = null;
    var deploymentOrder = [];
    var currentPlayerIndex = 0;
    var initialBankValues = {};
    var deploymentInitialized = false;
    var keyboardBuffer = "";
    var negativeInput = false;
    var deployedTroops = {};

    function renderMap(changedLabel) {
      if (
        window.risqueArtemisMode &&
        window.risqueArtemisNetClient &&
        (window.risqueArtemisDeployPushLocked ||
          window.risqueArtemisDeployHandoffPending ||
          !window.risqueArtemisClientPlaying)
      ) {
        return;
      }
      window.gameState = gameState;
      var renderPlayer = deployResolveCurrentPlayer(gameState);
      window.deployedTroops = renderPlayer
        ? deployedTroops[artemisNormName(renderPlayer.name)] || {}
        : {};
      window.gameUtils.renderAll(gameState, changedLabel, window.deployedTroops);
      if (window.risqueArtemisDeployPushLocked || window.__risqueArtemisApplyingDeployMirror) {
        return;
      }
      if (typeof window.risquePersistHostGameState === "function") {
        window.risquePersistHostGameState();
      }
    }

    /** Drop deploy-only UI (bumps, white â€œbankâ€ fill, +N satellites, mirror draft) and redraw â€” call after phase leaves deploy. */
    function clearDeployChromeThenRedraw() {
      window.gameState = gameState;
      window.selectedTerritory = null;
      window.viewTroopsActive = false;
      window.deployedTroops = {};
      if (gameState.risqueDeployMirrorDraft) {
        delete gameState.risqueDeployMirrorDraft;
      }
      if (gameState.risqueDeployTransientPrimary) {
        delete gameState.risqueDeployTransientPrimary;
      }
      if (typeof window.risqueSetSpectatorFocus === "function") {
        window.risqueSetSpectatorFocus([]);
      }
      window.gameUtils.renderTerritories(null, gameState, {});
      window.gameUtils.renderStats(gameState);
    }

    function persistGameStateForPublicMirror() {
      try {
        if (window.gameState && !window.risqueDisplayIsPublic) {
          persistGameStateLite(window.gameState);
          if (typeof window.risqueMirrorPushGameState === "function") {
            window.risqueMirrorPushGameState();
          }
        }
      } catch (e0) {
        /* ignore */
      }
    }

    function updateDeployVoice(warnMessage) {
      if (!window.risqueRuntimeHud || typeof window.risqueRuntimeHud.setControlVoiceText !== "function") {
        return;
      }
      if (!gameState) return;
      var player = deployResolveCurrentPlayer(gameState);
      if (!player) return;
      var primary = player.name.toUpperCase() + "\nDEPLOY ALL TROOPS FROM YOUR BANK";
      if (warnMessage) {
        try {
          gameState.risquePublicDeployBanner =
            player.name.toUpperCase() + " IS DEPLOYING TROOPS";
          gameState.risquePublicDeployReport = String(warnMessage);
        } catch (eBanner0) {}
        window.risqueRuntimeHud.setControlVoiceText(primary, String(warnMessage), {
          reportClass: "ucp-voice-report ucp-voice-report--public-deploy",
          skipMirror: !!window.risqueArtemisMode,
          artemisDeployOwner: !!window.risqueArtemisMode
        });
        if (window.risqueArtemisMode && typeof window.risquePersistHostGameState === "function") {
          window.risquePersistHostGameState(gameState);
        } else {
          persistGameStateForPublicMirror();
        }
        return;
      }
      if (typeof window.risqueRefreshDeployNarration === "function") {
        window.risqueRefreshDeployNarration(gameState);
        persistGameStateForPublicMirror();
        return;
      }
      try {
        gameState.risquePublicDeployBanner =
          player.name.toUpperCase() + " IS DEPLOYING TROOPS";
        gameState.risquePublicDeployReport = "";
      } catch (eBanner1) {}
      window.risqueRuntimeHud.setControlVoiceText(primary, "", {
        reportClass: "ucp-voice-report ucp-voice-report--public-deploy",
        skipMirror: !!window.risqueArtemisMode,
        artemisDeployOwner: !!window.risqueArtemisMode
      });
      persistGameStateForPublicMirror();
    }

    function updateBankDisplay() {
      if (!gameState) return;
      var player = deployResolveCurrentPlayer(gameState);
      var bankNum = 0;
      if (player) {
        bankNum = deploySyncActiveBankFromBoard(gameState, player);
      }
      var bankText = String(Math.max(0, bankNum)).padStart(3, "0");
      var bankEl = document.getElementById("deploy1-bank-number") || bankNumber;
      if (bankEl) {
        bankEl.textContent = bankText;
      } else if (window.risqueArtemisMode) {
        try {
          console.warn("[ARTEMIS deploy] #deploy1-bank-number missing â€” bank is " + bankText);
        } catch (eWarn) {
          /* ignore */
        }
      }
      if (window.risqueArtemisMode && window.risqueArtemisNetClient) {
        deployLogBankStatus(gameState, "display");
      }
      updateDeployVoice();
    }

    function onWheel(e) {
      if (artemisLocalPlayBlocked()) return;
      if (!gameState || !window.selectedTerritory) return;
      e.preventDefault();
      var player = deployResolveCurrentPlayer(gameState);
      var territory = player && player.territories.find(function (t) {
        return t.name === window.selectedTerritory;
      });
      if (!territory) return;
      var delta = e.deltaY > 0 ? -1 : 1;
      var newTroops = territory.troops + delta;
      if (newTroops < 1) {
        return;
      }
      if (delta > 0 && deployExpectedSetupBank(gameState, player) === 0) {
        window.gameUtils.showError("");
        updateDeployVoice("No troops left in bank.");
        return;
      }
      deploySyncActiveBankFromBoard(gameState, player);
      territory.troops = newTroops;
      player.bankValue -= delta;
      player.troopsTotal += delta;
      var depPk = artemisNormName(player.name);
      if (!deployedTroops[depPk]) deployedTroops[depPk] = {};
      deployedTroops[depPk][territory.name] = territory.troops - 1;
      renderMap(window.selectedTerritory);
      updateBankDisplay();
      window.gameUtils.showError("");
      if (typeof window.risqueSetSpectatorFocus === "function" && window.selectedTerritory) {
        window.risqueSetSpectatorFocus([window.selectedTerritory]);
      }
      if (window.risqueArtemisMode && typeof window.risqueArtemisEnsureDeployOwnerVoiceChrome === "function") {
        window.risqueArtemisEnsureDeployOwnerVoiceChrome(gameState);
        requestAnimationFrame(function () {
          window.risqueArtemisEnsureDeployOwnerVoiceChrome(gameState);
        });
      }
      try {
        if (typeof window.risquePersistHostGameState === "function") {
          window.risquePersistHostGameState(gameState);
        } else {
          persistGameStateLite(gameState);
        }
      } catch (err) {
        console.warn("[Deploy] Failed to save game state.");
      }
      if (window.risqueArtemisMode && typeof window.risqueArtemisEnsureDeployOwnerVoiceChrome === "function") {
        requestAnimationFrame(function () {
          window.risqueArtemisEnsureDeployOwnerVoiceChrome(gameState);
        });
      }
    }

    /** Move bank to selected territory until `leaveInBank` troops remain (wheel shortcut). */
    function applyBulkDeploySetup(leaveInBank) {
      if (artemisLocalPlayBlocked()) return;
      leaveInBank = Math.max(0, Math.floor(Number(leaveInBank) || 0));
      if (!gameState || !window.selectedTerritory) {
        return;
      }
      var player = deployResolveCurrentPlayer(gameState);
      if (!player) return;
      var territory = player.territories.find(function (t) {
        return t.name === window.selectedTerritory;
      });
      if (!territory) return;
      var bank = deploySyncActiveBankFromBoard(gameState, player);
      var toAdd = bank - leaveInBank;
      if (toAdd <= 0) {
        window.gameUtils.showError("");
        updateDeployVoice(
          bank <= leaveInBank
            ? "Not enough in bank to leave " + leaveInBank + " behind on this territory."
            : ""
        );
        return;
      }
      territory.troops += toAdd;
      player.bankValue -= toAdd;
      player.troopsTotal += toAdd;
      var bulkPk = artemisNormName(player.name);
      if (!deployedTroops[bulkPk]) deployedTroops[bulkPk] = {};
      deployedTroops[bulkPk][territory.name] = territory.troops - 1;
      renderMap(window.selectedTerritory);
      updateBankDisplay();
      window.gameUtils.showError("");
      if (typeof window.risqueSetSpectatorFocus === "function" && window.selectedTerritory) {
        window.risqueSetSpectatorFocus([window.selectedTerritory]);
      }
      try {
        if (typeof window.risquePersistHostGameState === "function") {
          window.risquePersistHostGameState(gameState);
        } else {
          persistGameStateLite(gameState);
        }
      } catch (err) {
        console.warn("[Deploy] Failed to save game state.");
      }
    }

    function applyDeployFromBankSetup(troopChange) {
      if (artemisLocalPlayBlocked()) return;
      troopChange = Math.floor(Number(troopChange) || 0);
      if (troopChange <= 0 || !gameState) return;
      if (!window.selectedTerritory) {
        return;
      }
      var player = deployResolveCurrentPlayer(gameState);
      if (!player) return;
      var territory = player.territories.find(function (t) {
        return t.name === window.selectedTerritory;
      });
      if (!territory) return;
      var newTroops = territory.troops + troopChange;
      if (newTroops < 1) {
        return;
      }
      deploySyncActiveBankFromBoard(gameState, player);
      if (troopChange > player.bankValue) {
        window.gameUtils.showError("");
        updateDeployVoice(
          "Only " +
            player.bankValue +
            " troop" +
            (player.bankValue === 1 ? "" : "s") +
            " left in bank."
        );
        return;
      }
      territory.troops = newTroops;
      player.bankValue -= troopChange;
      player.troopsTotal += troopChange;
      var bankPk = artemisNormName(player.name);
      if (!deployedTroops[bankPk]) deployedTroops[bankPk] = {};
      deployedTroops[bankPk][territory.name] = territory.troops - 1;
      renderMap(window.selectedTerritory);
      updateBankDisplay();
      window.gameUtils.showError("");
      if (typeof window.risqueSetSpectatorFocus === "function" && window.selectedTerritory) {
        window.risqueSetSpectatorFocus([window.selectedTerritory]);
      }
      try {
        if (typeof window.risquePersistHostGameState === "function") {
          window.risquePersistHostGameState(gameState);
        } else {
          persistGameStateLite(gameState);
        }
      } catch (err) {
        console.warn("[Deploy] Failed to save game state.");
      }
    }

    function installDeploySetupAuxMenu() {
      window.risqueGetAuxMouseMenu = function () {
        if (!window.risqueDeploy1Active || !gameState) {
          return null;
        }
        return {
          title: "Deployment",
          hint: window.selectedTerritory
            ? "Thumb-button menu â€” or keep using the wheel on the map."
            : "Select a territory on the map first.",
          anchor: true,
          actions: [
            {
              label: "Confirm",
              action: function () {
                if (confirmButton) confirmButton.click();
              }
            },
            { label: "Cancel", action: function () {} },
            {
              label: "Put all but 1 in bank on territory",
              action: function () {
                applyBulkDeploySetup(1);
              }
            },
            {
              label: "Put all but 3 in bank on territory",
              action: function () {
                applyBulkDeploySetup(3);
              }
            },
            {
              label: "Reset",
              action: function () {
                if (resetButton) resetButton.click();
              }
            }
          ]
        };
      };
    }

    function onKeyDown(e) {
      if (artemisLocalPlayBlocked()) return;
      if (!gameState || !window.selectedTerritory) return;
      var player = deployResolveCurrentPlayer(gameState);
      var territory = player && player.territories.find(function (t) {
        return t.name === window.selectedTerritory;
      });
      if (!territory) return;
      if (e.key === "Enter") {
        if (keyboardBuffer === "") return;
        var troops = parseInt(keyboardBuffer, 10);
        if (isNaN(troops)) {
          keyboardBuffer = "";
          negativeInput = false;
          return;
        }
        var troopChange = negativeInput ? -troops : troops;
        var newTroops2 = territory.troops + troopChange;
        if (newTroops2 < 1) {
          keyboardBuffer = "";
          negativeInput = false;
          return;
        }
        deploySyncActiveBankFromBoard(gameState, player);
        if (troopChange > player.bankValue) {
          window.gameUtils.showError("");
          deploySyncActiveBankFromBoard(gameState, player);
          updateDeployVoice(
            "Only " +
              player.bankValue +
              " troop" +
              (player.bankValue === 1 ? "" : "s") +
              " left in bank."
          );
          keyboardBuffer = "";
          negativeInput = false;
          return;
        }
        territory.troops = newTroops2;
        player.bankValue -= troopChange;
        player.troopsTotal += troopChange;
        var keyPk = artemisNormName(player.name);
        if (!deployedTroops[keyPk]) deployedTroops[keyPk] = {};
        deployedTroops[keyPk][territory.name] = territory.troops - 1;
        keyboardBuffer = "";
        negativeInput = false;
        var prettyT1 =
          window.gameUtils && window.gameUtils.formatTerritoryDisplayName
            ? window.gameUtils.formatTerritoryDisplayName(territory.name)
            : territory.name.replace(/_/g, " ");
        if (troopChange > 0 && typeof window.risqueDeployTroopCountToWord === "function") {
          gameState.risqueDeployTransientPrimary =
            player.name +
            " has deployed " +
            window.risqueDeployTroopCountToWord(Math.abs(troopChange)) +
            " troops to " +
            prettyT1 +
            ".";
        } else if (troopChange < 0 && typeof window.risqueDeployTroopCountToWord === "function") {
          gameState.risqueDeployTransientPrimary =
            player.name +
            " has removed " +
            window.risqueDeployTroopCountToWord(Math.abs(troopChange)) +
            " troops from " +
            prettyT1 +
            ".";
        }
        window.selectedTerritory = null;
        window.gameUtils.showError("");
        renderMap(null);
        updateBankDisplay();
        try {
          persistGameStateLite(gameState);
        } catch (err2) {
          console.warn("[Deploy] Failed to save game state.");
        }
      } else if (e.key === "-") {
        negativeInput = true;
        keyboardBuffer = "";
      } else if (e.key >= "0" && e.key <= "9") {
        keyboardBuffer += e.key;
        if (keyboardBuffer.length > 3) {
          keyboardBuffer = keyboardBuffer.slice(0, -1);
        }
      }
    }

    function setupDeployInitKey(gs) {
      if (!gs) return "";
      var ctrl = Number(gs.artemisControlSlot) || 0;
      return (
        String(ctrl) +
        ":" +
        artemisNormName(gs.currentPlayer) +
        ":" +
        String(Number(gs.risqueArtemisControlSeq) || 0)
      );
    }

    function initializeDeployment() {
      var gsForInit = window.gameState;
      var nextInitKey = setupDeployInitKey(gsForInit);
      if (
        deploymentInitialized &&
        nextInitKey &&
        window.__risqueArtemisSetupDeployInitKey === nextInitKey
      ) {
        return;
      }
      if (deploymentInitialized && nextInitKey) {
        if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
          window.risqueTeardownArtemisSetupDeploy(false);
        }
        artemisSetupDeploySession = null;
        deploymentInitialized = false;
      }

      function beginWithLoadedState(loadedGameState) {
        if (!loadedGameState) {
          console.warn("[Deploy] Invalid game state. Redirecting.");
          window.risqueDeploy1Active = false;
          if (window.risqueArtemisNetClient && typeof window.risqueArtemisResetClientDeployMount === "function") {
            window.risqueArtemisResetClientDeployMount();
          }
          setTimeout(function () {
            window.location.href = loginRecoveryHref();
          }, 1000);
          return;
        }
        gameState = loadedGameState;
        if (
          window.risqueArtemisHost &&
          typeof window.risqueArtemisHostHasSetupDeployWinnerLock === "function" &&
          window.risqueArtemisHostHasSetupDeployWinnerLock(gameState) &&
          typeof window.risqueArtemisForcePostRouletteWinner === "function"
        ) {
          window.risqueArtemisForcePostRouletteWinner(gameState, "deployOrder");
        }
        if (
          typeof window.risqueArtemisHostHasSetupDeployWinnerLock === "function" &&
          window.risqueArtemisHostHasSetupDeployWinnerLock(gameState) &&
          typeof window.risqueArtemisApplySetupDeployWinnerLock === "function"
        ) {
          window.risqueArtemisApplySetupDeployWinnerLock(gameState);
        }
        deployEnsureActivePlayerSetupBank(gameState);
        deployLogBankStatus(gameState, "init");
        var invalidPlayer = gameState.players.find(function (p) {
          return !p.territories || p.territories.length === 0;
        });
        if (invalidPlayer) {
          console.warn("[Deploy] Invalid: player has no territories.");
          window.risqueDeploy1Active = false;
          if (window.risqueArtemisNetClient && typeof window.risqueArtemisResetClientDeployMount === "function") {
            window.risqueArtemisResetClientDeployMount();
          }
          setTimeout(function () {
            window.location.href = loginRecoveryHref();
          }, 1000);
          return;
        }
        if (!gameState.currentPlayer || gameState.turnOrder.indexOf(gameState.currentPlayer) === -1) {
          console.warn("[Deploy] Invalid current player.");
          window.risqueDeploy1Active = false;
          if (window.risqueArtemisNetClient && typeof window.risqueArtemisResetClientDeployMount === "function") {
            window.risqueArtemisResetClientDeployMount();
          }
          setTimeout(function () {
            window.location.href = loginRecoveryHref();
          }, 1000);
          return;
        }
        deploymentOrder = gameState.turnOrder.slice();
        currentPlayerIndex = deploymentOrder.indexOf(gameState.currentPlayer);
        gameState.phase = "deploy";
        gameState.risqueMirrorDeployRoute = "setup";
        gameState.players.forEach(function (player) {
          var pk = artemisNormName(player.name);
          initialBankValues[pk] = deployExpectedSetupBank(gameState, player);
          deployedTroops[pk] = {};
          player.territories.forEach(function (t) {
            deployedTroops[pk][t.name] = t.troops - 1;
          });
        });
        deployEnsureActivePlayerSetupBank(gameState);
        deploymentInitialized = true;
        window.__risqueArtemisSetupDeployInitKey = setupDeployInitKey(gameState);
        logLineSetup("Initialized: currentPlayer=" + gameState.currentPlayer, logFn);
        window.viewTroopsActive = false;
        window.gameState = gameState;
        installDeploySetupAuxMenu();
        function revealSetupDeployAfterHandoff() {
          renderMap(null);
          updateBankDisplay();
          if (typeof window.risqueReplaySeedOpening === "function") {
            window.risqueReplaySeedOpening(gameState);
          }
          if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
            window.risqueRuntimeHud.updateTurnBannerFromState(gameState);
          }
          if (window.risqueRuntimeHud && window.risqueRuntimeHud.syncPosition) {
            requestAnimationFrame(function () {
              window.risqueRuntimeHud.syncPosition();
            });
          }
        }
        mountSetupDeployHandoff(gameState.currentPlayer, "first", revealSetupDeployAfterHandoff, logFn);
        updateBankDisplay();
        function finishDeployInitVoice() {
          if (window.risqueArtemisMode && typeof window.risqueArtemisEnsureOmniClientHud === "function") {
            window.risqueArtemisEnsureOmniClientHud(gameState);
          }
          if (window.risqueArtemisMode) {
            if (
              typeof window.risqueArtemisLocalOwnsSetupDeploy === "function" &&
              window.risqueArtemisLocalOwnsSetupDeploy(gameState)
            ) {
              updateDeployVoice();
            } else if (typeof window.risqueArtemisRefreshDeploySpectator === "function") {
              window.risqueArtemisRefreshDeploySpectator(gameState);
            } else if (typeof window.risqueArtemisApplyDeployVoiceFromState === "function") {
              window.risqueArtemisApplyDeployVoiceFromState(gameState);
            }
          } else {
            updateDeployVoice();
          }
        }
        requestAnimationFrame(function () {
          requestAnimationFrame(finishDeployInitVoice);
        });
      }

      /* ARTEMIS: use live window.gameState â€” not stale localStorage. */
      if (
        window.risqueArtemisMode &&
        window.gameState &&
        window.gameUtils.validateGameState(window.gameState) &&
        (window.risqueArtemisHost ||
          (window.risqueArtemisNetClient && window.risqueArtemisClientPlaying))
      ) {
        try {
          localStorage.setItem("gameState", JSON.stringify(window.gameState));
        } catch (eArtemisLs) {
          /* ignore */
        }
        beginWithLoadedState(window.gameState);
        return;
      }

      window.gameUtils.loadGameState(function (loadedGameState) {
        beginWithLoadedState(loadedGameState);
      });
    }

    resetButton.addEventListener("click", function () {
      if (artemisLocalPlayBlocked()) return;
      var player = deployResolveCurrentPlayer(gameState);
      if (!player) {
        console.warn("[Deploy] No current player.");
        return;
      }
      player.bankValue = initialBankValues[artemisNormName(player.name)] || 0;
      player.territories.forEach(function (t) {
        t.troops = 1;
        deployedTroops[artemisNormName(player.name)][t.name] = 0;
      });
      player.troopsTotal = player.territories.length;
      keyboardBuffer = "";
      negativeInput = false;
      window.selectedTerritory = null;
      window.viewTroopsActive = false;
      window.gameUtils.showError("");
      renderMap(null);
      updateBankDisplay();
      try {
        persistGameStateLite(gameState);
      } catch (e) {
        console.warn("[Deploy] Failed to save game state.");
      }
    });

    confirmButton.addEventListener("click", function () {
      if (artemisLocalPlayBlocked()) return;
      if (confirmButton.disabled) return;
      var player = deployResolveCurrentPlayer(gameState);
      if (!player) {
        console.warn("[Deploy] No current player.");
        return;
      }
      deploySyncActiveBankFromBoard(gameState, player);
      if (player.bankValue > 0) {
        window.gameUtils.showError("");
        updateDeployVoice("Deploy every troop from your bank before confirming.");
        if (typeof window.risqueArtemisDiag === "function") {
          window.risqueArtemisDiag(
            "confirm_blocked_bank",
            "CONFIRM blocked — bank=" + String(player.bankValue),
            { player: player.name, bank: player.bankValue }
          );
        }
        return;
      }
      if (gameState.players.every(function (p) {
        return p.bankValue === 0;
      })) {
        if (typeof window.risqueArtemisDiag === "function") {
          window.risqueArtemisDiag(
            "confirm_all_banks_zero",
            "CONFIRM took all-players-done path (setup deploy finish)",
            { role: window.risqueArtemisNetClient ? "client" : "host" }
          );
        }
        var artemisClientFinish =
          window.risqueArtemisMode &&
          window.risqueArtemisNetClient &&
          (window.risqueArtemisClientPlaying ||
            (typeof window.risqueArtemisIsMyTurn === "function" &&
              window.risqueArtemisIsMyTurn(gameState) &&
              String(gameState.phase || "") === "deploy"));
        if (artemisClientFinish) {
          window.risqueArtemisDeployPushLocked = true;
          window.risqueArtemisAwaitSetupDeployFinish = true;
          window.risqueDeploy1Active = false;
          if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
            window.risqueTeardownArtemisSetupDeploy(true);
          }
          var finishSent =
            typeof window.risqueArtemisSendSetupDeployFinish === "function" &&
            window.risqueArtemisSendSetupDeployFinish({
              gameState: gameState,
              player: player
            });
          if (!finishSent) {
            window.risqueArtemisDeployPushLocked = false;
            window.risqueArtemisAwaitSetupDeployFinish = false;
            window.risqueDeploy1Active = true;
            updateDeployVoice("Could not send deployment finish to host — try CONFIRM again.");
            if (typeof window.risqueArtemisDiagDeployFinishReject === "function") {
              window.risqueArtemisDiagDeployFinishReject({
                slot: window.risqueArtemisPlayerSlot,
                controlSeq: Number(gameState.risqueArtemisControlSeq) || 0,
                reason: "finish_send_failed"
              });
            }
            return;
          }
          gameState.phase = "playerSelect";
          gameState.risquePublicUiSelectKind = "cardPlay";
          if (typeof window.risqueArtemisClientReleaseSetupDeployChrome === "function") {
            window.risqueArtemisClientReleaseSetupDeployChrome(gameState);
          } else if (typeof window.risqueArtemisRelinquishDeployControl === "function") {
            window.risqueArtemisRelinquishDeployControl(gameState);
          }
          window.risqueArtemisAwaitSetupDeployFinish = true;
          try {
            localStorage.setItem("gameState", JSON.stringify(gameState));
          } catch (eLsFin) {
            /* ignore */
          }
          return;
        }
        try {
          /* Next URL is playerSelect&selectKind=cardPlay â€” not cardplay yet; mirror/TV need phase playerSelect for name roulette. */
          gameState.phase = "playerSelect";
          gameState.risquePublicUiSelectKind = "cardPlay";
          clearDeployChromeThenRedraw();
          if (typeof window.risqueReplayRecordDeploy === "function") {
            window.risqueReplayRecordDeploy(gameState);
          }
          if (typeof window.risqueCheapReplayCapturePostSetupDeploy === "function") {
            try {
              window.risqueCheapReplayCapturePostSetupDeploy(gameState);
            } catch (eCheapPd) {
              /* ignore */
            }
          }
          if (typeof window.risqueReplayTryWriteDdJsonAfterSetupDeploy === "function") {
            window.risqueReplayTryWriteDdJsonAfterSetupDeploy(gameState, { sealAfterWrite: true });
          }
          if (typeof window.risqueReplayPersistTapeSidecarImmediate === "function") {
            try {
              window.risqueReplayPersistTapeSidecarImmediate(gameState);
            } catch (eSideDep) {
              /* ignore */
            }
          }
          if (typeof window.risquePersistHostGameState === "function") {
            window.risquePersistHostGameState(gameState);
          } else {
            persistGameStateLite(gameState);
          }
          if (window.gameUtils && typeof window.gameUtils.risqueLogDeckSnapshot === "function") {
            window.gameUtils.risqueLogDeckSnapshot(gameState, "post-setup-deploy");
          }
          if (uiOverlay) uiOverlay.classList.remove("fade-out");
          setTimeout(function () {
            if (typeof window.risqueSetMirrorDeployRoute === "function") {
              window.risqueSetMirrorDeployRoute(null);
            }
            window.risqueDeploy1Active = false;
            navigateGameHtmlPreferSoft("game.html?phase=playerSelect&selectKind=cardPlay");
          }, 0);
        } catch (e) {
          console.warn("[Deploy] Failed to save game state.");
        }
        return;
      }
      keyboardBuffer = "";
      negativeInput = false;
      window.selectedTerritory = null;
      window.viewTroopsActive = false;
      window.gameUtils.showError("");
      var artemisClientConfirmOnly =
        window.risqueArtemisMode &&
        window.risqueArtemisNetClient &&
        (window.risqueArtemisClientPlaying ||
          (typeof window.risqueArtemisIsMyTurn === "function" &&
            window.risqueArtemisIsMyTurn(gameState) &&
            String(gameState.phase || "") === "deploy"));
      var orderForHandoff =
        deploymentOrder.length > 0
          ? deploymentOrder.slice()
          : Array.isArray(gameState.turnOrder)
            ? gameState.turnOrder.slice()
            : [];
      var handoffFromIndex = orderForHandoff.indexOf(player.name);
      if (handoffFromIndex < 0) {
        handoffFromIndex = orderForHandoff.indexOf(gameState.currentPlayer);
      }
      var nextHandoffPlayer =
        orderForHandoff.length > 0
          ? orderForHandoff[(handoffFromIndex + 1) % orderForHandoff.length]
          : "";
      var nextHandoffSeq = (Number(gameState.risqueArtemisControlSeq) || 0) + 1;
      window.gameState = gameState;
      var persistOk = true;
      var useDeployConfirmBus =
        artemisClientConfirmOnly &&
        typeof window.risqueArtemisSendSetupDeployConfirm === "function";
      if (artemisClientConfirmOnly && !useDeployConfirmBus) {
        gameState.risqueArtemisSetupDeployConfirm = true;
        gameState.risqueArtemisSetupDeployNextPlayer = nextHandoffPlayer;
        gameState.risqueArtemisSetupDeployNextSeq = nextHandoffSeq;
        if (typeof window.risqueArtemisStampDeployMirrorDraftOnState === "function") {
          window.risqueArtemisStampDeployMirrorDraftOnState(gameState);
        }
      } else if (!artemisClientConfirmOnly) {
        var artemisFromControlSlot = 0;
        if (window.risqueArtemisMode) {
          artemisFromControlSlot = Number(gameState.artemisControlSlot) || 0;
          if (
            !artemisFromControlSlot &&
            typeof window.risqueArtemisActivePlayerSlot === "function"
          ) {
            artemisFromControlSlot = window.risqueArtemisActivePlayerSlot(gameState);
          }
          if (!artemisFromControlSlot) {
            artemisFromControlSlot = Number(window.risqueArtemisPlayerSlot) || 0;
          }
        }
        currentPlayerIndex = (currentPlayerIndex + 1) % deploymentOrder.length;
        gameState.currentPlayer = deploymentOrder[currentPlayerIndex];
        gameState.phase = "deploy";
        gameState.risqueMirrorDeployRoute = "setup";
        gameState.risqueArtemisControlSeq = nextHandoffSeq;
        var nextControlSlot = artemisStampControlSlotForCurrentPlayer(gameState);
        if (!nextControlSlot && typeof window.risqueArtemisStampControlSlot === "function") {
          window.risqueArtemisStampControlSlot(gameState);
          nextControlSlot = Number(gameState.artemisControlSlot) || 0;
        }
        delete gameState.risquePublicDeployBanner;
        delete gameState.risquePublicDeployReport;
        delete gameState.risqueDeployMirrorDraft;
        delete gameState.risqueDeployTransientPrimary;
        try {
          gameState.risquePublicDeployBanner =
            "WAITING FOR " + String(gameState.currentPlayer || "NEXT").toUpperCase() + " TO DEPLOY";
          gameState.risqueControlVoice = {
            primary: gameState.risquePublicDeployBanner,
            report: "",
            reportClass: "ucp-voice-report ucp-voice-report--public-deploy"
          };
        } catch (eHandBanner) {
          /* ignore */
        }
        if (window.risqueArtemisMode && artemisFromControlSlot >= 1) {
          gameState.artemisDeployTurnAdvance = {
            fromSlot: artemisFromControlSlot,
            toSlot: Number(gameState.artemisControlSlot) || nextControlSlot || 0,
            controlSeq: Number(gameState.risqueArtemisControlSeq) || 0
          };
        }
        if (gameState.risqueDeployTransientPrimary) {
          delete gameState.risqueDeployTransientPrimary;
        }
        if (window.risqueArtemisMode) {
          if (!deployedTroops[artemisNormName(gameState.currentPlayer)]) {
            deployedTroops[artemisNormName(gameState.currentPlayer)] = {};
          }
          window.deployedTroops = deployedTroops[artemisNormName(gameState.currentPlayer)];
          delete gameState.risqueDeploySuppressPublicSpectator;
          delete gameState.risqueDeployUseFrozenPublicMirror;
          delete gameState.risqueDeployPublicMirrorSnapshot;
          if (typeof window.risqueArtemisStampDeployMirrorDraftOnState === "function") {
            window.risqueArtemisStampDeployMirrorDraftOnState(gameState);
          }
        }
        nextHandoffPlayer = String(gameState.currentPlayer || "");
      }
      try {
        if (useDeployConfirmBus) {
          persistOk = window.risqueArtemisSendSetupDeployConfirm({
            gameState: gameState,
            player: player,
            nextPlayer: nextHandoffPlayer,
            nextSeq: nextHandoffSeq
          });
          try {
            localStorage.setItem("gameState", JSON.stringify(gameState));
          } catch (eLsConfirm) {
            /* ignore */
          }
        } else if (typeof window.risquePersistHostGameState === "function") {
          window.risquePersistHostGameState(gameState);
        } else {
          persistGameStateLite(gameState);
        }
      } catch (e2) {
        persistOk = false;
        console.warn("[Deploy] Failed to save game state.", e2);
      }
      if (artemisClientConfirmOnly && !persistOk) {
        if (typeof window.risqueArtemisDiagDeployReject === "function") {
          window.risqueArtemisDiagDeployReject({
            slot: window.risqueArtemisPlayerSlot,
            controlSeq: Number(gameState.risqueArtemisControlSeq) || 0,
            reason: "confirm_send_failed"
          });
        }
        delete gameState.risqueArtemisSetupDeployConfirm;
        delete gameState.risqueArtemisSetupDeployNextPlayer;
        delete gameState.risqueArtemisSetupDeployNextSeq;
        window.risqueArtemisDeployHandoffPending = 0;
        window.risqueArtemisDeployRelinquishedSeq = 0;
        delete window.risqueArtemisDeployHandoffPlayer;
        window.risqueArtemisDeployPushLocked = false;
        window.risqueDeploy1Active = true;
        if (confirmButton) confirmButton.disabled = false;
        if (resetButton) resetButton.disabled = false;
        updateDeployVoice("Could not send deployment to host — try CONFIRM again.");
        return;
      }
      if (artemisClientConfirmOnly) {
        delete gameState.risqueArtemisSetupDeployConfirm;
        delete gameState.risqueArtemisSetupDeployNextPlayer;
        delete gameState.risqueArtemisSetupDeployNextSeq;
        window.risqueArtemisDeployHandoffPending = nextHandoffSeq;
        window.risqueArtemisDeployHandoffPlayer = String(nextHandoffPlayer || "");
        window.risqueArtemisDeployRelinquishedSeq = Number(gameState.risqueArtemisControlSeq) || 0;
        window.risqueArtemisDeployPushLocked = true;
        window.risqueDeploy1Active = false;
        if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
          window.risqueTeardownArtemisSetupDeploy(true);
        }
        var finishDock = document.getElementById("risque-artemis-deploy-dock");
        if (finishDock) {
          finishDock.innerHTML = "";
          finishDock.hidden = true;
        }
        if (confirmButton) confirmButton.disabled = true;
        if (resetButton) resetButton.disabled = true;
        if (typeof window.risqueArtemisRelinquishDeployControl === "function") {
          window.risqueArtemisRelinquishDeployControl(gameState, { handoffPending: true });
        } else if (typeof window.risqueArtemisReplaceShellGameState === "function") {
          window.risqueArtemisReplaceShellGameState(gameState);
        }
        return;
      }
      if (window.risqueArtemisMode && !artemisClientConfirmOnly) {
        var handoffPlayer = deployEnsureActivePlayerSetupBank(gameState);
        try {
          console.info(
            "[ARTEMIS deploy] host handoff to",
            gameState.currentPlayer,
            "ctrl=" + String(gameState.artemisControlSlot),
            "seq=" + String(gameState.risqueArtemisControlSeq),
            "bank=" + (handoffPlayer ? handoffPlayer.bankValue : "?")
          );
        } catch (eHandLog) {
          /* ignore */
        }
      }
      if (window.risqueArtemisMode && typeof window.risqueTeardownArtemisSetupDeploy === "function") {
        window.risqueTeardownArtemisSetupDeploy(true);
      }
      if (
        window.risqueArtemisMode &&
        typeof window.risqueArtemisAfterSetupDeployTurnAdvance === "function"
      ) {
        try {
          window.risqueArtemisAfterSetupDeployTurnAdvance(gameState);
        } catch (eArtemisAdv) {
          /* ignore */
        }
        if (typeof window.risqueReplayRecordDeploy === "function") {
          window.risqueReplayRecordDeploy(gameState);
        }
        if (typeof window.risqueFlushMirrorPush === "function") {
          window.__risqueArtemisForceDeployMirrorPush = true;
          try {
            window.risqueFlushMirrorPush();
          } finally {
            window.__risqueArtemisForceDeployMirrorPush = false;
          }
        }
        return;
      }
      if (typeof window.risqueReplayRecordDeploy === "function") {
        window.risqueReplayRecordDeploy(gameState);
      }
      /* ARTEMIS: only the active laptop runs deploy UI â€” host/other clients spectate via mirror. */
      if (
        window.risqueArtemisMode &&
        typeof window.risqueArtemisCanLocalPlay === "function" &&
        !window.risqueArtemisCanLocalPlay()
      ) {
        try {
          if (typeof window.risquePersistHostGameState === "function") {
            window.risquePersistHostGameState(gameState);
          } else {
            persistGameStateLite(gameState);
          }
        } catch (eArtemisMir) {
          /* ignore */
        }
        return;
      }
      /* Handoff before the next deployer sees the map (streaming / hot-seat). */
      mountSetupDeployHandoff(gameState.currentPlayer, "next", function () {
        /* Redraw + mirror push BEFORE spectator focus: risqueSetSpectatorFocus pushes gameState and must see the new deployerâ€™s window.deployedTroops (not the previous playerâ€™s). */
        renderMap(null);
        if (typeof window.risqueSetSpectatorFocus === "function") {
          window.risqueSetSpectatorFocus([]);
        }
        updateBankDisplay();
        if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
          window.risqueRuntimeHud.updateTurnBannerFromState(gameState);
        }
        if (window.risqueRuntimeHud && window.risqueRuntimeHud.syncPosition) {
          requestAnimationFrame(function () {
            window.risqueRuntimeHud.syncPosition();
          });
        }
      }, logFn);
    });

    var deploy1Add2 = document.getElementById("deploy1-add-2");
    var deploy1Add5 = document.getElementById("deploy1-add-5");
    var deploy1Add10 = document.getElementById("deploy1-add-10");
    var deploy1AddAll = document.getElementById("deploy1-add-all");
    if (deploy1Add2) {
      deploy1Add2.addEventListener("click", function () {
        applyDeployFromBankSetup(2);
      });
    }
    if (deploy1Add5) {
      deploy1Add5.addEventListener("click", function () {
        applyDeployFromBankSetup(5);
      });
    }
    if (deploy1Add10) {
      deploy1Add10.addEventListener("click", function () {
        applyDeployFromBankSetup(10);
      });
    }
    if (deploy1AddAll) {
      deploy1AddAll.addEventListener("click", function () {
        applyBulkDeploySetup(0);
      });
    }
    var canvasWheel = document.getElementById("canvas");
    var svg = canvasWheel ? canvasWheel.querySelector(".svg-overlay") : null;
    if (svg) svg.addEventListener("wheel", onWheel, { passive: false });

    document.addEventListener("keydown", onKeyDown);

    if (window.risqueArtemisMode) {
      artemisSetupDeploySession = {
        svg: svg,
        onWheel: onWheel,
        onKeyDown: onKeyDown,
        refreshFromMirror: function (mirrorGs) {
          if (!mirrorGs || !deploymentInitialized) return false;
          if (
            window.risqueArtemisDeployPushLocked ||
            window.risqueArtemisDeployHandoffPending
          ) {
            return false;
          }
          if (
            typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
            window.risqueArtemisClientHasActiveDeploySession()
          ) {
            return false;
          }
          deployRepairAllSetupBanks(mirrorGs);
          gameState = mirrorGs;
          var activePlayer = deployResolveCurrentPlayer(gameState);
          deployLogBankStatus(gameState, "mirror-refresh");
          var selKeep = window.selectedTerritory;
          if (activePlayer) {
            var apk = artemisNormName(activePlayer.name);
            initialBankValues[apk] = Number(activePlayer.bankValue) || 0;
            if (!deployedTroops[apk]) {
              deployedTroops[apk] = {};
            }
            (activePlayer.territories || []).forEach(function (t) {
              deployedTroops[apk][t.name] = Math.max(0, (Number(t.troops) || 0) - 1);
            });
          }
          gameState.phase = "deploy";
          gameState.risqueMirrorDeployRoute = "setup";
          (gameState.players || []).forEach(function (player) {
            var pk = artemisNormName(player.name);
            if (initialBankValues[pk] === undefined || initialBankValues[pk] === 0) {
              initialBankValues[pk] = Number(player.bankValue) || 0;
            }
            if (!deployedTroops[pk]) {
              deployedTroops[pk] = {};
            }
            (player.territories || []).forEach(function (t) {
              if (deployedTroops[pk][t.name] === undefined) {
                deployedTroops[pk][t.name] = t.troops - 1;
              }
            });
          });
          window.gameState = gameState;
          updateBankDisplay();
          window.__risqueArtemisApplyingDeployMirror = true;
          try {
            renderMap(selKeep || null);
          } finally {
            window.__risqueArtemisApplyingDeployMirror = false;
          }
          if (
            window.risqueRuntimeHud &&
            typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function"
          ) {
            window.risqueRuntimeHud.updateTurnBannerFromState(gameState);
          }
          return true;
        }
      };
    }

    window.gameUtils.initGameView();
    initializeDeployment();
    requestAnimationFrame(function () {
      window.gameUtils.resizeCanvas();
    });
  }
  window.risquePhases = window.risquePhases || {};
  window.risquePhases.firstDeploy = { run: runFirstDeploy };
  window.risquePhases.deploy1 = window.risquePhases.firstDeploy;
})();
