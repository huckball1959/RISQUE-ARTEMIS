/**
 * ARTEMIS setup deploy — real controls on the active player's laptop only.
 * Deploy UI lives in #risque-artemis-deploy-dock (sibling of #risque-phase-content)
 * so HUD mirror passes cannot wipe Bank / RESET / CONFIRM.
 */
(function () {
  "use strict";

  if (!window.risqueArtemisMode) return;

  var DOCK_ID = "risque-artemis-deploy-dock";
  var deployMountedFor = "";
  var deployWatchTimer = null;
  var spectatorHintKey = "";
  var deployChromeSyncKey = "";
  var deployVoiceSyncKey = "";

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

  function mapOwnerPlayerForTerritory(gs, territoryLabel) {
    if (!gs || !Array.isArray(gs.players) || territoryLabel == null) return null;
    var label = String(territoryLabel).trim();
    if (!label) return null;
    for (var mi = 0; mi < gs.players.length; mi++) {
      var mp = gs.players[mi];
      if (!mp || !Array.isArray(mp.territories)) continue;
      if (
        mp.territories.some(function (t) {
          return t && String(t.name || "") === label;
        })
      ) {
        return mp;
      }
    }
    return null;
  }

  function deployTerritoryOwnedByCurrent(gs, territoryLabel) {
    if (!gs || territoryLabel == null || String(territoryLabel).trim() === "") return false;
    var label = String(territoryLabel).trim();
    var player = null;
    if (typeof window.risqueArtemisDeployResolveCurrentPlayer === "function") {
      player = window.risqueArtemisDeployResolveCurrentPlayer(gs);
    }
    if (!player && Array.isArray(gs.players)) {
      var up = normName(gs.currentPlayer);
      player = gs.players.find(function (p) {
        return p && normName(p.name) === up;
      });
    }
    if (player && Array.isArray(player.territories)) {
      if (
        player.territories.some(function (t) {
          return t && String(t.name || "") === label;
        })
      ) {
        return true;
      }
    }
    var mapOwner = mapOwnerPlayerForTerritory(gs, label);
    if (!mapOwner || !player) return false;
    return normName(mapOwner.name) === normName(player.name);
  }

  function sanitizeDeployMirrorDraft(gs) {
    if (!gs || !gs.risqueDeployMirrorDraft || typeof gs.risqueDeployMirrorDraft !== "object") {
      return gs;
    }
    var sel = gs.risqueDeployMirrorDraft.selected;
    if (sel != null && String(sel).trim() !== "" && !deployTerritoryOwnedByCurrent(gs, sel)) {
      gs.risqueDeployMirrorDraft.selected = null;
    }
    return gs;
  }

  window.risqueArtemisSanitizeDeployMirrorDraft = sanitizeDeployMirrorDraft;
  window.risqueArtemisDeploySelectionOwnedByCurrent = deployTerritoryOwnedByCurrent;
  window.risqueArtemisMayStampLocalDeploySelection = mayStampLocalDeploySelection;

  function resetDeployTurnSession(gs, opts) {
    opts = opts || {};
    if (!gs || String(gs.phase || "") !== "deploy") return gs;
    clearStaleTurnDeployHandoffLocks(gs);
    window.risqueDeploy1Active = false;
    window.selectedTerritory = null;
    window.deployedTroops = {};
    try {
      delete gs.risqueDeployMirrorDraft;
      delete gs.risqueDeployTransientPrimary;
      delete gs.risqueDeploySessionTroopTotal;
      delete gs.risqueDeploySessionBudgetSlot;
    } catch (eDraftClr) {
      /* ignore */
    }
    sanitizeDeployMirrorDraft(gs);
    deployChromeSyncKey = "";
    deployVoiceSyncKey = "";
    spectatorHintKey = "";
    try {
      delete window.__risqueArtemisPinnedDeployWaitLine;
    } catch (ePinClr) {
      /* ignore */
    }
    if (opts.refreshBanner !== false) {
      var waitName = deployingDisplayName(gs);
      try {
        gs.risquePublicDeployBanner =
          "WAITING FOR " + String(waitName || "NEXT").toUpperCase() + " TO DEPLOY";
        gs.risqueControlVoice = {
          primary: gs.risquePublicDeployBanner,
          report: "",
          reportClass: "ucp-voice-report ucp-voice-report--public-deploy"
        };
      } catch (eBan) {
        /* ignore */
      }
    }
    return gs;
  }

  window.risqueArtemisResetDeployTurnSession = resetDeployTurnSession;
  window.risqueArtemisDeployTurnSessionNeedsReset = deployTurnSessionNeedsReset;

  function isTurnDeployRoute(gs) {
    if (!gs) return false;
    var route = String(gs.risqueMirrorDeployRoute || "");
    if (route === "setup" || route === "deploy1") return false;
    if (route === "turn" || route === "deploy2") return true;
    try {
      var rk = localStorage.getItem("risqueMirrorDeployRoute");
      if (rk === "setup" || rk === "deploy1") return false;
      if (rk === "turn" || rk === "deploy2") return true;
    } catch (eRk) {
      /* ignore */
    }
    if (isSetupDeploy(gs)) return false;
    return false;
  }

  function isSetupDeployOwner(gs) {
    if (!isSetupDeploy(gs)) return false;
    var local = myLocalSlot();
    var owner = deployOwnerSlot(gs);
    return local >= 1 && owner >= 1 && owner === local;
  }

  function clearStaleTurnDeployHandoffLocks(gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return;
    if (!isTurnDeployRoute(gs)) return;
    window.risqueArtemisDeployHandoffPending = 0;
    window.risqueArtemisDeployPushLocked = false;
    window.risqueArtemisDeployRelinquishedSeq = 0;
    try {
      delete window.risqueArtemisDeployHandoffPlayer;
    } catch (eClrHp) {
      /* ignore */
    }
  }

  function localOwnsTurnDeploy(gs) {
    if (!gs || String(gs.phase || "") !== "deploy" || !isTurnDeployRoute(gs)) return false;
    var local = myLocalSlot();
    var owner = deployOwnerSlot(gs);
    if (local >= 1 && owner >= 1 && owner === local) {
      clearStaleTurnDeployHandoffLocks(gs);
      return true;
    }
    if (
      typeof window.risqueArtemisIsMyTurn === "function" &&
      window.risqueArtemisIsMyTurn(gs)
    ) {
      clearStaleTurnDeployHandoffLocks(gs);
      return true;
    }
    return false;
  }

  window.risqueArtemisClearStaleTurnDeployHandoffLocks = clearStaleTurnDeployHandoffLocks;
  window.risqueArtemisLocalOwnsTurnDeploy = localOwnsTurnDeploy;

  function deploySpectatorCtrlHandoffChanged(gs) {
    if (!gs) return false;
    var ctrlSlot = deployOwnerSlot(gs) || Number(gs.artemisControlSlot) || 0;
    var lastCtrl = Number(window.__risqueArtemisDeployLastControlSlot) || 0;
    return ctrlSlot > 0 && lastCtrl > 0 && ctrlSlot !== lastCtrl;
  }

  function deployTurnSessionNeedsReset(gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return false;
    if (artemisClientSpectatesDeploy(gs)) {
      return deploySpectatorCtrlHandoffChanged(gs);
    }
    if (isSetupDeploy(gs)) {
      if (deploySpectatorHandoffChanged(gs)) return true;
      var setupDraft =
        gs.risqueDeployMirrorDraft &&
        typeof gs.risqueDeployMirrorDraft === "object"
          ? gs.risqueDeployMirrorDraft
          : null;
      if (
        setupDraft &&
        setupDraft.selected != null &&
        String(setupDraft.selected).trim() !== "" &&
        !deployTerritoryOwnedByCurrent(gs, setupDraft.selected)
      ) {
        return true;
      }
      if (window.selectedTerritory != null && String(window.selectedTerritory).trim() !== "") {
        if (!deployTerritoryOwnedByCurrent(gs, window.selectedTerritory)) return true;
      }
      return false;
    }
    if (!isTurnDeployRoute(gs)) return false;
    if (
      isTurnDeployRoute(gs) &&
      typeof window.risqueArtemisLocalOwnsTurnDeploy === "function" &&
      window.risqueArtemisLocalOwnsTurnDeploy(gs) &&
      typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
      window.risqueArtemisClientHasActiveDeploySession()
    ) {
      var ctrlActive = deployOwnerSlot(gs) || Number(gs.artemisControlSlot) || 0;
      var lastCtrlActive = Number(window.__risqueArtemisDeployLastControlSlot) || 0;
      return ctrlActive > 0 && lastCtrlActive > 0 && ctrlActive !== lastCtrlActive;
    }
    /* Observers: live +N draft mirrors must not reset every wsSeq tick. */
    if (artemisClientSpectatesDeploy(gs)) {
      return deploySpectatorCtrlHandoffChanged(gs);
    }
    if (deploySpectatorHandoffChanged(gs)) return true;
    var draft =
      gs.risqueDeployMirrorDraft &&
      typeof gs.risqueDeployMirrorDraft === "object"
        ? gs.risqueDeployMirrorDraft
        : null;
    if (
      draft &&
      draft.selected != null &&
      String(draft.selected).trim() !== "" &&
      !deployTerritoryOwnedByCurrent(gs, draft.selected)
    ) {
      return true;
    }
    if (window.selectedTerritory != null && String(window.selectedTerritory).trim() !== "") {
      if (!deployTerritoryOwnedByCurrent(gs, window.selectedTerritory)) return true;
      /* Spectators mirror the deployer's selection — never reset live +N draft for that. */
      if (
        typeof window.risqueArtemisIsMyTurn === "function" &&
        !window.risqueArtemisIsMyTurn(gs)
      ) {
        return false;
      }
    }
    var pinned = String(window.__risqueArtemisPinnedDeployWaitLine || "").trim();
    if (pinned && /^WAITING FOR .+ TO DEPLOY$/i.test(pinned)) {
      var cur = normName(deployingDisplayName(gs));
      if (cur && pinned.toUpperCase().indexOf(cur) < 0) return true;
    }
    return false;
  }

  function rosterNameForSlot(gs, slot) {
    if (!gs || !slot) return "";
    if (Array.isArray(gs.artemisRoster)) {
      var hit = gs.artemisRoster.find(function (r) {
        return Number(r.slot) === Number(slot);
      });
      if (hit && hit.name) return normName(hit.name);
    }
    return "";
  }

  /** Which laptop slot owns setup deploy controls for this mirror snapshot. */
  function deployOwnerSlot(gs) {
    if (!gs) return 0;
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      return Number(window.risqueArtemisResolveOwnerSlot(gs)) || 0;
    }
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (ctrl >= 1 && ctrl <= 3) {
      return ctrl;
    }
    if (typeof window.risqueArtemisActivePlayerSlot === "function") {
      return Number(window.risqueArtemisActivePlayerSlot(gs)) || 0;
    }
    return 0;
  }

  function isMine(gs) {
    if (!gs) return false;
    if (localOwnsTurnDeploy(gs)) {
      return true;
    }
    if (isSetupDeployOwner(gs)) {
      window.risqueArtemisDeployHandoffPending = 0;
      window.risqueArtemisDeployPushLocked = false;
      window.risqueArtemisDeployRelinquishedSeq = 0;
      return true;
    }
    if (window.risqueArtemisDeployPushLocked || window.risqueArtemisDeployHandoffPending) {
      return false;
    }
    var relSeq = Number(window.risqueArtemisDeployRelinquishedSeq) || 0;
    var gsSeq = Number(gs.risqueArtemisControlSeq) || 0;
    if (relSeq > 0 && gsSeq > 0 && gsSeq <= relSeq) {
      return false;
    }
    var owner = deployOwnerSlot(gs);
    if (typeof window.risqueArtemisPanelIsMine === "function" && window.risqueArtemisPanelIsMine(gs, owner)) {
      try {
        delete window.__risqueArtemisPinnedDeployWaitLine;
      } catch (ePinClr) {
        /* ignore */
      }
      return true;
    }
    var local = myLocalSlot();
    if (!local) return false;
    if (owner >= 1 && owner <= 3) {
      return owner === local;
    }
    if (typeof window.risqueArtemisIsMyTurn === "function") {
      return window.risqueArtemisIsMyTurn(gs);
    }
    return false;
  }

  /** Host active deploy owner: keep turn controls mounted (setup uses EnsureSetupDeployInteractive). */
  function ensureHostActiveDeployOwnerInteractive(gs) {
    if (!hostIsActiveDeployOwner(gs)) return;
    if (isTurnDeployRoute(gs)) {
      if (typeof window.risqueArtemisEnsureTurnDeployInteractive === "function") {
        window.risqueArtemisEnsureTurnDeployInteractive(gs);
      }
      return;
    }
    if (typeof window.risqueArtemisEnsureSetupDeployInteractive === "function") {
      window.risqueArtemisEnsureSetupDeployInteractive(gs);
    } else if (typeof window.risqueArtemisEnsureDeployOwnerVoiceChrome === "function") {
      window.risqueArtemisEnsureDeployOwnerVoiceChrome(gs);
    }
  }

  /** Host laptop (P1) when it owns deploy controls — not spectator mode. */
  function hostIsActiveDeployOwner(gs) {
    if (
      !window.risqueArtemisHost ||
      window.risqueArtemisNetClient ||
      !gs ||
      String(gs.phase || "") !== "deploy"
    ) {
      return false;
    }
    if (localOwnsTurnDeploy(gs)) {
      return true;
    }
    return isMine(gs);
  }

  /** Host income-cycle deploy: wheel/reset owns troops — mirror ticks must not swap gameState or repaint. */
  function hostTurnDeployLocalOwnsLiveState(gs) {
    if (!isTurnDeployRoute(gs)) return false;
    if (typeof window.risqueArtemisIsMyTurn === "function" && !window.risqueArtemisIsMyTurn(gs)) {
      return false;
    }
    if (!hostIsActiveDeployOwner(gs)) return false;
    if (window.__risqueArtemisTurnDeployLocalEdit) return true;
    if (window.__risqueArtemisTurnDeployControlsLive) return true;
    if (
      typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
      window.risqueArtemisClientHasActiveDeploySession()
    ) {
      return true;
    }
    return false;
  }

  window.risqueArtemisHostTurnDeployLocalOwnsLiveState = hostTurnDeployLocalOwnsLiveState;

  function mayStampLocalDeploySelection(gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return false;
    if (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) {
      return true;
    }
    return hostIsActiveDeployOwner(gs);
  }

  function isSetupDeploy(gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return false;
    if (window.risqueArtemisAwaitSetupDeployFinish) return false;
    var routeGs = String(gs.risqueMirrorDeployRoute || "");
    if (routeGs === "turn" || routeGs === "deploy2") return false;
    if (routeGs === "setup" || routeGs === "deploy1") return true;
    try {
      var routeKeyEarly = localStorage.getItem("risqueMirrorDeployRoute");
      if (routeKeyEarly === "turn" || routeKeyEarly === "deploy2") return false;
      if (routeKeyEarly === "setup" || routeKeyEarly === "deploy1") return true;
    } catch (eRouteEarly) {
      /* ignore */
    }
    var trDep = window.risqueArtemisPhaseTransition;
    if (
      trDep &&
      String(trDep.target || "") === "deploy" &&
      Date.now() - (Number(trDep.at) || 0) < 15000
    ) {
      return false;
    }
    var banks = 0;
    (gs.players || []).forEach(function (p) {
      if ((Number(p.bankValue) || 0) > 0) banks += 1;
    });
    if (banks === 0) return false;
    /* Post-income turn deploy: only the active player has troops in bank. */
    if (gs.setupComplete === true && banks <= 1) return false;
    var route = String(gs.risqueMirrorDeployRoute || "");
    if (route === "turn" || route === "deploy2") return false;
    if (route === "setup" || route === "deploy1") return true;
    try {
      var routeKey = localStorage.getItem("risqueMirrorDeployRoute");
      if (routeKey === "turn" || routeKey === "deploy2") return false;
      if (routeKey === "setup" || routeKey === "deploy1") return true;
    } catch (eRoute) {
      /* ignore */
    }
    /* Hot-seat / classic: multiple banks still deploying starting armies. */
    return banks > 1;
  }

  function forceDeploySpectatorHandoffRefresh(gs) {
    deployChromeSyncKey = "";
    spectatorHintKey = "";
    deployVoiceSyncKey = "";
    window.__risqueArtemisDeploySpectatorVoiceKey = "";
    window.__risqueArtemisDeploySpectatorMounted = false;
    deployMountedFor = "";
    window.deployedTroops = {};
    window.selectedTerritory = null;
    if (gs && typeof gs === "object") {
      gs.phase = "deploy";
      delete gs.risqueDeployMirrorDraft;
      delete gs.risqueDeployTransientPrimary;
      if (typeof window.risqueArtemisClearSetupPlayerSelectArtifacts === "function") {
        window.risqueArtemisClearSetupPlayerSelectArtifacts(gs);
      }
    }
    if (window.risqueArtemisNetClient) {
      exitClientPlayMode();
    }
    window.risqueArtemisDeployHandoffPending = 0;
    var local = myLocalSlot();
    var ctrl = deployOwnerSlot(gs) || Number(gs && gs.artemisControlSlot) || 0;
    if (local >= 1 && ctrl >= 1 && ctrl !== local) {
      window.risqueArtemisDeployPushLocked = true;
    } else if (local >= 1 && ctrl === local) {
      window.risqueArtemisDeployPushLocked = false;
    }
  }

  function deploySpectatorHandoffChanged(gs) {
    if (!gs) return false;
    var syncSeq = Number(gs.risqueArtemisControlSeq) || 0;
    var ctrlSlot = deployOwnerSlot(gs) || Number(gs.artemisControlSlot) || 0;
    var lastSeq = Number(window.__risqueArtemisDeployLastSyncSeq) || 0;
    var lastCtrl = Number(window.__risqueArtemisDeployLastControlSlot) || 0;
    if (syncSeq > 0 && syncSeq !== lastSeq) return true;
    if (ctrlSlot > 0 && ctrlSlot !== lastCtrl) return true;
    return false;
  }

  /** Turn deploy: stop treating every mirror tick as a handoff (preserves selection + draft). */
  function stampDeployHandoffSyncMarkers(gs) {
    if (!gs) return;
    var syncSeq = Number(gs.risqueArtemisControlSeq) || 0;
    var ctrlSlot = deployOwnerSlot(gs) || Number(gs.artemisControlSlot) || 0;
    if (syncSeq > 0) {
      window.__risqueArtemisDeployLastSyncSeq = syncSeq;
    }
    if (ctrlSlot > 0) {
      window.__risqueArtemisDeployLastControlSlot = ctrlSlot;
    }
  }

  window.risqueArtemisStampDeployHandoffSyncMarkers = stampDeployHandoffSyncMarkers;

  function stampHandoffSpectatorChrome(chromeGs) {
    if (!chromeGs) return chromeGs;
    chromeGs.phase = "deploy";
    if (!chromeGs.risqueMirrorDeployRoute) {
      chromeGs.risqueMirrorDeployRoute = isSetupDeploy(chromeGs) ? "setup" : "turn";
    }
    if (typeof window.risqueArtemisClearSetupPlayerSelectArtifacts === "function") {
      window.risqueArtemisClearSetupPlayerSelectArtifacts(chromeGs);
    }
    var pendingSeq = Number(window.risqueArtemisDeployHandoffPending) || 0;
    if (pendingSeq > 0) {
      chromeGs.risqueArtemisControlSeq = pendingSeq;
    }
    var waitName = String(
      window.risqueArtemisDeployHandoffPlayer || chromeGs.currentPlayer || ""
    ).trim();
    if (waitName) {
      chromeGs.currentPlayer = waitName;
    }
    if (typeof window.risqueArtemisEnsureRosterOnState === "function") {
      window.risqueArtemisEnsureRosterOnState(chromeGs);
    }
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(chromeGs);
    }
    try {
      chromeGs.risquePublicDeployBanner =
        "WAITING FOR " + String(waitName || "NEXT").toUpperCase() + " TO DEPLOY";
    } catch (eBan) {
      /* ignore */
    }
    return chromeGs;
  }

  function deployMirrorDraftDeltas(mirrorGs) {
    if (
      !mirrorGs ||
      !mirrorGs.risqueDeployMirrorDraft ||
      !mirrorGs.risqueDeployMirrorDraft.deltas ||
      typeof mirrorGs.risqueDeployMirrorDraft.deltas !== "object"
    ) {
      return null;
    }
    return mirrorGs.risqueDeployMirrorDraft.deltas;
  }

  /** True when incoming mirror carries new/changed +N deploy deltas (live client deploy edits). */
  function deployMirrorDeltasChanged(localGs, mirrorGs) {
    var inDraft = deployMirrorDraftDeltas(mirrorGs);
    if (!inDraft) return false;
    var inHas = false;
    Object.keys(inDraft).forEach(function (k) {
      if (Number(inDraft[k]) > 0) inHas = true;
    });
    if (!inHas) return false;
    var localDraft = deployMirrorDraftDeltas(localGs);
    if (!localDraft) return true;
    var keys = Object.keys(inDraft);
    var i;
    for (i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var inVal = Number(inDraft[key]) || 0;
      var localVal = Number(localDraft[key]) || 0;
      if (inVal !== localVal) return true;
    }
    keys = Object.keys(localDraft);
    for (i = 0; i < keys.length; i += 1) {
      var lk = keys[i];
      if ((Number(localDraft[lk]) || 0) > 0 && (Number(inDraft[lk]) || 0) === 0) {
        return true;
      }
    }
    var inSel =
      mirrorGs.risqueDeployMirrorDraft.selected != null
        ? String(mirrorGs.risqueDeployMirrorDraft.selected)
        : "";
    var localSel =
      localGs &&
      localGs.risqueDeployMirrorDraft &&
      localGs.risqueDeployMirrorDraft.selected != null
        ? String(localGs.risqueDeployMirrorDraft.selected)
        : "";
    if (inSel !== localSel) return true;
    return false;
  }

  /** Outgoing deployer may still show stale voice/banner after optimistic handoff bump. */
  function deploySpectatorChromeNeedsRefresh(localGs, mirrorGs) {
    if (!mirrorGs) return false;
    localGs = localGs || {};
    var waitName = deployingDisplayName(mirrorGs);
    var ctrl = deployOwnerSlot(mirrorGs) || Number(mirrorGs.artemisControlSlot) || 0;
    var voiceKey = "wait:" + ctrl + ":" + normName(waitName);
    if (voiceKey !== String(window.__risqueArtemisDeploySpectatorVoiceKey || "")) {
      return true;
    }
    var authCp = normName(mirrorGs.currentPlayer);
    var localCp = normName(localGs.currentPlayer);
    var authCtrl = deployOwnerSlot(mirrorGs) || Number(mirrorGs.artemisControlSlot) || 0;
    var localCtrl = deployOwnerSlot(localGs) || Number(localGs.artemisControlSlot) || 0;
    if (authCp && authCp !== localCp) return true;
    if (authCtrl > 0 && authCtrl !== localCtrl) return true;
    var mirrorBanner = String(mirrorGs.risquePublicDeployBanner || "").trim();
    var localBanner = String(localGs.risquePublicDeployBanner || "").trim();
    if (mirrorBanner && mirrorBanner !== localBanner) {
      if (
        /^WAITING FOR .+ TO DEPLOY$/i.test(mirrorBanner) &&
        localBanner &&
        !/^WAITING FOR .+ TO DEPLOY$/i.test(localBanner)
      ) {
        return false;
      }
      return true;
    }
    if (deployMirrorDraftVoiceSuffix(mirrorGs) !== deployMirrorDraftVoiceSuffix(localGs)) {
      return true;
    }
    return false;
  }

  function deploySpectatorWaitBanner(line) {
    return /^WAITING FOR .+ TO DEPLOY$/i.test(String(line || "").trim());
  }

  /** Wheel-only owner warnings must not stick on spectator laptops (e.g. Guido during Mictor deploy). */
  function deploySpectatorSanitizeReport(gs, repLine) {
    repLine = String(repLine || "").trim();
    if (!repLine) return "";
    if (typeof window.risqueDeploySanitizeSpectatorReport === "function") {
      repLine = window.risqueDeploySanitizeSpectatorReport(repLine);
      if (!repLine) return "";
    }
    var active = deployingPlayerRecord(gs);
    var bank = active ? Number(active.bankValue) || 0 : -1;
    var lower = repLine.toLowerCase();
    if (
      bank > 0 &&
      (lower.indexOf("no troops left") >= 0 ||
        lower.indexOf("deploy every troop") >= 0 ||
        lower.indexOf("could not send") >= 0)
    ) {
      return "";
    }
    return repLine;
  }

  function deploySpectatorDraftTroopPhrase(gs) {
    if (!gs || !gs.risqueDeployMirrorDraft || typeof gs.risqueDeployMirrorDraft !== "object") {
      return "";
    }
    var draft = gs.risqueDeployMirrorDraft;
    if (draft.selected == null || String(draft.selected).trim() === "") {
      return "";
    }
    var sel = String(draft.selected).trim();
    if (!deployTerritoryOwnedByCurrent(gs, sel)) {
      return "";
    }
    var dep = {};
    if (draft.deltas && typeof draft.deltas === "object") {
      Object.keys(draft.deltas).forEach(function (k) {
        var dv = Number(draft.deltas[k]);
        if (Number.isFinite(dv) && dv > 0) {
          dep[k] = dv;
        }
      });
    }
    var nSel = dep[sel] || 0;
    if (nSel > 0 && typeof window.risqueDeployTroopsDeployedToPhrase === "function") {
      return window.risqueDeployTroopsDeployedToPhrase(nSel, sel);
    }
    return "";
  }

  function deployMirrorDraftVoiceSuffix(gs) {
    var draft = gs && gs.risqueDeployMirrorDraft;
    if (!draft || typeof draft !== "object") return "";
    var sel = draft.selected != null ? String(draft.selected).trim() : "";
    var deltas = draft.deltas && typeof draft.deltas === "object" ? draft.deltas : {};
    var parts = [];
    Object.keys(deltas)
      .sort()
      .forEach(function (k) {
        parts.push(k + "=" + String(deltas[k]));
      });
    return sel + "|" + parts.join(",");
  }

  function deploySpectatorLiveNarrationLine(gs) {
    if (!gs) return "";
    if (typeof window.risqueBuildDeployVoiceLinesFromState === "function") {
      var built = window.risqueBuildDeployVoiceLinesFromState(gs, { includeDeployerName: true });
      if (built && built.primary && !deploySpectatorWaitBanner(built.primary)) {
        return built.primary;
      }
    }
    var banner = String(gs.risquePublicDeployBanner || "").trim();
    if (
      banner &&
      !deploySpectatorWaitBanner(banner) &&
      !/IS DEPLOYING/i.test(banner) &&
      !/from your bank/i.test(banner)
    ) {
      return banner;
    }
    return "";
  }

  function deploySpectatorControlVoiceText(gs) {
    if (!gs) return "";
    if (typeof window.risqueBuildDeployVoiceLinesFromState === "function") {
      var built = window.risqueBuildDeployVoiceLinesFromState(gs, { includeDeployerName: true });
      if (built && built.primary && !deploySpectatorWaitBanner(built.primary)) {
        return built.primary;
      }
    }
    var cv =
      gs.risqueControlVoice && typeof gs.risqueControlVoice === "object"
        ? gs.risqueControlVoice
        : null;
    if (cv && cv.primary != null) {
      var pri = String(cv.primary).trim();
      if (
        pri &&
        !deploySpectatorWaitBanner(pri) &&
        !/IS DEPLOYING/i.test(pri) &&
        !/from your bank/i.test(pri) &&
        !/DEPLOY ALL TROOPS/i.test(pri) &&
        !/FIRST DEPLOYMENT/i.test(pri)
      ) {
        return pri;
      }
    }
    var banner = deploySpectatorLiveNarrationLine(gs);
    if (banner) return banner;
    var waitName = deployingDisplayName(gs);
    return "WAITING FOR " + waitName.toUpperCase() + " TO DEPLOY";
  }

  function deploySpectatorDepsFromState(gs) {
    var dep = {};
    var draft =
      gs &&
      gs.risqueDeployMirrorDraft &&
      typeof gs.risqueDeployMirrorDraft === "object"
        ? gs.risqueDeployMirrorDraft
        : null;
    if (draft && draft.deltas && typeof draft.deltas === "object") {
      Object.keys(draft.deltas).forEach(function (k) {
        var dv = Number(draft.deltas[k]);
        if (Number.isFinite(dv) && dv > 0) dep[k] = dv;
      });
      if (
        draft.selected != null &&
        String(draft.selected) !== "" &&
        typeof window.risqueArtemisIsMyTurn === "function" &&
        window.risqueArtemisIsMyTurn(gs)
      ) {
        var draftSel = String(draft.selected);
        if (deployTerritoryOwnedByCurrent(gs, draftSel)) {
          window.selectedTerritory = draftSel;
        }
      }
    }
    return dep;
  }

  function applyDeploySpectatorControlVoice(gs) {
    if (!gs || !window.risqueRuntimeHud || typeof window.risqueRuntimeHud.setControlVoiceText !== "function") {
      return;
    }
    sanitizeDeployMirrorDraft(gs);
    var waitName = deployingDisplayName(gs);
    var ctrl = deployOwnerSlot(gs) || Number(gs.artemisControlSlot) || 0;
    var voiceKey = "wait:" + ctrl + ":" + normName(waitName);
    var builtSpectator =
      typeof window.risqueBuildDeployVoiceLinesFromState === "function"
        ? window.risqueBuildDeployVoiceLinesFromState(gs, { includeDeployerName: true })
        : null;
    var line = deploySpectatorControlVoiceText(gs);
    if (!line) {
      line =
        "WAITING FOR " + String(waitName || "NEXT").toUpperCase() + " TO DEPLOY";
    }
    if (line && !deploySpectatorWaitBanner(line)) {
      try {
        gs.risquePublicDeployBanner = line;
      } catch (eBannerSync) {
        /* ignore */
      }
    }
    window.__risqueArtemisDeploySpectatorVoiceKey = voiceKey;
    if (deploySpectatorWaitBanner(line)) {
      window.__risqueArtemisPinnedDeployWaitLine = line;
    } else {
      try {
        delete window.__risqueArtemisPinnedDeployWaitLine;
      } catch (ePinClr) {
        /* ignore */
      }
    }
    var repLine = deploySpectatorSanitizeReport(
      gs,
      String(gs.risquePublicDeployReport || "").trim() ||
        (gs.risqueControlVoice && gs.risqueControlVoice.report != null
          ? String(gs.risqueControlVoice.report).trim()
          : "")
    );
    if (!repLine && builtSpectator && builtSpectator.report) {
      repLine = builtSpectator.report;
    }
    var repClass = "ucp-voice-report ucp-voice-report--public-deploy";
    window.risqueRuntimeHud.setControlVoiceText(line, repLine, {
      skipMirror: true,
      reportClass: repClass
    });
    try {
      gs.risquePublicDeployReport = repLine;
      gs.risqueControlVoice = { primary: line, report: repLine, reportClass: repClass };
      if (window.gameState === gs || !window.gameState) {
        window.gameState = gs;
      } else if (window.gameState && String(window.gameState.phase || "") === "deploy") {
        window.gameState.risquePublicDeployBanner = gs.risquePublicDeployBanner;
        window.gameState.risquePublicDeployReport = gs.risquePublicDeployReport;
        window.gameState.risqueControlVoice = gs.risqueControlVoice;
        if (gs.risqueDeployMirrorDraft) {
          window.gameState.risqueDeployMirrorDraft = gs.risqueDeployMirrorDraft;
        }
      }
    } catch (eCvSync) {
      /* ignore */
    }
  }

  /** Active deploy owner (host wheel / client wheel): inline typography beats .ucp-terminal 15px + mirror CSS flicker. */
  window.risqueArtemisEnsureDeployOwnerVoiceChrome = function (gsOpt) {
    if (!window.risqueArtemisMode) return;
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || String(gs.phase || "") !== "deploy") return;
    var owns =
      (typeof window.risqueArtemisLocalOwnsSetupDeploy === "function" &&
        window.risqueArtemisLocalOwnsSetupDeploy(gs)) ||
      isMine(gs) ||
      (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs));
    if (!owns) return;
    try {
      document.body.setAttribute("data-risque-phase", "deploy");
    } catch (ePh) {
      /* ignore */
    }
    document.documentElement.classList.add("risque-artemis-setup-deploy");
    document.documentElement.classList.add("risque-artemis-my-turn");
    if (window.risqueArtemisHost) {
      document.documentElement.classList.add("risque-artemis-host");
    } else if (window.risqueArtemisNetClient) {
      document.documentElement.classList.add("risque-artemis-client");
    }
    var hudRoot = document.getElementById("runtime-hud-root");
    if (hudRoot) {
      hudRoot.classList.add("runtime-hud-root--artemis-compact");
      hudRoot.classList.add("runtime-hud-root--setup");
    }
    var cv = document.getElementById("control-voice");
    var vt = document.getElementById("control-voice-text");
    var vr = document.getElementById("control-voice-report");
    var priPx = "30px";
    var repPx = "23px";
    var voiceFont = '"Segoe UI", Arial, Helvetica, sans-serif';
    if (cv) {
      cv.classList.add("ucp-control-voice--artemis-deploy-owner");
      cv.style.setProperty("height", "168px", "important");
      cv.style.setProperty("min-height", "168px", "important");
      cv.style.setProperty("max-height", "168px", "important");
      cv.style.setProperty("--risque-voice-font-size", priPx, "important");
      cv.style.setProperty("--risque-voice-report-size", repPx, "important");
    }
    if (vt) {
      vt.style.setProperty("font-family", voiceFont, "important");
      vt.style.setProperty("font-size", priPx, "important");
      vt.style.setProperty("font-weight", "700", "important");
      vt.style.setProperty("line-height", "1.38", "important");
    }
    if (vr) {
      vr.style.setProperty("font-family", voiceFont, "important");
      vr.style.setProperty("font-size", repPx, "important");
      vr.style.setProperty("font-weight", "600", "important");
      vr.style.setProperty("line-height", "1.4", "important");
      if (vr.textContent && String(vr.textContent).trim()) {
        vr.style.setProperty("display", "block", "important");
      }
    }
    var msgs = cv && cv.querySelector ? cv.querySelector(".ucp-voice-messages") : null;
    if (msgs) {
      msgs.style.setProperty("font-size", priPx, "important");
    }
    window.__risqueDeployVoiceTypographyStamped = Date.now();
  };

  /** Active deploy owner: selection + bank live in CV report; primary stays troop budget headline. */
  function deployOwnerSelectionVoicePrimary(gs) {
    return "";
  }

  /** Mirror + spectator laptops: paint deploy narration without clobbering active deployer's local voice. */
  window.risqueArtemisApplyDeployVoiceFromState = function (gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return;
    sanitizeDeployMirrorDraft(gs);
    if (isMine(gs)) {
      var built =
        typeof window.risqueBuildDeployVoiceLinesFromState === "function"
          ? window.risqueBuildDeployVoiceLinesFromState(gs)
          : null;
      var cvObj = gs.risqueControlVoice && typeof gs.risqueControlVoice === "object" ? gs.risqueControlVoice : null;
      var pri =
        built && built.primary
          ? built.primary
          : cvObj && cvObj.primary != null
            ? String(cvObj.primary).trim()
            : "";
      var rep =
        built && built.report
          ? built.report
          : cvObj && cvObj.report != null
            ? String(cvObj.report).trim()
            : String(gs.risquePublicDeployReport || "").trim();
      if (!pri && typeof window.risqueRefreshDeployNarration === "function") {
        window.risqueRefreshDeployNarration(gs);
        return;
      }
      if (
        pri &&
        window.risqueRuntimeHud &&
        typeof window.risqueRuntimeHud.setControlVoiceText === "function"
      ) {
        var voiceStamp = pri + "\n" + rep;
        var vtCur = document.getElementById("control-voice-text");
        var vrCur = document.getElementById("control-voice-report");
        if (
          window.__risqueDeployOwnerVoiceStamp === voiceStamp &&
          vtCur &&
          vrCur &&
          String(vtCur.textContent || "").trim() === pri &&
          String(vrCur.textContent || "").trim() === rep
        ) {
          return;
        }
        window.__risqueDeployOwnerVoiceStamp = voiceStamp;
        var repClass =
          cvObj && cvObj.reportClass ? String(cvObj.reportClass) : "ucp-voice-report ucp-voice-report--public-deploy";
        window.risqueRuntimeHud.setControlVoiceText(pri, rep, {
          reportClass: repClass,
          skipMirror: true,
          artemisDeployOwner: true
        });
        try {
          gs.risqueControlVoice = {
            primary: pri,
            report: rep,
            reportClass: repClass
          };
          gs.risquePublicDeployBanner = pri;
          gs.risquePublicDeployReport = rep;
        } catch (eCvPin) {
          /* ignore */
        }
      }
      if (typeof window.risqueArtemisEnsureDeployOwnerVoiceChrome === "function") {
        window.risqueArtemisEnsureDeployOwnerVoiceChrome(gs);
      }
      return;
    }
    applyDeploySpectatorControlVoice(gs);
  };

  function paintDeploySpectatorMap(gs) {
    if (typeof window.risqueArtemisPaintDeployMapFromState === "function") {
      window.risqueArtemisPaintDeployMapFromState(gs);
      if (window.gameUtils && typeof window.gameUtils.renderStats === "function") {
        try {
          window.gameUtils.renderStats(gs);
        } catch (eStats) {
          /* ignore */
        }
      }
      return;
    }
    var dep = deploySpectatorDepsFromState(gs);
    window.deployedTroops = dep;
    if (window.gameUtils) {
      try {
        window.gameUtils.renderAll(gs, null, dep);
      } catch (eMap) {
        /* ignore */
      }
      try {
        window.gameUtils.renderStats(gs);
      } catch (eStats) {
        /* ignore */
      }
    }
  }

  /** Live mirror tick — voice + map only; no HUD rebuild (avoids blink + empty voice). */
  function applyDeploySpectatorLiveRefresh(gs) {
    if (!gs) return;
    if (hostTurnDeployLocalOwnsLiveState(gs)) {
      return;
    }
    window.gameState = gs;
    try {
      document.body.setAttribute("data-risque-phase", "deploy");
    } catch (ePh) {
      /* ignore */
    }
    document.documentElement.classList.add("risque-artemis-setup-deploy");
    applyDeploySpectatorControlVoice(gs);
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
      try {
        window.risqueRuntimeHud.updateTurnBannerFromState(gs);
      } catch (eBanner) {
        /* ignore */
      }
    }
    paintDeploySpectatorMap(gs);
    if (artemisClientSpectatesDeploy(gs) && typeof stampDeployHandoffSyncMarkers === "function") {
      stampDeployHandoffSyncMarkers(gs);
    }
  }

  function updateDeploySpectatorView(gs, opts) {
    opts = opts || {};
    if (!gs) return;
    window.gameState = gs;
    var light = opts.light === true || (opts.light !== false && window.__risqueArtemisDeploySpectatorMounted);
    if (light) {
      applyDeploySpectatorLiveRefresh(gs);
      return;
    }
    window.__risqueArtemisDeploySpectatorMounted = true;
    syncDeployChrome(gs);
    if (!window.risqueArtemisMode) {
      mountSpectatorHint(gs);
    }
    applyDeploySpectatorControlVoice(gs);
    paintDeploySpectatorMap(gs);
  }

  function artemisClientSpectatesDeploy(gs) {
    if (!window.risqueArtemisNetClient || window.risqueArtemisHost || !gs) return false;
    if (String(gs.phase || "") !== "deploy") return false;
    var mySlot = myLocalSlot();
    var ctrl = deployOwnerSlot(gs) || Number(gs.artemisControlSlot) || 0;
    if (mySlot >= 1 && ctrl >= 1 && mySlot === ctrl) return false;
    return true;
  }

  /** Client spectators (Nooch): paint +N satellites and narration from mirror or deploy_live relay. */
  window.risqueArtemisApplyDeploySpectatorFromState = function (gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return;
    if (!artemisClientSpectatesDeploy(gs)) return;
    if (!gs.risqueMirrorDeployRoute) {
      gs.risqueMirrorDeployRoute = isSetupDeploy(gs) ? "setup" : "turn";
    }
    updateDeploySpectatorView(gs);
  };

  /** Mirror / HUD hooks — refresh spectator deploy voice without tearing down controls every tick. */
  window.risqueArtemisRefreshDeploySpectator = function (gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return;
    if (window.risqueArtemisHost && !window.risqueArtemisNetClient) {
      if (hostTurnDeployLocalOwnsLiveState(gs)) {
        return;
      }
      if (hostIsActiveDeployOwner(gs)) {
        if (typeof window.risqueArtemisApplyDeployVoiceFromState === "function") {
          window.risqueArtemisApplyDeployVoiceFromState(gs);
        }
        ensureHostActiveDeployOwnerInteractive(gs);
        paintDeploySpectatorMap(gs);
        return;
      }
      if (typeof window.risqueArtemisApplyHostDeploySpectator === "function") {
        window.risqueArtemisApplyHostDeploySpectator(gs);
      }
      return;
    }
    if (artemisClientSpectatesDeploy(gs)) {
      updateDeploySpectatorView(gs, { light: true });
      return;
    }
    if (
      typeof window.risqueArtemisIsMyTurn === "function" &&
      window.risqueArtemisIsMyTurn(gs)
    ) {
      if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
        window.risqueArtemisEnsureClientActivePlay(gs);
      }
      if (
        String(gs.phase || "") === "deploy" &&
        typeof window.risqueArtemisSyncPortableDeploy === "function"
      ) {
        window.risqueArtemisSyncPortableDeploy(gs);
      }
      return;
    }
    updateDeploySpectatorView(gs);
  };

  window.risqueArtemisForceDeploySpectatorHandoffRefresh = forceDeploySpectatorHandoffRefresh;
  window.risqueArtemisIsSetupDeploy = isSetupDeploy;
  window.risqueArtemisLocalOwnsSetupDeploy = function (gsOpt) {
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    return isSetupDeploy(gs) && isMine(gs);
  };
  window.risqueArtemisHostIsActiveDeployOwner = hostIsActiveDeployOwner;
  window.risqueDeployOwnerSelectionVoicePrimary = deployOwnerSelectionVoicePrimary;
  window.risqueDeploySpectatorControlVoiceText = deploySpectatorControlVoiceText;

  /** Host map + HUD: paint live setup deploy from client player_state (real-time mirror). */
  window.risqueArtemisApplyHostDeploySpectator = function (gs) {
    if (!window.risqueArtemisHost || !gs || String(gs.phase || "") !== "deploy") return;
    if (
      typeof window.risqueArtemisIsMyTurn === "function" &&
      !window.risqueArtemisIsMyTurn(gs)
    ) {
      window.__risqueArtemisTurnDeployControlsLive = false;
      window.__risqueArtemisTurnDeployLocalEdit = false;
    }
    if (hostTurnDeployLocalOwnsLiveState(gs)) {
      return;
    }
    if (hostIsActiveDeployOwner(gs)) {
      window.gameState = gs;
      if (typeof window.risqueArtemisApplyDeployVoiceFromState === "function") {
        window.risqueArtemisApplyDeployVoiceFromState(gs);
      }
      ensureHostActiveDeployOwnerInteractive(gs);
      paintDeploySpectatorMap(gs);
      return;
    }
    var setup = isSetupDeploy(gs);
    if (setup) {
      stopDeployWatchdog();
      deployMountedFor = "";
      window.risqueDeploy1Active = false;
      if (deployControlsPresent()) {
        if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
          window.risqueTeardownArtemisSetupDeploy(true);
        }
        var hostDock = document.getElementById(DOCK_ID);
        if (hostDock) {
          hostDock.innerHTML = "";
          hostDock.hidden = true;
        }
      }
    } else if (
      typeof window.risqueArtemisDeployTurnSessionNeedsReset === "function" &&
      window.risqueArtemisDeployTurnSessionNeedsReset(gs)
    ) {
      resetDeployTurnSession(gs);
    }

    document.documentElement.classList.remove("risque-artemis-my-turn");

    delete gs.risqueDeploySuppressPublicSpectator;
    delete gs.risqueDeployUseFrozenPublicMirror;
    delete gs.risqueDeployPublicMirrorSnapshot;
    delete gs.risqueDeployTurnTroopBaseline;
    delete gs.risquePublicDeployProcessing;

    window.gameState = gs;

    if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    }

    if (typeof window.risqueArtemisEnsureOmniClientHud === "function") {
      window.risqueArtemisEnsureOmniClientHud(gs);
    }
    if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
      window.risqueArtemisEnsureHudTogglesVisible();
    }

    if (typeof window.risqueArtemisPaintDeployMapFromState === "function") {
      window.risqueArtemisPaintDeployMapFromState(gs);
    } else {
      var dep = deploySpectatorDepsFromState(gs);
      window.deployedTroops = dep;
      if (window.gameUtils) {
        try {
          window.gameUtils.renderAll(gs, null, dep);
        } catch (eMap) {
          /* ignore */
        }
      }
    }
    if (window.gameUtils && typeof window.gameUtils.renderStats === "function") {
      try {
        window.gameUtils.renderStats(gs);
      } catch (eStats) {
        /* ignore */
      }
    }
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
    applyDeploySpectatorControlVoice(gs);
  };

  function deployingPlayerRecord(gs) {
    if (!gs || !Array.isArray(gs.players)) return null;
    var up = String(gs.currentPlayer || "").trim();
    if (up) {
      var k;
      for (k = 0; k < gs.players.length; k += 1) {
        if (normName(gs.players[k].name) === normName(up)) {
          return gs.players[k];
        }
      }
    }
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (ctrl >= 1 && ctrl <= 3) {
      var roster = gs.artemisRoster;
      if (roster && Array.isArray(roster)) {
        var hit = roster.find(function (r) {
          return Number(r.slot) === ctrl;
        });
        if (hit && hit.name) {
          var i;
          for (i = 0; i < gs.players.length; i += 1) {
            if (normName(gs.players[i].name) === normName(hit.name)) {
              return gs.players[i];
            }
          }
        }
      }
      var j;
      for (j = 0; j < gs.players.length; j += 1) {
        if (Number(gs.players[j].playerOrder) === ctrl) {
          return gs.players[j];
        }
      }
      if (gs.players[ctrl - 1]) return gs.players[ctrl - 1];
    }
    return null;
  }

  function deployingDisplayName(gs) {
    var p = deployingPlayerRecord(gs);
    if (p && p.name) return String(p.name);
    return gs && gs.currentPlayer ? String(gs.currentPlayer) : "?";
  }

  /** Host + clients: paint deploy map from mirror without rebuilding controls. */
  window.risqueArtemisApplyDeploySpectatorMap = function (gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return;
    var spectatorWatching =
      typeof window.risqueArtemisIsMyTurn === "function" && !window.risqueArtemisIsMyTurn(gs);
    if (
      deployTurnSessionNeedsReset(gs) &&
      (!spectatorWatching || deploySpectatorHandoffChanged(gs))
    ) {
      resetDeployTurnSession(gs);
    }
    paintDeploySpectatorMap(gs);
    if (artemisClientSpectatesDeploy(gs)) {
      stampDeployHandoffSyncMarkers(gs);
    }
    if (typeof window.risqueArtemisApplyDeployVoiceFromState === "function" && isMine(gs)) {
      window.risqueArtemisApplyDeployVoiceFromState(gs);
    } else {
      applyDeploySpectatorControlVoice(gs);
    }
  };

  function deployControlsPresent() {
    return !!document.getElementById("deploy1-confirm");
  }

  /** Persistent mount point — not cleared when #risque-phase-content is wiped. */
  window.risqueArtemisEnsureDeployDock = function () {
    var dock = document.getElementById(DOCK_ID);
    if (dock) {
      dock.hidden = false;
      return dock;
    }
    var phaseSlot = document.getElementById("risque-phase-content");
    var overlay = document.getElementById("ui-overlay");
    dock = document.createElement("div");
    dock.id = DOCK_ID;
    dock.className = "risque-artemis-deploy-dock";
    dock.setAttribute("role", "region");
    dock.setAttribute("aria-label", "Deployment controls");
    if (phaseSlot && phaseSlot.parentNode) {
      phaseSlot.parentNode.insertBefore(dock, phaseSlot.nextSibling);
    } else if (overlay) {
      overlay.appendChild(dock);
    } else {
      document.body.appendChild(dock);
    }
    return dock;
  };

  function hideDeployDock() {
    var dock = document.getElementById(DOCK_ID);
    if (dock) {
      dock.innerHTML = "";
      dock.hidden = true;
    }
  }

  function syncDeployChrome(gs) {
    if (!gs) return;
    var chromeKey =
      String(gs.phase || "") +
      ":" +
      String(deployOwnerSlot(gs) || gs.artemisControlSlot || "") +
      ":" +
      String(gs.currentPlayer || "") +
      ":" +
      String(gs.risqueArtemisControlSeq || "") +
      ":" +
      String(window.risqueArtemisDeployHandoffPending || 0);
    var voiceKey =
      String(deployOwnerSlot(gs) || gs.artemisControlSlot || "") +
      ":" +
      String(gs.risquePublicDeployBanner || "") +
      ":" +
      String(gs.risquePublicDeployReport || "").slice(0, 40) +
      ":sel:" +
      String(
        window.selectedTerritory ||
          (gs.risqueDeployMirrorDraft && gs.risqueDeployMirrorDraft.selected) ||
          ""
      ) +
      ":dep:" +
      deployMirrorDraftVoiceSuffix(gs);
    if (chromeKey === deployChromeSyncKey) {
      if (
        voiceKey !== deployVoiceSyncKey &&
        typeof window.risqueArtemisApplyDeployVoiceFromState === "function"
      ) {
        deployVoiceSyncKey = voiceKey;
        window.risqueArtemisApplyDeployVoiceFromState(gs);
      }
      return;
    }
    deployChromeSyncKey = chromeKey;
    deployVoiceSyncKey = voiceKey;

    document.documentElement.classList.add("risque-artemis-setup-deploy");
    try {
      document.body.setAttribute("data-risque-phase", "deploy");
    } catch (ePh) {
      /* ignore */
    }

    if (typeof window.risqueArtemisEnsureOmniClientHud === "function") {
      window.risqueArtemisEnsureOmniClientHud(gs);
    }

    var uio = document.getElementById("ui-overlay");
    var hudRoot = document.getElementById("runtime-hud-root");
    if (
      uio &&
      !hudRoot &&
      window.risqueRuntimeHud &&
      typeof window.risqueRuntimeHud.ensureSetupHud === "function"
    ) {
      window.risqueRuntimeHud.ensureSetupHud(uio, null);
    }

    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
      window.risqueRuntimeHud.updateTurnBannerFromState(gs);
    }
    if (window.gameUtils && gs) {
      try {
        window.gameUtils.renderStats(gs);
      } catch (eStats) {
        /* ignore */
      }
    }
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    } else if (typeof window.risqueWireHostPrivateStatsToggleOnce === "function") {
      window.risqueWireHostPrivateStatsToggleOnce();
    }
    if (typeof window.risqueArtemisApplyDeployVoiceFromState === "function") {
      window.risqueArtemisApplyDeployVoiceFromState(gs);
    } else if (isMine(gs) && typeof window.risqueArtemisEnsureDeployOwnerVoiceChrome === "function") {
      window.risqueArtemisEnsureDeployOwnerVoiceChrome(gs);
    }
    if (typeof window.risqueSyncMapRoundIndicatorFromState === "function") {
      window.risqueSyncMapRoundIndicatorFromState(gs);
    }
    var corner = document.getElementById("risque-board-corner-tools");
    if (corner && window.risqueArtemisMode && window.risqueArtemisNetClient) {
      corner.hidden = true;
    } else if (corner && window.risqueArtemisHost) {
      corner.hidden = false;
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
      try {
        window.risqueRuntimeHud.syncPosition();
      } catch (eSync) {
        /* ignore */
      }
    }
  }

  function clearDeployChrome() {
    document.documentElement.classList.remove("risque-artemis-setup-deploy");
    document.documentElement.classList.remove("risque-artemis-my-turn");
  }

  function teardownDeployUI(clearMount) {
    if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
      window.risqueTeardownArtemisSetupDeploy(clearMount);
    } else {
      window.risqueDeploy1Active = false;
      if (clearMount !== false) {
        hideDeployDock();
        var slot = document.getElementById("risque-phase-content");
        if (slot) slot.innerHTML = "";
      }
    }
    deployMountedFor = "";
    stopDeployWatchdog();
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
    var ghost = document.getElementById("risque-public-hostlike-round-bar");
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
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

  function mountSpectatorHint(gs) {
    if (window.risqueArtemisMode) {
      return;
    }
    hideDeployDock();
    var slot = document.getElementById("risque-phase-content");
    if (!slot) return;
    var name = deployingDisplayName(gs);
    var ctrl = deployOwnerSlot(gs) || Number(gs.artemisControlSlot) || 0;
    var hintKey = ctrl + ":" + normName(name);
    if (hintKey === spectatorHintKey && slot.querySelector(".risque-artemis-deploy-spectate")) {
      return;
    }
    spectatorHintKey = hintKey;
    var p = deployingPlayerRecord(gs);
    var color =
      p && window.gameUtils && window.gameUtils.colorMap
        ? window.gameUtils.colorMap[p.color] || "#ffffff"
        : "#ffffff";
    slot.innerHTML =
      '<div class="risque-artemis-deploy-spectate" role="status">' +
      "<p>Waiting for <strong style=\"color:" +
      color +
      '">' +
      name.toUpperCase() +
      "</strong></p>" +
      "<p>Only their laptop has deploy controls for this turn.</p>" +
      "</div>";
  }

  function mountRealDeploy(gs) {
    if (!gs || !isMine(gs)) return;
    if (
      typeof window.risqueArtemisSetupDeployMirrorReady === "function" &&
      !window.risqueArtemisSetupDeployMirrorReady(gs)
    ) {
      try {
        console.info("[ARTEMIS deploy] waiting for complete mirror before mount", gs.currentPlayer);
      } catch (eWait) {
        /* ignore */
      }
      return;
    }
    var up = normName(gs.currentPlayer);
    var ctrl = deployOwnerSlot(gs) || Number(gs.artemisControlSlot) || 0;
    var mountKey = String(ctrl) + ":" + up;
    if (deployMountedFor === mountKey && deployControlsPresent()) {
      if (
        typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
        window.risqueArtemisClientHasActiveDeploySession()
      ) {
        document.documentElement.classList.add("risque-artemis-my-turn");
        return;
      }
      if (typeof window.risqueArtemisRefreshSetupDeploySession === "function") {
        window.risqueArtemisRefreshSetupDeploySession(gs);
      }
      document.documentElement.classList.add("risque-artemis-my-turn");
      return;
    }

    teardownDeployUI(false);
    deployMountedFor = mountKey;
    document.documentElement.classList.add("risque-artemis-my-turn");
    if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
      window.risqueArtemisEnsureClientActivePlay(gs);
    }
    window.risqueArtemisEnsureDeployDock();

    var phaseSlot = document.getElementById("risque-phase-content");
    if (phaseSlot) phaseSlot.innerHTML = "";

    if (
      !window.risquePhases ||
      !window.risquePhases.deploy ||
      typeof window.risquePhases.deploy.runSetup !== "function"
    ) {
      try {
        console.warn("[ARTEMIS deploy] runSetup unavailable — load phases/firstdeploy.js and deploy.js");
      } catch (eLog) {
        /* ignore */
      }
      return;
    }

    try {
      console.info("[ARTEMIS deploy] mounting real controls for", gs.currentPlayer);
    } catch (eLog2) {
      /* ignore */
    }

    var stageHost = document.getElementById("stage-host") || document.body;
    window.risquePhases.deploy.runSetup(stageHost, {
      log: function (line) {
        try {
          console.info("[ARTEMIS deploy]", line);
        } catch (eLn) {
          /* ignore */
        }
      }
    });

    startDeployWatchdog();
  }

  function stopDeployWatchdog() {
    if (deployWatchTimer) {
      clearTimeout(deployWatchTimer);
      deployWatchTimer = null;
    }
  }

  function startDeployWatchdog() {
    if (deployWatchTimer) return;
    var tick = function () {
      deployWatchTimer = null;
      var gs = window.gameState;
      if (!gs || !isSetupDeploy(gs)) {
        stopDeployWatchdog();
        return;
      }
      if (!isMine(gs)) {
        stopDeployWatchdog();
        return;
      }
      if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
        window.risqueArtemisEnsureClientActivePlay(gs);
      }
      if (!deployControlsPresent()) {
        deployMountedFor = "";
        mountRealDeploy(gs);
      }
      if (typeof window.risqueArtemisEnsureDeployOwnerVoiceChrome === "function") {
        window.risqueArtemisEnsureDeployOwnerVoiceChrome(gs);
      }
      deployWatchTimer = setTimeout(tick, 450);
    };
    deployWatchTimer = setTimeout(tick, 450);
  }

  window.risqueArtemisEnsureSetupDeployInteractive = function (gsOpt) {
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || !isSetupDeploy(gs) || !isMine(gs)) return;
    if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
      window.risqueArtemisEnsureClientActivePlay(gs);
    }
    if (!deployControlsPresent()) {
      deployMountedFor = "";
      mountRealDeploy(gs);
    } else {
      startDeployWatchdog();
    }
  };

  /** Outgoing deployer after CONFIRM — stop session, exit play mode, show spectator only. */
  window.risqueArtemisRelinquishDeployControl = function (gs, opts) {
    opts = opts || {};
    stopDeployWatchdog();
    deployMountedFor = "";
    window.risqueDeploy1Active = false;
    teardownDeployUI(true);
    document.documentElement.classList.remove("risque-artemis-my-turn");
    if (window.risqueArtemisNetClient) {
      exitClientPlayMode();
    }
    clearDeployChrome();
    if (gs) {
      var chromeGs = gs;
      if (opts.handoffPending && window.risqueArtemisDeployHandoffPlayer) {
        try {
          chromeGs = JSON.parse(JSON.stringify(gs));
        } catch (eClone) {
          chromeGs = gs;
        }
        stampHandoffSpectatorChrome(chromeGs);
      }
      if (!opts.handoffPending) {
        window.gameState = gs;
      } else {
        window.gameState = chromeGs;
      }
      if (opts.handoffPending) {
        var waitCtrl = deployOwnerSlot(chromeGs) || Number(chromeGs.artemisControlSlot) || 0;
        spectatorHintKey = "handoff:" + waitCtrl + ":" + normName(chromeGs.currentPlayer);
      } else {
        spectatorHintKey = "";
      }
      syncDeployChrome(chromeGs);
      if (typeof window.risqueArtemisClearSetupPlayerSelectArtifacts === "function") {
        window.risqueArtemisClearSetupPlayerSelectArtifacts(chromeGs);
      }
      if (typeof window.risqueArtemisReplaceShellGameState === "function") {
        window.risqueArtemisReplaceShellGameState(chromeGs);
      } else if (typeof window.risqueArtemisPrepareDeployChrome === "function") {
        window.risqueArtemisPrepareDeployChrome(chromeGs);
      }
      if (
        typeof window.risqueArtemisEnsureSetupDeployUrl === "function" &&
        isSetupDeploy(chromeGs)
      ) {
        window.risqueArtemisEnsureSetupDeployUrl();
      }
      if (opts.handoffPending) {
        updateDeploySpectatorView(chromeGs);
      } else {
        updateDeploySpectatorView(gs);
      }
    } else {
      hideDeployDock();
      var slot = document.getElementById("risque-phase-content");
      if (slot) {
        slot.innerHTML =
          '<div class="risque-artemis-deploy-spectate" role="status">' +
          "<p>Deployment confirmed — waiting for host…</p></div>";
      }
    }
  };

  function artemisClientRejectStaleDeploySync(incoming) {
    if (!window.risqueArtemisNetClient || !incoming) return false;
    if (String(incoming.phase || "") !== "deploy") return false;
    var live = window.gameState;
    if (!live) return false;
    var livePh = String(live.phase || "");
    if (
      livePh === "cardplay" ||
      livePh === "con-cardplay" ||
      livePh === "income" ||
      livePh === "con-income" ||
      livePh === "attack" ||
      livePh === "reinforce" ||
      livePh === "receivecard" ||
      livePh === "getcard"
    ) {
      return true;
    }
    if (livePh !== "deploy") {
      var liveSeq = Number(live.risqueArtemisControlSeq) || 0;
      var inSeq = Number(incoming.risqueArtemisControlSeq) || 0;
      if (liveSeq > 0 && inSeq > 0 && liveSeq > inSeq) {
        return true;
      }
    }
    return false;
  }

  window.risqueArtemisSyncPortableDeploy = function (gs) {
    if (artemisClientRejectStaleDeploySync(gs)) {
      stopDeployWatchdog();
      teardownDeployUI(true);
      clearDeployChrome();
      return;
    }
    if (
      gs &&
      typeof window.risqueArtemisHostHasSetupDeployWinnerLock === "function" &&
      window.risqueArtemisHostHasSetupDeployWinnerLock(gs) &&
      typeof window.risqueArtemisApplySetupDeployWinnerLock === "function"
    ) {
      window.risqueArtemisApplySetupDeployWinnerLock(gs);
    }
    if (gs && String(gs.phase || "") === "deploy" && !gs.risqueMirrorDeployRoute) {
      gs.risqueMirrorDeployRoute = isSetupDeploy(gs) ? "setup" : "turn";
    }
    if (gs && typeof window.risqueArtemisEnsureRosterOnState === "function") {
      window.risqueArtemisEnsureRosterOnState(gs);
    }
    if (!gs || !isSetupDeploy(gs)) {
      if (
        gs &&
        String(gs.phase || "") === "deploy" &&
        typeof window.risqueArtemisSyncPortableTurnDeploy === "function"
      ) {
        window.risqueArtemisSyncPortableTurnDeploy(gs);
      }
      return;
    }

    var syncSeq = Number(gs.risqueArtemisControlSeq) || 0;
    var ctrlSlot = deployOwnerSlot(gs) || Number(gs.artemisControlSlot) || 0;
    var mine = isMine(gs);
    var handoffChanged = deploySpectatorHandoffChanged(gs);

    if (
      (window.risqueArtemisDeployHandoffPending || window.risqueArtemisDeployPushLocked) &&
      !mine
    ) {
      if (!handoffChanged) {
        updateDeploySpectatorView(gs);
        window.__risqueArtemisDeployLastControlSlot =
          deployOwnerSlot(gs) || Number(gs.artemisControlSlot) || 0;
        window.__risqueArtemisDeployLastSyncSeq = syncSeq;
        return;
      }
      window.gameState = gs;
      forceDeploySpectatorHandoffRefresh(gs);
      window.__risqueArtemisDeployLastControlSlot = ctrlSlot;
      window.__risqueArtemisDeployLastSyncSeq = syncSeq;
      updateDeploySpectatorView(gs);
      exitClientPlayMode();
      if (deployControlsPresent()) {
        teardownDeployUI(true);
        document.documentElement.classList.remove("risque-artemis-my-turn");
      }
      return;
    }

    var lastCtrl = Number(window.__risqueArtemisDeployLastControlSlot) || 0;
    if (ctrlSlot !== lastCtrl) {
      window.__risqueArtemisDeployLastControlSlot = ctrlSlot;
      deployMountedFor = "";
    }
    if (window.__risqueArtemisDeployLastSyncSeq !== syncSeq) {
      window.__risqueArtemisDeployLastSyncSeq = syncSeq;
      deployMountedFor = "";
    }
    if (handoffChanged) {
      if (mine) {
        deployMountedFor = "";
        window.deployedTroops = {};
        window.selectedTerritory = null;
        if (gs && typeof gs === "object") {
          delete gs.risqueDeployMirrorDraft;
          delete gs.risqueDeployTransientPrimary;
        }
      } else {
        forceDeploySpectatorHandoffRefresh(gs);
        if (
          typeof window.risqueArtemisEnsureSetupDeployUrl === "function" &&
          isSetupDeploy(gs)
        ) {
          window.risqueArtemisEnsureSetupDeployUrl();
        }
      }
    }

    if (typeof window.risqueArtemisEnsureActiveSetupDeployBank === "function") {
      window.risqueArtemisEnsureActiveSetupDeployBank(gs);
    }

    if (!mine) {
      stopDeployWatchdog();
      if (deployControlsPresent()) {
        window.risqueArtemisRelinquishDeployControl(gs);
      } else {
        updateDeploySpectatorView(gs);
      }
      return;
    }

    if (
      window.risqueArtemisNetClient &&
      deployControlsPresent() &&
      typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
      window.risqueArtemisClientHasActiveDeploySession()
    ) {
      syncDeployChrome(gs);
      return;
    }

    if (mine) {
      var upEarly = normName(gs.currentPlayer);
      var mountKeyEarly = String(ctrlSlot) + ":" + upEarly;
      if (
        deployMountedFor === mountKeyEarly &&
        deployControlsPresent() &&
        typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
        window.risqueArtemisClientHasActiveDeploySession()
      ) {
        return;
      }
    }

    var up = String(gs.currentPlayer || "");
    try {
      console.info(
        "[ARTEMIS deploy] sync up=",
        up,
        "mine=",
        mine,
        "mySlot=",
        myLocalSlot(),
        "controlSlot=",
        ctrlSlot
      );
    } catch (eLog) {
      /* ignore */
    }

    window.gameState = gs;
    if (artemisClientRejectStaleDeploySync(gs)) {
      stopDeployWatchdog();
      return;
    }
    if (
      typeof window.risqueArtemisSetupDeployMirrorReady === "function" &&
      !window.risqueArtemisSetupDeployMirrorReady(gs)
    ) {
      if (typeof window.risqueArtemisLogSetupDeployBank === "function") {
        window.risqueArtemisLogSetupDeployBank(gs, "sync-wait-mirror");
      }
      syncDeployChrome(gs);
      return;
    }
    if (typeof window.risqueArtemisLogSetupDeployBank === "function") {
      window.risqueArtemisLogSetupDeployBank(gs, "sync-mine");
    }
    enterClientPlayMode();
    if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
      window.risqueArtemisEnsureClientActivePlay(gs);
    }
    mountRealDeploy(gs);
    syncDeployChrome(gs);
    startDeployWatchdog();
    if (typeof window.risqueArtemisDiag === "function" && !deployControlsPresent()) {
      window.risqueArtemisDiag("setup_deploy_controls_missing", "P" + myLocalSlot() + " setup deploy", {
        currentPlayer: gs.currentPlayer,
        controlSlot: gs.artemisControlSlot
      });
    } else if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag("setup_deploy_controls_ok", "P" + myLocalSlot() + " setup deploy", {
        currentPlayer: gs.currentPlayer,
        controlSlot: gs.artemisControlSlot
      });
    }
  };

  window.risqueArtemisUnmountPortableDeploy = function () {
    teardownDeployUI(true);
    hideDeployDock();
    clearDeployChrome();
  };
})();
