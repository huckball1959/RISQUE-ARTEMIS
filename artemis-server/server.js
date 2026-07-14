"use strict";

/**
 * ARTEMIS LAN host server (M2).
 * - Serves the RISQUE-ARTEMIS game files over HTTP
 * - WebSocket at /ws: lobby slots + host-authoritative public_state sync
 *
 * Env: ARTEMIS_PORT (default 5700), ARTEMIS_BIND (default 0.0.0.0)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { WebSocketServer } = require("ws");
const { createArtemisDiag } = require("./artemis-diag");
const { handleLaunchers, launcherManifest } = require("./artemis-launchers");

const PORT = parseInt(process.env.ARTEMIS_PORT || "5700", 10);
const BIND = process.env.ARTEMIS_BIND || "0.0.0.0";
const GAME_ROOT = path.resolve(__dirname, "..");
const PROTOCOL_VERSION = 2;
const PLAYER_SLOTS = [1, 2, 3, 4, 5, 6];
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const MAX_STATE_BYTES = 4 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".bat": "application/octet-stream",
  ".woff2": "font/woff2",
};

/** @type {Map<string, import("ws").WebSocket & { artemisRole?: string, playerSlot?: number }>} */
const clients = new Map();
/** @type {Map<string, { id: string, name: string, role: string, slot: number, joinedAt: number }>} */
const roster = new Map();

const session = {
  hostClientId: null,
  publicState: null,
  publicStateSeq: 0,
  deployLiveSeq: 0,
  attackLiveSeq: 0,
  lobby: {
    status: "waiting",
    /** How many seats must connect before lobby can start (2–6). Host sets via lobby_set_expected. */
    expectedPlayers: 3,
    /** quick = host roster/checkboxes; open = each laptop types name+color */
    lobbyMode: "quick",
    /** @type {{ slot: number, clientId: string|null, name: string, ready: boolean }[]} */
    slots: PLAYER_SLOTS.map((slot) => ({
      slot,
      clientId: null,
      name: "",
      ready: false,
    })),
  },
  /** @type {null | { random?: boolean, slot?: number }} */
  rigSetup: null,
  /** @type {Record<string, { name: string, color: string, clientId: string }>} */
  loginProfiles: {},
};

let nextClientNum = 1;

const artemisDiag = createArtemisDiag(GAME_ROOT);

/** @type {Record<number, { slot: number, clientId: string, lastAppliedSeq: number, gamePhase: string, urlPhase: string, controlSeq: number, mirrorAgeMs: number, at: number }>} */
const syncHeartbeats = {};

const syncBarrier = {
  active: null,
  nextId: 1,
  timer: null,
};

function connectedLobbySlots() {
  return session.lobby.slots.filter((s) => s.clientId);
}

function syncSlotsPayload() {
  const hostSeq = session.publicStateSeq;
  const out = {};
  for (const s of connectedLobbySlots()) {
    const hb = syncHeartbeats[s.slot];
    if (!hb) {
      out[String(s.slot)] = { slot: s.slot, missing: true, name: s.name || "" };
      continue;
    }
    out[String(s.slot)] = {
      slot: s.slot,
      name: s.name || hb.name || "",
      lastAppliedSeq: hb.lastAppliedSeq,
      seqGap: Math.max(0, hostSeq - (Number(hb.lastAppliedSeq) || 0)),
      gamePhase: hb.gamePhase,
      urlPhase: hb.urlPhase,
      controlSeq: hb.controlSeq,
      ageMs: Date.now() - (Number(hb.at) || 0),
      mirrorAgeMs: hb.mirrorAgeMs,
    };
  }
  return out;
}

function syncLaggersForBarrier(barrier) {
  const need = barrier ? Number(barrier.needSeq) || 0 : 0;
  const expectPh = barrier ? String(barrier.expectPhase || "") : "";
  const expectUrl = barrier ? String(barrier.expectUrlPhase || "") : "";
  const laggers = [];
  for (const s of connectedLobbySlots()) {
    const ack = barrier.acks.get(s.slot);
    if (ack && ack.ready) continue;
    const hb = syncHeartbeats[s.slot];
    if (!hb) {
      laggers.push(s.slot);
      continue;
    }
    if (need > 0 && (Number(hb.lastAppliedSeq) || 0) < need) {
      laggers.push(s.slot);
      continue;
    }
    if (expectPh && hb.gamePhase !== expectPh) {
      laggers.push(s.slot);
      continue;
    }
    if (expectUrl && hb.urlPhase !== expectUrl) {
      laggers.push(s.slot);
      continue;
    }
  }
  return laggers;
}

function broadcastSyncStatus() {
  const acks = {};
  if (syncBarrier.active) {
    for (const s of connectedLobbySlots()) {
      const ack = syncBarrier.active.acks.get(s.slot);
      acks[String(s.slot)] = !!(ack && ack.ready);
    }
  }
  broadcast({
    type: "sync_status",
    publicStateSeq: session.publicStateSeq,
    slots: syncSlotsPayload(),
    acks,
    barrier: syncBarrier.active
      ? {
          id: syncBarrier.active.id,
          label: syncBarrier.active.label,
          needSeq: syncBarrier.active.needSeq,
          beatId: syncBarrier.active.beatId,
          stepIndex: syncBarrier.active.stepIndex,
          totalSteps: syncBarrier.active.totalSteps,
          minDisplayMs: syncBarrier.active.minDisplayMs,
        }
      : null,
  });
}

function releaseSyncBarrier(timedOut) {
  const barrier = syncBarrier.active;
  if (!barrier || barrier.released) return;
  barrier.released = true;
  if (syncBarrier.timer) {
    clearTimeout(syncBarrier.timer);
    syncBarrier.timer = null;
  }
  const laggers = [];
  for (const s of connectedLobbySlots()) {
    const ack = barrier.acks.get(s.slot);
    if (!ack || !ack.ready) laggers.push(s.slot);
  }
  const ok = laggers.length === 0;
  broadcast({
    type: "sync_barrier_release",
    barrierId: barrier.id,
    label: barrier.label,
    ok,
    timedOut: !!timedOut,
    laggers,
  });
  artemisDiag.push(
    {
      kind: ok ? "sync_barrier_ok" : timedOut ? "sync_barrier_timeout" : "sync_barrier_lag",
      summary:
        (barrier.label || "barrier") +
        (ok ? " — all synced" : " — lag P" + laggers.join(", P")),
      barrierId: barrier.id,
      laggers,
      timedOut: !!timedOut,
      needSeq: barrier.needSeq,
    },
    sessionDiagSnap()
  );
  syncBarrier.active = null;
}

