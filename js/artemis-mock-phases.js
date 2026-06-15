/**
 * ARTEMIS mock cardplay + income — minimal Continue UI, full phase/sync handoff.
 * Controls live in #risque-artemis-mock-dock (persistent — not wiped by mirror churn).
 * Granular flags (sessionStorage + query):
 *   artemisMockCardplay=0 — real cardplay (CARD/BOOK/SKIP/CONFIRM)
 *   artemisMockIncome=0   — real income (spreadsheet + Continue in phases/income.js)
 *   artemisMockIncome=1   — mock income (+3 troops, CONTINUE stub)
 * Legacy blanket: artemisMockPhases=1|0 still toggles both when granular flags unset.
 */
(function () {
  "use strict";

  if (!window.risqueArtemisMode) return;

  var MOCK_DOCK_ID = "risque-artemis-mock-dock";
  var MOCK_FIXED_CONTINUE_ID = "risque-artemis-mock-continue-fixed";
  var MOCK_INCOME_TROOPS = 3;
  var mockCardplayLeaveInFlight = false;
  var mockIncomeLeaveInFlight = false;
  var mockCardplayMountedKey = "";
  var mockIncomeMountedKey = "";
  var mockWatchdogTimer = null;

  function applyCardplayIncomeExitToDisk(disk) {
    if (!disk || typeof disk !== "object") return;
    disk.risquePublicCardplayPrimary = "";
    disk.risquePublicCardplayReport = "";
    delete disk.risquePublicCardplayBookCards;
    delete disk.risquePublicBookProcessing;
    disk.risquePublicCardplayHighlightLabels = [];
    delete disk.risqueCardplayUseFrozenPublicMirror;
    delete disk.risqueCardplayPublicMirrorSnapshot;
    delete disk.risquePublicCardplayRecap;
    delete disk.risquePublicCardplayRecapAckRequiredSeq;
    delete disk.risquePublicCardplayAerialSkipHostDecisionSeq;
    delete disk.risqueCardplayTvRecapPublished;
    delete disk.risquePublicIncomeGateToken;
    disk.risqueCardplaySuppressPublicSpectator = false;
  }

  function injectMockStyles() {
    if (document.getElementById("risque-artemis-mock-phases-styles")) return;
    var s = document.createElement("style");
    s.id = "risque-artemis-mock-phases-styles";
    s.textContent =
      "#risque-artemis-mock-dock{position:relative;z-index:24;margin:8px 0 0;pointer-events:auto;}" +
      "#risque-artemis-mock-dock[hidden]{display:none !important;}" +
      ".risque-artemis-mock-panel{font-family:Arial,sans-serif;color:#f8fafc;padding:16px 20px;" +
      "max-width:420px;margin:0 auto;text-align:center;}" +
      ".risque-artemis-mock-panel .mock-player{font-size:18px;font-weight:900;text-transform:uppercase;" +
      "letter-spacing:.4px;margin:0 0 12px;text-shadow:1px 1px 2px rgba(0,0,0,.7);}" +
      ".risque-artemis-mock-panel .mock-msg{font-size:15px;margin:0 0 8px;color:#e2e8f0;}" +
      ".risque-artemis-mock-panel .mock-total{font-size:28px;font-weight:900;margin:8px 0 16px;color:#fff;}" +
      ".risque-artemis-mock-panel .mock-tag{font-size:11px;opacity:.65;margin:0 0 14px;text-transform:uppercase;" +
      "letter-spacing:.6px;}" +
      ".risque-artemis-mock-panel .risque-artemis-mock-btn{width:100%;max-width:320px;height:48px;margin:12px auto 0;" +
      "display:block;background:#000;color:#fff;font-size:18px;font-weight:bold;border:2px solid #00ff00;" +
      "border-radius:6px;cursor:pointer;}" +
      ".risque-artemis-mock-panel .risque-artemis-mock-btn:hover:not(:disabled){background:#1a1a1a;}" +
      ".risque-artemis-mock-panel .risque-artemis-mock-btn:disabled{opacity:.5;cursor:not-allowed;}" +
      ".risque-artemis-mock-cplay-layout{font-family:Arial,sans-serif;color:#f8fafc;max-width:520px;margin:0 auto;" +
      "pointer-events:auto;}" +
      ".risque-artemis-mock-cplay-layout .mock-cplay-player{font-size:18px;font-weight:900;text-transform:uppercase;" +
      "letter-spacing:.4px;margin:0 0 10px;text-shadow:1px 1px 2px rgba(0,0,0,.7);}" +
      ".risque-artemis-mock-cplay-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px;}" +
      ".risque-artemis-mock-cplay-toolbar .mock-cplay-tool-btn{flex:1 1 72px;min-width:72px;height:36px;" +
      "background:#000;color:#fff;font-size:14px;font-weight:bold;border:2px solid #555;border-radius:4px;cursor:pointer;" +
      "pointer-events:auto !important;}" +
      ".risque-artemis-mock-cplay-toolbar .mock-cplay-tool-btn:disabled{opacity:.45;cursor:not-allowed;}" +
      ".risque-artemis-mock-cplay-toolbar .mock-cplay-tool-btn.mock-cplay-skip-btn:not(:disabled){border-color:#0f0;}" +
      ".risque-artemis-mock-cplay-hand,.risque-artemis-mock-cplay-staging{border:2px solid rgba(255,255,255,.35);" +
      "border-radius:8px;padding:12px 14px;margin:0 0 10px;background:rgba(0,0,0,.35);min-height:100px;}" +
      ".risque-artemis-mock-cplay-hand h3,.risque-artemis-mock-cplay-staging h3{margin:0 0 8px;font-size:13px;" +
      "letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;}" +
      ".risque-artemis-mock-cplay-hand p,.risque-artemis-mock-cplay-staging p{margin:0;font-size:15px;color:#e2e8f0;}" +
      ".risque-artemis-mock-cplay-continue-row{margin-top:14px;text-align:center;}";
    document.head.appendChild(s);
  }

  function ensureMockHudShell(bannerText) {
    var gs = window.gameState;
    if (typeof window.risqueArtemisEnsureOmniClientHud === "function" && gs) {
      window.risqueArtemisEnsureOmniClientHud(gs);
      return;
    }
    var uio = document.getElementById("ui-overlay");
    if (!uio || !window.risqueRuntimeHud) return;
    var hudRoot = document.getElementById("runtime-hud-root");
    if (
      !hudRoot ||
      hudRoot.classList.contains("runtime-hud-root--login") ||
      !document.getElementById("control-voice") ||
      !document.getElementById("risque-phase-content")
    ) {
      if (typeof window.risqueRuntimeHud.ensureSetupUnifiedHud === "function") {
        window.risqueRuntimeHud.ensureSetupUnifiedHud(uio, bannerText || "SETUP", { force: true });
      } else if (typeof window.risqueRuntimeHud.ensureSetupHud === "function") {
        window.risqueRuntimeHud.ensureSetupHud(uio, bannerText || "SETUP");
      }
    }
    hudRoot = document.getElementById("runtime-hud-root");
    if (hudRoot) {
      hudRoot.classList.add("runtime-hud-root--artemis-compact");
    }
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    }
  }

  function mockDockParent() {
    var phaseSlot = document.getElementById("risque-phase-content");
    if (phaseSlot) return phaseSlot;
    var hudRoot = document.getElementById("runtime-hud-root");
    if (hudRoot) return hudRoot;
    return document.getElementById("ui-overlay") || document.body;
  }

  window.risqueArtemisEnsureMockDock = function () {
    injectMockStyles();
    var parent = mockDockParent();
    var dock = document.getElementById(MOCK_DOCK_ID);
    if (dock) {
      dock.hidden = false;
      if (parent && dock.parentNode !== parent) {
        parent.appendChild(dock);
      }
      return dock;
    }
    dock = document.createElement("div");
    dock.id = MOCK_DOCK_ID;
    dock.className = "risque-artemis-mock-dock";
    dock.setAttribute("role", "region");
    dock.setAttribute("aria-label", "Mock phase controls");
    if (parent) {
      parent.appendChild(dock);
    } else {
      document.body.appendChild(dock);
    }
    return dock;
  };

  function hideMockFixedContinue() {
    var fixed = document.getElementById(MOCK_FIXED_CONTINUE_ID);
    if (fixed && fixed.parentNode) {
      try {
        fixed.parentNode.removeChild(fixed);
      } catch (eRmFix) {
        fixed.hidden = true;
      }
    }
  }

  function wireMockCardplayAdvance(btn, gs) {
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (btn.disabled || mockCardplayLeaveInFlight) return;
      btn.disabled = true;
      try {
        btn.textContent = "LEAVING…";
      } catch (eLbl) {
        /* ignore */
      }
      var ok = window.risqueArtemisLeaveMockCardplayToIncome(window.gameState || gs);
      if (!ok) {
        btn.disabled = false;
        try {
          btn.textContent = btn.id === "risque-artemis-mock-cardplay-skip" ? "SKIP" : "CONTINUE TO INCOME";
        } catch (eLbl2) {
          /* ignore */
        }
      }
    });
  }

  function wireMockIncomeAdvance(btn, gs, legacyNext) {
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        btn.textContent = "LEAVING…";
      } catch (eLbl2) {
        /* ignore */
      }
      var ok = window.risqueArtemisLeaveMockIncomeToDeploy(window.gameState || gs, legacyNext);
      if (!ok) {
        btn.disabled = false;
        try {
          btn.textContent = "CONTINUE";
        } catch (eLbl3) {
          /* ignore */
        }
      }
    });
  }

  function hideMockDock() {
    hideMockFixedContinue();
    var dock = document.getElementById(MOCK_DOCK_ID);
    if (dock) {
      dock.innerHTML = "";
      dock.hidden = true;
    }
    mockCardplayMountedKey = "";
    mockIncomeMountedKey = "";
  }

  function navigatePreferSoft(url) {
    var dest = url;
    if (typeof window.risqueArtemisAppendSessionParams === "function") {
      dest = window.risqueArtemisAppendSessionParams(dest);
    }
    if (
      !window.risqueDisplayIsPublic &&
      typeof window.risqueNavigateGameHtmlSoft === "function" &&
      window.risqueNavigateGameHtmlSoft(dest)
    ) {
      return true;
    }
    if (typeof window.risqueArtemisSyncFromState === "function") {
      window.risqueArtemisSyncFromState(window.gameState);
    }
    if (typeof window.risqueFlushMirrorPush === "function") {
      window.risqueFlushMirrorPush();
    }
    window.location.href = dest;
    return false;
  }

  function persistGs(gs) {
    window.gameState = gs;
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      /* ignore */
    }
    if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    }
    if (typeof window.risquePersistHostGameState === "function") {
      window.risquePersistHostGameState(gs);
    }
  }

  function isActiveTurn(gs) {
    if (!gs) return false;
    if (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) {
      return true;
    }
    if (
      typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
      window.risqueArtemisClientNameMatchesCurrent(gs)
    ) {
      return true;
    }
    return false;
  }

  function playerColor(gs) {
    if (!gs || !window.gameUtils || !window.gameUtils.colorMap) return "#ffffff";
    var up = String(gs.currentPlayer || "").toUpperCase();
    var p = (gs.players || []).find(function (pl) {
      return pl && String(pl.name || "").toUpperCase() === up;
    });
    return p ? window.gameUtils.colorMap[p.color] || "#ffffff" : "#ffffff";
  }

  function artemisPresetBlocksMocks() {
    if (window.risqueArtemisPresetMode) return true;
    try {
      if (sessionStorage.getItem("risqueArtemisPresetId")) return true;
    } catch (ePreset) {
      /* ignore */
    }
    return false;
  }

  function readMockToggle(paramName, storageKey) {
    try {
      var q = new URL(window.location.href).searchParams;
      var qv = q.get(paramName);
      if (qv === "0") return false;
      if (qv === "1") return true;
      var stored = sessionStorage.getItem(storageKey);
      if (stored === "0") return false;
      if (stored === "1") return true;
    } catch (eRead) {
      /* ignore */
    }
    return null;
  }

  function readBlanketMockPhases() {
    try {
      var q = new URL(window.location.href).searchParams;
      if (q.get("artemisMockPhases") === "0" || q.get("artemisSkipCardplay") === "0") return false;
      if (q.get("artemisMockPhases") === "1" || q.get("artemisSkipCardplay") === "1") return true;
      var stored = sessionStorage.getItem("risqueArtemisMockPhases");
      if (stored === "0") return false;
      if (stored === "1") return true;
    } catch (eBlanket) {
      /* ignore */
    }
    return null;
  }

  window.risqueArtemisUseMockCardplay = function () {
    if (!window.risqueArtemisMode || artemisPresetBlocksMocks()) return false;
    var explicit = readMockToggle("artemisMockCardplay", "risqueArtemisMockCardplay");
    if (explicit === false) return false;
    if (explicit === true) return true;
    var blanket = readBlanketMockPhases();
    if (blanket === false) return false;
    if (blanket === true) return true;
    return false;
  };

  window.risqueArtemisUseMockIncome = function () {
    if (!window.risqueArtemisMode || artemisPresetBlocksMocks()) return false;
    var explicit = readMockToggle("artemisMockIncome", "risqueArtemisMockIncome");
    if (explicit === false) return false;
    if (explicit === true) return true;
    var blanket = readBlanketMockPhases();
    if (blanket === false) return false;
    if (blanket === true) return true;
    return false;
  };

  window.risqueArtemisUseMockPhases = function () {
    return window.risqueArtemisUseMockCardplay() || window.risqueArtemisUseMockIncome();
  };

  /** @deprecated use !risqueArtemisUseMockCardplay() */
  window.risqueArtemisShouldSkipCardplay = function () {
    return !window.risqueArtemisUseMockCardplay();
  };

  window.risqueArtemisMockCardplayControlsPresent = function () {
    return (
      !!document.getElementById("risque-artemis-mock-cardplay-skip") ||
      !!document.querySelector(".risque-phase-content .risque-artemis-mock-cardplay.cardplay-compact-root")
    );
  };

  window.risqueArtemisMockIncomeControlsPresent = function () {
    return !!document.getElementById("risque-artemis-mock-income-continue");
  };

  /** Keep HUD banner / body phase in sync — prevents CARD PLAY label during attack. */
  window.risqueArtemisSyncMockPhaseChrome = function (gs) {
    if (!gs || !window.risqueArtemisUseMockPhases()) return;
    var ph = String(gs.phase || "");
    try {
      document.body.setAttribute("data-risque-phase", ph);
    } catch (ePh) {
      /* ignore */
    }
    if (ph !== "cardplay" && ph !== "con-cardplay" && ph !== "income" && ph !== "con-income") {
      hideMockDock();
      var rhMock = document.getElementById("runtime-hud-root");
      if (rhMock) {
        rhMock.classList.remove("runtime-hud-root--cardplay-panel-only");
        rhMock.classList.remove("runtime-hud-root--artemis-cardplay");
      }
      var slot = document.getElementById("risque-phase-content");
      if (slot) {
        var stale =
          slot.querySelector(".risque-artemis-cardplay-spectate") ||
          slot.querySelector(".risque-artemis-mock-cardplay") ||
          slot.querySelector(".risque-artemis-mock-income") ||
          slot.querySelector(".risque-artemis-income-spectate");
        if (stale) slot.innerHTML = "";
      }
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
      window.risqueRuntimeHud.updateTurnBannerFromState(gs);
    }
    if (ph === "cardplay" && isActiveTurn(gs)) {
      hideMockFixedContinue();
    } else if (ph !== "cardplay" && ph !== "con-cardplay") {
      hideMockFixedContinue();
    }
  };

  window.risqueArtemisLeaveMockCardplayToIncome = function (gs) {
    if (!window.risqueArtemisUseMockCardplay() || !gs) return false;
    if (!isActiveTurn(gs)) return false;
    if (mockCardplayLeaveInFlight) return true;
    if (String(gs.phase || "") !== "cardplay") return false;

    mockCardplayLeaveInFlight = true;
    hideMockDock();

    if (typeof window.risqueArtemisBeginPhaseTransition === "function") {
      window.risqueArtemisBeginPhaseTransition("income");
    }

    gs.phase = "income";
    applyCardplayIncomeExitToDisk(gs);
    try {
      delete gs.risquePublicCardplayRecap;
      delete gs.risqueCardplayTvRecapPublished;
      delete gs.risquePublicIncomeBreakdown;
    } catch (eClr) {
      /* ignore */
    }

    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (typeof window.risqueArtemisPrepareFastIncomeTransition === "function") {
      window.risqueArtemisPrepareFastIncomeTransition();
    }

    persistGs(gs);
    window.risqueArtemisSyncMockPhaseChrome(gs);

    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag("mock_cardplay_continue", gs.currentPlayer + " → income (mock)", {
        currentPlayer: gs.currentPlayer,
        controlSlot: gs.artemisControlSlot
      });
    }

    setTimeout(function () {
      try {
        navigatePreferSoft("game.html?phase=income");
      } catch (eNav) {
        if (typeof window.risqueArtemisDiag === "function") {
          window.risqueArtemisDiag("mock_cardplay_continue_fail", String(eNav && eNav.message ? eNav.message : eNav), null);
        }
      } finally {
        mockCardplayLeaveInFlight = false;
        if (typeof window.risqueArtemisEndPhaseTransition === "function") {
          window.risqueArtemisEndPhaseTransition(window.gameState);
        }
      }
    }, 0);

    return true;
  };

  window.risqueArtemisLeaveMockIncomeToDeploy = function (gs, legacyNext) {
    if (!window.risqueArtemisUseMockIncome() || !gs) return false;
    if (!isActiveTurn(gs)) return false;
    if (mockIncomeLeaveInFlight) return true;
    if (String(gs.phase || "") !== "income" && String(gs.phase || "") !== "con-income") return false;

    mockIncomeLeaveInFlight = true;
    hideMockDock();

    if (typeof window.risqueArtemisBeginPhaseTransition === "function") {
      window.risqueArtemisBeginPhaseTransition("deploy");
    }

    var up = String(gs.currentPlayer || "");
    var cur = (gs.players || []).find(function (p) {
      return p && String(p.name || "") === up;
    });
    if (cur) {
      cur.bankValue = MOCK_INCOME_TROOPS;
      cur.bookValue = 0;
    }
    gs.bookPlayedThisTurn = false;
    gs.risqueArtemisMockIncomeApplied = MOCK_INCOME_TROOPS;
    try {
      delete gs.risquePublicIncomeBreakdown;
      delete gs.risquePublicIncomeGateToken;
    } catch (eInc) {
      /* ignore */
    }

    gs.phase = "deploy";
    gs.risqueMirrorDeployRoute = "turn";
    if (typeof window.risqueSetMirrorDeployRoute === "function") {
      window.risqueSetMirrorDeployRoute("turn");
    }
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (typeof window.risqueArtemisClearTurnDeployHandoffFlags === "function") {
      window.risqueArtemisClearTurnDeployHandoffFlags(gs);
    }

    persistGs(gs);
    window.risqueArtemisSyncMockPhaseChrome(gs);

    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag("mock_income_continue", gs.currentPlayer + " → deploy (+" + MOCK_INCOME_TROOPS + " mock)", {
        bankValue: MOCK_INCOME_TROOPS,
        currentPlayer: gs.currentPlayer,
        controlSlot: gs.artemisControlSlot
      });
    }

    var dest = legacyNext || "game.html?phase=deploy&kind=turn";
    if (String(dest).indexOf("deploy2.html") !== -1) {
      dest = "game.html?phase=deploy&kind=turn";
    }

    setTimeout(function () {
      try {
        navigatePreferSoft(dest);
      } catch (eNav2) {
        if (typeof window.risqueArtemisDiag === "function") {
          window.risqueArtemisDiag("mock_income_continue_fail", String(eNav2 && eNav2.message ? eNav2.message : eNav2), null);
        }
      } finally {
        mockIncomeLeaveInFlight = false;
        if (typeof window.risqueArtemisEndPhaseTransition === "function") {
          window.risqueArtemisEndPhaseTransition(window.gameState);
        }
      }
    }, 0);

    return true;
  };

  window.risqueArtemisMountMockCardplay = function (gs) {
    if (!gs || String(gs.phase || "") !== "cardplay") return;
    if (typeof window.risqueArtemisBindIdentityFromState === "function") {
      window.risqueArtemisBindIdentityFromState(gs);
    }
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    window.risqueArtemisDeployHandoffPending = 0;
    window.risqueArtemisDeployPushLocked = false;
    if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
      window.risqueArtemisEnsureClientActivePlay(gs);
    } else if (window.risqueArtemisNetClient && typeof window.risqueArtemisEnterClientPlayMode === "function") {
      window.risqueArtemisEnterClientPlayMode();
    }
    ensureMockHudShell("CARD PLAY");
    var dock = window.risqueArtemisEnsureMockDock();
    if (dock) {
      dock.hidden = true;
      dock.innerHTML = "";
    }

    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;

    var ctrl = Number(gs.artemisControlSlot) || 0;
    var mountKey = String(ctrl) + ":" + String(gs.currentPlayer || "");
    if (mockCardplayMountedKey === mountKey && window.risqueArtemisMockCardplayControlsPresent()) {
      return;
    }
    mockCardplayMountedKey = mountKey;
    mockIncomeMountedKey = "";

    var name = String(gs.currentPlayer || "Player");
    slot.innerHTML =
      '<div class="cardplay-compact-root risque-artemis-mock-cardplay" role="region" aria-label="Card play">' +
      '<div class="cardplay-compact-toolbar" role="toolbar" aria-label="Card play actions">' +
      '<button type="button" class="cardplay-button cardplay-btn-compact" disabled title="Wire to real CARD next">CARD</button>' +
      '<button type="button" class="cardplay-button cardplay-btn-compact" disabled title="Wire to real BOOK next">BOOK</button>' +
      '<button type="button" class="cardplay-button cardplay-btn-compact" disabled title="Reset staging — next step">RST</button>' +
      '<button type="button" id="risque-artemis-mock-cardplay-skip" class="cardplay-button cardplay-btn-compact" ' +
      'title="Skip card play (mock)">SKIP</button>' +
      '<button type="button" class="cardplay-button cardplay-btn-compact" disabled title="Confirm play — next step">CONFIRM</button>' +
      "</div>" +
      '<div class="cardplay-hand-staging-split">' +
      '<div class="cardplay-hand-stack">' +
      '<div id="cardplay-card-grid" class="cardplay-card-row cardplay-hand-row"></div>' +
      '<div id="no-cards-message" class="cardplay-compact-msg cardplay-hud-hint cardplay-selection-hint" aria-live="polite">' +
      "No cards in hand. Tap SKIP for income (mock).</div>" +
      "</div>" +
      '<div id="cardplay-staging-wrap" class="cardplay-staging-wrap">' +
      '<div id="cardplay-staging-grid" class="cardplay-card-row cardplay-staging-grid"></div>' +
      '<p class="cardplay-compact-msg cardplay-staging-empty-hint">Staging area — selected cards appear here (private).</p>' +
      "</div>" +
      "</div>" +
      "</div>";

    var rhRoot = document.getElementById("runtime-hud-root");
    if (rhRoot) {
      if (window.risqueArtemisMode) {
        rhRoot.classList.remove("runtime-hud-root--cardplay-panel-only");
        rhRoot.classList.add("runtime-hud-root--artemis-cardplay");
        rhRoot.classList.add("runtime-hud-root--artemis-compact");
      } else {
        rhRoot.classList.add("runtime-hud-root--cardplay-panel-only");
      }
      rhRoot.classList.remove("runtime-hud-root--cardplay-tight");
    }

    gs.risquePublicCardplayPrimary = name + " has no cards in hand. (mock harness)";
    gs.risquePublicCardplayReport = "Tap SKIP or CONTINUE to go to income.";

    wireMockCardplayAdvance(document.getElementById("risque-artemis-mock-cardplay-skip"), gs);

    window.risqueArtemisSyncMockPhaseChrome(gs);
    hideMockFixedContinue();
    if (typeof window.risqueArtemisSyncPhaseControlVoice === "function") {
      window.risqueArtemisSyncPhaseControlVoice(gs);
    } else if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
      window.risqueRuntimeHud.setControlVoiceText("MOCK CARD PLAY — NO CARDS IN HAND", "Tap CONTINUE for income.");
    }
  };

  window.risqueArtemisMountMockIncome = function (gs, legacyNext) {
    if (!gs) return;
    var ph = String(gs.phase || "");
    if (ph !== "income" && ph !== "con-income") return;
    if (typeof window.risqueArtemisBindIdentityFromState === "function") {
      window.risqueArtemisBindIdentityFromState(gs);
    }
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
      window.risqueArtemisEnsureClientActivePlay(gs);
    } else if (window.risqueArtemisNetClient && typeof window.risqueArtemisEnterClientPlayMode === "function") {
      window.risqueArtemisEnterClientPlayMode();
    }
    ensureMockHudShell("INCOME");
    var dock = window.risqueArtemisEnsureMockDock();
    if (!dock) return;

    var ctrl = Number(gs.artemisControlSlot) || 0;
    var mountKey = String(ctrl) + ":" + String(gs.currentPlayer || "") + ":" + MOCK_INCOME_TROOPS;
    if (mockIncomeMountedKey === mountKey && window.risqueArtemisMockIncomeControlsPresent()) {
      return;
    }
    mockIncomeMountedKey = mountKey;
    mockCardplayMountedKey = "";

    var name = String(gs.currentPlayer || "Player");
    var color = playerColor(gs);
    dock.hidden = false;
    dock.innerHTML =
      '<div class="risque-artemis-mock-panel risque-artemis-mock-income" role="region" aria-label="Mock income">' +
      '<p class="mock-player" style="color:' +
      color +
      '">' +
      name.toUpperCase() +
      " — INCOME</p>" +
      '<p class="mock-msg">Territory bonus (mock)</p>' +
      '<p class="mock-total">+' +
      MOCK_INCOME_TROOPS +
      " troops</p>" +
      '<p class="mock-tag">ARTEMIS mock harness</p>' +
      '<button type="button" id="risque-artemis-mock-income-continue" class="risque-artemis-mock-btn">CONTINUE</button>' +
      "</div>";

    var btn = document.getElementById("risque-artemis-mock-income-continue");
    wireMockIncomeAdvance(btn, gs, legacyNext);

    window.risqueArtemisSyncMockPhaseChrome(gs);
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
      window.risqueRuntimeHud.setControlVoiceText(
        "MOCK INCOME — +" + MOCK_INCOME_TROOPS + " TROOPS",
        "Tap CONTINUE for deployment."
      );
    }
  };

  /** Active laptop: remount mock controls if mirror/HUD was late. */
  window.risqueArtemisEnsureMockPhaseInteractive = function (gsOpt) {
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || !isActiveTurn(gs)) return;
    var ph = String(gs.phase || "");
    if (
      ph === "cardplay" &&
      window.risqueArtemisUseMockCardplay() &&
      !window.risqueArtemisMockCardplayControlsPresent()
    ) {
      mockCardplayMountedKey = "";
      window.risqueArtemisMountMockCardplay(gs);
    } else if (ph === "cardplay" && window.risqueArtemisUseMockCardplay() && isActiveTurn(gs)) {
      hideMockFixedContinue();
    } else if (
      (ph === "income" || ph === "con-income") &&
      window.risqueArtemisUseMockIncome() &&
      !window.risqueArtemisMockIncomeControlsPresent()
    ) {
      mockIncomeMountedKey = "";
      var legacy = "game.html?phase=deploy&kind=turn";
      try {
        var q = new URL(window.location.href).searchParams;
        if (q.get("legacyNext")) legacy = q.get("legacyNext");
      } catch (eQ) {
        /* ignore */
      }
      window.risqueArtemisMountMockIncome(gs, legacy);
    }
  };

  window.risqueArtemisScheduleMockPhaseWatchdog = function (gs) {
    if (!window.risqueArtemisUseMockPhases() || !gs) return;
    if (mockWatchdogTimer) clearTimeout(mockWatchdogTimer);
    mockWatchdogTimer = setTimeout(function () {
      mockWatchdogTimer = null;
      window.risqueArtemisEnsureMockPhaseInteractive(gs);
      if (typeof window.risqueArtemisDiag === "function") {
        var ph = String((window.gameState && window.gameState.phase) || "");
        if (ph === "cardplay" && isActiveTurn(window.gameState)) {
          window.risqueArtemisDiag(
            window.risqueArtemisMockCardplayControlsPresent() ? "mock_cardplay_controls_ok" : "mock_cardplay_controls_missing",
            "P" + (Number(window.risqueArtemisPlayerSlot) || (window.risqueArtemisHost ? 1 : 0)) + " mock cardplay",
            {
              currentPlayer: window.gameState && window.gameState.currentPlayer,
              controlSlot: window.gameState && window.gameState.artemisControlSlot,
              hasDock: !!document.getElementById(MOCK_DOCK_ID),
              hasFixedContinue: !!(
                document.getElementById(MOCK_FIXED_CONTINUE_ID) &&
                !document.getElementById(MOCK_FIXED_CONTINUE_ID).hidden
              ),
              playerSlot: Number(window.risqueArtemisPlayerSlot) || 0,
              playerName: window.risqueArtemisPlayerName || null
            }
          );
        }
      }
    }, 450);
  };

  window.risqueArtemisTeardownMockPhases = function () {
    hideMockDock();
    if (mockWatchdogTimer) {
      clearTimeout(mockWatchdogTimer);
      mockWatchdogTimer = null;
    }
  };
})();
