"use strict";

/**
 * ARTEMIS auto-diagnostics — all laptops report to server; host writes
 * logs/artemis-last-report.json for Cursor to read (no manual copy/paste).
 */
(function () {
  var HANDOFF_STUCK_MS = 10000;
  var handoffWatchSince = 0;
  var handoffWatchSeq = 0;
  var handoffWatchFired = false;

  function roleLabel() {
    if (window.risqueArtemisHost) return "host";
    if (window.risqueArtemisNetClient) return "client";
    return "unknown";
  }

  function slotLabel() {
    return Number(window.risqueArtemisPlayerSlot) || 0;
  }

  function sendDiag(payload) {
    payload = payload || {};
    var row = {
      kind: String(payload.kind || "event"),
      role: roleLabel(),
      slot: slotLabel(),
      phase: window.gameState ? String(window.gameState.phase || "") : "",
      currentPlayer: window.gameState ? String(window.gameState.currentPlayer || "") : "",
      controlSeq: window.gameState ? Number(window.gameState.risqueArtemisControlSeq) || 0 : 0,
      summary: payload.summary ? String(payload.summary) : "",
      detail: payload.detail || null,
    };
    if (payload.nextPlayer) row.nextPlayer = String(payload.nextPlayer);
    if (payload.reason) row.reason = String(payload.reason);
    if (payload.controlSeq != null) row.controlSeq = Number(payload.controlSeq) || 0;
    if (payload.slot != null) row.slot = Number(payload.slot) || 0;

    try {
      var buf = JSON.parse(sessionStorage.getItem("risqueArtemisDiagLocal") || "[]");
      if (!Array.isArray(buf)) buf = [];
      var localRow = { t: Date.now(), iso: new Date().toISOString() };
      Object.keys(row).forEach(function (k) {
        localRow[k] = row[k];
      });
      buf.push(localRow);
      while (buf.length > 40) buf.shift();
      sessionStorage.setItem("risqueArtemisDiagLocal", JSON.stringify(buf));
    } catch (eLocal) {
      /* ignore */
    }

    if (typeof window.risqueArtemisSend === "function") {
      try {
        window.risqueArtemisSend({ type: "diag_event", event: row });
      } catch (eSend) {
        /* ignore */
      }
    }
    return row;
  }

  window.risqueArtemisDiag = function (kind, summary, detail) {
    return sendDiag({
      kind: kind,
      summary: summary || "",
      detail: detail || null,
    });
  };

  window.risqueArtemisDiagDeployConfirmSent = function (opts) {
    opts = opts || {};
    return sendDiag({
      kind: "deploy_confirm_sent",
      slot: opts.slot,
      controlSeq: opts.controlSeq,
      nextPlayer: opts.nextPlayer,
      summary:
        "P" +
        String(opts.slot || "?") +
        " sent deploy_confirm seq=" +
        String(opts.controlSeq || "?") +
        " → " +
        String(opts.nextPlayer || "?"),
    });
  };

  window.risqueArtemisDiagDeployConfirmRecv = function (opts) {
    opts = opts || {};
    return sendDiag({
      kind: "deploy_confirm_recv",
      slot: opts.slot,
      controlSeq: opts.controlSeq,
      nextPlayer: opts.nextPlayer,
      summary:
        "Host received deploy_confirm from P" +
        String(opts.slot || "?") +
        " seq=" +
        String(opts.controlSeq || "?"),
    });
  };

  window.risqueArtemisDiagDeployAdvance = function (opts) {
    opts = opts || {};
    return sendDiag({
      kind: "deploy_handoff_advance",
      slot: opts.slot,
      controlSeq: opts.controlSeq,
      nextPlayer: opts.nextPlayer,
      summary:
        "Host advanced handoff to " +
        String(opts.nextPlayer || opts.currentPlayer || "?") +
        " seq=" +
        String(opts.controlSeq || "?"),
    });
  };

  window.risqueArtemisDiagDeployReject = function (opts) {
    opts = opts || {};
    return sendDiag({
      kind: "deploy_handoff_reject",
      slot: opts.slot,
      controlSeq: opts.controlSeq,
      reason: opts.reason,
      summary:
        "Deploy handoff rejected P" +
        String(opts.slot || "?") +
        ": " +
        String(opts.reason || "unknown"),
    });
  };

  window.risqueArtemisDiagDeployFinishSent = function (opts) {
    opts = opts || {};
    return sendDiag({
      kind: "deploy_finish_sent",
      slot: opts.slot,
      controlSeq: opts.controlSeq,
      summary:
        "P" +
        String(opts.slot || "?") +
        " sent deploy_finish seq=" +
        String(opts.controlSeq || "?"),
    });
  };

  window.risqueArtemisDiagDeployFinishRecv = function (opts) {
    opts = opts || {};
    return sendDiag({
      kind: "deploy_finish_recv",
      slot: opts.slot,
      controlSeq: opts.controlSeq,
      summary:
        "Host received deploy_finish from P" +
        String(opts.slot || "?") +
        " seq=" +
        String(opts.controlSeq || "?"),
    });
  };

  window.risqueArtemisDiagDeployFinishOk = function (opts) {
    opts = opts || {};
    return sendDiag({
      kind: "deploy_finish_ok",
      slot: opts.slot,
      controlSeq: opts.controlSeq,
      summary:
        "Host finished setup deploy after P" +
        String(opts.slot || "?") +
        " seq=" +
        String(opts.controlSeq || "?"),
    });
  };

  window.risqueArtemisDiagDeployFinishReject = function (opts) {
    opts = opts || {};
    return sendDiag({
      kind: "deploy_finish_reject",
      slot: opts.slot,
      controlSeq: opts.controlSeq,
      reason: opts.reason,
      summary:
        "Deploy finish rejected P" +
        String(opts.slot || "?") +
        ": " +
        String(opts.reason || "unknown"),
    });
  };

  function resetHandoffWatch() {
    handoffWatchSince = 0;
    handoffWatchSeq = 0;
    handoffWatchFired = false;
  }

  function watchHandoffPending() {
    var pending = Number(window.risqueArtemisDeployHandoffPending) || 0;
    if (pending <= 0) {
      resetHandoffWatch();
      return;
    }
    if (handoffWatchSeq !== pending) {
      handoffWatchSeq = pending;
      handoffWatchSince = Date.now();
      handoffWatchFired = false;
    }
    if (handoffWatchFired || !handoffWatchSince) return;
    if (Date.now() - handoffWatchSince < HANDOFF_STUCK_MS) return;
    handoffWatchFired = true;
    sendDiag({
      kind: "handoff_stuck",
      controlSeq: pending,
      nextPlayer: String(window.risqueArtemisDeployHandoffPlayer || ""),
      summary:
        roleLabel() +
        " P" +
        slotLabel() +
        " handoff pending >10s (expected seq " +
        pending +
        " → " +
        String(window.risqueArtemisDeployHandoffPlayer || "?") +
        ")",
      detail: {
        handoffPlayer: window.risqueArtemisDeployHandoffPlayer,
        relinquishedSeq: window.risqueArtemisDeployRelinquishedSeq,
      },
    });
  }

  setInterval(watchHandoffPending, 1000);

  var lastCardplaySnapshotKey = "";
  var lastCardplaySnapshotAt = 0;

  function cardplayClientSnapshot() {
    if (!window.risqueArtemisMode || window.risqueArtemisHost) return;
    var gs = window.gameState;
    if (!gs || String(gs.phase || "") !== "cardplay") return;
    if (typeof window.risqueArtemisReconcileClientPlayMode === "function") {
      window.risqueArtemisReconcileClientPlayMode(gs);
    }
    if (typeof window.risqueArtemisEnsureClientCardplayHand === "function") {
      window.risqueArtemisEnsureClientCardplayHand(gs);
    }
    var cp = String(gs.currentPlayer || "");
    var pl = (gs.players || []).find(function (p) {
      return p && String(p.name || "") === cp;
    });
    var handCards = pl && Array.isArray(pl.cards) ? pl.cards.length : 0;
    var cardCount = pl ? Number(pl.cardCount) || 0 : 0;
    var snap = {
      clientPlaying: !!window.risqueArtemisClientPlaying,
      viewPublic: document.documentElement.classList.contains("risque-view-public"),
      controlsPresent:
        typeof window.risqueArtemisCardplayControlsPresent === "function" &&
        window.risqueArtemisCardplayControlsPresent(),
      handEmptyUi:
        typeof window.risqueArtemisCardplayUiShowsEmptyHand === "function" &&
        window.risqueArtemisCardplayUiShowsEmptyHand(),
      handCards: handCards,
      cardCount: cardCount,
      controlSlot: gs.artemisControlSlot,
      togglesOk: !!document.getElementById("risque-private-stats-toggle"),
      voiceOk: !!document.getElementById("control-voice"),
    };
    var snapKey = JSON.stringify(snap);
    var now = Date.now();
    if (snapKey === lastCardplaySnapshotKey && now - lastCardplaySnapshotAt < 15000) return;
    lastCardplaySnapshotKey = snapKey;
    lastCardplaySnapshotAt = now;
    sendDiag({
      kind: "cardplay_client_snapshot",
      summary: "P" + slotLabel() + " cardplay client snapshot",
      detail: snap,
    });
  }

  setInterval(cardplayClientSnapshot, 8000);

  /** Log HUD / phase button clicks + whether anything visibly changed (~2.5s). */
  var UI_CLICK_RESPONSE_MS = 2500;
  var UI_CLICK_DEBOUNCE_MS = 350;
  var uiClickLastKey = "";
  var uiClickLastAt = 0;
  var uiClickSeq = 0;
  var uiClickFollowUpKinds = {
    cardplay_skip_income: 1,
    cardplay_continue_income: 1,
    cardplay_host_income_advance: 1,
    mock_cardplay_continue: 1,
    mock_income_continue: 1,
    income_continue: 1,
    deploy_confirm_sent: 1,
    deploy_finish_sent: 1,
    player_state_forwarded: 1,
  };

  function uiClickLabel(el) {
    if (!el) return "?";
    if (el.id) return "#" + el.id;
    var t = String(el.textContent || el.value || el.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim();
    if (t.length > 48) t = t.slice(0, 45) + "...";
    if (t) return t;
    if (el.className) return String(el.className).split(/\s+/)[0] || el.tagName;
    return el.tagName || "?";
  }

  function uiClickIsToggle(el) {
    if (!el) return false;
    if (el.id === "risque-private-stats-toggle" || el.id === "control-voice") return true;
    if (el.closest && el.closest("#risque-private-stats-toggle, #control-voice")) return true;
    return el.getAttribute && el.getAttribute("role") === "switch";
  }

  function uiClickToggleOpen(el) {
    if (!el) return null;
    if (el.id === "risque-private-stats-toggle") {
      return !document.documentElement.classList.contains("risque-private-stats-hidden");
    }
    if (el.id === "control-voice" || (el.closest && el.closest("#control-voice"))) {
      var panel = document.getElementById("control-voice-panel");
      return !!(panel && !panel.hidden);
    }
    return null;
  }

  function uiClickSnapshot(el) {
    return {
      phase: window.gameState ? String(window.gameState.phase || "") : "",
      controlSeq: window.gameState ? Number(window.gameState.risqueArtemisControlSeq) || 0 : 0,
      currentPlayer: window.gameState ? String(window.gameState.currentPlayer || "") : "",
      clientPlaying: !!window.risqueArtemisClientPlaying,
      viewPublic: document.documentElement.classList.contains("risque-view-public"),
      elGone: el ? !document.body.contains(el) : true,
      elDisabled: !!(el && el.disabled),
      toggleOpen: uiClickIsToggle(el) ? uiClickToggleOpen(el) : null,
    };
  }

  function uiClickFollowUpKind(sinceMs) {
    try {
      var buf = JSON.parse(sessionStorage.getItem("risqueArtemisDiagLocal") || "[]");
      if (!Array.isArray(buf)) return "";
      for (var i = buf.length - 1; i >= 0; i--) {
        var row = buf[i];
        if (!row || row.t < sinceMs) break;
        if (uiClickFollowUpKinds[row.kind]) return String(row.kind);
      }
    } catch (eFu) {
      /* ignore */
    }
    return "";
  }

  function uiClickEvaluateResponse(before, after, meta) {
    if (before.phase !== after.phase) {
      return { ok: true, reason: "phase_changed", toPhase: after.phase };
    }
    if (before.controlSeq !== after.controlSeq) {
      return { ok: true, reason: "control_seq_changed", controlSeq: after.controlSeq };
    }
    if (before.currentPlayer !== after.currentPlayer) {
      return { ok: true, reason: "turn_changed", currentPlayer: after.currentPlayer };
    }
    if (meta.isToggle && before.toggleOpen !== null && after.toggleOpen !== null && before.toggleOpen !== after.toggleOpen) {
      return { ok: true, reason: "toggle_changed", open: after.toggleOpen };
    }
    if (before.clientPlaying !== after.clientPlaying || before.viewPublic !== after.viewPublic) {
      return { ok: true, reason: "play_mode_changed", clientPlaying: after.clientPlaying, viewPublic: after.viewPublic };
    }
    if (after.elGone) return { ok: true, reason: "control_removed" };
    if (!before.elDisabled && after.elDisabled) return { ok: true, reason: "button_disabled" };
    var follow = uiClickFollowUpKind(meta.at);
    if (follow) return { ok: true, reason: "follow_up_diag", followKind: follow };
    if (meta.wasDisabled) return { ok: false, reason: "clicked_while_disabled" };
    return { ok: false, reason: "no_visible_change" };
  }

  function uiClickTarget(el) {
    if (!el || !el.closest) return null;
    return el.closest(
      "button, [role='button'], input[type='button'], input[type='submit'], " +
        ".risque-artemis-mock-btn, .cardplay-button, .income-button, " +
        "#risque-private-stats-toggle, #control-voice, label[for]"
    );
  }

  function wireUiClickDiagnostics() {
    if (!window.risqueArtemisMode || window.__risqueArtemisUiClickWired) return;
    window.__risqueArtemisUiClickWired = true;
    document.addEventListener(
      "click",
      function (ev) {
        if (!window.risqueArtemisLobbyStarted) return;
        var raw = ev.target;
        var el = uiClickTarget(raw);
        if (!el) return;
        var key = uiClickLabel(el);
        var now = Date.now();
        if (key === uiClickLastKey && now - uiClickLastAt < UI_CLICK_DEBOUNCE_MS) return;
        uiClickLastKey = key;
        uiClickLastAt = now;
        uiClickSeq += 1;
        var clickId = uiClickSeq;
        var wasDisabled = !!el.disabled;
        var isToggle = uiClickIsToggle(el);
        var before = uiClickSnapshot(el);
        var meta = { at: now, clickId: clickId, label: key, isToggle: isToggle, wasDisabled: wasDisabled };
        sendDiag({
          kind: "ui_click",
          summary: "P" + slotLabel() + " clicked " + key,
          detail: {
            clickId: clickId,
            label: key,
            id: el.id || "",
            disabled: wasDisabled,
            isToggle: isToggle,
            phase: before.phase,
            currentPlayer: before.currentPlayer,
            clientPlaying: before.clientPlaying,
            viewPublic: before.viewPublic,
          },
        });
        setTimeout(function () {
          var after = uiClickSnapshot(el);
          var verdict = uiClickEvaluateResponse(before, after, meta);
          sendDiag({
            kind: verdict.ok ? "ui_click_ok" : "ui_click_no_response",
            summary:
              "P" +
              slotLabel() +
              " " +
              key +
              " → " +
              (verdict.ok ? "responded" : "no response") +
              " (" +
              verdict.reason +
              ")",
            detail: {
              clickId: clickId,
              label: key,
              responded: verdict.ok,
              reason: verdict.reason,
              before: before,
              after: after,
              followKind: verdict.followKind || null,
              toPhase: verdict.toPhase || null,
            },
          });
        }, UI_CLICK_RESPONSE_MS);
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUiClickDiagnostics);
  } else {
    wireUiClickDiagnostics();
  }

  window.risqueArtemisDiagOpenReport = function () {
    var url = "/api/artemis/diag";
    try {
      window.open(url, "_blank");
    } catch (eOpen) {
      /* ignore */
    }
  };
})();
