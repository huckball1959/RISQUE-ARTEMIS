"use strict";

const fs = require("fs");
const path = require("path");

const DIAG_MAX = 400;

/**
 * @param {string} gameRoot
 */
function createArtemisDiag(gameRoot) {
  const diagDir = path.join(gameRoot, "logs");
  const jsonlPath = path.join(diagDir, "artemis-session.jsonl");
  const reportPath = path.join(diagDir, "artemis-last-report.json");
  /** @type {object[]} */
  const events = [];

  function ensureDir() {
    try {
      fs.mkdirSync(diagDir, { recursive: true });
    } catch (e) {
      /* ignore */
    }
  }

  function push(entry, sessionSnap) {
    const row = {
      t: Date.now(),
      iso: new Date().toISOString(),
      ...entry,
    };
    events.push(row);
    while (events.length > DIAG_MAX) events.shift();
    ensureDir();
    try {
      fs.appendFileSync(jsonlPath, JSON.stringify(row) + "\n");
    } catch (eJsonl) {
      /* ignore */
    }
    try {
      const report = buildReport(sessionSnap);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    } catch (eReport) {
      /* ignore */
    }
    return row;
  }

  function findLast(kind) {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (events[i].kind === kind) return events[i];
    }
    return null;
  }

  function computeVerdict() {
    const stuck = findLast("handoff_stuck");
    if (stuck) {
      return {
        status: "failed",
        code: "handoff_stuck",
        summary:
          "Client handoff pending >10s — mirror never advanced to " +
          String(stuck.nextPlayer || "next player"),
        slot: stuck.slot,
        controlSeq: stuck.controlSeq,
        nextPlayer: stuck.nextPlayer,
        role: stuck.role,
      };
    }

    const finishOk = findLast("deploy_finish_ok");
    const finishReject = findLast("deploy_finish_reject");

    if (finishOk) {
      return {
        status: "ok",
        code: "setup_deploy_finished",
        summary: String(finishOk.summary || "Setup deploy finished to playerSelect/cardPlay"),
        slot: finishOk.slot,
        controlSeq: finishOk.controlSeq,
      };
    }

    if (finishReject) {
      return {
        status: "failed",
        code: "finish_rejected",
        summary: String(finishReject.summary || finishReject.reason || "Deploy finish rejected"),
        slot: finishReject.slot,
        controlSeq: finishReject.controlSeq,
        reason: finishReject.reason,
      };
    }

    const sent = findLast("deploy_confirm_sent") || findLast("legacy_deploy_confirm_forwarded");
    const forwarded =
      findLast("deploy_confirm_forwarded") || findLast("legacy_deploy_confirm_forwarded");
    const recv = findLast("deploy_confirm_recv");
    const advance = findLast("deploy_handoff_advance");
    const reject = findLast("deploy_handoff_reject");

    if (sent) {
      const sentAt = sent.t || 0;
      const newerAdvance = advance && (advance.t || 0) > sentAt;
      const newerReject = reject && (reject.t || 0) > sentAt;
      if (!newerAdvance && !newerReject) {
        if (!forwarded) {
          return {
            status: "failed",
            code: "confirm_not_forwarded",
            summary:
              "Client sent deploy_confirm but server never forwarded it to host",
            slot: sent.slot,
            controlSeq: sent.controlSeq,
            nextPlayer: sent.nextPlayer,
          };
        }
        if (!recv) {
          return {
            status: "failed",
            code: "confirm_not_received_host",
            summary:
              "Server forwarded deploy_confirm but host browser never logged receipt",
            slot: sent.slot,
            controlSeq: sent.controlSeq,
            nextPlayer: sent.nextPlayer,
          };
        }
        return {
          status: "failed",
          code: "confirm_not_advanced",
          summary:
            "Host received deploy_confirm but did not advance or reject handoff",
          slot: sent.slot,
          controlSeq: sent.controlSeq,
          nextPlayer: sent.nextPlayer,
          rejectReason: reject ? reject.reason : null,
        };
      }
    }

    if (reject && (!advance || (reject.t || 0) > (advance.t || 0))) {
      return {
        status: "failed",
        code: "handoff_rejected",
        summary: String(reject.summary || reject.reason || "Deploy handoff rejected"),
        slot: reject.slot,
        controlSeq: reject.controlSeq,
        reason: reject.reason,
      };
    }

    if (advance) {
      return {
        status: "ok",
        code: "last_handoff_ok",
        summary:
          "Last handoff advanced to " +
          String(advance.nextPlayer || advance.currentPlayer || "?"),
        slot: advance.slot,
        controlSeq: advance.controlSeq,
      };
    }

    const finishSent = findLast("deploy_finish_sent");
    const finishFwd = findLast("deploy_finish_forwarded");
    const finishRecv = findLast("deploy_finish_recv");
    const allBanksZero = findLast("confirm_all_banks_zero");

    if (allBanksZero && allBanksZero.role === "client") {
      if (!finishSent) {
        return {
          status: "failed",
          code: "finish_not_sent",
          summary:
            "Last deploy CONFIRM (all banks zero) did not send deploy_finish bus message",
          slot: allBanksZero.slot,
        };
      }
      const sentAt = finishSent.t || 0;
      const finishOkLate = findLast("deploy_finish_ok");
      const finishRejectLate = findLast("deploy_finish_reject");
      const newerOk = finishOkLate && (finishOkLate.t || 0) > sentAt;
      const newerReject = finishRejectLate && (finishRejectLate.t || 0) > sentAt;
      if (!newerOk && !newerReject) {
        if (!finishFwd) {
          return {
            status: "failed",
            code: "finish_not_forwarded",
            summary: "Client sent deploy_finish but server never forwarded it to host",
            slot: finishSent.slot,
            controlSeq: finishSent.controlSeq,
          };
        }
        if (!finishRecv) {
          return {
            status: "failed",
            code: "finish_not_received_host",
            summary: "Server forwarded deploy_finish but host browser never logged receipt",
            slot: finishSent.slot,
            controlSeq: finishSent.controlSeq,
          };
        }
        return {
          status: "failed",
          code: "finish_not_applied",
          summary: "Host received deploy_finish but did not finish setup deploy",
          slot: finishSent.slot,
          controlSeq: finishSent.controlSeq,
          rejectReason: finishRejectLate ? finishRejectLate.reason : null,
        };
      }
    }

    return {
      status: "ok",
      code: "no_handoff_yet",
      summary: "No deploy handoff events recorded this session",
    };
  }

  function buildReceiveCardSection() {
    const awarded = findLast("receive_card_awarded");
    const display = findLast("receive_card_display");
    const cont = findLast("receive_card_continue");
    const snapEv = findLast("receive_card_snapshot");
    const ev = awarded || display;
    if (!ev && !cont && !snapEv) {
      return {
        status: "none",
        readout: "No receive-card events this session yet.",
      };
    }
    const detail = ev && ev.detail ? ev.detail : snapEv && snapEv.detail ? snapEv.detail : {};
    const drawn =
      detail.drawnThisStep ||
      detail.lastCardDrawn ||
      (snapEv && snapEv.detail && snapEv.detail.lastCardDrawn) ||
      null;
    const hand =
      (cont && cont.detail && cont.detail.handNames) ||
      detail.handNames ||
      (snapEv && snapEv.detail && snapEv.detail.handNames) ||
      [];
    let status = "unknown";
    if (drawn) status = "card_drawn";
    else if (ev) status = "display_no_draw";
    else if (cont) status = "continued_only";
    return {
      status,
      readout: ev ? String(ev.summary || "") : cont ? String(cont.summary || "") : String(snapEv.summary || ""),
      drawnCard: drawn || null,
      handAfter: Array.isArray(hand) ? hand : [],
      handCount: Array.isArray(hand) ? hand.length : 0,
      uiPresent: detail.uiPresent || (snapEv && snapEv.detail ? snapEv.detail.uiPresent : null),
      lastDisplayOrAward: ev || null,
      lastContinue: cont || null,
      lastSnapshot: snapEv || null,
    };
  }

  function buildReport(sessionSnap) {
    sessionSnap = sessionSnap || {};
    const verdict = computeVerdict();
    const receiveCard = buildReceiveCardSection();
    return {
      generatedAt: new Date().toISOString(),
      reportPath: reportPath,
      jsonlPath: jsonlPath,
      forCursor:
        "Tell Cursor: read logs/artemis-last-report.json — no copy/paste needed. Check receiveCard.readout for who drew what.",
      verdict,
      receiveCard,
      eventCount: events.length,
      recentEvents: events.slice(-60),
      session: sessionSnap,
    };
  }

  function getReport(sessionSnap) {
    return buildReport(sessionSnap);
  }

  function resetSession() {
    events.length = 0;
    ensureDir();
    try {
      fs.writeFileSync(
        reportPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            verdict: { status: "ok", code: "session_reset", summary: "New session" },
            eventCount: 0,
            recentEvents: [],
          },
          null,
          2
        )
      );
    } catch (e) {
      /* ignore */
    }
  }

  return { push, getReport, resetSession, reportPath, jsonlPath };
}

module.exports = { createArtemisDiag };
