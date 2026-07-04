/**
 * ARTEMIS M2c — route control to the laptop whose player is up (by slot).
 * Setup deploy uses runSetup via artemis-deploy-panel.js (active laptop only).
 */
(function () {
  if (!window.risqueArtemisMode) return;

  function normName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function storedRoster() {
    try {
      var raw = sessionStorage.getItem("risqueArtemisRoster");
      return raw ? JSON.parse(raw) : null;
    } catch (eRos) {
      return null;
    }
  }

  function bindIdentityFromRoster(gs) {
    var slotNum = Number(window.risqueArtemisPlayerSlot);
    if (!slotNum && window.risqueArtemisNetClient) {
      if (typeof window.risqueArtemisEnsureClientSlot === "function") {
        window.risqueArtemisEnsureClientSlot();
      }
      slotNum = Number(window.risqueArtemisPlayerSlot);
    }
    if (!slotNum) return;
    var slotKey = String(slotNum);
    var resolved = "";

    var roster = (gs && gs.artemisRoster) || storedRoster();
    if (roster && Array.isArray(roster)) {
      var entry = roster.find(function (r) {
        return String(r.slot) === slotKey;
      });
      if (entry && entry.name) {
        resolved = normName(entry.name);
      }
    }

    if (!resolved) {
      try {
        var profs = JSON.parse(sessionStorage.getItem("risqueArtemisLoginProfiles") || "null");
        var prof = profs && (profs[slotKey] || profs[slotNum]);
        if (prof && prof.name) {
          resolved = normName(prof.name);
        }
      } catch (eProf) {
        /* ignore */
      }
    }

    if (!resolved && gs && Array.isArray(gs.players)) {
      var byOrder = gs.players.find(function (p) {
        return Number(p.playerOrder) === slotNum;
      });
      if (byOrder && byOrder.name) {
        resolved = normName(byOrder.name);
      } else if (gs.players[slotNum - 1] && gs.players[slotNum - 1].name) {
        resolved = normName(gs.players[slotNum - 1].name);
      }
    }

    if (!resolved) {
      try {
        var nm = sessionStorage.getItem("risqueArtemisPlayerName");
        if (nm) resolved = normName(nm);
      } catch (eNm2) {
        /* ignore */
      }
    }

    if (resolved) {
      window.risqueArtemisPlayerName = resolved;
      try {
        sessionStorage.setItem("risqueArtemisPlayerName", resolved);
      } catch (eNm) {
        /* ignore */
      }
    }
  }

  /** Roster slot name must match currentPlayer — stale artemisControlSlot alone is not enough on the host. */
  function artemisLocalSlotOwnsCurrentPlayer(gs, local) {
    if (!gs || !gs.currentPlayer || !local) return false;
    var roster =
      gs.artemisRoster && Array.isArray(gs.artemisRoster) ? gs.artemisRoster : storedRoster();
    if (roster) {
      var hit = roster.find(function (r) {
        return Number(r.slot) === local;
      });
      if (hit && hit.name) {
        return normName(hit.name) === normName(gs.currentPlayer);
      }
    }
    return activePlayerSlot(gs) === local;
  }

  function playerUp(gs) {
    return normName(gs && gs.currentPlayer);
  }

  function activePlayerSlot(gs) {
    gs = gs || window.gameState;
    if (!gs) return 0;
    var up = playerUp(gs);
    if (!up) return 0;

    var roster =
      (gs.artemisRoster && Array.isArray(gs.artemisRoster) ? gs.artemisRoster : null) ||
      storedRoster();
    if (roster) {
      var hit = roster.find(function (r) {
        return normName(r.name) === up;
      });
      if (hit && hit.slot) return Number(hit.slot);
    }

    if (Array.isArray(gs.players)) {
      var p = gs.players.find(function (x) {
        return normName(x.name) === up;
      });
      /* ARTEMIS: playerOrder is turn position, not laptop roster slot (P1 host can deploy second). */
      if (!window.risqueArtemisMode && p && p.playerOrder) return Number(p.playerOrder);
      var idx = gs.players.indexOf(p);
      if (idx >= 0) return idx + 1;
    }
    return 0;
  }

  /** Turn deploy: currentPlayer roster slot wins over stale artemisControlSlot on the host. */
  function artemisHostTurnDeployActiveSlot(gs) {
    if (!gs) return 0;
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }
    var fromPlayer = activePlayerSlot(gs);
    if (fromPlayer >= 1) return fromPlayer;
    return Number(gs.artemisControlSlot) || 0;
  }

  function isSetupDeploy(gs) {
    if (typeof window.risqueArtemisIsSetupDeploy === "function") {
      return window.risqueArtemisIsSetupDeploy(gs);
    }
    if (!gs || String(gs.phase || "") !== "deploy") return false;
    if (String(gs.risqueMirrorDeployRoute || "") === "setup") return true;
    try {
      var r = localStorage.getItem("risqueMirrorDeployRoute");
      if (r === "setup" || r === "deploy1") return true;
    } catch (eR) {
      /* ignore */
    }
    var banks = 0;
    (gs.players || []).forEach(function (p) {
      if ((Number(p.bankValue) || 0) > 0) banks += 1;
    });
    return banks > 1;
  }

  window.risqueArtemisEnsureRosterOnState = function (gs) {
    if (!gs) return;
    if (gs.artemisRoster && Array.isArray(gs.artemisRoster) && gs.artemisRoster.length) return;
    var r = storedRoster();
    if (r && r.length) gs.artemisRoster = r;
  };

  function isSetupDeployRoute(gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return false;
    var route = String(gs.risqueMirrorDeployRoute || "");
    if (route === "setup" || route === "deploy1") return true;
    try {
      var rk = localStorage.getItem("risqueMirrorDeployRoute");
      if (rk === "setup" || rk === "deploy1") return true;
    } catch (eRk) {
      /* ignore */
    }
    return isSetupDeploy(gs);
  }

  window.risqueArtemisClearSetupDeployWinnerLock = function (gs) {
    if (!gs) return;
    try {
      delete gs.risqueArtemisSetupDeployWinner;
      delete gs.risqueArtemisSetupDeploySlot;
    } catch (eClr) {
      /* ignore */
    }
  };

  function postRouletteSwapDisabled() {
    if (typeof window.risqueArtemisRigSetupUsesRandom === "function") {
      return window.risqueArtemisRigSetupUsesRandom();
    }
    if (window.risqueArtemisRigSetupRandom) return true;
    try {
      if (sessionStorage.getItem("risqueArtemisRigSetupRandom") === "1") return true;
      return new URL(window.location.href).searchParams.get("rigSetup") === "random";
    } catch (eUrl) {
      return false;
    }
  }

  function postRouletteSwapSlot() {
    if (postRouletteSwapDisabled()) return 0;
    if (typeof window.risqueArtemisResolveRigSwapSlot === "function") {
      return window.risqueArtemisResolveRigSwapSlot();
    }
    if (typeof window.risqueArtemisRigSetupSlot === "number") {
      var rigStored = Number(window.risqueArtemisRigSetupSlot);
      if (rigStored >= 1 && rigStored <= 3) return rigStored;
    }
    try {
      var ssRig = sessionStorage.getItem("risqueArtemisRigSetupSlot");
      if (ssRig === "1" || ssRig === "2" || ssRig === "3") return parseInt(ssRig, 10);
    } catch (eSsRig) {
      /* ignore */
    }
    try {
      var q = new URL(window.location.href).searchParams.get("rigSetup");
      if (q === "1" || q === "2" || q === "3") return parseInt(q, 10);
    } catch (eQ) {
      /* ignore */
    }
    if (typeof window.RISQUE_POST_ROULETTE_SWAP_SLOT === "number") {
      var w = Number(window.RISQUE_POST_ROULETTE_SWAP_SLOT);
      if (w >= 1 && w <= 3) return w;
    }
    return 0;
  }

  function playerObjectForArtemisSlot(gs, slot) {
    if (!gs || !slot || slot < 1 || !Array.isArray(gs.players) || !gs.players.length) return null;
    bindIdentityFromRoster(gs);
    if (Array.isArray(gs.artemisRoster)) {
      var rh = gs.artemisRoster.find(function (r) {
        return Number(r.slot) === slot;
      });
      if (rh && rh.name) {
        var want = normName(rh.name);
        var byRos = gs.players.find(function (p) {
          return normName(p && p.name) === want;
        });
        if (byRos) return byRos;
      }
    }
    var byOrd = gs.players.find(function (p) {
      return Number(p.playerOrder) === slot;
    });
    if (byOrd) return byOrd;
    var fall = { 1: "GUIDO", 2: "MICTOR", 3: "NOOCH" }[slot];
    if (fall) {
      var byNm = gs.players.find(function (p) {
        return normName(p && p.name) === fall;
      });
      if (byNm) return byNm;
    }
    return gs.players[slot - 1] || null;
  }

  window.risqueArtemisForcePostRouletteWinner = function (gs, selectKind, playersOpt) {
    if (!gs || !window.risqueArtemisMode || !window.risqueArtemisHost) return null;
    if (postRouletteSwapDisabled()) return null;
    if (
      String(gs.phase || "") === "deploy" &&
      (Number(gs.risqueArtemisControlSeq) || 0) > 1
    ) {
      return null;
    }
    var slot = postRouletteSwapSlot();
    if (!(slot >= 1)) return null;
    var players = playersOpt || gs.players;
    var forced =
      typeof window.risqueArtemisPlayerForSwapSlot === "function"
        ? window.risqueArtemisPlayerForSwapSlot(players, gs, slot)
        : playerObjectForArtemisSlot(gs, slot);
    if (!forced || !forced.name) return null;
    var prev = gs.currentPlayer;
    gs.currentPlayer = String(forced.name);
    if (Array.isArray(players) && players.length) {
      gs.turnOrder = [forced.name].concat(
        players
          .filter(function (p) {
            return p && p.name !== forced.name;
          })
          .map(function (p) {
            return p.name;
          })
      );
    }
    gs.artemisControlSlot = slot;
    if (String(selectKind || "") === "deployOrder" || String(gs.phase || "") === "deploy") {
      gs.risqueMirrorDeployRoute = "setup";
      gs.risqueArtemisSetupDeployWinner = normName(forced.name);
      gs.risqueArtemisSetupDeploySlot = slot;
      gs.risqueArtemisControlSeq = Math.max(Number(gs.risqueArtemisControlSeq) || 0, 1);
    }
    if (prev && normName(prev) !== normName(forced.name)) {
      try {
        console.info(
          "[ARTEMIS] force post-roulette winner " + prev + " → " + forced.name + " (slot " + slot + ")"
        );
      } catch (eFLog) {
        /* ignore */
      }
    }
    return forced;
  };

  if (
    typeof window.RISQUE_POST_ROULETTE_SWAP_SLOT === "number" &&
    window.RISQUE_POST_ROULETTE_SWAP_SLOT >= 1 &&
    window.RISQUE_POST_ROULETTE_SWAP_SLOT <= 3
  ) {
    /* keep rig from host picker / URL */
  } else if (typeof window.risqueArtemisResolveRigSwapSlot === "function") {
    var bootSlot = window.risqueArtemisResolveRigSwapSlot();
    if (bootSlot >= 1 && bootSlot <= 3) {
      window.RISQUE_POST_ROULETTE_SWAP_SLOT = bootSlot;
    }
  }

  window.risqueArtemisHostHasSetupDeployWinnerLock = function (gs) {
    gs = gs || window.gameState;
    if (!gs || !window.risqueArtemisMode) return false;
    if (postRouletteSwapDisabled()) return false;
    if ((Number(gs.risqueArtemisControlSeq) || 0) > 1) return false;
    if (!isSetupDeployRoute(gs)) return false;
    return true;
  };

  window.risqueArtemisApplySetupDeployWinnerLock = function (gs) {
    if (!window.risqueArtemisHostHasSetupDeployWinnerLock(gs)) {
      return false;
    }
    bindIdentityFromRoster(gs);
    var winner = normName(gs.risqueArtemisSetupDeployWinner);
    var slot = Number(gs.risqueArtemisSetupDeploySlot) || postRouletteSwapSlot();
    if (!winner) {
      return !!window.risqueArtemisForcePostRouletteWinner(gs, "deployOrder");
    }
    var resolvedPlayer = null;
    if (slot >= 1 && slot <= 3) {
      resolvedPlayer = playerObjectForArtemisSlot(gs, slot);
    }
    if (!resolvedPlayer && Array.isArray(gs.players)) {
      resolvedPlayer = gs.players.find(function (p) {
        return p && normName(p.name) === winner;
      });
    }
    gs.currentPlayer = resolvedPlayer && resolvedPlayer.name ? resolvedPlayer.name : winner;
    if (slot >= 1 && slot <= 3) {
      gs.artemisControlSlot = slot;
    } else if (typeof window.risqueArtemisForceControlSlotFromCurrentPlayer === "function") {
      window.risqueArtemisForceControlSlotFromCurrentPlayer(gs);
    }
    return true;
  };

  window.risqueArtemisForceControlSlotFromCurrentPlayer = function (gs) {
    if (!gs || !window.risqueArtemisMode) return 0;
    bindIdentityFromRoster(gs);
    var slot = 0;
    var up = normName(gs.currentPlayer);
    if (!up) return 0;
    var roster =
      (gs.artemisRoster && Array.isArray(gs.artemisRoster) ? gs.artemisRoster : null) ||
      storedRoster();
    if (roster) {
      var hit = roster.find(function (r) {
        return normName(r && r.name) === up;
      });
      if (hit && hit.slot) slot = Number(hit.slot) || 0;
    }
    if (!slot && Array.isArray(gs.players)) {
      slot = activePlayerSlot(gs);
    }
    if (!slot && window.risqueArtemisNetClient && !window.risqueArtemisHost) {
      var myNm = window.risqueArtemisPlayerName;
      if (!myNm) {
        try {
          myNm = sessionStorage.getItem("risqueArtemisPlayerName");
        } catch (eNmF) {
          /* ignore */
        }
      }
      if (myNm && normName(myNm) === up) {
        slot = myLocalSlot();
      }
    }
    if (slot >= 1 && slot <= 3) {
      gs.artemisControlSlot = slot;
    }
    return slot;
  };

  window.risqueArtemisBindIdentityFromState = bindIdentityFromRoster;
  window.risqueArtemisActivePlayerSlot = activePlayerSlot;

  /** Each ARTEMIS laptop's CARDS IN HAND toggle shows that laptop's roster player — not currentPlayer. */
  window.risqueArtemisCardsInHandViewPlayerName = function (gs) {
    if (!gs) return "";
    bindIdentityFromRoster(gs);
    var myNorm = normName(window.risqueArtemisPlayerName);
    if (!myNorm) {
      try {
        myNorm = normName(sessionStorage.getItem("risqueArtemisPlayerName"));
      } catch (eNm) {
        /* ignore */
      }
    }
    if (myNorm && Array.isArray(gs.players)) {
      var hit = gs.players.find(function (p) {
        return p && p.name && normName(p.name) === myNorm;
      });
      if (hit && hit.name) return String(hit.name);
    }
    return gs.currentPlayer ? String(gs.currentPlayer) : "";
  };

  /** Host stamps mirrored state so clients know which laptop gets CONTROL (probe-style). */
  window.risqueArtemisStampControlSlot = function (gs) {
    if (!gs) return;
    if (
      typeof window.risqueArtemisHostHasSetupDeployWinnerLock === "function" &&
      window.risqueArtemisHostHasSetupDeployWinnerLock(gs)
    ) {
      if (typeof window.risqueArtemisApplySetupDeployWinnerLock === "function") {
        window.risqueArtemisApplySetupDeployWinnerLock(gs);
      }
      return;
    }
    if (typeof window.risqueArtemisForceControlSlotFromCurrentPlayer === "function") {
      var forced = window.risqueArtemisForceControlSlotFromCurrentPlayer(gs);
      if (forced >= 1) return;
    }
    bindIdentityFromRoster(gs);
    var slot = activePlayerSlot(gs);
    if (slot >= 1 && slot <= 3) {
      gs.artemisControlSlot = slot;
    }
  };

  /** Prefer locked deploy slot over stale currentPlayer during setup deploy. */
  window.risqueArtemisResolveOwnerSlot = function (gs) {
    if (!gs) return 0;
    if (
      typeof window.risqueArtemisHostHasSetupDeployWinnerLock === "function" &&
      window.risqueArtemisHostHasSetupDeployWinnerLock(gs) &&
      typeof window.risqueArtemisApplySetupDeployWinnerLock === "function"
    ) {
      window.risqueArtemisApplySetupDeployWinnerLock(gs);
    }
    bindIdentityFromRoster(gs);
    if (
      typeof window.risqueArtemisHostHasSetupDeployWinnerLock === "function" &&
      window.risqueArtemisHostHasSetupDeployWinnerLock(gs)
    ) {
      var lockSlot =
        Number(gs.risqueArtemisSetupDeploySlot) ||
        Number(gs.artemisControlSlot) ||
        postRouletteSwapSlot();
      if (lockSlot >= 1 && lockSlot <= 3) {
        gs.artemisControlSlot = lockSlot;
        return lockSlot;
      }
    }
    var fromPlayer = activePlayerSlot(gs);
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (fromPlayer >= 1 && ctrl >= 1 && fromPlayer !== ctrl) {
      gs.artemisControlSlot = fromPlayer;
      return fromPlayer;
    }
    if (ctrl >= 1 && ctrl <= 3) return ctrl;
    return fromPlayer;
  };

  function artemisClearStaleDeployHandoffFlagsForTurnDeploy(gs) {
    if (!gs || String(gs.phase || "") !== "deploy") return;
    var route = String(gs.risqueMirrorDeployRoute || "");
    if (route !== "turn" && route !== "deploy2") {
      try {
        var rk = localStorage.getItem("risqueMirrorDeployRoute");
        if (rk !== "turn" && rk !== "deploy2") {
          if (
            typeof window.risqueArtemisIsSetupDeploy === "function" &&
            !window.risqueArtemisIsSetupDeploy(gs)
          ) {
            /* Income → deploy: stale setup route/localStorage must not block handoff clear. */
          } else {
            return;
          }
        }
      } catch (eRk) {
        return;
      }
    }
    window.risqueArtemisDeployHandoffPending = 0;
    window.risqueArtemisDeployPushLocked = false;
    window.risqueArtemisDeployRelinquishedSeq = 0;
    try {
      delete window.risqueArtemisDeployHandoffPlayer;
    } catch (eClrHp) {
      /* ignore */
    }
  }

  /** Keep income→deploy on the turn-deploy path (not first-setup deploy). */
  function artemisEnsureTurnDeployRoute(gs, prevPhaseOpt) {
    if (!gs || String(gs.phase || "") !== "deploy") return false;
    var route = String(gs.risqueMirrorDeployRoute || "");
    if (route === "turn" || route === "deploy2") return true;
    try {
      var rkPrefer = localStorage.getItem("risqueMirrorDeployRoute");
      if (
        (rkPrefer === "turn" || rkPrefer === "deploy2") &&
        route !== "turn" &&
        route !== "deploy2"
      ) {
        gs.risqueMirrorDeployRoute = rkPrefer;
        artemisClearStaleDeployHandoffFlagsForTurnDeploy(gs);
        return true;
      }
    } catch (eRkPref) {
      /* ignore */
    }
    var prevPh = prevPhaseOpt != null ? String(prevPhaseOpt || "") : "";
    if (!prevPh && window.gameState) {
      prevPh = String(window.gameState.phase || "");
    }
    var fromIncome = prevPh === "income" || prevPh === "con-income";
    if ((route === "setup" || route === "deploy1") && !fromIncome) {
      if (
        typeof window.risqueArtemisIsSetupDeploy === "function" &&
        window.risqueArtemisIsSetupDeploy(gs)
      ) {
        return false;
      }
    }
    var notSetup =
      typeof window.risqueArtemisIsSetupDeploy === "function" &&
      !window.risqueArtemisIsSetupDeploy(gs);
    if (!fromIncome && !notSetup) {
      try {
        var rk = localStorage.getItem("risqueMirrorDeployRoute");
        if (rk === "turn" || rk === "deploy2") {
          gs.risqueMirrorDeployRoute = rk;
          return true;
        }
      } catch (eRk) {
        /* ignore */
      }
      return false;
    }
    gs.risqueMirrorDeployRoute = "turn";
    if (typeof window.risqueSetMirrorDeployRoute === "function") {
      window.risqueSetMirrorDeployRoute("turn");
    }
    artemisClearStaleDeployHandoffFlagsForTurnDeploy(gs);
    return true;
  }

  window.risqueArtemisEnsureTurnDeployRoute = artemisEnsureTurnDeployRoute;

  window.risqueArtemisClearTurnDeployHandoffFlags = function (gs) {
    artemisClearStaleDeployHandoffFlagsForTurnDeploy(gs);
  };

  window.risqueArtemisClearMapPhaseHandoffFlags = function (gs) {
    if (!gs) return;
    var ph = String(gs.phase || "");
    if (
      ph === "attack" ||
      ph === "reinforce" ||
      ph === "receivecard" ||
      ph === "deploy"
    ) {
      window.risqueArtemisDeployHandoffPending = 0;
      window.risqueArtemisDeployPushLocked = false;
      window.risqueArtemisDeployRelinquishedSeq = 0;
    }
    if (ph === "deploy") {
      artemisClearStaleDeployHandoffFlagsForTurnDeploy(gs);
    }
  };

  function myLocalSlot() {
    if (window.risqueArtemisHost) return 1;
    if (window.risqueArtemisNetClient && typeof window.risqueArtemisEnsureClientSlot === "function") {
      window.risqueArtemisEnsureClientSlot();
    }
    return Number(window.risqueArtemisPlayerSlot) || 0;
  }

  function hostSessionName() {
    bindIdentityFromRoster(window.gameState);
    var nm = window.risqueArtemisPlayerName;
    if (!nm) {
      try {
        nm = sessionStorage.getItem("risqueArtemisPlayerName");
      } catch (eHostNm) {
        /* ignore */
      }
    }
    return nm ? normName(nm) : "";
  }

  window.risqueArtemisIsMyTurn = function (gs) {
    gs = gs || window.gameState;
    if (!gs || !gs.currentPlayer) return false;
    bindIdentityFromRoster(gs);

    if (window.risqueArtemisHost && !window.risqueArtemisNetClient) {
      var phHost = String(gs.phase || "");
      if (phHost === "deploy") {
        var hostNmDeploy = hostSessionName();
        if (hostNmDeploy && hostNmDeploy === normName(gs.currentPlayer)) {
          window.risqueArtemisDeployHandoffPending = 0;
          window.risqueArtemisDeployPushLocked = false;
          if (typeof window.risqueArtemisForceControlSlotFromCurrentPlayer === "function") {
            window.risqueArtemisForceControlSlotFromCurrentPlayer(gs);
          } else if (typeof window.risqueArtemisStampControlSlot === "function") {
            window.risqueArtemisStampControlSlot(gs);
          }
          return true;
        }
        if (
          typeof window.risqueArtemisIsSetupDeploy === "function" &&
          window.risqueArtemisIsSetupDeploy(gs)
        ) {
          if (typeof window.risqueArtemisApplySetupDeployWinnerLock === "function") {
            window.risqueArtemisApplySetupDeployWinnerLock(gs);
          }
          if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
            window.risqueArtemisResolveOwnerSlot(gs);
          }
          var hostLocal = myLocalSlot();
          var hostActive = artemisHostTurnDeployActiveSlot(gs);
          if (hostLocal >= 1 && hostActive === hostLocal) {
            window.risqueArtemisDeployHandoffPending = 0;
            window.risqueArtemisDeployPushLocked = false;
            return true;
          }
          if (hostLocal >= 1 && artemisLocalSlotOwnsCurrentPlayer(gs, hostLocal)) {
            window.risqueArtemisDeployHandoffPending = 0;
            window.risqueArtemisDeployPushLocked = false;
            return true;
          }
        }
        var deployRouteHost = String(gs.risqueMirrorDeployRoute || "");
        if (deployRouteHost !== "turn" && deployRouteHost !== "deploy2") {
          try {
            var rkDh = localStorage.getItem("risqueMirrorDeployRoute");
            if (rkDh === "turn" || rkDh === "deploy2") deployRouteHost = rkDh;
          } catch (eRkDh) {
            /* ignore */
          }
        }
        if (deployRouteHost === "turn" || deployRouteHost === "deploy2") {
          var hostLocalTurn = myLocalSlot();
          var hostActiveTurn = artemisHostTurnDeployActiveSlot(gs);
          if (hostLocalTurn >= 1 && hostActiveTurn === hostLocalTurn) {
            window.risqueArtemisDeployHandoffPending = 0;
            window.risqueArtemisDeployPushLocked = false;
            return true;
          }
          if (hostLocalTurn >= 1 && artemisLocalSlotOwnsCurrentPlayer(gs, hostLocalTurn)) {
            window.risqueArtemisDeployHandoffPending = 0;
            window.risqueArtemisDeployPushLocked = false;
            return true;
          }
          return false;
        }
      }
      if (
        phHost === "cardplay" ||
        phHost === "con-cardplay" ||
        phHost === "income" ||
        phHost === "con-income" ||
        phHost === "attack" ||
        phHost === "reinforce" ||
        phHost === "receivecard"
      ) {
        if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
          window.risqueArtemisResolveOwnerSlot(gs);
        }
        var hostLocalCp = myLocalSlot();
        var activeCp = activePlayerSlot(gs);
        if (hostLocalCp >= 1 && activeCp === hostLocalCp) {
          return true;
        }
        if (artemisLocalSlotOwnsCurrentPlayer(gs, hostLocalCp)) {
          return true;
        }
        return false;
      }
    }

    if (window.risqueArtemisNetClient && typeof window.risqueArtemisEnsureClientSlot === "function") {
      window.risqueArtemisEnsureClientSlot();
    }

    /** Client laptops: name vs currentPlayer BEFORE local-slot guard — slot can be 0 until EnsureClientSlot / roster catch up. */
    if (window.risqueArtemisNetClient && !window.risqueArtemisHost) {
      var myNm = window.risqueArtemisPlayerName;
      if (!myNm) {
        try {
          myNm = sessionStorage.getItem("risqueArtemisPlayerName");
        } catch (eNm) {
          /* ignore */
        }
      }
      if (myNm && normName(myNm) === normName(gs.currentPlayer)) {
        var phNm = String(gs.phase || "");
        if (phNm === "cardplay" || phNm === "income" || phNm === "con-income") {
          if (typeof window.risqueArtemisForceControlSlotFromCurrentPlayer === "function") {
            window.risqueArtemisForceControlSlotFromCurrentPlayer(gs);
          } else if (typeof window.risqueArtemisStampControlSlot === "function") {
            window.risqueArtemisStampControlSlot(gs);
          }
          return true;
        }
        if (phNm === "attack" || phNm === "reinforce" || phNm === "receivecard") {
          if (typeof window.risqueArtemisForceControlSlotFromCurrentPlayer === "function") {
            window.risqueArtemisForceControlSlotFromCurrentPlayer(gs);
          }
          return true;
        }
        if (phNm === "deploy") {
          if (typeof window.risqueArtemisForceControlSlotFromCurrentPlayer === "function") {
            window.risqueArtemisForceControlSlotFromCurrentPlayer(gs);
          } else if (typeof window.risqueArtemisStampControlSlot === "function") {
            window.risqueArtemisStampControlSlot(gs);
          }
          if (typeof window.risqueSetMirrorDeployRoute === "function") {
            if (!artemisEnsureTurnDeployRoute(gs)) {
              var routeNm = String(gs.risqueMirrorDeployRoute || "");
              if (routeNm !== "turn" && routeNm !== "deploy2") {
                try {
                  var rkNm = localStorage.getItem("risqueMirrorDeployRoute");
                  if (rkNm === "turn" || rkNm === "deploy2") routeNm = rkNm;
                } catch (eRkNm) {
                  /* ignore */
                }
              }
              if (routeNm !== "turn" && routeNm !== "deploy2") {
                window.risqueSetMirrorDeployRoute("setup");
                gs.risqueMirrorDeployRoute = "setup";
              }
            }
          }
          window.risqueArtemisDeployHandoffPending = 0;
          window.risqueArtemisDeployPushLocked = false;
          return true;
        }
      }
    }

    var local = myLocalSlot();
    if (!local) return false;

    var ctrl = Number(gs.artemisControlSlot) || 0;
    var fromPlayer = activePlayerSlot(gs);
    if (fromPlayer >= 1 && ctrl >= 1 && fromPlayer !== ctrl) {
      gs.artemisControlSlot = fromPlayer;
      ctrl = fromPlayer;
    }
    if (ctrl >= 1 && ctrl <= 3) {
      if (ctrl !== local) return false;
      if (
        typeof window.risqueArtemisIsSetupDeploy === "function" &&
        window.risqueArtemisIsSetupDeploy(gs)
      ) {
        return true;
      }
      if (String(gs.phase || "") === "cardplay") {
        return artemisLocalSlotOwnsCurrentPlayer(gs, local);
      }
      if (String(gs.phase || "") === "income" || String(gs.phase || "") === "con-income") {
        return artemisLocalSlotOwnsCurrentPlayer(gs, local);
      }
      if (
        String(gs.phase || "") === "attack" ||
        String(gs.phase || "") === "reinforce" ||
        String(gs.phase || "") === "receivecard"
      ) {
        return artemisLocalSlotOwnsCurrentPlayer(gs, local);
      }
      if (String(gs.phase || "") === "deploy") {
        var deployRoute = String(gs.risqueMirrorDeployRoute || "");
        if (deployRoute !== "turn" && deployRoute !== "deploy2") {
          try {
            var rkD = localStorage.getItem("risqueMirrorDeployRoute");
            if (rkD === "turn" || rkD === "deploy2") deployRoute = rkD;
          } catch (eRkD) {
            /* ignore */
          }
        }
        if (deployRoute === "turn" || deployRoute === "deploy2") {
          return artemisLocalSlotOwnsCurrentPlayer(gs, local);
        }
      }
      var roster =
        gs.artemisRoster && Array.isArray(gs.artemisRoster) ? gs.artemisRoster : storedRoster();
      if (roster) {
        var hit = roster.find(function (r) {
          return Number(r.slot) === local;
        });
        if (hit && hit.name) {
          return normName(hit.name) === normName(gs.currentPlayer);
        }
      }
      return activePlayerSlot(gs) === local;
    }
    return activePlayerSlot(gs) === local;
  };

  window.risqueArtemisCanLocalPlay = function () {
    if (!window.risqueArtemisMode) return true;
    var gs = window.gameState;

    if (window.risqueArtemisHost && gs && String(gs.phase || "") === "deploy") {
      if (
        typeof window.risqueArtemisIsSetupDeploy === "function" &&
        window.risqueArtemisIsSetupDeploy(gs)
      ) {
        if (typeof window.risqueArtemisApplySetupDeployWinnerLock === "function") {
          window.risqueArtemisApplySetupDeployWinnerLock(gs);
        } else if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
          window.risqueArtemisResolveOwnerSlot(gs);
        }
        var hostLocal = myLocalSlot();
        var hostActive = artemisHostTurnDeployActiveSlot(gs);
        if (hostLocal >= 1 && hostActive === hostLocal) {
          window.risqueArtemisDeployHandoffPending = 0;
          window.risqueArtemisDeployPushLocked = false;
          return true;
        }
      }
      var deployRouteHostPlay = String(gs.risqueMirrorDeployRoute || "");
      if (deployRouteHostPlay !== "turn" && deployRouteHostPlay !== "deploy2") {
        try {
          var rkHostPlay = localStorage.getItem("risqueMirrorDeployRoute");
          if (rkHostPlay === "turn" || rkHostPlay === "deploy2") deployRouteHostPlay = rkHostPlay;
        } catch (eRkHostPlay) {
          /* ignore */
        }
      }
      if (deployRouteHostPlay === "turn" || deployRouteHostPlay === "deploy2") {
        if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
          window.risqueArtemisResolveOwnerSlot(gs);
        } else if (typeof window.risqueArtemisStampControlSlot === "function") {
          window.risqueArtemisStampControlSlot(gs);
        }
        var hostLocalTurnPlay = myLocalSlot();
        var hostActiveTurnPlay = artemisHostTurnDeployActiveSlot(gs);
        if (hostLocalTurnPlay >= 1 && hostActiveTurnPlay === hostLocalTurnPlay) {
          window.risqueArtemisDeployHandoffPending = 0;
          window.risqueArtemisDeployPushLocked = false;
          return true;
        }
      }
    }

    var ownsByTurn =
      gs && typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs);
    var ownsByName =
      gs &&
      typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
      window.risqueArtemisClientNameMatchesCurrent(gs);
    if (gs && (ownsByTurn || ownsByName)) {
      var phPlay = String(gs.phase || "");
      if (phPlay === "deploy") {
        var route = String(gs.risqueMirrorDeployRoute || "");
        if (route !== "turn" && route !== "deploy2" && route !== "setup" && route !== "deploy1") {
          try {
            var rk = localStorage.getItem("risqueMirrorDeployRoute");
            if (rk === "turn" || rk === "deploy2") route = rk;
            else if (rk === "setup" || rk === "deploy1") route = rk;
          } catch (eRk) {
            /* ignore */
          }
        }
        if (route === "turn" || route === "deploy2") {
          artemisClearStaleDeployHandoffFlagsForTurnDeploy(gs);
        } else if (
          typeof window.risqueArtemisIsSetupDeploy === "function" &&
          window.risqueArtemisIsSetupDeploy(gs)
        ) {
          window.risqueArtemisDeployHandoffPending = 0;
          window.risqueArtemisDeployPushLocked = false;
          window.risqueArtemisDeployRelinquishedSeq = 0;
        }
      } else if (
        phPlay === "attack" ||
        phPlay === "reinforce" ||
        phPlay === "receivecard"
      ) {
        window.risqueArtemisDeployHandoffPending = 0;
        window.risqueArtemisDeployPushLocked = false;
        window.risqueArtemisDeployRelinquishedSeq = 0;
      }
    }
    if (window.risqueArtemisDeployPushLocked || window.risqueArtemisDeployHandoffPending) {
      var phLock = gs ? String(gs.phase || "") : "";
      if (phLock === "deploy" && (ownsByTurn || ownsByName)) {
        var routeLock = String(gs.risqueMirrorDeployRoute || "");
        if (routeLock !== "turn" && routeLock !== "deploy2") {
          try {
            var rkLock = localStorage.getItem("risqueMirrorDeployRoute");
            if (rkLock === "turn" || rkLock === "deploy2") routeLock = rkLock;
          } catch (eRkLock) {
            /* ignore */
          }
        }
        var turnDeployLock =
          routeLock === "turn" ||
          routeLock === "deploy2" ||
          artemisEnsureTurnDeployRoute(gs);
        if (
          turnDeployLock ||
          (typeof window.risqueArtemisIsSetupDeploy === "function" &&
            window.risqueArtemisIsSetupDeploy(gs))
        ) {
          window.risqueArtemisDeployHandoffPending = 0;
          window.risqueArtemisDeployPushLocked = false;
          return true;
        }
      }
      if (phLock !== "attack" && phLock !== "reinforce" && phLock !== "receivecard") {
        return false;
      }
    }
    return ownsByTurn || ownsByName || false;
  };

  /** Host-only cardplay chrome (income gate, TV continue) — never on ARTEMIS client laptops. */
  window.risqueArtemisClientIsHostOnlyUi = function () {
    if (window.risqueDisplayIsPublic) return false;
    if (window.risqueArtemisHost) return true;
    if (window.risqueArtemisNetClient) return false;
    return true;
  };

  /** Active laptop is mid-deploy — ignore host mirror that would rewind wheel/bulk placements. */
  window.risqueArtemisClientHasActiveDeploySession = function () {
    if (window.risqueArtemisDeployHandoffPending || window.risqueArtemisDeployPushLocked) {
      return false;
    }
    var gs = window.gameState;
    if (!gs || String(gs.phase || "") !== "deploy") return false;
    var mine =
      typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs);
    if (!mine) return false;
    if (window.risqueArtemisNetClient) {
      if (!window.risqueArtemisClientPlaying) return false;
    } else if (!window.risqueArtemisHost) {
      return false;
    }
    var isSetup =
      typeof window.risqueArtemisIsSetupDeploy === "function" && window.risqueArtemisIsSetupDeploy(gs);
    if (isSetup) {
      if (document.getElementById("deploy1-confirm")) return true;
      if (window.risqueDeploy1Active && document.getElementById("deploy1-bank-number")) return true;
      return false;
    }
    var route = String(gs.risqueMirrorDeployRoute || "");
    if (route !== "turn" && route !== "deploy2") {
      try {
        var rk = localStorage.getItem("risqueMirrorDeployRoute");
        if (rk === "turn" || rk === "deploy2") route = rk;
      } catch (eRk) {
        /* ignore */
      }
    }
    if (route !== "turn" && route !== "deploy2") {
      return false;
    }
    if (document.getElementById("confirm")) {
      if (window.risqueArtemisMode) return true;
      if (document.getElementById("bank-number")) return true;
    }
    return false;
  };

  var lastArtemisTopStatusText = "";

  function setTopStatus(text, kind) {
    if (typeof window.risqueArtemisSetTopStatus === "function") {
      var next = String(text || "");
      if (next === lastArtemisTopStatusText) return;
      lastArtemisTopStatusText = next;
      window.risqueArtemisSetTopStatus(next, kind || "ok");
    }
  }

  function updateStatusForTurn(gs) {
    if (!gs) return;
    var up = playerUp(gs);
    var slot = activePlayerSlot(gs);
    var ctrl = Number(gs.artemisControlSlot) || 0;
    var local = myLocalSlot();
    if ((ctrl >= 1 && local === ctrl) || window.risqueArtemisIsMyTurn(gs)) {
      setTopStatus("ARTEMIS — YOUR TURN (" + up + " P" + (ctrl || slot) + ")", "ok");
    } else if (up) {
      setTopStatus(
        "ARTEMIS — waiting for " + up + " (P" + (ctrl || slot) + ")",
        "wait"
      );
    }
  }

  function artemisClientOwnsControlSlot(gs) {
    if (!gs || !window.risqueArtemisNetClient || window.risqueArtemisHost) return false;
    var local = myLocalSlot();
    if (!local) return false;
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      ctrl = Number(window.risqueArtemisResolveOwnerSlot(gs)) || ctrl;
    }
    return ctrl >= 1 && ctrl <= 3 && ctrl === local;
  }

  function artemisClientIsActivePlayer(gs) {
    if (!gs) return false;
    if (gs.artemisCycleProbe) {
      var localCp = myLocalSlot();
      var ctrlCp = Number(gs.artemisControlSlot) || 0;
      if (localCp >= 1 && ctrlCp === localCp) return true;
    }
    if (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) {
      return true;
    }
    if (
      typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
      window.risqueArtemisClientNameMatchesCurrent(gs)
    ) {
      return true;
    }
    var ph = String(gs.phase || "");
    if (
      (ph === "cardplay" || ph === "con-cardplay" || ph === "income" || ph === "con-income") &&
      artemisClientOwnsControlSlot(gs)
    ) {
      return true;
    }
    return false;
  }

  window.risqueArtemisClientIsActivePlayer = artemisClientIsActivePlayer;

  var lastPlayModeHealAt = 0;

  /** Stamp observer mirror voice while the active laptop plays cardplay privately (load + live). */
  window.risqueArtemisStampCardplayWaitingMirror = function (gs) {
    if (!window.risqueArtemisMode || !gs) return;
    var ph = String(gs.phase || "");
    if (ph !== "cardplay" && ph !== "con-cardplay") return;
    if (gs.risqueCardplayTvRecapPublished) return;
    if (
      gs.risquePublicCardplayRecap &&
      Array.isArray(gs.risquePublicCardplayRecap.lines) &&
      gs.risquePublicCardplayRecap.lines.length > 0
    ) {
      return;
    }
    var nm = String(gs.currentPlayer || "Player").trim();
    if (!nm) return;
    var disp = nm.charAt(0).toUpperCase() + nm.slice(1);
    gs.risquePublicCardplayPrimary = disp.toUpperCase() + " IS IN CARD PLAY — WAITING...";
    gs.risquePublicCardplayReport =
      typeof window.risquePublicFormatCardplaySpectatorHandLine === "function"
        ? window.risquePublicFormatCardplaySpectatorHandLine(gs)
        : "";
    delete gs.risquePublicCardplayBookCards;
  };

  /**
   * Login-minimal HUD has toggles + banner but no #control-voice — upgrade before painting
   * "GUIDO IS IN CARD PLAY / WAITING..." for spectators (common after LOAD GAME on host).
   */
  window.risqueArtemisEnsureCardplaySpectatorVoiceShell = function (gsOpt) {
    if (!window.risqueArtemisMode || !window.risqueArtemisNetClient || window.risqueArtemisHost) return false;
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs) return false;
    var ph = String(gs.phase || "");
    if (ph !== "cardplay" && ph !== "con-cardplay") return false;
    if (artemisClientIsActivePlayer(gs)) return false;

    if (typeof window.risquePublicClearReceiveCardSpectatorChrome === "function") {
      window.risquePublicClearReceiveCardSpectatorChrome();
    }
    var rhClear = document.getElementById("runtime-hud-root");
    if (rhClear) {
      rhClear.classList.remove("runtime-hud-root--receivecard-panel-only");
    }

    if (typeof window.risqueArtemisHideLoginPanel === "function") {
      window.risqueArtemisHideLoginPanel();
    }
    document.body.classList.add("risque-setup-fullstage");
    document.body.classList.remove("risque-public-login-active");
    try {
      document.body.setAttribute("data-risque-phase", ph);
    } catch (ePhAttr) {
      /* ignore */
    }

    artemisStampOmniHudDocumentClasses(gs);

    var canvas = document.getElementById("canvas");
    if (window.gameUtils && typeof window.gameUtils.resizeCanvas === "function") {
      try {
        window.gameUtils.resizeCanvas();
      } catch (eResize) {
        /* ignore */
      }
    }
    if (canvas) {
      canvas.classList.add("visible");
    }

    var uio = document.getElementById("ui-overlay");
    if (!uio || !window.risqueRuntimeHud) return false;

    var hudRoot = document.getElementById("runtime-hud-root");
    var loginHud = !!(hudRoot && hudRoot.classList.contains("runtime-hud-root--login"));
    var needsVoiceShell =
      loginHud || !document.getElementById("control-voice") || !document.getElementById("hud-main-panel");

    if (needsVoiceShell) {
      var banner = "CARD PLAY";
      if (gs.currentPlayer) {
        banner = "CARD PLAY-" + String(gs.currentPlayer).trim().toUpperCase();
      }
      if (typeof window.risqueRuntimeHud.ensureSetupUnifiedHud === "function") {
        window.risqueRuntimeHud.ensureSetupUnifiedHud(
          uio,
          banner,
          loginHud || !document.getElementById("control-voice") ? { force: true } : undefined
        );
      } else if (typeof window.risqueRuntimeHud.ensureSetupHud === "function") {
        window.risqueRuntimeHud.ensureSetupHud(uio, banner);
      }
    }

    hudRoot = document.getElementById("runtime-hud-root");
    if (hudRoot) {
      hudRoot.classList.remove("runtime-hud-root--login");
      hudRoot.classList.add("runtime-hud-root--setup");
      hudRoot.classList.add("runtime-hud-root--artemis-compact");
      hudRoot.classList.add("runtime-hud-root--artemis-cardplay");
      hudRoot.classList.add("runtime-hud-root--cardplay-panel-only");
    }

    if (typeof window.risqueArtemisStampCardplayWaitingMirror === "function") {
      window.risqueArtemisStampCardplayWaitingMirror(gs);
    }

    var nameU = String(gs.currentPlayer || "PLAYER").toUpperCase();
    var primary =
      gs.risquePublicCardplayPrimary != null
        ? String(gs.risquePublicCardplayPrimary).trim()
        : nameU + " IS IN CARD PLAY — WAITING...";
    var report =
      gs.risquePublicCardplayReport != null
        ? String(gs.risquePublicCardplayReport).trim()
        : typeof window.risquePublicFormatCardplaySpectatorHandLine === "function"
          ? window.risquePublicFormatCardplaySpectatorHandLine(gs)
          : "";
    if (!primary) {
      primary = nameU + " IS IN CARD PLAY — WAITING...";
    }

    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
      window.risqueRuntimeHud.setControlVoiceText(primary, report, {
        skipMirror: true,
        reportClass: "ucp-voice-report--public-cardplay",
      });
    }

    var main = document.getElementById("hud-main-panel");
    var cv = document.getElementById("control-voice");
    var vt = document.getElementById("control-voice-text");
    var vr = document.getElementById("control-voice-report");
    if (main) {
      main.style.setProperty("display", "flex", "important");
      main.style.setProperty("visibility", "visible", "important");
    }
    if (cv) {
      cv.style.setProperty("display", "flex", "important");
      cv.style.setProperty("visibility", "visible", "important");
    }
    if (vt) {
      vt.textContent = primary;
    }
    if (vr) {
      vr.textContent = report;
      vr.style.setProperty("display", report ? "block" : "none", "important");
      vr.className = "ucp-voice-report ucp-voice-report--public-cardplay";
    }

    var slot = document.getElementById("risque-phase-content");
    if (slot) {
      slot.innerHTML = "";
    }
    if (typeof window.risqueArtemisClearCardplaySpectatorVoiceBacks === "function") {
      window.risqueArtemisClearCardplaySpectatorVoiceBacks();
    }

    if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
      window.risqueArtemisEnsureHudTogglesVisible();
    }
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    }
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
      requestAnimationFrame(function () {
        try {
          window.risqueRuntimeHud.syncPosition();
        } catch (eSync) {
          /* ignore */
        }
      });
    }
    return true;
  };

  /** Spectator laptops: omni HUD + waiting control voice + working toggles (e.g. after LOAD GAME). */
  window.risqueArtemisReconcileCardplaySpectatorChrome = function (gsOpt) {
    if (!window.risqueArtemisMode || !window.risqueArtemisNetClient || window.risqueArtemisHost) return;
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs) return;
    var ph = String(gs.phase || "");
    if (ph !== "cardplay" && ph !== "con-cardplay") return;
    if (artemisClientIsActivePlayer(gs)) return;
    if (typeof window.risqueArtemisEnsureCardplaySpectatorVoiceShell === "function") {
      window.risqueArtemisEnsureCardplaySpectatorVoiceShell(gs);
      return;
    }
    if (typeof window.risqueArtemisStampCardplayWaitingMirror === "function") {
      window.risqueArtemisStampCardplayWaitingMirror(gs);
    }
    artemisStampOmniHudDocumentClasses(gs);
    if (typeof window.risqueArtemisEnsureOmniClientHud === "function") {
      window.risqueArtemisEnsureOmniClientHud(gs);
    }
    if (typeof window.risqueArtemisRefreshCardplaySpectatorChrome === "function") {
      window.risqueArtemisRefreshCardplaySpectatorChrome(gs);
    } else if (typeof window.risqueArtemisSyncPhaseControlVoice === "function") {
      window.risqueArtemisSyncPhaseControlVoice(gs);
    }
    if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
      window.risqueArtemisEnsureHudTogglesVisible();
    }
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    }
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
  };

  window.risqueArtemisStampOmniHudDocumentClasses = artemisStampOmniHudDocumentClasses;

  /** Clients stuck in risque-view-public never get working toggles/SKIP — heal on every cardplay sync. */
  window.risqueArtemisReconcileClientPlayMode = function (gsOpt) {
    if (!window.risqueArtemisNetClient || window.risqueArtemisHost) return false;
    if (window.__risqueArtemisLeavingCardplay) return false;
    var tr = window.risqueArtemisPhaseTransition;
    if (tr && (tr.target === "income" || tr.target === "con-income")) return false;
    var localGs = window.gameState;
    var localPh = localGs ? String(localGs.phase || "") : "";
    if (localPh === "income" || localPh === "con-income") return false;
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs) return false;
    var ph = String(gs.phase || "");
    if (
      ph !== "cardplay" &&
      ph !== "con-cardplay" &&
      ph !== "income" &&
      ph !== "con-income" &&
      ph !== "attack" &&
      ph !== "deploy"
    ) {
      return false;
    }
    if (
      (ph === "cardplay" || ph === "con-cardplay") &&
      !artemisClientIsActivePlayer(gs)
    ) {
      if (typeof window.risqueArtemisReconcileCardplaySpectatorChrome === "function") {
        window.risqueArtemisReconcileCardplaySpectatorChrome(gs);
      }
      return false;
    }
    if (!artemisClientIsActivePlayer(gs)) return false;
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    var needsHeal =
      !window.risqueArtemisClientPlaying ||
      window.risqueDisplayIsPublic ||
      document.documentElement.classList.contains("risque-view-public");
    if (!needsHeal) return true;
    if (Date.now() - lastPlayModeHealAt < 2500) {
      if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
        window.risqueArtemisEnsureHudTogglesVisible();
      }
      if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
        window.risqueWireArtemisHudTogglesOnce();
      }
      if (
        (ph === "cardplay" || ph === "con-cardplay") &&
        typeof window.risqueArtemisSyncPhaseControlVoice === "function"
      ) {
        window.risqueArtemisSyncPhaseControlVoice(gs);
      }
      return true;
    }
    lastPlayModeHealAt = Date.now();
    if (typeof window.risqueArtemisEnterClientPlayMode === "function") {
      window.risqueArtemisEnterClientPlayMode();
    } else {
      window.risqueArtemisClientPlaying = true;
      window.risqueDisplayIsPublic = false;
      window.risqueDisplayMode = "host";
      document.documentElement.classList.remove("risque-view-public");
      document.documentElement.classList.add("risque-view-host");
      document.body.classList.remove("risque-view-public");
      document.body.classList.add("risque-view-host");
    }
    if (typeof window.risqueArtemisDiag === "function") {
      var healKind =
        ph === "deploy"
          ? "deploy_play_mode_heal"
          : ph === "income" || ph === "con-income"
            ? "income_play_mode_heal"
            : "cardplay_play_mode_heal";
      window.risqueArtemisDiag(healKind, "P" + myLocalSlot() + " forced client play mode", {
        currentPlayer: gs.currentPlayer,
        controlSlot: gs.artemisControlSlot,
      });
    }
    return true;
  };

  function artemisSyncSpectatorHudClass(gs) {
    if (!window.risqueArtemisMode) return;
    var hudRoot = document.getElementById("runtime-hud-root");
    if (!hudRoot) return;
    var spectator =
      window.risqueArtemisNetClient &&
      !window.risqueArtemisHost &&
      gs &&
      !artemisClientIsActivePlayer(gs);
    hudRoot.classList.toggle("runtime-hud-root--artemis-spectator", !!spectator);
  }

  /** Toggle map click-through + HUD input for the laptop that owns this turn. */
  window.risqueArtemisSyncMyTurnClass = function (gs) {
    if (!window.risqueArtemisMode || !gs) return;
    var ph = String(gs.phase || "");
    var mapPlayPh =
      ph === "deploy" ||
      ph === "cardplay" ||
      ph === "con-cardplay" ||
      ph === "income" ||
      ph === "con-income" ||
      ph === "attack" ||
      ph === "reinforce" ||
      ph === "receivecard" ||
      ph === "getcard";
    if (!mapPlayPh) {
      document.documentElement.classList.remove("risque-artemis-my-turn");
      artemisSyncSpectatorHudClass(gs);
      return;
    }
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }
    if (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) {
      document.documentElement.classList.add("risque-artemis-my-turn");
    } else {
      document.documentElement.classList.remove("risque-artemis-my-turn");
    }
    artemisSyncSpectatorHudClass(gs);
  };

  function clientSessionName() {
    var myNm = window.risqueArtemisPlayerName;
    if (!myNm) {
      try {
        myNm = sessionStorage.getItem("risqueArtemisPlayerName");
      } catch (eNm) {
        /* ignore */
      }
    }
    return myNm || "";
  }

  window.risqueArtemisClientNameMatchesCurrent = function (gs) {
    gs = gs || window.gameState;
    if (!gs || !gs.currentPlayer) return false;
    if (!window.risqueArtemisNetClient || window.risqueArtemisHost) return false;
    var myNm = clientSessionName();
    return !!(myNm && normName(myNm) === normName(gs.currentPlayer));
  };

  /** Prevent ensureSetupHud from wiping cardplay/income controls on mirror refresh. */
  window.risqueArtemisShouldKeepPhaseSlotContent = function () {
    if (!window.risqueArtemisMode) return false;
    var gs = window.gameState;
    var ph = gs ? String(gs.phase || "") : "";
    if (
      (ph === "cardplay" || ph === "con-cardplay") &&
      typeof window.risqueArtemisClientStickyCardplayOwns === "function" &&
      window.risqueArtemisClientStickyCardplayOwns(gs)
    ) {
      return true;
    }
    if (ph === "cardplay" || ph === "con-cardplay") {
      if (
        typeof window.risqueArtemisMockCardplayControlsPresent === "function" &&
        window.risqueArtemisMockCardplayControlsPresent()
      ) {
        return true;
      }
      if (document.querySelector(".risque-phase-content .cardplay-compact-root")) {
        return true;
      }
      if (document.querySelector(".risque-phase-content .cardplay-artemis-panes")) {
        return true;
      }
      if (document.querySelector(".risque-phase-content .risque-artemis-cardplay-spectate")) {
        return true;
      }
    }
    if (ph === "income" || ph === "con-income") {
      if (
        typeof window.risqueArtemisIncomeControlsPresent === "function" &&
        window.risqueArtemisIncomeControlsPresent()
      ) {
        return true;
      }
      if (
        typeof window.risqueArtemisMockIncomeControlsPresent === "function" &&
        window.risqueArtemisMockIncomeControlsPresent()
      ) {
        return true;
      }
      if (document.querySelector(".risque-phase-content .income-hud-phase-stack")) {
        return true;
      }
    }
    if (ph === "receivecard" || ph === "getcard") {
      if (
        typeof window.risqueArtemisReceiveCardControlsPresent === "function" &&
        window.risqueArtemisReceiveCardControlsPresent()
      ) {
        return true;
      }
      if (document.querySelector("#risque-phase-content .receivecard-compact-root")) {
        return true;
      }
    }
    if (ph === "reinforce") {
      if (document.getElementById("reinforce-btn-skip")) {
        return true;
      }
    }
    if (
      typeof window.risqueArtemisCardplayControlsPresent === "function" &&
      window.risqueArtemisCardplayControlsPresent()
    ) {
      return true;
    }
    return false;
  };

  /** Client owns cardplay when roster/name matches currentPlayer — survives stale controlSlot. */
  window.risqueArtemisClientStickyCardplayOwns = function (gs) {
    if (!window.risqueArtemisMode || window.risqueArtemisHost || !gs) return false;
    if (String(gs.phase || "") !== "cardplay" && String(gs.phase || "") !== "con-cardplay") {
      return false;
    }
    if (typeof window.risqueArtemisBindIdentityFromState === "function") {
      window.risqueArtemisBindIdentityFromState(gs);
    }
    return window.risqueArtemisClientNameMatchesCurrent(gs);
  };

  function artemisHudBannerForPhase(ph, gs) {
    ph = String(ph || "");
    if (ph === "cardplay" || ph === "con-cardplay") {
      if (gs && gs.currentPlayer) {
        return "CARD PLAY-" + String(gs.currentPlayer).trim().toUpperCase();
      }
      return "CARD PLAY";
    }
    if (ph === "income" || ph === "con-income") return "INCOME";
    if (ph === "deploy") {
      return typeof window.risqueArtemisIsSetupDeploy === "function" &&
        window.risqueArtemisIsSetupDeploy(gs)
        ? "FIRST DEPLOYMENT"
        : "DEPLOYMENT";
    }
    if (ph === "attack") return "ATTACK";
    if (ph === "reinforce") return "REINFORCEMENT";
    if (ph === "playerSelect") return "PLAYER SELECT";
    if (ph === "deal") return "DEAL";
    return "SETUP";
  }

  /** Control voice carries player-up / waiting text — ARTEMIS omits the redundant banner row. */
  window.risqueArtemisSyncPhaseControlVoice = function (gs) {
    if (!window.risqueArtemisMode || !gs || !window.risqueRuntimeHud) return;
    if (typeof window.risqueRuntimeHud.setControlVoiceText !== "function") return;
    var ph = String(gs.phase || "");
    var nameU = String(gs.currentPlayer || "PLAYER").toUpperCase();
    var mine =
      (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) ||
      (typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
        window.risqueArtemisClientNameMatchesCurrent(gs));
    if (ph === "cardplay" || ph === "con-cardplay") {
      if (
        typeof window.risqueArtemisUseMockCardplay === "function" &&
        window.risqueArtemisUseMockCardplay()
      ) {
        if (mine) {
          window.risqueRuntimeHud.setControlVoiceText(
            nameU + " — CARD PLAY",
            "No cards in hand (mock). Tap SKIP or CONTINUE for income."
          );
        } else {
          window.risqueRuntimeHud.setControlVoiceText("WAITING FOR " + nameU + " — CARD PLAY", "");
        }
      } else if (mine && typeof window.risqueArtemisApplyCardplayHudLayout === "function") {
        window.risqueArtemisApplyCardplayHudLayout(gs);
      } else if (mine) {
        window.risqueRuntimeHud.setControlVoiceText(nameU + " — CARD PLAY", "Select cards to play or tap SKIP.");
      } else if (typeof window.risquePublicApplyVoiceAndLogMirror === "function" && gs.risquePublicCardplayPrimary) {
        window.risquePublicApplyVoiceAndLogMirror(gs);
      } else {
        var waitCp =
          gs.risquePublicCardplayPrimary != null
            ? String(gs.risquePublicCardplayPrimary).trim()
            : nameU + " IS IN CARD PLAY";
        var waitRep =
          gs.risquePublicCardplayReport != null
            ? String(gs.risquePublicCardplayReport).trim()
            : "WAITING...";
        window.risqueRuntimeHud.setControlVoiceText(waitCp, waitRep);
      }
      return;
    }
    if (ph === "income" || ph === "con-income") {
      if (
        !gs.risquePublicIncomeBreakdown &&
        typeof window.risqueArtemisEnsurePublicIncomeBreakdown === "function"
      ) {
        window.risqueArtemisEnsurePublicIncomeBreakdown(gs);
        gs = window.gameState || gs;
      }
      if (mine) {
        if (
          !gs.risquePublicIncomeBreakdown &&
          typeof window.risqueArtemisEnsureIncomeInteractive === "function"
        ) {
          window.risqueArtemisEnsureIncomeInteractive(gs);
          gs = window.gameState || gs;
        }
        if (
          gs.risquePublicIncomeBreakdown &&
          typeof window.risqueHostApplyIncomeBreakdownVoice === "function"
        ) {
          window.risqueHostApplyIncomeBreakdownVoice(gs);
        } else {
          window.risqueRuntimeHud.setControlVoiceText(nameU + " — INCOME", "");
        }
      } else {
        if (
          gs.risquePublicIncomeBreakdown &&
          typeof window.risqueHostApplyIncomeBreakdownVoice === "function"
        ) {
          window.risqueHostApplyIncomeBreakdownVoice(gs);
        } else if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
          window.risquePublicApplyVoiceAndLogMirror(gs);
        } else {
          window.risqueRuntimeHud.setControlVoiceText("WAITING FOR " + nameU + " — INCOME", "");
        }
      }
      return;
    }
    if (ph === "deploy") {
      if (typeof window.risqueArtemisClearIncomeVoiceDom === "function") {
        window.risqueArtemisClearIncomeVoiceDom();
      }
      if (mine) {
        if (typeof window.risqueArtemisApplyDeployVoiceFromState === "function") {
          window.risqueArtemisApplyDeployVoiceFromState(gs);
        } else if (typeof window.risqueRefreshDeployNarration === "function") {
          window.risqueRefreshDeployNarration(gs);
        }
      } else if (typeof window.risqueArtemisRefreshDeploySpectator === "function") {
        window.risqueArtemisRefreshDeploySpectator(gs);
      } else if (typeof window.risqueArtemisApplyDeploySpectatorFromState === "function") {
        window.risqueArtemisApplyDeploySpectatorFromState(gs);
      } else {
        var waitDep =
          String(gs.risquePublicDeployBanner || "").trim() ||
          "WAITING FOR " + nameU + " TO DEPLOY";
        window.risqueRuntimeHud.setControlVoiceText(waitDep, "");
      }
      return;
    }
    if (ph === "attack" || ph === "reinforce") {
      if (typeof window.risqueArtemisClearIncomeVoiceDom === "function") {
        window.risqueArtemisClearIncomeVoiceDom();
      }
      if (
        ph === "attack" &&
        ((typeof window.risqueIsAttackCampaignMapPlanning === "function" &&
          window.risqueIsAttackCampaignMapPlanning()) ||
          (typeof window.risqueIsAttackCampaignActive === "function" &&
            window.risqueIsAttackCampaignActive()))
      ) {
        return;
      }
      if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
        window.risquePublicApplyVoiceAndLogMirror(gs);
      } else if (!mine) {
        window.risqueRuntimeHud.setControlVoiceText("WAITING FOR " + nameU + " — " + artemisHudBannerForPhase(ph, gs), "");
      }
      return;
    }
  };

  /** Force omni toggle row visible — clients may keep login HUD or miss html.risque-artemis-client CSS. */
  window.risqueArtemisEnsureHudTogglesVisible = function () {
    if (!window.risqueArtemisMode) return;
    var hudRoot = document.getElementById("runtime-hud-root");
    if (!hudRoot || hudRoot.classList.contains("runtime-hud-root--login")) return;
    var phHud = String(
      (window.gameState && window.gameState.phase) ||
        document.body.getAttribute("data-risque-phase") ||
        ""
    );
    if (
      phHud !== "attack" &&
      phHud !== "reinforce" &&
      phHud !== "receivecard" &&
      phHud !== "getcard"
    ) {
      hudRoot.classList.add("runtime-hud-root--artemis-compact");
    } else {
      hudRoot.classList.remove("runtime-hud-root--artemis-compact");
    }
    var row = hudRoot.querySelector(".hud-title-stack__host-top-buttons");
    if (row) {
      row.style.setProperty("display", "flex", "important");
      row.style.setProperty("visibility", "visible", "important");
    }
    var btns = hudRoot.querySelectorAll(".hud-title-stack__host-top-buttons .risque-host-topbar-btn");
    for (var i = 0; i < btns.length; i += 1) {
      var btn = btns[i];
      if (!btn || btn.id === "risque-host-tv-cursor-toggle") continue;
      btn.style.setProperty("display", "inline-flex", "important");
      btn.style.setProperty("visibility", "visible", "important");
    }
  };

  /**
   * Deploy owner voice chrome (artemis-deploy-panel.js) stamps INLINE height/min/max-height + font
   * vars on #control-voice with !important. Inline !important beats any stylesheet !important, so if
   * that stamp survives a phase change it forces the CV to deploy's 168px in attack/income/etc — which
   * looked like a broken CSS fix (a fresh mock game passes deploy→attack and inherited the stamp; a
   * reload straight into ?phase=attack never got stamped, so it looked correct). Clear the stamp the
   * moment we're no longer in deploy so the phase's own CSS wins on first render. Scoped to the
   * deploy-owner marker class so we never touch unrelated inline styles.
   */
  function artemisClearDeployOwnerVoiceStamp() {
    var cv = document.getElementById("control-voice");
    if (!cv || !cv.classList.contains("ucp-control-voice--artemis-deploy-owner")) return;
    cv.classList.remove("ucp-control-voice--artemis-deploy-owner");
    ["height", "min-height", "max-height", "--risque-voice-font-size", "--risque-voice-report-size"].forEach(
      function (prop) {
        try {
          cv.style.removeProperty(prop);
        } catch (eCvProp) {
          /* ignore */
        }
      }
    );
    ["control-voice-text", "control-voice-report"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      ["font-family", "font-size", "font-weight", "line-height", "display"].forEach(function (prop) {
        try {
          el.style.removeProperty(prop);
        } catch (eTxtProp) {
          /* ignore */
        }
      });
    });
    var msgs = cv.querySelector ? cv.querySelector(".ucp-voice-messages") : null;
    if (msgs) {
      try {
        msgs.style.removeProperty("font-size");
      } catch (eMsgProp) {
        /* ignore */
      }
    }
  }

  function artemisStampOmniHudDocumentClasses(gs) {
    if (!window.risqueArtemisMode) return;
    var ph = gs ? String(gs.phase || "") : "";
    if (ph) {
      try {
        document.body.setAttribute("data-risque-phase", ph);
      } catch (ePhAttr) {
        /* ignore */
      }
    }
    if (ph && ph !== "deploy") {
      artemisClearDeployOwnerVoiceStamp();
    }
    if (window.risqueArtemisHost) {
      document.documentElement.classList.add("risque-artemis-host");
      document.documentElement.classList.add("risque-view-host");
      document.body.classList.add("risque-view-host");
      document.body.classList.remove("risque-view-public");
    } else if (window.risqueArtemisNetClient) {
      document.documentElement.classList.add("risque-artemis-client");
      var activePlay = !!window.risqueArtemisClientPlaying;
      if (
        !activePlay &&
        gs &&
        typeof window.risqueArtemisClientIsActivePlayer === "function" &&
        window.risqueArtemisClientIsActivePlayer(gs)
      ) {
        activePlay = true;
        window.risqueArtemisClientPlaying = true;
        window.risqueDisplayIsPublic = false;
        window.risqueDisplayMode = "host";
      }
      if (activePlay) {
        document.documentElement.classList.remove("risque-view-public");
        document.documentElement.classList.add("risque-view-host");
        document.body.classList.remove("risque-view-public");
        document.body.classList.add("risque-view-host");
      } else {
        document.documentElement.classList.add("risque-view-public");
        document.documentElement.classList.remove("risque-view-host");
        document.body.classList.add("risque-view-public");
        document.body.classList.remove("risque-view-host");
      }
    }
    if (ph && ph !== "login" && ph !== "welcome") {
      try {
        document.documentElement.classList.remove("risque-artemis-login-active");
        document.documentElement.classList.remove("risque-artemis-login-confirmed");
        document.body.classList.remove("risque-public-login-active");
      } catch (eCls) {
        /* ignore */
      }
    }
  }

  /** Phases that use runtimeHud.ensure() (attack chrome) — never swap in setup HUD. */
  function artemisUsesAttackHudLayout(ph) {
    ph = String(ph || "");
    return ph === "attack" || ph === "reinforce" || ph === "receivecard" || ph === "getcard";
  }

  /** All ARTEMIS laptops: full HUD + omni toggles after login (spectator or active). */
  window.risqueArtemisEnsureOmniClientHud = function (gs) {
    if (!window.risqueArtemisMode || !gs) return;
    var ph = String(gs.phase || "");
    if (ph === "login") return;
    if (ph !== "login" && window.risqueArtemisNetClient && !window.risqueArtemisHost) {
      if (typeof window.risqueArtemisHideLoginPanel === "function") {
        window.risqueArtemisHideLoginPanel();
      }
      try {
        document.documentElement.classList.remove("risque-artemis-login-active");
        document.documentElement.classList.remove("risque-artemis-login-confirmed");
        document.body.classList.remove("risque-public-login-active");
      } catch (eHideLogin) {
        /* ignore */
      }
      if (window.risqueArtemisLobbyStarted) {
        var legacyLoginHud = document.getElementById("risque-login-hud-root");
        if (legacyLoginHud && legacyLoginHud.parentNode) {
          legacyLoginHud.parentNode.removeChild(legacyLoginHud);
        }
      }
    }
    if (ph === "welcome") {
      artemisStampOmniHudDocumentClasses(gs);
      var uioWelcome = document.getElementById("ui-overlay");
      if (uioWelcome && window.risqueRuntimeHud) {
        var welcomeBanner = artemisHudBannerForPhase(ph, gs) || "WELCOME";
        if (typeof window.risqueRuntimeHud.ensureSetupUnifiedHud === "function") {
          window.risqueRuntimeHud.ensureSetupUnifiedHud(uioWelcome, welcomeBanner, { force: true });
        } else if (typeof window.risqueRuntimeHud.ensureSetupHud === "function") {
          window.risqueRuntimeHud.ensureSetupHud(uioWelcome, welcomeBanner);
        }
      }
      var hudRootWelcome = document.getElementById("runtime-hud-root");
      if (hudRootWelcome) {
        hudRootWelcome.classList.add("runtime-hud-root--artemis-compact");
        hudRootWelcome.classList.remove("runtime-hud-root--login");
        if (!hudRootWelcome.classList.contains("runtime-hud-root--setup")) {
          hudRootWelcome.classList.add("runtime-hud-root--setup");
        }
      }
      if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
        window.risqueArtemisEnsureHudTogglesVisible();
      }
      if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
        window.risqueWireArtemisHudTogglesOnce();
      }
      return;
    }
    artemisStampOmniHudDocumentClasses(gs);
    var hostAttackSpectator =
      window.risqueArtemisHost &&
      ph === "attack" &&
      typeof window.risqueArtemisIsMyTurn === "function" &&
      !window.risqueArtemisIsMyTurn(gs);
    if (artemisUsesAttackHudLayout(ph) || hostAttackSpectator) {
      var rhAtkSpec = document.getElementById("runtime-hud-root");
      if (rhAtkSpec) {
        rhAtkSpec.classList.remove("runtime-hud-root--setup");
        rhAtkSpec.classList.remove("runtime-hud-root--artemis-compact");
        rhAtkSpec.classList.remove("runtime-hud-root--artemis-cardplay");
        rhAtkSpec.classList.remove("runtime-hud-root--cardplay-panel-only");
      }
      if (hostAttackSpectator) {
        try {
          document.body.classList.add("risque-artemis-attack-spectator");
          document.body.setAttribute("data-risque-show-public-dice", "1");
        } catch (eAtkSpecCls) {
          /* ignore */
        }
      }
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
      return;
    }
    var uio = document.getElementById("ui-overlay");
    if (!uio || !window.risqueRuntimeHud) return;
    if (window.risqueArtemisLobbyStarted && ph !== "login" && ph !== "welcome") {
      if (typeof window.risqueArtemisHideLoginPanel === "function") {
        window.risqueArtemisHideLoginPanel();
      }
      try {
        document.documentElement.classList.remove("risque-artemis-login-active");
        document.documentElement.classList.remove("risque-artemis-login-confirmed");
        document.body.classList.remove("risque-public-login-active");
      } catch (eClrLoginOmni) {
        /* ignore */
      }
      var legacyLoginHudOmni = document.getElementById("risque-login-hud-root");
      if (legacyLoginHudOmni && legacyLoginHudOmni.parentNode) {
        legacyLoginHudOmni.parentNode.removeChild(legacyLoginHudOmni);
      }
    }
    var hudRoot = document.getElementById("runtime-hud-root");
    var loginHud = !!(hudRoot && hudRoot.classList.contains("runtime-hud-root--login"));
    var setupHud = !!(hudRoot && hudRoot.classList.contains("runtime-hud-root--setup"));
    var togglesOk = !!document.getElementById("risque-private-stats-toggle");
    var needsSetup =
      !hudRoot ||
      loginHud ||
      !setupHud ||
      !document.getElementById("control-voice") ||
      !togglesOk;
    var hasOmniShell =
      hudRoot &&
      document.getElementById("control-voice") &&
      document.getElementById("hud-main-panel") &&
      togglesOk;
    if (needsSetup && hasOmniShell && !loginHud) {
      hudRoot.classList.remove("runtime-hud-root--login");
      hudRoot.classList.add("runtime-hud-root--setup");
      hudRoot.classList.add("runtime-hud-root--artemis-compact");
      if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
        window.risqueRuntimeHud.updateTurnBannerFromState(gs);
      }
    } else if (needsSetup) {
      if (window.risqueArtemisLobbyStarted && ph !== "login" && ph !== "welcome") {
        if (hudRoot) {
          hudRoot.classList.remove("runtime-hud-root--login");
        }
      } else {
      var banner = artemisHudBannerForPhase(ph, gs);
      var mustForce =
        loginHud || !document.getElementById("control-voice") || !document.getElementById("hud-main-panel") || !togglesOk;
      if (typeof window.risqueRuntimeHud.ensureSetupUnifiedHud === "function") {
        window.risqueRuntimeHud.ensureSetupUnifiedHud(uio, banner, mustForce ? { force: true } : undefined);
      } else if (typeof window.risqueRuntimeHud.ensureSetupHud === "function") {
        window.risqueRuntimeHud.ensureSetupHud(uio, banner);
      }
      }
    }
    hudRoot = document.getElementById("runtime-hud-root");
    if (hudRoot) {
      hudRoot.classList.add("runtime-hud-root--artemis-compact");
      if (
        document.getElementById("control-voice") &&
        document.getElementById("risque-private-stats-toggle") &&
        !artemisUsesAttackHudLayout(ph)
      ) {
        hudRoot.classList.remove("runtime-hud-root--login");
        if (!hudRoot.classList.contains("runtime-hud-root--setup")) {
          hudRoot.classList.add("runtime-hud-root--setup");
        }
      }
    }
    if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
      window.risqueArtemisEnsureHudTogglesVisible();
    }
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    }
    var phOmni = String(gs.phase || "");
    var cardplayCompactLive =
      (phOmni === "cardplay" || phOmni === "con-cardplay") &&
      !!document.querySelector("#risque-phase-content .cardplay-compact-root");
    if (typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
      if (!cardplayCompactLive) {
        window.risqueRuntimeHud.updateTurnBannerFromState(gs);
      } else if (typeof window.risqueArtemisApplyCardplayHudLayout === "function") {
        window.risqueArtemisApplyCardplayHudLayout(gs);
      }
    }
    if (typeof window.risqueArtemisSyncPhaseControlVoice === "function") {
      var skipDepOmniVoice =
        phOmni === "deploy" &&
        typeof window.risqueArtemisLocalOwnsSetupDeploy === "function" &&
        !window.risqueArtemisLocalOwnsSetupDeploy(gs);
      if (
        !cardplayCompactLive &&
        !skipDepOmniVoice &&
        phOmni !== "attack" &&
        phOmni !== "reinforce" &&
        phOmni !== "receivecard" &&
        phOmni !== "getcard"
      ) {
        window.risqueArtemisSyncPhaseControlVoice(gs);
      }
    }
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    } else {
      artemisSyncSpectatorHudClass(gs);
    }
  };

  /** Active client laptop: host view + my-turn class so deploy/cardplay controls are not public-hidden. */
  window.risqueArtemisEnsureClientActivePlay = function (gs) {
    if (!window.risqueArtemisNetClient || window.risqueArtemisHost || !gs) return false;
    var owns =
      (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) ||
      window.risqueArtemisClientNameMatchesCurrent(gs);
    if (!owns) return false;
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (typeof window.risqueArtemisEnterClientPlayMode === "function") {
      window.risqueArtemisEnterClientPlayMode();
    } else {
      window.risqueArtemisClientPlaying = true;
      window.risqueDisplayIsPublic = false;
      window.risqueDisplayMode = "host";
      document.documentElement.classList.remove("risque-view-public");
      document.documentElement.classList.add("risque-view-host");
      document.body.classList.remove("risque-view-public");
      document.body.classList.add("risque-view-host");
    }
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
    if (
      String(gs.phase || "") === "deploy" &&
      typeof window.risqueArtemisEnsureTurnDeployInteractive === "function" &&
      !window.__risqueArtemisTurnDeployInteractiveDepth
    ) {
      window.risqueArtemisEnsureTurnDeployInteractive(gs);
    }
    return true;
  };

  /** Shared owner check for deploy/cardplay panels — name match before slot guard. */
  window.risqueArtemisPanelIsMine = function (gs, ownerSlotOpt) {
    if (!gs) return false;
    if (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) {
      return true;
    }
    if (window.risqueArtemisClientNameMatchesCurrent(gs)) {
      return true;
    }
    var local = myLocalSlot();
    if (!local) return false;
    var owner = Number(ownerSlotOpt) || 0;
    if (owner >= 1 && owner <= 3) {
      return owner === local;
    }
    return false;
  };

  window.risqueArtemisBeginPhaseTransition = function (targetPhase) {
    if (!window.risqueArtemisMode) return;
    window.risqueArtemisPhaseTransition = {
      target: String(targetPhase || ""),
      at: Date.now()
    };
  };

  window.risqueArtemisForwardPhaseRank = function (ph) {
    var p = String(ph || "");
    if (p === "cardplay" || p === "con-cardplay") return 10;
    if (p === "income" || p === "con-income") return 20;
    if (p === "deploy" || p === "con-deploy" || p === "deploy1") return 30;
    if (p === "attack") return 40;
    if (p === "reinforce") return 50;
    if (p === "receivecard" || p === "getcard") return 60;
    return 0;
  };

  window.risqueArtemisShouldIgnoreStalePhaseSync = function (gs) {
    if (!window.risqueArtemisMode || !gs) return false;
    var localPh = window.gameState ? String(window.gameState.phase || "") : "";
    var incomingPh = String(gs.phase || "");
    if (!localPh || !incomingPh || localPh === incomingPh) return false;
    var localRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(localPh)
        : 0;
    var incomingRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(incomingPh)
        : 0;
    if (localRank > 0 && incomingRank > localRank) {
      return false;
    }
    if (
      window.risqueArtemisNetClient &&
      !window.risqueArtemisHost &&
      (localPh === "income" || localPh === "con-income") &&
      (incomingPh === "cardplay" || incomingPh === "con-cardplay")
    ) {
      return true;
    }
    if (
      window.risqueArtemisNetClient &&
      !window.risqueArtemisHost &&
      localPh === "income" &&
      incomingPh === "playerSelect"
    ) {
      return true;
    }
    if (
      window.risqueArtemisNetClient &&
      !window.risqueArtemisHost &&
      (localPh === "cardplay" || localPh === "con-cardplay") &&
      incomingPh === "playerSelect"
    ) {
      return true;
    }
    if (
      window.__risqueArtemisCardplayLeftAt &&
      Date.now() - Number(window.__risqueArtemisCardplayLeftAt) < 20000 &&
      (incomingPh === "cardplay" || incomingPh === "con-cardplay")
    ) {
      return true;
    }
    var tr = window.risqueArtemisPhaseTransition;
    if (!tr || !tr.target) return false;
    if (Date.now() - (Number(tr.at) || 0) > 15000) return false;
    if (localPh === tr.target && incomingPh !== tr.target) return true;
    if (localPh !== tr.target) return false;
    return incomingPh !== tr.target;
  };

  window.risqueArtemisEndPhaseTransition = function (gs) {
    if (!window.risqueArtemisPhaseTransition || !gs) return;
    var ph = String(gs.phase || "");
    var target = String(window.risqueArtemisPhaseTransition.target || "");
    if (ph === target) {
      delete window.risqueArtemisPhaseTransition;
      return;
    }
    var phRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(ph)
        : 0;
    var targetRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(target)
        : 0;
    if (phRank > 0 && targetRank > 0 && phRank >= targetRank) {
      delete window.risqueArtemisPhaseTransition;
    }
  };

  window.risqueArtemisResetClientDeployMount = function () {
    if (typeof window.risqueArtemisUnmountPortableDeploy === "function") {
      window.risqueArtemisUnmountPortableDeploy();
    }
    if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
      window.risqueTeardownArtemisSetupDeploy(true);
    }
  };

  window.risqueArtemisAfterSetupDeployTurnAdvance = function (gs) {
    if (typeof window.risqueArtemisSyncFromState === "function") {
      window.risqueArtemisSyncFromState(gs);
    }
    if (
      window.risqueArtemisHost &&
      gs &&
      String(gs.phase || "") === "deploy" &&
      typeof window.risqueArtemisIsSetupDeploy === "function" &&
      window.risqueArtemisIsSetupDeploy(gs) &&
      typeof window.risqueArtemisLocalOwnsSetupDeploy === "function" &&
      !window.risqueArtemisLocalOwnsSetupDeploy(gs) &&
      typeof window.risqueArtemisApplyHostDeploySpectator === "function"
    ) {
      try {
        window.risqueArtemisApplyHostDeploySpectator(gs);
      } catch (eHostHandoff) {
        /* ignore */
      }
    }
  };

  /** Clients entering cardplay from mirror — upgrade login HUD, paint map, clear roulette UI (no URL reload). */
  function artemisClientPrepareCardplayChrome(gs) {
    if (!window.risqueArtemisNetClient || window.risqueArtemisHost || !gs) return;
    if (String(gs.phase || "") !== "cardplay") return;

    try {
      delete gs.risquePublicPlayerSelectFlash;
    } catch (eFlash) {
      /* ignore */
    }

    var psRoot = document.getElementById("risque-player-select-root");
    if (psRoot && psRoot.parentNode) {
      try {
        psRoot.parentNode.removeChild(psRoot);
      } catch (eRm) {
        /* ignore */
      }
    }
    if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
      window.risqueTeardownArtemisSetupDeploy(true);
    }

    document.body.classList.add("risque-setup-fullstage");
    window.gameState = gs;
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      /* ignore */
    }

    var uio = document.getElementById("ui-overlay");
    if (uio && typeof window.risqueArtemisEnsureOmniClientHud === "function") {
      window.risqueArtemisEnsureOmniClientHud(gs);
    } else if (uio && window.risqueRuntimeHud) {
      var hudRoot = document.getElementById("runtime-hud-root");
      if (
        !hudRoot ||
        hudRoot.classList.contains("runtime-hud-root--login") ||
        !hudRoot.classList.contains("runtime-hud-root--setup")
      ) {
        if (typeof window.risqueRuntimeHud.ensureSetupHud === "function") {
          window.risqueRuntimeHud.ensureSetupHud(uio, "CARD PLAY");
        }
      }
      if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
        window.risqueWireArtemisHudTogglesOnce();
      }
      if (typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
        window.risqueRuntimeHud.updateTurnBannerFromState(gs);
      }
    }

    if (window.gameUtils && gs) {
      try {
        window.gameUtils.initGameView();
        window.gameUtils.renderTerritories(null, gs);
        window.gameUtils.renderStats(gs);
        if (typeof window.gameUtils.resizeCanvas === "function") {
          window.gameUtils.resizeCanvas();
        }
      } catch (eMap) {
        /* ignore */
      }
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
      requestAnimationFrame(function () {
        try {
          window.risqueRuntimeHud.syncPosition();
        } catch (ePos) {
          /* ignore */
        }
      });
    }
    var myNmCp = window.risqueArtemisPlayerName;
    if (!myNmCp) {
      try {
        myNmCp = sessionStorage.getItem("risqueArtemisPlayerName");
      } catch (eNmCp) {
        /* ignore */
      }
    }
    if (typeof window.risqueArtemisBindIdentityFromState === "function") {
      window.risqueArtemisBindIdentityFromState(gs);
    }
    if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
      window.risqueArtemisEnsureClientActivePlay(gs);
    }
    var mineCp = artemisClientIsActivePlayer(gs);
    if (mineCp) {
      if (typeof window.risqueArtemisSanitizeCardplaySpectatorHandMirror === "function") {
        window.risqueArtemisSanitizeCardplaySpectatorHandMirror(gs);
      }
      if (typeof window.risqueArtemisEnsureClientCardplayHand === "function") {
        window.risqueArtemisEnsureClientCardplayHand(gs);
      }
      if (typeof window.risqueArtemisEnterClientPlayMode === "function") {
        window.risqueArtemisEnterClientPlayMode();
      }
      if (typeof window.risqueArtemisSyncPhaseControlVoice === "function") {
        window.risqueArtemisSyncPhaseControlVoice(gs);
      }
    } else if (typeof window.risqueArtemisReconcileCardplaySpectatorChrome === "function") {
      window.risqueArtemisReconcileCardplaySpectatorChrome(gs);
    }
  }

  /** Clients entering deploy from mirror — setup HUD + host view for full bank/action row. */
  function artemisClientPrepareDeployChrome(gs) {
    if (!window.risqueArtemisNetClient || window.risqueArtemisHost || !gs) return;
    if (String(gs.phase || "") !== "deploy") return;

    if (typeof window.risqueArtemisClearSetupPlayerSelectArtifacts === "function") {
      window.risqueArtemisClearSetupPlayerSelectArtifacts(gs);
    }

    if (
      typeof window.risqueArtemisIsSetupDeploy === "function" &&
      window.risqueArtemisIsSetupDeploy(gs)
    ) {
      gs.risqueMirrorDeployRoute = "setup";
      if (typeof window.risqueSetMirrorDeployRoute === "function") {
        window.risqueSetMirrorDeployRoute("setup");
      }
    } else if (String(gs.risqueMirrorDeployRoute || "") !== "turn") {
      gs.risqueMirrorDeployRoute = "turn";
      if (typeof window.risqueSetMirrorDeployRoute === "function") {
        window.risqueSetMirrorDeployRoute("turn");
      }
    }

    document.body.classList.add("risque-setup-fullstage");
    window.gameState = gs;
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      /* ignore */
    }

    var uio = document.getElementById("ui-overlay");
    if (uio && window.risqueRuntimeHud) {
      var hudRoot = document.getElementById("runtime-hud-root");
      if (
        !hudRoot ||
        hudRoot.classList.contains("runtime-hud-root--login") ||
        !hudRoot.classList.contains("runtime-hud-root--setup")
      ) {
        if (typeof window.risqueRuntimeHud.ensureSetupHud === "function") {
          window.risqueRuntimeHud.ensureSetupHud(uio, "DEPLOYMENT");
        }
      }
      if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
        window.risqueWireArtemisHudTogglesOnce();
      }
      if (typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
        window.risqueRuntimeHud.updateTurnBannerFromState(gs);
      }
    }

    if (window.gameUtils && gs) {
      try {
        window.gameUtils.initGameView();
        window.gameUtils.renderTerritories(null, gs);
        window.gameUtils.renderStats(gs);
        if (typeof window.gameUtils.resizeCanvas === "function") {
          window.gameUtils.resizeCanvas();
        }
      } catch (eMap) {
        /* ignore */
      }
    }
    if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
      window.risqueArtemisEnsureClientActivePlay(gs);
    }
  }
  window.risqueArtemisPrepareDeployChrome = artemisClientPrepareDeployChrome;

  function cycleProbeContextActive(gs) {
    if (gs && gs.artemisCycleProbe) return true;
    if (window.risqueArtemisCycleProbeActive) return true;
    if (
      !gs ||
      typeof gs.artemisCycleProbeStep !== "number" ||
      gs.artemisCycleProbeStep < 0
    ) {
      return false;
    }
    try {
      return sessionStorage.getItem("risqueArtemisCycleProbe") === "1";
    } catch (eCp) {
      return false;
    }
  }

  window.risqueArtemisSyncFromState = function (gs) {
    if (!gs) return;
    if (window.__risqueArtemisCardplayMountInProgress) return;
    if (window.__risqueArtemisSyncFromStateDepth) return;
    window.__risqueArtemisSyncFromStateDepth = true;
    try {
    var prevPhSync = window.gameState ? String(window.gameState.phase || "") : "";
    var phIncoming = String(gs.phase || "");
    if (
      prevPhSync === "deploy" &&
      phIncoming !== "deploy" &&
      window.gameState &&
      typeof window.risqueArtemisIsSetupDeploy === "function" &&
      window.risqueArtemisIsSetupDeploy(window.gameState)
    ) {
      window.risqueArtemisDeployHandoffPending = 0;
      window.risqueArtemisDeployPushLocked = false;
      window.risqueArtemisDeployRelinquishedSeq = 0;
      if (typeof window.risqueArtemisUnmountPortableDeploy === "function") {
        window.risqueArtemisUnmountPortableDeploy();
      }
      if (typeof window.risqueArtemisUnmountPortableTurnDeploy === "function") {
        window.risqueArtemisUnmountPortableTurnDeploy();
      }
    }
    if (
      typeof window.risqueArtemisShouldIgnoreStalePhaseSync === "function" &&
      window.risqueArtemisShouldIgnoreStalePhaseSync(gs)
    ) {
      return;
    }
    if (
      window.risqueArtemisNetClient &&
      window.gameState &&
      String(gs.phase || "") === "deploy" &&
      String(window.gameState.phase || "") !== "deploy"
    ) {
      var staleInSeq = Number(gs.risqueArtemisControlSeq) || 0;
      var staleLiveSeq = Number(window.gameState.risqueArtemisControlSeq) || 0;
      if (staleLiveSeq > 0 && (staleInSeq === 0 || staleLiveSeq > staleInSeq)) {
        return;
      }
    }
    if (typeof window.risqueArtemisEnsureRosterOnState === "function") {
      window.risqueArtemisEnsureRosterOnState(gs);
    }
    bindIdentityFromRoster(gs);
    if (cycleProbeContextActive(gs)) {
      if (!gs.artemisCycleProbe) {
        gs.artemisCycleProbe = true;
      }
      if (typeof window.risqueArtemisCycleProbeSync === "function") {
        window.risqueArtemisCycleProbeSync(gs);
      }
      return;
    }
    var ph = String(gs.phase || "");
    if (
      ph === "cardplay" ||
      ph === "con-cardplay" ||
      ph === "income" ||
      ph === "con-income" ||
      ph === "deploy"
    ) {
      if (
        window.risqueArtemisNetClient &&
        typeof window.risqueArtemisEnsureClientActivePlay === "function"
      ) {
        window.risqueArtemisEnsureClientActivePlay(gs);
      }
    }
    window.risqueArtemisEnsureOmniClientHud(gs);
    var setupPh =
      ph === "login" ||
      ph === "welcome" ||
      ph === "playerSelect" ||
      ph === "deal";

    if (
      isSetupDeploy(gs) &&
      typeof window.risqueArtemisResolveOwnerSlot === "function"
    ) {
      window.risqueArtemisResolveOwnerSlot(gs);
    } else if (
      isSetupDeploy(gs) &&
      (!gs.artemisControlSlot || gs.artemisControlSlot < 1) &&
      typeof window.risqueArtemisStampControlSlot === "function"
    ) {
      window.risqueArtemisStampControlSlot(gs);
    }

    if (ph === "deploy") {
      var prevPhForDeploy =
        window.gameState && window.gameState !== gs
          ? String(window.gameState.phase || "")
          : "";
      artemisEnsureTurnDeployRoute(gs, prevPhForDeploy);
      artemisClientPrepareDeployChrome(gs);
      if (typeof window.risqueArtemisTeardownMockPhases === "function") {
        window.risqueArtemisTeardownMockPhases();
      }
      if (
        typeof window.risqueArtemisIsSetupDeploy === "function" &&
        window.risqueArtemisIsSetupDeploy(gs) &&
        typeof window.risqueArtemisEnsureSetupDeployInteractive === "function"
      ) {
        window.risqueArtemisEnsureSetupDeployInteractive(gs);
      }
    }

    if (isSetupDeploy(gs) && typeof window.risqueArtemisSyncPortableDeploy === "function") {
      if (window.risqueArtemisHost && !window.risqueArtemisNetClient) {
        if (
          typeof window.risqueArtemisLocalOwnsSetupDeploy === "function" &&
          window.risqueArtemisLocalOwnsSetupDeploy(gs)
        ) {
          window.risqueArtemisSyncPortableDeploy(gs);
        } else if (typeof window.risqueArtemisApplyHostDeploySpectator === "function") {
          window.risqueArtemisApplyHostDeploySpectator(gs);
        }
      } else {
        window.risqueArtemisSyncPortableDeploy(gs);
      }
    } else if (
      ph === "deploy" &&
      typeof window.risqueArtemisSyncPortableTurnDeploy === "function"
    ) {
      if (typeof window.risqueArtemisStampControlSlot === "function") {
        window.risqueArtemisStampControlSlot(gs);
      }
      artemisClearStaleDeployHandoffFlagsForTurnDeploy(gs);
      window.risqueArtemisSyncPortableTurnDeploy(gs);
      if (typeof window.risqueArtemisEnsureTurnDeployInteractive === "function") {
        window.risqueArtemisEnsureTurnDeployInteractive(gs);
      }
      if (
        typeof window.risqueArtemisIsMyTurn === "function" &&
        !window.risqueArtemisIsMyTurn(gs) &&
        typeof window.risqueArtemisApplyDeploySpectatorMap === "function"
      ) {
        window.risqueArtemisApplyDeploySpectatorMap(gs);
      }
    } else if (typeof window.risqueArtemisUnmountPortableTurnDeploy === "function") {
      window.risqueArtemisUnmountPortableTurnDeploy();
    }

    if (ph === "cardplay") {
      window.risqueArtemisDeployHandoffPending = 0;
      window.risqueArtemisDeployPushLocked = false;
      window.risqueArtemisDeployRelinquishedSeq = 0;
      window.risqueArtemisAwaitSetupDeployFinish = false;
      try {
        delete window.risqueArtemisDeployHandoffPlayer;
      } catch (eClrCpHand) {
        /* ignore */
      }
      if (typeof window.risqueArtemisResetClientDeployMount === "function") {
        window.risqueArtemisResetClientDeployMount();
      }
      if (typeof window.risqueArtemisClearSetupPlayerSelectArtifacts === "function") {
        window.risqueArtemisClearSetupPlayerSelectArtifacts(gs);
      }
      artemisClientPrepareCardplayChrome(gs);
      if (typeof window.risqueArtemisStampControlSlot === "function") {
        window.risqueArtemisStampControlSlot(gs);
      }
      if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
        window.risqueArtemisResolveOwnerSlot(gs);
      }
      if (typeof window.risqueArtemisSyncPortableCardplay === "function") {
        window.risqueArtemisSyncPortableCardplay(gs);
      } else if (typeof window.risqueArtemisUnmountPortableCardplay === "function") {
        window.risqueArtemisUnmountPortableCardplay();
      }
      if (
        typeof window.risqueArtemisEnsureCardplayInteractive === "function" &&
        !document.querySelector("#risque-phase-content .cardplay-compact-root")
      ) {
        window.risqueArtemisEnsureCardplayInteractive(gs);
      }
      if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
        window.risqueArtemisReconcileClientPlayMode(gs);
      }
      if (typeof window.risqueArtemisSanitizeCardplaySpectatorHandMirror === "function") {
        window.risqueArtemisSanitizeCardplaySpectatorHandMirror(gs);
      }
      if (typeof window.risqueArtemisEnsureClientCardplayHand === "function") {
        window.risqueArtemisEnsureClientCardplayHand(gs);
      }
      if (
        typeof window.risqueArtemisUseMockPhases === "function" &&
        window.risqueArtemisUseMockPhases() &&
        typeof window.risqueArtemisScheduleMockPhaseWatchdog === "function"
      ) {
        window.risqueArtemisScheduleMockPhaseWatchdog(gs);
      }
    } else if (!setupPh && typeof window.risqueArtemisUnmountPortableCardplay === "function") {
      window.risqueArtemisUnmountPortableCardplay();
    }

    if (
      typeof window.risqueArtemisUseMockPhases === "function" &&
      window.risqueArtemisUseMockPhases() &&
      typeof window.risqueArtemisSyncMockPhaseChrome === "function"
    ) {
      window.risqueArtemisSyncMockPhaseChrome(gs);
      if (ph === "cardplay" || ph === "income" || ph === "con-income") {
        if (typeof window.risqueArtemisEnsureMockPhaseInteractive === "function") {
          window.risqueArtemisEnsureMockPhaseInteractive(gs);
        }
      } else if (ph !== "attack" && typeof window.risqueArtemisTeardownMockPhases === "function") {
        window.risqueArtemisTeardownMockPhases();
      }
    } else if (
      (ph === "income" || ph === "con-income") &&
      typeof window.risqueArtemisUseMockIncome === "function" &&
      window.risqueArtemisUseMockIncome() &&
      typeof window.risqueArtemisEnsureMockPhaseInteractive === "function"
    ) {
      window.risqueArtemisEnsureMockPhaseInteractive(gs);
    }

    if (ph === "attack" && typeof window.risqueArtemisSyncPortableAttack === "function") {
      if (typeof window.risqueArtemisClearDeployMapOverlays === "function") {
        window.risqueArtemisClearDeployMapOverlays(gs);
      }
      window.risqueArtemisSyncPortableAttack(gs);
      if (typeof window.risqueArtemisEnsureAttackInteractive === "function") {
        window.risqueArtemisEnsureAttackInteractive(gs);
      }
      if (typeof window.risqueArtemisScheduleAttackMapRouting === "function") {
        window.risqueArtemisScheduleAttackMapRouting(gs);
      } else if (typeof window.risqueArtemisEnsureAttackMapRouting === "function") {
        window.risqueArtemisEnsureAttackMapRouting(gs);
      }
      if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
        window.risqueArtemisEnsureHudTogglesVisible();
      }
      if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
        window.risqueWireArtemisHudTogglesOnce();
      }
    } else if (typeof window.risqueArtemisUnmountPortableAttack === "function") {
      if (typeof window.risqueArtemisCancelAttackMapRouting === "function") {
        window.risqueArtemisCancelAttackMapRouting();
      }
      window.risqueArtemisUnmountPortableAttack();
    }

    var incomePh = ph;
    if (incomePh === "income" || incomePh === "con-income") {
      if (
        typeof window.risqueArtemisUseMockIncome === "function" &&
        !window.risqueArtemisUseMockIncome() &&
        typeof window.risqueArtemisTeardownMockPhases === "function"
      ) {
        window.risqueArtemisTeardownMockPhases();
      }
    }
    if (
      (incomePh === "income" || incomePh === "con-income") &&
      typeof window.risqueArtemisSyncPortableIncome === "function"
    ) {
      window.risqueArtemisSyncPortableIncome(gs);
      if (typeof window.risqueArtemisEnsureIncomeInteractive === "function") {
        window.risqueArtemisEnsureIncomeInteractive(gs);
      }
    } else if (typeof window.risqueArtemisUnmountPortableIncome === "function") {
      window.risqueArtemisUnmountPortableIncome();
    }

    if (
      ph === "reinforce" &&
      typeof window.risqueArtemisSyncPortableReinforce === "function"
    ) {
      window.risqueArtemisSyncPortableReinforce(gs);
    } else {
      if (typeof window.risqueArtemisCancelReinforceMapRouting === "function") {
        window.risqueArtemisCancelReinforceMapRouting();
      }
      if (typeof window.risqueArtemisUnmountPortableReinforce === "function") {
        window.risqueArtemisUnmountPortableReinforce();
      }
    }

    if (
      (ph === "receivecard" || ph === "getcard") &&
      typeof window.risqueArtemisSyncPortableReceiveCard === "function"
    ) {
      window.risqueArtemisSyncPortableReceiveCard(gs);
    } else if (typeof window.risqueArtemisUnmountPortableReceiveCard === "function") {
      window.risqueArtemisUnmountPortableReceiveCard();
    }

    if (setupPh && typeof window.risqueArtemisSyncSetupMirror === "function") {
      window.risqueArtemisSyncSetupMirror(gs);
    }

    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }

    if (typeof window.risqueArtemisEndPhaseTransition === "function") {
      window.risqueArtemisEndPhaseTransition(gs);
    }

    updateStatusForTurn(gs);
    } finally {
      window.__risqueArtemisSyncFromStateDepth = false;
    }
  };

  window.risqueArtemisShouldHostMountCardplay = function (gs) {
    if (!window.risqueArtemisMode) return true;
    if (!window.risqueArtemisHost) return false;
    gs = gs || window.gameState;
    if (!gs || String(gs.phase || "") !== "cardplay") return true;
    return window.risqueArtemisIsMyTurn(gs);
  };

  window.risqueArtemisShouldHostMountAttack = function (gs) {
    if (!window.risqueArtemisMode) return true;
    if (!window.risqueArtemisHost) return false;
    gs = gs || window.gameState;
    if (!gs || String(gs.phase || "") !== "attack") return false;
    return window.risqueArtemisIsMyTurn(gs);
  };

  /** ARTEMIS: only the active attacker's laptop may enable roll/blitz/campaign chrome. */
  window.risqueArtemisShouldAttackChromeBeInteractive = function (gs) {
    if (!window.risqueArtemisMode) return true;
    gs = gs || window.gameState;
    if (!gs || String(gs.phase || "") !== "attack") {
      if (window.risqueArtemisHost && !window.risqueArtemisNetClient) return false;
      return true;
    }
    if (
      window.risqueArtemisHost &&
      !window.risqueArtemisNetClient &&
      typeof window.risqueArtemisShouldHostMountAttack === "function" &&
      !window.risqueArtemisShouldHostMountAttack(gs)
    ) {
      return false;
    }
    if (
      window.risqueArtemisNetClient &&
      !window.risqueArtemisHost &&
      typeof window.risqueArtemisIsMyTurn === "function" &&
      !window.risqueArtemisIsMyTurn(gs)
    ) {
      return false;
    }
    return true;
  };

  window.risqueArtemisShouldHostMountReinforce = function (gs) {
    if (!window.risqueArtemisMode) return true;
    if (!window.risqueArtemisHost) return false;
    gs = gs || window.gameState;
    if (!gs || String(gs.phase || "") !== "reinforce") return true;
    return window.risqueArtemisIsMyTurn(gs);
  };

  window.risqueArtemisClearDeployMapOverlays = function (gsOpt) {
    window.deployedTroops = {};
    window.selectedTerritory = null;
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (gs && typeof gs === "object") {
      delete gs.risqueDeployMirrorDraft;
      delete gs.risqueDeployTransientPrimary;
    }
    if (window.gameUtils && gs) {
      try {
        if (typeof window.gameUtils.renderAll === "function") {
          window.gameUtils.renderAll(gs, null, {});
        } else if (typeof window.gameUtils.renderTerritories === "function") {
          window.gameUtils.renderTerritories(null, gs, {});
        }
      } catch (eClr) {
        /* ignore */
      }
    }
  };

  function artemisLookupTerritoryOwner(gs, label) {
    if (!gs || !label || !Array.isArray(gs.players)) return null;
    for (var pi = 0; pi < gs.players.length; pi++) {
      var pl = gs.players[pi];
      if (!pl || !Array.isArray(pl.territories)) continue;
      for (var ti = 0; ti < pl.territories.length; ti++) {
        var terr = pl.territories[ti];
        if (terr && terr.name === label) {
          return { owner: pl.name, troops: Number(terr.troops) || 0 };
        }
      }
    }
    return null;
  }

  function artemisResolveMapTerritoryLabel(target) {
    if (window.gameUtils && typeof window.gameUtils.resolveTerritoryLabelFromMapTarget === "function") {
      return window.gameUtils.resolveTerritoryLabelFromMapTarget(target);
    }
    if (!target || !target.closest) return null;
    var hit = target.closest(
      ".territory-hit, .territory-circle, .territory-number, .territory-mgm-hit, .territory-circle-outline, .territory-troop-fill, .territory-troop-notches, .territory-marker-inner, .territory-deploy-satellite"
    );
    if (!hit) return null;
    return hit.getAttribute("data-label") || (hit.dataset && hit.dataset.label) || null;
  }

  function artemisMapClickBlocked(target) {
    return !!(
      target &&
      target.closest &&
      target.closest(
        "#runtime-hud-root, #risque-artemis-deploy-dock, #prompt, button, input, select, textarea, a, .attack-toolbar-strip"
      )
    );
  }

  var __artemisAttackMapDelegateWired = false;
  window.risqueArtemisWireAttackMapClickDelegate = function () {
    if (__artemisAttackMapDelegateWired) return;
    __artemisAttackMapDelegateWired = true;
    document.addEventListener(
      "click",
      function (ev) {
        if (!window.risqueArtemisMode) return;
        var gs = window.gameState;
        if (!gs || String(gs.phase || "") !== "attack") return;
        if (typeof window.risqueArtemisIsMyTurn === "function" && !window.risqueArtemisIsMyTurn(gs)) {
          return;
        }
        if (typeof window.risqueArtemisCanLocalPlay === "function" && !window.risqueArtemisCanLocalPlay()) {
          return;
        }
        var t = ev.target;
        if (!t || !t.closest) return;
        if (artemisMapClickBlocked(t)) return;
        var label = artemisResolveMapTerritoryLabel(t);
        if (!label) return;
        var info = artemisLookupTerritoryOwner(gs, label);
        if (!info || typeof window.risqueAttackPhaseTerritoryClick !== "function") return;
        if (typeof window.risqueAttackPhaseTerritoryClick === "function") {
          window.handleTerritoryClick = window.risqueAttackPhaseTerritoryClick;
        }
        try {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          ev.stopPropagation();
        } catch (eStop) {
          /* ignore */
        }
        try {
          window.risqueAttackPhaseTerritoryClick(label, info.owner, info.troops, ev);
        } catch (eAtkClick) {
          /* ignore */
        }
      },
      true
    );
  };
  window.risqueArtemisWireAttackMapClickDelegate();

  /** Attack map routing is live — avoid retry-loop renderTerritories (host hover swell flicker). */
  window.risqueArtemisIsAttackMapRoutingReady = function () {
    return (
      typeof window.risqueAttackPhaseTerritoryClick === "function" &&
      window.handleTerritoryClick === window.risqueAttackPhaseTerritoryClick &&
      document.body.getAttribute("data-risque-phase") === "attack"
    );
  };

  /** Active client attack: body phase + global click handler so renderTerritories wires attack taps. */
  window.risqueArtemisEnsureAttackMapRouting = function (gsOpt, opts) {
    opts = opts && typeof opts === "object" ? opts : {};
    var forceRender = opts.forceRender !== false;
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || String(gs.phase || "") !== "attack") return;
    var ownsAttack =
      (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) ||
      (typeof window.risqueArtemisClientIsActivePlayer === "function" &&
        window.risqueArtemisClientIsActivePlayer(gs));
    if (!ownsAttack) {
      return;
    }
    window.risqueArtemisDeployHandoffPending = 0;
    window.risqueArtemisDeployPushLocked = false;
    try {
      document.body.setAttribute("data-risque-phase", "attack");
    } catch (ePh) {
      /* ignore */
    }
    try {
      var atkUrl = "game.html?phase=attack";
      if (typeof window.risqueArtemisAppendSessionParams === "function") {
        atkUrl = window.risqueArtemisAppendSessionParams(atkUrl);
      }
      if (window.history && typeof window.history.replaceState === "function") {
        window.history.replaceState(null, "", atkUrl);
      }
    } catch (eUrl) {
      /* ignore */
    }
    if (typeof window.risqueArtemisWireAttackMapClickDelegate === "function") {
      window.risqueArtemisWireAttackMapClickDelegate();
    }
    if (typeof window.risqueAttackPhaseTerritoryClick === "function") {
      window.handleTerritoryClick = window.risqueAttackPhaseTerritoryClick;
    }
    if (window.risqueArtemisNetClient) {
      if (typeof window.risqueArtemisEnterClientPlayMode === "function") {
        window.risqueArtemisEnterClientPlayMode();
      } else {
        window.risqueArtemisClientPlaying = true;
        window.risqueDisplayIsPublic = false;
        window.risqueDisplayMode = "host";
        document.documentElement.classList.remove("risque-view-public");
        document.documentElement.classList.add("risque-view-host");
        document.body.classList.remove("risque-view-public");
        document.body.classList.add("risque-view-host");
      }
    }
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
    if (
      forceRender &&
      window.gameUtils &&
      typeof window.gameUtils.renderTerritories === "function"
    ) {
      try {
        window.gameUtils.renderTerritories(null, gs);
      } catch (eMap) {
        /* ignore */
      }
    }
    if (
      forceRender &&
      typeof window.risqueAttackResyncTerritorySelectionVisuals === "function"
    ) {
      try {
        window.risqueAttackResyncTerritorySelectionVisuals();
      } catch (eResyncSel) {
        /* ignore */
      }
    }
    var atkChromeReady =
      document.getElementById("attack-toolbar-strip") || document.getElementById("reinforce");
    if (typeof window.initAttackPhase === "function" && !window.__risqueAttackInitialized && atkChromeReady) {
      try {
        window.initAttackPhase(window.__risqueAttackMountEpoch);
      } catch (eInitAtk) {
        /* ignore */
      }
    }
  };

  var __artemisAttackMapReadyTimer = null;
  window.risqueArtemisCancelAttackMapRouting = function () {
    if (__artemisAttackMapReadyTimer) {
      try {
        clearTimeout(__artemisAttackMapReadyTimer);
      } catch (eClr) {
        /* ignore */
      }
      __artemisAttackMapReadyTimer = null;
    }
  };
  window.risqueArtemisScheduleAttackMapRouting = function (gsOpt) {
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || String(gs.phase || "") !== "attack") return;
    if (
      typeof window.risqueArtemisIsAttackMapRoutingReady === "function" &&
      window.risqueArtemisIsAttackMapRoutingReady()
    ) {
      return;
    }
    if (__artemisAttackMapReadyTimer) {
      try {
        clearTimeout(__artemisAttackMapReadyTimer);
      } catch (eClr) {
        /* ignore */
      }
      __artemisAttackMapReadyTimer = null;
    }
    var attempt = 0;
    var tick = function () {
      attempt += 1;
      if (typeof window.risqueArtemisEnsureAttackMapRouting === "function") {
        window.risqueArtemisEnsureAttackMapRouting(gs, { forceRender: attempt === 1 });
      }
      if (
        typeof window.risqueArtemisIsAttackMapRoutingReady === "function" &&
        window.risqueArtemisIsAttackMapRoutingReady()
      ) {
        __artemisAttackMapReadyTimer = null;
        return;
      }
      if (attempt < 12) {
        __artemisAttackMapReadyTimer = setTimeout(tick, attempt < 4 ? 120 : 280);
      } else {
        __artemisAttackMapReadyTimer = null;
      }
    };
    tick();
  };

  var __artemisReinforceMapDelegateWired = false;
  window.risqueArtemisWireReinforceMapClickDelegate = function () {
    if (__artemisReinforceMapDelegateWired) return;
    __artemisReinforceMapDelegateWired = true;
    document.addEventListener(
      "click",
      function (ev) {
        if (!window.risqueArtemisMode) return;
        var gs = window.gameState;
        if (!gs || String(gs.phase || "") !== "reinforce") return;
        if (typeof window.risqueArtemisIsMyTurn === "function" && !window.risqueArtemisIsMyTurn(gs)) {
          return;
        }
        if (typeof window.risqueArtemisCanLocalPlay === "function" && !window.risqueArtemisCanLocalPlay()) {
          return;
        }
        var t = ev.target;
        if (!t || !t.closest) return;
        if (artemisMapClickBlocked(t)) return;
        var label = artemisResolveMapTerritoryLabel(t);
        if (!label) return;
        var info = artemisLookupTerritoryOwner(gs, label);
        if (!info || typeof window.risqueReinforcePhaseTerritoryClick !== "function") return;
        if (typeof window.risqueArtemisEnsureReinforceInteractive === "function") {
          window.risqueArtemisEnsureReinforceInteractive(gs);
        }
        if (typeof window.risqueReinforcePhaseTerritoryClick === "function") {
          window.handleTerritoryClick = window.risqueReinforcePhaseTerritoryClick;
        }
        try {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          ev.stopPropagation();
        } catch (eStopRf) {
          /* ignore */
        }
        try {
          window.risqueReinforcePhaseTerritoryClick(label, info.owner, info.troops, ev);
        } catch (eRfClick) {
          /* ignore */
        }
      },
      true
    );
  };
  window.risqueArtemisWireReinforceMapClickDelegate();

  var __artemisDeployMapDelegateWired = false;
  window.risqueArtemisWireDeployMapClickDelegate = function () {
    if (__artemisDeployMapDelegateWired) return;
    __artemisDeployMapDelegateWired = true;
    document.addEventListener(
      "click",
      function (ev) {
        if (!window.risqueArtemisMode) return;
        var gs = window.gameState;
        if (!gs || String(gs.phase || "") !== "deploy") return;
        if (typeof window.risqueArtemisIsMyTurn === "function" && !window.risqueArtemisIsMyTurn(gs)) {
          return;
        }
        if (typeof window.risqueArtemisCanLocalPlay === "function" && !window.risqueArtemisCanLocalPlay()) {
          return;
        }
        var t = ev.target;
        if (!t || !t.closest) return;
        if (artemisMapClickBlocked(t)) return;
        var label = artemisResolveMapTerritoryLabel(t);
        if (!label) return;
        var circle = document.querySelector('.territory-circle[data-label="' + label + '"]');
        if (!circle || !window.gameUtils || typeof window.gameUtils.handleTerritoryClick !== "function") {
          return;
        }
        var coords =
          window.gameUtils.territories && window.gameUtils.territories[label]
            ? window.gameUtils.territories[label]
            : null;
        var baseR = coords && coords.r != null ? coords.r : 30;
        try {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          ev.stopPropagation();
        } catch (eStopDep) {
          /* ignore */
        }
        try {
          window.gameUtils.handleTerritoryClick(label, circle, baseR, gs);
        } catch (eDepClick) {
          /* ignore */
        }
      },
      true
    );
  };
  window.risqueArtemisWireDeployMapClickDelegate();

  /** Active client reinforce: wire map clicks without remounting or re-rendering the board. */
  var __artemisReinforceMapRoutedFor = "";
  window.risqueArtemisEnsureReinforceMapRouting = function (gsOpt) {
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    if (!gs || String(gs.phase || "") !== "reinforce") return;
    var ownsReinforce =
      (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) ||
      (typeof window.risqueArtemisClientIsActivePlayer === "function" &&
        window.risqueArtemisClientIsActivePlayer(gs));
    if (!ownsReinforce) {
      return;
    }
    var routeKey =
      String(gs.artemisControlSlot || "") +
      ":" +
      String(gs.currentPlayer || "").trim().toUpperCase();
    window.risqueArtemisDeployHandoffPending = 0;
    window.risqueArtemisDeployPushLocked = false;
    try {
      document.body.setAttribute("data-risque-phase", "reinforce");
    } catch (ePhRf) {
      /* ignore */
    }
    if (typeof window.risqueArtemisWireReinforceMapClickDelegate === "function") {
      window.risqueArtemisWireReinforceMapClickDelegate();
    }
    if (typeof window.risqueReinforcePhaseTerritoryClick === "function") {
      window.handleTerritoryClick = window.risqueReinforcePhaseTerritoryClick;
    }
    if (__artemisReinforceMapRoutedFor === routeKey && window.__risqueReinforceInitialized) {
      return;
    }
    __artemisReinforceMapRoutedFor = routeKey;
    if (typeof window.risqueArtemisEnsureReinforceInteractive === "function") {
      window.risqueArtemisEnsureReinforceInteractive(gs);
    }
    if (window.risqueArtemisNetClient) {
      if (typeof window.risqueArtemisEnterClientPlayMode === "function") {
        window.risqueArtemisEnterClientPlayMode();
      } else {
        window.risqueArtemisClientPlaying = true;
        window.risqueDisplayIsPublic = false;
        window.risqueDisplayMode = "host";
        document.documentElement.classList.remove("risque-view-public");
        document.documentElement.classList.add("risque-view-host");
        document.body.classList.remove("risque-view-public");
        document.body.classList.add("risque-view-host");
      }
    }
    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    }
  };

  window.risqueArtemisCancelReinforceMapRouting = function () {
    __artemisReinforceMapRoutedFor = "";
  };
  window.risqueArtemisScheduleReinforceMapRouting = function (gsOpt) {
    if (typeof window.risqueArtemisEnsureReinforceMapRouting === "function") {
      window.risqueArtemisEnsureReinforceMapRouting(gsOpt);
    }
  };

  window.risqueArtemisShouldHostMountDeploy = function (gs) {
    if (!window.risqueArtemisMode) return true;
    if (!window.risqueArtemisHost) return false;
    gs = gs || window.gameState;
    if (!gs || String(gs.phase || "") !== "deploy") return true;
    if (typeof window.risqueArtemisEnsureTurnDeployRoute === "function") {
      window.risqueArtemisEnsureTurnDeployRoute(gs);
    }
    var routeMount = String(gs.risqueMirrorDeployRoute || "");
    if (routeMount !== "turn" && routeMount !== "deploy2") {
      try {
        var rkMount = localStorage.getItem("risqueMirrorDeployRoute");
        if (rkMount === "turn" || rkMount === "deploy2") routeMount = rkMount;
      } catch (eRkMount) {
        /* ignore */
      }
    }
    if (
      routeMount === "turn" ||
      routeMount === "deploy2" ||
      (gs.setupComplete === true && Number(gs.round) >= 1)
    ) {
      if (typeof window.risqueArtemisClearTurnDeployHandoffFlags === "function") {
        window.risqueArtemisClearTurnDeployHandoffFlags(gs);
      }
      if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
        window.risqueArtemisResolveOwnerSlot(gs);
      }
      return window.risqueArtemisIsMyTurn(gs);
    }
    if (
      typeof window.risqueArtemisForcePostRouletteWinner === "function" &&
      typeof window.risqueArtemisIsSetupDeploy === "function" &&
      window.risqueArtemisIsSetupDeploy(gs)
    ) {
      window.risqueArtemisForcePostRouletteWinner(gs, "deployOrder");
    }
    if (typeof window.risqueArtemisApplySetupDeployWinnerLock === "function") {
      window.risqueArtemisApplySetupDeployWinnerLock(gs);
    }
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      window.risqueArtemisResolveOwnerSlot(gs);
    }
    if (typeof window.risqueArtemisClearTurnDeployHandoffFlags === "function") {
      window.risqueArtemisClearTurnDeployHandoffFlags(gs);
    }
    return window.risqueArtemisIsMyTurn(gs);
  };

  var __artemisClientPushTimer = null;
  var __artemisClientPushPending = null;
  var __artemisClientPushLastMs = 0;
  var ARTEMIS_CLIENT_DEPLOY_PUSH_MS = 400;

  function artemisCloneStateForPush(state) {
    var push = state;
    try {
      push = JSON.parse(JSON.stringify(state));
    } catch (eClone) {
      push = state;
    }
    if (push && push.artemisDeployTurnAdvance) {
      var localSeq = Number(window.gameState && window.gameState.risqueArtemisControlSeq) || 0;
      var advSeq = Number(push.artemisDeployTurnAdvance.controlSeq) || 0;
      if (localSeq > 0 && advSeq > 0 && advSeq < localSeq) {
        delete push.artemisDeployTurnAdvance;
      }
    }
    if (push) {
      try {
        delete push.risqueTransferPulse;
      } catch (eClrPushPulse) {
        /* ignore */
      }
    }
    return push;
  }

  function artemisClientStatePushBlocked(state) {
    if (window.risqueArtemisDeployPushLocked || window.risqueArtemisDeployHandoffPending) {
      return true;
    }
    var relSeq = Number(window.risqueArtemisDeployRelinquishedSeq) || 0;
    var outSeq = Number(state && state.risqueArtemisControlSeq) || 0;
    if (relSeq > 0 && outSeq > 0 && outSeq <= relSeq) {
      return true;
    }
    if (
      state &&
      String(state.phase || "") === "deploy" &&
      typeof window.risqueArtemisIsMyTurn === "function" &&
      !window.risqueArtemisIsMyTurn(state)
    ) {
      return true;
    }
    return false;
  }

  function artemisIncomeStatePushBlocked(state) {
    var ph = state ? String(state.phase || "") : "";
    if (ph !== "income" && ph !== "con-income") return false;
    var localPh = window.gameState ? String(window.gameState.phase || "") : "";
    if (localPh === "deploy" || localPh === "con-deploy") return true;
    var tr = window.risqueArtemisPhaseTransition;
    if (tr && String(tr.target || "") === "deploy" && Date.now() - (Number(tr.at) || 0) < 15000) {
      return true;
    }
    return false;
  }

  function artemisPushClientStateImmediate(state) {
    if (typeof window.risqueArtemisSend !== "function" || !state) return;
    if (artemisClientStatePushBlocked(state)) return;
    if (artemisIncomeStatePushBlocked(state)) return;
    var push = artemisCloneStateForPush(state);
    window.risqueArtemisSend({
      type: "player_state",
      slot: window.risqueArtemisPlayerSlot,
      state: push
    });
  }

  window.risqueArtemisScheduleClientStatePush = function (stateOpt) {
    var state = stateOpt && typeof stateOpt === "object" ? stateOpt : window.gameState;
    if (!state || artemisClientStatePushBlocked(state)) return;
    __artemisClientPushPending = state;
    if (__artemisClientPushTimer) return;
    var now = Date.now();
    var wait = Math.max(0, ARTEMIS_CLIENT_DEPLOY_PUSH_MS - (now - __artemisClientPushLastMs));
    __artemisClientPushTimer = setTimeout(function () {
      __artemisClientPushTimer = null;
      __artemisClientPushLastMs = Date.now();
      var pending = __artemisClientPushPending;
      __artemisClientPushPending = null;
      if (pending) {
        artemisPushClientStateImmediate(pending);
      }
    }, wait);
  };

  window.risqueArtemisCancelClientStatePush = function () {
    if (__artemisClientPushTimer) {
      clearTimeout(__artemisClientPushTimer);
      __artemisClientPushTimer = null;
    }
    __artemisClientPushPending = null;
  };

  window.risqueArtemisFlushClientStatePush = function (stateOpt) {
    if (__artemisClientPushTimer) {
      clearTimeout(__artemisClientPushTimer);
      __artemisClientPushTimer = null;
    }
    var pending = stateOpt && typeof stateOpt === "object" ? stateOpt : __artemisClientPushPending || window.gameState;
    __artemisClientPushPending = null;
    if (pending) {
      __artemisClientPushLastMs = Date.now();
      artemisPushClientStateImmediate(pending);
    }
  };

  window.risqueArtemisOnClientStatePush = function (state) {
    if (typeof window.risqueArtemisSend !== "function" || !state) return;
    if (artemisClientStatePushBlocked(state)) return;
    if (artemisIncomeStatePushBlocked(state)) return;
    var ph = String(state.phase || "");
    var localPh = window.gameState ? String(window.gameState.phase || "") : "";
    if (
      ph === "deploy" &&
      (localPh === "income" || localPh === "con-income" || localPh === "deploy")
    ) {
      artemisPushClientStateImmediate(state);
      return;
    }
    if (
      (ph === "income" || ph === "con-income") &&
      state &&
      state.risquePublicIncomeBreakdown &&
      typeof state.risquePublicIncomeBreakdown.total !== "undefined"
    ) {
      artemisPushClientStateImmediate(state);
      return;
    }
    if (ph === "attack" || ph === "reinforce") {
      artemisPushClientStateImmediate(state);
      return;
    }
    if (
      ph === "deploy" &&
      !window.risqueArtemisDeployPushImmediate &&
      typeof window.risqueArtemisScheduleClientStatePush === "function"
    ) {
      window.risqueArtemisScheduleClientStatePush(state);
      return;
    }
    artemisPushClientStateImmediate(state);
  };
})();
