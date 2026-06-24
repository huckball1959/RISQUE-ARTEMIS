"use strict";

/**
 * ARTEMIS network client (M2): lobby slots + WebSocket public map sync.
 */
(function () {
  var q;
  try {
    q = new URL(window.location.href).searchParams;
  } catch (eQ) {
    return;
  }

  var mode = String(q.get("artemis") || "").toLowerCase();
  if (mode !== "host" && mode !== "client") {
    try {
      var savedMode = sessionStorage.getItem("risqueArtemisSession");
      if (savedMode) {
        var parsed = JSON.parse(savedMode);
        if (parsed && (parsed.mode === "host" || parsed.mode === "client")) {
          mode = parsed.mode;
        }
      }
    } catch (eModeRestore) {
      /* ignore */
    }
  }
  if (mode !== "host" && mode !== "client") return;

  var playerSlot = parseInt(String(q.get("slot") || ""), 10);
  if (!playerSlot || playerSlot < 1 || playerSlot > 3) {
    playerSlot = mode === "host" ? 1 : 0;
  }
  if (mode === "host" && playerSlot !== 1) {
    playerSlot = 1;
  }
  if (mode === "client" && (playerSlot < 2 || playerSlot > 3)) {
    playerSlot = 0;
  }

  var playerName = String(q.get("name") || "").trim().slice(0, 32);
  var mockPhasesParam = String(q.get("artemisMockPhases") || q.get("artemisSkipCardplay") || "").trim();
  var mockCardplayParam = String(q.get("artemisMockCardplay") || "").trim();
  var mockIncomeParam = String(q.get("artemisMockIncome") || "").trim();
  var fastBoot = window.risqueArtemisFastBoot !== false;
  var fixedProfiles = window.risqueArtemisFixedProfiles || null;
  if (fastBoot && fixedProfiles && fixedProfiles[playerSlot]) {
    playerName = fixedProfiles[playerSlot].name;
  }
  if (!playerName) {
    if (playerSlot === 1) playerName = "Host";
    else if (playerSlot === 2) playerName = "Player2";
    else if (playerSlot === 3) playerName = "Player3";
    else playerName = mode === "host" ? "Host" : "Player";
  }

  window.risqueArtemisPlayerSlot = playerSlot;
  window.risqueArtemisLobbyStarted = false;
  try {
    if (mockPhasesParam === "1") {
      sessionStorage.setItem("risqueArtemisMockPhases", "1");
    } else if (mockPhasesParam === "0") {
      sessionStorage.setItem("risqueArtemisMockPhases", "0");
    }
    if (mockCardplayParam === "0") {
      sessionStorage.setItem("risqueArtemisMockCardplay", "0");
    } else if (mockCardplayParam === "1") {
      sessionStorage.setItem("risqueArtemisMockCardplay", "1");
    } else if (mockPhasesParam === "0") {
      sessionStorage.setItem("risqueArtemisMockCardplay", "0");
    } else if (mockPhasesParam === "1") {
      sessionStorage.setItem("risqueArtemisMockCardplay", "1");
    }
    if (mockIncomeParam === "0") {
      sessionStorage.setItem("risqueArtemisMockIncome", "0");
    } else if (mockIncomeParam === "1") {
      sessionStorage.setItem("risqueArtemisMockIncome", "1");
    } else if (mockPhasesParam === "0") {
      sessionStorage.setItem("risqueArtemisMockIncome", "0");
    } else if (mockPhasesParam === "1") {
      sessionStorage.setItem("risqueArtemisMockIncome", "1");
    }
  } catch (eMockStore) {
    /* ignore */
  }
  if (playerName) {
    window.risqueArtemisPlayerName = String(playerName).trim().toUpperCase();
    try {
      sessionStorage.setItem("risqueArtemisPlayerName", window.risqueArtemisPlayerName);
    } catch (eNmBoot) {
      /* ignore */
    }
  }

  if (mode === "host") {
    window.risqueArtemisHost = true;
    window.risqueArtemisMode = "host";
    document.documentElement.classList.add("risque-artemis-host");
  } else {
    window.risqueArtemisNetClient = true;
    window.risqueArtemisMode = "client";
    window.risqueDisplayIsPublic = true;
    window.risqueDisplayMode = "public";
    document.documentElement.classList.add("risque-view-public");
    document.documentElement.classList.add("risque-artemis-client");
    if (document.body) {
      document.body.removeAttribute("data-risque-tv-cursor-locked");
    }
  }

  window.risqueArtemisMode = mode;
  /** DEV: rig all setup roulettes (firstCard, deployOrder, cardPlay). Host UI or ?rigSetup=1|2|3|random */
  var rigSetupParam = String(q.get("rigSetup") || "").trim();
  if (rigSetupParam === "random") {
    window.risqueArtemisRigSetupRandom = true;
    try {
      delete window.risqueArtemisRigSetupSlot;
    } catch (eRigSetupClr) {
      /* ignore */
    }
  } else if (rigSetupParam === "1" || rigSetupParam === "2" || rigSetupParam === "3") {
    window.risqueArtemisRigSetupSlot = parseInt(rigSetupParam, 10);
    window.RISQUE_POST_ROULETTE_SWAP_SLOT = window.risqueArtemisRigSetupSlot;
  }

  var RIG_SLOT_NAMES = { 1: "Guido", 2: "Mictor", 3: "Nooch" };

  function rigSetupLabelFromState() {
    if (window.risqueArtemisRigSetupRandom) return "True random";
    var slot = Number(window.risqueArtemisRigSetupSlot) || 0;
    if (slot >= 1 && slot <= 3) {
      return "Rigged — " + (RIG_SLOT_NAMES[slot] || "P" + slot);
    }
    return "";
  }

  function persistRigSetupToSessionStorage() {
    try {
      if (window.risqueArtemisRigSetupRandom) {
        sessionStorage.setItem("risqueArtemisRigSetupRandom", "1");
        sessionStorage.removeItem("risqueArtemisRigSetupSlot");
        return;
      }
      var slot = Number(window.risqueArtemisRigSetupSlot) || 0;
      if (slot >= 1 && slot <= 3) {
        sessionStorage.removeItem("risqueArtemisRigSetupRandom");
        sessionStorage.setItem("risqueArtemisRigSetupSlot", String(slot));
      }
    } catch (eRigSs) {
      /* ignore */
    }
  }

  function rigSetupPayloadFromGlobals() {
    if (window.risqueArtemisRigSetupRandom) return { random: true };
    var slot = Number(window.risqueArtemisRigSetupSlot) || 0;
    if (slot >= 1 && slot <= 3) return { slot: slot };
    return null;
  }

  function rigSetupPayloadFromGameState(gs) {
    if (!gs || !gs.risqueArtemisRigSetup || typeof gs.risqueArtemisRigSetup !== "object") return null;
    if (gs.risqueArtemisRigSetup.random) return { random: true };
    var gsSlot = Number(gs.risqueArtemisRigSetup.slot) || 0;
    if (gsSlot >= 1 && gsSlot <= 3) return { slot: gsSlot };
    return null;
  }

  function applyRigPayloadToGlobals(payload) {
    if (!payload) return;
    if (payload.random) {
      window.risqueArtemisRigSetupRandom = true;
      try {
        delete window.risqueArtemisRigSetupSlot;
      } catch (eClr) {
        /* ignore */
      }
      try {
        delete window.RISQUE_POST_ROULETTE_SWAP_SLOT;
      } catch (eClr2) {
        /* ignore */
      }
      return;
    }
    var slot = Number(payload.slot) || 0;
    if (slot < 1 || slot > 3) return;
    window.risqueArtemisRigSetupSlot = slot;
    window.risqueArtemisRigSetupRandom = false;
    window.RISQUE_POST_ROULETTE_SWAP_SLOT = slot;
  }

  function restoreRigSetupFromSessionStorage() {
    try {
      if (sessionStorage.getItem("risqueArtemisRigSetupRandom") === "1") {
        window.risqueArtemisRigSetupRandom = true;
        window.risqueArtemisRigSetupLocked = true;
        window.risqueArtemisRigSetupLabel = "True random";
        return;
      }
      var ss = sessionStorage.getItem("risqueArtemisRigSetupSlot");
      if (ss === "1" || ss === "2" || ss === "3") {
        var slot = parseInt(ss, 10);
        window.risqueArtemisRigSetupSlot = slot;
        window.risqueArtemisRigSetupRandom = false;
        window.RISQUE_POST_ROULETTE_SWAP_SLOT = slot;
        window.risqueArtemisRigSetupLocked = true;
        window.risqueArtemisRigSetupLabel = "Rigged — " + (RIG_SLOT_NAMES[slot] || "P" + slot);
      }
    } catch (eRestore) {
      /* ignore */
    }
  }

  window.risqueArtemisRigSetupUsesRandom = function (gsOpt) {
    if (window.risqueArtemisRigSetupRandom) return true;
    try {
      if (sessionStorage.getItem("risqueArtemisRigSetupRandom") === "1") return true;
    } catch (eSsRand) {
      /* ignore */
    }
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    var fromGs = rigSetupPayloadFromGameState(gs);
    if (fromGs && fromGs.random) return true;
    try {
      return new URL(window.location.href).searchParams.get("rigSetup") === "random";
    } catch (eUrl) {
      return false;
    }
  };

  window.risqueArtemisResolveRigSwapSlot = function (gsOpt) {
    if (window.risqueArtemisRigSetupUsesRandom(gsOpt)) return 0;
    if (typeof window.risqueArtemisRigSetupSlot === "number") {
      var rigWin = Number(window.risqueArtemisRigSetupSlot);
      if (rigWin >= 1 && rigWin <= 3) return rigWin;
    }
    try {
      var ssRig = sessionStorage.getItem("risqueArtemisRigSetupSlot");
      if (ssRig === "1" || ssRig === "2" || ssRig === "3") return parseInt(ssRig, 10);
    } catch (eSsRig) {
      /* ignore */
    }
    var gs = gsOpt && typeof gsOpt === "object" ? gsOpt : window.gameState;
    var fromGs = rigSetupPayloadFromGameState(gs);
    if (fromGs && fromGs.slot >= 1 && fromGs.slot <= 3) return fromGs.slot;
    try {
      var setupQ = new URL(window.location.href).searchParams.get("rigSetup");
      if (setupQ === "1" || setupQ === "2" || setupQ === "3") return parseInt(setupQ, 10);
    } catch (eSetupQ) {
      /* ignore */
    }
    if (typeof window.RISQUE_POST_ROULETTE_SWAP_SLOT === "number") {
      var w = Number(window.RISQUE_POST_ROULETTE_SWAP_SLOT);
      if (w >= 1 && w <= 3) return w;
    }
    return 0;
  };

  window.risqueArtemisCaptureRigIntoGameState = function (gs) {
    if (!gs || typeof gs !== "object") return gs;
    var payload = rigSetupPayloadFromGlobals();
    if (payload) {
      gs.risqueArtemisRigSetup = payload.random ? { random: true } : { slot: payload.slot };
    } else {
      try {
        delete gs.risqueArtemisRigSetup;
      } catch (eClrGs) {
        /* ignore */
      }
    }
    return gs;
  };

  window.risqueArtemisSyncRigFromGameState = function (gs) {
    var payload = rigSetupPayloadFromGameState(gs);
    if (!payload) return;
    applyRigPayloadToGlobals(payload);
    window.risqueArtemisRigSetupLocked = true;
    window.risqueArtemisRigSetupLabel = rigSetupLabelFromState();
    persistRigSetupToSessionStorage();
  };

  window.risqueArtemisIsRigSetupLocked = function () {
    return !!window.risqueArtemisRigSetupLocked;
  };

  window.risqueArtemisApplyRigSetup = function (opts) {
    opts = opts || {};
    var label = "";
    if (opts.random) {
      window.risqueArtemisRigSetupRandom = true;
      try {
        delete window.risqueArtemisRigSetupSlot;
      } catch (eClrSlot) {
        /* ignore */
      }
      try {
        delete window.RISQUE_POST_ROULETTE_SWAP_SLOT;
      } catch (eClrSwap) {
        /* ignore */
      }
      label = "True random";
    } else {
      var slot = Number(opts.slot) || 0;
      if (slot < 1 || slot > 3) return "";
      window.risqueArtemisRigSetupSlot = slot;
      window.risqueArtemisRigSetupRandom = false;
      window.RISQUE_POST_ROULETTE_SWAP_SLOT = slot;
      label = "Rigged — " + (RIG_SLOT_NAMES[slot] || "P" + slot);
    }
    window.risqueArtemisRigSetupLocked = true;
    window.risqueArtemisRigSetupLabel = label;
    persistRigSetupToSessionStorage();
    if (window.gameState && typeof window.gameState === "object") {
      window.risqueArtemisCaptureRigIntoGameState(window.gameState);
    }
    if (mode === "host" && !opts.fromNetwork && typeof sendJson === "function") {
      sendJson({
        type: "rig_setup",
        random: !!opts.random,
        slot: opts.random ? 0 : Number(opts.slot) || 0
      });
    }
    if (typeof window.risqueSyncBoardCornerArtemisStart === "function") {
      window.risqueSyncBoardCornerArtemisStart();
    }
    return label;
  };

  window.risqueArtemisClearRigSetup = function () {
    window.risqueArtemisRigSetupLocked = false;
    window.risqueArtemisRigSetupLabel = "";
    try {
      delete window.risqueArtemisRigSetupRandom;
      delete window.risqueArtemisRigSetupSlot;
      delete window.RISQUE_POST_ROULETTE_SWAP_SLOT;
    } catch (eClr) {
      /* ignore */
    }
    try {
      sessionStorage.removeItem("risqueArtemisRigSetupRandom");
      sessionStorage.removeItem("risqueArtemisRigSetupSlot");
    } catch (eSsClr) {
      /* ignore */
    }
  };

  if (rigSetupParam === "random" || rigSetupParam === "1" || rigSetupParam === "2" || rigSetupParam === "3") {
    window.risqueArtemisRigSetupLocked = true;
    window.risqueArtemisRigSetupLabel = rigSetupLabelFromState();
    persistRigSetupToSessionStorage();
  } else {
    restoreRigSetupFromSessionStorage();
  }

  function applyRigSetupFromNetwork(msg) {
    if (!msg) return;
    if (msg.random) {
      window.risqueArtemisApplyRigSetup({ random: true, fromNetwork: true });
      return;
    }
    var slot = Number(msg.slot) || 0;
    if (slot >= 1 && slot <= 3) {
      window.risqueArtemisApplyRigSetup({ slot: slot, fromNetwork: true });
    }
  }
  /** Legacy: per-kind cardplay rig URL still works when rigSetup unset. */
  var rigCardPlayParam = String(q.get("rigCardPlay") || "").trim();
  if (rigCardPlayParam === "random") {
    try {
      delete window.risqueArtemisRigCardPlaySlot;
    } catch (eRigClr) {
      /* ignore */
    }
  } else if (rigCardPlayParam === "1" || rigCardPlayParam === "2" || rigCardPlayParam === "3") {
    window.risqueArtemisRigCardPlaySlot = parseInt(rigCardPlayParam, 10);
  }

  function persistArtemisSession() {
    try {
      sessionStorage.setItem(
        "risqueArtemisSession",
        JSON.stringify({
          mode: mode,
          slot: playerSlot,
          host: mode === "host",
          client: mode === "client",
          playerName: playerName,
          mockPhases: sessionStorage.getItem("risqueArtemisMockPhases") || "",
          mockCardplay: sessionStorage.getItem("risqueArtemisMockCardplay") || "",
          mockIncome: sessionStorage.getItem("risqueArtemisMockIncome") || ""
        })
      );
    } catch (eSess) {
      /* ignore */
    }
  }

  function restoreArtemisSessionFromStorage() {
    try {
      var raw = sessionStorage.getItem("risqueArtemisSession");
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || !saved.mode) return;
      if (saved.mode === "host") {
        window.risqueArtemisHost = true;
        window.risqueArtemisNetClient = false;
        window.risqueArtemisMode = "host";
        document.documentElement.classList.add("risque-artemis-host");
      } else if (saved.mode === "client") {
        window.risqueArtemisHost = false;
        window.risqueArtemisNetClient = true;
        window.risqueArtemisMode = "client";
        window.risqueDisplayIsPublic = true;
        window.risqueDisplayMode = "public";
        document.documentElement.classList.add("risque-view-public");
        document.documentElement.classList.add("risque-artemis-client");
      }
      if (saved.slot) {
        window.risqueArtemisPlayerSlot = saved.slot;
        playerSlot = saved.slot;
      }
      if (saved.playerName && !window.risqueArtemisPlayerName) {
        window.risqueArtemisPlayerName = String(saved.playerName).trim().toUpperCase();
      }
      if (saved.mockPhases === "1" || saved.mockPhases === "0") {
        try {
          sessionStorage.setItem("risqueArtemisMockPhases", saved.mockPhases);
        } catch (eMockRestore) {
          /* ignore */
        }
      }
      if (saved.mockCardplay === "1" || saved.mockCardplay === "0") {
        try {
          sessionStorage.setItem("risqueArtemisMockCardplay", saved.mockCardplay);
        } catch (eMockCpRestore) {
          /* ignore */
        }
      }
      if (saved.mockIncome === "1" || saved.mockIncome === "0") {
        try {
          sessionStorage.setItem("risqueArtemisMockIncome", saved.mockIncome);
        } catch (eMockIncRestore) {
          /* ignore */
        }
      }
    } catch (eRestore) {
      /* ignore */
    }
  }

  persistArtemisSession();

  /** Restore slot from URL / sessionStorage when query params were lost after navigation. */
  window.risqueArtemisEnsureClientSlot = function () {
    if (!window.risqueArtemisNetClient) return;
    var slot = Number(window.risqueArtemisPlayerSlot);
    if (slot >= 2 && slot <= 3) return;
    try {
      var q = new URL(window.location.href).searchParams;
      var fromUrl = parseInt(String(q.get("slot") || ""), 10);
      if (fromUrl >= 2 && fromUrl <= 3) {
        window.risqueArtemisPlayerSlot = fromUrl;
        playerSlot = fromUrl;
        persistArtemisSession();
        return;
      }
      var raw = sessionStorage.getItem("risqueArtemisSession");
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.slot >= 2 && saved.slot <= 3) {
          window.risqueArtemisPlayerSlot = saved.slot;
          playerSlot = saved.slot;
        }
      }
    } catch (eSlot) {
      /* ignore */
    }
  };

  window.risqueArtemisAppendSessionParams = function (url) {
    if (!window.risqueArtemisMode) return url;
    try {
      var u = new URL(url, window.location.href);
      if (window.risqueArtemisMode === "host") {
        u.searchParams.set("artemis", "host");
        u.searchParams.set("slot", "1");
      } else if (window.risqueArtemisMode === "client" && window.risqueArtemisPlayerSlot) {
        u.searchParams.set("artemis", "client");
        u.searchParams.set("slot", String(window.risqueArtemisPlayerSlot));
        if (playerName) {
          u.searchParams.set("name", playerName);
        }
      }
      if (window.risqueArtemisRigSetupRandom) {
        u.searchParams.set("rigSetup", "random");
        u.searchParams.delete("rigCardPlay");
      } else {
        var rigStored = window.risqueArtemisRigSetupSlot;
        if (typeof rigStored === "number" && rigStored >= 1 && rigStored <= 3) {
          u.searchParams.set("rigSetup", String(rigStored));
          u.searchParams.delete("rigCardPlay");
        }
      }
      try {
        var mockStored = sessionStorage.getItem("risqueArtemisMockPhases");
        var mockCardStored = sessionStorage.getItem("risqueArtemisMockCardplay");
        var mockIncStored = sessionStorage.getItem("risqueArtemisMockIncome");
        if (mockCardStored === "0") {
          u.searchParams.set("artemisMockCardplay", "0");
        } else if (mockCardStored === "1") {
          u.searchParams.set("artemisMockCardplay", "1");
        }
        if (mockIncStored === "0") {
          u.searchParams.set("artemisMockIncome", "0");
        } else if (mockIncStored === "1") {
          u.searchParams.set("artemisMockIncome", "1");
        }
        if (mockStored === "1") {
          u.searchParams.set("artemisMockPhases", "1");
        } else if (mockStored === "0") {
          u.searchParams.set("artemisMockPhases", "0");
        }
        if (window.risqueArtemisCycleProbeActive) {
          u.searchParams.set("artemisCycleProbe", "1");
        }
      } catch (eMockUrl) {
        /* ignore */
      }
      return u.pathname + u.search + u.hash;
    } catch (eUrl) {
      return url;
    }
  };

  /** Re-apply session flags after any full page load (URL may have lost ?artemis=). */
  restoreArtemisSessionFromStorage();

  var ws = null;
  var reconnectTimer = null;
  var pendingMirrorPayloads = [];
  var pendingClientOutbound = [];
  var pendingPublicStates = [];
  var lastAppliedSeq = -1;
  var connected = false;
  var joined = false;

  window.risqueArtemisGetClientMirrorSeq = function () {
    return lastAppliedSeq;
  };

  function wsUrl() {
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + location.host + "/ws";
  }

  function logArtemis(msg) {
    try {
      console.info("[ARTEMIS]", msg);
    } catch (eLog) {
      /* ignore */
    }
  }


  /** Status in #risque-artemis-top-bar — never a floating overlay over the map/panel. */
  function setTopStatus(text, kind) {
    var bar = document.getElementById("risque-artemis-top-bar");
    var status = document.getElementById("risque-artemis-top-status");
    if (bar) {
      bar.hidden = false;
      bar.setAttribute("data-kind", kind || "ok");
    }
    if (status) {
      status.textContent = text;
    }
    if (typeof window.risqueArtemisScheduleLayoutSync === "function") {
      window.risqueArtemisScheduleLayoutSync();
    }
  }

  window.risqueArtemisSetTopStatus = setTopStatus;

  var lobbyStartHandled = false;
  var lobbyAutoStartSent = false;

  function fixedProfileForSlot(slot) {
    var fixed = window.risqueArtemisFixedProfiles;
    if (!fixed || !slot) return null;
    return fixed[slot] || fixed[String(slot)] || null;
  }

  function artemisFastBootEnabled() {
    return window.risqueArtemisFastBoot !== false;
  }

  function lobbyCounts(lobby) {
    var slots = (lobby && lobby.slots) || [];
    var connected = 0;
    var ready = 0;
    [1, 2, 3].forEach(function (slotNum) {
      var s = slots.find(function (x) {
        return x.slot === slotNum;
      });
      if (s && s.clientId) {
        connected += 1;
        if (s.ready) ready += 1;
      }
    });
    return { connected: connected, ready: ready };
  }

  function tryHostAutoStartLobby(lobby) {
    if (!artemisFastBootEnabled() || mode !== "host" || !lobby || window.risqueArtemisLobbyStarted) {
      return;
    }
    var c = lobbyCounts(lobby);
    if (c.connected < 3 || c.ready < 3) {
      setTopStatus(
        "ARTEMIS — waiting for JOIN (" + c.connected + "/3 connected, " + c.ready + "/3 ready)",
        c.connected >= 3 ? "ok" : "wait"
      );
      return;
    }
    if (lobby.canStart !== true) return;
    if (lobbyAutoStartSent) return;
    lobbyAutoStartSent = true;
    sendJson({ type: "lobby_start" });
    logArtemis("fast boot — auto lobby_start (3/3 ready)");
  }

  function autoSendFixedLoginProfile() {
    if (!artemisFastBootEnabled() || !playerSlot) return;
    if (window.risqueArtemisFastBootLoginSent) return;
    var prof = fixedProfileForSlot(playerSlot);
    if (!prof) return;
    window.risqueArtemisFastBootLoginSent = true;
    sendJson({
      type: "login_profile",
      slot: playerSlot,
      name: prof.name,
      color: prof.color
    });
    logArtemis("fast boot — auto login " + prof.name + " (slot " + playerSlot + ")");
  }

  window.risqueArtemisFixedProfile = fixedProfileForSlot;
  window.risqueArtemisAutoSendFixedLoginProfile = autoSendFixedLoginProfile;

  function artemisFreshLoginUrl() {
    var u = new URL(window.location.href);
    u.searchParams.set("phase", "login");
    var cycleProbe =
      window.risqueArtemisCycleProbeActive ||
      u.searchParams.get("artemisCycleProbe") === "1";
    if (cycleProbe) {
      try {
        sessionStorage.setItem("risqueArtemisCycleProbe", "1");
      } catch (eStore) {
        /* ignore */
      }
      window.risqueArtemisCycleProbeActive = true;
      u.searchParams.set("artemisCycleProbe", "1");
      u.searchParams.set("loginLegacyNext", "game.html?phase=login&artemisCycleProbe=1");
      u.searchParams.set("loginLoadRedirect", "game.html?phase=login&artemisCycleProbe=1");
    } else {
      u.searchParams.set(
        "loginLegacyNext",
        "game.html?phase=playerSelect&selectKind=firstCard"
      );
      u.searchParams.set(
        "loginLoadRedirect",
        "game.html?phase=cardplay&legacyNext=income.html"
      );
    }
    return u.toString();
  }

  function resetClientForNewSession() {
    clearClientPersistedGameCache();
    try {
      sessionStorage.removeItem("risqueArtemisLobbySessionStarted");
    } catch (eSessClr) {
      /* ignore */
    }
    window.__risquePublicTvAwaitingHostLogin = true;
  }

  function clearClientPersistedGameCache() {
    lastAppliedSeq = -1;
    pendingPublicStates = [];
    try {
      localStorage.removeItem("gameState");
      localStorage.removeItem("risquePublicMirrorState");
      localStorage.removeItem("risqueMirrorDeployRoute");
    } catch (eClr) {
      /* ignore */
    }
    window.__risquePublicMirrorAppliedRaw = null;
    window.risqueArtemisClientPlaying = false;
    window.risqueDeploy1Active = false;
    window.risqueArtemisDeployHandoffPending = 0;
    window.risqueArtemisDeployPushLocked = false;
    if (mode === "client") {
      window.risqueDisplayIsPublic = true;
      window.risqueDisplayMode = "public";
      try {
        document.documentElement.classList.remove("risque-view-host");
        document.documentElement.classList.add("risque-view-public");
        document.body.classList.remove("risque-view-host");
        document.body.classList.add("risque-view-public");
      } catch (eView) {
        /* ignore */
      }
      try {
        window.gameState = { phase: "login", players: [], currentPlayer: "", round: 1 };
        if (window.gameUtils && typeof window.gameUtils.renderTerritories === "function") {
          window.gameUtils.renderTerritories(null, window.gameState);
        }
        if (window.gameUtils && typeof window.gameUtils.renderStats === "function") {
          window.gameUtils.renderStats(window.gameState);
        }
      } catch (eRepaint) {
        /* ignore */
      }
    }
  }

  function dispatchLobbyStartedEvent() {
    try {
      window.dispatchEvent(new CustomEvent("risque-artemis-lobby-started"));
    } catch (eLobbyEv) {
      /* ignore */
    }
  }

  function notifySyncGateMirrorApplied() {
    if (typeof window.risqueArtemisSyncGateNoteMirrorApplied === "function") {
      window.risqueArtemisSyncGateNoteMirrorApplied();
    }
  }

  function beginFreshArtemisSession() {
    function finishHostLoginBoot() {
      try {
        sessionStorage.removeItem("risqueArtemisLobbyBoot");
      } catch (eRm) {
        /* ignore */
      }
      if (window.risqueArtemisCycleProbeActive) {
        try {
          localStorage.removeItem("risqueAutoResumeCardplayAfterLauncherRestart");
        } catch (eResumeClr) {
          /* ignore */
        }
      }
      window.risqueArtemisLobbyStarted = true;
      if (typeof window.risqueArtemisLobbyHide === "function") {
        window.risqueArtemisLobbyHide();
      }
      setTopStatus("ARTEMIS host — login", "ok");
      if (artemisFastBootEnabled()) {
        autoSendFixedLoginProfile();
      }
      if (typeof window.risqueSyncBoardCornerArtemisStart === "function") {
        window.risqueSyncBoardCornerArtemisStart();
      }
      if (typeof window.risqueMirrorPushGameState === "function") {
        try {
          window.risqueMirrorPushGameState();
        } catch (ePush) {
          /* ignore */
        }
      }
      dispatchLobbyStartedEvent();
    }

    var onLoginPhase = false;
    try {
      onLoginPhase = new URL(window.location.href).searchParams.get("phase") === "login";
    } catch (ePhase) {
      /* ignore */
    }

    try {
      if (sessionStorage.getItem("risqueArtemisLobbyBoot") === "1") {
        finishHostLoginBoot();
        return;
      }
      if (onLoginPhase) {
        sessionStorage.setItem("risqueArtemisLobbyBoot", "1");
        finishHostLoginBoot();
        return;
      }
      sessionStorage.setItem("risqueArtemisLobbyBoot", "1");
    } catch (eBoot) {
      /* ignore */
    }
    window.risqueArtemisLobbyStarted = true;
    if (typeof window.risqueArtemisLobbyHide === "function") {
      window.risqueArtemisLobbyHide();
    }
    if (typeof window.risqueClearStoredSessionForNewGame === "function") {
      try {
        window.risqueClearStoredSessionForNewGame();
      } catch (eClr) {
        /* ignore */
      }
    }
    setTopStatus("ARTEMIS — loading login…", "wait");
    window.location.href = artemisFreshLoginUrl();
  }

  function artemisClientSessionWasStarted() {
    try {
      return sessionStorage.getItem("risqueArtemisLobbySessionStarted") === "1";
    } catch (eSess) {
      return false;
    }
  }

  function markArtemisClientSessionStarted() {
    try {
      sessionStorage.setItem("risqueArtemisLobbySessionStarted", "1");
    } catch (eMark) {
      /* ignore */
    }
  }

  function onLobbyStarted() {
    if (lobbyStartHandled) return;
    lobbyStartHandled = true;
    if (mode === "host") {
      beginFreshArtemisSession();
      return;
    }
    window.risqueArtemisLobbyStarted = true;
    if (typeof window.risqueArtemisLobbyHide === "function") {
      window.risqueArtemisLobbyHide();
    }
    dispatchLobbyStartedEvent();
    var reconnect = artemisClientSessionWasStarted();
    clearClientPersistedGameCache();
    if (artemisFastBootEnabled()) {
      markArtemisClientSessionStarted();
      setTopStatus("ARTEMIS — auto sign-in…", "wait");
      autoSendFixedLoginProfile();
      flushPendingPublicStates();
      flushPendingClientOutbound();
      return;
    }
    if (!reconnect) {
      markArtemisClientSessionStarted();
      setTopStatus("ARTEMIS — sign in below", "wait");
      if (typeof window.risqueArtemisShowLoginPanel === "function") {
        window.risqueArtemisShowLoginPanel();
      }
    } else {
      setTopStatus("ARTEMIS — synced with host", "ok");
    }
    flushPendingPublicStates();
    flushPendingClientOutbound();
  }

  function isDeployTurnAdvanceFromSender(gs, senderSlot) {
    if (!gs || !gs.artemisDeployTurnAdvance) return false;
    if (Number(gs.artemisDeployTurnAdvance.fromSlot) !== Number(senderSlot)) return false;
    var hostGs = window.gameState;
    if (!hostGs) return true;
    var hostSeq = deployControlSeq(hostGs);
    var inSeq = deployControlSeq(gs);
    var advSeq = Number(gs.artemisDeployTurnAdvance.controlSeq) || 0;
    /* Valid handoff must bump control seq exactly once ahead of host. */
    if (hostSeq > 0 && inSeq > 0 && inSeq !== hostSeq + 1) return false;
    if (advSeq > 0 && hostSeq > 0 && advSeq !== inSeq) return false;
    return true;
  }

  function isImplicitDeployTurnAdvance(gs, senderSlot) {
    var hostGs = window.gameState;
    if (!hostGs || !gs || String(gs.phase || "") !== "deploy" || String(hostGs.phase || "") !== "deploy") {
      return false;
    }
    var hostSeq = deployControlSeq(hostGs);
    var inSeq = deployControlSeq(gs);
    if (hostSeq <= 0 || inSeq !== hostSeq + 1) return false;
    var hostCtrl = Number(hostGs.artemisControlSlot) || 0;
    if (hostCtrl < 1 || Number(senderSlot) !== hostCtrl) return false;
    return normDeployName(hostGs.currentPlayer) !== normDeployName(gs.currentPlayer);
  }

  function artemisForceControlSlotFromCurrentPlayer(gs) {
    if (!gs || !window.risqueArtemisMode) return 0;
    var slot = 0;
    if (Array.isArray(gs.artemisRoster)) {
      var hit = gs.artemisRoster.find(function (r) {
        return normDeployName(r && r.name) === normDeployName(gs.currentPlayer);
      });
      if (hit) slot = Number(hit.slot) || 0;
    }
    if (!slot && typeof window.risqueArtemisActivePlayerSlot === "function") {
      slot = Number(window.risqueArtemisActivePlayerSlot(gs)) || 0;
    }
    if (slot >= 1 && slot <= 3) {
      gs.artemisControlSlot = slot;
    }
    return slot;
  }

  function deployControlSeq(gs) {
    return gs ? Number(gs.risqueArtemisControlSeq) || 0 : 0;
  }

  function normDeployName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function artemisIncomingPlayerSelectKind(incoming) {
    if (!incoming) return "";
    var raw =
      incoming.risquePublicUiSelectKind != null
        ? incoming.risquePublicUiSelectKind
        : incoming.selectionPhase;
    var lower = String(raw || "").toLowerCase();
    if (lower === "cardplay") return "cardPlay";
    if (lower === "deployorder") return "deployOrder";
    if (lower === "firstcard") return "firstCard";
    return String(raw || "");
  }

  function artemisClearSetupPlayerSelectArtifacts(gs, opts) {
    if (!gs) return;
    opts = opts || {};
    var incomingPh = String(gs.phase || "");
    var fwdSelectKind = artemisIncomingPlayerSelectKind(gs);
    var forwardSetupSelect =
      incomingPh === "playerSelect" &&
      (fwdSelectKind === "cardPlay" || fwdSelectKind === "deployOrder");
    if (!forwardSetupSelect && !opts.preservePlayerSelectMirror) {
      delete gs.risquePublicPlayerSelectFlash;
      delete gs.risquePublicUiSelectKind;
    }
    if (forwardSetupSelect) {
      try {
        delete gs.risqueMirrorDeployRoute;
      } catch (eRouteClr) {
        /* ignore */
      }
    }
    var livePh =
      window.gameState && window.gameState.phase != null
        ? String(window.gameState.phase || "")
        : "";
    if (
      !forwardSetupSelect &&
      mode === "client" &&
      incomingPh === "playerSelect" &&
      livePh === "deploy" &&
      (window.risqueArtemisDeployPushLocked ||
        Number(window.risqueArtemisDeployHandoffPending) > 0 ||
        Number(window.risqueArtemisDeployRelinquishedSeq) > 0 ||
        String(gs.risqueMirrorDeployRoute || "") === "setup")
    ) {
      gs.phase = "deploy";
      if (!gs.risqueMirrorDeployRoute) {
        gs.risqueMirrorDeployRoute = "setup";
      }
    }
    if (String(gs.phase || "") === "deploy") {
      try {
        document.body.setAttribute("data-risque-phase", "deploy");
      } catch (ePh) {
        /* ignore */
      }
    }
    var psRoot = document.getElementById("risque-player-select-root");
    if (psRoot && psRoot.parentNode && !forwardSetupSelect) {
      try {
        psRoot.parentNode.removeChild(psRoot);
      } catch (eRm) {
        /* ignore */
      }
    }
  }
  window.risqueArtemisClearSetupPlayerSelectArtifacts = artemisClearSetupPlayerSelectArtifacts;

  /** Tear down setup-deploy chrome after finish/handoff — do not rewind into deploy mount loops. */
  function artemisClientReleaseSetupDeployChrome(gs) {
    if (mode !== "client") return;
    window.risqueArtemisDeployHandoffPending = 0;
    window.risqueArtemisDeployPushLocked = false;
    window.risqueArtemisDeployRelinquishedSeq = 0;
    try {
      delete window.risqueArtemisDeployHandoffPlayer;
    } catch (eClrHp) {
      /* ignore */
    }
    if (typeof window.risqueArtemisResetClientDeployMount === "function") {
      window.risqueArtemisResetClientDeployMount();
    }
    if (gs && typeof gs === "object") {
      artemisClearSetupPlayerSelectArtifacts(gs, {
        preservePlayerSelectMirror: String(gs.phase || "") === "playerSelect",
      });
      try {
        document.body.setAttribute(
          "data-risque-phase",
          String(gs.phase || "playerSelect")
        );
      } catch (eAttr) {
        /* ignore */
      }
    }
    try {
      document.documentElement.classList.remove("risque-artemis-setup-deploy");
      document.documentElement.classList.remove("risque-artemis-my-turn");
    } catch (eCls) {
      /* ignore */
    }
  }
  window.risqueArtemisClientReleaseSetupDeployChrome = artemisClientReleaseSetupDeployChrome;

  /** Drop stale TV hand-count fields when cardplay advances to a new active player. */
  function artemisSanitizeCardplaySpectatorHandMirror(gs) {
    if (!gs || String(gs.phase || "") !== "cardplay") return gs;
    var cp = normDeployName(gs.currentPlayer);
    var mir =
      gs.risquePublicCardplaySpectatorPlayer != null
        ? normDeployName(gs.risquePublicCardplaySpectatorPlayer)
        : "";
    if (mir && cp && mir !== cp) {
      delete gs.risquePublicCardplaySpectatorHandCount;
      delete gs.risquePublicCardplaySpectatorPlayer;
    }
    return gs;
  }
  window.risqueArtemisSanitizeCardplaySpectatorHandMirror = artemisSanitizeCardplaySpectatorHandMirror;

  /** Setup deploy finished — spectators may still show deploy chrome while host opens cardplay-order roulette. */
  function artemisClientAcceptDeployToPlayerSelectMirror(incoming, live) {
    if (!incoming || !live) return false;
    if (String(incoming.phase || "") !== "playerSelect") return false;
    var livePh = String(live.phase || "");
    if (
      livePh !== "deploy" &&
      livePh !== "deploy1" &&
      livePh !== "deploy2" &&
      livePh !== "con-deploy"
    ) {
      return false;
    }
    var kind = artemisIncomingPlayerSelectKind(incoming);
    if (kind !== "cardPlay" && kind !== "deployOrder") return false;
    if (
      typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
      window.risqueArtemisClientHasActiveDeploySession()
    ) {
      return false;
    }
    return true;
  }

  /** Reject setup roulette mirrors after the client has already advanced into gameplay. */
  function artemisClientRejectStalePlayerSelectMirror(incoming) {
    if (mode !== "client" || !incoming) return false;
    if (String(incoming.phase || "") !== "playerSelect") return false;
    var live = window.gameState;
    if (!live) return false;
    var livePh = String(live.phase || "");
    if (artemisClientAcceptDeployToPlayerSelectMirror(incoming, live)) {
      return false;
    }
    if (artemisIncomingPlayerSelectKind(incoming) === "cardPlay") {
      if (
        livePh === "deploy" ||
        livePh === "deploy1" ||
        livePh === "deploy2" ||
        livePh === "con-deploy" ||
        livePh === "playerSelect" ||
        livePh === "welcome" ||
        livePh === "deal" ||
        window.risqueArtemisAwaitSetupDeployFinish ||
        window.risqueArtemisDeployPushLocked ||
        Number(window.risqueArtemisDeployHandoffPending) > 0
      ) {
        return false;
      }
    }
    if (
      window.risqueArtemisDeployPushLocked ||
      Number(window.risqueArtemisDeployHandoffPending) > 0 ||
      Number(window.risqueArtemisDeployRelinquishedSeq) > 0
    ) {
      return true;
    }
    if (
      typeof window.risqueArtemisClientSetupDeployChromeActive === "function" &&
      window.risqueArtemisClientSetupDeployChromeActive()
    ) {
      return true;
    }
    if (
      livePh === "playerSelect" ||
      livePh === "login" ||
      livePh === "welcome" ||
      livePh === "deal"
    ) {
      return false;
    }
    if (live.setupComplete) return true;
    if (livePh === "deploy" || livePh === "deploy1" || livePh === "deploy2" || livePh === "con-deploy") {
      if (
        typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
        window.risqueArtemisClientHasActiveDeploySession()
      ) {
        return true;
      }
      return false;
    }
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
    return false;
  }
  window.risqueArtemisClientRejectStalePlayerSelectMirror = artemisClientRejectStalePlayerSelectMirror;

  function artemisStampMirrorSeqFromWs(item) {
    if (!item || !item.state || !item.seq) return;
    var wsSeq = Number(item.seq) || 0;
    if (wsSeq <= 0) return;
    var mirSeq = Number(item.state.risquePublicMirrorSeq) || 0;
    if (wsSeq > mirSeq) {
      item.state.risquePublicMirrorSeq = wsSeq;
    }
  }

  function artemisClearDeployHandoffNarration(gs) {
    if (!gs) return;
    artemisClearSetupPlayerSelectArtifacts(gs);
    delete gs.risquePublicDeployReport;
    delete gs.risqueDeployTransientPrimary;
    try {
      var waitLine =
        String(gs.risquePublicDeployBanner || "").trim() ||
        "WAITING FOR " + String(gs.currentPlayer || "NEXT").toUpperCase() + " TO DEPLOY";
      gs.risqueControlVoice = {
        primary: waitLine,
        report: "",
        reportClass: "ucp-voice-report ucp-voice-report--public-deploy"
      };
    } catch (eCvClr) {
      /* ignore */
    }
  }

  function applyDeployLiveSpectator(msg) {
    if (!msg || !msg.patch) return;
    if (!window.risqueArtemisLobbyStarted) return;
    var senderSlot = Number(msg.slot) || 0;
    var patch = msg.patch;
    if (mode === "host") {
      var patchCtrl = Number(patch.artemisControlSlot || msg.slot) || 0;
      var hostSlot = Number(window.risqueArtemisPlayerSlot) || 1;
      if (patchCtrl >= 1 && patchCtrl === hostSlot) {
        return;
      }
    } else if (mode !== "client") {
      return;
    }
    var mySlot = Number(window.risqueArtemisPlayerSlot) || 0;
    if (mode === "client" && mySlot >= 1 && senderSlot >= 1 && mySlot === senderSlot) return;
    var gs;
    try {
      gs = window.gameState ? JSON.parse(JSON.stringify(window.gameState)) : {};
    } catch (eClone) {
      gs = window.gameState && typeof window.gameState === "object" ? window.gameState : {};
    }
    gs.phase = "deploy";
    artemisClearSetupPlayerSelectArtifacts(gs);
    if (patch.currentPlayer != null) gs.currentPlayer = patch.currentPlayer;
    if (patch.artemisControlSlot != null) gs.artemisControlSlot = patch.artemisControlSlot;
    if (patch.risqueArtemisControlSeq != null) {
      gs.risqueArtemisControlSeq = patch.risqueArtemisControlSeq;
    }
    gs.risqueMirrorDeployRoute = String(
      patch.risqueMirrorDeployRoute ||
        gs.risqueMirrorDeployRoute ||
        (typeof window.risqueArtemisIsSetupDeploy === "function" &&
        window.risqueArtemisIsSetupDeploy(Object.assign({}, gs, { phase: "deploy" }))
          ? "setup"
          : "turn")
    );
    if (patch.risquePublicDeployBanner != null) {
      gs.risquePublicDeployBanner = patch.risquePublicDeployBanner;
    }
    if (patch.risquePublicDeployReport != null) {
      gs.risquePublicDeployReport = patch.risquePublicDeployReport;
    }
    if (patch.risqueControlVoice && typeof patch.risqueControlVoice === "object") {
      try {
        gs.risqueControlVoice = JSON.parse(JSON.stringify(patch.risqueControlVoice));
      } catch (eCv) {
        gs.risqueControlVoice = patch.risqueControlVoice;
      }
    }
    if (patch.risqueDeployMirrorDraft && typeof patch.risqueDeployMirrorDraft === "object") {
      try {
        gs.risqueDeployMirrorDraft = JSON.parse(JSON.stringify(patch.risqueDeployMirrorDraft));
      } catch (eDraft) {
        gs.risqueDeployMirrorDraft = patch.risqueDeployMirrorDraft;
      }
      if (typeof window.risqueArtemisSanitizeDeployMirrorDraft === "function") {
        window.risqueArtemisSanitizeDeployMirrorDraft(gs);
      }
    }
    if (Array.isArray(patch.players) && Array.isArray(gs.players)) {
      (patch.players || []).forEach(function (cp) {
        if (!cp || !cp.name) return;
        var hp = (gs.players || []).find(function (p) {
          return normDeployName(p && p.name) === normDeployName(cp.name);
        });
        if (!hp) return;
        hp.bankValue = cp.bankValue;
        hp.troopsTotal = cp.troopsTotal;
        if (Array.isArray(cp.territories) && Array.isArray(hp.territories)) {
          cp.territories.forEach(function (ct) {
            if (!ct || !ct.name) return;
            var ht = hp.territories.find(function (t) {
              return t && t.name === ct.name;
            });
            if (ht) ht.troops = ct.troops;
          });
        }
      });
    }
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      /* ignore */
    }
    window.gameState = gs;
    if (mode === "host") {
      if (typeof window.risqueHostReplaceShellGameState === "function") {
        window.risqueHostReplaceShellGameState(gs);
      }
      if (typeof window.risqueArtemisApplyHostDeploySpectator === "function") {
        window.risqueArtemisApplyHostDeploySpectator(gs);
      }
      return;
    }
    if (typeof window.risqueArtemisRefreshDeploySpectator === "function") {
      window.risqueArtemisRefreshDeploySpectator(gs);
    } else if (typeof window.risqueArtemisApplyDeploySpectatorFromState === "function") {
      window.risqueArtemisApplyDeploySpectatorFromState(gs);
    }
    if (
      typeof window.risqueArtemisStampDeployHandoffSyncMarkers === "function"
    ) {
      window.risqueArtemisStampDeployHandoffSyncMarkers(gs);
    }
  }

  function applyAttackLiveSpectator(msg) {
    if (!msg || !msg.patch) return;
    if (!window.risqueArtemisLobbyStarted) return;
    var senderSlot = Number(msg.slot) || 0;
    if (mode === "host") {
      if (
        typeof window.risqueArtemisLocalOwnsSetupDeploy === "function" &&
        window.risqueArtemisLocalOwnsSetupDeploy(window.gameState)
      ) {
        return;
      }
    } else if (mode !== "client") {
      return;
    }
    var mySlot = Number(window.risqueArtemisPlayerSlot) || 0;
    if (mode === "client" && mySlot >= 1 && senderSlot >= 1 && mySlot === senderSlot) return;
    var patch = msg.patch;
    var gs;
    try {
      gs = window.gameState ? JSON.parse(JSON.stringify(window.gameState)) : {};
    } catch (eClone) {
      gs = window.gameState && typeof window.gameState === "object" ? window.gameState : {};
    }
    gs.phase = "attack";
    if (patch.currentPlayer != null) gs.currentPlayer = patch.currentPlayer;
    if (patch.artemisControlSlot != null) gs.artemisControlSlot = patch.artemisControlSlot;
    if (patch.risqueArtemisControlSeq != null) {
      gs.risqueArtemisControlSeq = patch.risqueArtemisControlSeq;
    }
    if (patch.attackPhase != null) gs.attackPhase = patch.attackPhase;
    if (patch.attackingTerritory != null) gs.attackingTerritory = patch.attackingTerritory;
    if (patch.defendingTerritory != null) gs.defendingTerritory = patch.defendingTerritory;
    if (patch.acquiredTerritory != null) gs.acquiredTerritory = patch.acquiredTerritory;
    if (patch.risquePublicAttackSelectionLine != null) {
      gs.risquePublicAttackSelectionLine = patch.risquePublicAttackSelectionLine;
    }
    if (patch.risquePublicAttackTransferSummary != null) {
      gs.risquePublicAttackTransferSummary = patch.risquePublicAttackTransferSummary;
    }
    if (patch.risquePublicBlitzBanner != null) {
      gs.risquePublicBlitzBanner = patch.risquePublicBlitzBanner;
    }
    if (patch.risquePublicBlitzBannerReport != null) {
      gs.risquePublicBlitzBannerReport = patch.risquePublicBlitzBannerReport;
    }
    if (patch.risqueLastDiceDisplay && typeof patch.risqueLastDiceDisplay === "object") {
      try {
        gs.risqueLastDiceDisplay = JSON.parse(JSON.stringify(patch.risqueLastDiceDisplay));
      } catch (eDice) {
        gs.risqueLastDiceDisplay = patch.risqueLastDiceDisplay;
      }
      if (msg.seq != null) {
        window.__risqueArtemisLastAttackLiveSeq = Number(msg.seq) || 0;
        try {
          gs.risqueLastDiceDisplay.artemisAttackLiveSeq = window.__risqueArtemisLastAttackLiveSeq;
        } catch (eDiceSeq) {
          /* ignore */
        }
      }
      if (gs.risqueLastDiceDisplay.spinning === true) {
        artemisMarkHostAttackSpinGrace(520);
      }
    }
    if (patch.risqueAttackOutcomePrimary != null) {
      gs.risqueAttackOutcomePrimary = patch.risqueAttackOutcomePrimary;
    }
    if (patch.risqueAttackOutcomeReport != null) {
      gs.risqueAttackOutcomeReport = patch.risqueAttackOutcomeReport;
    }
    if (patch.risqueAttackOutcomeAcquisition != null) {
      gs.risqueAttackOutcomeAcquisition = patch.risqueAttackOutcomeAcquisition;
    }
    if (patch.risqueBattleHudReadout && typeof patch.risqueBattleHudReadout === "object") {
      try {
        gs.risqueBattleHudReadout = JSON.parse(JSON.stringify(patch.risqueBattleHudReadout));
      } catch (eBattle) {
        gs.risqueBattleHudReadout = patch.risqueBattleHudReadout;
      }
    }
    if (patch.risqueControlVoice && typeof patch.risqueControlVoice === "object") {
      try {
        gs.risqueControlVoice = JSON.parse(JSON.stringify(patch.risqueControlVoice));
      } catch (eCv) {
        gs.risqueControlVoice = patch.risqueControlVoice;
      }
    }
    if (Array.isArray(patch.risqueCombatLogTail)) {
      try {
        gs.risqueCombatLogTail = JSON.parse(JSON.stringify(patch.risqueCombatLogTail));
      } catch (eLog) {
        gs.risqueCombatLogTail = patch.risqueCombatLogTail;
      }
    }
    if (Array.isArray(patch.players) && Array.isArray(gs.players)) {
      (patch.players || []).forEach(function (cp) {
        if (!cp || !cp.name) return;
        var hp = (gs.players || []).find(function (p) {
          return normDeployName(p && p.name) === normDeployName(cp.name);
        });
        if (!hp) return;
        hp.bankValue = cp.bankValue;
        hp.troopsTotal = cp.troopsTotal;
        if (Array.isArray(cp.territories) && Array.isArray(hp.territories)) {
          cp.territories.forEach(function (ct) {
            if (!ct || !ct.name) return;
            var ht = hp.territories.find(function (t) {
              return t && t.name === ct.name;
            });
            if (ht) ht.troops = ct.troops;
          });
        }
      });
    }
    try {
      delete gs.risqueTransferPulse;
    } catch (eClrPulse) {
      /* ignore */
    }
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      /* ignore */
    }
    window.gameState = gs;
    if (mode === "host") {
      if (typeof window.risqueHostReplaceShellGameState === "function") {
        window.risqueHostReplaceShellGameState(gs);
      }
      if (typeof window.risqueArtemisApplyHostAttackSpectator === "function") {
        try {
          window.risqueArtemisApplyHostAttackSpectator(gs);
        } catch (eHostAtkSpec) {
          /* ignore */
        }
      } else if (typeof window.risqueArtemisSyncPortableAttack === "function") {
        try {
          window.risqueArtemisSyncPortableAttack(gs);
        } catch (eHostAtk) {
          /* ignore */
        }
      }
      artemisHostForceVisualSync(gs);
      requestAnimationFrame(function () {
        if (typeof window.risqueArtemisApplyHostAttackSpectator === "function") {
          try {
            window.risqueArtemisApplyHostAttackSpectator(window.gameState || gs);
          } catch (eHostAtkRaf) {
            /* ignore */
          }
        } else if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
          try {
            window.risquePublicApplyDiceAndBattleReadout(window.gameState || gs);
          } catch (eHostDiceRaf) {
            /* ignore */
          }
        }
      });
      return;
    }
    if (typeof window.risqueArtemisSyncPortableAttack === "function") {
      try {
        window.risqueArtemisSyncPortableAttack(gs);
      } catch (eAtkSync) {
        /* ignore */
      }
      if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
        try {
          window.risquePublicApplyDiceAndBattleReadout(gs);
        } catch (eCliAtkDice) {
          /* ignore */
        }
      }
      if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
        try {
          window.risquePublicApplyVoiceAndLogMirror(gs);
        } catch (eCliAtkVoice) {
          /* ignore */
        }
      }
      return;
    }
    if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
      window.risquePublicApplyDiceAndBattleReadout(gs);
    }
    if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
      window.risquePublicApplyVoiceAndLogMirror(gs);
    }
  }

  function artemisMergeClientSetupDeployIntoHost(hostGs, clientGs, senderSlot) {
    if (!hostGs || !clientGs) return;
    var setupWinnerLock =
      typeof window.risqueArtemisHostHasSetupDeployWinnerLock === "function" &&
      window.risqueArtemisHostHasSetupDeployWinnerLock(hostGs);
    var lockSlot = setupWinnerLock
      ? Number(hostGs.risqueArtemisSetupDeploySlot) ||
        (typeof window.RISQUE_POST_ROULETTE_SWAP_SLOT === "number"
          ? window.RISQUE_POST_ROULETTE_SWAP_SLOT
          : 3)
      : 0;
    var allowCtrlMerge =
      hostSenderIsActiveDeployer(hostGs, senderSlot) ||
      (!setupWinnerLock && hostSenderIsActiveDeployer(clientGs, senderSlot));
    if (setupWinnerLock) {
      allowCtrlMerge = Number(senderSlot) === lockSlot;
    }
    if (allowCtrlMerge) {
      if (clientGs.currentPlayer) {
        hostGs.currentPlayer = clientGs.currentPlayer;
      }
      var clientCtrl = Number(clientGs.artemisControlSlot) || 0;
      if (clientCtrl >= 1 && clientCtrl <= 3) {
        hostGs.artemisControlSlot = clientCtrl;
      }
      var clientSeq = deployControlSeq(clientGs);
      if (clientSeq > 0) {
        hostGs.risqueArtemisControlSeq = clientSeq;
      }
      if (clientGs.risqueMirrorDeployRoute) {
        hostGs.risqueMirrorDeployRoute = clientGs.risqueMirrorDeployRoute;
      }
    }
    var clientPlayers = clientGs.players || [];
    (hostGs.players || []).forEach(function (hp) {
      var cp = clientPlayers.find(function (p) {
        return normDeployName(p && p.name) === normDeployName(hp && hp.name);
      });
      if (!cp) return;
      hp.bankValue = cp.bankValue;
      hp.troopsTotal = cp.troopsTotal;
      if (Array.isArray(cp.territories) && Array.isArray(hp.territories)) {
        cp.territories.forEach(function (ct) {
          if (!ct || !ct.name) return;
          var ht = hp.territories.find(function (t) {
            return t && t.name === ct.name;
          });
          if (ht) ht.troops = ct.troops;
        });
      }
    });
    if (clientGs.risqueDeployMirrorDraft && typeof clientGs.risqueDeployMirrorDraft === "object") {
      try {
        hostGs.risqueDeployMirrorDraft = JSON.parse(JSON.stringify(clientGs.risqueDeployMirrorDraft));
      } catch (eDraft) {
        hostGs.risqueDeployMirrorDraft = clientGs.risqueDeployMirrorDraft;
      }
    }
    if (hostSenderIsActiveDeployer(hostGs, senderSlot)) {
      if (clientGs.risquePublicDeployBanner != null && String(clientGs.risquePublicDeployBanner).trim() !== "") {
        hostGs.risquePublicDeployBanner = String(clientGs.risquePublicDeployBanner);
      }
      if (clientGs.risquePublicDeployReport != null) {
        hostGs.risquePublicDeployReport = String(clientGs.risquePublicDeployReport);
      }
      if (clientGs.risqueControlVoice && typeof clientGs.risqueControlVoice === "object") {
        try {
          hostGs.risqueControlVoice = JSON.parse(JSON.stringify(clientGs.risqueControlVoice));
        } catch (eCv) {
          hostGs.risqueControlVoice = clientGs.risqueControlVoice;
        }
      }
    }
    if (clientGs.risqueDeployTransientPrimary != null) {
      hostGs.risqueDeployTransientPrimary = clientGs.risqueDeployTransientPrimary;
    }
  }

  /** Host-only setup deploy handoff (probe pattern — clients never bump control seq). */
  function artemisHostAdvanceSetupDeploy(hostGs, senderSlot, clientHint, advanceOpts) {
    if (!hostGs || String(hostGs.phase || "") !== "deploy") return false;
    clientHint = clientHint || null;
    advanceOpts = advanceOpts || {};
    var curName = normDeployName(hostGs.currentPlayer);
    var player = (hostGs.players || []).find(function (p) {
      return normDeployName(p && p.name) === curName;
    });
    if (
      player &&
      !advanceOpts.trustFinisherBank &&
      typeof window.risqueArtemisSyncActiveSetupBankFromBoard === "function"
    ) {
      window.risqueArtemisSyncActiveSetupBankFromBoard(hostGs, player);
    }
    var ctrl = Number(hostGs.artemisControlSlot) || 0;
    var senderOk = ctrl >= 1 && Number(senderSlot) === ctrl;
    if (!senderOk && Array.isArray(hostGs.artemisRoster)) {
      var senderHit = hostGs.artemisRoster.find(function (r) {
        return Number(r.slot) === Number(senderSlot);
      });
      if (senderHit && normDeployName(senderHit.name) === curName) {
        senderOk = true;
        artemisForceControlSlotFromCurrentPlayer(hostGs);
        ctrl = Number(hostGs.artemisControlSlot) || Number(senderSlot) || 0;
      }
    }
    if (!senderOk) {
      try {
        console.warn(
          "[ARTEMIS] setup deploy CONFIRM sender mismatch — sender P" +
            senderSlot +
            " host ctrl P" +
            ctrl +
            " up=" +
            String(hostGs.currentPlayer)
        );
      } catch (eSendWarn) {
        /* ignore */
      }
      return false;
    }
    if (!player) return false;
    if ((Number(player.bankValue) || 0) > 0) {
      try {
        console.warn(
          "[ARTEMIS] setup deploy CONFIRM rejected — " +
            String(player.name) +
            " bank=" +
            String(player.bankValue)
        );
      } catch (eBankWarn) {
        /* ignore */
      }
      return false;
    }
    if (
      (hostGs.players || []).every(function (p) {
        return (Number(p.bankValue) || 0) === 0;
      })
    ) {
      return false;
    }
    var nextPlayer = "";
    var nextSeq = 0;
    if (clientHint && clientHint.nextPlayer) {
      nextPlayer = String(clientHint.nextPlayer);
      nextSeq = Number(clientHint.nextSeq) || 0;
    }
    if (!nextPlayer) {
      var order = Array.isArray(hostGs.turnOrder)
        ? hostGs.turnOrder.slice()
        : (hostGs.players || []).map(function (p) {
            return p.name;
          });
      if (!order.length) return false;
      var idx = order.findIndex(function (n) {
        return normDeployName(n) === curName;
      });
      if (idx < 0) idx = 0;
      nextPlayer = order[(idx + 1) % order.length];
      nextSeq = deployControlSeq(hostGs) + 1;
    }
    if (!nextSeq) {
      nextSeq = deployControlSeq(hostGs) + 1;
    }
    hostGs.currentPlayer = nextPlayer;
    hostGs.risqueArtemisControlSeq = nextSeq;
    hostGs.risqueMirrorDeployRoute = "setup";
    artemisForceControlSlotFromCurrentPlayer(hostGs);
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(hostGs);
    }
    delete hostGs.risqueDeployMirrorDraft;
    delete hostGs.risqueDeployTransientPrimary;
    delete hostGs.risquePublicDeployBanner;
    try {
      hostGs.risquePublicDeployBanner =
        "WAITING FOR " + String(hostGs.currentPlayer || "NEXT").toUpperCase() + " TO DEPLOY";
    } catch (eBanner) {
      /* ignore */
    }
    artemisClearDeployHandoffNarration(hostGs);
    window.deployedTroops = {};
    window.selectedTerritory = null;
    try {
      console.info(
        "[ARTEMIS deploy] host advanced to",
        hostGs.currentPlayer,
        "ctrl=P" + String(hostGs.artemisControlSlot),
        "seq=" + String(hostGs.risqueArtemisControlSeq)
      );
    } catch (eAdvLog) {
      /* ignore */
    }
    return true;
  }

  function artemisHostRunSetupDeployFinishSideEffects(hostGs) {
    if (!hostGs) return;
    if (typeof window.risqueReplayRecordDeploy === "function") {
      window.risqueReplayRecordDeploy(hostGs);
    }
    if (typeof window.risqueCheapReplayCapturePostSetupDeploy === "function") {
      try {
        window.risqueCheapReplayCapturePostSetupDeploy(hostGs);
      } catch (eCheap) {
        /* ignore */
      }
    }
    if (typeof window.risqueReplayTryWriteDdJsonAfterSetupDeploy === "function") {
      window.risqueReplayTryWriteDdJsonAfterSetupDeploy(hostGs, { sealAfterWrite: true });
    }
    if (typeof window.risqueReplayPersistTapeSidecarImmediate === "function") {
      try {
        window.risqueReplayPersistTapeSidecarImmediate(hostGs);
      } catch (eSide) {
        /* ignore */
      }
    }
    if (window.gameUtils && typeof window.gameUtils.risqueLogDeckSnapshot === "function") {
      window.gameUtils.risqueLogDeckSnapshot(hostGs, "post-setup-deploy");
    }
  }

  /** Host-only setup deploy finish — last player, all banks zero. */
  function artemisHostFinishSetupDeploy(hostGs, senderSlot) {
    if (!hostGs || String(hostGs.phase || "") !== "deploy") return false;
    var curName = normDeployName(hostGs.currentPlayer);
    var player = (hostGs.players || []).find(function (p) {
      return normDeployName(p && p.name) === curName;
    });
    if (player && typeof window.risqueArtemisSyncActiveSetupBankFromBoard === "function") {
      window.risqueArtemisSyncActiveSetupBankFromBoard(hostGs, player);
    }
    if (!hostSenderIsActiveDeployer(hostGs, senderSlot)) {
      try {
        console.warn(
          "[ARTEMIS] setup deploy finish sender mismatch — sender P" +
            senderSlot +
            " host ctrl P" +
            (Number(hostGs.artemisControlSlot) || 0)
        );
      } catch (eSendWarn) {
        /* ignore */
      }
      return false;
    }
    if (!player) return false;
    if ((Number(player.bankValue) || 0) > 0) {
      try {
        console.warn(
          "[ARTEMIS] setup deploy finish rejected — " +
            String(player.name) +
            " bank=" +
            String(player.bankValue)
        );
      } catch (eBankWarn) {
        /* ignore */
      }
      return false;
    }
    if (
      !(hostGs.players || []).every(function (p) {
        return (Number(p.bankValue) || 0) === 0;
      })
    ) {
      return false;
    }
    hostGs.phase = "playerSelect";
    hostGs.selectionPhase = "cardPlay";
    hostGs.risquePublicUiSelectKind = "cardPlay";
    delete hostGs.risqueMirrorDeployRoute;
    delete hostGs.risqueDeployMirrorDraft;
    delete hostGs.risqueDeployTransientPrimary;
    delete hostGs.risquePublicDeployBanner;
    if (typeof window.risqueSetMirrorDeployRoute === "function") {
      window.risqueSetMirrorDeployRoute(null);
    }
    window.risqueDeploy1Active = false;
    window.deployedTroops = {};
    window.selectedTerritory = null;
    artemisHostRunSetupDeployFinishSideEffects(hostGs);
    try {
      console.info("[ARTEMIS deploy] host finished setup deploy → playerSelect/cardPlay");
    } catch (eFinLog) {
      /* ignore */
    }
    return true;
  }

  function hostRejectRegressivePlayerState(incoming, senderSlot) {
    var hostGs = window.gameState;
    if (!hostGs || !incoming) return false;
    if (artemisIsTurnWrapToCardplay(hostGs, incoming)) return false;
    var hp = String(hostGs.phase || "");
    var ip = String(incoming.phase || "");
    if (!hp || !ip || hp === ip) return false;
    var hostRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(hp)
        : 0;
    var inRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(ip)
        : 0;
    if (hostRank > 0 && inRank > 0 && inRank < hostRank) {
      return true;
    }
    var tr = window.risqueArtemisPhaseTransition;
    if (
      tr &&
      String(tr.target || "") === "deploy" &&
      Date.now() - (Number(tr.at) || 0) < 15000 &&
      (ip === "income" || ip === "con-income")
    ) {
      return true;
    }
    return false;
  }

  function clientShouldIgnoreStaleForwardPhaseDeployMirror(incoming) {
    if (!incoming || String(incoming.phase || "") !== "deploy") return false;
    var local = window.gameState;
    if (!local) return false;
    var localPh = String(local.phase || "");
    if (
      localPh === "attack" ||
      localPh === "reinforce" ||
      localPh === "receivecard" ||
      localPh === "getcard"
    ) {
      return true;
    }
    if (localPh !== "income" && localPh !== "con-income" && localPh !== "cardplay" && localPh !== "con-cardplay") {
      return false;
    }
    if (artemisIncomingTurnDeployAfterIncome(incoming)) {
      return false;
    }
    return true;
  }

  function clientLivePhaseRank() {
    var livePh = window.gameState ? String(window.gameState.phase || "") : "";
    if (!livePh) return 0;
    return typeof window.risqueArtemisForwardPhaseRank === "function"
      ? window.risqueArtemisForwardPhaseRank(livePh)
      : 0;
  }

  /** Drop deploy mirrors once this laptop has advanced past deployment (attack → receive card). */
  function clientShouldIgnoreRegressiveDeployMirror(incoming, flushHighestRankOpt) {
    if (!incoming || String(incoming.phase || "") !== "deploy") return false;
    if (clientShouldIgnoreStaleForwardPhaseDeployMirror(incoming)) return true;
    var hi = Math.max(
      clientLivePhaseRank(),
      Number(flushHighestRankOpt) || 0,
      Number(window.__risqueArtemisClientHighestPhaseRank) || 0
    );
    if (hi > 30) return true;
    if (clientShouldIgnoreActiveDeployMirror(incoming)) return true;
    try {
      var urlPh = String(new URL(window.location.href).searchParams.get("phase") || "");
      var urlRank =
        typeof window.risqueArtemisForwardPhaseRank === "function"
          ? window.risqueArtemisForwardPhaseRank(urlPh)
          : 0;
      if (urlRank > 30) return true;
    } catch (eUrlRank) {
      /* ignore */
    }
    return false;
  }

  function artemisClientNoteForwardPhase(gs, flushHighestRankOpt) {
    if (mode !== "client" || !gs) return 0;
    var r =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(String(gs.phase || ""))
        : 0;
    if (r > 0) {
      var prev = Number(window.__risqueArtemisClientHighestPhaseRank) || 0;
      if (r > prev) {
        window.__risqueArtemisClientHighestPhaseRank = r;
      }
      if (flushHighestRankOpt && typeof flushHighestRankOpt === "object") {
        flushHighestRankOpt.value = Math.max(Number(flushHighestRankOpt.value) || 0, r);
      }
    }
    return r;
  }

  function artemisHostAcceptPhaseAdvance(hostPhase, incomingPhase, senderSlot) {
    var hostGs = window.gameState;
    if (!hostGs || senderSlot < 1) return false;
    if (!hostSenderIsActiveDeployer(hostGs, senderSlot)) return false;
    var hp = String(hostPhase || "");
    var ip = String(incomingPhase || "");
    if (hp === "cardplay" && ip === "income") return true;
    if (hp === "con-cardplay" && (ip === "income" || ip === "con-income")) return true;
    if ((hp === "income" || hp === "con-income") && ip === "deploy") {
      return true;
    }
    if ((hp === "deploy" || hp === "con-deploy") && ip === "attack") {
      return true;
    }
    return false;
  }

  function hostSenderIsActiveDeployer(hostGs, senderSlot) {
    if (!hostGs || senderSlot < 1) return false;
    var ctrl = Number(hostGs.artemisControlSlot) || 0;
    if (ctrl >= 1 && Number(senderSlot) === ctrl) return true;
    if (Array.isArray(hostGs.artemisRoster)) {
      var hit = hostGs.artemisRoster.find(function (r) {
        return Number(r.slot) === Number(senderSlot);
      });
      if (hit && normDeployName(hit.name) === normDeployName(hostGs.currentPlayer)) {
        artemisForceControlSlotFromCurrentPlayer(hostGs);
        return true;
      }
    }
    return false;
  }

  function hostRejectStaleDeployState(gs, senderSlot) {
    var hostGs = window.gameState;
    if (!hostGs || !gs || String(hostGs.phase || "") !== "deploy" || String(gs.phase || "") !== "deploy") {
      return false;
    }
    var hostSeq = deployControlSeq(hostGs);
    var inSeq = deployControlSeq(gs);
    var turnAdvance =
      isDeployTurnAdvanceFromSender(gs, senderSlot) || isImplicitDeployTurnAdvance(gs, senderSlot);
    if (hostSeq > 0 && inSeq > 0 && inSeq < hostSeq) {
      return true;
    }
    if (
      hostSeq > 0 &&
      inSeq === hostSeq &&
      !turnAdvance &&
      (Number(hostGs.artemisControlSlot) !== Number(gs.artemisControlSlot) ||
        normDeployName(hostGs.currentPlayer) !== normDeployName(gs.currentPlayer))
    ) {
      return true;
    }
    return false;
  }

  function clientMirrorIsSetupDeployHandoff(local, incoming) {
    if (!local || !incoming || String(incoming.phase || "") !== "deploy") return false;
    var localPh = String(local.phase || "");
    var setupRoute = String(incoming.risqueMirrorDeployRoute || "") === "setup";
    if (
      setupRoute &&
      (localPh === "playerSelect" || localPh === "deal" || localPh === "welcome")
    ) {
      var mySlot = Number(window.risqueArtemisPlayerSlot) || 0;
      var ctrl = Number(incoming.artemisControlSlot) || 0;
      if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
        ctrl = Number(window.risqueArtemisResolveOwnerSlot(incoming)) || ctrl;
      }
      if (mySlot >= 1 && ctrl >= 1 && mySlot === ctrl) return true;
      if (deployControlSeq(incoming) > 0) return true;
    }
    var inSeq = deployControlSeq(incoming);
    var localSeq = deployControlSeq(local);
    var lp = normDeployName(local.currentPlayer);
    var ip = normDeployName(incoming.currentPlayer);
    if (inSeq > 0 && localSeq > 0 && inSeq > localSeq) return true;
    if (ip && lp && ip !== lp) {
      var pending = Number(window.risqueArtemisDeployHandoffPending) || 0;
      var expect = normDeployName(window.risqueArtemisDeployHandoffPlayer || "");
      if (pending > 0 && expect && ip === expect) return true;
      if (inSeq > 0 && inSeq >= localSeq) return true;
    }
    return false;
  }

  function clientShouldIgnoreActiveDeployMirror(incoming) {
    if (!incoming || String(incoming.phase || "") !== "deploy") return false;
    var localPh = window.gameState ? String(window.gameState.phase || "") : "";
    if (
      localPh === "playerSelect" &&
      String(incoming.risqueMirrorDeployRoute || "") === "setup"
    ) {
      return false;
    }
    var inSeq = deployControlSeq(incoming);
    var localSeq = deployControlSeq(window.gameState);
    var rel = Number(window.risqueArtemisDeployRelinquishedSeq) || 0;
    if (inSeq > 0 && localSeq > 0 && inSeq > localSeq) {
      return false;
    }
    if (rel > 0 && inSeq > rel) {
      return false;
    }
    if (window.risqueArtemisDeployHandoffPending || window.risqueArtemisDeployPushLocked) {
      return false;
    }
    if (clientMirrorIsSetupDeployHandoff(window.gameState, incoming)) {
      return false;
    }
    var mySlot = Number(window.risqueArtemisPlayerSlot) || 0;
    var ctrl = Number(incoming.artemisControlSlot) || 0;
    if (mySlot < 1 || ctrl !== mySlot) return false;
    var inSeq = deployControlSeq(incoming);
    var localSeq = deployControlSeq(window.gameState);
    if (inSeq > 0 && localSeq > 0 && inSeq > localSeq) {
      return false;
    }
    if (window.risqueArtemisClientPlaying || clientDeployControlsPresent()) {
      return true;
    }
    return false;
  }

  function artemisMirrorSameTurn(local, incoming) {
    if (!local || !incoming) return false;
    return (
      Number(local.risqueArtemisControlSeq || 0) > 0 &&
      Number(local.risqueArtemisControlSeq || 0) === Number(incoming.risqueArtemisControlSeq || 0) &&
      normDeployName(local.currentPlayer) === normDeployName(incoming.currentPlayer)
    );
  }

  function artemisClientLocalStaleSetupDeploy(local) {
    if (!local || String(local.phase || "") !== "deploy") return false;
    if (typeof window.risqueArtemisIsSetupDeploy === "function") {
      return window.risqueArtemisIsSetupDeploy(local);
    }
    return false;
  }

  /** End-of-turn: receive card finished → next player's cardplay (phase rank goes backward). */
  function artemisIsTurnWrapToCardplay(local, incoming) {
    if (!local || !incoming) return false;
    var inPh = String(incoming.phase || "");
    if (inPh !== "cardplay" && inPh !== "con-cardplay") return false;
    var localPh = String(local.phase || "");
    if (localPh === "receivecard" || localPh === "getcard") return true;
    /* Host/clients may lag behind the active laptop's reinforce→receivecard chain; accept wrap when
     * currentPlayer advances to the next seat (cardplay rank < reinforce/receivecard rank). */
    var localCur = normDeployName(local.currentPlayer);
    var inCur = normDeployName(incoming.currentPlayer);
    if (
      localCur &&
      inCur &&
      localCur !== inCur &&
      (localPh === "reinforce" ||
        localPh === "receivecard" ||
        localPh === "getcard" ||
        localPh === "attack")
    ) {
      return true;
    }
    return false;
  }

  function artemisNormalizeUrlPhaseAlias(ph) {
    var p = String(ph || "");
    if (p === "con-cardplay") return "cardplay";
    if (p === "con-income") return "income";
    if (p === "con-deploy") return "deploy";
    return p;
  }

  function artemisMirrorGameplayFollowUrl(mirrorGs) {
    if (!mirrorGs) return "";
    var mirrorPh = String(mirrorGs.phase || "");
    var urlPh = artemisNormalizeUrlPhaseAlias(mirrorPh);
    if (!urlPh) return "";
    var url = "game.html?phase=" + encodeURIComponent(urlPh);
    if (urlPh === "deploy") {
      var route = String(mirrorGs.risqueMirrorDeployRoute || "");
      var turnDep =
        route === "turn" ||
        route === "deploy2" ||
        (mirrorGs.setupComplete === true &&
          typeof window.risqueArtemisIsSetupDeploy === "function" &&
          !window.risqueArtemisIsSetupDeploy(mirrorGs));
      url = "game.html?phase=deploy&kind=" + (turnDep ? "turn" : "setup");
    }
    if (typeof window.risqueArtemisAppendSessionParams === "function") {
      url = window.risqueArtemisAppendSessionParams(url);
    }
    return url;
  }

  function artemisShouldFollowGameplayPhaseUrl(mirrorGs, urlPh, prevPhOpt, prevPlayerOpt) {
    if (!mirrorGs || !urlPh) return false;
    var mirrorPhRaw = String(mirrorGs.phase || "");
    var mirrorPh = artemisNormalizeUrlPhaseAlias(mirrorPhRaw);
    var urlNorm = artemisNormalizeUrlPhaseAlias(urlPh);
    if (!mirrorPh || urlNorm === mirrorPh || urlPh === mirrorPhRaw) return false;
    var gameplay = [
      "cardplay",
      "income",
      "deploy",
      "attack",
      "reinforce",
      "receivecard",
      "getcard",
    ];
    if (gameplay.indexOf(mirrorPh) === -1 && gameplay.indexOf(mirrorPhRaw) === -1) return false;
    var wrapLocal = prevPhOpt
      ? {
          phase: prevPhOpt,
          currentPlayer:
            prevPlayerOpt != null && String(prevPlayerOpt).trim() !== ""
              ? prevPlayerOpt
              : mirrorGs.currentPlayer
        }
      : window.gameState || { phase: urlPh };
    if (artemisIsTurnWrapToCardplay(wrapLocal, mirrorGs)) return true;
    var urlRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(urlPh)
        : 0;
    var mirrorRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(mirrorPhRaw)
        : 0;
    if (mirrorRank > 0 && urlRank > 0 && mirrorRank > urlRank) return true;
    /* Turn wrap: URL still on reinforce/receivecard while mirror already advanced to cardplay. */
    if (
      mirrorPh === "cardplay" &&
      urlRank > 0 &&
      mirrorRank > 0 &&
      urlRank > mirrorRank &&
      urlRank >= 50
    ) {
      return true;
    }
    if (
      mirrorPh === "cardplay" &&
      urlPh === "deploy" &&
      typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
      !window.risqueArtemisClientHasActiveDeploySession()
    ) {
      return true;
    }
    if (
      (mirrorPh === "cardplay" || mirrorPhRaw === "cardplay") &&
      (urlPh === "playerSelect" || urlNorm === "playerSelect") &&
      mirrorGs.setupComplete === true
    ) {
      return true;
    }
    if (
      (mirrorPh === "deploy" || mirrorPhRaw === "deploy") &&
      (urlPh === "playerSelect" || urlNorm === "playerSelect") &&
      String(mirrorGs.risqueMirrorDeployRoute || "") === "setup"
    ) {
      return true;
    }
    return false;
  }

  function artemisResetClientPhaseRankOnTurnWrap(mirrorGs, localGs) {
    if (mode !== "client" || !artemisIsTurnWrapToCardplay(localGs, mirrorGs)) return;
    window.__risqueArtemisClientHighestPhaseRank = 10;
  }

  function artemisPrepareGameplayPhaseFollowNav(mirrorGs, localGs) {
    if (artemisIsTurnWrapToCardplay(localGs, mirrorGs)) {
      artemisResetClientPhaseRankOnTurnWrap(mirrorGs, localGs);
      if (typeof window.risqueArtemisUnmountPortableReceiveCard === "function") {
        try {
          window.risqueArtemisUnmountPortableReceiveCard();
        } catch (eUnRc) {
          /* ignore */
        }
      }
    }
    var mirrorPh = String(mirrorGs.phase || "");
    if (
      (mirrorPh === "deploy" || mirrorPh === "con-deploy") &&
      typeof window.risqueArtemisClearIncomeVoiceDom === "function"
    ) {
      try {
        window.risqueArtemisClearIncomeVoiceDom();
      } catch (eClrInc) {
        /* ignore */
      }
    }
  }

  function artemisNavigateGameplayPhaseFromMirror(mirrorGs, diagKind, syncOpt, prevPhOpt, prevPlayerOpt) {
    if (!mirrorGs) return false;
    var urlPh = "";
    try {
      urlPh = String(new URL(window.location.href).searchParams.get("phase") || "");
    } catch (eUrlPh) {
      return false;
    }
    if (!artemisShouldFollowGameplayPhaseUrl(mirrorGs, urlPh, prevPhOpt, prevPlayerOpt)) return false;
    var localGs = prevPhOpt
      ? {
          phase: prevPhOpt,
          currentPlayer:
            prevPlayerOpt != null && String(prevPlayerOpt).trim() !== ""
              ? prevPlayerOpt
              : mirrorGs.currentPlayer
        }
      : window.gameState || { phase: urlPh };
    artemisPrepareGameplayPhaseFollowNav(mirrorGs, localGs);
    var url = artemisMirrorGameplayFollowUrl(mirrorGs);
    if (!url) return false;
    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag(
        String(diagKind || "follow_gameplay_phase"),
        (mode === "host" ? "P1 host" : "P" + (Number(window.risqueArtemisPlayerSlot) || 0)) +
          " follow " +
          String(mirrorGs.phase || "") +
          " mirror",
        { fromUrlPhase: urlPh, currentPlayer: String(mirrorGs.currentPlayer || "") }
      );
    }
    if (syncOpt && window.risqueArtemisNetClient && !window.risqueArtemisHost) {
      try {
        if (window.history && typeof window.history.replaceState === "function") {
          window.history.replaceState(null, "", url);
          return true;
        }
      } catch (eClientUrl) {
        /* ignore */
      }
    }
    if (typeof window.risqueNavigateGameHtmlSoft === "function" && window.risqueNavigateGameHtmlSoft(url)) {
      return true;
    }
    if (typeof window.risqueNavigateWithFade === "function") {
      window.risqueNavigateWithFade(url);
      return true;
    }
    window.location.href = url;
    return true;
  }

  function artemisHostFollowGameplayPhaseFromMirror(mirrorGs, prevPhOpt) {
    if (mode !== "host" || !mirrorGs || !window.risqueArtemisLobbyStarted) return;
    if (window.risqueDisplayIsPublic) return;
    var tr = window.risqueArtemisPhaseTransition;
    if (tr && tr.target && Date.now() - (Number(tr.at) || 0) < 8000) {
      if (String(tr.target || "") === String(mirrorGs.phase || "")) return;
    }
    var urlPh = "";
    try {
      urlPh = String(new URL(window.location.href).searchParams.get("phase") || "");
    } catch (eUrlPh) {
      return;
    }
    if (!artemisShouldFollowGameplayPhaseUrl(mirrorGs, urlPh, prevPhOpt, window.__risqueArtemisPrevFollowPlayer)) return;
    artemisNavigateGameplayPhaseFromMirror(
      mirrorGs,
      "host_follow_gameplay_phase",
      true,
      prevPhOpt,
      window.__risqueArtemisPrevFollowPlayer
    );
  }

  /** Host advanced into cardplay/income while this laptop still shows stale deploy chrome. */
  function clientShouldAcceptGameplayCatchUpMirror(local, incoming) {
    if (!local || !incoming) return false;
    if (artemisIsTurnWrapToCardplay(local, incoming)) return true;
    var localPh = String(local.phase || "");
    var inPh = String(incoming.phase || "");
    if (!localPh || !inPh || localPh === inPh) return false;
    if (
      localPh === "deploy" &&
      (inPh === "cardplay" || inPh === "con-cardplay") &&
      (incoming.setupComplete === true || Number(incoming.round) >= 1)
    ) {
      return true;
    }
    if (
      localPh === "playerSelect" &&
      inPh === "deploy" &&
      String(incoming.risqueMirrorDeployRoute || "") === "setup"
    ) {
      return true;
    }
    if (
      localPh === "deploy" &&
      (inPh === "cardplay" ||
        inPh === "con-cardplay" ||
        inPh === "income" ||
        inPh === "con-income") &&
      typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
      !window.risqueArtemisClientHasActiveDeploySession()
    ) {
      return true;
    }
    if (
      localPh === "deploy" &&
      (inPh === "cardplay" || inPh === "con-cardplay") &&
      !artemisClientLocalStaleSetupDeploy(local) &&
      !window.risqueArtemisDeployHandoffPending &&
      !window.risqueArtemisDeployPushLocked
    ) {
      return true;
    }
    if (artemisMirrorSameTurn(local, incoming)) {
      var localRankCatch =
        typeof window.risqueArtemisForwardPhaseRank === "function"
          ? window.risqueArtemisForwardPhaseRank(localPh)
          : 0;
      var inRankCatch =
        typeof window.risqueArtemisForwardPhaseRank === "function"
          ? window.risqueArtemisForwardPhaseRank(inPh)
          : 0;
      if (
        localRankCatch > 0 &&
        inRankCatch > localRankCatch &&
        (inPh === "deploy" ||
          inPh === "con-deploy" ||
          inPh === "attack" ||
          inPh === "reinforce" ||
          inPh === "receivecard" ||
          inPh === "getcard")
      ) {
        return true;
      }
    }
    return false;
  }

  function clientNoteMirrorReject(incoming, reason) {
    try {
      window.__risqueArtemisLastMirrorReject = {
        at: Date.now(),
        incomingPhase: String((incoming && incoming.phase) || ""),
        livePhase: String((window.gameState && window.gameState.phase) || ""),
        reason: String(reason || ""),
      };
      if (typeof window.risqueArtemisRenderPhaseMismatchStrip === "function") {
        window.risqueArtemisRenderPhaseMismatchStrip();
      }
    } catch (eRejNote) {
      /* ignore */
    }
  }

  function artemisIncomingTurnDeployAfterIncome(incoming) {
    if (!incoming || String(incoming.phase || "") !== "deploy") return false;
    var route = String(incoming.risqueMirrorDeployRoute || "");
    if (route !== "turn" && route !== "deploy2") {
      try {
        var rk = localStorage.getItem("risqueMirrorDeployRoute");
        if (rk === "turn" || rk === "deploy2") route = rk;
      } catch (eRk) {
        /* ignore */
      }
    }
    if (route !== "turn" && route !== "deploy2") return false;
    var up = normDeployName(incoming.currentPlayer);
    if (!up) return false;
    var p = (incoming.players || []).find(function (pl) {
      return pl && normDeployName(pl.name) === up;
    });
    return (Number(p && p.bankValue) || 0) > 0;
  }

  function clientRejectArtemisPhaseMirror(incoming) {
    var local = window.gameState;
    if (!local || !incoming) return false;
    if (clientShouldAcceptGameplayCatchUpMirror(local, incoming)) {
      return false;
    }
    if (artemisIsTurnWrapToCardplay(local, incoming)) {
      return false;
    }
    var localPh = String(local.phase || "");
    var inPh = String(incoming.phase || "");
    if (!localPh || !inPh || localPh === inPh) return false;
    var localRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(localPh)
        : 0;
    var inRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(inPh)
        : 0;
    var sameTurn = artemisMirrorSameTurn(local, incoming);

    if (
      artemisClientLocalStaleSetupDeploy(local) &&
      (inPh === "cardplay" ||
        inPh === "con-cardplay" ||
        inPh === "income" ||
        inPh === "con-income")
    ) {
      return false;
    }

    if (localRank > 0 && inRank > 0 && localRank > inRank) {
      if (artemisClientLocalStaleSetupDeploy(local) && inRank >= 10) {
        return false;
      }
      if (sameTurn) return false;
      if (artemisIsTurnWrapToCardplay(local, incoming)) return false;
      return true;
    }
    if (sameTurn && inPh === "deploy" && (localPh === "attack" || localPh === "reinforce")) {
      return true;
    }
    if (sameTurn && localRank > 0 && inRank > 0 && localRank - inRank > 10) {
      return true;
    }
    if (
      sameTurn &&
      (localPh === "cardplay" || localPh === "con-cardplay") &&
      inPh === "deploy"
    ) {
      return true;
    }
    if (
      sameTurn &&
      (localPh === "income" || localPh === "con-income") &&
      inPh === "deploy" &&
      local.risquePublicIncomeBreakdown &&
      local.risquePublicIncomeBreakdown.total != null
    ) {
      if (artemisIncomingTurnDeployAfterIncome(incoming)) return false;
      return true;
    }
    return false;
  }

  function clientRejectStaleMirrorState(incoming) {
    if (clientRejectArtemisPhaseMirror(incoming)) {
      return true;
    }
    var local = window.gameState;
    if (!local || !incoming) return false;
    var localPh = String(local.phase || "");
    var inPh = String(incoming.phase || "");
    if (localPh && inPh && localPh !== inPh) {
      if (clientShouldAcceptGameplayCatchUpMirror(local, incoming)) {
        return false;
      }
      var localRank =
        typeof window.risqueArtemisForwardPhaseRank === "function"
          ? window.risqueArtemisForwardPhaseRank(localPh)
          : 0;
      var inRank =
        typeof window.risqueArtemisForwardPhaseRank === "function"
          ? window.risqueArtemisForwardPhaseRank(inPh)
          : 0;
      if (localRank > 0 && inRank > 0 && localRank > inRank) {
        if (artemisIsTurnWrapToCardplay(local, incoming)) {
          return false;
        }
        if (artemisClientLocalStaleSetupDeploy(local) && inRank >= 10) {
          return false;
        }
        if (artemisMirrorSameTurn(local, incoming)) {
          return false;
        }
        return true;
      }
    }
    if (!local || !incoming || String(local.phase || "") !== "deploy" || String(incoming.phase || "") !== "deploy") {
      return false;
    }
    var localSeq = deployControlSeq(local);
    var inSeq = deployControlSeq(incoming);
    if (inSeq > 0 && localSeq > 0 && inSeq > localSeq) {
      return false;
    }
    var lp = normDeployName(local.currentPlayer);
    var ip = normDeployName(incoming.currentPlayer);
    var pending = Number(window.risqueArtemisDeployHandoffPending) || 0;
    var expectHandoff = normDeployName(window.risqueArtemisDeployHandoffPlayer || "");
    /* Authoritative handoff mirror from host — always accept. */
    if (pending > 0 && inSeq >= pending && expectHandoff && ip === expectHandoff) {
      return false;
    }
    if (localSeq > 0 && inSeq > 0 && inSeq > localSeq) {
      return false;
    }
    if (localSeq > 0 && inSeq > 0 && inSeq < localSeq) {
      return true;
    }
    /* Same seq + different deployer: reject stale echo unless control slot advanced (handoff fix). */
    if (localSeq > 0 && inSeq > 0 && inSeq === localSeq && lp !== ip) {
      if (window.risqueArtemisDeployPushLocked) {
        var expectLocked = normDeployName(window.risqueArtemisDeployHandoffPlayer || "");
        if (expectLocked && lp === expectLocked && ip !== expectLocked) {
          return true;
        }
      }
      var lcSame = Number(local.artemisControlSlot) || 0;
      var icSame = Number(incoming.artemisControlSlot) || 0;
      if (icSame > 0 && icSame !== lcSame) {
        return false;
      }
      var mySlotHandoff = Number(window.risqueArtemisPlayerSlot) || 0;
      if (mySlotHandoff >= 1 && icSame === mySlotHandoff) {
        return false;
      }
      return true;
    }
    if (pending > 0 && inSeq > 0 && inSeq < pending) {
      return true;
    }
    var relinquished = Number(window.risqueArtemisDeployRelinquishedSeq) || 0;
    if (relinquished > 0 && inSeq > 0 && inSeq <= relinquished) {
      var mySlot = Number(window.risqueArtemisPlayerSlot) || 0;
      var ic = Number(incoming.artemisControlSlot) || 0;
      if (mySlot >= 1 && ic === mySlot && ip === lp) {
        return true;
      }
    }
    if (localSeq > 0 && inSeq > 0 && inSeq === localSeq) {
      var lc = Number(local.artemisControlSlot) || 0;
      var ic2 = Number(incoming.artemisControlSlot) || 0;
      if (lp !== ip || (lc > 0 && ic2 > 0 && lc !== ic2)) {
        var expectPlayer = String(window.risqueArtemisDeployHandoffPlayer || "");
        if (pending > 0 && localSeq >= pending) {
          if (expectPlayer && normDeployName(expectPlayer) === lp && normDeployName(expectPlayer) !== ip) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function artemisOnSetupDeployPage() {
    if (/phase=deploy/i.test(String(window.location.search || ""))) return true;
    if (window.risqueArtemisHost && window.risqueArtemisLobbyStarted) {
      try {
        var urlPh = new URL(window.location.href).searchParams.get("phase");
        if (urlPh === "login" && window.gameState) {
          var gph = String(window.gameState.phase || "");
          if (
            gph === "deploy" ||
            gph === "playerSelect" ||
            window.risqueDeploy1Active ||
            window.risqueArtemisAwaitSetupDeployFinish
          ) {
            return true;
          }
        }
      } catch (eHostLoginUrl) {
        /* ignore */
      }
    }
    if (
      window.gameState &&
      String(window.gameState.phase || "") === "deploy" &&
      String(window.gameState.risqueMirrorDeployRoute || "") === "setup"
    ) {
      return true;
    }
    if (window.risqueDeploy1Active) return true;
    if (window.risqueArtemisAwaitSetupDeployFinish) return true;
    try {
      var rk = localStorage.getItem("risqueMirrorDeployRoute");
      if (rk === "setup" || rk === "deploy1") return true;
    } catch (eRoute) {
      /* ignore */
    }
    return false;
  }

  function artemisHostHideLoginChromeForSetup() {
    if (typeof window.risqueArtemisHideLoginPanel === "function") {
      window.risqueArtemisHideLoginPanel();
    }
    try {
      document.documentElement.classList.remove("risque-artemis-login-active");
      document.documentElement.classList.remove("risque-artemis-login-confirmed");
    } catch (eCls) {
      /* ignore */
    }
  }

  function artemisClientEnsureSetupDeployUrl() {
    artemisClientFollowSetupDeployFromMirror({
      phase: "deploy",
      risqueMirrorDeployRoute: "setup"
    });
  }
  window.risqueArtemisEnsureSetupDeployUrl = artemisClientEnsureSetupDeployUrl;

  function artemisClearPlayerSelectClientArtifacts() {
    try {
      delete window.__risqueArtemisPlayerSelectMirrorOnly;
      delete window.__risqueArtemisPlayerSelectFollowKey;
      delete window.__risquePlayerSelectMountGuard;
      sessionStorage.removeItem("risqueArtemisPsFollow");
    } catch (eClr) {
      /* ignore */
    }
  }

  function artemisClientShouldClearPlayerSelectArtifacts(incomingPhase) {
    var ph = String(incomingPhase || "");
    if (!ph || ph === "playerSelect" || ph === "deal" || ph === "welcome" || ph === "login") {
      return false;
    }
    return true;
  }

  function artemisClientOnPlayerSelectRouletteUrl(sk) {
    if (!sk) return false;
    try {
      var u = new URL(window.location.href);
      if (String(u.searchParams.get("phase") || "") !== "playerSelect") return false;
      var urlSk = String(u.searchParams.get("selectKind") || "").toLowerCase();
      if (urlSk === "cardplay") urlSk = "cardPlay";
      if (urlSk === "deployorder") urlSk = "deployOrder";
      if (urlSk === "firstcard") urlSk = "firstCard";
      return urlSk === sk;
    } catch (eUrl) {
      return false;
    }
  }

  function artemisClientFollowPlayerSelectFromMirror(mirrorGs) {
    /* m208: clients never soft-nav for setup roulettes — voice-only mirror on deal/deploy URL. */
    if (mode !== "client" || !mirrorGs) return;
  }

  function artemisClientFollowSetupDeployFromMirror(mirrorGs) {
    if (mode !== "client" || !mirrorGs) return;
    if (String(mirrorGs.phase || "") !== "deploy") return;
    if (String(mirrorGs.risqueMirrorDeployRoute || "") !== "setup") return;
    var urlPh = "";
    try {
      urlPh = String(new URL(window.location.href).searchParams.get("phase") || "");
    } catch (eUrlPh) {
      return;
    }
    if (urlPh === "deploy") return;
    var livePh = window.gameState ? String(window.gameState.phase || "") : "";
    var fromPlayerSelect = urlPh === "playerSelect" || livePh === "playerSelect";
    if (!fromPlayerSelect && urlPh !== "deal" && urlPh !== "welcome") return;
    var url = "game.html?phase=deploy&kind=setup";
    if (typeof window.risqueArtemisAppendSessionParams === "function") {
      url = window.risqueArtemisAppendSessionParams(url);
    }
    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag(
        "client_follow_setup_deploy",
        "P" + (Number(window.risqueArtemisPlayerSlot) || 0) + " follow deploy mirror",
        {
          fromUrlPhase: urlPh,
          currentPlayer: String(mirrorGs.currentPlayer || ""),
          controlSeq: Number(mirrorGs.risqueArtemisControlSeq) || 0
        }
      );
    }
    setTimeout(function () {
      if (
        typeof window.risqueNavigateGameHtmlSoft === "function" &&
        window.risqueNavigateGameHtmlSoft(url)
      ) {
        return;
      }
      if (typeof window.risqueNavigateWithFade === "function") {
        window.risqueNavigateWithFade(url);
      } else {
        window.location.href = url;
      }
    }, 0);
  }

  function artemisNavigateAfterSetupDeployFinish() {
    window.risqueArtemisAwaitSetupDeployFinish = false;
    window.risqueDeploy1Active = false;
    if (mode === "client") {
      if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
        window.risqueTeardownArtemisSetupDeploy(true);
      } else if (typeof window.risqueArtemisUnmountPortableDeploy === "function") {
        window.risqueArtemisUnmountPortableDeploy();
      }
      return;
    }
    artemisClearPlayerSelectClientArtifacts();
    artemisHostHideLoginChromeForSetup();
    if (typeof window.risqueSetMirrorDeployRoute === "function") {
      window.risqueSetMirrorDeployRoute(null);
    }
    if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
      window.risqueTeardownArtemisSetupDeploy(true);
    } else if (typeof window.risqueArtemisUnmountPortableDeploy === "function") {
      window.risqueArtemisUnmountPortableDeploy();
    }
    var finishUrl = "game.html?phase=playerSelect&selectKind=cardPlay";
    if (typeof window.risqueArtemisAppendSessionParams === "function") {
      finishUrl = window.risqueArtemisAppendSessionParams(finishUrl);
    }
    setTimeout(function () {
      if (
        typeof window.risqueNavigateGameHtmlSoft === "function" &&
        window.risqueNavigateGameHtmlSoft(finishUrl)
      ) {
        return;
      }
      if (typeof window.risqueNavigateWithFade === "function") {
        window.risqueNavigateWithFade(finishUrl);
      } else {
        window.location.href = finishUrl;
      }
    }, 0);
  }

  function artemisClientFollowGameplayPhaseFromMirror(mirrorGs, prevPhOpt, prevPlayerOpt) {
    if (mode !== "client" || !mirrorGs) return;
    var mirrorPh = String(mirrorGs.phase || "");
    var followPhases = [
      "cardplay",
      "con-cardplay",
      "income",
      "con-income",
      "attack",
      "reinforce",
      "receivecard",
      "getcard",
    ];
    if (followPhases.indexOf(mirrorPh) === -1) return;
    setTimeout(function () {
      artemisNavigateGameplayPhaseFromMirror(
        mirrorGs,
        "client_follow_gameplay_phase",
        false,
        prevPhOpt,
        prevPlayerOpt
      );
    }, 0);
  }

  /** Same-document URL must update before the next mirror in the flush batch (attack before stale deploy). */
  function artemisClientFollowGameplayPhaseFromMirrorSync(mirrorGs, prevPhOpt, prevPlayerOpt) {
    if (mode !== "client" || !mirrorGs) return false;
    if (
      String(mirrorGs.phase || "") === "cardplay" &&
      mirrorGs.risquePublicPlayerSelectFlash &&
      String(mirrorGs.risquePublicPlayerSelectFlash.name || "").trim() !== ""
    ) {
      return false;
    }
    return artemisNavigateGameplayPhaseFromMirror(
      mirrorGs,
      "client_follow_gameplay_phase_sync",
      true,
      prevPhOpt,
      prevPlayerOpt
    );
  }

  function artemisClientPersistMirrorToLocalStorage(mirrorGs) {
    if (mode !== "client" || !mirrorGs) return;
    try {
      var json = JSON.stringify(mirrorGs);
      localStorage.setItem("gameState", json);
      localStorage.setItem("risquePublicMirrorState", json);
      window.__risquePublicMirrorAppliedRaw = json;
    } catch (eLs) {
      /* ignore */
    }
  }

  function artemisShouldFinishSetupDeployFromMirror(mirrorGs) {
    if (String(mirrorGs.phase || "") !== "playerSelect") return false;
    if (!artemisOnSetupDeployPage()) return false;
    var sk = String(mirrorGs.risquePublicUiSelectKind || mirrorGs.selectionPhase || "");
    if (sk === "cardPlay") return true;
    if (sk && sk !== "cardPlay") return false;
    return true;
  }

  function artemisForceOutgoingDeployRelinquish(mirrorGs) {
    if (!mirrorGs || String(mirrorGs.phase || "") !== "deploy") return;
    var mySlot = Number(window.risqueArtemisPlayerSlot) || 0;
    var ctrl = Number(mirrorGs.artemisControlSlot) || 0;
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      ctrl = Number(window.risqueArtemisResolveOwnerSlot(mirrorGs)) || ctrl;
    }
    if (mySlot < 1 || ctrl < 1 || mySlot === ctrl) return;
    if (typeof window.risqueArtemisRelinquishDeployControl === "function") {
      window.risqueArtemisRelinquishDeployControl(mirrorGs, {
        handoffPending: Number(window.risqueArtemisDeployHandoffPending) > 0
      });
    }
  }

  function artemisPresetCardplayActive(gs) {
    gs = gs || window.gameState;
    if (!gs || String(gs.phase || "") !== "cardplay") return false;
    if (gs.risqueArtemisPresetId) return true;
    if (window.risqueArtemisPresetMode) return true;
    try {
      return !!sessionStorage.getItem("risqueArtemisPresetId");
    } catch (ePreset) {
      return false;
    }
  }

  function artemisHostForceVisualSync(gs) {
    if (!window.risqueArtemisHost || !gs) return;
    try {
      document.body.setAttribute("data-risque-phase", String(gs.phase || ""));
    } catch (ePhAttr) {
      /* ignore */
    }
    if (typeof window.risqueArtemisReplaceShellGameState === "function") {
      window.risqueArtemisReplaceShellGameState(gs);
    } else if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
      window.risqueRuntimeHud.updateTurnBannerFromState(gs);
    }
    if (String(gs.phase || "") === "attack") {
      if (
        window.risqueArtemisHost &&
        !window.risqueArtemisNetClient &&
        typeof window.risqueArtemisShouldHostMountAttack === "function" &&
        !window.risqueArtemisShouldHostMountAttack(gs) &&
        typeof window.risqueArtemisDriveHostAttackDice === "function"
      ) {
        try {
          window.risqueArtemisDriveHostAttackDice(gs);
        } catch (eHostDiceDrv) {
          /* ignore */
        }
      } else if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
        try {
          window.risquePublicApplyDiceAndBattleReadout(gs);
        } catch (eHostDice) {
          /* ignore */
        }
      }
      if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
        try {
          window.risquePublicApplyVoiceAndLogMirror(gs);
        } catch (eHostAtkVoice) {
          /* ignore */
        }
      }
    } else if (
      window.risqueArtemisHost &&
      !window.risqueArtemisNetClient &&
      typeof window.risqueArtemisTeardownHostAttackSpectator === "function"
    ) {
      try {
        window.risqueArtemisTeardownHostAttackSpectator();
      } catch (eHostAtkTeardown) {
        /* ignore */
      }
    }
    if (String(gs.phase || "") === "reinforce") {
      if (
        typeof window.risqueArtemisShouldHostMountReinforce === "function" &&
        !window.risqueArtemisShouldHostMountReinforce(gs) &&
        typeof window.risqueArtemisApplyHostReinforceSpectator === "function"
      ) {
        try {
          window.risqueArtemisApplyHostReinforceSpectator(gs);
        } catch (eHostRf) {
          /* ignore */
        }
      } else if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
        try {
          window.risquePublicApplyVoiceAndLogMirror(gs);
        } catch (eHostRfVoice) {
          /* ignore */
        }
      }
    }
  }

  function artemisCloneAttackLiveField(val) {
    if (val == null) return val;
    try {
      return JSON.parse(JSON.stringify(val));
    } catch (eClone) {
      return val;
    }
  }

  function artemisMarkHostAttackSpinGrace(ms) {
    window.__risqueArtemisHostAttackSpinUntil = Date.now() + (Number(ms) || 520);
  }

  /** Host spectating client attack: never let stale player_state clobber a live spin from attack_live. */
  function artemisMergePreferLiveAttackDice(gsIncoming, live) {
    if (!gsIncoming || !live) return;
    var inc = gsIncoming.risqueLastDiceDisplay;
    var liv = live.risqueLastDiceDisplay;
    if (!liv || typeof liv !== "object") return;
    if (!inc || typeof inc !== "object") {
      gsIncoming.risqueLastDiceDisplay = artemisCloneAttackLiveField(liv);
      return;
    }
    if (liv.spinning === true && inc.spinning !== true) {
      gsIncoming.risqueLastDiceDisplay = artemisCloneAttackLiveField(liv);
      return;
    }
    var liveSeq = Number(window.__risqueArtemisLastAttackLiveSeq) || 0;
    var incSeq = Number(inc.artemisAttackLiveSeq) || 0;
    var livSeq = Number(liv.artemisAttackLiveSeq) || 0;
    if (liveSeq > 0 && livSeq >= liveSeq && livSeq > incSeq) {
      gsIncoming.risqueLastDiceDisplay = artemisCloneAttackLiveField(liv);
    }
  }

  function artemisPreserveHostAttackSpectatorLive(gsIncoming) {
    if (!window.risqueArtemisHost || window.risqueArtemisNetClient || !gsIncoming) return;
    if (String(gsIncoming.phase || "") !== "attack") return;
    var live = window.gameState;
    if (!live || String(live.phase || "") !== "attack") return;
    if (
      typeof window.risqueArtemisShouldHostMountAttack === "function" &&
      window.risqueArtemisShouldHostMountAttack(gsIncoming)
    ) {
      return;
    }
    artemisMergePreferLiveAttackDice(gsIncoming, live);
    var keys = [
      "risqueBattleHudReadout",
      "risqueControlVoice",
      "risqueAttackOutcomePrimary",
      "risqueAttackOutcomeReport",
      "risqueAttackOutcomeAcquisition",
      "risqueCombatLogTail"
    ];
    keys.forEach(function (key) {
      if (gsIncoming[key] != null) return;
      if (live[key] == null) return;
      gsIncoming[key] = artemisCloneAttackLiveField(live[key]);
    });
    if (gsIncoming.risqueLastDiceDisplay == null && live.risqueLastDiceDisplay != null) {
      gsIncoming.risqueLastDiceDisplay = artemisCloneAttackLiveField(live.risqueLastDiceDisplay);
    }
  }

  function finalizeHostClientState(gs, turnAdvance) {
    if (!gs) return;
    var prevHostPh = String((window.gameState && window.gameState.phase) || "");
    var prevHostPlayer = window.gameState && window.gameState.currentPlayer;
    if (gs.artemisDeployTurnAdvance) {
      delete gs.artemisDeployTurnAdvance;
    }
    if (turnAdvance && String(gs.phase || "") === "deploy") {
      delete gs.risqueDeployMirrorDraft;
      delete gs.risqueDeployTransientPrimary;
      delete gs.risquePublicDeployBanner;
      try {
        gs.risquePublicDeployBanner =
          "WAITING FOR " + String(gs.currentPlayer || "NEXT").toUpperCase() + " TO DEPLOY";
      } catch (eTvBanner) {
        /* ignore */
      }
      artemisClearDeployHandoffNarration(gs);
      artemisForceControlSlotFromCurrentPlayer(gs);
      if (typeof window.risqueArtemisStampControlSlot === "function") {
        window.risqueArtemisStampControlSlot(gs);
      }
      if (
        window.risqueArtemisHost &&
        typeof window.risqueArtemisForceDeploySpectatorHandoffRefresh === "function"
      ) {
        window.risqueArtemisForceDeploySpectatorHandoffRefresh(gs);
      }
      window.deployedTroops = {};
      window.selectedTerritory = null;
      if (typeof window.risqueArtemisClearDeployMapOverlays === "function") {
        window.risqueArtemisClearDeployMapOverlays(gs);
      }
    }
    var incomeToDeployFinalize =
      (prevHostPh === "income" || prevHostPh === "con-income") &&
      String(gs.phase || "") === "deploy";
    if (
      incomeToDeployFinalize &&
      typeof window.risqueArtemisResetDeployTurnSession === "function"
    ) {
      artemisForceControlSlotFromCurrentPlayer(gs);
      if (typeof window.risqueArtemisStampControlSlot === "function") {
        window.risqueArtemisStampControlSlot(gs);
      }
      window.risqueArtemisResetDeployTurnSession(gs);
      if (
        window.risqueArtemisHost &&
        typeof window.risqueArtemisForceDeploySpectatorHandoffRefresh === "function"
      ) {
        window.risqueArtemisForceDeploySpectatorHandoffRefresh(gs);
      }
    }
    if (String(gs.phase || "") === "deploy") {
      var incomingRoute = String(gs.risqueMirrorDeployRoute || "");
      var incomeToDeployRoute =
        (prevHostPh === "income" || prevHostPh === "con-income") &&
        String(gs.phase || "") === "deploy";
      var isTurnDeploy =
        incomingRoute === "turn" ||
        incomingRoute === "deploy2" ||
        incomeToDeployRoute ||
        (typeof window.risqueArtemisIsSetupDeploy === "function" &&
          !window.risqueArtemisIsSetupDeploy(gs) &&
          incomingRoute !== "setup" &&
          incomingRoute !== "deploy1");
      if (isTurnDeploy) {
        gs.risqueMirrorDeployRoute = "turn";
        if (typeof window.risqueSetMirrorDeployRoute === "function") {
          window.risqueSetMirrorDeployRoute("turn");
        }
      } else {
        gs.risqueMirrorDeployRoute = "setup";
        if (typeof window.risqueSetMirrorDeployRoute === "function") {
          window.risqueSetMirrorDeployRoute("setup");
        }
      }
      if (turnAdvance) {
        artemisForceControlSlotFromCurrentPlayer(gs);
        if (typeof window.risqueArtemisStampControlSlot === "function") {
          window.risqueArtemisStampControlSlot(gs);
        }
      }
    }
    if (String(gs.phase || "") === "cardplay") {
      if (typeof window.risqueArtemisStampControlSlot === "function") {
        window.risqueArtemisStampControlSlot(gs);
      }
    }
    var gsPhFinalize = String(gs.phase || "");
    if (gsPhFinalize !== "income" && gsPhFinalize !== "con-income") {
      try {
        delete gs.risquePublicIncomeBreakdown;
        delete gs.risquePublicIncomeGateToken;
      } catch (eClrIncFin) {
        /* ignore */
      }
    }
    artemisPreserveHostAttackSpectatorLive(gs);
    if (
      String(gs.phase || "") === "attack" &&
      window.risqueArtemisHost &&
      !window.risqueArtemisNetClient &&
      typeof window.risqueArtemisShouldHostMountAttack === "function" &&
      !window.risqueArtemisShouldHostMountAttack(gs)
    ) {
      try {
        delete gs.risqueTransferPulse;
      } catch (eClrHostPulse) {
        /* ignore */
      }
    }
    if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    } else {
      window.gameState = gs;
    }
    if (
      String(gs.phase || "") === "deploy" &&
      typeof window.risqueArtemisApplyHostDeploySpectator === "function"
    ) {
      try {
        window.risqueArtemisApplyHostDeploySpectator(gs);
      } catch (eHostDep) {
        /* ignore */
      }
    } else if (
      String(gs.phase || "") === "reinforce" &&
      typeof window.risqueArtemisApplyHostReinforceSpectator === "function"
    ) {
      try {
        window.risqueArtemisApplyHostReinforceSpectator(gs);
      } catch (eHostRf) {
        /* ignore */
      }
    } else if (
      (String(gs.phase || "") === "receivecard" || String(gs.phase || "") === "getcard") &&
      typeof window.risqueArtemisApplyHostReceiveCardSpectator === "function"
    ) {
      try {
        window.risqueArtemisApplyHostReceiveCardSpectator(gs);
      } catch (eHostRc) {
        /* ignore */
      }
    } else if (
      String(gs.phase || "") === "deploy" &&
      typeof window.risqueArtemisApplyDeploySpectatorMap === "function"
    ) {
      try {
        window.risqueArtemisApplyDeploySpectatorMap(gs);
      } catch (eDepMap) {
        /* ignore */
      }
    }
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      /* ignore */
    }
    if (typeof window.risqueMirrorPushGameState === "function") {
      try {
        var phaseFinish =
          String(gs.phase || "") === "playerSelect" &&
          String(gs.risquePublicUiSelectKind || "") === "cardPlay";
        var cardplayToIncome =
          (prevHostPh === "cardplay" || prevHostPh === "con-cardplay") &&
          (String(gs.phase || "") === "income" || String(gs.phase || "") === "con-income");
        var incomeToDeploy =
          (prevHostPh === "income" || prevHostPh === "con-income") &&
          String(gs.phase || "") === "deploy";
        var deployToAttack =
          (prevHostPh === "deploy" || prevHostPh === "con-deploy") &&
          String(gs.phase || "") === "attack";
        var hostHadIncomeBreakdown = !!(
          window.gameState &&
          window.gameState.risquePublicIncomeBreakdown &&
          window.gameState.risquePublicIncomeBreakdown.total != null
        );
        var incomeBreakdownCatchUp =
          (String(gs.phase || "") === "income" || String(gs.phase || "") === "con-income") &&
          gs.risquePublicIncomeBreakdown &&
          gs.risquePublicIncomeBreakdown.total != null &&
          !hostHadIncomeBreakdown;
        if (
          (turnAdvance ||
            phaseFinish ||
            cardplayToIncome ||
            incomeToDeploy ||
            deployToAttack ||
            incomeBreakdownCatchUp) &&
          typeof window.risqueFlushMirrorPush === "function"
        ) {
          if (turnAdvance && String(gs.phase || "") === "deploy") {
            window.__risqueArtemisForceDeployMirrorPush = true;
          }
          try {
            window.risqueFlushMirrorPush();
          } finally {
            if (turnAdvance && String(gs.phase || "") === "deploy") {
              window.__risqueArtemisForceDeployMirrorPush = false;
            }
          }
        } else if (
          !turnAdvance &&
          (String(gs.phase || "") === "attack" || String(gs.phase || "") === "reinforce") &&
          typeof window.risqueFlushMirrorPush === "function"
        ) {
          window.risqueFlushMirrorPush();
        } else if (
          String(gs.phase || "") === "deploy" &&
          !turnAdvance &&
          typeof window.risqueScheduleMirrorPush === "function"
        ) {
          window.risqueScheduleMirrorPush();
        } else {
          window.risqueMirrorPushGameState();
        }
      } catch (ePush) {
        /* ignore */
      }
    }
    if (typeof window.risqueArtemisSyncFromState === "function") {
      window.risqueArtemisSyncFromState(gs);
    }
    if (
      String(gs.phase || "") === "attack" &&
      window.risqueArtemisHost &&
      typeof window.risqueArtemisShouldHostMountAttack === "function" &&
      !window.risqueArtemisShouldHostMountAttack(gs) &&
      typeof window.risqueArtemisApplyHostAttackSpectator === "function"
    ) {
      try {
        window.risqueArtemisApplyHostAttackSpectator(gs);
      } catch (eHostAtkFin) {
        /* ignore */
      }
      if (typeof window.risqueArtemisScheduleHostAttackDicePaint === "function") {
        try {
          window.risqueArtemisScheduleHostAttackDicePaint(gs);
        } catch (eHostDiceFin) {
          /* ignore */
        }
      } else if (typeof window.risqueArtemisDriveHostAttackDice === "function") {
        try {
          window.risqueArtemisDriveHostAttackDice(gs);
        } catch (eHostDiceDrvFin) {
          /* ignore */
        }
      }
    }
    artemisHostForceVisualSync(gs);
    window.__risqueArtemisPrevFollowPlayer = prevHostPlayer;
    artemisHostFollowGameplayPhaseFromMirror(gs, prevHostPh);
    if (
      String(gs.phase || "") === "attack" &&
      typeof window.risqueArtemisSyncPhaseControlVoice === "function"
    ) {
      try {
        window.risqueArtemisSyncPhaseControlVoice(gs);
      } catch (eHostAtkVoice) {
        /* ignore */
      }
    }
    if (String(gs.phase || "") === "deploy") {
      if (typeof window.risqueArtemisClearIncomeVoiceDom === "function") {
        try {
          window.risqueArtemisClearIncomeVoiceDom();
        } catch (eClrIncHost) {
          /* ignore */
        }
      }
      if (
        window.risqueArtemisHost &&
        typeof window.risqueArtemisRefreshDeploySpectator === "function"
      ) {
        try {
          window.risqueArtemisRefreshDeploySpectator(gs);
        } catch (eHostDepSpec) {
          /* ignore */
        }
      }
    }
    if (
      String(gs.phase || "") === "attack" &&
      window.risqueArtemisHost &&
      typeof window.risqueArtemisShouldHostMountAttack === "function" &&
      !window.risqueArtemisShouldHostMountAttack(gs) &&
      typeof window.risqueArtemisSyncPortableAttack === "function"
    ) {
      try {
        window.risqueArtemisSyncPortableAttack(gs);
      } catch (eHostAtkSpec) {
        /* ignore */
      }
    }
    if (
      String(gs.phase || "") === "playerSelect" &&
      artemisShouldFinishSetupDeployFromMirror(gs)
    ) {
      artemisNavigateAfterSetupDeployFinish();
    }
  }

  function applyHostDeployConfirm(msg) {
    if (mode !== "host" || !msg) return;
    var senderSlot = Number(msg.slot) || 0;
    var confirmSeq = Number(msg.controlSeq) || 0;
    var hostGs = window.gameState;
    if (!hostGs || String(hostGs.phase || "") !== "deploy") {
      try {
        console.warn("[ARTEMIS bus] reject deploy_confirm — host not in deploy");
      } catch (ePh) {
        /* ignore */
      }
      return;
    }
    if (String(msg.route || "setup") !== "setup") {
      try {
        console.warn("[ARTEMIS bus] reject deploy_confirm — unsupported route " + String(msg.route));
      } catch (eRoute) {
        /* ignore */
      }
      return;
    }
    var hostSeq = deployControlSeq(hostGs);
    try {
      console.info(
        "[ARTEMIS bus] deploy_confirm from P" +
          senderSlot +
          " seq=" +
          confirmSeq +
          " hostSeq=" +
          hostSeq
      );
    } catch (eRecv) {
      /* ignore */
    }
    if (typeof window.risqueArtemisDiagDeployConfirmRecv === "function") {
      window.risqueArtemisDiagDeployConfirmRecv({
        slot: senderSlot,
        controlSeq: confirmSeq,
        nextPlayer: msg.nextPlayer
      });
    }
    if (hostSeq <= 0 || confirmSeq !== hostSeq) {
      var finisherBank = msg.finisher ? Number(msg.finisher.bankValue) : NaN;
      if (
        confirmSeq > 0 &&
        hostSeq > 0 &&
        confirmSeq !== hostSeq &&
        hostSenderIsActiveDeployer(hostGs, senderSlot) &&
        finisherBank === 0
      ) {
        try {
          console.warn(
            "[ARTEMIS bus] deploy_confirm seq reconcile P" +
              senderSlot +
              " host=" +
              hostSeq +
              " got=" +
              confirmSeq
          );
        } catch (eRecon) {
          /* ignore */
        }
        hostGs.risqueArtemisControlSeq = confirmSeq;
        hostSeq = confirmSeq;
      } else {
        try {
          console.warn(
            "[ARTEMIS bus] reject deploy_confirm stale seq from P" +
              senderSlot +
              " got=" +
              confirmSeq +
              " host=" +
              hostSeq
          );
        } catch (eStale) {
          /* ignore */
        }
        if (typeof window.risqueArtemisDiagDeployReject === "function") {
          window.risqueArtemisDiagDeployReject({
            slot: senderSlot,
            controlSeq: confirmSeq,
            reason: "stale_seq host=" + hostSeq + " got=" + confirmSeq
          });
        }
        return;
      }
    }
    var finisher = msg.finisher;
    var patchGs = {
      phase: "deploy",
      risqueDeployMirrorDraft: msg.mirrorDraft || null,
      players: finisher
        ? [
            {
              name: finisher.name,
              bankValue: finisher.bankValue,
              troopsTotal: finisher.troopsTotal,
              territories: finisher.territories
            }
          ]
        : []
    };
    artemisMergeClientSetupDeployIntoHost(hostGs, patchGs, senderSlot);
    var clientHint =
      msg.nextPlayer
        ? {
            nextPlayer: msg.nextPlayer,
            nextSeq: Number(msg.nextSeq) || 0
          }
        : null;
    var trustFinisher =
      !!(msg.finisher && Number(msg.finisher.bankValue) === 0);
    if (!artemisHostAdvanceSetupDeploy(hostGs, senderSlot, clientHint, { trustFinisherBank: trustFinisher })) {
      try {
        console.warn("[ARTEMIS bus] reject setup deploy_confirm from P" + senderSlot);
      } catch (eRejBus) {
        /* ignore */
      }
      if (typeof window.risqueArtemisDiagDeployReject === "function") {
        window.risqueArtemisDiagDeployReject({
          slot: senderSlot,
          controlSeq: confirmSeq,
          reason: "host_advance_failed"
        });
      }
      return;
    }
    if (typeof window.risqueArtemisDiagDeployAdvance === "function") {
      window.risqueArtemisDiagDeployAdvance({
        slot: senderSlot,
        controlSeq: Number(hostGs.risqueArtemisControlSeq) || 0,
        nextPlayer: hostGs.currentPlayer
      });
    }
    finalizeHostClientState(hostGs, true);
  }

  function applyHostDeployFinish(msg) {
    if (mode !== "host" || !msg) return;
    var senderSlot = Number(msg.slot) || 0;
    var finishSeq = Number(msg.controlSeq) || 0;
    var hostGs = window.gameState;
    if (!hostGs || String(hostGs.phase || "") !== "deploy") {
      try {
        console.warn("[ARTEMIS bus] reject deploy_finish — host not in deploy");
      } catch (ePh) {
        /* ignore */
      }
      return;
    }
    if (String(msg.route || "setup") !== "setup") {
      try {
        console.warn("[ARTEMIS bus] reject deploy_finish — unsupported route " + String(msg.route));
      } catch (eRoute) {
        /* ignore */
      }
      return;
    }
    var hostSeq = deployControlSeq(hostGs);
    try {
      console.info(
        "[ARTEMIS bus] deploy_finish from P" +
          senderSlot +
          " seq=" +
          finishSeq +
          " hostSeq=" +
          hostSeq
      );
    } catch (eRecv) {
      /* ignore */
    }
    if (typeof window.risqueArtemisDiagDeployFinishRecv === "function") {
      window.risqueArtemisDiagDeployFinishRecv({
        slot: senderSlot,
        controlSeq: finishSeq
      });
    }
    if (hostSeq <= 0 || finishSeq !== hostSeq) {
      try {
        console.warn(
          "[ARTEMIS bus] reject deploy_finish stale seq from P" +
            senderSlot +
            " got=" +
            finishSeq +
            " host=" +
            hostSeq
        );
      } catch (eStale) {
        /* ignore */
      }
      if (typeof window.risqueArtemisDiagDeployFinishReject === "function") {
        window.risqueArtemisDiagDeployFinishReject({
          slot: senderSlot,
          controlSeq: finishSeq,
          reason: "stale_seq host=" + hostSeq + " got=" + finishSeq
        });
      }
      return;
    }
    var finisher = msg.finisher;
    var patchGs = {
      phase: "deploy",
      risqueDeployMirrorDraft: msg.mirrorDraft || null,
      players: finisher
        ? [
            {
              name: finisher.name,
              bankValue: finisher.bankValue,
              troopsTotal: finisher.troopsTotal,
              territories: finisher.territories
            }
          ]
        : []
    };
    artemisMergeClientSetupDeployIntoHost(hostGs, patchGs, senderSlot);
    if (!artemisHostFinishSetupDeploy(hostGs, senderSlot)) {
      try {
        console.warn("[ARTEMIS bus] reject setup deploy_finish from P" + senderSlot);
      } catch (eRejBus) {
        /* ignore */
      }
      if (typeof window.risqueArtemisDiagDeployFinishReject === "function") {
        window.risqueArtemisDiagDeployFinishReject({
          slot: senderSlot,
          controlSeq: finishSeq,
          reason: "host_finish_failed"
        });
      }
      return;
    }
    if (typeof window.risqueArtemisDiagDeployFinishOk === "function") {
      window.risqueArtemisDiagDeployFinishOk({
        slot: senderSlot,
        controlSeq: finishSeq
      });
    }
    artemisHostHideLoginChromeForSetup();
    finalizeHostClientState(hostGs, false);
    if (String(hostGs.phase || "") === "playerSelect") {
      artemisNavigateAfterSetupDeployFinish();
    }
  }

  function applyHostCycleProbeAdvance(msg) {
    if (mode !== "host" || !msg) return;
    var gs = window.gameState;
    if (!gs || !gs.artemisCycleProbe) return;
    var senderSlot = Number(msg.slot) || 0;
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (senderSlot < 1 || senderSlot !== ctrl) return;
    var expectStep = Number(gs.artemisCycleProbeStep) || 0;
    if (Number(msg.step) !== expectStep) return;
    if (typeof window.risqueArtemisCycleProbeHostAdvance === "function") {
      window.risqueArtemisCycleProbeHostAdvance(1);
    }
  }

  function applyHostClientState(msg) {
    if (mode !== "host" || !msg || !msg.state) return;
    var gs = msg.state;
    var senderSlot = Number(msg.slot) || 0;
    if (hostRejectRegressivePlayerState(gs, senderSlot)) {
      try {
        console.warn(
          "[ARTEMIS] reject regressive player_state from P" +
            senderSlot +
            " incoming=" +
            String(gs.phase || "?") +
            " host=" +
            String((window.gameState && window.gameState.phase) || "?")
        );
      } catch (eRejReg) {
        /* ignore */
      }
      return;
    }
    var turnAdvance = false;
    if (gs.risqueArtemisSetupDeployConfirm && String(gs.phase || "") === "deploy") {
      var clientHint = null;
      if (gs.risqueArtemisSetupDeployNextPlayer) {
        clientHint = {
          nextPlayer: gs.risqueArtemisSetupDeployNextPlayer,
          nextSeq: Number(gs.risqueArtemisSetupDeployNextSeq) || 0
        };
      }
      delete gs.risqueArtemisSetupDeployConfirm;
      delete gs.risqueArtemisSetupDeployNextPlayer;
      delete gs.risqueArtemisSetupDeployNextSeq;
      delete gs.artemisDeployTurnAdvance;
      var hostGsConfirm = window.gameState;
      if (!hostGsConfirm) return;
      artemisMergeClientSetupDeployIntoHost(hostGsConfirm, gs, senderSlot);
      if (!artemisHostAdvanceSetupDeploy(hostGsConfirm, senderSlot, clientHint)) {
        try {
          console.warn("[ARTEMIS] reject setup deploy CONFIRM from P" + senderSlot);
        } catch (eRejC) {
          /* ignore */
        }
        return;
      }
      gs = hostGsConfirm;
      turnAdvance = true;
    }
    if (String(gs.phase || "") === "deploy") {
      if (
        typeof window.risqueArtemisHostHasSetupDeployWinnerLock !== "function" ||
        !window.risqueArtemisHostHasSetupDeployWinnerLock(window.gameState || gs)
      ) {
        artemisForceControlSlotFromCurrentPlayer(gs);
      }
    }
    if (!turnAdvance) {
      turnAdvance =
        isDeployTurnAdvanceFromSender(gs, senderSlot) || isImplicitDeployTurnAdvance(gs, senderSlot);
    }
    var hostPhaseEarly = String((window.gameState && window.gameState.phase) || "");
    if (
      !turnAdvance &&
      hostPhaseEarly === "cardplay" &&
      String(gs.phase || "") === "cardplay" &&
      artemisPresetCardplayActive(window.gameState)
    ) {
      var hostCtrl = Number(window.gameState && window.gameState.artemisControlSlot) || 0;
      if (hostCtrl >= 1 && senderSlot >= 1 && senderSlot !== hostCtrl) {
        try {
          console.warn(
            "[ARTEMIS] reject preset cardplay player_state from P" + senderSlot + " (active P" + hostCtrl + ")"
          );
        } catch (eRejPreset) {
          /* ignore */
        }
        return;
      }
    }
    if (
      !turnAdvance &&
      hostPhaseEarly === "cardplay" &&
      String(gs.phase || "") === "cardplay"
    ) {
      var curNm = window.gameState && window.gameState.currentPlayer;
      var hostCards = 0;
      var inCards = 0;
      if (curNm) {
        var hp = (window.gameState.players || []).find(function (pl) {
          return normDeployName(pl && pl.name) === normDeployName(curNm);
        });
        var ip = (gs.players || []).find(function (pl) {
          return normDeployName(pl && pl.name) === normDeployName(curNm);
        });
        hostCards = Math.max(
          Number(hp && hp.cardCount) || 0,
          hp && Array.isArray(hp.cards) ? hp.cards.length : 0
        );
        inCards = Math.max(
          Number(ip && ip.cardCount) || 0,
          ip && Array.isArray(ip.cards) ? ip.cards.length : 0
        );
      }
      if (
        inCards === 0 &&
        (hostCards > 0 || artemisPresetCardplayActive(window.gameState)) &&
        Number(senderSlot) !== Number(window.gameState && window.gameState.artemisControlSlot)
      ) {
        try {
          console.warn(
            "[ARTEMIS] reject player_state wiping cardplay hand from P" + senderSlot
          );
        } catch (eRejCp) {
          /* ignore */
        }
        return;
      }
    }
    if (
      !turnAdvance &&
      hostPhaseEarly === "cardplay" &&
      String(gs.phase || "") === "income"
    ) {
      if (!hostSenderIsActiveDeployer(window.gameState, senderSlot)) {
        try {
          console.warn(
            "[ARTEMIS] reject cardplay→income from P" + senderSlot + " — not active player"
          );
        } catch (eRejCpInc) {
          /* ignore */
        }
        return;
      }
      if (typeof window.risqueArtemisDiag === "function") {
        window.risqueArtemisDiag("cardplay_host_income_advance", "P" + senderSlot + " cardplay → income", {
          currentPlayer: gs.currentPlayer,
          controlSlot: gs.artemisControlSlot
        });
      }
    }
    if (
      !turnAdvance &&
      (hostPhaseEarly === "income" || hostPhaseEarly === "con-income") &&
      String(gs.phase || "") === "deploy"
    ) {
      if (!hostSenderIsActiveDeployer(window.gameState, senderSlot)) {
        try {
          console.warn(
            "[ARTEMIS] reject income→deploy from P" + senderSlot + " — not active player"
          );
        } catch (eRejIncDep) {
          /* ignore */
        }
        return;
      }
      if (typeof window.risqueArtemisDiag === "function") {
        window.risqueArtemisDiag("income_host_deploy_advance", "P" + senderSlot + " income → deploy", {
          currentPlayer: gs.currentPlayer,
          controlSlot: gs.artemisControlSlot,
          bankValue:
            gs.players &&
            gs.players.find(function (p) {
              return p && String(p.name || "") === String(gs.currentPlayer || "");
            })
              ? gs.players.find(function (p) {
                  return p && String(p.name || "") === String(gs.currentPlayer || "");
                }).bankValue
              : null
        });
      }
    }
    if (
      !turnAdvance &&
      (hostPhaseEarly === "deploy" || hostPhaseEarly === "con-deploy") &&
      String(gs.phase || "") === "attack"
    ) {
      if (!hostSenderIsActiveDeployer(window.gameState, senderSlot)) {
        try {
          console.warn(
            "[ARTEMIS] reject deploy→attack from P" + senderSlot + " — not active player"
          );
        } catch (eRejDepAtk) {
          /* ignore */
        }
        return;
      }
      if (typeof window.risqueArtemisDiag === "function") {
        window.risqueArtemisDiag("deploy_host_attack_advance", "P" + senderSlot + " deploy → attack", {
          currentPlayer: gs.currentPlayer,
          controlSlot: gs.artemisControlSlot
        });
      }
    }
    if (
      !turnAdvance &&
      hostPhaseEarly === "deploy" &&
      String(gs.phase || "") === "playerSelect"
    ) {
      try {
        console.warn(
          "[ARTEMIS] reject client playerSelect skip from P" +
            senderSlot +
            " — use deploy_finish bus"
        );
      } catch (eRejFin) {
        /* ignore */
      }
      return;
    }
    if (
      !turnAdvance &&
      !artemisHostAcceptPhaseAdvance(hostPhaseEarly, String(gs.phase || ""), senderSlot) &&
      hostPhaseEarly &&
      hostPhaseEarly !== "deploy" &&
      hostPhaseEarly !== "con-deploy" &&
      String(gs.phase || "") === "deploy"
    ) {
      try {
        console.warn(
          "[ARTEMIS] reject stale deploy player_state from P" +
            senderSlot +
            " — host phase is " +
            hostPhaseEarly
        );
      } catch (eRejPh) {
        /* ignore */
      }
      return;
    }
    if (hostRejectStaleDeployState(gs, senderSlot)) {
      try {
        console.warn(
          "[ARTEMIS] reject stale player_state from P" +
            senderSlot +
            " seq=" +
            deployControlSeq(gs) +
            " hostSeq=" +
            deployControlSeq(window.gameState)
        );
      } catch (eRej) {
        /* ignore */
      }
      return;
    }
    var ctrlSlot = Number(gs.artemisControlSlot) || 0;
    var hostGsLive = window.gameState;
    if (
      String(gs.phase || "") === "deploy" &&
      senderSlot >= 1 &&
      !turnAdvance &&
      hostGsLive &&
      !hostSenderIsActiveDeployer(hostGsLive, senderSlot)
    ) {
      try {
        console.warn(
          "[ARTEMIS] reject player_state from P" +
            senderSlot +
            " — active P" +
            (Number(hostGsLive.artemisControlSlot) || ctrlSlot)
        );
      } catch (eRej) {
        /* ignore */
      }
      return;
    }
    finalizeHostClientState(gs, turnAdvance);
  }

  function handleLoginProfiles(incoming) {
    if (incoming) {
      try {
        sessionStorage.setItem("risqueArtemisLoginProfiles", JSON.stringify(incoming));
      } catch (eProf) {
        /* ignore */
      }
      var roster = [];
      [1, 2, 3].forEach(function (slot) {
        var prof = incoming[String(slot)] || incoming[slot];
        if (prof && prof.name && prof.color) {
          roster.push({
            slot: slot,
            name: String(prof.name).trim().toUpperCase(),
            color: String(prof.color).trim().toLowerCase()
          });
        }
      });
      if (roster.length) {
        try {
          sessionStorage.setItem("risqueArtemisRoster", JSON.stringify(roster));
        } catch (eRos) {
          /* ignore */
        }
      }
      if (mode === "client" && playerSlot) {
        var mine = incoming[String(playerSlot)] || incoming[playerSlot];
        if (mine && mine.name) {
          window.risqueArtemisPlayerName = String(mine.name).trim().toUpperCase();
          playerName = window.risqueArtemisPlayerName;
          try {
            sessionStorage.setItem("risqueArtemisPlayerName", window.risqueArtemisPlayerName);
            persistArtemisSession();
          } catch (eNm) {
            /* ignore */
          }
        }
      }
    }
    if (typeof window.risqueArtemisOnLoginProfiles === "function") {
      window.risqueArtemisOnLoginProfiles(incoming);
    }
  }

  function renderLobbyState(lobby) {
    if (!lobby || window.risqueArtemisLobbyStarted) return;
    if (typeof window.risqueArtemisLobbyRender === "function") {
      window.risqueArtemisLobbyRender(lobby);
    }
    if (artemisFastBootEnabled()) {
      tryHostAutoStartLobby(lobby);
    }
    if (lobby.status === "started") {
      onLobbyStarted();
    }
  }

  function artemisClearDeployHandoffFlagsForMirror(mirrorGs) {
    if (!mirrorGs || String(mirrorGs.phase || "") !== "deploy") return;
    var appliedSeq = deployControlSeq(mirrorGs);
    var pendingHandoff = Number(window.risqueArtemisDeployHandoffPending) || 0;
    var mySlot = Number(window.risqueArtemisPlayerSlot) || 0;
    var ctrl = Number(mirrorGs.artemisControlSlot) || 0;
    if (typeof window.risqueArtemisActivePlayerSlot === "function" && !ctrl) {
      ctrl = Number(window.risqueArtemisActivePlayerSlot(mirrorGs)) || 0;
    }
    if (typeof window.risqueArtemisResolveOwnerSlot === "function") {
      ctrl = Number(window.risqueArtemisResolveOwnerSlot(mirrorGs)) || ctrl;
    }
    var nameOwns =
      typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
      window.risqueArtemisClientNameMatchesCurrent(mirrorGs);
    if (pendingHandoff > 0 && appliedSeq >= pendingHandoff) {
      window.risqueArtemisDeployHandoffPending = 0;
      delete window.risqueArtemisDeployHandoffPlayer;
      if (nameOwns || (mySlot >= 1 && ctrl === mySlot)) {
        window.risqueArtemisDeployPushLocked = false;
      } else if (mySlot >= 1 && ctrl >= 1 && ctrl !== mySlot) {
        window.risqueArtemisDeployPushLocked = true;
      }
    } else if (nameOwns || (mySlot >= 1 && ctrl === mySlot && appliedSeq > 0)) {
      window.risqueArtemisDeployPushLocked = false;
      window.risqueArtemisDeployHandoffPending = 0;
    }
    if (appliedSeq > 0) {
      var rel = Number(window.risqueArtemisDeployRelinquishedSeq) || 0;
      if (appliedSeq >= rel && rel > 0 && mySlot >= 1 && ctrl === mySlot) {
        window.risqueArtemisDeployRelinquishedSeq = 0;
      }
    }
  }

  function artemisPurgeStalePendingMirrors(appliedState) {
    if (!appliedState || !pendingPublicStates.length) return;
    var appliedRank =
      typeof window.risqueArtemisForwardPhaseRank === "function"
        ? window.risqueArtemisForwardPhaseRank(appliedState.phase)
        : 0;
    if (appliedRank <= 0) return;
    pendingPublicStates = pendingPublicStates.filter(function (item) {
      var inRank =
        typeof window.risqueArtemisForwardPhaseRank === "function"
          ? window.risqueArtemisForwardPhaseRank(item.state && item.state.phase)
          : 0;
      return !(inRank > 0 && inRank < appliedRank);
    });
  }

  function artemisCoalescePendingPlayerSelectMirrors() {
    if (pendingPublicStates.length < 2) return;
    var merged = [];
    for (var i = 0; i < pendingPublicStates.length; ) {
      var item = pendingPublicStates[i];
      var ph = String((item.state && item.state.phase) || "");
      if (ph !== "playerSelect") {
        merged.push(item);
        i += 1;
        continue;
      }
      var sk = artemisIncomingPlayerSelectKind(item.state);
      var latest = item;
      var j = i + 1;
      while (j < pendingPublicStates.length) {
        var next = pendingPublicStates[j];
        if (String((next.state && next.state.phase) || "") !== "playerSelect") break;
        if (artemisIncomingPlayerSelectKind(next.state) !== sk) break;
        latest = next;
        j += 1;
      }
      merged.push(latest);
      i = j;
    }
    pendingPublicStates = merged;
  }

  function artemisPrepClientPlayerSelectMirror(state, livePhBefore) {
    window.risqueArtemisDeployHandoffPending = 0;
    window.risqueArtemisDeployPushLocked = false;
    window.risqueArtemisDeployRelinquishedSeq = 0;
    window.risqueArtemisAwaitSetupDeployFinish = false;
    try {
      delete window.risqueArtemisDeployHandoffPlayer;
    } catch (eClrHp) {
      /* ignore */
    }
    if (mode !== "client" || !state) return;
    var releasePsChrome =
      livePhBefore === "deploy" ||
      livePhBefore === "deploy1" ||
      livePhBefore === "deploy2" ||
      livePhBefore === "con-deploy" ||
      (typeof window.risqueArtemisClientSetupDeployChromeActive === "function" &&
        window.risqueArtemisClientSetupDeployChromeActive());
    if (releasePsChrome) {
      artemisClientReleaseSetupDeployChrome(state);
    }
  }

  function flushPendingPublicStates() {
    if (mode !== "client") return;
    if (!window.risqueArtemisLobbyStarted) return;
    if (typeof window.risquePublicMirrorGameState !== "function") return;
    artemisCoalescePendingPlayerSelectMirrors();
    var flushHighestRank = { value: clientLivePhaseRank() };
    while (pendingPublicStates.length) {
      var item = pendingPublicStates.shift();
      if (item.seq <= lastAppliedSeq) continue;
      lastAppliedSeq = item.seq;
      try {
        artemisStampMirrorSeqFromWs(item);
        if (artemisClientRejectStalePlayerSelectMirror(item.state)) {
          if (typeof window.risqueArtemisDiagCardplayOrderReject === "function") {
            window.risqueArtemisDiagCardplayOrderReject(
              item.state,
              window.gameState ? String(window.gameState.phase || "") : ""
            );
          }
          try {
            console.warn(
              "[ARTEMIS] skip stale playerSelect mirror wsSeq=" +
                item.seq +
                " live=" +
                String((window.gameState && window.gameState.phase) || "?")
            );
          } catch (eSkipPs) {
            /* ignore */
          }
          continue;
        }
        if (
          typeof window.risqueArtemisShouldIgnoreStalePhaseSync === "function" &&
          window.risqueArtemisShouldIgnoreStalePhaseSync(item.state)
        ) {
          continue;
        }
        if (
          String(item.state.phase || "") === "deploy" &&
          clientShouldIgnoreRegressiveDeployMirror(item.state, flushHighestRank.value)
        ) {
          try {
            console.info(
              "[ARTEMIS] skip active deploy mirror wsSeq=" +
                item.seq +
                " ctlSeq=" +
                (Number(item.state.risqueArtemisControlSeq) || 0) +
                " up=" +
                String(item.state.currentPlayer) +
                " ctrl=" +
                (Number(item.state.artemisControlSlot) || 0)
            );
          } catch (eSkipActiveDep) {
            /* ignore */
          }
          continue;
        }
        window.__risqueArtemisApplyingDeployMirror = true;
        var clientLivePhBeforeMirror =
          window.gameState ? String(window.gameState.phase || "") : "";
        var clientLivePlayerBeforeMirror =
          window.gameState && window.gameState.currentPlayer != null
            ? window.gameState.currentPlayer
            : null;
        var mirrorApplied =
          typeof window.risquePublicMirrorGameState === "function" &&
          window.risquePublicMirrorGameState(item.state) === true;
        window.__risqueArtemisApplyingDeployMirror = false;
        if (mirrorApplied) {
          window.__risquePublicMirrorAppliedRaw = JSON.stringify(item.state);
          window.__risqueArtemisLastMirrorReject = null;
          if (typeof window.risqueArtemisRenderPhaseMismatchStrip === "function") {
            window.risqueArtemisRenderPhaseMismatchStrip();
          }
          if (typeof window.risqueArtemisReplaceShellGameState === "function") {
            window.risqueArtemisReplaceShellGameState(item.state);
          }
          artemisClientNoteForwardPhase(item.state, flushHighestRank);
          try {
            document.body.setAttribute("data-risque-phase", String(item.state.phase || ""));
          } catch (eBodyPh) {
            /* ignore */
          }
          var mirrorPhPersist = String(item.state.phase || "");
          if (
            mirrorPhPersist === "deploy" ||
            mirrorPhPersist === "income" ||
            mirrorPhPersist === "con-income" ||
            mirrorPhPersist === "cardplay" ||
            mirrorPhPersist === "con-cardplay" ||
            mirrorPhPersist === "attack" ||
            mirrorPhPersist === "reinforce" ||
            mirrorPhPersist === "receivecard" ||
            mirrorPhPersist === "getcard" ||
            mirrorPhPersist === "welcome" ||
            mirrorPhPersist === "playerSelect" ||
            mirrorPhPersist === "deal"
          ) {
            artemisClientPersistMirrorToLocalStorage(item.state);
          }
          if (
            mirrorPhPersist === "attack" ||
            mirrorPhPersist === "reinforce" ||
            mirrorPhPersist === "receivecard" ||
            mirrorPhPersist === "getcard" ||
            mirrorPhPersist === "cardplay" ||
            mirrorPhPersist === "con-cardplay" ||
            mirrorPhPersist === "deploy" ||
            mirrorPhPersist === "con-deploy" ||
            mirrorPhPersist === "income" ||
            mirrorPhPersist === "con-income"
          ) {
            artemisClientFollowGameplayPhaseFromMirrorSync(
              item.state,
              clientLivePhBeforeMirror,
              clientLivePlayerBeforeMirror
            );
          }
          if (
            mirrorPhPersist === "welcome" ||
            mirrorPhPersist === "playerSelect" ||
            mirrorPhPersist === "deal"
          ) {
            if (mirrorPhPersist === "playerSelect") {
              artemisPrepClientPlayerSelectMirror(item.state, clientLivePhBeforeMirror);
            }
            if (typeof window.risqueArtemisSyncSetupMirror === "function") {
              window.risqueArtemisSyncSetupMirror(item.state);
            }
          }
        }
        if (String(item.state.phase || "") === "deploy") {
          if (!mirrorApplied) {
            /* Stale deploy echo — do not remount spectator chrome without a real apply. */
          } else if (mirrorApplied) {
            artemisClearDeployHandoffFlagsForMirror(item.state);
            var incomeDeployHandoff =
              clientLivePhBeforeMirror === "income" || clientLivePhBeforeMirror === "con-income";
            if (
              typeof window.risqueArtemisResetDeployTurnSession === "function" &&
              (incomeDeployHandoff ||
                (typeof window.risqueArtemisDeployTurnSessionNeedsReset === "function" &&
                  window.risqueArtemisDeployTurnSessionNeedsReset(item.state)))
            ) {
              if (typeof window.risqueArtemisStampControlSlot === "function") {
                window.risqueArtemisStampControlSlot(item.state);
              }
              window.risqueArtemisResetDeployTurnSession(item.state);
            }
            if (
              typeof window.risqueArtemisStampDeployHandoffSyncMarkers === "function"
            ) {
              window.risqueArtemisStampDeployHandoffSyncMarkers(item.state);
            }
            try {
              console.info(
                "[ARTEMIS] apply deploy mirror wsSeq=" +
                  item.seq +
                  " ctlSeq=" +
                  (Number(item.state.risqueArtemisControlSeq) || 0) +
                  " up=" +
                  String(item.state.currentPlayer) +
                  " ctrl=" +
                  (Number(item.state.artemisControlSlot) || 0)
              );
            } catch (eDepLog) {
              /* ignore */
            }
            try {
              localStorage.setItem("gameState", JSON.stringify(item.state));
            } catch (eGs) {
              /* ignore */
            }
            artemisForceOutgoingDeployRelinquish(item.state);
            if (
              String(item.state.risqueMirrorDeployRoute || "") === "turn" ||
              String(item.state.risqueMirrorDeployRoute || "") === "deploy2"
            ) {
              if (typeof window.risqueSetMirrorDeployRoute === "function") {
                window.risqueSetMirrorDeployRoute("turn");
              }
            } else {
              artemisClientFollowSetupDeployFromMirror(item.state);
            }
          } else {
            try {
              console.warn(
                "[ARTEMIS] skip deploy mirror wsSeq=" +
                  item.seq +
                  " ctlSeq=" +
                  (Number(item.state.risqueArtemisControlSeq) || 0) +
                  " up=" +
                  String(item.state.currentPlayer) +
                  " ctrl=" +
                  (Number(item.state.artemisControlSlot) || 0)
              );
            } catch (eSkipDep) {
              /* ignore */
            }
          }
        }
        if (String(item.state.phase || "") === "playerSelect") {
          if (!mirrorApplied) {
            artemisPrepClientPlayerSelectMirror(item.state, clientLivePhBeforeMirror);
          }
          if (mirrorApplied) {
            if (mode !== "client") {
              if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
                window.risquePublicApplyVoiceAndLogMirror(item.state);
              }
            }
          } else if (
            mode === "client" &&
            artemisShouldFinishSetupDeployFromMirror(item.state)
          ) {
            artemisClientReleaseSetupDeployChrome(item.state);
            if (typeof window.risqueTeardownArtemisSetupDeploy === "function") {
              window.risqueTeardownArtemisSetupDeploy(true);
            } else if (typeof window.risqueArtemisUnmountPortableDeploy === "function") {
              window.risqueArtemisUnmountPortableDeploy();
            }
            window.risqueArtemisAwaitSetupDeployFinish = false;
            window.risqueDeploy1Active = false;
          } else if (artemisShouldFinishSetupDeployFromMirror(item.state)) {
            artemisNavigateAfterSetupDeployFinish();
          }
        }
        if (artemisClientShouldClearPlayerSelectArtifacts(item.state.phase)) {
          artemisClearPlayerSelectClientArtifacts();
        }
        if (typeof window.risqueArtemisSetupMilestone === "function") {
          var mPh = String(item.state.phase || "");
          if (mPh === "welcome") {
            window.risqueArtemisSetupMilestone("M1-welcome-mirror", "ws seq=" + item.seq);
          } else if (mPh === "playerSelect") {
            window.risqueArtemisSetupMilestone(
              "M2-firstCard-mirror",
              String(item.state.risquePublicUiSelectKind || item.state.selectionPhase || "")
            );
          } else if (mPh === "deal") {
            window.risqueArtemisSetupMilestone("M3-deal-mirror", "ws seq=" + item.seq);
          }
        }
        if (typeof window.risqueSyncMapRoundIndicatorFromState === "function") {
          window.risqueSyncMapRoundIndicatorFromState(item.state);
        }
        if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
          window.risqueWireArtemisHudTogglesOnce();
        }
        var ph = String(item.state.phase || "");
        if (ph !== "login") {
          if (typeof window.risqueArtemisHideLoginPanel === "function") {
            window.risqueArtemisHideLoginPanel();
          }
        }
        if (ph === "cardplay" || ph === "con-cardplay") {
          if (mirrorApplied) {
            artemisClientReleaseSetupDeployChrome(item.state);
            try {
              delete item.state.risquePublicPlayerSelectFlash;
            } catch (eCpFlash) {
              /* ignore */
            }
            if (artemisIsTurnWrapToCardplay(window.gameState, item.state)) {
              artemisPrepareGameplayPhaseFollowNav(item.state, window.gameState);
            }
          }
          artemisSanitizeCardplaySpectatorHandMirror(item.state);
          if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
            window.risqueArtemisReconcileClientPlayMode(item.state);
          }
          var mineCpMir =
            typeof window.risqueArtemisClientIsActivePlayer === "function" &&
            window.risqueArtemisClientIsActivePlayer(item.state);
          if (
            !mineCpMir &&
            typeof window.risqueArtemisReconcileCardplaySpectatorChrome === "function"
          ) {
            window.risqueArtemisReconcileCardplaySpectatorChrome(item.state);
          }
          if (typeof window.risqueArtemisEnsureClientCardplayHand === "function") {
            window.risqueArtemisEnsureClientCardplayHand(item.state);
          }
          if (typeof window.risqueArtemisSyncPortableCardplay === "function") {
            window.risqueArtemisSyncPortableCardplay(item.state);
          }
          if (mineCpMir && typeof window.risqueArtemisApplyCardplayHudLayout === "function") {
            window.risqueArtemisApplyCardplayHudLayout(item.state);
          }
          artemisClientFollowGameplayPhaseFromMirror(
            item.state,
            clientLivePhBeforeMirror,
            clientLivePlayerBeforeMirror
          );
        }
        if (ph === "attack" && mirrorApplied) {
          artemisClientReleaseSetupDeployChrome(item.state);
          try {
            delete item.state.risquePublicIncomeBreakdown;
          } catch (eAtkIncClr) {
            /* ignore */
          }
          if (typeof window.risqueArtemisUnmountPortableTurnDeploy === "function") {
            window.risqueArtemisUnmountPortableTurnDeploy();
          }
          if (typeof window.risqueArtemisUnmountPortableDeploy === "function") {
            window.risqueArtemisUnmountPortableDeploy();
          }
          artemisPurgeStalePendingMirrors(item.state);
          if (typeof window.risqueArtemisClearIncomeVoiceDom === "function") {
            window.risqueArtemisClearIncomeVoiceDom();
          }
          if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
            window.risqueArtemisReconcileClientPlayMode(item.state);
          }
          if (typeof window.risqueArtemisSyncPortableAttack === "function") {
            window.risqueArtemisSyncPortableAttack(item.state);
          }
          if (typeof window.risqueArtemisEnsureAttackInteractive === "function") {
            window.risqueArtemisEnsureAttackInteractive(item.state);
          }
          if (typeof window.risqueArtemisClearDeployMapOverlays === "function") {
            window.risqueArtemisClearDeployMapOverlays(item.state);
          }
          if (typeof window.risqueArtemisScheduleAttackMapRouting === "function") {
            window.risqueArtemisScheduleAttackMapRouting(item.state);
          } else if (typeof window.risqueArtemisEnsureAttackMapRouting === "function") {
            window.risqueArtemisEnsureAttackMapRouting(item.state);
          }
          if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
            window.risqueArtemisEnsureHudTogglesVisible();
          }
          if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
            window.risqueRuntimeHud.updateTurnBannerFromState(item.state);
          }
          if (typeof window.risqueArtemisSyncPhaseControlVoice === "function") {
            window.risqueArtemisSyncPhaseControlVoice(item.state);
          }
          if (typeof window.risquePublicApplyVoiceAndLogMirror === "function") {
            window.risquePublicApplyVoiceAndLogMirror(item.state);
          }
          if (typeof window.risquePublicApplyDiceAndBattleReadout === "function") {
            window.risquePublicApplyDiceAndBattleReadout(item.state);
          }
        }
        if (ph === "deploy" && mirrorApplied) {
          if (typeof window.risqueArtemisClearIncomeVoiceDom === "function") {
            window.risqueArtemisClearIncomeVoiceDom();
          }
          if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
            window.risqueRuntimeHud.updateTurnBannerFromState(item.state);
          }
          var mineDepMir =
            typeof window.risqueArtemisIsMyTurn === "function" &&
            window.risqueArtemisIsMyTurn(item.state);
          if (mineDepMir) {
            if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
              window.risqueArtemisReconcileClientPlayMode(item.state);
            }
            if (typeof window.risqueArtemisEnsureClientActivePlay === "function") {
              window.risqueArtemisEnsureClientActivePlay(item.state);
            }
            if (typeof window.risqueArtemisSyncPortableTurnDeploy === "function") {
              window.risqueArtemisSyncPortableTurnDeploy(item.state);
            }
            if (typeof window.risqueArtemisEnsureTurnDeployInteractive === "function") {
              window.risqueArtemisEnsureTurnDeployInteractive(item.state);
            }
          } else if (typeof window.risqueArtemisRefreshDeploySpectator === "function") {
            window.risqueArtemisRefreshDeploySpectator(item.state);
          }
          if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
            window.risqueArtemisSyncMyTurnClass(item.state);
          }
          if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
            window.risqueArtemisEnsureHudTogglesVisible();
          }
        }
        if (ph === "reinforce" && mirrorApplied) {
          artemisClientReleaseSetupDeployChrome(item.state);
          if (typeof window.risqueArtemisUnmountPortableTurnDeploy === "function") {
            window.risqueArtemisUnmountPortableTurnDeploy();
          }
          if (typeof window.risqueArtemisCancelAttackMapRouting === "function") {
            window.risqueArtemisCancelAttackMapRouting();
          }
          if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
            window.risqueArtemisReconcileClientPlayMode(item.state);
          }
          if (typeof window.risqueArtemisSyncPortableReinforce === "function") {
            window.risqueArtemisSyncPortableReinforce(item.state);
          }
          if (typeof window.risqueArtemisEnsureReinforceInteractive === "function") {
            window.risqueArtemisEnsureReinforceInteractive(item.state);
          }
          if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
            window.risqueArtemisEnsureHudTogglesVisible();
          }
        }
        if ((ph === "receivecard" || ph === "getcard") && mirrorApplied) {
          artemisClientReleaseSetupDeployChrome(item.state);
          if (typeof window.risqueArtemisUnmountPortableTurnDeploy === "function") {
            window.risqueArtemisUnmountPortableTurnDeploy();
          }
          if (typeof window.risqueArtemisCancelReinforceMapRouting === "function") {
            window.risqueArtemisCancelReinforceMapRouting();
          }
          if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
            window.risqueArtemisReconcileClientPlayMode(item.state);
          }
          if (
            typeof window.risquePublicEnsureReceiveCardPrivateHint === "function"
          ) {
            try {
              window.risquePublicEnsureReceiveCardPrivateHint(item.state);
            } catch (eRcHintMirPre) {
              /* ignore */
            }
          }
          if (typeof window.risqueArtemisSyncPortableReceiveCard === "function") {
            window.risqueArtemisSyncPortableReceiveCard(item.state);
          }
          if (typeof window.risqueArtemisEnsureHudTogglesVisible === "function") {
            window.risqueArtemisEnsureHudTogglesVisible();
          }
        }
        if (
          (ph === "receivecard" || ph === "getcard") &&
          typeof window.risquePublicEnsureReceiveCardPrivateHint === "function" &&
          !mirrorApplied
        ) {
          try {
            window.risquePublicEnsureReceiveCardPrivateHint(item.state);
          } catch (eRcHintMir) {
            /* ignore */
          }
        }
        if (ph === "income" || ph === "con-income") {
          if (mirrorApplied) {
            artemisClientReleaseSetupDeployChrome(item.state);
            try {
              delete item.state.risquePublicPlayerSelectFlash;
            } catch (eIncFlash) {
              /* ignore */
            }
          }
          if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
            window.risqueArtemisReconcileClientPlayMode(item.state);
          }
          if (typeof window.risqueArtemisSyncPortableIncome === "function") {
            window.risqueArtemisSyncPortableIncome(item.state);
          }
          if (typeof window.risqueArtemisEnsureIncomeInteractive === "function") {
            window.risqueArtemisEnsureIncomeInteractive(item.state);
          }
          if (
            item.state.risquePublicIncomeBreakdown &&
            typeof window.risqueHostApplyIncomeBreakdownVoice === "function"
          ) {
            window.risqueHostApplyIncomeBreakdownVoice(item.state);
          } else if (typeof window.risqueArtemisSyncPhaseControlVoice === "function") {
            window.risqueArtemisSyncPhaseControlVoice(item.state);
          }
          if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.updateTurnBannerFromState === "function") {
            window.risqueRuntimeHud.updateTurnBannerFromState(item.state);
          }
          artemisClientFollowGameplayPhaseFromMirror(
            item.state,
            clientLivePhBeforeMirror,
            clientLivePlayerBeforeMirror
          );
        }
      } catch (eApply) {
        logArtemis("apply failed: " + eApply);
      }
    }
    if (connected && lastAppliedSeq >= 0) {
      setTopStatus("ARTEMIS — synced with host", "ok");
    }
    notifySyncGateMirrorApplied();
  }

  function clientDeployControlsPresent() {
    var dock = document.getElementById("risque-artemis-deploy-dock");
    return (
      !!document.getElementById("deploy1-confirm") ||
      !!document.getElementById("confirm") ||
      !!document.getElementById("risque-artemis-portable-deploy") ||
      (dock && !dock.hidden && dock.childElementCount > 0)
    );
  }

  function applyPublicState(msg) {
    if (mode !== "client" || !msg || !msg.state) return;
    if (!window.risqueArtemisLobbyStarted) return;
    if (artemisClientRejectStalePlayerSelectMirror(msg.state)) {
      if (typeof window.risqueArtemisDiagCardplayOrderReject === "function") {
        window.risqueArtemisDiagCardplayOrderReject(
          msg.state,
          window.gameState ? String(window.gameState.phase || "") : ""
        );
      }
      try {
        console.warn(
          "[ARTEMIS] reject stale playerSelect mirror while live phase=" +
            String((window.gameState && window.gameState.phase) || "?")
        );
      } catch (eRejPs) {
        /* ignore */
      }
      return;
    }
    if (clientRejectStaleMirrorState(msg.state)) {
      clientNoteMirrorReject(msg.state, "stale_phase");
      try {
        var rj = msg.state;
        console.warn(
          "[ARTEMIS] reject mirror phase=" +
            String(rj && rj.phase) +
            " seq=" +
            (Number(rj && rj.risqueArtemisControlSeq) || 0) +
            " up=" +
            String(rj && rj.currentPlayer) +
            " ctrl=" +
            String(rj && rj.artemisControlSlot) +
            " live=" +
            String((window.gameState && window.gameState.phase) || "?")
        );
      } catch (eRejLog) {
        /* ignore */
      }
      return;
    }
    if (clientShouldIgnoreRegressiveDeployMirror(msg.state, Number(window.__risqueArtemisClientHighestPhaseRank) || 0)) {
      return;
    }
    if (clientShouldIgnoreActiveDeployMirror(msg.state)) {
      return;
    }
    if (clientShouldIgnoreStaleForwardPhaseDeployMirror(msg.state)) {
      return;
    }
    var mySlot = Number(window.risqueArtemisPlayerSlot) || 0;
    var msgCtrl = Number(msg.state.artemisControlSlot) || 0;
    /* Block host echo mirrors while this laptop owns setup/turn deploy. */
    if (
      !window.risqueArtemisDeployHandoffPending &&
      !window.risqueArtemisDeployPushLocked &&
      window.risqueArtemisClientPlaying &&
      msgCtrl >= 1 &&
      mySlot === msgCtrl &&
      String(msg.state.phase || "") === "deploy" &&
      !clientMirrorIsSetupDeployHandoff(window.gameState, msg.state)
    ) {
      return;
    }
    if (
      window.risqueArtemisClientPlaying &&
      window.risqueDeploy1Active &&
      !clientDeployControlsPresent()
    ) {
      window.risqueDeploy1Active = false;
    }
    var seq = Number(msg.seq) || 0;
    if (seq <= lastAppliedSeq) return;
    pendingPublicStates.push({ seq: seq, state: msg.state });
    flushPendingPublicStates();
  }

  function flushPendingClientOutbound() {
    while (pendingClientOutbound.length) {
      var item = pendingClientOutbound.shift();
      if (!sendJson(item)) {
        pendingClientOutbound.unshift(item);
        break;
      }
    }
  }

  function sendJson(obj) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (obj && obj.type === "public_state") {
        pendingMirrorPayloads.push(obj);
      } else if (obj && obj.type) {
        pendingClientOutbound.push(obj);
      }
      return false;
    }
    try {
      ws.send(JSON.stringify(obj));
      return true;
    } catch (eSend) {
      logArtemis("send failed: " + eSend);
      return false;
    }
  }

  window.risqueArtemisSend = sendJson;

  function flushPendingMirrorPayloads() {
    if (mode !== "host") return;
    if (!window.risqueArtemisLobbyStarted) return;
    while (pendingMirrorPayloads.length) {
      sendJson(pendingMirrorPayloads.shift());
    }
  }

  window.risqueArtemisOnMirrorPayload = function (mirrorPayload) {
    if (mode !== "host" || !mirrorPayload) return;
    if (!window.risqueArtemisLobbyStarted) return;
    var msg = { type: "public_state", state: mirrorPayload };
    if (!sendJson(msg)) {
      pendingMirrorPayloads.push(msg);
    }
  };

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connect();
    }, 2000);
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (mode === "client" && !playerSlot) {
      setTopStatus("ARTEMIS — add slot=2 or slot=3 to the URL", "err");
      return;
    }
    var url = wsUrl();
    logArtemis("connecting " + url);
    if (mode === "client") {
      setTopStatus("ARTEMIS — connecting to host…", "wait");
    } else {
      setTopStatus("ARTEMIS — connecting…", "wait");
    }
    try {
      ws = new WebSocket(url);
    } catch (eWs) {
      setTopStatus("ARTEMIS — WebSocket failed", "err");
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      connected = true;
      joined = false;
      sendJson({
        type: "join",
        role: mode,
        name: playerName,
        slot: playerSlot,
      });
      if (mode === "host" && window.risqueArtemisLobbyStarted) {
        flushPendingMirrorPayloads();
        setTopStatus("ARTEMIS host — broadcasting", "ok");
      } else if (mode === "client" && window.risqueArtemisLobbyStarted) {
        setTopStatus("ARTEMIS — waiting for host…", "wait");
      } else {
        setTopStatus("ARTEMIS — lobby", "wait");
      }
    };

    ws.onmessage = function (ev) {
      var msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch (eParse) {
        return;
      }
      if (!msg || !msg.type) return;

      if (typeof window.risqueArtemisHandleWsMessage === "function") {
        if (window.risqueArtemisHandleWsMessage(msg)) return;
      }

      if (msg.type === "client_cycle_probe_advance") {
        applyHostCycleProbeAdvance(msg);
        return;
      }
      if (msg.type === "client_state") {
        applyHostClientState(msg);
        return;
      }
      if (msg.type === "client_deploy_confirm") {
        applyHostDeployConfirm(msg);
        return;
      }
      if (msg.type === "client_deploy_finish") {
        applyHostDeployFinish(msg);
        return;
      }
      if (msg.type === "rig_setup") {
        applyRigSetupFromNetwork(msg);
        return;
      }
      if (msg.type === "login_profiles") {
        handleLoginProfiles(msg.profiles);
        return;
      }
      if (msg.type === "lobby_state") {
        renderLobbyState(msg.lobby);
        return;
      }
      if (msg.type === "lobby_started") {
        onLobbyStarted();
        flushPendingMirrorPayloads();
        flushPendingPublicStates();
        return;
      }
      if (msg.type === "deploy_live") {
        applyDeployLiveSpectator(msg);
        return;
      }
      if (msg.type === "attack_live") {
        applyAttackLiveSpectator(msg);
        return;
      }
      if (msg.type === "public_state") {
        applyPublicState(msg);
        return;
      }
      if (msg.type === "joined") {
        joined = true;
        window.risqueArtemisClientId = msg.clientId;
        if (msg.slot) {
          window.risqueArtemisPlayerSlot = msg.slot;
          playerSlot = msg.slot;
          persistArtemisSession();
        }
        logArtemis(
          "joined slot " + msg.slot + " as " + msg.name + " (" + msg.clientId + ")"
        );
        if (artemisFastBootEnabled()) {
          sendJson({ type: "lobby_ready", ready: true });
        }
        if (msg.lobbyStarted) {
          onLobbyStarted();
        }
        if (mode === "client" && msg.publicState && window.risqueArtemisLobbyStarted) {
          applyPublicState({ seq: msg.publicStateSeq || 0, state: msg.publicState });
        }
        if (
          mode === "host" &&
          window.risqueArtemisLobbyStarted &&
          typeof window.risqueMirrorPushGameState === "function"
        ) {
          try {
            window.risqueMirrorPushGameState();
          } catch (ePush2) {
            /* ignore */
          }
        }
        return;
      }
      if (msg.type === "error") {
        logArtemis("server error: " + (msg.message || msg.code || "unknown"));
        if (msg.code === "host_taken") {
          setTopStatus("ARTEMIS — another host already connected", "err");
        } else if (msg.code === "slot_taken") {
          setTopStatus("ARTEMIS — that player slot is taken", "err");
        } else if (msg.code === "bad_slot") {
          setTopStatus("ARTEMIS — invalid player slot in URL", "err");
        } else if (msg.code === "not_ready") {
          if (artemisFastBootEnabled() && mode === "host") {
            lobbyAutoStartSent = false;
          }
          setTopStatus("ARTEMIS — wait for all players to ready up", "err");
        } else if (msg.code === "color_taken" || msg.code === "name_taken" || msg.code === "bad_profile") {
          if (artemisFastBootEnabled()) {
            window.risqueArtemisFastBootLoginSent = false;
          }
          if (typeof window.risqueArtemisLoginShowError === "function") {
            window.risqueArtemisLoginShowError(msg.message || "Could not save profile");
          }
        }
      }
    };

    ws.onclose = function () {
      connected = false;
      joined = false;
      setTopStatus("ARTEMIS — disconnected; retrying…", "err");
      scheduleReconnect();
    };

    ws.onerror = function () {
      connected = false;
    };
  }

  if (mode === "client") {
    var applyPoll = setInterval(function () {
      flushPendingPublicStates();
      if (window.risqueArtemisLobbyStarted && lastAppliedSeq >= 0) {
        clearInterval(applyPoll);
      }
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", connect);
  } else {
    connect();
  }
})();
