/**
 * ARTEMIS card play — interactive controls on the active player's laptop only.
 */
(function () {
  "use strict";

  if (!window.risqueArtemisMode) return;

  if (!window.__risqueArtemisCardplaySkipDelegated) {
    window.__risqueArtemisCardplaySkipDelegated = true;
    document.addEventListener(
      "click",
      function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        var skipBtn = t.closest("#cardplay-skip-income-btn");
        if (!skipBtn || skipBtn.disabled) return;
        if (typeof window.risqueArtemisTriggerCardplaySkipToIncome === "function") {
          ev.preventDefault();
          ev.stopPropagation();
          window.risqueArtemisTriggerCardplaySkipToIncome();
        }
      },
      true
    );
  }

  var cardplayMountedFor = "";
  var spectatorHintKey = "";
  var cardplayWatchTimer = null;
  var cardplayWatchRemounts = 0;
  var cardplayWatchLastRemountAt = 0;
  var CARDPLAY_WATCH_MAX_REMOUNTS = 12;
  var CARDPLAY_WATCH_MIN_GAP_MS = 2000;

  function stopCardplayWatchdog() {
    if (cardplayWatchTimer) {
      clearTimeout(cardplayWatchTimer);
      cardplayWatchTimer = null;
    }
  }

  function startCardplayWatchdog() {
    stopCardplayWatchdog();
    var tick = function () {
      var gs = window.gameState;
      if (!gs || String(gs.phase || "") !== "cardplay") {
        stopCardplayWatchdog();
        return;
      }
      if (gs.artemisCycleProbe || window.risqueArtemisCycleProbeActive) {
        stopCardplayWatchdog();
        return;
      }
      if (window.__risqueArtemisLeavingCardplay) {
        stopCardplayWatchdog();
        return;
      }
      if (!isMine(gs)) {
        stopCardplayWatchdog();
        return;
      }
      if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
        window.risqueArtemisEnsureClientActivePlay(gs);
      }
      var watchInterval = cardplayWatchRemounts >= 8 ? 2400 : cardplayWatchRemounts >= 4 ? 1200 : 800;
      var compactLive = !!document.querySelector("#risque-phase-content .cardplay-compact-root");
      if (cardplayControlsPresent() || compactLive) {
        if (typeof window.risqueArtemisRewireCardplayButtons === "function") {
          window.risqueArtemisRewireCardplayButtons();
        }
        cardplayWatchRemounts = 0;
      }
      if (!cardplayControlsPresent() && !compactLive) {
        if (cardplayWatchRemounts >= CARDPLAY_WATCH_MAX_REMOUNTS) {
          if (typeof window.risqueArtemisDiag === "function") {
            window.risqueArtemisDiag(
              "cardplay_watchdog_stop",
              "Active P" + myLocalSlot() + " remount cap reached",
              {
                currentPlayer: gs.currentPlayer,
                controlSlot: gs.artemisControlSlot,
                remounts: cardplayWatchRemounts,
              }
            );
          }
          stopCardplayWatchdog();
          return;
        }
        var now = Date.now();
        if (now - cardplayWatchLastRemountAt < CARDPLAY_WATCH_MIN_GAP_MS) {
          cardplayWatchTimer = setTimeout(tick, watchInterval);
          return;
        }
        if (typeof window.risqueArtemisEnsureClientCardplayHand === "function") {
          window.risqueArtemisEnsureClientCardplayHand(gs);
        }
        cardplayMountedFor = "";
        window.__risqueArtemisCardplayControlsLive = false;
        cardplayWatchRemounts += 1;
        cardplayWatchLastRemountAt = now;
        mountRealCardplay(gs);
      }
      if (
        typeof window.risqueArtemisMockCardplayControlsPresent === "function" &&
        window.risqueArtemisMockCardplayControlsPresent()
      ) {
        /* Controls stable — skip redundant mock remount on mirror tick. */
      } else if (
        typeof window.risqueArtemisUseMockCardplay === "function" &&
        window.risqueArtemisUseMockCardplay() &&
        typeof window.risqueArtemisEnsureMockPhaseInteractive === "function"
      ) {
        window.risqueArtemisEnsureMockPhaseInteractive(gs);
      }
      cardplayWatchTimer = setTimeout(tick, watchInterval);
    };
    cardplayWatchTimer = setTimeout(tick, 800);
  }

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
      var resolved = Number(window.risqueArtemisResolveOwnerSlot(gs)) || 0;
      if (resolved >= 1 && resolved <= 3) return resolved;
    }
    var fromPlayer = 0;
    if (typeof window.risqueArtemisActivePlayerSlot === "function") {
      fromPlayer = Number(window.risqueArtemisActivePlayerSlot(gs)) || 0;
    }
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (fromPlayer >= 1 && ctrl >= 1 && fromPlayer !== ctrl) {
      return fromPlayer;
    }
    if (ctrl >= 1 && ctrl <= 3) return ctrl;
    return fromPlayer;
  }

  function isMine(gs) {
    if (!gs) return false;
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }
    if (typeof window.risqueArtemisPanelIsMine === "function") {
      return window.risqueArtemisPanelIsMine(gs, ownerSlot(gs));
    }
    if (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) {
      return true;
    }
    if (window.risqueArtemisNetClient && !window.risqueArtemisHost) {
      var myNm = window.risqueArtemisPlayerName;
      if (!myNm) {
        try {
          myNm = sessionStorage.getItem("risqueArtemisPlayerName");
        } catch (eNmMine) {
          /* ignore */
        }
      }
      if (myNm && normName(myNm) === normName(gs.currentPlayer)) {
        return true;
      }
    }
    var local = myLocalSlot();
    if (!local) return false;
    var owner = ownerSlot(gs);
    return owner >= 1 && owner <= 3 && owner === local;
  }

  function activeHandCount(gs) {
    if (!gs) return 0;
    var up = normName(gs.currentPlayer);
    var p = (gs.players || []).find(function (pl) {
      return normName(pl && pl.name) === up;
    });
    if (!p) return 0;
    if (Array.isArray(p.cards) && p.cards.length) return p.cards.length;
    return Number(p.cardCount) || 0;
  }

  function presetExpectsHand(gs) {
    if (!gs || String(gs.phase || "") !== "cardplay") return false;
    var id =
      (gs.risqueArtemisPresetId && String(gs.risqueArtemisPresetId)) ||
      (window.risqueArtemisPresetMode && String(window.risqueArtemisPresetMode)) ||
      "";
    return id === "guidoR2Cardplay" || id === "guidoR2";
  }

  function stripHostOnlyCardplayChromeOnClient() {
    if (!window.risqueArtemisNetClient) return;
    [
      "cardplay-host-income-gate-root",
      "cardplay-continue-income-btn",
      "cardplay-continue-income-wrap--host"
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) {
        try {
          el.parentNode.removeChild(el);
        } catch (eRm) {
          /* ignore */
        }
      }
    });
    document.querySelectorAll(".cardplay-host-income-gate, .cardplay-continue-income-wrap--host").forEach(function (el) {
      if (el && el.parentNode) {
        try {
          el.parentNode.removeChild(el);
        } catch (eRm2) {
          /* ignore */
        }
      }
    });
  }

  function cardplayControlsPresent() {
    if (
      (window.risqueArtemisCycleProbeActive || (window.gameState && window.gameState.artemisCycleProbe)) &&
      document.getElementById("cycle-probe-active-panel")
    ) {
      return true;
    }
    if (typeof window.risqueArtemisMockCardplayControlsPresent === "function") {
      if (window.risqueArtemisMockCardplayControlsPresent()) return true;
    }
    var onClientLaptop = !!window.risqueArtemisNetClient;
    if (!onClientLaptop) {
      if (
        !!document.getElementById("cardplay-host-income-gate-root") ||
        !!document.getElementById("cardplay-continue-income-btn")
      ) {
        return true;
      }
    }
    if (
      !!document.getElementById("next-phase-button") ||
      !!document.getElementById("cardplay-skip-income-btn")
    ) {
      return true;
    }
    if (!window.__risqueArtemisCardplayControlsLive) return false;
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return false;
    return !!(
      slot.querySelector(".cardplay-compact-root") ||
      slot.querySelector("#cardplay-card-grid") ||
      slot.querySelector("#play-card-button")
    );
  }

  function stampCardplayControlSlot(gs) {
    if (!gs || typeof window.risqueArtemisStampControlSlot !== "function") return;
    window.risqueArtemisStampControlSlot(gs);
  }

  function cardplayOwnerMountKey(gs) {
    if (!gs) return "";
    return String(ownerSlot(gs)) + ":" + normName(gs.currentPlayer);
  }

  /** Receive-card turn advance keeps phase=cardplay but changes currentPlayer — remount controls. */
  function resetCardplayMountForOwnerChange(gs) {
    var key = cardplayOwnerMountKey(gs);
    if (!key || key.charAt(0) === ":") return;
    if (cardplayMountedFor && cardplayMountedFor !== key) {
      cardplayMountedFor = "";
      window.__risqueArtemisCardplayControlsLive = false;
      teardownCardplayUI();
      spectatorHintKey = "";
      if (window.risqueArtemisNetClient) {
        exitClientPlayMode();
      }
    }
  }

  window.risqueArtemisCardplayControlsPresent = cardplayControlsPresent;

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

  function artemisTeardownCardplayRecapChrome() {
    var overlay = document.getElementById("risque-public-cardplay-recap-overlay");
    if (overlay && overlay.parentNode) {
      try {
        overlay.parentNode.removeChild(overlay);
      } catch (eOv) {
        /* ignore */
      }
    }
    window.__risquePublicCardplayRecapDomSeq = null;
    var rh = document.getElementById("runtime-hud-root");
    if (rh) {
      rh.classList.remove("runtime-hud-root--host-cardplay-recap");
      rh.classList.remove("runtime-hud-root--public-cardplay-recap");
      rh.classList.remove("runtime-hud-root--cardplay-panel-only");
      rh.classList.remove("runtime-hud-root--artemis-cardplay");
    }
  }

  window.risqueArtemisTeardownCardplayRecapChrome = artemisTeardownCardplayRecapChrome;

  function teardownCardplayUI() {
    if (window.__risqueArtemisCardplayMountInProgress) return;
    artemisTeardownCardplayRecapChrome();
    window.__risqueArtemisCardplayControlsLive = false;
    cardplayMountedFor = "";
    ["cardplay-host-income-gate-root", "cardplay-continue-income-btn"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) {
        try {
          el.parentNode.removeChild(el);
        } catch (eRm) {
          /* ignore */
        }
      }
    });
    var ph = String((window.gameState && window.gameState.phase) || "");
    if (ph === "income" || ph === "con-income") {
      return;
    }
    if (ph !== "cardplay" && ph !== "con-cardplay") {
      return;
    }
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    var rhTeardown = document.getElementById("runtime-hud-root");
    if (rhTeardown) {
      rhTeardown.classList.remove("runtime-hud-root--cardplay-panel-only");
      rhTeardown.classList.remove("runtime-hud-root--artemis-cardplay");
    }
    if (slot.querySelector(".risque-artemis-mock-cardplay") || slot.querySelector(".cardplay-compact-root")) {
      slot.innerHTML = "";
      return;
    }
    slot.innerHTML = "";
  }

  function artemisEnsureCardplayOmniHudShell(gs) {
    if (!window.risqueArtemisMode) return;
    if (document.getElementById("risque-public-cardplay-recap-overlay")) return;
    var uio = document.getElementById("ui-overlay");
    if (!uio || !window.risqueRuntimeHud) return;
    var slot = document.getElementById("risque-phase-content");
    var cardplayLive = !!(slot && slot.querySelector(".cardplay-compact-root"));
    if (
      cardplayLive &&
      document.getElementById("control-voice") &&
      document.getElementById("hud-main-panel") &&
      document.getElementById("risque-private-stats-toggle")
    ) {
      return;
    }
    var needsShell =
      !document.getElementById("control-voice") ||
      !document.getElementById("control-voice-text") ||
      !document.getElementById("risque-private-stats-toggle") ||
      !document.getElementById("hud-main-panel");
    if (cardplayLive) {
      return;
    }
    if (needsShell && typeof window.risqueRuntimeHud.ensureSetupUnifiedHud === "function") {
      var banner = "CARD PLAY";
      if (gs && gs.currentPlayer) {
        banner = "CARD PLAY-" + String(gs.currentPlayer).trim().toUpperCase();
      }
      window.risqueRuntimeHud.ensureSetupUnifiedHud(uio, banner, { force: true });
    }
  }

  function artemisRestructureCardplayPhaseDom() {
    /* Keep cardplay-compact-root intact — Apollo panel-only CSS sizes hand + staging correctly. */
  }

  function cardplayInteractiveLaptopReady() {
    if (window.risqueArtemisHost && !window.risqueArtemisNetClient) {
      return !window.risqueDisplayIsPublic;
    }
    return (
      !!window.risqueArtemisNetClient &&
      !!window.risqueArtemisClientPlaying &&
      !window.risqueDisplayIsPublic
    );
  }

  function ensureArtemisCardplayHudClasses(gs) {
    if (!window.risqueArtemisMode) return;
    var rh = document.getElementById("runtime-hud-root");
    if (!rh) return;
    rh.classList.add("runtime-hud-root--cardplay-panel-only");
    rh.classList.add("runtime-hud-root--artemis-cardplay");
    rh.classList.add("runtime-hud-root--artemis-compact");
    rh.classList.remove("runtime-hud-root--login");
    if (!rh.classList.contains("runtime-hud-root--setup")) {
      rh.classList.add("runtime-hud-root--setup");
    }
    try {
      document.body.setAttribute("data-risque-phase", "cardplay");
    } catch (ePhAttr) {
      /* ignore */
    }
    var main = document.getElementById("hud-main-panel");
    var cv = document.getElementById("control-voice");
    if (main) {
      main.style.removeProperty("display");
      main.style.removeProperty("visibility");
    }
    if (cv) {
      cv.style.removeProperty("display");
      cv.style.removeProperty("visibility");
    }
    if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
      window.risqueArtemisEnsureHudTogglesVisible();
    }
    if (typeof window.risqueArtemisSyncMyTurnClass === "function" && gs) {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
  }

  function artemisCardplayCompactLive() {
    var slot = document.getElementById("risque-phase-content");
    return !!(slot && slot.querySelector(".cardplay-compact-root"));
  }

  function artemisCardplayRecapLive(gs) {
    gs = gs || window.gameState;
    if (!gs) return false;
    var recap = gs.risquePublicCardplayRecap;
    return !!(
      recap &&
      Array.isArray(recap.lines) &&
      recap.lines.length > 0 &&
      (gs.risqueCardplayTvRecapPublished || gs.risquePublicBookProcessing)
    );
  }

  function artemisCardplayWaitingPrimary(gs) {
    gs = gs || window.gameState;
    if (!gs) return "CARD PLAY";
    var mirrored =
      gs.risquePublicCardplayPrimary != null ? String(gs.risquePublicCardplayPrimary).trim() : "";
    if (mirrored) return mirrored;
    var nameU = String(gs.currentPlayer || "PLAYER").toUpperCase();
    return nameU + " IS IN CARD PLAY";
  }

  function artemisPaintCardplaySpectatorWaitingVoice(gs) {
    if (!gs) return;
    if (
      typeof window.risqueArtemisEnsureCardplaySpectatorVoiceShell === "function" &&
      window.risqueArtemisNetClient &&
      !window.risqueArtemisHost
    ) {
      window.risqueArtemisEnsureCardplaySpectatorVoiceShell(gs);
      return;
    }
    var primary = artemisCardplayWaitingPrimary(gs);
    var report =
      gs.risquePublicCardplayReport != null ? String(gs.risquePublicCardplayReport).trim() : "WAITING...";
    if (
      typeof window.risquePublicApplyVoiceAndLogMirror === "function" &&
      gs.risquePublicCardplayPrimary &&
      document.getElementById("control-voice-text")
    ) {
      try {
        window.risquePublicApplyVoiceAndLogMirror(gs);
        return;
      } catch (eMirVoice) {
        /* fall through */
      }
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
      window.risqueRuntimeHud.setControlVoiceText(primary, report, {
        skipMirror: true,
        reportClass: "ucp-voice-report--public-cardplay",
      });
    }
    var vt = document.getElementById("control-voice-text");
    var vr = document.getElementById("control-voice-report");
    if (vt) vt.textContent = primary;
    if (vr) {
      vr.textContent = report;
      vr.style.setProperty("display", report ? "block" : "none", "important");
      vr.className = "ucp-voice-report ucp-voice-report--public-cardplay";
    }
  }

  function artemisTeardownPortableCardplayPrivateUi() {
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    if (
      slot.querySelector(".cardplay-compact-root") ||
      slot.querySelector(".risque-artemis-cardplay-spectate")
    ) {
      slot.innerHTML = "";
    }
    cardplayMountedFor = "";
    window.__risqueArtemisCardplayControlsLive = false;
    spectatorHintKey = "";
  }

  function artemisSyncCardplayRecapUi(gs) {
    if (!window.risqueArtemisMode || !gs) return;
    stopCardplayWatchdog();
    window.gameState = gs;
    artemisTeardownPortableCardplayPrivateUi();
    artemisEnsureCardplayOmniHudShell(gs);
    ensureArtemisCardplayHudClasses(gs);
    if (typeof window.risqueHostSyncCardplayTvRecapUi === "function") {
      try {
        window.risqueHostSyncCardplayTvRecapUi(gs);
      } catch (eRecapUi) {
        /* ignore */
      }
    }
    if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
      try {
        window.risquePublicApplyVoiceAndLogMirror(gs);
      } catch (eRecapVoice) {
        /* ignore */
      }
    }
    if (typeof window.risqueArtemisMountCardplayIncomeGateIfNeeded === "function") {
      try {
        window.risqueArtemisMountCardplayIncomeGateIfNeeded();
      } catch (eIncGate) {
        /* ignore */
      }
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
      requestAnimationFrame(function () {
        try {
          window.risqueRuntimeHud.syncPosition();
        } catch (ePosRecap) {
          /* ignore */
        }
      });
    }
  }

  window.risqueArtemisTeardownPortableCardplayPrivateUi = artemisTeardownPortableCardplayPrivateUi;
  window.risqueArtemisSyncCardplayRecapUi = artemisSyncCardplayRecapUi;

  function artemisPaintCardplayControlVoice(gs) {
    if (!gs) return;
    if (artemisCardplayRecapLive(gs)) {
      if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
        try {
          window.risquePublicApplyVoiceAndLogMirror(gs);
        } catch (eRecapVoice) {
          /* ignore */
        }
      }
      return;
    }
    var nameU = String(gs.currentPlayer || "PLAYER").toUpperCase();
    var mine =
      (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) ||
      (typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
        window.risqueArtemisClientNameMatchesCurrent(gs));
    if (!mine) {
      artemisPaintCardplaySpectatorWaitingVoice(gs);
      return;
    }
    var primary = nameU + " — CARD PLAY";
    var report = "Select cards to play or tap SKIP.";
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
      window.risqueRuntimeHud.setControlVoiceText(primary, report, { skipMirror: true });
    }
    var vt = document.getElementById("control-voice-text");
    var vr = document.getElementById("control-voice-report");
    if (vt) vt.textContent = primary;
    if (vr) {
      vr.textContent = report;
      vr.style.display = report ? "block" : "none";
    }
  }

  function artemisInjectCardplayButtonStyles() {
    var styleId = "risque-artemis-cardplay-button-styles";
    if (document.getElementById(styleId)) return;
    var s = document.createElement("style");
    s.id = styleId;
    s.textContent =
      ".runtime-hud-root--artemis-cardplay .cardplay-artemis-toolbar-dock .cardplay-button.cardplay-btn-compact," +
      ".runtime-hud-root--artemis-cardplay .cardplay-artemis-toolbar-extra .cardplay-button.cardplay-btn-compact," +
      ".runtime-hud-root--artemis-cardplay .cardplay-compact-toolbar .cardplay-button.cardplay-btn-compact," +
      ".runtime-hud-root--artemis-cardplay .cardplay-panel-confirm-row .cardplay-button," +
      ".runtime-hud-root--artemis-cardplay .cardplay-panel-confirm-btn{" +
      "background:#00ff00!important;color:#000!important;border:2px solid #000!important;" +
      "opacity:1!important;min-height:48px!important;padding:10px 12px!important;font-size:17px!important;" +
      "font-weight:900!important;box-shadow:0 0 12px rgba(0,255,0,.45)!important;" +
      "display:inline-flex!important;align-items:center!important;justify-content:center!important;" +
      "cursor:pointer!important;pointer-events:auto!important;border-radius:6px!important;" +
      "appearance:auto!important;-webkit-appearance:button!important;" +
      "}" +
      ".runtime-hud-root--artemis-cardplay .cardplay-button.cardplay-btn-compact:hover:not(:disabled){" +
      "background:#39ff39!important;color:#000!important;}" +
      ".runtime-hud-root--artemis-cardplay .cardplay-button.cardplay-btn-compact:disabled{" +
      "opacity:.48!important;cursor:not-allowed!important;}";
    document.head.appendChild(s);
  }

  function artemisEnsureCardplayDualPane(gs) {
    if (!window.risqueArtemisMode) return;
    var wrap = document.getElementById("cardplay-staging-wrap");
    if (!wrap) return;
    var show =
      (window.risqueArtemisHost && !window.risqueArtemisNetClient) ||
      (typeof window.risqueArtemisIsMyTurn === "function" &&
        window.risqueArtemisIsMyTurn(gs || window.gameState));
    if (!show) return;
    wrap.classList.add("cardplay-staging-wrap--artemis-dual");
    wrap.removeAttribute("hidden");
    var hint = document.getElementById("cardplay-staging-empty-hint");
    if (!hint) {
      hint = document.createElement("p");
      hint.id = "cardplay-staging-empty-hint";
      hint.className = "cardplay-compact-msg cardplay-staging-empty-hint";
      hint.textContent = "Tap CARD or BOOK, then pick cards here.";
      wrap.appendChild(hint);
    }
    var grid = document.getElementById("cardplay-staging-grid");
    var hasStaged = !!(grid && grid.querySelector(".cardplay-staging-card"));
    hint.hidden = hasStaged;
  }

  window.risqueArtemisEnsureCardplayDualPane = artemisEnsureCardplayDualPane;

  window.risqueArtemisApplyCardplayHudLayout = function (gs) {
    artemisEnsureCardplayOmniHudShell(gs);
    ensureArtemisCardplayHudClasses(gs);
    artemisRestructureCardplayPhaseDom();
    artemisInjectCardplayButtonStyles();
    artemisPaintCardplayControlVoice(gs || window.gameState);
    artemisEnsureCardplayDualPane(gs);
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    }
    if (typeof window.risqueArtemisRewireCardplayButtons === "function") {
      window.risqueArtemisRewireCardplayButtons();
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
      requestAnimationFrame(function () {
        try {
          window.risqueRuntimeHud.syncPosition();
        } catch (eSync2) {
          /* ignore */
        }
      });
    }
  };

  function syncCardplayChrome(gs) {
    if (typeof window.risqueArtemisEnsureOmniClientHud === "function") {
      window.risqueArtemisEnsureOmniClientHud(gs);
    } else if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
      window.risqueRuntimeHud.updateTurnBannerFromState(gs);
    }
    ensureArtemisCardplayHudClasses(gs);
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    }
    if (window.gameUtils && gs) {
      try {
        window.gameUtils.renderStats(gs);
      } catch (eStats) {
        /* ignore */
      }
    }
  }

  function refreshCardplaySpectatorChrome(gs) {
    if (artemisCardplayRecapLive(gs)) {
      artemisSyncCardplayRecapUi(gs);
      return;
    }
    if (typeof window.risqueArtemisEnsureOmniClientHud === "function") {
      window.risqueArtemisEnsureOmniClientHud(gs);
    }
    artemisEnsureCardplayOmniHudShell(gs);
    ensureArtemisCardplayHudClasses(gs);
    artemisPaintCardplaySpectatorWaitingVoice(gs);
    if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
      window.risqueArtemisEnsureHudTogglesVisible();
    }
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
      requestAnimationFrame(function () {
        try {
          window.risqueRuntimeHud.syncPosition();
        } catch (eSyncSp) {
          /* ignore */
        }
      });
    }
  }

  window.risqueArtemisRefreshCardplaySpectatorChrome = refreshCardplaySpectatorChrome;

  function mountSpectatorHint(gs) {
    var slot = document.getElementById("risque-phase-content");
    if (slot) {
      if (slot.querySelector(".cardplay-compact-root")) {
        slot.innerHTML = "";
      }
      if (!slot.querySelector(".risque-artemis-cardplay-spectate")) {
        slot.innerHTML =
          '<div class="risque-artemis-cardplay-spectate risque-public-private-hint" role="status" aria-hidden="true"></div>';
      }
    }
    var name = gs && gs.currentPlayer ? String(gs.currentPlayer) : "?";
    var ctrl = ownerSlot(gs);
    spectatorHintKey = ctrl + ":" + normName(name);
    refreshCardplaySpectatorChrome(gs);
  }

  function cardplayUiShowsEmptyHand() {
    var grid = document.getElementById("cardplay-card-grid");
    if (grid && grid.querySelector(".cardplay-compact-card")) return false;
    var msg = document.getElementById("no-cards-message");
    if (msg && /no cards in hand/i.test(String(msg.textContent || ""))) return true;
    return !!(grid && !grid.querySelector("img.card"));
  }

  window.risqueArtemisCardplayUiShowsEmptyHand = cardplayUiShowsEmptyHand;

  function mountRealCardplay(gs) {
    if (window.__risqueArtemisCardplayMountInProgress) return;
    if (gs && gs.artemisCycleProbe) return;
    if (window.risqueArtemisCycleProbeActive) return;
    if (
      typeof window.risqueArtemisUseMockCardplay === "function" &&
      window.risqueArtemisUseMockCardplay()
    ) {
      var mockKey = cardplayOwnerMountKey(gs);
      if (cardplayMountedFor === mockKey && window.risqueArtemisMockCardplayControlsPresent()) {
        return;
      }
      cardplayMountedFor = mockKey;
      spectatorHintKey = "";
      teardownCardplayUI();
      if (typeof window.risqueArtemisMountMockCardplay === "function") {
        window.risqueArtemisMountMockCardplay(gs);
      }
      window.__risqueArtemisCardplayControlsLive = window.risqueArtemisMockCardplayControlsPresent();
      return;
    }
    if (!gs || !window.risquePhases || !window.risquePhases.cardplay) return;
    var handBefore = activeHandCount(gs);
    if (typeof window.risqueArtemisEnsureClientCardplayHand === "function") {
      window.risqueArtemisEnsureClientCardplayHand(gs);
    }
    if (typeof window.risqueArtemisEnsurePresetCardplayHands === "function") {
      window.risqueArtemisEnsurePresetCardplayHands(gs);
    }
    if (typeof window.risqueArtemisEnsureClientCardplayHand === "function") {
      window.risqueArtemisEnsureClientCardplayHand(gs);
    }
    var handAfter = activeHandCount(gs);
    var up = normName(gs.currentPlayer);
    var ctrl = ownerSlot(gs);
    var mountKey = String(ctrl) + ":" + up;
    if (cardplayMountedFor === mountKey && cardplayControlsPresent()) {
      var needsRemountForHand =
        handAfter > handBefore ||
        (handAfter >= 1 && cardplayUiShowsEmptyHand()) ||
        (presetExpectsHand(gs) && handAfter >= 1 && cardplayUiShowsEmptyHand());
      if (!needsRemountForHand) {
        window.__risqueArtemisCardplayControlsLive = true;
        if (typeof window.risqueArtemisRewireCardplayButtons === "function") {
          window.risqueArtemisRewireCardplayButtons();
        }
        if (typeof window.risqueArtemisApplyCardplayHudLayout === "function") {
          window.risqueArtemisApplyCardplayHudLayout(gs);
        } else {
          ensureArtemisCardplayHudClasses(gs);
        }
        return;
      }
      cardplayMountedFor = "";
      teardownCardplayUI();
    } else if (handAfter > handBefore) {
      cardplayMountedFor = "";
    }
    var compactRoot = document.querySelector("#risque-phase-content .cardplay-compact-root");
    if (cardplayMountedFor === mountKey && compactRoot) {
      window.__risqueArtemisCardplayControlsLive = true;
      if (typeof window.risqueArtemisRewireCardplayButtons === "function") {
        window.risqueArtemisRewireCardplayButtons();
      }
      if (typeof window.risqueArtemisApplyCardplayHudLayout === "function") {
        window.risqueArtemisApplyCardplayHudLayout(gs);
      }
      return;
    }
    teardownCardplayUI();
    cardplayMountedFor = mountKey;
    spectatorHintKey = "";

    window.__risqueArtemisCardplayMountInProgress = true;
    try {
      if (typeof window.risqueArtemisMountCardplayControls === "function") {
        window.risqueArtemisMountCardplayControls(gs);
      } else if (typeof window.risquePhases.cardplay.mount === "function") {
        var stageHost = document.getElementById("stage-host") || document.body;
        window.risquePhases.cardplay.mount(stageHost, {
          legacyNext: "game.html?phase=income",
          onLog: function (msg) {
            try {
              console.info("[ARTEMIS cardplay]", msg);
            } catch (eLog) {
              /* ignore */
            }
          }
        });
      }
    } finally {
      window.__risqueArtemisCardplayMountInProgress = false;
    }
    window.__risqueArtemisCardplayControlsLive = cardplayControlsPresent();
    if (
      window.__risqueArtemisCardplayControlsLive &&
      !window.risqueDisplayIsPublic &&
      typeof window.risqueMirrorPushGameState === "function"
    ) {
      window.risqueMirrorPushGameState();
    }
    if (typeof window.risqueArtemisApplyCardplayHudLayout === "function") {
      window.risqueArtemisApplyCardplayHudLayout(gs);
    } else {
      ensureArtemisCardplayHudClasses(gs);
      if (typeof window.risqueArtemisSyncPhaseControlVoice === "function") {
        window.risqueArtemisSyncPhaseControlVoice(gs);
      }
    }
  }

  /** Controls HTML can mount before client play mode / bind — remount when active laptop has no buttons. */
  window.risqueArtemisEnterClientPlayMode = enterClientPlayMode;

  window.risqueArtemisEnsureCardplayInteractive = function (gsOpt) {
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || gs.artemisCycleProbe || window.risqueArtemisCycleProbeActive) return;
    if (!gs || String(gs.phase || "") !== "cardplay") return;
    stripHostOnlyCardplayChromeOnClient();
    if (window.__risqueArtemisLeavingCardplay) return;
    if (
      window.risqueArtemisPhaseTransition &&
      String(window.risqueArtemisPhaseTransition.target || "") === "income"
    ) {
      return;
    }
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    window.gameState = gs;
    var mineInteractive = isMine(gs);
    if (
      !mineInteractive &&
      typeof window.risqueArtemisClientStickyCardplayOwns === "function" &&
      window.risqueArtemisClientStickyCardplayOwns(gs)
    ) {
      mineInteractive = true;
    }
    if (
      !mineInteractive &&
      window.risqueArtemisNetClient &&
      !window.risqueArtemisHost &&
      myLocalSlot() >= 1 &&
      ownerSlot(gs) === myLocalSlot()
    ) {
      mineInteractive = true;
    }
    if (!mineInteractive) return;
    if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
      window.risqueArtemisEnsureClientActivePlay(gs);
    }
    if (window.risqueArtemisNetClient) {
      enterClientPlayMode();
    }
    if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
      window.risqueArtemisReconcileClientPlayMode(gs);
    }
    if (cardplayControlsPresent()) {
      startCardplayWatchdog();
      return;
    }
    cardplayMountedFor = "";
    window.__risqueArtemisCardplayControlsLive = false;
    mountRealCardplay(gs);
    if (
      typeof window.risqueArtemisDiag === "function" &&
      !cardplayControlsPresent()
    ) {
      window.risqueArtemisDiag("cardplay_controls_missing", "Active P" + myLocalSlot() + " remount failed", {
        currentPlayer: gs.currentPlayer,
        controlSlot: gs.artemisControlSlot
      });
    } else if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag("cardplay_controls_ok", "Active P" + myLocalSlot() + " cardplay controls mounted", {
        currentPlayer: gs.currentPlayer,
        controlSlot: gs.artemisControlSlot
      });
    }
    startCardplayWatchdog();
  };

  window.risqueArtemisEnsureCardplayControls = function (gsOpt) {
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || gs.artemisCycleProbe || window.risqueArtemisCycleProbeActive) return;
    if (!gs || String(gs.phase || "") !== "cardplay") return;

    stampCardplayControlSlot(gs);
    window.gameState = gs;

    var mountKey = cardplayOwnerMountKey(gs);
    var mine = isMine(gs);
    if (mine && cardplayMountedFor === mountKey && cardplayControlsPresent()) {
      return;
    }

    if (mine) {
      if (typeof window.risqueArtemisHideLoginPanel === "function") {
        window.risqueArtemisHideLoginPanel();
      }
      try {
        document.documentElement.classList.remove("risque-artemis-login-active");
        document.documentElement.classList.remove("risque-artemis-login-confirmed");
      } catch (eLoginCls) {
        /* ignore */
      }
    }

    if (mine && !cardplayControlsPresent()) {
      cardplayMountedFor = "";
      window.__risqueArtemisCardplayControlsLive = false;
    }
    window.risqueArtemisSyncPortableCardplay(gs);
    if (
      typeof window.risqueArtemisUseMockCardplay === "function" &&
      window.risqueArtemisUseMockCardplay()
    ) {
      if (typeof window.risqueArtemisScheduleMockPhaseWatchdog === "function") {
        window.risqueArtemisScheduleMockPhaseWatchdog(gs);
      }
    }
  };

  window.risqueArtemisSyncPortableCardplay = function (gs) {
    if ((gs && gs.artemisCycleProbe) || window.risqueArtemisCycleProbeActive) return;
    if (window.__risqueArtemisCardplayMountInProgress) {
      if (artemisCardplayCompactLive() && typeof window.risqueArtemisRewireCardplayButtons === "function") {
        window.risqueArtemisRewireCardplayButtons();
      }
      return;
    }
    if (!gs || String(gs.phase || "") !== "cardplay") {
      stopCardplayWatchdog();
      teardownCardplayUI();
      spectatorHintKey = "";
      if (window.risqueArtemisNetClient) exitClientPlayMode();
      return;
    }

    if (artemisCardplayRecapLive(gs)) {
      artemisSyncCardplayRecapUi(gs);
      return;
    }

    window.risqueArtemisDeployHandoffPending = 0;
    window.risqueArtemisDeployPushLocked = false;
    stampCardplayControlSlot(gs);
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }
    resetCardplayMountForOwnerChange(gs);

    window.gameState = gs;
    stripHostOnlyCardplayChromeOnClient();
    var mine = isMine(gs);
    if (
      !mine &&
      typeof window.risqueArtemisClientStickyCardplayOwns === "function" &&
      window.risqueArtemisClientStickyCardplayOwns(gs)
    ) {
      mine = true;
    }
    if (
      !mine &&
      window.risqueArtemisNetClient &&
      !window.risqueArtemisHost &&
      myLocalSlot() >= 1 &&
      ownerSlot(gs) === myLocalSlot()
    ) {
      mine = true;
      if (typeof window.risqueArtemisStampControlSlot === "function") {
        window.risqueArtemisStampControlSlot(gs);
      }
    }

    if (!mine) {
      stopCardplayWatchdog();
      if (typeof window.risqueArtemisTeardownMockPhases === "function") {
        window.risqueArtemisTeardownMockPhases();
      }
      if (cardplayControlsPresent()) {
        teardownCardplayUI();
      }
      if (window.risqueArtemisNetClient) {
        exitClientPlayMode();
      }
      mountSpectatorHint(gs);
      refreshCardplaySpectatorChrome(gs);
      return;
    }

    var stableMountKey = cardplayOwnerMountKey(gs);
    if (
      mine &&
      cardplayMountedFor === stableMountKey &&
      (cardplayControlsPresent() || artemisCardplayCompactLive()) &&
      (cardplayInteractiveLaptopReady() || artemisCardplayCompactLive())
    ) {
      syncCardplayChrome(gs);
      if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
        window.risqueArtemisSyncMyTurnClass(gs);
      }
      if (typeof window.risqueArtemisRewireCardplayButtons === "function") {
        window.risqueArtemisRewireCardplayButtons();
      }
      if (typeof window.risqueArtemisApplyCardplayHudLayout === "function") {
        window.risqueArtemisApplyCardplayHudLayout(gs);
      } else if (typeof window.risqueArtemisSyncPhaseControlVoice === "function") {
        window.risqueArtemisSyncPhaseControlVoice(gs);
      }
      startCardplayWatchdog();
      return;
    }

    if (window.risqueArtemisNetClient) {
      enterClientPlayMode();
      if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
        window.risqueArtemisEnsureClientActivePlay(gs);
      }
      if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
        window.risqueArtemisReconcileClientPlayMode(gs);
      }
    }
    syncCardplayChrome(gs);
    mountRealCardplay(gs);
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
    if (mine && !cardplayControlsPresent()) {
      cardplayMountedFor = "";
      window.__risqueArtemisCardplayControlsLive = false;
      mountRealCardplay(gs);
    }
    if (
      typeof window.risqueArtemisUseMockCardplay === "function" &&
      window.risqueArtemisUseMockCardplay() &&
      typeof window.risqueArtemisScheduleMockPhaseWatchdog === "function"
    ) {
      window.risqueArtemisScheduleMockPhaseWatchdog(gs);
    }
    startCardplayWatchdog();
  };

  window.risqueArtemisStopCardplayWatchdog = stopCardplayWatchdog;

  window.risqueArtemisUnmountPortableCardplay = function () {
    stopCardplayWatchdog();
    teardownCardplayUI();
    spectatorHintKey = "";
    if (typeof window.risqueArtemisTeardownMockPhases === "function") {
      window.risqueArtemisTeardownMockPhases();
    }
    if (window.risqueArtemisNetClient) exitClientPlayMode();
  };
})();
