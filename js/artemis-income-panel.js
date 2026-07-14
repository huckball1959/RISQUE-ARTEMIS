/**
 * ARTEMIS — income Continue on the active laptop only (mirrors cardplay/deploy panels).
 */
(function () {
  "use strict";
  if (!window.risqueArtemisMode) return;

  if (!window.__risqueArtemisIncomeContinueDelegated) {
    window.__risqueArtemisIncomeContinueDelegated = true;
    document.addEventListener(
      "click",
      function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        var btn = t.closest("#risque-artemis-income-god-btn");
        if (!btn || btn.disabled) return;
        var gs = window.gameState;
        if (!gs || (String(gs.phase || "") !== "income" && String(gs.phase || "") !== "con-income")) {
          return;
        }
        if (typeof window.risqueArtemisLeaveRealIncomeToDeploy !== "function") return;
        ev.preventDefault();
        ev.stopPropagation();
        window.risqueArtemisLeaveRealIncomeToDeploy(gs);
      },
      true
    );
  }

  var incomeMountedFor = "";
  var incomeMountInFlight = false;
  var incomeLeaveInFlight = false;
  var spectatorHintKey = "";
  var INCOME_GOD_BTN_ID = "risque-artemis-income-god-btn";
  var incomeGodWatch = null;
  var incomeGodResizeBound = false;

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
    if (!gs) return false;
    if (typeof window.risqueArtemisPanelIsMine === "function") {
      return window.risqueArtemisPanelIsMine(gs, ownerSlot(gs));
    }
    return typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs);
  }

  function canAdvanceIncome(gs) {
    if (!gs) return false;
    var ph = String(gs.phase || "");
    if (ph !== "income" && ph !== "con-income") return false;
    if (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) {
      return true;
    }
    if (
      typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
      window.risqueArtemisClientNameMatchesCurrent(gs)
    ) {
      return true;
    }
    return isMine(gs);
  }

  function hideIncomeGodButton() {
    var b = document.getElementById(INCOME_GOD_BTN_ID);
    if (b && b.parentNode) {
      try {
        b.parentNode.removeChild(b);
      } catch (eRmGod) {
        b.hidden = true;
      }
    }
    if (incomeGodWatch) {
      clearInterval(incomeGodWatch);
      incomeGodWatch = null;
    }
  }

  function onIncomeGodButtonClick(ev) {
    var btn = document.getElementById(INCOME_GOD_BTN_ID);
    if (!btn || btn.disabled) return;
    var gs = window.gameState;
    if (!gs || (String(gs.phase || "") !== "income" && String(gs.phase || "") !== "con-income")) {
      return;
    }
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    btn.disabled = true;
    btn.textContent = "LEAVING…";
    var ok =
      typeof window.risqueArtemisLeaveRealIncomeToDeploy === "function" &&
      window.risqueArtemisLeaveRealIncomeToDeploy(gs);
    if (!ok) {
      btn.disabled = false;
      btn.textContent = "CONTINUE TO DEPLOY";
    }
  }

  function stripLegacyIncomeContinueFromSlot() {
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    var legacy = slot.querySelectorAll(".income-button");
    for (var i = 0; i < legacy.length; i += 1) {
      legacy[i].parentNode.removeChild(legacy[i]);
    }
  }

  /** Pin fixed body button below income breakdown (survives HUD slot wipes). */
  function syncIncomeGodButtonPosition() {
    var btn = document.getElementById(INCOME_GOD_BTN_ID);
    if (!btn || btn.hidden) return;
    var slot = document.getElementById("risque-phase-content");
    var anchor = slot;
    var cv = document.getElementById("control-voice");
    if (cv) {
      var cvr = cv.getBoundingClientRect();
      if (cvr.width > 8) anchor = cv;
    }
    var top = Math.round(window.innerHeight - 120);
    var centerX = Math.round(window.innerWidth * 0.5);
    if (anchor) {
      var ar = anchor.getBoundingClientRect();
      centerX = Math.round(ar.left + ar.width * 0.5);
      if (slot) {
        var sr = slot.getBoundingClientRect();
        if (sr.height > 12) {
          top = Math.round(sr.top + (sr.height - btn.offsetHeight) * 0.5);
        } else if (cv) {
          top = Math.round(ar.bottom + 8);
        } else if (sr.top > 0) {
          top = Math.round(sr.top);
        }
      } else if (cv) {
        top = Math.round(ar.bottom + 8);
      }
    }
    btn.style.position = "fixed";
    btn.style.left = centerX + "px";
    btn.style.top = top + "px";
    btn.style.width = "auto";
    btn.style.maxWidth = "none";
    btn.style.transform = "translateX(-50%)";
    btn.style.bottom = "auto";
    btn.style.zIndex = "2147483639";
  }

  function bindIncomeGodButtonLayoutSync() {
    if (incomeGodResizeBound) return;
    incomeGodResizeBound = true;
    window.addEventListener("resize", syncIncomeGodButtonPosition);
    window.addEventListener("scroll", syncIncomeGodButtonPosition, true);
  }

  function ensureIncomeGodButton(gs) {
    if (!window.risqueArtemisMode || !gs) {
      hideIncomeGodButton();
      return;
    }
    var ph = String(gs.phase || "");
    if (ph !== "income" && ph !== "con-income") {
      hideIncomeGodButton();
      return;
    }
    if (!canAdvanceIncome(gs)) {
      hideIncomeGodButton();
      return;
    }
    stripLegacyIncomeContinueFromSlot();
    var btn = document.getElementById(INCOME_GOD_BTN_ID);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = INCOME_GOD_BTN_ID;
      btn.type = "button";
      btn.className = "risque-artemis-income-deploy-btn risque-artemis-income-deploy-btn--body";
      btn.textContent = "CONTINUE TO DEPLOY";
      btn.setAttribute("aria-label", "Continue to deploy");
      btn.addEventListener("click", onIncomeGodButtonClick, true);
      document.body.appendChild(btn);
    } else if (btn.parentNode !== document.body) {
      document.body.appendChild(btn);
    }
    if (btn.disabled && !incomeLeaveInFlight) {
      btn.disabled = false;
    }
    if (!btn.disabled && btn.textContent.indexOf("LEAVING") === -1) {
      btn.textContent = "CONTINUE TO DEPLOY";
    }
    btn.hidden = false;
    btn.style.display = "block";
    bindIncomeGodButtonLayoutSync();
    syncIncomeGodButtonPosition();
    requestAnimationFrame(syncIncomeGodButtonPosition);
    setTimeout(syncIncomeGodButtonPosition, 120);
    if (!incomeGodWatch) {
      incomeGodWatch = setInterval(function () {
        var live = window.gameState;
        if (!live || (String(live.phase || "") !== "income" && String(live.phase || "") !== "con-income")) {
          hideIncomeGodButton();
          return;
        }
        if (!canAdvanceIncome(live)) {
          hideIncomeGodButton();
          return;
        }
        ensureIncomeGodButton(live);
        syncIncomeGodButtonPosition();
      }, 450);
    }
  }

  window.risqueArtemisSyncIncomeGodButtonPosition = syncIncomeGodButtonPosition;

  window.risqueArtemisEnsureIncomeGodButton = ensureIncomeGodButton;

  function incomeControlsPresent() {
    if (typeof window.risqueArtemisMockIncomeControlsPresent === "function") {
      if (window.risqueArtemisMockIncomeControlsPresent()) return true;
    }
    var slot = document.getElementById("risque-phase-content");
    return !!(
      document.getElementById(INCOME_GOD_BTN_ID) ||
      (slot && slot.querySelector(".income-button"))
    );
  }

  window.risqueArtemisIncomeControlsPresent = incomeControlsPresent;

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

  function stripCardplayHudClassesForIncome() {
    var rh = document.getElementById("runtime-hud-root");
    if (!rh) return;
    rh.classList.remove("runtime-hud-root--cardplay-panel-only");
    rh.classList.remove("runtime-hud-root--host-cardplay-recap");
    rh.classList.remove("runtime-hud-root--public-cardplay-recap");
    rh.classList.remove("runtime-hud-root--artemis-cardplay");
    if (!rh.classList.contains("runtime-hud-root--setup")) {
      rh.classList.add("runtime-hud-root--setup");
    }
    if (!rh.classList.contains("runtime-hud-root--artemis-compact")) {
      rh.classList.add("runtime-hud-root--artemis-compact");
    }
    if (typeof window.risqueArtemisClearCardplaySpectatorVoiceBacks === "function") {
      window.risqueArtemisClearCardplaySpectatorVoiceBacks();
    }
    var cv = document.getElementById("control-voice");
    if (cv) {
      cv.classList.add("ucp-control-voice");
    }
  }

  window.risqueArtemisStripCardplayHudClassesForIncome = stripCardplayHudClassesForIncome;

  function ensureIncomeHostViewClasses() {
    stripCardplayHudClassesForIncome();
    document.documentElement.classList.add("risque-view-host");
    document.body.classList.add("risque-view-host");
    document.documentElement.classList.remove("risque-view-public");
    document.body.classList.remove("risque-view-public");
    var ph = window.gameState ? String(window.gameState.phase || "") : "";
    if (ph === "income" || ph === "con-income") {
      document.body.setAttribute("data-risque-phase", ph);
    }
  }

  function clearIncomeControls() {
    incomeMountedFor = "";
    spectatorHintKey = "";
    hideIncomeGodButton();
    try {
      window.__risqueIncomeMountStableKey = "";
      delete window.risqueArtemisTriggerIncomeContinue;
    } catch (eClrStable) {
      /* ignore */
    }
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    if (
      slot.querySelector(".income-hud-phase-stack") ||
      slot.querySelector(".risque-artemis-income-spectate") ||
      slot.querySelector(".risque-artemis-mock-income")
    ) {
      slot.innerHTML = "";
    }
  }

  var INCOME_DEPLOY_NEXT = "game.html?phase=deploy&kind=turn";

  function resolveIncomeLegacyNext() {
    if (typeof window.risqueSanitizeIncomeDeployNext === "function") {
      var raw = null;
      try {
        raw = new URL(window.location.href).searchParams.get("legacyNext");
      } catch (eQ) {
        raw = null;
      }
      return window.risqueSanitizeIncomeDeployNext(raw);
    }
    return INCOME_DEPLOY_NEXT;
  }

  function incomeBreakdownBookMatches(gs, bd) {
    if (!bd || !gs) return true;
    var curNm = normName(gs.currentPlayer);
    var p = (gs.players || []).find(function (pl) {
      return normName(pl && pl.name) === curNm;
    });
    if (!p) return true;
    var expectBook = !!(gs.bookPlayedThisTurn && (Number(p.bookValue) || 0) > 0);
    var hasBook = !!(bd.showBook && Number(bd.bookBonus) > 0);
    return expectBook === hasBook;
  }

  /** Synchronous income grid payload — used when mirrors arrive before incomeInit finishes (book cash). */
  window.risqueArtemisEnsurePublicIncomeBreakdown = function (gsOpt) {
    var gs =
      gsOpt && typeof gsOpt === "object"
        ? gsOpt
        : window.gameState && typeof window.gameState === "object"
          ? window.gameState
          : null;
    if (!gs || !window.gameUtils) return null;
    var ph = String(gs.phase || "");
    if (ph !== "income" && ph !== "con-income") return null;
    var curNm = normName(gs.currentPlayer);
    var currentPlayer = (gs.players || []).find(function (p) {
      return normName(p && p.name) === curNm;
    });
    if (!currentPlayer) return null;
    var existing = gs.risquePublicIncomeBreakdown;
    if (
      existing &&
      existing.total != null &&
      Number.isFinite(Number(existing.total)) &&
      incomeBreakdownBookMatches(gs, existing)
    ) {
      return existing;
    }
    if (!gs.continentCollectionCounts) {
      gs.continentCollectionCounts = {
        south_america: 0,
        north_america: 0,
        africa: 0,
        europe: 0,
        asia: 0,
        australia: 0
      };
    }
    var territoryCount = (currentPlayer.territories || []).length;
    var territoryBonus = Math.max(Math.floor(territoryCount / 3), 3);
    var bookCount = gs.bookPlayedThisTurn ? Number(currentPlayer.bookValue) || 0 : 0;
    var bookBonus = bookCount * 10;
    var ownedContinents = window.gameUtils.getPlayerContinents(currentPlayer);
    var continentBonus = ownedContinents.reduce(function (sum, continent) {
      var key = Object.keys(window.gameUtils.continentDisplayNames || {}).find(function (k) {
        return window.gameUtils.continentDisplayNames[k] === continent;
      });
      var collectionCount =
        gs.continentCollectionCounts && key != null ? gs.continentCollectionCounts[key] || 0 : 0;
      return sum + window.gameUtils.getNextContinentValue(key, collectionCount);
    }, 0);
    var total = territoryBonus + bookBonus + continentBonus;
    var continentRowsForMirror = [];
    ownedContinents.forEach(function (c) {
      var cKey = Object.keys(window.gameUtils.continentDisplayNames || {}).find(function (k) {
        return window.gameUtils.continentDisplayNames[k] === c;
      });
      var cVal =
        cKey != null
          ? window.gameUtils.getNextContinentValue(cKey, gs.continentCollectionCounts[cKey] || 0)
          : 0;
      if (cVal > 0) {
        continentRowsForMirror.push({
          name: c.replace("South America", "S. America").replace("North America", "N. America"),
          bonus: cVal
        });
      }
    });
    gs.risquePublicIncomeBreakdown = {
      territoryCount: territoryCount,
      territoryBonus: territoryBonus,
      continentRows: continentRowsForMirror,
      showBook: !!(gs.bookPlayedThisTurn && bookBonus > 0),
      bookCount: bookCount,
      bookBonus: bookBonus,
      total: total
    };
    return gs.risquePublicIncomeBreakdown;
  };

  function resolveIncomeTotal(gs, currentPlayer) {
    if (!gs || !currentPlayer) return 0;
    var bd = gs.risquePublicIncomeBreakdown;
    if (bd && bd.total != null && Number.isFinite(Number(bd.total))) {
      return Number(bd.total);
    }
    if (!window.gameUtils) return 0;
    var territoryCount = (currentPlayer.territories || []).length;
    var territoryBonus = Math.max(Math.floor(territoryCount / 3), 3);
    var bookCount = gs.bookPlayedThisTurn ? currentPlayer.bookValue || 0 : 0;
    var bookBonus = bookCount * 10;
    var ownedContinents = window.gameUtils.getPlayerContinents(currentPlayer);
    var continentBonus = ownedContinents.reduce(function (sum, continent) {
      var key = Object.keys(window.gameUtils.continentDisplayNames || {}).find(function (k) {
        return window.gameUtils.continentDisplayNames[k] === continent;
      });
      var collectionCount =
        gs.continentCollectionCounts && key != null ? gs.continentCollectionCounts[key] || 0 : 0;
      return sum + window.gameUtils.getNextContinentValue(key, collectionCount);
    }, 0);
    return territoryBonus + bookBonus + continentBonus;
  }

  function applyStandardIncomeContinentCounts(gs, currentPlayer) {
    var keys = [];
    if (!gs || !currentPlayer || !window.gameUtils || !window.gameUtils.continents) return keys;
    if (!gs.continentCollectionCounts) {
      gs.continentCollectionCounts = {
        south_america: 0,
        north_america: 0,
        africa: 0,
        europe: 0,
        asia: 0,
        australia: 0
      };
    }
    Object.keys(window.gameUtils.continents).forEach(function (continent) {
      var territories = window.gameUtils.continents[continent];
      if (
        territories.every(function (t) {
          return (currentPlayer.territories || []).some(function (pt) {
            return pt && pt.name === t;
          });
        })
      ) {
        gs.continentCollectionCounts[continent] = (gs.continentCollectionCounts[continent] || 0) + 1;
        keys.push(continent);
      }
    });
    try {
      gs.risqueConquestStandardIncomeContinentKeysMeta = {
        round: gs.round,
        player: gs.currentPlayer,
        keys: keys
      };
    } catch (eMeta) {
      /* ignore */
    }
    return keys;
  }

  function wireArtemisIncomeContinueHandler() {
    if (typeof window.risqueArtemisLeaveRealIncomeToDeploy === "function") {
      window.risqueArtemisTriggerIncomeContinue = window.risqueArtemisLeaveRealIncomeToDeploy;
    }
  }

  function bindIncomeContinueButtonOnce() {
    var btn = document.getElementById(INCOME_GOD_BTN_ID);
    if (!btn) {
      btn = document.querySelector("#risque-phase-content .income-button");
    }
    if (!btn || btn.getAttribute("data-risque-artemis-income-bound") === "1") return;
    btn.setAttribute("data-risque-artemis-income-bound", "1");
    btn.addEventListener("click", function (ev) {
      if (btn.disabled) return;
      var gs = window.gameState;
      if (!gs || (String(gs.phase || "") !== "income" && String(gs.phase || "") !== "con-income")) {
        return;
      }
      if (typeof window.risqueArtemisLeaveRealIncomeToDeploy !== "function") return;
      ev.preventDefault();
      ev.stopPropagation();
      window.risqueArtemisLeaveRealIncomeToDeploy(gs);
    });
  }

  window.risqueArtemisLeaveRealIncomeToDeploy = function (gsOpt) {
    if (incomeLeaveInFlight) return true;
    var gs =
      gsOpt && typeof gsOpt === "object"
        ? gsOpt
        : window.gameState && typeof window.gameState === "object"
          ? window.gameState
          : null;
    if (!gs) return false;
    var ph = String(gs.phase || "");
    if (ph !== "income" && ph !== "con-income") return false;
    if (!canAdvanceIncome(gs)) return false;

    var up = String(gs.currentPlayer || "");
    var upNorm = up.trim().toUpperCase();
    var currentPlayer = (gs.players || []).find(function (p) {
      return p && String(p.name || "").trim().toUpperCase() === upNorm;
    });
    if (!currentPlayer) return false;

    incomeLeaveInFlight = true;
    if (typeof window.risqueArtemisCancelClientStatePush === "function") {
      window.risqueArtemisCancelClientStatePush();
    }
    if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
      window.risqueTeardownArtemisSetupDeploy(true);
    }
    if (typeof window.risqueArtemisUnmountPortableDeploy === "function") {
      window.risqueArtemisUnmountPortableDeploy();
    }
    if (typeof window.risqueArtemisClearSetupDeployWinnerLock === "function") {
      window.risqueArtemisClearSetupDeployWinnerLock(gs);
    }
    window.risqueDeploy1Active = false;
    var total = resolveIncomeTotal(gs, currentPlayer);
    var btn = document.getElementById(INCOME_GOD_BTN_ID);
    if (!btn) btn = document.querySelector("#risque-phase-content .income-button");
    if (btn) btn.disabled = true;

    if (typeof window.risqueArtemisBeginPhaseTransition === "function") {
      window.risqueArtemisBeginPhaseTransition("deploy");
    }
    if (typeof window.risqueArtemisTeardownCardplayRecapChrome === "function") {
      window.risqueArtemisTeardownCardplayRecapChrome();
    }
    if (typeof window.risqueClearCardplayPublicSpectatorForMirror === "function") {
      window.risqueClearCardplayPublicSpectatorForMirror();
    }
    if (
      window.risqueRuntimeHud &&
      typeof window.risqueRuntimeHud.setControlVoiceText === "function"
    ) {
      window.risqueRuntimeHud.setControlVoiceText(
        "CONFIRMED. +" + total + " TO BANK. NEXT: DEPLOYMENT.",
        "",
        { force: true }
      );
    }

    try {
      delete gs.risquePublicIncomeBreakdown;
    } catch (eRmBd) {
      /* ignore */
    }
    try {
      delete gs.risquePublicIncomeGateToken;
    } catch (eRmGate) {
      /* ignore */
    }

    currentPlayer.bankValue = total;
    applyStandardIncomeContinentCounts(gs, currentPlayer);
    try {
      delete gs.risqueConquestAttackEntryTurnKey;
      delete gs.risqueConquestAttackEntryContinents;
      if (
        window.gameUtils &&
        typeof window.gameUtils.clearRisqueConquestAttackStartSession === "function"
      ) {
        window.gameUtils.clearRisqueConquestAttackStartSession();
      }
    } catch (eAtkClr) {
      /* ignore */
    }
    gs.bookPlayedThisTurn = false;
    currentPlayer.bookValue = 0;
    gs.phase = "deploy";
    gs.risqueMirrorDeployRoute = "turn";
    gs.risqueArtemisControlSeq = Math.max(Number(gs.risqueArtemisControlSeq) || 0, 0) + 1;
    if (typeof window.risqueSetMirrorDeployRoute === "function") {
      window.risqueSetMirrorDeployRoute("turn");
    }
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (typeof window.risqueArtemisClearTurnDeployHandoffFlags === "function") {
      window.risqueArtemisClearTurnDeployHandoffFlags(gs);
    }

    window.gameState = gs;
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      /* ignore */
    }
    if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    } else if (typeof window.risquePersistGameStateForNavigation === "function") {
      window.risquePersistGameStateForNavigation(gs);
    }
    if (typeof window.risquePersistHostGameState === "function") {
      window.risquePersistHostGameState(gs);
    }
    if (typeof window.risqueArtemisFlushClientStatePush === "function") {
      window.risqueArtemisFlushClientStatePush(gs);
    }

    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag("income_continue", up + " → deploy (+" + total + ")", {
        bankValue: total,
        currentPlayer: up,
        controlSlot: gs.artemisControlSlot
      });
    }

    function finishIncomeDeployNavigation() {
      var dest = INCOME_DEPLOY_NEXT;
      var navOk = false;
      try {
        navOk =
          typeof window.risqueNavigateGameHtmlSoft === "function" &&
          window.risqueNavigateGameHtmlSoft(dest);
      } catch (eNav) {
        navOk = false;
      }
      if (!navOk) {
        try {
          if (window.risqueNavigateWithFade) {
            window.risqueNavigateWithFade(dest);
            navOk = true;
          } else {
            window.location.href = dest;
            navOk = true;
          }
        } catch (eHref) {
          navOk = false;
        }
      }

      hideIncomeGodButton();

      if (navOk) {
        if (typeof window.risqueHostReplaceShellGameState === "function") {
          window.risqueHostReplaceShellGameState(gs);
        }
        window.gameState = gs;
        try {
          localStorage.setItem("gameState", JSON.stringify(gs));
        } catch (eNavLs) {
          /* ignore */
        }
      }

      if (typeof window.risqueArtemisSyncFromState === "function") {
        window.risqueArtemisSyncFromState(gs);
      } else if (typeof window.risqueArtemisEnsureIncomeInteractive === "function") {
        window.risqueArtemisEnsureIncomeInteractive(gs);
      }
      if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
        window.risqueArtemisEnsureClientActivePlay(gs);
      }
      if (typeof window.risqueArtemisEnsureTurnDeployInteractive === "function") {
        window.risqueArtemisEnsureTurnDeployInteractive(gs);
      }
      if (typeof window.risqueArtemisEndPhaseTransition === "function") {
        window.risqueArtemisEndPhaseTransition(gs);
      }
      if (typeof window.risqueFlushMirrorPush === "function") {
        window.risqueFlushMirrorPush();
      } else if (typeof window.risqueMirrorPushGameState === "function") {
        window.risqueMirrorPushGameState();
      }
      if (!navOk) {
        try {
          if (typeof window.risqueHostReplaceShellGameState === "function") {
            window.risqueHostReplaceShellGameState(gs);
          }
          if (typeof window.risqueNavigateGameHtmlSoft === "function") {
            navOk = window.risqueNavigateGameHtmlSoft(INCOME_DEPLOY_NEXT);
          }
        } catch (eSoftDep) {
          /* ignore */
        }
      }
      if (navOk && String((window.gameState && window.gameState.phase) || gs.phase || "") === "deploy") {
        incomeLeaveInFlight = false;
      } else {
        setTimeout(function () {
          incomeLeaveInFlight = false;
        }, 1500);
      }
    }

    if (
      window.risqueArtemisMode &&
      window.risqueArtemisHost &&
      typeof window.risqueArtemisSyncGatePushAndWait === "function"
    ) {
      if (
        window.risqueRuntimeHud &&
        typeof window.risqueRuntimeHud.setControlVoiceText === "function"
      ) {
        window.risqueRuntimeHud.setControlVoiceText(
          "SYNCING DEPLOYMENT WITH ALL LAPTOPS…",
          "",
          { force: true }
        );
      }
      window.risqueArtemisSyncGatePushAndWait({
        label: "income→deploy",
        expectPhase: "deploy",
        timeoutMs: 8000
      }).then(function () {
        finishIncomeDeployNavigation();
      });
      return true;
    }

    if (typeof window.risqueFlushMirrorPush === "function") {
      window.risqueFlushMirrorPush();
    } else if (typeof window.risqueMirrorPushGameState === "function") {
      window.risqueMirrorPushGameState();
    }
    finishIncomeDeployNavigation();
    return true;
  };

  function incomeOwnerMountKey(gs) {
    if (!gs) return "";
    return String(ownerSlot(gs)) + ":" + normName(gs.currentPlayer);
  }

  function syncIncomeChrome(gs) {
    if (typeof window.risqueArtemisEnsureOmniClientHud === "function") {
      window.risqueArtemisEnsureOmniClientHud(gs);
    } else if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
      window.risqueRuntimeHud.updateTurnBannerFromState(gs);
    }
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    }
    if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
      window.risqueArtemisEnsureHudTogglesVisible();
    }
  }

  function mountSpectatorHint(gs) {
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    var name = gs && gs.currentPlayer ? String(gs.currentPlayer) : "?";
    var ctrl = ownerSlot(gs);
    var hintKey = ctrl + ":" + normName(name);
    if (hintKey === spectatorHintKey && slot.querySelector(".risque-artemis-income-spectate")) {
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
      '<div class="risque-artemis-income-spectate risque-artemis-deploy-spectate" role="status">' +
      "<p>Waiting for <strong style=\"color:" +
      color +
      '">' +
      name.toUpperCase() +
      "</strong></p>" +
      "<p>Only their laptop has income controls for this turn.</p></div>";
    if (
      gs.risquePublicIncomeBreakdown &&
      typeof window.risqueHostApplyIncomeBreakdownVoice === "function"
    ) {
      window.risqueHostApplyIncomeBreakdownVoice(gs);
      return;
    }
    if (typeof window.risqueArtemisSyncPhaseControlVoice === "function") {
      window.risqueArtemisSyncPhaseControlVoice(gs);
    } else if (
      window.risqueRuntimeHud &&
      typeof window.risqueRuntimeHud.setControlVoiceText === "function"
    ) {
      window.risqueRuntimeHud.setControlVoiceText(
        "WAITING FOR " + name.toUpperCase() + " — INCOME",
        ""
      );
    }
  }

  function incomeAlreadyStable(gs) {
    if (!gs) return false;
    var mountKey = incomeOwnerMountKey(gs);
    return (
      incomeMountedFor === mountKey &&
      incomeControlsPresent() &&
      incomeBreakdownLooksComplete(gs)
    );
  }

  function mountRealIncome(gs) {
    if (incomeMountInFlight || window.__risqueIncomeMountInProgress) return;
    if (incomeAlreadyStable(gs)) {
      ensureIncomeHostViewClasses();
      wireArtemisIncomeContinueHandler();
      bindIncomeContinueButtonOnce();
      return;
    }
    if (
      typeof window.risqueArtemisUseMockIncome === "function" &&
      window.risqueArtemisUseMockIncome()
    ) {
      var up = normName(gs.currentPlayer);
      var ctrl = ownerSlot(gs);
      var mountKey = String(ctrl) + ":" + up;
      if (incomeMountedFor === mountKey && incomeControlsPresent()) {
        ensureIncomeHostViewClasses();
        return;
      }
      incomeMountedFor = mountKey;
      ensureIncomeHostViewClasses();
      if (typeof window.risqueArtemisMountMockIncome === "function") {
        window.risqueArtemisMountMockIncome(gs, resolveIncomeLegacyNext());
      }
      return;
    }
    if (!gs || !window.risquePhases || !window.risquePhases.income) return;
    var up = normName(gs.currentPlayer);
    var ctrl = ownerSlot(gs);
    var mountKey = String(ctrl) + ":" + up;
    if (
      incomeMountedFor === mountKey &&
      incomeControlsPresent() &&
      incomeBreakdownLooksComplete(gs)
    ) {
      ensureIncomeHostViewClasses();
      wireArtemisIncomeContinueHandler();
      bindIncomeContinueButtonOnce();
      return;
    }
    incomeMountedFor = mountKey;
    ensureIncomeHostViewClasses();
    var stageHost = document.getElementById("stage-host") || document.body;
    var ph = String(gs.phase || "");
    incomeMountInFlight = true;
    try {
      if (ph === "con-income" && typeof window.risquePhases.income.runConquerIncome === "function") {
        window.risquePhases.income.runConquerIncome(stageHost, {
          onLog: function (msg) {
            try {
              console.info("[ARTEMIS income]", msg);
            } catch (eLog) {
              /* ignore */
            }
          }
        });
        return;
      }
      if (typeof window.risquePhases.income.mount !== "function") return;
      window.risquePhases.income.mount(stageHost, {
        legacyNext: resolveIncomeLegacyNext(),
        onLog: function (msg) {
          try {
            console.info("[ARTEMIS income]", msg);
          } catch (eLog2) {
            /* ignore */
          }
        }
      });
    } finally {
      incomeMountInFlight = false;
      wireArtemisIncomeContinueHandler();
      bindIncomeContinueButtonOnce();
    }
  }

  function ensureIncomeBreakdownVoice(gs) {
    if (!gs) return;
    if (!incomeBreakdownLooksComplete(gs)) {
      window.risqueArtemisEnsurePublicIncomeBreakdown(gs);
      gs = window.gameState || gs;
    }
    if (!incomeBreakdownLooksComplete(gs)) {
      try {
        window.__risqueIncomeInitKey = "";
      } catch (eClrInit) {
        /* ignore */
      }
      incomeMountedFor = "";
      mountRealIncome(gs);
      gs = window.gameState || gs;
    }
    if (
      gs &&
      gs.risquePublicIncomeBreakdown &&
      typeof window.risqueHostApplyIncomeBreakdownVoice === "function"
    ) {
      window.risqueHostApplyIncomeBreakdownVoice(gs);
    }
  }

  function incomeBreakdownLooksComplete(gs) {
    var bd = gs && gs.risquePublicIncomeBreakdown;
    return !!(bd && typeof bd === "object" && bd.total != null && Number.isFinite(Number(bd.total)));
  }

  function ensureIncomeContinueWired(gs) {
    if (!gs) return;
    var ph = String(gs.phase || "");
    if (ph !== "income" && ph !== "con-income") return;
    wireArtemisIncomeContinueHandler();
    bindIncomeContinueButtonOnce();
    if (!incomeControlsPresent()) {
      incomeMountedFor = "";
      try {
        window.__risqueIncomeMountStableKey = "";
      } catch (eClrStable) {
        /* ignore */
      }
      mountRealIncome(gs);
    }
  }

  function scheduleIncomeBreakdownRepaint(gs) {
    ensureIncomeBreakdownVoice(gs);
    if (!window.risqueArtemisMode) return;
    requestAnimationFrame(function () {
      ensureIncomeBreakdownVoice(window.gameState || gs);
      syncIncomeGodButtonPosition();
    });
    setTimeout(function () {
      ensureIncomeBreakdownVoice(window.gameState || gs);
      syncIncomeGodButtonPosition();
    }, 120);
  }

  window.risqueArtemisEnsureIncomeInteractive = function (gsOpt) {
    if (window.__risqueIncomeMountInProgress) return;
    var gs =
      window.gameState && typeof window.gameState === "object"
        ? window.gameState
        : gsOpt && typeof gsOpt === "object"
          ? gsOpt
          : null;
    if (
      gsOpt &&
      typeof gsOpt === "object" &&
      gsOpt.risquePublicIncomeBreakdown &&
      (!gs || !gs.risquePublicIncomeBreakdown)
    ) {
      if (!gs) gs = gsOpt;
      else gs.risquePublicIncomeBreakdown = gsOpt.risquePublicIncomeBreakdown;
    }
    if (
      !gs ||
      (String(gs.phase || "") !== "income" && String(gs.phase || "") !== "con-income")
    ) {
      return;
    }
    var localPh = window.gameState ? String(window.gameState.phase || "") : "";
    if (localPh === "deploy" || localPh === "con-deploy") {
      if (String(gs.phase || "") !== "income" && String(gs.phase || "") !== "con-income") {
        return;
      }
      if (typeof window.risqueArtemisClientReleaseSetupDeployChrome === "function") {
        window.risqueArtemisClientReleaseSetupDeployChrome(gs);
      }
      window.gameState = gs;
      localPh = String(gs.phase || "");
    }
    var tr = window.risqueArtemisPhaseTransition;
    if (tr && String(tr.target || "") === "deploy") {
      return;
    }
    if (!isMine(gs)) return;
    window.gameState = gs;
    if (incomeAlreadyStable(gs)) {
      ensureIncomeHostViewClasses();
      ensureIncomeBreakdownVoice(gs);
      wireArtemisIncomeContinueHandler();
      bindIncomeContinueButtonOnce();
      ensureIncomeGodButton(gs);
      scheduleIncomeBreakdownRepaint(gs);
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
    ensureIncomeBreakdownVoice(gs);
    if (!incomeBreakdownLooksComplete(gs) || !incomeControlsPresent()) {
      mountRealIncome(gs);
      gs = window.gameState || gs;
    }
    ensureIncomeContinueWired(gs);
    ensureIncomeGodButton(gs);
    scheduleIncomeBreakdownRepaint(gs);
  };

  window.risqueArtemisSyncPortableIncome = function (gs) {
    if (window.__risqueIncomeMountInProgress) return;
    if (gs && gs.artemisCycleProbe) return;
    var ph = gs ? String(gs.phase || "") : "";
    if (ph !== "income" && ph !== "con-income") {
      clearIncomeControls();
      hideIncomeGodButton();
      if (window.risqueArtemisNetClient) exitClientPlayMode();
      return;
    }

    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }

    window.gameState = gs;
    var mine = isMine(gs);

    if (!mine) {
      if (incomeControlsPresent()) {
        var slot = document.getElementById("risque-phase-content");
        if (slot) slot.innerHTML = "";
      }
      incomeMountedFor = "";
      if (window.risqueArtemisNetClient) {
        exitClientPlayMode();
      }
      syncIncomeChrome(gs);
      if (
        gs.risquePublicIncomeBreakdown &&
        typeof window.risqueHostApplyIncomeBreakdownVoice === "function"
      ) {
        ensureIncomeBreakdownVoice(gs);
      } else {
        mountSpectatorHint(gs);
        if (window.risqueArtemisNetClient) {
          [500, 1200].forEach(function (delayMs) {
            setTimeout(function () {
              var g2 = window.gameState;
              if (
                !g2 ||
                (String(g2.phase || "") !== "income" && String(g2.phase || "") !== "con-income")
              ) {
                return;
              }
              if (
                incomeBreakdownLooksComplete(g2) &&
                typeof window.risqueHostApplyIncomeBreakdownVoice === "function"
              ) {
                ensureIncomeBreakdownVoice(g2);
              }
            }, delayMs);
          });
        }
      }
      hideIncomeGodButton();
      return;
    }

    if (mine && incomeAlreadyStable(gs)) {
      syncIncomeChrome(gs);
      ensureIncomeBreakdownVoice(gs);
      wireArtemisIncomeContinueHandler();
      bindIncomeContinueButtonOnce();
      ensureIncomeGodButton(gs);
      scheduleIncomeBreakdownRepaint(gs);
      if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
        window.risqueArtemisSyncMyTurnClass(gs);
      }
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
    } else if (window.risqueArtemisHost) {
      ensureIncomeHostViewClasses();
    }

    syncIncomeChrome(gs);
    if (!incomeAlreadyStable(gs)) {
      mountRealIncome(gs);
      gs = window.gameState || gs;
    } else {
      ensureIncomeHostViewClasses();
    }
    ensureIncomeContinueWired(gs);
    ensureIncomeGodButton(gs);
    scheduleIncomeBreakdownRepaint(gs);
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
    if (typeof window.risqueArtemisSyncPhaseControlVoice === "function" && !gs.risquePublicIncomeBreakdown) {
      window.risqueArtemisSyncPhaseControlVoice(gs);
    }
    if (
      typeof window.risqueArtemisUseMockIncome === "function" &&
      window.risqueArtemisUseMockIncome() &&
      typeof window.risqueArtemisScheduleMockPhaseWatchdog === "function"
    ) {
      window.risqueArtemisScheduleMockPhaseWatchdog(gs);
    }
  };

  window.risqueArtemisUnmountPortableIncome = function () {
    clearIncomeControls();
    if (window.risqueArtemisNetClient) exitClientPlayMode();
  };

  wireArtemisIncomeContinueHandler();
  if (window.gameState) {
    ensureIncomeGodButton(window.gameState);
  }
})();
