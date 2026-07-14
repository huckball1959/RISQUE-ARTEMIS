/**
 * ARTEMIS turn/income deploy — controls on the active player's laptop only.
 */
(function () {
  "use strict";

  if (!window.risqueArtemisMode) return;

  var turnMountedFor = "";
  var spectatorHintKey = "";
  var turnDeployWatchdogTimer = null;
  var turnDeployWatchdogKey = "";

  function normName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function myLocalSlot() {
    if (window.risqueArtemisHost) return 1;
    if (typeof window.risqueArtemisEnsureClientSlot === "function") {
      window.risqueArtemisEnsureClientSlot();
    }
    return Number(window.risqueArtemisPlayerSlot) || 0;
  }

  function ownerSlot(gs) {
    if (!gs) return 0;
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      return Number(window.risqueArtemisResolveOwnerSlot(gs)) || 0;
    }
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (ctrl >= 1 && ctrl <= (window.risqueArtemisMaxSlots || 6)) return ctrl;
    if (typeof window.risqueArtemisActivePlayerSlot === "function") {
      return Number(window.risqueArtemisActivePlayerSlot(gs)) || 0;
    }
    return 0;
  }

  function isMine(gs) {
    if (!gs) return false;
    if (
      typeof window.risqueArtemisLocalOwnsTurnDeploy === "function" &&
      window.risqueArtemisLocalOwnsTurnDeploy(gs)
    ) {
      return true;
    }
    if (typeof window.risqueArtemisPanelIsMine === "function") {
      return window.risqueArtemisPanelIsMine(gs, ownerSlot(gs));
    }
    var local = myLocalSlot();
    if (!local) return false;
    var owner = ownerSlot(gs);
    if (owner >= 1 && owner <= (window.risqueArtemisMaxSlots || 6)) {
      return owner === local;
    }
    if (typeof window.risqueArtemisIsMyTurn === "function") {
      return window.risqueArtemisIsMyTurn(gs);
    }
    return false;
  }

  function turnControlsPresent() {
    if (!document.getElementById("confirm")) return false;
    if (window.risqueArtemisMode) return true;
    return !!document.getElementById("bank-number");
  }

  function stopTurnDeployWatchdog() {
    if (turnDeployWatchdogTimer) {
      clearTimeout(turnDeployWatchdogTimer);
      turnDeployWatchdogTimer = null;
    }
    turnDeployWatchdogKey = "";
  }

  function startTurnDeployWatchdog(gs) {
    if (!gs || String(gs.phase || "") !== "deploy") {
      stopTurnDeployWatchdog();
      return;
    }
    if (
      typeof window.risqueArtemisIsSetupDeploy === "function" &&
      window.risqueArtemisIsSetupDeploy(gs)
    ) {
      stopTurnDeployWatchdog();
      return;
    }
    if (!isMine(gs)) {
      stopTurnDeployWatchdog();
      return;
    }
    var key = ownerSlot(gs) + ":" + normName(gs.currentPlayer);
    if (turnDeployWatchdogKey === key && turnDeployWatchdogTimer) return;
    turnDeployWatchdogKey = key;
    if (turnDeployWatchdogTimer) {
      clearTimeout(turnDeployWatchdogTimer);
    }
    turnDeployWatchdogTimer = setTimeout(function () {
      turnDeployWatchdogTimer = null;
      if (typeof window.risqueArtemisEnsureTurnDeployInteractive === "function") {
        window.risqueArtemisEnsureTurnDeployInteractive(window.gameState || gs);
      }
    }, 2500);
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
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(window.gameState);
    }
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

  function teardownTurnUI() {
    turnMountedFor = "";
    if (typeof window.risqueArtemisClearTurnDeployMountSession === "function") {
      window.risqueArtemisClearTurnDeployMountSession();
    }
    if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
      window.risqueTeardownArtemisSetupDeploy(true);
    }
    var slot = document.getElementById("risque-phase-content");
    if (slot) slot.innerHTML = "";
  }

  function clearTurnDeploySpectatorHint() {
    var slot = document.getElementById("risque-phase-content");
    if (slot && slot.querySelector(".risque-artemis-turn-deploy-spectate")) {
      slot.innerHTML = "";
    }
    spectatorHintKey = "";
  }

  function mountSpectatorHint(gs) {
    /* ARTEMIS: control voice already says who is deploying — no duplicate hint under CV (host Guido). */
    if (window.risqueArtemisMode) {
      clearTurnDeploySpectatorHint();
      return;
    }
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    var name = gs && gs.currentPlayer ? String(gs.currentPlayer) : "?";
    var ctrl = ownerSlot(gs);
    var hintKey = "turn:" + ctrl + ":" + normName(name);
    if (hintKey === spectatorHintKey && slot.querySelector(".risque-artemis-turn-deploy-spectate")) {
      return;
    }
    spectatorHintKey = hintKey;
    slot.innerHTML =
      '<div class="risque-artemis-turn-deploy-spectate risque-artemis-deploy-spectate" role="status">' +
      "<p>Waiting for <strong>" +
      name.toUpperCase() +
      "</strong> to deploy income troops.</p></div>";
  }

  window.risqueArtemisClearTurnDeploySpectatorHint = clearTurnDeploySpectatorHint;

  function mountRealTurnDeploy(gs) {
    if (!gs || !window.risquePhases || !window.risquePhases.deploy) return;
    if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
      window.risqueTeardownArtemisSetupDeploy(true);
    }
    if (typeof window.risqueArtemisUnmountPortableDeploy === "function") {
      window.risqueArtemisUnmountPortableDeploy();
    }
    window.risqueDeploy1Active = false;
    if (typeof window.risqueArtemisClearTurnDeployMountSession === "function") {
      window.risqueArtemisClearTurnDeployMountSession();
    }
    var up = normName(gs.currentPlayer);
    var ctrl = ownerSlot(gs);
    var mountKey = String(ctrl) + ":" + up;
    if (turnMountedFor === mountKey && turnControlsPresent()) {
      return;
    }
    turnMountedFor = mountKey;
    spectatorHintKey = "";
    if (typeof window.risqueSetMirrorDeployRoute === "function") {
      window.risqueSetMirrorDeployRoute("turn");
    }
    gs.risqueMirrorDeployRoute = "turn";
    window.gameState = gs;

    var stageHost = document.getElementById("stage-host") || document.body;
    if (typeof window.risqueArtemisMountTurnDeployControls === "function") {
      window.risqueArtemisMountTurnDeployControls(gs);
    } else if (typeof window.risquePhases.deploy.runTurn === "function") {
      window.risquePhases.deploy.runTurn(stageHost, {
        onLog: function (msg, data) {
          try {
            console.info("[ARTEMIS turn deploy]", msg, data || "");
          } catch (eLog) {
            /* ignore */
          }
        }
      });
    }
    if (!turnControlsPresent()) {
      turnMountedFor = "";
      if (typeof window.risqueArtemisMountTurnDeployControls === "function") {
        window.risqueArtemisMountTurnDeployControls(gs);
      } else if (typeof window.risquePhases.deploy.runTurn === "function") {
        window.risquePhases.deploy.runTurn(stageHost, {
          onLog: function (msg) {
            try {
              console.info("[ARTEMIS turn deploy retry]", msg);
            } catch (eLog2) {
              /* ignore */
            }
          }
        });
      }
      if (typeof window.risqueArtemisDiag === "function" && !turnControlsPresent()) {
        window.risqueArtemisDiag("turn_deploy_controls_missing", "P" + myLocalSlot() + " turn deploy", {
          currentPlayer: gs.currentPlayer,
          controlSlot: gs.artemisControlSlot,
          route: gs.risqueMirrorDeployRoute
        });
      }
    }
  }

  window.risqueArtemisSyncPortableTurnDeploy = function (gs) {
    if (gs && gs.artemisCycleProbe) return;
    if (!gs || String(gs.phase || "") !== "deploy") {
      stopTurnDeployWatchdog();
      teardownTurnUI();
      spectatorHintKey = "";
      if (window.risqueArtemisNetClient) exitClientPlayMode();
      return;
    }

    if (
      typeof window.risqueArtemisIsSetupDeploy === "function" &&
      window.risqueArtemisIsSetupDeploy(gs)
    ) {
      return;
    }

    if (typeof window.risqueArtemisClearStaleTurnDeployHandoffLocks === "function") {
      window.risqueArtemisClearStaleTurnDeployHandoffLocks(gs);
    }
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }
    if (typeof window.risqueArtemisClearTurnDeployHandoffFlags === "function") {
      window.risqueArtemisClearTurnDeployHandoffFlags(gs);
    }
    var activeTurnDeploySession =
      typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
      window.risqueArtemisClientHasActiveDeploySession();
    if (
      activeTurnDeploySession &&
      typeof window.risqueArtemisStampDeployHandoffSyncMarkers === "function"
    ) {
      window.risqueArtemisStampDeployHandoffSyncMarkers(gs);
    }
    if (
      !activeTurnDeploySession &&
      typeof window.risqueArtemisDeployTurnSessionNeedsReset === "function" &&
      window.risqueArtemisDeployTurnSessionNeedsReset(gs) &&
      typeof window.risqueArtemisResetDeployTurnSession === "function"
    ) {
      window.risqueArtemisResetDeployTurnSession(gs);
    }

    if (typeof window.risqueSetMirrorDeployRoute === "function") {
      window.risqueSetMirrorDeployRoute("turn");
    }
    gs.risqueMirrorDeployRoute = "turn";

    var mine = isMine(gs);
    if (!mine) {
      if (turnControlsPresent()) {
        teardownTurnUI();
      }
      if (window.risqueArtemisNetClient) {
        exitClientPlayMode();
      }
      window.gameState = gs;
      mountSpectatorHint(gs);
      if (typeof window.risqueArtemisApplyDeploySpectatorMap === "function") {
        window.risqueArtemisApplyDeploySpectatorMap(gs);
      } else if (typeof window.risqueArtemisRefreshDeploySpectator === "function") {
        window.risqueArtemisRefreshDeploySpectator(gs);
      }
      if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
        window.risqueArtemisEnsureHudTogglesVisible();
      }
      if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
        window.risqueWireArtemisHudTogglesOnce();
      }
      return;
    }

    if (
      window.risqueArtemisNetClient &&
      typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
      window.risqueArtemisClientHasActiveDeploySession() &&
      turnControlsPresent()
    ) {
      enterClientPlayMode();
      if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
        window.risqueArtemisSyncMyTurnClass(gs);
      }
      if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
        window.risqueArtemisReconcileClientPlayMode(gs);
      }
      if (typeof window.risqueArtemisStampDeployHandoffSyncMarkers === "function") {
        window.risqueArtemisStampDeployHandoffSyncMarkers(gs);
      }
      startTurnDeployWatchdog(gs);
      return;
    }

    if (
      window.risqueArtemisHost &&
      !window.risqueArtemisNetClient &&
      typeof window.risqueArtemisHostTurnDeployLocalOwnsLiveState === "function" &&
      window.risqueArtemisHostTurnDeployLocalOwnsLiveState(gs)
    ) {
      if (typeof window.risqueArtemisStampDeployHandoffSyncMarkers === "function") {
        window.risqueArtemisStampDeployHandoffSyncMarkers(gs);
      }
      startTurnDeployWatchdog(window.gameState || gs);
      return;
    }

    window.gameState = gs;
    if (window.risqueArtemisNetClient) {
      enterClientPlayMode();
    }
    mountRealTurnDeploy(gs);
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
    if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
      window.risqueArtemisReconcileClientPlayMode(gs);
    }
    if (typeof window.risqueArtemisStampDeployHandoffSyncMarkers === "function") {
      window.risqueArtemisStampDeployHandoffSyncMarkers(gs);
    }
    startTurnDeployWatchdog(gs);
  };

  window.risqueArtemisEnsureTurnDeployInteractive = function (gsOpt) {
    if (window.__risqueArtemisTurnDeployInteractiveDepth) return;
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || gs.artemisCycleProbe) return;
    if (String(gs.phase || "") !== "deploy") return;
    if (
      typeof window.risqueArtemisIsSetupDeploy === "function" &&
      window.risqueArtemisIsSetupDeploy(gs)
    ) {
      return;
    }
    window.__risqueArtemisTurnDeployInteractiveDepth = true;
    try {
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (!isMine(gs)) return;
    if (
      window.risqueArtemisHost &&
      !window.risqueArtemisNetClient &&
      typeof window.risqueArtemisHostTurnDeployLocalOwnsLiveState === "function" &&
      window.risqueArtemisHostTurnDeployLocalOwnsLiveState(gs)
    ) {
      if (typeof window.risqueArtemisStampDeployHandoffSyncMarkers === "function") {
        window.risqueArtemisStampDeployHandoffSyncMarkers(gs);
      }
      startTurnDeployWatchdog(window.gameState || gs);
      return;
    }
    window.gameState = gs;
    if (window.risqueArtemisNetClient) {
      enterClientPlayMode();
    }
    if (turnControlsPresent()) {
      if (typeof window.risqueArtemisStampDeployHandoffSyncMarkers === "function") {
        window.risqueArtemisStampDeployHandoffSyncMarkers(gs);
      }
      startTurnDeployWatchdog(gs);
      return;
    }
    turnMountedFor = "";
    mountRealTurnDeploy(gs);
    if (typeof window.risqueArtemisDiag === "function" && !turnControlsPresent()) {
      window.risqueArtemisDiag("turn_deploy_controls_missing", "P" + myLocalSlot() + " watchdog remount failed", {
        currentPlayer: gs.currentPlayer,
        controlSlot: gs.artemisControlSlot,
        route: gs.risqueMirrorDeployRoute
      });
    }
    startTurnDeployWatchdog(gs);
    } finally {
      window.__risqueArtemisTurnDeployInteractiveDepth = false;
    }
  };

  window.risqueArtemisUnmountPortableTurnDeploy = function () {
    stopTurnDeployWatchdog();
    teardownTurnUI();
    spectatorHintKey = "";
    if (window.risqueArtemisNetClient) {
      exitClientPlayMode();
    }
  };
})();