function maybeCompleteSyncBarrier() {
  const barrier = syncBarrier.active;
  if (!barrier || barrier.released) return;
  const slots = connectedLobbySlots();
  if (!slots.length) return;
  let all = true;
  for (const s of slots) {
    const ack = barrier.acks.get(s.slot);
    if (!ack || !ack.ready) {
      all = false;
      break;
    }
  }
  if (all) releaseSyncBarrier(false);
}

function handleSyncHeartbeat(clientId, msg) {
  const me = roster.get(clientId);
  if (!me) return;
  const slot = Number(msg.slot || me.slot) || 0;
  if (slot !== me.slot) return;
  syncHeartbeats[slot] = {
    slot,
    clientId,
    name: me.name,
    lastAppliedSeq: Number(msg.lastAppliedSeq) || 0,
    gamePhase: String(msg.gamePhase || ""),
    urlPhase: String(msg.urlPhase || ""),
    controlSeq: Number(msg.controlSeq) || 0,
    mirrorAgeMs: Number(msg.mirrorAgeMs),
    at: Number(msg.at) || Date.now(),
  };
}

function handleSyncBarrierOpen(clientId, msg) {
  if (clientId !== session.hostClientId) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "not_host",
      message: "Only host can open sync barriers",
    });
    return;
  }
  if (session.lobby.status !== "started") return;
  if (syncBarrier.active && !syncBarrier.active.released) {
    releaseSyncBarrier(true);
  }
  const id = syncBarrier.nextId++;
  const timeoutMs = Math.min(Math.max(Number(msg.timeoutMs) || 8000, 2000), 45000);
  const minDisplayMs = Math.min(Math.max(Number(msg.minDisplayMs) || 0, 0), 60000);
  const barrier = {
    id,
    label: String(msg.label || "sync"),
    expectPhase: String(msg.expectPhase || ""),
    expectUrlPhase: String(msg.expectUrlPhase || ""),
    needSeq: msg.needSeq != null ? Number(msg.needSeq) : session.publicStateSeq,
    openedAt: Date.now(),
    timeoutMs,
    minDisplayMs,
    beatId: String(msg.beatId || ""),
    stepIndex: Number(msg.stepIndex) || 0,
    totalSteps: Number(msg.totalSteps) || 0,
    acks: new Map(),
    released: false,
  };
  syncBarrier.active = barrier;
  broadcast({
    type: "sync_barrier",
    barrierId: id,
    label: barrier.label,
    expectPhase: barrier.expectPhase,
    expectUrlPhase: barrier.expectUrlPhase,
    needSeq: barrier.needSeq,
    openedAt: barrier.openedAt,
    timeoutMs,
    minDisplayMs,
    beatId: barrier.beatId,
    stepIndex: barrier.stepIndex,
    totalSteps: barrier.totalSteps,
  });
  broadcastSyncStatus();
  syncBarrier.timer = setTimeout(function () {
    releaseSyncBarrier(true);
  }, timeoutMs);
  artemisDiag.push(
    {
      kind: "sync_barrier_open",
      summary: "Barrier #" + id + ": " + barrier.label + " (seq≥" + barrier.needSeq + ")",
      barrierId: id,
      needSeq: barrier.needSeq,
      expectPhase: barrier.expectPhase,
    },
    sessionDiagSnap()
  );
}

function handleSyncAck(clientId, msg) {
  const me = roster.get(clientId);
  if (!me) return;
  const barrier = syncBarrier.active;
  if (!barrier || barrier.released) return;
  if (Number(msg.barrierId) !== barrier.id) return;
  const slot = Number(msg.slot || me.slot) || 0;
  if (slot !== me.slot) return;
  barrier.acks.set(slot, {
    slot,
    ready: !!msg.ready,
    lastAppliedSeq: Number(msg.lastAppliedSeq) || 0,
    gamePhase: String(msg.gamePhase || ""),
    urlPhase: String(msg.urlPhase || ""),
    at: Date.now(),
  });
  maybeCompleteSyncBarrier();
  broadcastSyncStatus();
}

function sessionDiagSnap() {
  return {
    lobbyStatus: session.lobby.status,
    publicStateSeq: session.publicStateSeq,
    hostClientId: session.hostClientId,
    phase: session.publicState ? String(session.publicState.phase || "") : "",
    currentPlayer: session.publicState
      ? String(session.publicState.currentPlayer || "")
      : "",
    controlSeq: session.publicState
      ? Number(session.publicState.risqueArtemisControlSeq) || 0
      : 0,
    roster: rosterPayload(),
    sync: {
      heartbeats: syncSlotsPayload(),
      hostSeq: session.publicStateSeq,
      activeBarrier: syncBarrier.active
        ? {
            id: syncBarrier.active.id,
            label: syncBarrier.active.label,
            needSeq: syncBarrier.active.needSeq,
            expectPhase: syncBarrier.active.expectPhase,
            beatId: syncBarrier.active.beatId,
            stepIndex: syncBarrier.active.stepIndex,
            minDisplayMs: syncBarrier.active.minDisplayMs,
            acks: Object.fromEntries(syncBarrier.active.acks),
          }
        : null,
      laggers: syncBarrier.active ? syncLaggersForBarrier(syncBarrier.active) : syncLaggersFromHeartbeats(),
    },
  };
}

