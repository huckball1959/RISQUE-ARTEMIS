"use strict";

/**
 * ARTEMIS sync gate — host-driven barriers + per-laptop heartbeat lag reporting.
 * Waits for slow clients before phase transitions; surfaces who is behind.
 */
(function () {
  if (!window.risqueArtemisMode) return;

  var HEARTBEAT_MS = 1000;
  var heartbeatTimer = null;
  var lastMirrorAppliedAt = 0;
  var activeBarrier = null;
  var barrierAckSent = false;
  var hostWaiters = [];
  var hostMirrorSeq = 0;
  var hostMirrorAckWaiters = [];
  var syncStripEl = null;
  var ackRetryTimer = null;

  function clearAckRetry() {
    if (ackRetryTimer) {
      clearTimeout(ackRetryTimer);
      ackRetryTimer = null;
    }
  }

  function scheduleAckRetry() {
    if (ackRetryTimer || !activeBarrier || barrierAckSent) return;
    ackRetryTimer = setTimeout(function () {
      ackRetryTimer = null;
      tryAckBarrier();
    }, 120);
  }

  function barrierMinTimeMet(barrier) {
    if (!barrier) return true;
    var minMs = Number(barrier.minDisplayMs) || 0;
    if (minMs <= 0) return true;
    var started = Number(barrier.localReceivedAt) || Number(barrier.openedAt) || 0;
    return Date.now() - started >= minMs;
  }

  function slotNum() {
    return Number(window.risqueArtemisPlayerSlot) || 0;
  }

  function isHost() {
    return !!window.risqueArtemisHost;
  }

  function isNetClient() {
    return !!window.risqueArtemisNetClient;
  }

  function lobbyLive() {
    return !!window.risqueArtemisLobbyStarted;
  }

  function urlPhase() {
    try {
      return String(new URL(window.location.href).searchParams.get("phase") || "");
    } catch (eUrl) {
      return "";
    }
  }

  function gamePhase() {
    return window.gameState ? String(window.gameState.phase || "") : "";
  }

  function clientMirrorSeq() {
    if (typeof window.risqueArtemisGetClientMirrorSeq === "function") {
      return Number(window.risqueArtemisGetClientMirrorSeq()) || 0;
    }
    return 0;
  }

  function controlSeq() {
    return window.gameState ? Number(window.gameState.risqueArtemisControlSeq) || 0 : 0;
  }

  function send(obj) {
    if (typeof window.risqueArtemisSend === "function") {
      window.risqueArtemisSend(obj);
    }
  }

  /** On-screen SYNC strip retired — barriers/heartbeats still run; diagnostics only. */
  function hideSyncUi() {
    var strip = document.getElementById("risque-artemis-sync-strip");
    if (strip) {
      strip.textContent = "";
      strip.hidden = true;
      strip.style.display = "none";
    }
    syncStripEl = strip;
  }

  function ensureSyncStrip() {
    hideSyncUi();
    return null;
  }

  function renderSyncStrip(text, kind) {
    hideSyncUi();
  }

  window.risqueArtemisRenderPhaseMismatchStrip = function () {
    hideSyncUi();
  };

  function noteMirrorApplied() {
    lastMirrorAppliedAt = Date.now();
    tryAckBarrier();
  }

  function buildHeartbeatPayload() {
    return {
      type: "sync_heartbeat",
      slot: slotNum(),
      lastAppliedSeq: isHost() ? hostMirrorSeq : clientMirrorSeq(),
      gamePhase: gamePhase(),
      urlPhase: urlPhase(),
      controlSeq: controlSeq(),
      mirrorAgeMs: lastMirrorAppliedAt ? Date.now() - lastMirrorAppliedAt : -1,
      at: Date.now(),
    };
  }

  function sendHeartbeat() {
    if (!lobbyLive()) return;
    send(buildHeartbeatPayload());
  }

  function clientReadyForBarrier(barrier) {
    if (!barrier) return false;
    var needSeq = Number(barrier.needSeq) || 0;
    var seq = isHost() ? hostMirrorSeq : clientMirrorSeq();
    if (needSeq > 0 && seq < needSeq) return false;
    if (barrier.expectPhase && gamePhase() !== String(barrier.expectPhase)) return false;
    if (barrier.expectUrlPhase && urlPhase() !== String(barrier.expectUrlPhase)) return false;
    return true;
  }

  function tryAckBarrier() {
    if (!activeBarrier || barrierAckSent || !lobbyLive()) return;
    if (!barrierMinTimeMet(activeBarrier)) {
      scheduleAckRetry();
      return;
    }
    if (!clientReadyForBarrier(activeBarrier)) {
      scheduleAckRetry();
      return;
    }
    clearAckRetry();
    barrierAckSent = true;
    send({
      type: "sync_ack",
      barrierId: activeBarrier.id,
      slot: slotNum(),
      lastAppliedSeq: isHost() ? hostMirrorSeq : clientMirrorSeq(),
      gamePhase: gamePhase(),
      urlPhase: urlPhase(),
      ready: true,
    });
    if (typeof window.risqueArtemisBeatSyncOnLocalAck === "function") {
      window.risqueArtemisBeatSyncOnLocalAck(activeBarrier);
    }
    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag("sync_ack", "P" + slotNum() + " ack barrier #" + activeBarrier.id, {
        label: activeBarrier.label,
        beatId: activeBarrier.beatId,
        needSeq: activeBarrier.needSeq,
        gamePhase: gamePhase(),
        urlPhase: urlPhase(),
      });
    }
  }

  function onSyncBarrier(msg) {
    clearAckRetry();
    activeBarrier = {
      id: Number(msg.barrierId) || 0,
      label: String(msg.label || ""),
      beatId: String(msg.beatId || ""),
      stepIndex: Number(msg.stepIndex) || 0,
      totalSteps: Number(msg.totalSteps) || 0,
      expectPhase: msg.expectPhase != null ? String(msg.expectPhase) : "",
      expectUrlPhase: msg.expectUrlPhase != null ? String(msg.expectUrlPhase) : "",
      needSeq: msg.needSeq != null ? Number(msg.needSeq) : 0,
      openedAt: Number(msg.openedAt) || Date.now(),
      localReceivedAt: Date.now(),
      minDisplayMs: Number(msg.minDisplayMs) || 0,
      timeoutMs: Number(msg.timeoutMs) || 8000,
    };
    barrierAckSent = false;
    renderSyncStrip("SYNC: " + (activeBarrier.label || "waiting…"), "wait");
    if (typeof window.risqueArtemisBeatSyncOnBarrier === "function") {
      window.risqueArtemisBeatSyncOnBarrier(activeBarrier);
    }
    tryAckBarrier();
  }

  function resolveHostWaiters(result) {
    var list = hostWaiters.slice();
    hostWaiters = [];
    list.forEach(function (fn) {
      try {
        fn(result);
      } catch (eRes) {
        /* ignore */
      }
    });
  }

  function onSyncBarrierRelease(msg) {
    clearAckRetry();
    activeBarrier = null;
    barrierAckSent = false;
    if (typeof window.risqueArtemisBeatSyncOnRelease === "function") {
      window.risqueArtemisBeatSyncOnRelease(msg);
    }
    var laggers = Array.isArray(msg.laggers) ? msg.laggers : [];
    var timedOut = !!msg.timedOut;
    var ok = !!msg.ok;
    if (laggers.length) {
      renderSyncStrip(
        "SYNC lag P" + laggers.join(", P") + (timedOut ? " (timeout)" : ""),
        timedOut ? "warn" : "ok"
      );
      if (typeof window.risqueArtemisDiag === "function") {
        window.risqueArtemisDiag(
          timedOut ? "sync_gate_timeout" : "sync_gate_lag",
          (msg.label || "barrier") + " — lagging: P" + laggers.join(", P"),
          msg
        );
      }
    } else if (ok) {
      renderSyncStrip("SYNC OK", "ok");
      setTimeout(function () {
        if (!activeBarrier) renderSyncStrip("", "ok");
      }, 2500);
    }
    if (isHost()) {
      resolveHostWaiters({
        ok: ok,
        timedOut: timedOut,
        laggers: laggers,
        barrierId: Number(msg.barrierId) || 0,
        label: String(msg.label || ""),
      });
    }
  }

  function onSyncStatus(msg) {
    if (!msg || !msg.slots) return;
    if (typeof window.risqueArtemisBeatSyncOnStatus === "function") {
      window.risqueArtemisBeatSyncOnStatus(msg);
    }
    var parts = [];
    [1, 2, 3].forEach(function (s) {
      var row = msg.slots[String(s)] || msg.slots[s];
      if (!row) return;
      var seqGap = Number(row.seqGap) || 0;
      var ageSec = row.ageMs != null ? Math.round(Number(row.ageMs) / 1000) : "?";
      var mark = seqGap > 2 || Number(row.ageMs) > 4000 ? "!" : "✓";
      if (row.missing) mark = "?";
      parts.push("P" + s + mark + "(" + ageSec + "s)");
    });
    if (parts.length && activeBarrier) {
      renderSyncStrip("SYNC " + (activeBarrier.label || "") + ": " + parts.join(" "), "wait");
    }
  }

  function onHostMirrorAck(msg) {
    var seq = Number(msg.seq) || 0;
    if (seq <= hostMirrorSeq) return;
    hostMirrorSeq = seq;
    var waiters = hostMirrorAckWaiters.slice();
    hostMirrorAckWaiters = [];
    waiters.forEach(function (fn) {
      try {
        fn(seq);
      } catch (eAck) {
        /* ignore */
      }
    });
    tryAckBarrier();
  }

  function waitForNextHostMirrorAck(afterSeq, timeoutMs) {
    return new Promise(function (resolve) {
      var floor = Number(afterSeq) || 0;
      if (hostMirrorSeq > floor) {
        resolve(hostMirrorSeq);
        return;
      }
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        resolve(hostMirrorSeq);
      }, timeoutMs || 2500);
      hostMirrorAckWaiters.push(function (seq) {
        if (done) return;
        if (seq <= floor) return;
        done = true;
        clearTimeout(timer);
        resolve(seq);
      });
    });
  }

  function pushHostMirror() {
    if (typeof window.risqueFlushMirrorPush === "function") {
      window.risqueFlushMirrorPush();
    } else if (typeof window.risqueMirrorPushGameState === "function") {
      window.risqueMirrorPushGameState();
    }
  }

  function openBarrierOnServer(opts) {
    send({
      type: "sync_barrier_open",
      label: String(opts.label || "sync"),
      beatId: String(opts.beatId || ""),
      stepIndex: Number(opts.stepIndex) || 0,
      totalSteps: Number(opts.totalSteps) || 0,
      expectPhase: opts.expectPhase != null ? String(opts.expectPhase) : "",
      expectUrlPhase: opts.expectUrlPhase != null ? String(opts.expectUrlPhase) : "",
      needSeq: opts.needSeq != null ? Number(opts.needSeq) : hostMirrorSeq || 0,
      minDisplayMs: Number(opts.minDisplayMs) || 0,
      timeoutMs: Number(opts.timeoutMs) || 8000,
    });
  }

  function waitForBarrierRelease(timeoutMs) {
    return new Promise(function (resolve) {
      var extra = (Number(timeoutMs) || 8000) + 2000;
      var timer = setTimeout(function () {
        resolve({ ok: false, timedOut: true, laggers: [], label: "local timeout" });
      }, extra);
      hostWaiters.push(function (result) {
        clearTimeout(timer);
        resolve(result);
      });
    });
  }

  /**
   * Host: wait until connected clients match expectPhase / needSeq (no mirror push).
   */
  window.risqueArtemisSyncGatePrepare = function (opts) {
    opts = opts || {};
    if (!isHost() || !lobbyLive()) {
      return Promise.resolve({ ok: true, laggers: [], timedOut: false });
    }
    var needSeq = Number(opts.needSeq) || hostMirrorSeq || 0;
    openBarrierOnServer({
      label: opts.label || "prepare",
      beatId: opts.beatId || "",
      stepIndex: opts.stepIndex || 0,
      totalSteps: opts.totalSteps || 0,
      expectPhase: opts.expectPhase || "",
      expectUrlPhase: opts.expectUrlPhase || "",
      needSeq: needSeq,
      minDisplayMs: opts.minDisplayMs || 0,
      timeoutMs: opts.timeoutMs || 8000,
    });
    tryAckBarrier();
    return waitForBarrierRelease(opts.timeoutMs);
  };

  /**
   * Host: push mirror, then wait until all laptops applied that seq + expectPhase.
   */
  window.risqueArtemisSyncGatePushAndWait = function (opts) {
    opts = opts || {};
    if (!isHost() || !lobbyLive()) {
      return Promise.resolve({ ok: true, laggers: [], timedOut: false });
    }
    pushHostMirror();
    var seqBefore = hostMirrorSeq;
    return waitForNextHostMirrorAck(seqBefore, 2500).then(function (seq) {
      var needSeq = Number(opts.needSeq) || seq || hostMirrorSeq || 0;
      openBarrierOnServer({
        label: opts.label || "push",
        beatId: opts.beatId || "",
        stepIndex: opts.stepIndex || 0,
        totalSteps: opts.totalSteps || 0,
        expectPhase: opts.expectPhase || "",
        expectUrlPhase: opts.expectUrlPhase || "",
        needSeq: needSeq,
        minDisplayMs: opts.minDisplayMs || 0,
        timeoutMs: opts.timeoutMs || 8000,
      });
      tryAckBarrier();
      return waitForBarrierRelease(opts.timeoutMs);
    });
  };

  window.risqueArtemisSyncGateWait = window.risqueArtemisSyncGatePrepare;

  window.risqueArtemisSyncGateNoteMirrorApplied = noteMirrorApplied;

  window.risqueArtemisHandleWsMessage = function (msg) {
    if (!msg || !msg.type) return false;
    if (msg.type === "sync_barrier") {
      onSyncBarrier(msg);
      return true;
    }
    if (msg.type === "sync_barrier_release") {
      onSyncBarrierRelease(msg);
      return true;
    }
    if (msg.type === "sync_status") {
      onSyncStatus(msg);
      return true;
    }
    if (msg.type === "public_state_ack") {
      onHostMirrorAck(msg);
      return true;
    }
    return false;
  };

  function startHeartbeat() {
    if (heartbeatTimer) return;
    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  window.addEventListener("risque-artemis-lobby-started", function () {
    startHeartbeat();
  });

  if (lobbyLive()) {
    startHeartbeat();
  }

  window.risqueArtemisSyncGateHostMirrorSeq = function () {
    return hostMirrorSeq;
  };

  if (typeof window.risqueArtemisDiag === "function") {
    window.risqueArtemisDiag("sync_gate_ready", "ARTEMIS sync gate loaded", {
      role: isHost() ? "host" : isNetClient() ? "client" : "unknown",
      slot: slotNum(),
    });
  }

  hideSyncUi();
})();
