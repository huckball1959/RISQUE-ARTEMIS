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

  /**
   * m317 — Ground-truth probe for the active player's cardplay recap shelf. Every prior fix (m312-m316)
   * edited CSS on the assumption that Mictor's animation windows are the `--host-cardplay-recap` shelf
   * panes, but the changes had no visible effect even though the build IS loaded. This reports the REAL
   * rendered box sizes + class names + which element carries a constraining computed height/min/max so we
   * can see exactly which node is deciding the pane height (instead of guessing at the cascade).
   */
  function measureRecapShelfLayout() {
    try {
      function box(el, extraProps) {
        if (!el) return null;
        var cs = window.getComputedStyle(el);
        var rect = el.getBoundingClientRect();
        var out = {
          h: Math.round(rect.height),
          w: Math.round(rect.width),
          minH: cs.minHeight,
          maxH: cs.maxHeight,
          height: cs.height,
          flex: cs.flexGrow + " " + cs.flexShrink + " " + cs.flexBasis,
          disp: cs.display,
          pad: cs.padding,
        };
        if (extraProps) {
          out.top = cs.top;
          out.bottom = cs.bottom;
          out.pos = cs.position;
        }
        return out;
      }
      var root = document.getElementById("runtime-hud-root");
      if (!root) return { note: "no runtime-hud-root" };
      var overlay = document.getElementById("risque-public-cardplay-recap-overlay");
      if (!overlay) return { note: "no recap overlay (not in cardplay recap)" };
      var shelf = overlay.querySelector(".risque-public-cardplay-recap-panel--shelf");
      var upper = overlay.querySelector(".risque-public-cp-shelf-upper");
      var lower = overlay.querySelector(".risque-public-cp-shelf-lower");
      var card = overlay.querySelector(".risque-public-cp-shelf-card");
      var procImg =
        overlay.querySelector(".risque-public-cp-shelf-upper .risque-public-book-voice-card-img") ||
        overlay.querySelector(".risque-public-cp-shelf-upper .risque-public-cardplay-recap-card-img");
      return {
        htmlClass: document.documentElement.className,
        rootClass: root.className,
        viewportH: window.innerHeight,
        root: box(root, true),
        mainPanel: box(document.getElementById("hud-main-panel")),
        overlay: box(overlay),
        shelf: box(shelf),
        upper: box(upper),
        lower: box(lower),
        card: card ? box(card) : null,
        procImg: procImg ? box(procImg) : null,
      };
    } catch (e) {
      return { err: String(e) };
    }
  }

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
      recapLayout: measureRecapShelfLayout(),
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

  /* m317 — fast recap-shelf layout probe: the recap overlay is only on screen for a few seconds during
   * the book animation, so the 8s snapshot can miss it. Fire every 1.2s while the overlay exists, sending
   * only when the measured layout changes (and only for non-host clients — the active player we care about). */
  var lastRecapLayoutKey = "";
  function recapLayoutProbe() {
    if (!window.risqueArtemisMode || window.risqueArtemisHost) return;
    if (!document.getElementById("risque-public-cardplay-recap-overlay")) return;
    var layout = measureRecapShelfLayout();
    var key = JSON.stringify(layout);
    if (key === lastRecapLayoutKey) return;
    lastRecapLayoutKey = key;
    sendDiag({
      kind: "cardplay_recap_layout",
      summary: "P" + slotLabel() + " recap shelf layout probe",
      detail: layout,
    });
  }
  setInterval(recapLayoutProbe, 1200);

  /* m319 — active-attacker control-voice probe. Mictor (active client) sees her dice but no battle
   * outcome text ("MICTOR LOSES 2"), while spectators show it fine. applyBattleRoundAfterRoll +
   * showPrompt both write the outcome into #control-voice-text on the active client, so something is
   * clearing/repainting it afterward. Sample the voice DOM + outcome fields on change while the active
   * client is in attack, so we can see the value get set and then wiped. */
  function measureAttackVoice() {
    try {
      function vbox(el) {
        if (!el) return null;
        var cs = window.getComputedStyle(el);
        var rect = el.getBoundingClientRect();
        return {
          text: String(el.textContent || "").slice(0, 80),
          html: String(el.innerHTML || "").slice(0, 120),
          disp: cs.display,
          vis: cs.visibility,
          op: cs.opacity,
          h: Math.round(rect.height),
          w: Math.round(rect.width),
        };
      }
      var gs = window.gameState || {};
      var cvEl = document.getElementById("control-voice");
      var cvCs = cvEl ? window.getComputedStyle(cvEl) : null;
      return {
        phase: String(gs.phase || ""),
        attackPhase: String(gs.attackPhase || ""),
        htmlClass: document.documentElement.className,
        bodyPhaseAttr: String(document.body.getAttribute("data-risque-phase") || ""),
        cvClass: cvEl ? cvEl.className : "(no #control-voice)",
        cvMinHeight: cvCs ? cvCs.minHeight : "",
        cvHeightCss: cvCs ? cvCs.height : "",
        outcomePrimary: gs.risqueAttackOutcomePrimary != null ? String(gs.risqueAttackOutcomePrimary) : "",
        outcomeReport: gs.risqueAttackOutcomeReport != null ? String(gs.risqueAttackOutcomeReport) : "",
        cvControlVoice: gs.risqueControlVoice || null,
        campaignActive:
          typeof window.risqueIsAttackCampaignActive === "function" && window.risqueIsAttackCampaignActive(),
        voice: vbox(cvEl),
        voiceText: vbox(document.getElementById("control-voice-text")),
        voiceReport: vbox(document.getElementById("control-voice-report")),
        displayIsPublic: !!window.risqueDisplayIsPublic,
      };
    } catch (e) {
      return { err: String(e) };
    }
  }
  var lastAttackVoiceKey = "";
  function attackVoiceProbe() {
    if (!window.risqueArtemisMode || window.risqueArtemisHost) return;
    var gs = window.gameState;
    if (!gs || String(gs.phase || "") !== "attack") return;
    var mine =
      (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) ||
      (typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
        window.risqueArtemisClientNameMatchesCurrent(gs));
    if (!mine) return;
    var info = measureAttackVoice();
    var key = JSON.stringify(info);
    if (key === lastAttackVoiceKey) return;
    lastAttackVoiceKey = key;
    sendDiag({
      kind: "attack_voice_probe",
      summary: "P" + slotLabel() + " active-attacker control voice",
      detail: info,
    });
  }
  setInterval(attackVoiceProbe, 400);

  function receiveCardHandNames(gs) {
    if (!gs || !gs.players || !gs.currentPlayer) return [];
    var cp = String(gs.currentPlayer || "");
    var pl = gs.players.find(function (p) {
      return p && String(p.name || "") === cp;
    });
    if (!pl || !Array.isArray(pl.cards)) return [];
    return pl.cards.map(function (c) {
      return typeof c === "string" ? c : c && c.name ? String(c.name) : "";
    });
  }

  /** Fired from receiveCardRunDisplay — host or active client. Say "read diagnostics" after receive card. */
  window.risqueArtemisDiagReceiveCardDisplay = function (opts) {
    if (!window.risqueArtemisMode) return;
    opts = opts || {};
    var snap = opts.snap && typeof opts.snap === "object" ? opts.snap : {};
    var gs = window.gameState;
    var player = snap.currentPlayer || (gs && gs.currentPlayer) || "?";
    var drawn =
      opts.drawnThisStep != null && String(opts.drawnThisStep).trim() !== ""
        ? String(opts.drawnThisStep)
        : snap.drawnThisStep != null && String(snap.drawnThisStep).trim() !== ""
          ? String(snap.drawnThisStep)
          : snap.lastCardDrawn != null && String(snap.lastCardDrawn).trim() !== ""
            ? String(snap.lastCardDrawn)
            : null;
    var hand = Array.isArray(opts.handNames) ? opts.handNames : receiveCardHandNames(gs);
    var ui = {
      dualStrip: !!opts.uiDualStrip,
      staging: !!opts.uiStaging,
      continueBtn: !!opts.uiContinueBtn,
      compactRoot: !!opts.uiCompactRoot,
    };
    var prettyDraw = drawn ? String(drawn).replace(/_/g, " ").toUpperCase() : "";
    var summary;
    if (drawn) {
      summary =
        String(player).toUpperCase() +
        " RECEIVE CARD: drew " +
        prettyDraw +
        " (hand now " +
        hand.length +
        " cards)";
    } else if (snap.reasonDeckBlocked) {
      summary =
        String(player).toUpperCase() +
        " RECEIVE CARD: no deck draw — " +
        String(snap.reasonDeckBlocked);
    } else {
      summary = String(player).toUpperCase() + " RECEIVE CARD: display ran, no new card drawn";
    }
    return sendDiag({
      kind: drawn ? "receive_card_awarded" : "receive_card_display",
      summary: summary,
      detail: {
        player: player,
        drawnThisStep: drawn,
        lastCardDrawn: snap.lastCardDrawn != null ? snap.lastCardDrawn : null,
        cardAwardedThisTurn: !!snap.cardAwardedThisTurn,
        cardEarnedViaAttack: !!snap.cardEarnedViaAttack,
        cardEarnedViaCardplay: !!snap.cardEarnedViaCardplay,
        reasonDeckBlocked: snap.reasonDeckBlocked || "",
        deckLength: snap.deckLength,
        handNames: hand,
        handCount: hand.length,
        uiPresent: ui,
        eligibility: snap,
      },
    });
  };

  window.risqueArtemisDiagReceiveCardContinue = function (opts) {
    if (!window.risqueArtemisMode) return;
    opts = opts || {};
    var gs = window.gameState;
    var finished = opts.finishedPlayer || (gs && gs.currentPlayer) || "?";
    var hand = Array.isArray(opts.handNames) ? opts.handNames : receiveCardHandNames(gs);
    var lastDraw = opts.lastCardDrawn != null ? opts.lastCardDrawn : gs && gs.lastCardDrawn;
    return sendDiag({
      kind: "receive_card_continue",
      summary:
        "P" +
        slotLabel() +
        " CONTINUE after receive card (" +
        String(finished).toUpperCase() +
        ", hand " +
        hand.length +
        " cards" +
        (lastDraw ? ", last draw " + String(lastDraw).replace(/_/g, " ").toUpperCase() : "") +
        ")",
      detail: {
        finishedPlayer: finished,
        lastCardDrawn: lastDraw,
        handNames: hand,
        handCount: hand.length,
        nextPhase: "cardplay",
      },
    });
  };

  var lastReceiveCardSnapshotKey = "";
  var lastReceiveCardSnapshotAt = 0;

  function receiveCardSnapshot() {
    if (!window.risqueArtemisMode) return;
    var gs = window.gameState;
    if (!gs) return;
    var ph = String(gs.phase || "");
    if (ph !== "receivecard" && ph !== "getcard") return;
    var hand = receiveCardHandNames(gs);
    var snap = {
      phase: ph,
      currentPlayer: String(gs.currentPlayer || ""),
      lastCardDrawn: gs.lastCardDrawn != null ? gs.lastCardDrawn : null,
      cardAwardedThisTurn: !!gs.cardAwardedThisTurn,
      cardEarnedViaAttack: !!gs.cardEarnedViaAttack,
      cardEarnedViaCardplay: !!gs.cardEarnedViaCardplay,
      handCount: hand.length,
      handNames: hand,
      uiPresent: {
        dualStrip: !!document.getElementById("receivecard-hand-strip-upper"),
        staging: !!document.getElementById("receivecard-staging-grid"),
        continueBtn: !!document.getElementById("receivecard-btn-end"),
        compactRoot: !!document.querySelector(".receivecard-compact-root"),
      },
      clientPlaying: !!window.risqueArtemisClientPlaying,
      viewPublic: document.documentElement.classList.contains("risque-view-public"),
    };
    var snapKey = JSON.stringify(snap);
    var now = Date.now();
    if (snapKey === lastReceiveCardSnapshotKey && now - lastReceiveCardSnapshotAt < 12000) return;
    lastReceiveCardSnapshotKey = snapKey;
    lastReceiveCardSnapshotAt = now;
    sendDiag({
      kind: "receive_card_snapshot",
      summary:
        "P" +
        slotLabel() +
        " receive-card snapshot " +
        String(gs.currentPlayer || "?").toUpperCase() +
        (gs.lastCardDrawn ? " drew " + String(gs.lastCardDrawn).replace(/_/g, " ").toUpperCase() : ""),
      detail: snap,
    });
  }

  setInterval(receiveCardSnapshot, 8000);

  var CARDPLAY_ORDER_PROBE_MS = 2000;
  var CARDPLAY_ORDER_PROBE_WINDOW_MS = 50000;
  var cardplayOrderProbeTimer = null;
  var cardplayOrderProbeUntil = 0;
  var cardplayOrderProbeContext = null;

  function urlPhaseParam() {
    try {
      return String(new URL(window.location.href).searchParams.get("phase") || "");
    } catch (eUrl) {
      return "";
    }
  }

  function cardplayOrderProbeDetail() {
    var gs = window.gameState;
    var livePh = gs ? String(gs.phase || "") : "";
    var urlPh = urlPhaseParam();
    var selectKind =
      gs && gs.risquePublicUiSelectKind != null
        ? String(gs.risquePublicUiSelectKind)
        : gs && gs.selectionPhase != null
          ? String(gs.selectionPhase)
          : "";
    return {
      urlPhase: urlPh,
      gamePhase: livePh,
      selectKind: selectKind,
      setupComplete: !!(gs && gs.setupComplete),
      currentPlayer: gs ? String(gs.currentPlayer || "") : "",
      controlSlot: gs ? Number(gs.artemisControlSlot) || 0 : 0,
      mirrorSeq: gs ? Number(gs.risquePublicMirrorSeq) || 0 : 0,
      clientPlaying: !!window.risqueArtemisClientPlaying,
      deployChromeActive:
        typeof window.risqueArtemisClientSetupDeployChromeActive === "function" &&
        window.risqueArtemisClientSetupDeployChromeActive(),
      deploySessionActive:
        typeof window.risqueArtemisClientHasActiveDeploySession === "function" &&
        window.risqueArtemisClientHasActiveDeploySession(),
      lastMirrorReject: window.__risqueArtemisLastMirrorReject || null,
      context: cardplayOrderProbeContext || null,
    };
  }

  function cardplayOrderProbeIsLagging(detail) {
    if (!detail) return false;
    var livePh = String(detail.gamePhase || "");
    var urlPh = String(detail.urlPhase || "");
    if (livePh === "deploy" && (urlPh === "playerSelect" || urlPh === "cardplay")) return true;
    if (livePh === "playerSelect" && urlPh === "cardplay") return true;
    if (detail.lastMirrorReject && String(detail.lastMirrorReject.incomingPhase || "") === "playerSelect") {
      return true;
    }
    return false;
  }

  function cardplayOrderProbeTick() {
    if (!window.risqueArtemisLobbyStarted) return;
    if (Date.now() > cardplayOrderProbeUntil) {
      if (cardplayOrderProbeTimer) {
        clearInterval(cardplayOrderProbeTimer);
        cardplayOrderProbeTimer = null;
      }
      sendDiag({
        kind: "cardplay_order_probe_end",
        summary: "P" + slotLabel() + " cardplay-order probe ended",
        detail: cardplayOrderProbeDetail(),
      });
      return;
    }
    var detail = cardplayOrderProbeDetail();
    var lagging = cardplayOrderProbeIsLagging(detail);
    sendDiag({
      kind: lagging ? "cardplay_order_lag" : "cardplay_order_probe",
      summary:
        "P" +
        slotLabel() +
        (lagging ? " LAG" : " ok") +
        " live=" +
        detail.gamePhase +
        " url=" +
        (detail.urlPhase || "—"),
      detail: detail,
    });
  }

  window.risqueArtemisStartCardplayOrderProbe = function (ctx) {
    if (!window.risqueArtemisMode) return;
    cardplayOrderProbeContext = ctx && typeof ctx === "object" ? ctx : { reason: "manual" };
    cardplayOrderProbeUntil = Date.now() + CARDPLAY_ORDER_PROBE_WINDOW_MS;
    cardplayOrderProbeTick();
    if (cardplayOrderProbeTimer) return;
    cardplayOrderProbeTimer = setInterval(cardplayOrderProbeTick, CARDPLAY_ORDER_PROBE_MS);
  };

  window.risqueArtemisDiagCardplayOrderReject = function (incoming, livePh) {
    sendDiag({
      kind: "cardplay_order_mirror_reject",
      summary:
        "P" +
        slotLabel() +
        " rejected playerSelect mirror (live=" +
        String(livePh || "?") +
        ")",
      detail: {
        incomingPhase: incoming ? String(incoming.phase || "") : "",
        selectKind:
          incoming && incoming.risquePublicUiSelectKind != null
            ? String(incoming.risquePublicUiSelectKind)
            : "",
        livePhase: String(livePh || ""),
        urlPhase: urlPhaseParam(),
        setupComplete: !!(incoming && incoming.setupComplete),
      },
    });
  };

  function watchCardplayOrderPhaseEntry() {
    if (!window.risqueArtemisLobbyStarted) return;
    var gs = window.gameState;
    if (!gs) return;
    var sk = String(gs.risquePublicUiSelectKind || gs.selectionPhase || "");
    if (String(gs.phase || "") !== "playerSelect" || sk !== "cardPlay") return;
    if (window.__risqueArtemisCardplayOrderProbeArmed === sk) return;
    window.__risqueArtemisCardplayOrderProbeArmed = sk;
    if (typeof window.risqueArtemisStartCardplayOrderProbe === "function") {
      window.risqueArtemisStartCardplayOrderProbe({ reason: "playerSelect_cardPlay_mount", selectKind: sk });
    }
  }

  setInterval(watchCardplayOrderPhaseEntry, 1500);

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

  /** Forward browser console + uncaught errors to host diagnostics (batched). */
  var CONSOLE_LINE_MAX = 480;
  var CONSOLE_BATCH_MAX = 14;
  var CONSOLE_FLUSH_MS = 2000;
  var CONSOLE_QUEUE_CAP = 120;
  var consoleQueue = [];
  var consoleFlushTimer = null;

  function consoleCaptureEnabled() {
    return !!window.risqueArtemisMode;
  }

  function formatConsoleArg(a) {
    if (a == null) return String(a);
    if (typeof a === "string") return a;
    if (typeof a === "number" || typeof a === "boolean") return String(a);
    if (a instanceof Error) {
      return a.stack || a.message || String(a);
    }
    try {
      return JSON.stringify(a);
    } catch (eJson) {
      try {
        return String(a);
      } catch (eStr) {
        return "[object]";
      }
    }
  }

  function formatConsoleLine(args) {
    var parts = [];
    for (var i = 0; i < args.length; i += 1) {
      parts.push(formatConsoleArg(args[i]));
    }
    var text = parts.join(" ");
    if (text.length > CONSOLE_LINE_MAX) {
      text = text.slice(0, CONSOLE_LINE_MAX - 3) + "...";
    }
    return text;
  }

  function enqueueConsoleLine(level, text) {
    if (!consoleCaptureEnabled()) return;
    if (!text || !String(text).trim()) return;
    consoleQueue.push({
      level: String(level || "log"),
      text: String(text),
      t: Date.now(),
    });
    if (consoleQueue.length > CONSOLE_QUEUE_CAP) {
      consoleQueue = consoleQueue.slice(-Math.floor(CONSOLE_QUEUE_CAP * 0.6));
    }
    scheduleConsoleFlush();
  }

  function scheduleConsoleFlush() {
    if (consoleFlushTimer != null) return;
    consoleFlushTimer = window.setTimeout(flushConsoleQueue, CONSOLE_FLUSH_MS);
  }

  function flushConsoleQueue() {
    consoleFlushTimer = null;
    if (!consoleQueue.length) return;
    if (!window.risqueArtemisLobbyStarted || typeof window.risqueArtemisSend !== "function") {
      scheduleConsoleFlush();
      return;
    }
    var batch = consoleQueue.splice(0, CONSOLE_BATCH_MAX);
    if (consoleQueue.length) scheduleConsoleFlush();
    sendDiag({
      kind: "browser_console",
      summary:
        "P" +
        slotLabel() +
        " console×" +
        batch.length +
        (batch[0] && batch[0].text ? ": " + String(batch[0].text).slice(0, 72) : ""),
      detail: { lines: batch },
    });
  }

  window.risqueArtemisDiagFlushConsole = function () {
    flushConsoleQueue();
  };

  function installConsoleCapture() {
    if (window.__risqueArtemisConsolePatched) return;
    window.__risqueArtemisConsolePatched = true;
    ["log", "warn", "error", "info", "debug"].forEach(function (level) {
      var orig = console[level];
      if (typeof orig !== "function") return;
      console[level] = function risqueArtemisConsoleForward() {
        var args = arguments;
        try {
          if (consoleCaptureEnabled()) {
            enqueueConsoleLine(level, formatConsoleLine(args));
          }
        } catch (eCap) {
          /* ignore capture errors */
        }
        return orig.apply(console, args);
      };
    });
    window.addEventListener("error", function (ev) {
      try {
        if (!consoleCaptureEnabled()) return;
        var loc = ev.filename ? String(ev.filename) : "";
        if (ev.lineno) loc += ":" + ev.lineno;
        enqueueConsoleLine(
          "error",
          "[uncaught] " + String(ev.message || "error") + (loc ? " @ " + loc : "")
        );
      } catch (eErr) {
        /* ignore */
      }
    });
    window.addEventListener("unhandledrejection", function (ev) {
      try {
        if (!consoleCaptureEnabled()) return;
        enqueueConsoleLine("error", "[unhandledrejection] " + formatConsoleLine([ev.reason]));
      } catch (eRej) {
        /* ignore */
      }
    });
  }

  installConsoleCapture();

  window.risqueArtemisDiagOpenReport = function () {
    if (typeof window.risqueArtemisDiagFlushConsole === "function") {
      window.risqueArtemisDiagFlushConsole();
    }
    var url = "/api/artemis/diag";
    try {
      window.open(url, "_blank");
    } catch (eOpen) {
      /* ignore */
    }
  };
})();