function syncLaggersFromHeartbeats() {
  const hostSeq = session.publicStateSeq;
  const hostPh = session.publicState ? String(session.publicState.phase || "") : "";
  const laggers = [];
  for (const s of connectedLobbySlots()) {
    const hb = syncHeartbeats[s.slot];
    if (!hb) {
      laggers.push({ slot: s.slot, reason: "no_heartbeat" });
      continue;
    }
    const gap = hostSeq - (Number(hb.lastAppliedSeq) || 0);
    if (gap > 2) {
      laggers.push({ slot: s.slot, reason: "seq_gap", gap, gamePhase: hb.gamePhase, hostPhase: hostPh });
      continue;
    }
    if (hostPh && hb.gamePhase && hb.gamePhase !== hostPh) {
      laggers.push({ slot: s.slot, reason: "phase_mismatch", gamePhase: hb.gamePhase, hostPhase: hostPh });
      continue;
    }
    if (Date.now() - (Number(hb.at) || 0) > 5000) {
      laggers.push({ slot: s.slot, reason: "stale_heartbeat", ageMs: Date.now() - hb.at });
    }
  }
  return laggers;
}

function log(msg) {
  const ts = new Date().toISOString();
  process.stderr.write(`[artemis ${ts}] ${msg}\n`);
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded.replace(/^\/+/, "");
  const full = path.resolve(root, rel);
  const rootNorm = path.resolve(root);
  if (full !== rootNorm && !full.startsWith(rootNorm + path.sep)) {
    return null;
  }
  return full;
}

function sendJson(ws, obj) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function broadcast(obj, exceptId) {
  const raw = JSON.stringify(obj);
  for (const [id, ws] of clients) {
    if (exceptId && id === exceptId) continue;
    if (ws.readyState === ws.OPEN) ws.send(raw);
  }
}

function rosterPayload() {
  return Array.from(roster.values()).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    slot: p.slot,
  }));
}

function lobbySlotEntry(slotNum) {
  return session.lobby.slots.find((s) => s.slot === slotNum) || null;
}

function clearLobbySlot(clientId) {
  for (const s of session.lobby.slots) {
    if (s.clientId === clientId) {
      s.clientId = null;
      s.name = "";
      s.ready = false;
    }
  }
}

function loginProfilesPayload() {
  const out = {};
  for (const slot of PLAYER_SLOTS) {
    const key = String(slot);
    out[key] = session.loginProfiles[key] || null;
  }
  return out;
}

function expectedPlayerCount() {
  const n = parseInt(String(session.lobby.expectedPlayers || 3), 10);
  if (!Number.isFinite(n)) return 3;
  return Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n));
}

function buildArtemisRosterFromProfiles() {
  const n = expectedPlayerCount();
  const roster = [];
  for (let slot = 1; slot <= n; slot += 1) {
    const prof = session.loginProfiles[String(slot)];
    if (prof && prof.name && prof.color) {
      roster.push({
        slot,
        name: String(prof.name).trim().toUpperCase(),
        color: String(prof.color).trim().toLowerCase(),
      });
    }
  }
  return roster.length === n ? roster : null;
}

function injectArtemisRosterIntoState(state) {
  if (!state || typeof state !== "object") return state;
  const roster = buildArtemisRosterFromProfiles();
  if (!roster) return state;
  const out = Object.assign({}, state);
  out.artemisRoster = roster;
  return out;
}

function rigSetupBroadcastPayload() {
  if (!session.rigSetup) return null;
  if (session.rigSetup.random) {
    return { type: "rig_setup", random: true, slot: 0 };
  }
  const slot = parseInt(String(session.rigSetup.slot || ""), 10);
  if (slot >= 1 && slot <= MAX_PLAYERS) {
    return { type: "rig_setup", random: false, slot };
  }
  return null;
}

function handleRigSetup(clientId, msg) {
  if (clientId !== session.hostClientId) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "not_host",
      message: "Only the host can set setup rig",
    });
    return;
  }
  if (msg.random) {
    session.rigSetup = { random: true };
  } else {
    const slot = parseInt(String(msg.slot || ""), 10);
    if (slot < 1 || slot > MAX_PLAYERS) {
      sendJson(clients.get(clientId), {
        type: "error",
        code: "bad_rig",
        message: "rig_setup requires slot 1–6 (or random: true)",
      });
      return;
    }
    session.rigSetup = { slot };
  }
  const payload = rigSetupBroadcastPayload();
  if (payload) {
    broadcast(payload);
    log(
      `rig_setup ${msg.random ? "random" : "slot=" + session.rigSetup.slot} from host ${clientId}`
    );
  }
}

function broadcastLoginProfiles(exceptId) {
  const msg = { type: "login_profiles", profiles: loginProfilesPayload() };
  if (exceptId) {
    sendJson(clients.get(exceptId), msg);
  }
  broadcast(msg, exceptId);
}

const ARTEMIS_COLORS = new Set(["blue", "red", "yellow", "green", "pink", "white"]);

function handleLoginProfile(clientId, msg) {
  const me = roster.get(clientId);
  if (!me) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "not_joined",
      message: "Send join first",
    });
    return;
  }
  if (session.lobby.status !== "started") {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "lobby_not_started",
      message: "Wait for the host to start the game",
    });
    return;
  }
  const slot = parseInt(String(msg.slot || me.slot || ""), 10);
  const isHostClient = clientId === session.hostClientId;
  /* Host-driven (m347): host may set any seat; clients only their own. */
  if (!isHostClient && slot !== me.slot) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_slot",
      message: "Profile slot does not match your assigned slot",
    });
    return;
  }
  if (slot === 1 && !isHostClient) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_slot",
      message: "Player 1 signs in on the host computer",
    });
    return;
  }
  if (slot < 1 || slot > MAX_PLAYERS) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_slot",
      message: "Invalid player slot",
    });
    return;
  }
  const name = String(msg.name || "").trim().slice(0, 32).toUpperCase();
  const color = String(msg.color || "").trim().toLowerCase();
  if (!name) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_profile",
      message: "Name is required",
    });
    return;
  }
  if (!ARTEMIS_COLORS.has(color)) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_profile",
      message: "Pick a color",
    });
    return;
  }
  for (const key of Object.keys(session.loginProfiles)) {
    const other = session.loginProfiles[key];
    if (!other || String(key) === String(slot)) continue;
    if (other.color === color) {
      sendJson(clients.get(clientId), {
        type: "error",
        code: "color_taken",
        message: "That color is already taken",
      });
      return;
    }
    if (other.name === name) {
      sendJson(clients.get(clientId), {
        type: "error",
        code: "name_taken",
        message: "That name is already taken",
      });
      return;
    }
  }
  session.loginProfiles[String(slot)] = { name, color, clientId };
  broadcastLoginProfiles();
  log(`login_profile slot=${slot} name="${name}" color=${color} from ${clientId}`);
}

