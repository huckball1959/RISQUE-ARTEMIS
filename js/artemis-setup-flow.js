/**
 * ARTEMIS setup sequence after login (no fast-start skip):
 * welcome (mirrored) → first-card roulette → deal (mirrored territory pops).
 * Host runs authoritative random + deal; clients follow public_state mirror.
 */
(function () {
  "use strict";

  if (!window.risqueArtemisMode) return;

  var WELCOME_MS = 2200;
  var welcomeTimer = null;

  function appendSession(url) {
    if (typeof window.risqueArtemisAppendSessionParams === "function") {
      return window.risqueArtemisAppendSessionParams(url);
    }
    return url;
  }

  function clearPresetArtifacts(gs) {
    if (gs && gs.risqueArtemisPresetId) {
      try {
        delete gs.risqueArtemisPresetId;
        delete gs.risqueArtemisPresetLabel;
      } catch (eClr) {
        /* ignore */
      }
    }
    try {
      sessionStorage.removeItem("risqueArtemisPresetId");
    } catch (eSs) {
      /* ignore */
    }
  }

  function persistAndMirror(gs) {
    window.gameState = gs;
    if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    }
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      /* ignore */
    }
    if (typeof window.risquePersistHostGameState === "function") {
      window.risquePersistHostGameState(gs);
    } else if (typeof window.risqueMirrorPushGameState === "function") {
      window.risqueMirrorPushGameState();
    }
  }

  function showWelcomeChrome(gs) {
    document.body.classList.add("risque-setup-fullstage");
    var appEl = document.getElementById("app");
    if (appEl) appEl.innerHTML = "";
    if (typeof window.risqueRefreshSetupStageChrome === "function") {
      window.risqueRefreshSetupStageChrome("WELCOME", function () {
        if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
          window.risqueRuntimeHud.setControlVoiceText("WELCOME TO RISQUE", "");
        }
        if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
          window.risqueRuntimeHud.updateTurnBannerFromState(gs);
        }
        if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
          window.risqueWireArtemisHudTogglesOnce();
        }
      });
    }
  }

  function goFirstCardSelect() {
    var url = appendSession("game.html?phase=playerSelect&selectKind=firstCard");
    if (typeof window.risqueNavigateGameHtmlSoft === "function" && window.risqueNavigateGameHtmlSoft(url)) {
      return;
    }
    if (typeof window.risqueNavigateWithFade === "function") {
      window.risqueNavigateWithFade(url);
    } else {
      window.location.href = url;
    }
  }

  /**
   * Host only — called from artemis-login after roster commit.
   */
  window.risqueArtemisBeginSetupAfterLogin = function (gs) {
    if (window.risqueArtemisCycleProbeActive) {
      if (typeof window.risqueArtemisCycleProbeOnLoginComplete === "function") {
        window.risqueArtemisCycleProbeOnLoginComplete(gs);
      }
      return false;
    }
    if (!window.risqueArtemisHost || !gs) return false;
    if (welcomeTimer) {
      clearTimeout(welcomeTimer);
      welcomeTimer = null;
    }

    clearPresetArtifacts(gs);

    gs.phase = "welcome";
    gs.selectionPhase = "firstCard";
    gs.risqueControlVoice = {
      primary: "WELCOME TO RISQUE",
      report: "",
      reportClass: ""
    };
    delete gs.risquePublicPlayerSelectFlash;
    delete gs.risquePublicUiSelectKind;
    delete gs.risquePublicDealPopTerritory;
    try {
      var staleSlot = document.getElementById("risque-phase-content");
      if (
        staleSlot &&
        (staleSlot.querySelector(".cardplay-compact-root") ||
          staleSlot.querySelector(".risque-artemis-cardplay-spectate"))
      ) {
        staleSlot.innerHTML = "";
      }
    } catch (eStaleCp) {
      /* ignore */
    }

    persistAndMirror(gs);
    showWelcomeChrome(gs);

    if (typeof window.risqueArtemisSetupMilestone === "function") {
      window.risqueArtemisSetupMilestone("M1-welcome", "first-card roulette in " + WELCOME_MS + "ms");
    }

    welcomeTimer = setTimeout(function () {
      welcomeTimer = null;
      var live = window.gameState || gs;
      live.phase = "playerSelect";
      live.selectionPhase = "firstCard";
      live.risquePublicUiSelectKind = "firstCard";
      persistAndMirror(live);
      if (typeof window.risqueArtemisSetupMilestone === "function") {
        window.risqueArtemisSetupMilestone("M2-firstCard-roulette-start", live.currentPlayer);
      }
      goFirstCardSelect();
    }, WELCOME_MS);

    return true;
  };

  function stillOnArtemisLoginScreen() {
    try {
      if (new URL(window.location.href).searchParams.get("phase") === "login") {
        return true;
      }
    } catch (eUrl) {
      /* ignore */
    }
    var overlay = document.getElementById("risque-artemis-login");
    if (overlay && !overlay.hidden) {
      return true;
    }
    try {
      return document.documentElement.classList.contains("risque-artemis-login-active");
    } catch (eCls) {
      return false;
    }
  }

  function buildLoadedGameNavigateUrl(gs) {
    var ph = String((gs && gs.phase) || "cardplay");
    var url = "game.html?phase=" + encodeURIComponent(ph);
    if (ph === "playerSelect") {
      var sk = String(gs.selectionPhase || gs.risquePublicUiSelectKind || "firstCard");
      url += "&selectKind=" + encodeURIComponent(sk);
    }
    if (ph === "cardplay" || ph === "con-cardplay") {
      url += "&legacyNext=" + encodeURIComponent("game.html?phase=income");
    }
    if (ph === "deploy") {
      var route = String(gs.risqueMirrorDeployRoute || "");
      if (route === "turn" || route === "deploy2") {
        url += "&kind=turn";
      } else if (route === "setup" || route === "deploy1") {
        url += "&kind=setup";
      }
    }
    return appendSession(url);
  }

  function navigateLoadedGameUrl(url) {
    if (typeof window.risqueFlushMirrorPush === "function") {
      try {
        window.risqueFlushMirrorPush();
      } catch (eFlush) {
        /* ignore */
      }
    }
    if (typeof window.risqueNavigateWithFade === "function") {
      window.risqueNavigateWithFade(url);
    } else {
      window.location.href = url;
    }
  }

  /**
   * Host only — resume from a loaded save after roster sign-in (testing / grace-style load).
   */
  window.risqueArtemisBeginLoadedGameAfterLogin = function (gs) {
    if (window.risqueArtemisCycleProbeActive) {
      return false;
    }
    if (!window.risqueArtemisHost || !gs) return false;

    clearPresetArtifacts(gs);
    delete gs.risquePublicPlayerSelectFlash;
    if (String(gs.phase || "") === "cardplay" || String(gs.phase || "") === "con-cardplay") {
      try {
        delete gs.selectionPhase;
        delete gs.risquePublicUiSelectKind;
      } catch (eSelClr) {
        /* ignore */
      }
    }
    try {
      var staleSlot = document.getElementById("risque-phase-content");
      if (staleSlot) staleSlot.innerHTML = "";
    } catch (eStale) {
      /* ignore */
    }

    persistAndMirror(gs);
    if (typeof window.risqueArtemisSetupMilestone === "function") {
      window.risqueArtemisSetupMilestone(
        "M0-load-ok",
        String(gs.phase || "?") + " · " + String(gs.currentPlayer || "?")
      );
    }

    window.risqueArtemisFastBootGameStarted = true;
    if (typeof window.risqueArtemisStopHostParkedRefresh === "function") {
      window.risqueArtemisStopHostParkedRefresh();
    }
    if (typeof window.risqueArtemisLobbyHide === "function") {
      window.risqueArtemisLobbyHide();
    }

    var url = buildLoadedGameNavigateUrl(gs);
    /* Login screen soft-nav skips map/HUD boot — full reload matches Grace rollback (reliable). */
    if (stillOnArtemisLoginScreen()) {
      if (typeof window.risqueArtemisHideLoginPanel === "function") {
        window.risqueArtemisHideLoginPanel();
      }
      navigateLoadedGameUrl(url);
      return true;
    }
    if (typeof window.risqueNavigateGameHtmlSoft === "function" && window.risqueNavigateGameHtmlSoft(url)) {
      return true;
    }
    navigateLoadedGameUrl(url);
    return true;
  };

  /** Clients (and host): ensure setup HUD when mirror reports welcome / early setup. */
  window.risqueArtemisSyncSetupMirror = function (gs) {
    if (!gs || !window.risqueArtemisMode) return;
    var ph = String(gs.phase || "");
    if (ph === "welcome" || ph === "playerSelect" || ph === "deal") {
      window.gameState = gs;
      if (typeof window.risqueHostReplaceShellGameState === "function") {
        window.risqueHostReplaceShellGameState(gs);
      }
      document.body.classList.add("risque-setup-fullstage");
      if (ph === "welcome" && typeof window.risqueArtemisSetupMilestone === "function") {
        window.risqueArtemisSetupMilestone("M1-welcome-mirror", "client synced");
      }
      if (ph === "welcome" && typeof window.risqueRefreshSetupStageChrome === "function") {
        window.risqueRefreshSetupStageChrome("WELCOME", function () {
          if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
            window.risqueRuntimeHud.setControlVoiceText("WELCOME TO RISQUE", "");
          }
          if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
            window.risqueWireArtemisHudTogglesOnce();
          }
        });
      }
    }
  };
})();
