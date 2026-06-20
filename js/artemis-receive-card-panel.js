/**
 * ARTEMIS — receive-card hand/staging UI on the active laptop only (reinforce-panel pattern).
 * Does not call risqueArtemisUnmountPortableReinforce — syncFromState handles phase exit.
 */
(function () {
  "use strict";
  if (!window.risqueArtemisMode) return;

  var receiveCardMountedFor = "";
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
    if (ctrl >= 1 && ctrl <= 3) return ctrl;
    if (typeof window.risqueArtemisActivePlayerSlot === "function") {
      return Number(window.risqueArtemisActivePlayerSlot(gs)) || 0;
    }
    return 0;
  }

  function isMine(gs) {
    return typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs);
  }

  function receiveCardControlsPresent() {
    var slot = document.getElementById("risque-phase-content");
    return !!(slot && slot.querySelector("#receivecard-btn-end"));
  }

  function stripSetupHudClasses() {
    var hudRoot = document.getElementById("runtime-hud-root");
    if (!hudRoot) return;
    hudRoot.classList.remove("runtime-hud-root--setup");
    hudRoot.classList.remove("runtime-hud-root--login");
    hudRoot.classList.remove("runtime-hud-root--artemis-cardplay");
    hudRoot.classList.remove("runtime-hud-root--cardplay-panel-only");
    hudRoot.classList.remove("runtime-hud-root--artemis-compact");
  }

  function stampReceiveCardPhaseChrome(gs) {
    try {
      document.body.setAttribute("data-risque-phase", "receivecard");
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

  function clearReceiveCardControls() {
    receiveCardMountedFor = "";
    spectatorHintKey = "";
    window.__risqueArtemisReceiveCardControlsLive = false;
    window.__risqueArtemisReceiveCardMountKey = "";
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    if (
      slot.querySelector(".receivecard-compact-root") ||
      slot.querySelector(".risque-artemis-receivecard-spectate")
    ) {
      slot.innerHTML = "";
    }
  }

  function receiveCardSpectatorMirrorKey(gs) {
    if (!gs) return "";
    var spec =
      gs.risquePublicReceiveCardSpectator &&
      typeof gs.risquePublicReceiveCardSpectator === "object"
        ? gs.risquePublicReceiveCardSpectator
        : {};
    var handN =
      spec.handBackCount != null && Number.isFinite(Number(spec.handBackCount))
        ? Math.max(0, Math.floor(Number(spec.handBackCount)))
        : typeof window.risquePublicSpectatorHandCountFromGs === "function"
          ? window.risquePublicSpectatorHandCountFromGs(gs)
          : 0;
    var stagingN = spec.showStaging === true ? Math.max(0, Number(spec.stagingBackCount) || 0) : 0;
    return (
      ownerSlot(gs) +
      ":" +
      normName(gs.currentPlayer) +
      ":" +
      handN +
      ":" +
      stagingN +
      ":" +
      (spec.showStaging ? "1" : "0") +
      ":" +
      (spec.stagingMerged ? "1" : "0") +
      ":" +
      (spec.mergeAnimSeq != null ? String(spec.mergeAnimSeq) : "") +
      ":" +
      (gs.cardAwardedThisTurn ? "1" : "0")
    );
  }

  function mountSpectatorHint(gs) {
    var uio = document.getElementById("ui-overlay");
    if (!uio || !window.risqueRuntimeHud) return;
    window.gameState = gs;
    var hudRoot = document.getElementById("runtime-hud-root");
    if (
      !hudRoot ||
      hudRoot.classList.contains("runtime-hud-root--setup") ||
      hudRoot.classList.contains("runtime-hud-root--login") ||
      !receiveCardControlsPresent()
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
    var mirrorKey = receiveCardSpectatorMirrorKey(gs);

    /* Spectators (public TV + host): card backs + voice from mirrored receive-card layout. */
    if (
      window.risqueDisplayIsPublic ||
      (window.risqueArtemisHost &&
        !window.risqueArtemisNetClient &&
        typeof window.risqueArtemisIsMyTurn === "function" &&
        !window.risqueArtemisIsMyTurn(gs))
    ) {
      if (typeof window.risquePublicEnsureReceiveCardPrivateHint === "function") {
        window.risquePublicEnsureReceiveCardPrivateHint(gs);
      }
      if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
        window.risquePublicApplyVoiceAndLogMirror(gs);
      }
      spectatorHintKey = mirrorKey;
      return;
    }

    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    var name = gs && gs.currentPlayer ? String(gs.currentPlayer) : "?";
    if (mirrorKey === spectatorHintKey && slot.querySelector(".risque-artemis-receivecard-spectate")) {
      return;
    }
    spectatorHintKey = mirrorKey;
    var p = (gs.players || []).find(function (pl) {
      return normName(pl && pl.name) === normName(name);
    });
    var color =
      p && window.gameUtils && window.gameUtils.colorMap
        ? window.gameUtils.colorMap[p.color] || "#ffffff"
        : "#ffffff";
    slot.innerHTML =
      '<div class="risque-artemis-receivecard-spectate risque-artemis-deploy-spectate" role="status">' +
      "<p>Waiting for <strong style=\"color:" +
      color +
      '">' +
      name.toUpperCase() +
      "</strong></p>" +
      "<p>Only their laptop shows the receive-card hand for this turn.</p></div>";
    if (
      window.risqueRuntimeHud &&
      typeof window.risqueRuntimeHud.setControlVoiceText === "function"
    ) {
      window.risqueRuntimeHud.setControlVoiceText(
        "WAITING FOR " + name.toUpperCase() + " — RECEIVE CARD",
        ""
      );
    }
  }

  /** Host map + HUD: live receive-card from client player_state (card backs, no faces). */
  window.risqueArtemisApplyHostReceiveCardSpectator = function (gs) {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient || !gs) return;
    if (String(gs.phase || "") !== "receivecard" && String(gs.phase || "") !== "getcard") return;
    if (
      typeof window.risqueArtemisIsMyTurn === "function" &&
      window.risqueArtemisIsMyTurn(gs)
    ) {
      return;
    }
    clearReceiveCardControls();
    stampReceiveCardPhaseChrome(gs);
    window.gameState = gs;
    if (typeof window.risqueArtemisEnsureOmniClientHud === "function") {
      window.risqueArtemisEnsureOmniClientHud(gs);
    }
    if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
      window.risqueArtemisEnsureHudTogglesVisible();
    }
    mountSpectatorHint(gs);
  };

  function teardownOtherPortablePhases() {
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
    /* Do not unmount reinforce here — syncFromState else branch handles phase exit. */
  }

  function mountRealReceiveCard(gs) {
    if (!gs || !window.risquePhases || !window.risquePhases.receivecard) return;
    if (window.__risqueArtemisReceiveCardMountInProgress) return;
    var up = normName(gs.currentPlayer);
    var ctrl = ownerSlot(gs);
    var mountKey = String(ctrl) + ":" + up;
    if (receiveCardMountedFor === mountKey && receiveCardControlsPresent()) {
      stripSetupHudClasses();
      stampReceiveCardPhaseChrome(gs);
      if (typeof window.risqueArtemisEnsureReceiveCardInteractive === "function") {
        window.risqueArtemisEnsureReceiveCardInteractive(gs);
      }
      return;
    }
    receiveCardMountedFor = mountKey;
    stampReceiveCardPhaseChrome(gs);
    document.body.classList.add("risque-setup-fullstage");
    document.documentElement.classList.add("risque-view-host");
    document.body.classList.add("risque-view-host");
    document.documentElement.classList.remove("risque-view-public");
    document.body.classList.remove("risque-view-public");
    var stageHost = document.getElementById("stage-host") || document.body;
    if (typeof window.risquePhases.receivecard.mount !== "function") return;
    window.risquePhases.receivecard.mount(stageHost, {
      onLog: function (msg) {
        try {
          console.info("[ARTEMIS receive-card]", msg);
        } catch (eLog) {
          /* ignore */
        }
      }
    });
    stripSetupHudClasses();
    if (!receiveCardControlsPresent() && !window.__risqueReceiveCardInitialized) {
      receiveCardMountedFor = "";
      window.risquePhases.receivecard.mount(stageHost, {
        onLog: function (msg) {
          try {
            console.info("[ARTEMIS receive-card retry]", msg);
          } catch (eLog2) {
            /* ignore */
          }
        }
      });
    }
    if (typeof window.risqueArtemisEnsureReceiveCardInteractive === "function") {
      window.risqueArtemisEnsureReceiveCardInteractive(gs);
    }
    wireOmniToggles(gs);
    window.__risqueArtemisReceiveCardControlsLive = receiveCardControlsPresent();
  }

  window.risqueArtemisReceiveCardControlsPresent = receiveCardControlsPresent;

  window.risqueArtemisEnsureReceiveCardInteractive = function (gsOpt) {
    var gs = gsOpt || window.gameState;
    if (!gs || (String(gs.phase || "") !== "receivecard" && String(gs.phase || "") !== "getcard")) return;
    if (!receiveCardControlsPresent()) return;
    if (!window.__risqueReceiveCardInitialized && typeof window.initReceiveCardPhase === "function") {
      window.initReceiveCardPhase();
    }
    var btn = document.getElementById("receivecard-btn-end");
    if (btn && typeof window.receiveCardEndTurn === "function") {
      btn.onclick = function () {
        window.receiveCardEndTurn();
      };
    }
    if (typeof window.receiveCardRepaintIfNeeded === "function") {
      window.receiveCardRepaintIfNeeded(gs);
    }
  };

  window.risqueArtemisSyncPortableReceiveCard = function (gs) {
    if (gs && gs.artemisCycleProbe) return;
    var ph = gs ? String(gs.phase || "") : "";
    if (ph !== "receivecard" && ph !== "getcard") {
      clearReceiveCardControls();
      if (window.risqueArtemisNetClient) exitClientPlayMode();
      return;
    }

    teardownOtherPortablePhases();
    if (typeof window.risqueReceiveCardMergeLivePlayerHand === "function") {
      gs = window.risqueReceiveCardMergeLivePlayerHand(gs);
    }
    if (typeof window.risqueReceiveCardRepairEarnFlags === "function") {
      window.risqueReceiveCardRepairEarnFlags(gs);
    }
    stampReceiveCardPhaseChrome(gs);

    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }
    if (typeof window.risqueArtemisClearMapPhaseHandoffFlags === "function") {
      window.risqueArtemisClearMapPhaseHandoffFlags(gs);
    }
    if (typeof window.risqueArtemisCancelReinforceMapRouting === "function") {
      window.risqueArtemisCancelReinforceMapRouting();
    }

    window.gameState = gs;
    var mine = isMine(gs);

    if (!mine) {
      clearReceiveCardControls();
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

    mountRealReceiveCard(gs);
  };

  window.risqueArtemisUnmountPortableReceiveCard = function () {
    clearReceiveCardControls();
    if (window.risqueArtemisNetClient) exitClientPlayMode();
  };
})();