/** Host posts full roster for seats 1..N (kitchen-table login). */
function handleLoginRoster(clientId, msg) {
  if (clientId !== session.hostClientId) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "not_host",
      message: "Only the host can set the full login roster",
    });
    return;
  }
  if (session.lobby.status !== "started") {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "lobby_not_started",
      message: "Wait until the lobby has started",
    });
    return;
  }
  const rows = Array.isArray(msg.players) ? msg.players : [];
  if (rows.length < MIN_PLAYERS || rows.length > MAX_PLAYERS) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_roster",
      message: "Roster must have 2–6 players",
    });
    return;
  }
  const next = {};
  const names = new Set();
  const colors = new Set();
  for (let i = 0; i < rows.length; i += 1) {
    const slot = i + 1;
    const name = String((rows[i] && rows[i].name) || "")
      .trim()
      .slice(0, 32)
      .toUpperCase();
    const color = String((rows[i] && rows[i].color) || "")
      .trim()
      .toLowerCase();
    if (!name || !ARTEMIS_COLORS.has(color)) {
      sendJson(clients.get(clientId), {
        type: "error",
        code: "bad_roster",
        message: "Each player needs a name and unique color",
      });
      return;
    }
    if (names.has(name) || colors.has(color)) {
      sendJson(clients.get(clientId), {
        type: "error",
        code: "bad_roster",
        message: "Duplicate names or colors in roster",
      });
      return;
    }
    names.add(name);
    colors.add(color);
    next[String(slot)] = { name, color, clientId };
  }
  session.lobby.expectedPlayers = rows.length;
  session.loginProfiles = next;
  broadcastLoginProfiles();
  broadcastLobbyState();
  log(`login_roster n=${rows.length} from host ${clientId}`);
}

function handlePlayerState(clientId, msg) {
  const me = roster.get(clientId);
  if (!me) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "not_joined",
      message: "Send join first",
    });
    return;
  }
  if (session.lobby.status !== "started") {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "lobby_not_started",
      message: "Game not started",
    });
    return;
  }
  const slot = parseInt(String(msg.slot || me.slot || ""), 10);
  if (slot !== me.slot) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_slot",
      message: "player_state slot mismatch",
    });
    return;
  }
  if (!msg.state || typeof msg.state !== "object") {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_state",
      message: "player_state requires state object",
    });
    return;
  }
  const st = msg.state;
  const pub = session.publicState;
  const hostSeq =
    pub && pub.risqueArtemisControlSeq != null ? Number(pub.risqueArtemisControlSeq) || 0 : 0;
  const inSeq = st.risqueArtemisControlSeq != null ? Number(st.risqueArtemisControlSeq) || 0 : 0;
  if (
    String(st.phase || "") === "deploy" &&
    hostSeq > 0 &&
    inSeq > 0 &&
    inSeq < hostSeq &&
    !st.risqueArtemisSetupDeployConfirm
  ) {
    artemisDiag.push(
      {
        kind: "player_state_dropped_stale",
        source: "server",
        clientId,
        slot,
        phase: "deploy",
        controlSeq: inSeq,
        summary: `dropped stale player_state P${slot} seq=${inSeq} hostSeq=${hostSeq}`,
      },
      sessionDiagSnap()
    );
    return;
  }
  const hostWs = session.hostClientId ? clients.get(session.hostClientId) : null;
  if (!hostWs || hostWs.readyState !== hostWs.OPEN) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "no_host",
      message: "Host not connected",
    });
    return;
  }
  sendJson(hostWs, {
    type: "client_state",
    slot,
    clientId,
    state: msg.state,
  });
  log(`player_state from ${clientId} slot=${slot} phase=${String(st.phase || "?")}`);
  const legacyConfirm = !!(st && st.risqueArtemisSetupDeployConfirm);
  artemisDiag.push(
    {
      kind: legacyConfirm ? "legacy_deploy_confirm_forwarded" : "player_state_forwarded",
      source: "server",
      clientId,
      slot,
      phase: String(st.phase || ""),
      controlSeq: st ? Number(st.risqueArtemisControlSeq) || 0 : 0,
      nextPlayer: legacyConfirm ? String(st.risqueArtemisSetupDeployNextPlayer || "") : "",
      summary: legacyConfirm
        ? `legacy CONFIRM in player_state P${slot} seq=${Number(st.risqueArtemisControlSeq) || 0}`
        : `player_state forwarded P${slot} phase=${String(st.phase || "?")}`,
    },
    sessionDiagSnap()
  );
  relayDeployLiveToSpectators(clientId, slot, st);
  relayAttackLiveToSpectators(clientId, slot, st);
}

function handleDiagEvent(clientId, msg) {
  const me = roster.get(clientId);
  const ev = msg && msg.event && typeof msg.event === "object" ? msg.event : null;
  if (!ev) return;
  artemisDiag.push(
    {
      ...ev,
      source: "browser",
      clientId,
      slot: Number(ev.slot || (me && me.slot) || 0) || 0,
    },
    sessionDiagSnap()
  );
}

function handleCycleProbeAdvance(clientId, msg) {
  const me = roster.get(clientId);
  if (!me) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "not_joined",
      message: "Send join first",
    });
    return;
  }
  if (session.lobby.status !== "started") {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "lobby_not_started",
      message: "Game not started",
    });
    return;
  }
  const slot = parseInt(String(msg.slot || me.slot || ""), 10);
  if (slot !== me.slot) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_slot",
      message: "cycle_probe_advance slot mismatch",
    });
    return;
  }
  const hostWs = session.hostClientId ? clients.get(session.hostClientId) : null;
  if (!hostWs || hostWs.readyState !== hostWs.OPEN) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "no_host",
      message: "Host not connected",
    });
    return;
  }
  sendJson(hostWs, {
    type: "client_cycle_probe_advance",
    slot,
    clientId,
    step: Number(msg.step) || 0,
  });
  log(`cycle_probe_advance from ${clientId} slot=${slot} step=${Number(msg.step) || 0}`);
}

