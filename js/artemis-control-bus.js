"use strict";

/**
 * ARTEMIS control bus — probe-style narrow setup deploy messages.
 * deploy_confirm: mid-chain handoff; deploy_finish: last player, all banks zero.
 */
(function () {
  function normName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function territoryPatch(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (t) {
      if (!t || !t.name) return null;
      return { name: t.name, troops: Number(t.troops) || 0 };
    }).filter(Boolean);
  }

  window.risqueArtemisBuildSetupDeployConfirm = function (opts) {
    opts = opts || {};
    var gs = opts.gameState;
    var player = opts.player;
    if (!gs || !player) return null;
    var slot = Number(window.risqueArtemisPlayerSlot) || 0;
    if (slot < 2 || slot > 3) return null;
    if (typeof window.risqueArtemisStampDeployMirrorDraftOnState === "function") {
      window.risqueArtemisStampDeployMirrorDraftOnState(gs);
    }
    return {
      type: "deploy_confirm",
      slot: slot,
      route: "setup",
      controlSeq: Number(gs.risqueArtemisControlSeq) || 0,
      nextPlayer: String(opts.nextPlayer || ""),
      nextSeq: Number(opts.nextSeq) || 0,
      mirrorDraft: gs.risqueDeployMirrorDraft || null,
      finisher: {
        name: String(player.name || ""),
        bankValue: Number(player.bankValue) || 0,
        troopsTotal: Number(player.troopsTotal) || 0,
        territories: territoryPatch(player.territories)
      }
    };
  };

  window.risqueArtemisSendSetupDeployConfirm = function (opts) {
    var msg = window.risqueArtemisBuildSetupDeployConfirm(opts);
    if (!msg || typeof window.risqueArtemisSend !== "function") return false;
    try {
      console.info(
        "[ARTEMIS bus] setup deploy_confirm P" +
          String(msg.slot) +
          " seq=" +
          String(msg.controlSeq) +
          " → " +
          normName(msg.nextPlayer)
      );
    } catch (eLog) {
      /* ignore */
    }
    var ok = !!window.risqueArtemisSend(msg);
    if (ok && typeof window.risqueArtemisDiagDeployConfirmSent === "function") {
      window.risqueArtemisDiagDeployConfirmSent({
        slot: msg.slot,
        controlSeq: msg.controlSeq,
        nextPlayer: msg.nextPlayer
      });
    }
    return ok;
  };

  window.risqueArtemisBuildSetupDeployFinish = function (opts) {
    opts = opts || {};
    var gs = opts.gameState;
    var player = opts.player;
    if (!gs || !player) return null;
    var slot = Number(window.risqueArtemisPlayerSlot) || 0;
    if (slot < 2 || slot > 3) return null;
    if (typeof window.risqueArtemisStampDeployMirrorDraftOnState === "function") {
      window.risqueArtemisStampDeployMirrorDraftOnState(gs);
    }
    return {
      type: "deploy_finish",
      slot: slot,
      route: "setup",
      controlSeq: Number(gs.risqueArtemisControlSeq) || 0,
      mirrorDraft: gs.risqueDeployMirrorDraft || null,
      finisher: {
        name: String(player.name || ""),
        bankValue: Number(player.bankValue) || 0,
        troopsTotal: Number(player.troopsTotal) || 0,
        territories: territoryPatch(player.territories)
      }
    };
  };

  window.risqueArtemisSendSetupDeployFinish = function (opts) {
    var msg = window.risqueArtemisBuildSetupDeployFinish(opts);
    if (!msg || typeof window.risqueArtemisSend !== "function") return false;
    try {
      console.info(
        "[ARTEMIS bus] setup deploy_finish P" +
          String(msg.slot) +
          " seq=" +
          String(msg.controlSeq)
      );
    } catch (eLog) {
      /* ignore */
    }
    var ok = !!window.risqueArtemisSend(msg);
    if (ok && typeof window.risqueArtemisDiagDeployFinishSent === "function") {
      window.risqueArtemisDiagDeployFinishSent({
        slot: msg.slot,
        controlSeq: msg.controlSeq
      });
    }
    return ok;
  };
})();
