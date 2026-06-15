"use strict";

const fs = require("fs");
const path = require("path");

const DIAG_MAX = 400;
const CONSOLE_DIAG_MAX = 200;

/**
 * @param {string} gameRoot
 */
function createArtemisDiag(gameRoot) {
  const diagDir = path.join(gameRoot, "logs");
  const jsonlPath = path.join(diagDir, "artemis-session.jsonl");
  const reportPath = path.join(diagDir, "artemis-last-report.json");
  /** @type {object[]} */
  const events = [];
  /** @type {object[]} */
  const consoleEvents = [];

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
    if (row.kind === "browser_console") {
      consoleEvents.push(row);
      while (consoleEvents.length > CONSOLE_DIAG_MAX) consoleEvents.shift();
    }
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
    const cpLag = findLast("cardplay_order_lag");
    const cpReject = findLast("cardplay_order_mirror_reject");
    if (cpReject && Number(cpReject.slot) === 3) {
      return {
        status: "failed",
        code: "cardplay_order_p3_mirror_reject",
        summary: String(cpReject.summary || "P3 rejected playerSelect mirror during cardplay-order roulette"),
        slot: 3,
        detail: cpReject.detail || null,
      };
    }
    if (cpLag && Number(cpLag.slot) === 3) {
      return {
        status: "failed",
        code: "cardplay_order_p3_lag",
        summary: String(cpLag.summary || "P3 lagging during cardplay-order handoff"),
        slot: 3,
        detail: cpLag.detail || null,
      };
    }
    const syncLag = findLast("sync_barrier_timeout") || findLast("sync_barrier_lag");
    if (syncLag) {
      return {
        status: "failed",
        code: String(syncLag.kind || "sync_lag"),
        summary: String(syncLag.summary || "Laptop sync barrier failed"),
        laggers: syncLag.laggers,
      };
    }

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

  function buildConsoleSection() {
    if (!consoleEvents.length) {
      return {
        status: "none",
        readout: "No browser console batches yet (all laptops forward console after lobby start).",
        bySlot: {},
        recentLines: [],
      };
    }
    /** @type {Record<string, object[]>} */
    const bySlot = {};
    /** @type {object[]} */
    const recentLines = [];
    for (let i = 0; i < consoleEvents.length; i += 1) {
      const ev = consoleEvents[i];
      const slotKey = String(Number(ev.slot) || 0);
      if (!bySlot[slotKey]) bySlot[slotKey] = [];
      const lines = ev.detail && Array.isArray(ev.detail.lines) ? ev.detail.lines : [];
      for (let j = 0; j < lines.length; j += 1) {
        const line = lines[j];
        if (!line || !line.text) continue;
        const row = {
          t: line.t || ev.t,
          iso: ev.iso,
          level: line.level || "log",
          text: String(line.text),
          role: ev.role || "",
          slot: Number(ev.slot) || 0,
          clientId: ev.clientId || "",
        };
        bySlot[slotKey].push(row);
        recentLines.push(row);
      }
    }
    Object.keys(bySlot).forEach(function (sk) {
      bySlot[sk] = bySlot[sk].slice(-50);
    });
    recentLines.sort(function (a, b) {
      return (Number(a.t) || 0) - (Number(b.t) || 0);
    });
    const tail = recentLines.slice(-80);
    const slots = Object.keys(bySlot)
      .filter(function (sk) {
        return sk !== "0";
      })
      .sort();
    let readout =
      "Console from " +
      (slots.length ? slots.map(function (s) { return "P" + s; }).join(", ") : "unknown slots") +
      " (" +
      tail.length +
      " recent lines).";
    const errLine = tail.filter(function (r) {
      return r.level === "error";
    }).slice(-1)[0];
    if (errLine) {
      readout += " Last error P" + errLine.slot + ": " + errLine.text.slice(0, 120);
    }
    return {
      status: "ok",
      readout,
      bySlot,
      recentLines: tail,
      batchCount: consoleEvents.length,
    };
  }

  function buildCardplayOrderSection() {
    const winner = findLast("cardplay_order_winner");
    const lagEvents = events.filter(function (e) {
      return (
        e &&
        (e.kind === "cardplay_order_lag" ||
          e.kind === "cardplay_order_mirror_reject" ||
          e.kind === "cardplay_order_probe_end")
      );
    });
    const rejects = events.filter(function (e) {
      return e && e.kind === "cardplay_order_mirror_reject";
    });
    const probes = events.filter(function (e) {
      return e && (e.kind === "cardplay_order_probe" || e.kind === "cardplay_order_lag");
    });
    /** @type {Record<string, object>} */
    const bySlot = {};
    [1, 2, 3].forEach(function (slot) {
      const slotProbes = probes.filter(function (e) {
        return Number(e.slot) === slot;
      });
      const slotRejects = rejects.filter(function (e) {
        return Number(e.slot) === slot;
      });
      const lastProbe = slotProbes.length ? slotProbes[slotProbes.length - 1] : null;
      const lastLag = slotProbes.filter(function (e) {
        return e.kind === "cardplay_order_lag";
      }).slice(-1)[0];
      const detail = lastProbe && lastProbe.detail ? lastProbe.detail : {};
      bySlot[String(slot)] = {
        lastProbe: lastProbe,
        lastLag: lastLag || null,
        rejectCount: slotRejects.length,
        livePhase: detail.gamePhase || "",
        urlPhase: detail.urlPhase || "",
        lagging: !!lastLag || slotRejects.length > 0,
      };
    });
    const p3 = bySlot["3"] || {};
    let status = "none";
    if (winner || lagEvents.length) {
      status = p3.lagging || (bySlot["3"] && bySlot["3"].rejectCount > 0) ? "p3_lagging" : "ok";
      if (rejects.some(function (e) { return Number(e.slot) === 3; })) {
        status = "p3_lagging";
      }
      if (findLast("cardplay_order_lag") && Number(findLast("cardplay_order_lag").slot) === 3) {
        status = "p3_lagging";
      }
    }
    let readout = "No cardplay-order roulette yet.";
    if (winner) {
      readout =
        "Winner: " +
        String((winner.detail && winner.detail.winner) || winner.summary || "?") +
        (winner.detail && winner.detail.rigSlot
          ? " (rig slot " + winner.detail.rigSlot + ")"
          : "");
    }
    if (p3.rejectCount > 0) {
      readout += " · P3 rejected playerSelect mirror ×" + p3.rejectCount;
    }
    if (p3.lastLag) {
      readout +=
        " · P3 lag live=" +
        String((p3.lastLag.detail && p3.lastLag.detail.gamePhase) || "?") +
        " url=" +
        String((p3.lastLag.detail && p3.lastLag.detail.urlPhase) || "?");
    }
    Object.keys(bySlot).forEach(function (sk) {
      const row = bySlot[sk];
      if (!row.lastProbe && !row.rejectCount) return;
      readout +=
        " · P" +
        sk +
        " " +
        (row.livePhase || "?") +
        "/" +
        (row.urlPhase || "?") +
        (row.lagging ? " LAG" : "");
    });
    return {
      status,
      readout,
      winner: winner || null,
      bySlot,
      rejectCount: rejects.length,
      probeCount: probes.length,
      recentLag: lagEvents.slice(-12),
      recentRejects: rejects.slice(-12),
    };
  }

  function buildSyncSection(sessionSnap) {
    sessionSnap = sessionSnap || {};
    const sync = sessionSnap.sync || {};
    const heartbeats = sync.heartbeats || {};
    const hostSeq = Number(sync.hostSeq) || 0;
    const rows = [];
    [1, 2, 3].forEach(function (slot) {
      const hb = heartbeats[String(slot)] || heartbeats[slot];
      if (!hb) {
        rows.push({ slot: slot, status: "missing" });
        return;
      }
      rows.push({
        slot: slot,
        name: hb.name || "",
        gamePhase: hb.gamePhase || "",
        urlPhase: hb.urlPhase || "",
        lastAppliedSeq: hb.lastAppliedSeq,
        seqGap: hb.seqGap != null ? hb.seqGap : Math.max(0, hostSeq - (Number(hb.lastAppliedSeq) || 0)),
        ageMs: hb.ageMs,
        status:
          hb.missing || (hb.seqGap != null && hb.seqGap > 2)
            ? "lagging"
            : hb.ageMs != null && hb.ageMs > 5000
              ? "stale"
              : "ok",
      });
    });
    return {
      hostSeq,
      activeBarrier: sync.activeBarrier || null,
      laggers: sync.laggers || [],
      laptops: rows,
      readout:
        rows
          .map(function (r) {
            if (r.status === "missing") return "P" + r.slot + ": no heartbeat";
            return (
              "P" +
              r.slot +
              " " +
              (r.gamePhase || "?") +
              " seq-" +
              (r.seqGap != null ? r.seqGap : "?") +
              " (" +
              r.status +
              ")"
            );
          })
          .join(" · "),
    };
  }

  function buildReport(sessionSnap) {
    sessionSnap = sessionSnap || {};
    const verdict = computeVerdict();
    const receiveCard = buildReceiveCardSection();
    const cardplayOrder = buildCardplayOrderSection();
    const browserConsole = buildConsoleSection();
    const sync = buildSyncSection(sessionSnap);
    return {
      generatedAt: new Date().toISOString(),
      reportPath: reportPath,
      jsonlPath: jsonlPath,
      forCursor:
        "Tell Cursor: read logs/artemis-last-report.json — no copy/paste needed. Check cardplayOrder.readout for P3 lag at cardplay-order roulette; receiveCard.readout for who drew what; browserConsole.recentLines for all-laptop console; sync.readout for laptop lag.",
      verdict,
      sync,
      cardplayOrder,
      receiveCard,
      browserConsole,
      eventCount: events.length,
      consoleEventCount: consoleEvents.length,
      recentEvents: events.slice(-60),
      session: sessionSnap,
    };
  }

  function getReport(sessionSnap) {
    return buildReport(sessionSnap);
  }

  function resetSession() {
    events.length = 0;
    consoleEvents.length = 0;
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