function handleDeployConfirm(clientId, msg) {
  const me = roster.get(clientId);
  if (!me) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "not_joined",
      message: "Send join first",
    });
    return;
  }
  if (session.lobby.status !== "started") {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "lobby_not_started",
      message: "Game not started",
    });
    return;
  }
  const slot = parseInt(String(msg.slot || me.slot || ""), 10);
  if (slot !== me.slot) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_slot",
      message: "deploy_confirm slot mismatch",
    });
    return;
  }
  const hostWs = session.hostClientId ? clients.get(session.hostClientId) : null;
  if (!hostWs || hostWs.readyState !== hostWs.OPEN) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "no_host",
      message: "Host not connected",
    });
    return;
  }
  sendJson(hostWs, {
    type: "client_deploy_confirm",
    slot,
    clientId,
    route: String(msg.route || "setup"),
    controlSeq: Number(msg.controlSeq) || 0,
    nextPlayer: String(msg.nextPlayer || ""),
    nextSeq: Number(msg.nextSeq) || 0,
    mirrorDraft: msg.mirrorDraft || null,
    finisher: msg.finisher || null,
  });
  log(
    `deploy_confirm from ${clientId} slot=${slot} seq=${Number(msg.controlSeq) || 0} route=${String(msg.route || "setup")}`
  );
  artemisDiag.push(
    {
      kind: "deploy_confirm_forwarded",
      source: "server",
      clientId,
      slot,
      controlSeq: Number(msg.controlSeq) || 0,
      nextPlayer: String(msg.nextPlayer || ""),
      summary: `deploy_confirm forwarded P${slot} seq=${Number(msg.controlSeq) || 0} → ${String(msg.nextPlayer || "?")}`,
    },
    sessionDiagSnap()
  );
}

function handleDeployFinish(clientId, msg) {
  const me = roster.get(clientId);
  if (!me) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "not_joined",
      message: "Send join first",
    });
    return;
  }
  if (session.lobby.status !== "started") {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "lobby_not_started",
      message: "Game not started",
    });
    return;
  }
  const slot = parseInt(String(msg.slot || me.slot || ""), 10);
  if (slot !== me.slot) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_slot",
      message: "deploy_finish slot mismatch",
    });
    return;
  }
  const hostWs = session.hostClientId ? clients.get(session.hostClientId) : null;
  if (!hostWs || hostWs.readyState !== hostWs.OPEN) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "no_host",
      message: "Host not connected",
    });
    return;
  }
  sendJson(hostWs, {
    type: "client_deploy_finish",
    slot,
    clientId,
    route: String(msg.route || "setup"),
    controlSeq: Number(msg.controlSeq) || 0,
    mirrorDraft: msg.mirrorDraft || null,
    finisher: msg.finisher || null,
  });
  log(
    `deploy_finish from ${clientId} slot=${slot} seq=${Number(msg.controlSeq) || 0} route=${String(msg.route || "setup")}`
  );
  artemisDiag.push(
    {
      kind: "deploy_finish_forwarded",
      source: "server",
      clientId,
      slot,
      controlSeq: Number(msg.controlSeq) || 0,
      summary: `deploy_finish forwarded P${slot} seq=${Number(msg.controlSeq) || 0}`,
    },
    sessionDiagSnap()
  );
}

function lobbyCanStart() {
  if (session.lobby.status !== "waiting") return false;
  const n = expectedPlayerCount();
  for (let slot = 1; slot <= n; slot += 1) {
    const s = lobbySlotEntry(slot);
    if (!s || !s.clientId || !s.ready) return false;
  }
  return true;
}

function lobbySnapshotFor(clientId) {
  const me = roster.get(clientId);
  const mySlot = me ? lobbySlotEntry(me.slot) : null;
  const n = expectedPlayerCount();
  return {
    status: session.lobby.status,
    expectedPlayers: n,
    lobbyMode: session.lobby.lobbyMode === "open" ? "open" : "quick",
    slots: session.lobby.slots.map((s) => ({
      slot: s.slot,
      clientId: s.clientId,
      name: s.name,
      ready: s.ready,
    })),
    myReady: mySlot ? !!mySlot.ready : false,
    canStart: clientId === session.hostClientId && lobbyCanStart(),
  };
}

function broadcastLobbyState(exceptId) {
  for (const [id, ws] of clients) {
    if (exceptId && id === exceptId) continue;
    if (!roster.has(id)) continue;
    sendJson(ws, { type: "lobby_state", lobby: lobbySnapshotFor(id) });
  }
}

function sendLobbyState(clientId) {
  const ws = clients.get(clientId);
  if (!ws) return;
  sendJson(ws, { type: "lobby_state", lobby: lobbySnapshotFor(clientId) });
}

function getLanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] || []) {
      if (ni.family === "IPv4" && !ni.internal) {
        out.push(ni.address);
      }
    }
  }
  return out;
}

