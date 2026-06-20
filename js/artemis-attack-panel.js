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
    hudRoot.classList.remove("runtime-hud-root--artemis-compact");
  }

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

  function ensureHostAttackSpectatorChrome(gs) {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient || !gs) return;
    var uio = document.getElementById("ui-overlay");
    if (!uio || !window.risqueRuntimeHud) return;
    stripSetupHudClasses();
    var hudRoot = document.getElementById("runtime-hud-root");
    if (
      !hudRoot ||
      hudRoot.classList.contains("runtime-hud-root--setup") ||
      hudRoot.classList.contains("runtime-hud-root--login") ||
      !document.getElementById("attacker-dice-text-0")
    ) {
      if (typeof window.risqueRuntimeHud.ensure === "function") {
        window.risqueRuntimeHud.ensure(uio);
      }
    }
    stripSetupHudClasses();
    hudRoot = document.getElementById("runtime-hud-root");
    if (hudRoot) {
      hudRoot.classList.remove("runtime-hud-root--artemis-compact");
    }
    try {
      document.body.setAttribute("data-risque-phase", "attack");
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
    if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
      window.risquePublicApplyDiceAndBattleReadout(gs);
    }
    if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
      window.risquePublicApplyVoiceAndLogMirror(gs);
    }
    requestAnimationFrame(function () {
      if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
        window.risquePublicApplyDiceAndBattleReadout(gs);
      }
      if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
        window.risquePublicApplyVoiceAndLogMirror(gs);
      }
    });
  };

  function ensureAttackSpectatorHud(gs) {
    var uio = document.getElementById("ui-overlay");
    if (!uio || !window.risqueRuntimeHud) return;
    window.gameState = gs;
    var hudRoot = document.getElementById("runtime-hud-root");
    if (
      !hudRoot ||
      hudRoot.classList.contains("runtime-hud-root--setup") ||
      hudRoot.classList.contains("runtime-hud-root--login") ||
      !attackChromePresent()
    ) {
      if (typeof window.risqueRuntimeHud.ensure === "function") {
        window.risqueRuntimeHud.ensure(uio);
      }
    }
    stripSetupHudClasses();
    var atkChrome = document.getElementById("hud-attack-chrome");
    if (atkChrome) {
      atkChrome.removeAttribute("hidden");
      atkChrome.setAttribute("aria-hidden", "false");
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
    if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
      window.risquePublicApplyDiceAndBattleReadout(gs);
    }
    requestAnimationFrame(function () {
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
    if (attackMountedFor === mountKey && attackChromePresent()) {
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
    document.body.classList.add("risque-setup-fullstage");
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
    if (!attackChromePresent()) {
      attackMountedFor = "";
      mountRealAttack(gs);
    } else {
      stripSetupHudClasses();
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
      if (mountKey && attackMountedFor === mountKey && attackChromePresent()) {
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
