/**
 * ARTEMIS — reinforce controls on the active laptop only (mirrors attack-panel m96 pattern).
 */
(function () {
  "use strict";
  if (!window.risqueArtemisMode) return;

  var reinforceMountedFor = "";
  var spectatorHintKey = "";

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
    if (ctrl >= 1 && ctrl <= (window.risqueArtemisMaxSlots || 6)) return ctrl;
    if (typeof window.risqueArtemisActivePlayerSlot === "function") {
      return Number(window.risqueArtemisActivePlayerSlot(gs)) || 0;
    }
    return 0;
  }

  function isMine(gs) {
    return typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs);
  }

  function reinforceControlsPresent() {
    var slot = document.getElementById("risque-phase-content");
    return !!(slot && slot.querySelector("#reinforce-btn-skip"));
  }

  function stripSetupHudClasses() {
    var hudRoot = document.getElementById("runtime-hud-root");
    if (!hudRoot) return;
    hudRoot.classList.remove("runtime-hud-root--setup");
    hudRoot.classList.remove("runtime-hud-root--artemis-cardplay");
    hudRoot.classList.remove("runtime-hud-root--cardplay-panel-only");
    hudRoot.classList.remove("runtime-hud-root--artemis-compact");
  }

  function stampReinforcePhaseChrome(gs) {
    try {
      document.body.setAttribute("data-risque-phase", "reinforce");
    } catch (ePh) {
      /* ignore */
    }
    if (gs) {
      window.gameState = gs;
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

  function ensureReinforceSpectatorHud(gs) {
    var uio = document.getElementById("ui-overlay");
    if (!uio || !window.risqueRuntimeHud) return;
    window.gameState = gs;
    var hudRoot = document.getElementById("runtime-hud-root");
    if (
      !hudRoot ||
      hudRoot.classList.contains("runtime-hud-root--setup") ||
      hudRoot.classList.contains("runtime-hud-root--login") ||
      !reinforceControlsPresent()
    ) {
      if (typeof window.risqueRuntimeHud.ensure === "function") {
        window.risqueRuntimeHud.ensure(uio);
      }
    }
    stripSetupHudClasses();
    if (typeof window.risqueRuntimeHud.setAttackChromeInteractive === "function") {
      window.risqueRuntimeHud.setAttackChromeInteractive(false);
    }
    wireOmniToggles(gs);
    requestAnimationFrame(function () {
      if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
        window.risqueRuntimeHud.syncPosition();
      }
    });
  }

  function clearReinforceControls() {
    reinforceMountedFor = "";
    spectatorHintKey = "";
    window.__risqueArtemisReinforceControlsLive = false;
    window.__risqueArtemisReinforceMountKey = "";
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    if (
      slot.querySelector(".reinforce-compact-root") ||
      slot.querySelector(".risque-artemis-reinforce-spectate")
    ) {
      slot.innerHTML = "";
    }
    if (document.body) {
      document.body.removeAttribute("data-risque-reinforce-slot-mode");
    }
  }

  function mountSpectatorHint(gs) {
    ensureReinforceSpectatorHud(gs);
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    var name = gs && gs.currentPlayer ? String(gs.currentPlayer) : "?";
    var ctrl = ownerSlot(gs);
    var hintKey = ctrl + ":" + normName(name);
    if (hintKey === spectatorHintKey && slot.querySelector(".risque-artemis-reinforce-spectate")) {
      return;
    }
    spectatorHintKey = hintKey;
    var p = (gs.players || []).find(function (pl) {
      return normName(pl && pl.name) === normName(name);
    });
    var color =
      p && window.gameUtils && window.gameUtils.colorMap
        ? window.gameUtils.colorMap[p.color] || "#ffffff"
        : "#ffffff";
    slot.innerHTML =
      '<div class="risque-artemis-reinforce-spectate risque-artemis-deploy-spectate" role="status">' +
      "<p>Waiting for <strong style=\"color:" +
      color +
      '">' +
      name.toUpperCase() +
      "</strong></p>" +
      "<p>Only their laptop has reinforcement controls for this turn.</p></div>";
    if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
      window.risquePublicApplyVoiceAndLogMirror(gs);
    } else if (
      window.risqueRuntimeHud &&
      typeof window.risqueRuntimeHud.setControlVoiceText === "function"
    ) {
      window.risqueRuntimeHud.setControlVoiceText(
        "WAITING FOR " + name.toUpperCase() + " — REINFORCEMENT",
        ""
      );
    }
  }

  function clearHostSpectatorMapRedrawSuppress() {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient) return;
    try {
      delete window.__risqueSuppressHostMapRedraw;
    } catch (eSup) {
      /* ignore */
    }
  }

  function reinforceSpectatorControlVoiceText(gs) {
    if (!gs) return "";
    var name = gs.currentPlayer ? String(gs.currentPlayer).toUpperCase() : "NEXT";
    return name + " — REINFORCE";
  }
  window.risqueReinforceSpectatorControlVoiceText = reinforceSpectatorControlVoiceText;

  function paintHostReinforceSpectatorMap(gs) {
    if (!gs || !window.gameUtils) return;
    clearHostSpectatorMapRedrawSuppress();
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

  /** Host map + HUD: live reinforce from client player_state (mirrors deploy/attack spectator pattern). */
  window.risqueArtemisApplyHostReinforceSpectator = function (gs) {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient || !gs) return;
    if (String(gs.phase || "") !== "reinforce") return;
    if (
      typeof window.risqueArtemisShouldHostMountReinforce === "function" &&
      window.risqueArtemisShouldHostMountReinforce(gs)
    ) {
      return;
    }
    clearReinforceControls();
    stampReinforcePhaseChrome(gs);
    window.gameState = gs;
    if (typeof window.risqueArtemisEnsureOmniClientHud === "function") {
      window.risqueArtemisEnsureOmniClientHud(gs);
    }
    if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
      window.risqueArtemisEnsureHudTogglesVisible();
    }
    paintHostReinforceSpectatorMap(gs);
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
      try {
        window.risqueRuntimeHud.updateTurnBannerFromState(gs);
      } catch (eBanner) {
        /* ignore */
      }
    }
    if (typeof window.risqueSyncMapRoundIndicatorFromState === "function") {
      window.risqueSyncMapRoundIndicatorFromState(gs);
    }
    mountSpectatorHint(gs);
  };

  function mountRealReinforce(gs) {
    if (!gs || !window.risquePhases || !window.risquePhases.reinforce) return;
    if (window.__risqueArtemisReinforceMountInProgress) return;
    var up = normName(gs.currentPlayer);
    var ctrl = ownerSlot(gs);
    var mountKey = String(ctrl) + ":" + up;
    if (reinforceMountedFor === mountKey && reinforceControlsPresent()) {
      stripSetupHudClasses();
      stampReinforcePhaseChrome(gs);
      if (typeof window.risqueArtemisEnsureReinforceInteractive === "function") {
        window.risqueArtemisEnsureReinforceInteractive(gs);
      }
      if (typeof window.risqueArtemisEnsureReinforceMapRouting === "function") {
        window.risqueArtemisEnsureReinforceMapRouting(gs);
      }
      return;
    }
    reinforceMountedFor = mountKey;
    stampReinforcePhaseChrome(gs);
    document.body.classList.add("risque-setup-fullstage");
    document.documentElement.classList.add("risque-view-host");
    document.body.classList.add("risque-view-host");
    document.documentElement.classList.remove("risque-view-public");
    document.body.classList.remove("risque-view-public");
    var stageHost = document.getElementById("stage-host") || document.body;
    if (typeof window.risquePhases.reinforce.mount !== "function") return;
    window.risquePhases.reinforce.mount(stageHost, {
      onLog: function (msg) {
        try {
          console.info("[ARTEMIS reinforce]", msg);
        } catch (eLog) {
          /* ignore */
        }
      }
    });
    stripSetupHudClasses();
    if (!reinforceControlsPresent()) {
      reinforceMountedFor = "";
      window.risquePhases.reinforce.mount(stageHost, {
        onLog: function (msg) {
          try {
            console.info("[ARTEMIS reinforce retry]", msg);
          } catch (eLog2) {
            /* ignore */
          }
        }
      });
    }
    if (typeof window.risqueArtemisEnsureReinforceInteractive === "function") {
      window.risqueArtemisEnsureReinforceInteractive(gs);
    }
    wireOmniToggles(gs);
    window.__risqueArtemisReinforceControlsLive = reinforceControlsPresent();
  }

  function teardownPortablePhases() {
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
    if (typeof window.risqueArtemisUnmountPortableAttack === "function") {
      window.risqueArtemisUnmountPortableAttack();
    }
  }

  window.risqueArtemisSyncPortableReinforce = function (gs) {
    if (gs && gs.artemisCycleProbe) return;
    var ph = gs ? String(gs.phase || "") : "";
    if (ph !== "reinforce") {
      clearReinforceControls();
      if (window.risqueArtemisNetClient) exitClientPlayMode();
      return;
    }

    teardownPortablePhases();
    stampReinforcePhaseChrome(gs);

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
      typeof window.risqueArtemisShouldHostMountReinforce === "function" &&
      !window.risqueArtemisShouldHostMountReinforce(gs)
    ) {
      mine = false;
    }

    if (!mine) {
      clearReinforceControls();
      if (window.risqueArtemisHost && !window.risqueArtemisNetClient) {
        if (typeof window.risqueArtemisApplyHostReinforceSpectator === "function") {
          window.risqueArtemisApplyHostReinforceSpectator(gs);
        }
        return;
      }
      if (window.risqueArtemisNetClient) {
        exitClientPlayMode();
      }
      mountSpectatorHint(gs);
      return;
    }

    if (window.risqueArtemisNetClient) {
      enterClientPlayMode();
      if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
        window.risqueArtemisEnsureClientActivePlay(gs);
      }
    }

    mountRealReinforce(gs);
    if (typeof window.risqueArtemisEnsureReinforceMapRouting === "function") {
      window.risqueArtemisEnsureReinforceMapRouting(gs);
    }
  };

  window.risqueArtemisUnmountPortableReinforce = function () {
    clearReinforceControls();
    if (window.risqueArtemisNetClient) exitClientPlayMode();
  };
})();