/** Fan-out live attack dice/combat to spectators (host + other clients). */
function relayAttackLiveToSpectators(senderClientId, senderSlot, st) {
  if (!st || String(st.phase || "") !== "attack") return;
  const ctrl = Number(st.artemisControlSlot) || 0;
  if (ctrl < 1 || Number(senderSlot) !== ctrl) return;
  const hasLiveCombat =
    (st.risqueLastDiceDisplay && typeof st.risqueLastDiceDisplay === "object") ||
    (st.risqueBattleHudReadout && typeof st.risqueBattleHudReadout === "object") ||
    (st.risqueControlVoice && typeof st.risqueControlVoice === "object") ||
    (st.risquePublicAttackSelectionLine &&
      String(st.risquePublicAttackSelectionLine).trim() !== "") ||
    (st.risquePublicAttackTransferSummary &&
      String(st.risquePublicAttackTransferSummary).trim() !== "") ||
    (st.risquePublicBlitzBanner && String(st.risquePublicBlitzBanner).trim() !== "") ||
    st.attackingTerritory ||
    st.defendingTerritory;
  if (!hasLiveCombat) return;
  session.attackLiveSeq = (Number(session.attackLiveSeq) || 0) + 1;
  const out = {
    type: "attack_live",
    slot: senderSlot,
    seq: session.attackLiveSeq,
    patch: {
      phase: "attack",
      currentPlayer: st.currentPlayer,
      artemisControlSlot: st.artemisControlSlot,
      risqueArtemisControlSeq: st.risqueArtemisControlSeq,
      attackPhase: st.attackPhase,
      attackingTerritory: st.attackingTerritory,
      defendingTerritory: st.defendingTerritory,
      acquiredTerritory: st.acquiredTerritory,
      risquePublicAttackSelectionLine: st.risquePublicAttackSelectionLine,
      risquePublicAttackTransferSummary: st.risquePublicAttackTransferSummary,
      risquePublicBlitzBanner: st.risquePublicBlitzBanner,
      risquePublicBlitzBannerReport: st.risquePublicBlitzBannerReport,
      risqueLastDiceDisplay: st.risqueLastDiceDisplay,
      risqueBattleHudReadout: st.risqueBattleHudReadout,
      risqueAttackOutcomePrimary: st.risqueAttackOutcomePrimary,
      risqueAttackOutcomeReport: st.risqueAttackOutcomeReport,
      risqueAttackOutcomeAcquisition: st.risqueAttackOutcomeAcquisition,
      risqueControlVoice: st.risqueControlVoice,
      risqueCombatLogTail: st.risqueCombatLogTail,
      players: st.players,
    },
  };
  const hostWs =
    session.hostClientId && session.hostClientId !== senderClientId
      ? clients.get(session.hostClientId)
      : null;
  if (hostWs && hostWs.readyState === hostWs.OPEN) {
    sendJson(hostWs, out);
  }
  roster.forEach((_meta, cid) => {
    if (cid === senderClientId) return;
    const ws = clients.get(cid);
    if (ws && ws.readyState === ws.OPEN) {
      sendJson(ws, out);
    }
  });
}

/** Fan-out live deploy edits to spectators (Guido host + waiting clients). Setup + turn deploy. */
function relayDeployLiveToSpectators(senderClientId, senderSlot, st) {
  if (!st || String(st.phase || "") !== "deploy") return;
  const route = String(st.risqueMirrorDeployRoute || "");
  const ctrl = Number(st.artemisControlSlot) || 0;
  if (ctrl < 1 || Number(senderSlot) !== ctrl) return;
  session.deployLiveSeq = (Number(session.deployLiveSeq) || 0) + 1;
  const out = {
    type: "deploy_live",
    slot: senderSlot,
    seq: session.deployLiveSeq,
    patch: {
      phase: "deploy",
      currentPlayer: st.currentPlayer,
      artemisControlSlot: st.artemisControlSlot,
      risqueArtemisControlSeq: st.risqueArtemisControlSeq,
      risqueMirrorDeployRoute: route || (route === "turn" || route === "deploy2" ? route : "setup"),
      risquePublicDeployBanner: st.risquePublicDeployBanner,
      risquePublicDeployReport: st.risquePublicDeployReport,
      risqueDeployMirrorDraft: st.risqueDeployMirrorDraft,
      risqueControlVoice: st.risqueControlVoice,
      players: st.players,
    },
  };
  roster.forEach((_meta, cid) => {
    if (cid === senderClientId) return;
    const ws = clients.get(cid);
    if (ws && ws.readyState === ws.OPEN) {
      sendJson(ws, out);
    }
  });
}

/** Host turn deploy: fan-out live +N draft edits when the draft actually changes. */
function deployLiveDraftSig(draft) {
  if (!draft || typeof draft !== "object") return "";
  try {
    return JSON.stringify({
      selected: draft.selected != null ? String(draft.selected) : "",
      deltas: draft.deltas || null,
    });
  } catch (eSig) {
    return "";
  }
}

function relayDeployLiveFromHostPublicState(st) {
  if (!st || String(st.phase || "") !== "deploy") {
    session.lastDeployLiveDraftSig = "";
    return;
  }
  const draft = st.risqueDeployMirrorDraft;
  if (!draft || typeof draft !== "object" || !draft.deltas) return;
  let hasPositive = false;
  Object.keys(draft.deltas).forEach((k) => {
    if (Number(draft.deltas[k]) > 0) hasPositive = true;
  });
  if (!hasPositive) return;
  const sig = deployLiveDraftSig(draft);
  if (sig && sig === session.lastDeployLiveDraftSig) return;
  session.lastDeployLiveDraftSig = sig;
  const ctrl = Number(st.artemisControlSlot) || 1;
  session.deployLiveSeq = (Number(session.deployLiveSeq) || 0) + 1;
  const route = String(st.risqueMirrorDeployRoute || "");
  const out = {
    type: "deploy_live",
    slot: ctrl,
    seq: session.deployLiveSeq,
    patch: {
      phase: "deploy",
      currentPlayer: st.currentPlayer,
      artemisControlSlot: st.artemisControlSlot,
      risqueArtemisControlSeq: st.risqueArtemisControlSeq,
      risqueMirrorDeployRoute:
        route === "turn" || route === "deploy2" ? route : route || "turn",
      risquePublicDeployBanner: st.risquePublicDeployBanner,
      risquePublicDeployReport: st.risquePublicDeployReport,
      risqueDeployMirrorDraft: st.risqueDeployMirrorDraft,
      risqueControlVoice: st.risqueControlVoice,
      players: st.players,
    },
  };
  broadcast(out, session.hostClientId);
}

function clearHostIf(clientId) {
  if (session.hostClientId === clientId) {
    session.hostClientId = null;
    log(`host released (${clientId} disconnected)`);
  }
  clearLobbySlot(clientId);
}

function handlePublicState(clientId, msg) {
  if (clientId !== session.hostClientId) {
    const ws = clients.get(clientId);
    sendJson(ws, {
      type: "error",
      code: "not_host",
      message: "Only the host can publish public_state",
    });
    return;
  }
  if (!msg.state || typeof msg.state !== "object") {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_state",
      message: "public_state requires a state object",
    });
    return;
  }
  let sizeCheck;
  try {
    sizeCheck = JSON.stringify(msg.state);
  } catch (e) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "bad_state",
      message: "state is not JSON-serializable",
    });
    return;
  }
  if (sizeCheck.length > MAX_STATE_BYTES) {
    sendJson(clients.get(clientId), {
      type: "error",
      code: "state_too_large",
      message: "public_state exceeds size limit",
    });
    return;
  }
  session.publicState = injectArtemisRosterIntoState(msg.state);
  session.publicStateSeq += 1;
  const out = {
    type: "public_state",
    seq: session.publicStateSeq,
    state: session.publicState,
  };
  broadcast(out, clientId);
  relayDeployLiveFromHostPublicState(session.publicState);
  sendJson(clients.get(clientId), {
    type: "public_state_ack",
    seq: session.publicStateSeq,
  });
  log(
    `public_state seq=${session.publicStateSeq} phase=${String(msg.state.phase || "?")} from ${clientId}`
  );
}

