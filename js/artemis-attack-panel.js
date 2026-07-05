/**
 * ARTEMIS attack — full mount on the active laptop only; spectators keep attack HUD (mirror voice/map).
 */
(function () {
  "use strict";

  if (!window.risqueArtemisMode) return;

  var attackMountedFor = "";

  function normName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function ownerSlot(gs) {
    if (!gs) return 0;
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      return Number(window.risqueArtemisResolveOwnerSlot(gs)) || 0;
    }
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (ctrl >= 1 && ctrl <= 3) return ctrl;
    if (typeof window.risqueArtemisActivePlayerSlot === "function") {
      return Number(window.risqueArtemisActivePlayerSlot(gs)) || 0;
    }
    return 0;
  }

  function isMine(gs) {
    return typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs);
  }

  function attackChromePresent() {
    return !!document.getElementById("attack-toolbar-strip");
  }

  /** True only when attack toolbar exists, ROLL is wired, and initAttackPhase has run. */
  function attackControlsReady() {
    if (!attackChromePresent()) return false;
    if (!document.getElementById("roll")) return false;
    if (!document.getElementById("control-voice")) return false;
    var hudRoot = document.getElementById("runtime-hud-root");
    if (hudRoot && hudRoot.classList.contains("runtime-hud-root--login")) return false;
    return !!window.__risqueAttackInitialized;
  }

  function ensureAttackStageVisible() {
    document.body.classList.add("risque-setup-fullstage");
    if (typeof window.risqueRestoreHostMapCanvasFromPhaseArtifacts === "function") {
      window.risqueRestoreHostMapCanvasFromPhaseArtifacts();
    }
    if (window.gameUtils && typeof window.gameUtils.resizeCanvas === "function") {
      try {
        window.gameUtils.resizeCanvas();
      } catch (eResize) {
        /* ignore */
      }
    }
  }

  function ensureAttackHudShell(uio) {
    if (!uio || !window.risqueRuntimeHud) return;
    var incomplete =
      !document.getElementById("control-voice") ||
      !document.getElementById("hud-main-panel") ||
      !document.getElementById("hud-attack-chrome");
    if (incomplete && typeof window.risqueRuntimeHud.ensure === "function") {
      window.risqueRuntimeHud.ensure(uio);
    }
  }

  function finishAttackMountInit(gs) {
    if (
      typeof window.risqueArtemisShouldAttackChromeBeInteractive === "function" &&
      !window.risqueArtemisShouldAttackChromeBeInteractive(gs)
    ) {
      return;
    }
    if (!window.__risqueAttackInitialized && typeof window.initAttackPhase === "function") {
      if (document.getElementById("roll")) {
        window.__risqueAttackMountEpoch = (window.__risqueAttackMountEpoch || 0) + 1;
        try {
          window.initAttackPhase(window.__risqueAttackMountEpoch);
        } catch (eInit) {
          /* ignore */
        }
      }
    }
    if (attackControlsReady()) {
      refreshActiveAttackClient(gs);
    }
  }

  function attackMountKey(gs) {
    if (!gs) return "";
    return String(ownerSlot(gs)) + ":" + normName(gs.currentPlayer);
  }

  function refreshActiveAttackClient(gs) {
    stripSetupHudClasses();
    if (
      window.risqueRuntimeHud &&
      typeof window.risqueRuntimeHud.setAttackChromeInteractive === "function" &&
      (!window.risqueArtemisMode ||
        typeof window.risqueArtemisShouldAttackChromeBeInteractive !== "function" ||
        window.risqueArtemisShouldAttackChromeBeInteractive(gs))
    ) {
      window.risqueRuntimeHud.setAttackChromeInteractive(true);
    }
    wireOmniToggles(gs);
    if (typeof window.risqueArtemisScheduleAttackMapRouting === "function") {
      window.risqueArtemisScheduleAttackMapRouting(gs);
    } else if (typeof window.risqueArtemisEnsureAttackMapRouting === "function") {
      window.risqueArtemisEnsureAttackMapRouting(gs);
    }
  }

  function enterClientPlayMode() {
    if (!window.risqueArtemisNetClient) return;
    window.risqueArtemisClientPlaying = true;
    window.risqueDisplayIsPublic = false;
    window.risqueDisplayMode = "host";
    document.documentElement.classList.remove("risque-view-public");
    document.documentElement.classList.add("risque-view-host");
    document.body.classList.remove("risque-view-public");
    document.body.classList.add("risque-view-host");
  }

  function exitClientPlayMode() {
    if (!window.risqueArtemisNetClient) return;
    window.risqueArtemisClientPlaying = false;
    window.risqueDisplayIsPublic = true;
    window.risqueDisplayMode = "public";
    document.documentElement.classList.remove("risque-view-host");
    document.documentElement.classList.add("risque-view-public");
    document.body.classList.remove("risque-view-host");
    document.body.classList.add("risque-view-public");
  }

  function stripSetupHudClasses() {
    var hudRoot = document.getElementById("runtime-hud-root");
    if (!hudRoot) return;
    hudRoot.classList.remove("runtime-hud-root--setup");
    hudRoot.classList.remove("runtime-hud-root--artemis-cardplay");
    hudRoot.classList.remove("runtime-hud-root--cardplay-panel-only");
    hudRoot.classList.remove("runtime-hud-root--receivecard-panel-only");
    hudRoot.classList.remove("runtime-hud-root--artemis-compact");
  }

  /** True when HUD must be rebuilt — never rebuild just because setup class is present. */
  function attackSpectatorHudNeedsRebuild(hudRoot) {
    if (!hudRoot) return true;
    if (hudRoot.classList.contains("runtime-hud-root--login")) return true;
    if (!document.getElementById("control-voice")) return true;
    if (!document.getElementById("attacker-dice-text-0")) return true;
    return false;
  }

  /** Unhide dice + toolbar chrome (e.g. after income spectator teardown). */
  function restoreHostAttackChromeVisibility() {
    var atkChrome = document.getElementById("hud-attack-chrome");
    if (!atkChrome) return;
    atkChrome.removeAttribute("hidden");
    atkChrome.setAttribute("aria-hidden", "false");
    atkChrome.style.removeProperty("display");
  }
  window.risqueArtemisRestoreHostAttackChrome = restoreHostAttackChromeVisibility;

  /** Guido spectating client attack: full attack HUD column (not setup shell — that breaks campaign on host turn). */
  function ensureHostAttackSpectatorFullAttackHud() {
    stripSetupHudClasses();
    restoreHostAttackChromeVisibility();
  }

  /** Active host attack / campaign: strip spectator + setup shells so CV can grow (L1/L3 leave row). */
  window.risqueArtemisEnsureHostActiveAttackColumn = function () {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient) return;
    setHostAttackSpectatorBodyClass(false);
    stripSetupHudClasses();
    ensureHostAttackSpectatorFullAttackHud();
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
      window.risqueRuntimeHud.syncPosition();
    }
  };

  function wireOmniToggles(gs) {
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    }
    if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
      window.risqueArtemisEnsureHudTogglesVisible();
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
      window.risqueRuntimeHud.updateTurnBannerFromState(gs);
    }
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
  }

  function rebuildAttackSpectatorHud(uio) {
    if (!uio || !window.risqueRuntimeHud) return;
    if (typeof window.risqueRuntimeHud.ensure === "function") {
      window.risqueRuntimeHud.ensure(uio);
    } else if (typeof window.risqueRuntimeHud.ensureSetupUnifiedHud === "function") {
      window.risqueRuntimeHud.ensureSetupUnifiedHud(uio, "ATTACK", { force: true });
    }
  }

  function ensureHostAttackSpectatorChrome(gs) {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient || !gs) return;
    var uio = document.getElementById("ui-overlay");
    if (!uio || !window.risqueRuntimeHud) return;
    setHostAttackSpectatorBodyClass(true);
    var hudRoot = document.getElementById("runtime-hud-root");
    if (attackSpectatorHudNeedsRebuild(hudRoot)) {
      rebuildAttackSpectatorHud(uio);
    }
    ensureHostAttackSpectatorFullAttackHud();
    try {
      if (String(gs.phase || "") === "attack") {
        document.body.setAttribute("data-risque-phase", "attack");
      }
    } catch (ePh) {
      /* ignore */
    }
  }

  function stripHostAttackMapInteraction(gs) {
    if (typeof window.risqueArtemisCancelAttackMapRouting === "function") {
      window.risqueArtemisCancelAttackMapRouting();
    }
    if (typeof window.risqueTeardownAttackPhaseControlListeners === "function") {
      window.risqueTeardownAttackPhaseControlListeners();
    }
    window.handleTerritoryClick = function () {};
    if (window.gameUtils && gs) {
      try {
        if (typeof window.gameUtils.renderTerritories === "function") {
          window.gameUtils.renderTerritories(null, gs);
        }
      } catch (eClrMap) {
        /* ignore */
      }
    }
  }

  function clearHostAttackSpectatorDiceTimers() {
    if (hostAttackDiceRevealTimer) {
      clearTimeout(hostAttackDiceRevealTimer);
      hostAttackDiceRevealTimer = null;
    }
    if (hostAttackDicePaintTimer) {
      clearInterval(hostAttackDicePaintTimer);
      hostAttackDicePaintTimer = null;
    }
    clearHostAttackSpinGrace();
  }

  function resetHostAttackSpectatorDiceDom() {
    var i;
    for (i = 0; i < 3; i += 1) {
      var atkDie = document.getElementById("attacker-dice-" + i);
      var atkText = document.getElementById("attacker-dice-text-" + i);
      if (atkDie) {
        atkDie.classList.remove("dice-rolling", "active-attacker");
      }
      if (atkText) {
        atkText.classList.remove("dice-text-hidden", "dice-text-visible");
        atkText.textContent = "-";
      }
    }
    for (i = 0; i < 2; i += 1) {
      var defDie = document.getElementById("defender-dice-" + i);
      var defText = document.getElementById("defender-dice-text-" + i);
      if (defDie) {
        defDie.classList.remove("dice-rolling", "active-defender");
      }
      if (defText) {
        defText.classList.remove("dice-text-hidden", "dice-text-visible");
        defText.textContent = "-";
      }
    }
  }

  /** Drop attack-spectator dice when host leaves client attack (income/cardplay/deploy/…). */
  window.risqueArtemisTeardownHostAttackSpectator = function () {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient) return;
    setHostAttackSpectatorBodyClass(false);
    clearHostAttackSpectatorDiceTimers();
    resetHostAttackSpectatorDiceDom();
  };

  function setHostAttackSpectatorBodyClass(on) {
    try {
      if (on) {
        document.body.classList.add("risque-artemis-attack-spectator");
        document.body.setAttribute("data-risque-show-public-dice", "1");
      } else {
        document.body.classList.remove("risque-artemis-attack-spectator");
        document.body.removeAttribute("data-risque-show-public-dice");
      }
    } catch (eCls) {
      /* ignore */
    }
  }

  /** Host TV: strip wired attack controls — initAttackPhase listeners must not stay live on Guido. */
  window.risqueArtemisReassertHostAttackSpectator = function (gsOpt) {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient) return;
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || String(gs.phase || "") !== "attack") {
      setHostAttackSpectatorBodyClass(false);
      return;
    }
    if (
      typeof window.risqueArtemisShouldAttackChromeBeInteractive === "function" &&
      window.risqueArtemisShouldAttackChromeBeInteractive(gs)
    ) {
      setHostAttackSpectatorBodyClass(false);
      stripSetupHudClasses();
      return;
    }
    window.gameState = gs;
    setHostAttackSpectatorBodyClass(true);
    stripHostAttackMapInteraction(gs);
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setAttackChromeInteractive === "function") {
      window.risqueRuntimeHud.setAttackChromeInteractive(false);
    }
    var chrome = document.getElementById("hud-attack-chrome");
    if (chrome) {
      var buttons = chrome.querySelectorAll("button");
      for (var bi = 0; bi < buttons.length; bi += 1) {
        buttons[bi].disabled = true;
      }
      var cond = document.getElementById("cond-threshold");
      if (cond) cond.disabled = true;
    }
  };

  function paintHostAttackSpectatorMap(gs) {
    if (!gs || !window.gameUtils) return;
    /* Host never runs the transfer pulse ticker — stale pulse from client player_state freezes mid-hop counts (003/001). */
    try {
      delete gs.risqueTransferPulse;
    } catch (eClrPulse) {
      /* ignore */
    }
    try {
      if (typeof window.gameUtils.renderAll === "function") {
        window.gameUtils.renderAll(gs, null, {});
      } else if (typeof window.gameUtils.renderTerritories === "function") {
        window.gameUtils.renderTerritories(null, gs, {});
      }
    } catch (eMap) {
      /* ignore */
    }
    try {
      window.gameUtils.renderStats(gs);
    } catch (eStats) {
      /* ignore */
    }
  }

  /** Host (Guido) spectating a client attack: dice row + map + voice from attack_live / player_state. */
  var hostAttackDicePaintTimer = null;
  var hostAttackDiceRevealTimer = null;
  /** Match client singleRollRevealTimer (~500ms) in phases/attack.js */
  var HOST_ATTACK_DICE_SPIN_MS = 520;

  function clearHostAttackSpinGrace() {
    window.__risqueArtemisHostAttackSpinUntil = 0;
  }

  function hostIsAttackSpectator(gs) {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient || !gs) return false;
    if (String(gs.phase || "") !== "attack") return false;
    if (
      typeof window.risqueArtemisShouldHostMountAttack === "function" &&
      window.risqueArtemisShouldHostMountAttack(gs)
    ) {
      return false;
    }
    return true;
  }

  function hostAttackDiceFingerprint(m) {
    if (!m || typeof m !== "object") return "";
    if (m.spinning === true) {
      return "spin:" + String(m.attackerDiceUsed) + ":" + String(m.defenderDiceCount);
    }
    return "done:" + (m.attackerRolls || []).join(",") + "|" + (m.defenderRolls || []).join(",");
  }

  function markHostAttackSpinGrace(ms) {
    window.__risqueArtemisHostAttackSpinUntil =
      Date.now() + (Number(ms) || HOST_ATTACK_DICE_SPIN_MS);
  }

  function cloneGsDiceSpinOnly(gs) {
    var m = gs && gs.risqueLastDiceDisplay;
    if (!m) return gs;
    var out;
    try {
      out = JSON.parse(JSON.stringify(gs));
    } catch (eClone) {
      return gs;
    }
    out.risqueLastDiceDisplay = {
      spinning: true,
      attackerDiceUsed: m.attackerDiceUsed,
      defenderDiceCount: m.defenderDiceCount
    };
    return out;
  }

  function hostAttackDiceSpinActive(gs) {
    var m = gs && gs.risqueLastDiceDisplay;
    var spinUntil = Number(window.__risqueArtemisHostAttackSpinUntil) || 0;
    return !!(m && m.spinning === true) || spinUntil > Date.now();
  }

  function scheduleHostAttackDiceReveal(gsReveal) {
    if (hostAttackDiceRevealTimer) {
      clearTimeout(hostAttackDiceRevealTimer);
      hostAttackDiceRevealTimer = null;
    }
    hostAttackDiceRevealTimer = setTimeout(function () {
      hostAttackDiceRevealTimer = null;
      clearHostAttackSpinGrace();
      if (hostAttackDicePaintTimer) {
        clearInterval(hostAttackDicePaintTimer);
        hostAttackDicePaintTimer = null;
      }
      var live = gsReveal || window.gameState;
      if (live && typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
        window.risquePublicApplyDiceAndBattleReadout(live);
      }
      paintHostAttackSpectatorMap(live);
    }, HOST_ATTACK_DICE_SPIN_MS);
  }

  function scheduleHostAttackDicePaint(gs) {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient) return;
    if (hostAttackDicePaintTimer) {
      clearInterval(hostAttackDicePaintTimer);
      hostAttackDicePaintTimer = null;
    }
    function paintHostDiceOnce() {
      var live = window.gameState || gs;
      if (!live || String(live.phase || "") !== "attack") {
        if (hostAttackDicePaintTimer) {
          clearInterval(hostAttackDicePaintTimer);
          hostAttackDicePaintTimer = null;
        }
        return;
      }
      var paintGs = live;
      if (
        hostAttackDiceSpinActive(live) &&
        live.risqueLastDiceDisplay &&
        live.risqueLastDiceDisplay.spinning !== true
      ) {
        paintGs = cloneGsDiceSpinOnly(live);
      }
      if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
        window.risquePublicApplyDiceAndBattleReadout(paintGs);
      }
      if (!hostAttackDiceSpinActive(live)) {
        if (hostAttackDicePaintTimer) {
          clearInterval(hostAttackDicePaintTimer);
          hostAttackDicePaintTimer = null;
        }
      }
    }
    paintHostDiceOnce();
    if (hostAttackDiceSpinActive(gs || window.gameState)) {
      hostAttackDicePaintTimer = setInterval(paintHostDiceOnce, 80);
      setTimeout(function () {
        if (hostAttackDicePaintTimer) {
          clearInterval(hostAttackDicePaintTimer);
          hostAttackDicePaintTimer = null;
        }
        paintHostDiceOnce();
      }, HOST_ATTACK_DICE_SPIN_MS + 80);
    }
  }

  /** Ensure attack dice chrome is visible; short spin when mirror omits spinning:true. */
  function driveHostAttackDice(gs) {
    if (!hostIsAttackSpectator(gs)) return;
    ensureHostAttackSpectatorChrome(gs);
    if (typeof window.risqueArtemisReassertHostAttackSpectator === "function") {
      window.risqueArtemisReassertHostAttackSpectator(gs);
    }
    var hudRoot = document.getElementById("runtime-hud-root");
    if (attackSpectatorHudNeedsRebuild(hudRoot)) {
      var uio = document.getElementById("ui-overlay");
      rebuildAttackSpectatorHud(uio);
      ensureHostAttackSpectatorFullAttackHud();
    }
    var m = gs.risqueLastDiceDisplay;
    if (!m) {
      clearHostAttackSpinGrace();
      if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
        window.risquePublicApplyDiceAndBattleReadout(gs);
      }
      return;
    }
    var fp = hostAttackDiceFingerprint(m);
    var prev = window.__risqueArtemisHostDiceFp || "";
    if (m.spinning === true) {
      markHostAttackSpinGrace(HOST_ATTACK_DICE_SPIN_MS);
      window.__risqueArtemisHostDiceFp = fp;
      if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
        window.risquePublicApplyDiceAndBattleReadout(gs);
      }
      scheduleHostAttackDicePaint(gs);
      scheduleHostAttackDiceReveal(gs);
      return;
    }
    if (fp.indexOf("done:") === 0 && fp !== prev && m.attackerRolls) {
      markHostAttackSpinGrace(HOST_ATTACK_DICE_SPIN_MS);
      window.__risqueArtemisHostDiceFp = fp;
      var spinOnly = cloneGsDiceSpinOnly(gs);
      if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
        window.risquePublicApplyDiceAndBattleReadout(spinOnly);
      }
      scheduleHostAttackDicePaint(spinOnly);
      scheduleHostAttackDiceReveal(gs);
      return;
    }
    clearHostAttackSpinGrace();
    window.__risqueArtemisHostDiceFp = fp;
    if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
      window.risquePublicApplyDiceAndBattleReadout(gs);
    }
  }

  window.risqueArtemisScheduleHostAttackDicePaint = scheduleHostAttackDicePaint;
  window.risqueArtemisDriveHostAttackDice = driveHostAttackDice;

  window.risqueArtemisApplyHostAttackSpectator = function (gs) {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient || !gs) return;
    if (String(gs.phase || "") !== "attack") return;
    if (
      typeof window.risqueArtemisShouldHostMountAttack === "function" &&
      window.risqueArtemisShouldHostMountAttack(gs)
    ) {
      return;
    }
    window.gameState = gs;
    ensureHostAttackSpectatorChrome(gs);
    window.risqueArtemisReassertHostAttackSpectator(gs);
    ensureAttackSpectatorHud(gs);
    paintHostAttackSpectatorMap(gs);
    driveHostAttackDice(gs);
    if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
      window.risquePublicApplyVoiceAndLogMirror(gs);
    }
    requestAnimationFrame(function () {
      driveHostAttackDice(window.gameState || gs);
      if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
        window.risquePublicApplyVoiceAndLogMirror(window.gameState || gs);
      }
    });
  };

  function ensureAttackSpectatorHud(gs) {
    var uio = document.getElementById("ui-overlay");
    if (!uio || !window.risqueRuntimeHud) return;
    window.gameState = gs;
    var hostTv = window.risqueArtemisHost && !window.risqueArtemisNetClient;
    var hudRoot = document.getElementById("runtime-hud-root");
    if (attackSpectatorHudNeedsRebuild(hudRoot)) {
      rebuildAttackSpectatorHud(uio);
    }
    if (hostTv) {
      ensureHostAttackSpectatorFullAttackHud();
    } else {
      stripSetupHudClasses();
      restoreHostAttackChromeVisibility();
      var atkChrome = document.getElementById("hud-attack-chrome");
      if (atkChrome) {
        atkChrome.setAttribute("aria-hidden", "false");
      }
    }
    if (typeof window.risqueRuntimeHud.setAttackChromeInteractive === "function") {
      window.risqueRuntimeHud.setAttackChromeInteractive(false);
    }
    wireOmniToggles(gs);
    if (typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
      window.risqueRuntimeHud.updateTurnBannerFromState(gs);
    }
    if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
      window.risquePublicApplyVoiceAndLogMirror(gs);
    }
    driveHostAttackDice(gs);
    requestAnimationFrame(function () {
      driveHostAttackDice(window.gameState || gs);
      if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
        window.risqueRuntimeHud.syncPosition();
      }
    });
  }

  function mountRealAttack(gs) {
    if (!gs || !window.risquePhases || !window.risquePhases.attack) return;
    var up = normName(gs.currentPlayer);
    var ctrl = ownerSlot(gs);
    var mountKey = String(ctrl) + ":" + up;
    if (attackMountedFor === mountKey && attackControlsReady()) {
      setHostAttackSpectatorBodyClass(false);
      stripSetupHudClasses();
      if (typeof window.risqueRuntimeHud.setAttackChromeInteractive === "function") {
        window.risqueRuntimeHud.setAttackChromeInteractive(true);
      }
      wireOmniToggles(gs);
      if (typeof window.risqueArtemisScheduleAttackMapRouting === "function") {
        window.risqueArtemisScheduleAttackMapRouting(gs);
      }
      return;
    }
    attackMountedFor = mountKey;
    window.gameState = gs;
    setHostAttackSpectatorBodyClass(false);
    if (typeof window.risqueArtemisRestoreHostAttackChrome === "function") {
      window.risqueArtemisRestoreHostAttackChrome();
    }
    ensureAttackStageVisible();
    ensureAttackHudShell(document.getElementById("ui-overlay"));
    var stageHost = document.getElementById("stage-host") || document.body;
    if (typeof window.risquePhases.attack.mount === "function") {
      window.risquePhases.attack.mount(stageHost, {
        onLog: function (msg) {
          try {
            console.info("[ARTEMIS attack]", msg);
          } catch (eLog) {
            /* ignore */
          }
        }
      });
    }
    stripSetupHudClasses();
    if (!attackChromePresent()) {
      attackMountedFor = "";
      if (typeof window.risquePhases.attack.mount === "function") {
        window.risquePhases.attack.mount(stageHost, {
          onLog: function (msg) {
            try {
              console.info("[ARTEMIS attack retry]", msg);
            } catch (eLog2) {
              /* ignore */
            }
          }
        });
      }
    }
    wireOmniToggles(gs);
    finishAttackMountInit(gs);
  }

  function softNavigateAttack(gs) {
    var url = "game.html?phase=attack";
    if (typeof window.risqueArtemisAppendSessionParams === "function") {
      url = window.risqueArtemisAppendSessionParams(url);
    }
    if (typeof window.risqueNavigateGameHtmlSoft === "function") {
      window.risqueNavigateGameHtmlSoft(url);
      return;
    }
    mountRealAttack(gs);
  }

  window.risqueArtemisEnsureAttackInteractive = function (gsOpt) {
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || String(gs.phase || "") !== "attack") return;
    if (!isMine(gs)) return;
    if (
      window.risqueArtemisHost &&
      typeof window.risqueArtemisShouldHostMountAttack === "function" &&
      !window.risqueArtemisShouldHostMountAttack(gs)
    ) {
      return;
    }
    window.gameState = gs;
    if (window.risqueArtemisNetClient) {
      enterClientPlayMode();
      if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
        window.risqueArtemisEnsureClientActivePlay(gs);
      }
      if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
        window.risqueArtemisReconcileClientPlayMode(gs);
      }
    }
    if (!attackControlsReady()) {
      attackMountedFor = "";
      mountRealAttack(gs);
    } else {
      if (typeof window.risqueArtemisRestoreHostAttackChrome === "function") {
        window.risqueArtemisRestoreHostAttackChrome();
      }
      stripSetupHudClasses();
      if (
        window.risqueArtemisHost &&
        !window.risqueArtemisNetClient &&
        typeof window.risqueArtemisEnsureHostActiveAttackColumn === "function"
      ) {
        window.risqueArtemisEnsureHostActiveAttackColumn();
      }
      if (typeof window.risqueRuntimeHud.setAttackChromeInteractive === "function") {
        window.risqueRuntimeHud.setAttackChromeInteractive(true);
      }
      wireOmniToggles(gs);
    }
    if (typeof window.risqueArtemisScheduleAttackMapRouting === "function") {
      window.risqueArtemisScheduleAttackMapRouting(gs);
    } else if (typeof window.risqueArtemisEnsureAttackMapRouting === "function") {
      window.risqueArtemisEnsureAttackMapRouting(gs);
    }
  };

  window.risqueArtemisSyncPortableAttack = function (gs) {
    if (gs && gs.artemisCycleProbe) return;
    if (!gs || String(gs.phase || "") !== "attack") {
      attackMountedFor = "";
      return;
    }

    if (window.risqueArtemisNetClient && !window.risqueArtemisHost && window.risqueArtemisLobbyStarted) {
      if (typeof window.risqueArtemisHideLoginPanel === "function") {
        window.risqueArtemisHideLoginPanel();
      }
      try {
        document.documentElement.classList.remove("risque-artemis-login-active");
        document.documentElement.classList.remove("risque-artemis-login-confirmed");
        document.body.classList.remove("risque-public-login-active");
      } catch (eClrAtkLogin) {
        /* ignore */
      }
      var legLoginAtk = document.getElementById("risque-login-hud-root");
      if (legLoginAtk && legLoginAtk.parentNode) {
        legLoginAtk.parentNode.removeChild(legLoginAtk);
      }
    }

    try {
      document.body.setAttribute("data-risque-phase", "attack");
    } catch (ePh) {
      /* ignore */
    }

    if (typeof window.risqueArtemisTeardownMockPhases === "function") {
      window.risqueArtemisTeardownMockPhases();
    }
    if (typeof window.risqueArtemisUnmountPortableTurnDeploy === "function") {
      window.risqueArtemisUnmountPortableTurnDeploy();
    }
    if (typeof window.risqueArtemisUnmountPortableCardplay === "function") {
      window.risqueArtemisUnmountPortableCardplay();
    }
    if (typeof window.risqueArtemisUnmountPortableIncome === "function") {
      window.risqueArtemisUnmountPortableIncome();
    }

    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }
    if (typeof window.risqueArtemisClearMapPhaseHandoffFlags === "function") {
      window.risqueArtemisClearMapPhaseHandoffFlags(gs);
    }

    window.gameState = gs;
    var mine = isMine(gs);
    if (
      mine &&
      window.risqueArtemisHost &&
      typeof window.risqueArtemisShouldHostMountAttack === "function" &&
      !window.risqueArtemisShouldHostMountAttack(gs)
    ) {
      mine = false;
    }

    if (mine) {
      setHostAttackSpectatorBodyClass(false);
      if (window.risqueArtemisNetClient) {
        enterClientPlayMode();
        if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
          window.risqueArtemisEnsureClientActivePlay(gs);
        }
        if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
          window.risqueArtemisReconcileClientPlayMode(gs);
        }
      }
      var mountKey = attackMountKey(gs);
      if (mountKey && attackMountedFor === mountKey && attackControlsReady()) {
        refreshActiveAttackClient(gs);
        return;
      }
      attackMountedFor = "";
      mountRealAttack(gs);
      refreshActiveAttackClient(gs);
      return;
    }

    attackMountedFor = "";
    if (window.risqueArtemisNetClient) {
      exitClientPlayMode();
    }
    if (window.risqueArtemisHost && !window.risqueArtemisNetClient) {
      ensureHostAttackSpectatorChrome(gs);
    }
    paintHostAttackSpectatorMap(gs);
    if (typeof window.risqueArtemisReassertHostAttackSpectator === "function") {
      window.risqueArtemisReassertHostAttackSpectator(gs);
    } else if (
      window.risqueRuntimeHud &&
      typeof window.risqueRuntimeHud.setAttackChromeInteractive === "function"
    ) {
      window.risqueRuntimeHud.setAttackChromeInteractive(false);
    }
    ensureAttackSpectatorHud(gs);
    driveHostAttackDice(gs);
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
    if (typeof window.risqueArtemisSyncPhaseControlVoice === "function") {
      window.risqueArtemisSyncPhaseControlVoice(gs);
    }
  };

  window.risqueArtemisUnmountPortableAttack = function () {
    attackMountedFor = "";
  };
})();
