"use strict";

/**
 * ARTEMIS beat-sheet sync — dev step-by-step reveal with min display time + network ack.
 */
(function () {
  if (!window.risqueArtemisMode) return;

  var SETUP_TOTAL_STEPS = 8;
  var overlayEl = null;
  var overlayTitleEl = null;
  var overlayDetailEl = null;
  var overlaySlotsEl = null;
  var overlayTimerEl = null;
  var overlayHideTimer = null;
  var countdownTimer = null;
  var activeBeat = null;

  var BEATS = {
    board_ready: { stepIndex: 0, label: "Board ready", minDisplayMs: 1500 },
    welcome: { stepIndex: 1, label: "Welcome", minDisplayMs: 3000 },
    first_card_select: { stepIndex: 2, label: "First card selection", minDisplayMs: 3000 },
    deal: { stepIndex: 3, label: "Deal cards", minDisplayMs: 1500 },
    deal_complete: { stepIndex: 4, label: "Deal complete", minDisplayMs: 3000 },
    deploy_order_select: { stepIndex: 5, label: "Deploy order selection", minDisplayMs: 3000 },
  };

  function slotLabel(slot) {
    var n = Number(slot) || 0;
    if (n === 1) return "Guido";
    if (n === 2) return "Mictor";
    if (n === 3) return "Nooch";
    return "P" + n;
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.getElementById("risque-artemis-beat-sync-overlay");
    if (overlayEl) {
      overlayTitleEl = overlayEl.querySelector(".risque-artemis-beat-sync-title");
      overlayDetailEl = overlayEl.querySelector(".risque-artemis-beat-sync-detail");
      overlaySlotsEl = overlayEl.querySelector(".risque-artemis-beat-sync-slots");
      overlayTimerEl = overlayEl.querySelector(".risque-artemis-beat-sync-timer");
      return overlayEl;
    }
    overlayEl = document.createElement("div");
    overlayEl.id = "risque-artemis-beat-sync-overlay";
    overlayEl.className = "risque-artemis-beat-sync-overlay";
    overlayEl.setAttribute("aria-live", "polite");
    overlayEl.hidden = true;
    overlayEl.innerHTML =
      '<div class="risque-artemis-beat-sync-card">' +
      '<div class="risque-artemis-beat-sync-step"></div>' +
      '<div class="risque-artemis-beat-sync-title"></div>' +
      '<div class="risque-artemis-beat-sync-detail"></div>' +
      '<div class="risque-artemis-beat-sync-slots"></div>' +
      '<div class="risque-artemis-beat-sync-timer"></div>' +
      "</div>";
    document.body.appendChild(overlayEl);
    overlayTitleEl = overlayEl.querySelector(".risque-artemis-beat-sync-title");
    overlayDetailEl = overlayEl.querySelector(".risque-artemis-beat-sync-detail");
    overlaySlotsEl = overlayEl.querySelector(".risque-artemis-beat-sync-slots");
    overlayTimerEl = overlayEl.querySelector(".risque-artemis-beat-sync-timer");
    return overlayEl;
  }

  function clearCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function hideOverlaySoon(delayMs) {
    if (overlayHideTimer) clearTimeout(overlayHideTimer);
    overlayHideTimer = setTimeout(function () {
      overlayHideTimer = null;
      if (overlayEl) overlayEl.hidden = true;
      activeBeat = null;
      clearCountdown();
    }, delayMs || 1200);
  }

  /** Beat-sync overlay retired — host hold steps still gate on the server. */
  function hideBeatOverlay() {
    var root = document.getElementById("risque-artemis-beat-sync-overlay");
    if (root) {
      root.hidden = true;
      root.style.display = "none";
    }
    overlayEl = root;
    activeBeat = null;
    clearCountdown();
    if (overlayHideTimer) {
      clearTimeout(overlayHideTimer);
      overlayHideTimer = null;
    }
  }

  function showOverlay(beat) {
    hideBeatOverlay();
  }

  function renderSlotStatus(msg) {
    if (!overlaySlotsEl || !msg) return;
    var acks = msg.acks || {};
    var slots = msg.slots || {};
    var parts = [];
    [1, 2, 3].forEach(function (s) {
      var ack = acks[String(s)] || acks[s];
      var row = slots[String(s)] || slots[s];
      var name = slotLabel(s);
      var mark = ack ? "✓" : row && row.missing ? "?" : "…";
      var ph = row && row.gamePhase ? row.gamePhase : "";
      parts.push(name + " " + mark + (ph ? " (" + ph + ")" : ""));
    });
    overlaySlotsEl.textContent = parts.join(" · ");
  }

  window.risqueArtemisBeatSyncOnBarrier = function (barrier) {
    hideBeatOverlay();
  };

  window.risqueArtemisBeatSyncOnStatus = function (msg) {
    /* slot status UI retired */
  };

  window.risqueArtemisBeatSyncOnLocalAck = function (barrier) {
    /* overlay retired */
  };

  window.risqueArtemisBeatSyncOnRelease = function (msg) {
    hideBeatOverlay();
  };

  function mergeBeatOpts(opts) {
    opts = opts || {};
    var beat = BEATS[opts.beatId] || {};
    return {
      beatId: opts.beatId || "",
      label: opts.label || beat.label || "Sync",
      stepIndex: opts.stepIndex != null ? opts.stepIndex : beat.stepIndex || 0,
      totalSteps: opts.totalSteps != null ? opts.totalSteps : SETUP_TOTAL_STEPS,
      minDisplayMs: opts.minDisplayMs != null ? opts.minDisplayMs : beat.minDisplayMs || 0,
      expectPhase: opts.expectPhase != null ? String(opts.expectPhase) : "",
      expectUrlPhase: opts.expectUrlPhase != null ? String(opts.expectUrlPhase) : "",
      needSeq: opts.needSeq || 0,
      timeoutMs: opts.timeoutMs || Math.max(12000, (Number(opts.minDisplayMs) || 3000) + 8000),
      pushMirror: !!opts.pushMirror,
    };
  }

  window.risqueArtemisBeatHostHoldStep = function (opts) {
    var o = mergeBeatOpts(opts);
    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag("beat_hold_start", o.label, o);
    }
    if (o.pushMirror && typeof window.risqueArtemisSyncGatePushAndWait === "function") {
      return window.risqueArtemisSyncGatePushAndWait(o);
    }
    if (typeof window.risqueArtemisSyncGatePrepare === "function") {
      return window.risqueArtemisSyncGatePrepare(o);
    }
    return Promise.resolve({ ok: true, laggers: [], timedOut: false });
  };

  /** Step 0 — all laptops on board before fresh game start. */
  window.risqueArtemisBeatHostGateBeforeStart = function () {
    return window.risqueArtemisBeatHostHoldStep({
      beatId: "board_ready",
      expectPhase: "",
      needSeq: 0,
      pushMirror: false,
      timeoutMs: 12000,
    });
  };

  window.risqueArtemisBeatHostGateBeforeLoad = function () {
    return window.risqueArtemisBeatHostGateBeforeStart();
  };

  hideBeatOverlay();
})();