function handleApi(req, res, urlPath) {
  if (req.method === "GET" && urlPath === "/api/artemis/diag") {
    const body = JSON.stringify(artemisDiag.getReport(sessionDiagSnap()));
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(body);
    return true;
  }
  if (req.method === "GET" && urlPath === "/api/artemis/health") {
    const launchers = launcherManifest();
    const body = JSON.stringify({
      ok: true,
      service: "artemis-server",
      protocolVersion: PROTOCOL_VERSION,
      port: PORT,
      gameRoot: GAME_ROOT,
      clients: roster.size,
      hostClientId: session.hostClientId,
      publicStateSeq: session.publicStateSeq,
      lobby: session.lobby,
      roster: rosterPayload(),
      launchers: launchers.ok
        ? {
            cacheVersion: launchers.cacheVersion,
            activeMode: launchers.activeMode,
            joinHub: launchers.joinHub,
          }
        : null,
    });
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(body);
    return true;
  }
  return false;
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  if (rel.endsWith("/")) rel += "index.html";
  const filePath = safeJoin(GAME_ROOT, rel);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];
  const hostHeader = req.headers.host || `127.0.0.1:${PORT}`;
  if (handleLaunchers(req, res, urlPath, hostHeader)) return;
  if (handleApi(req, res, urlPath)) return;
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }
  serveStatic(req, res, urlPath);
});

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: MAX_STATE_BYTES });

wss.on("connection", (ws, req) => {
  const clientId = "c" + nextClientNum++;
  clients.set(clientId, ws);
  log(`connect ${clientId} from ${req.socket.remoteAddress || "?"}`);

  sendJson(ws, {
    type: "welcome",
    v: PROTOCOL_VERSION,
    clientId,
    message:
      'Send { type: "join", role: "host"|"client", name: "...", slot: 1..6 }.',
  });

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch (e) {
      sendJson(ws, { type: "error", code: "bad_json", message: "Invalid JSON" });
      return;
    }
    const type = msg && msg.type;
    if (type === "ping") {
      sendJson(ws, { type: "pong", t: msg.t || Date.now() });
      return;
    }
    if (type === "join") {
      const name = String(msg.name || "Player").trim().slice(0, 32) || "Player";
      const role = String(msg.role || "client").toLowerCase() === "host" ? "host" : "client";
      const slot = parseInt(String(msg.slot || ""), 10);
      if (!PLAYER_SLOTS.includes(slot)) {
        sendJson(ws, {
          type: "error",
          code: "bad_slot",
          message: "join requires slot 1 (host) or 2–6 (clients)",
        });
        return;
      }
      if (role === "host" && slot !== 1) {
        sendJson(ws, {
          type: "error",
          code: "bad_slot",
          message: "Host must use slot=1",
        });
        return;
      }
      if (role === "client" && slot === 1) {
        sendJson(ws, {
          type: "error",
          code: "bad_slot",
          message: "Clients must use slot=2 through slot=6",
        });
        return;
      }
      const slotEntry = lobbySlotEntry(slot);
      if (!slotEntry) {
        sendJson(ws, { type: "error", code: "bad_slot", message: "Invalid slot" });
        return;
      }
      if (slotEntry.clientId && slotEntry.clientId !== clientId) {
        sendJson(ws, {
          type: "error",
          code: "slot_taken",
          message: `Player slot ${slot} is already in use`,
        });
        return;
      }
      if (role === "host") {
        if (session.hostClientId && session.hostClientId !== clientId) {
          sendJson(ws, {
            type: "error",
            code: "host_taken",
            message: "Another host is already connected",
          });
          return;
        }
        session.hostClientId = clientId;
        ws.artemisRole = "host";
      } else {
        ws.artemisRole = "client";
      }
      if (roster.has(clientId)) {
        clearLobbySlot(clientId);
      }
      slotEntry.clientId = clientId;
      slotEntry.name = name;
      slotEntry.ready = false;
      ws.playerSlot = slot;
      roster.set(clientId, { id: clientId, name, role, slot, joinedAt: Date.now() });
      const joined = {
        type: "joined",
        clientId,
        name,
        role,
        slot,
        lobbyStarted: session.lobby.status === "started",
        roster: rosterPayload(),
        publicStateSeq: session.publicStateSeq,
      };
      if (session.publicState && session.lobby.status === "started") {
        joined.publicState = session.publicState;
      }
      sendJson(ws, joined);
      sendLobbyState(clientId);
      if (session.lobby.status === "started") {
        sendJson(ws, { type: "login_profiles", profiles: loginProfilesPayload() });
        const rigMsg = rigSetupBroadcastPayload();
        if (rigMsg) sendJson(ws, rigMsg);
      }
      broadcastLobbyState(clientId);
      broadcast({ type: "roster", roster: rosterPayload() }, clientId);
      log(`join ${clientId} role=${role} slot=${slot} name="${name}"`);
      return;
    }
    if (type === "lobby_ready") {
      const me = roster.get(clientId);
      if (!me) {
        sendJson(ws, { type: "error", code: "not_joined", message: "Send join first" });
        return;
      }
      if (session.lobby.status !== "waiting") {
        sendJson(ws, {
          type: "error",
          code: "lobby_started",
          message: "Game already started",
        });
        return;
      }
      const slotEntry = lobbySlotEntry(me.slot);
      if (!slotEntry || slotEntry.clientId !== clientId) {
        sendJson(ws, { type: "error", code: "bad_slot", message: "Slot not assigned" });
        return;
      }
      slotEntry.ready = !!msg.ready;
      broadcastLobbyState();
      log(`lobby_ready ${clientId} slot=${me.slot} ready=${slotEntry.ready}`);
      return;
    }
    if (type === "lobby_set_expected") {
      if (clientId !== session.hostClientId) {
        sendJson(ws, {
          type: "error",
          code: "not_host",
          message: "Only the host can set player count",
        });
        return;
      }
      if (session.lobby.status !== "waiting") {
        sendJson(ws, {
          type: "error",
          code: "lobby_started",
          message: "Player count is locked after the lobby starts",
        });
        return;
      }
      const n = parseInt(String(msg.count || msg.expectedPlayers || ""), 10);
      if (!Number.isFinite(n) || n < MIN_PLAYERS || n > MAX_PLAYERS) {
        sendJson(ws, {
          type: "error",
          code: "bad_count",
          message: "expectedPlayers must be 2–6",
        });
        return;
      }
      session.lobby.expectedPlayers = n;
      if (msg.lobbyMode === "open" || msg.lobbyMode === "quick") {
        session.lobby.lobbyMode = msg.lobbyMode;
      }
      broadcastLobbyState();
      log(`lobby_set_expected n=${n} mode=${session.lobby.lobbyMode} from host ${clientId}`);
      return;
    }
    if (type === "lobby_set_mode") {
      if (clientId !== session.hostClientId) {
        sendJson(ws, {
          type: "error",
          code: "not_host",
          message: "Only the host can set lobby mode",
        });
        return;
      }
      const mode = msg.mode === "open" ? "open" : "quick";
      session.lobby.lobbyMode = mode;
      broadcastLobbyState();
      for (const [id, peer] of clients) {
        if (!roster.has(id)) continue;
        sendJson(peer, { type: "lobby_mode", mode: mode });
      }
      log(`lobby_set_mode mode=${mode} from host ${clientId}`);
      return;
    }
    if (type === "lobby_start") {
      if (clientId !== session.hostClientId) {
        sendJson(ws, {
          type: "error",
          code: "not_host",
          message: "Only the host can start the game",
        });
        return;
      }
      if (session.lobby.status !== "waiting") {
        sendJson(ws, {
          type: "error",
          code: "lobby_started",
          message: "Game already started",
        });
        return;
      }
      if (!lobbyCanStart()) {
        sendJson(ws, {
          type: "error",
          code: "not_ready",
          message: "Not all connected players are ready",
        });
        return;
      }
      session.lobby.status = "started";
      session.publicState = null;
      session.publicStateSeq = 0;
      session.rigSetup = null;
      session.loginProfiles = {};
      Object.keys(syncHeartbeats).forEach(function (k) {
        delete syncHeartbeats[k];
      });
      if (syncBarrier.active) {
        releaseSyncBarrier(true);
      }
      artemisDiag.resetSession();
      artemisDiag.push(
        { kind: "session_start", source: "server", summary: "lobby_start — new ARTEMIS session" },
        sessionDiagSnap()
      );
      broadcast({ type: "lobby_started" });
      broadcastLobbyState();
      log("lobby_start — game session open");
      return;
    }
    if (type === "rig_setup") {
      handleRigSetup(clientId, msg);
      return;
    }
    if (type === "login_profile") {
      handleLoginProfile(clientId, msg);
      return;
    }
    if (type === "login_roster") {
      handleLoginRoster(clientId, msg);
      return;
    }
    if (type === "player_state") {
      handlePlayerState(clientId, msg);
      return;
    }
    if (type === "deploy_confirm") {
      handleDeployConfirm(clientId, msg);
      return;
    }
    if (type === "deploy_finish") {
      handleDeployFinish(clientId, msg);
      return;
    }
    if (type === "diag_event") {
      handleDiagEvent(clientId, msg);
      return;
    }
    if (type === "sync_heartbeat") {
      handleSyncHeartbeat(clientId, msg);
      return;
    }
    if (type === "sync_barrier_open") {
      handleSyncBarrierOpen(clientId, msg);
      return;
    }
    if (type === "sync_ack") {
      handleSyncAck(clientId, msg);
      return;
    }
    if (type === "cycle_probe_advance") {
      handleCycleProbeAdvance(clientId, msg);
      return;
    }
    if (type === "public_state") {
      handlePublicState(clientId, msg);
      return;
    }
    sendJson(ws, { type: "error", code: "unknown_type", message: "Unknown message type: " + type });
  });

  ws.on("close", () => {
    clients.delete(clientId);
    clearHostIf(clientId);
    if (roster.has(clientId)) {
      const me = roster.get(clientId);
      if (me && me.slot) {
        delete syncHeartbeats[me.slot];
      }
      roster.delete(clientId);
      broadcastLobbyState();
      broadcast({ type: "roster", roster: rosterPayload() });
      log(`disconnect ${clientId}`);
    } else {
      log(`disconnect ${clientId} (never joined)`);
    }
  });
});

server.listen(PORT, BIND, () => {
  log(`game root: ${GAME_ROOT}`);
  log(`listening on http://${BIND}:${PORT}/`);
  log(`WebSocket: ws://<your-lan-ip>:${PORT}/ws`);
  const ips = getLanAddresses();
  if (ips.length) {
    for (const ip of ips) {
      log(`  HOST game:  http://${ip}:${PORT}/game.html?artemis=host&slot=1`);
      log(`  TURN PROBE: http://${ip}:${PORT}/artemis-probe/probe.html?artemis=host&slot=1`);
      log(`  CLIENT 2:   http://${ip}:${PORT}/artemis-probe/probe.html?artemis=client&slot=2`);
      log(`  CLIENT 3:   http://${ip}:${PORT}/artemis-probe/probe.html?artemis=client&slot=3`);
      log(`  SETUP:      http://${ip}:${PORT}/artemis-client-setup.html`);
    }
  } else {
    log("  (no LAN IPv4 detected — check ipconfig for Wi-Fi address)");
  }
  log(`  health: http://127.0.0.1:${PORT}/api/artemis/health`);
  log(`  diag:   http://127.0.0.1:${PORT}/api/artemis/diag`);
  log(`  report: ${artemisDiag.reportPath}`);
  setInterval(function () {
    if (session.lobby.status !== "started") return;
    try {
      const report = artemisDiag.getReport(sessionDiagSnap());
      fs.writeFileSync(artemisDiag.reportPath, JSON.stringify(report, null, 2));
    } catch (eSyncRep) {
      /* ignore */
    }
  }, 3000);
});
