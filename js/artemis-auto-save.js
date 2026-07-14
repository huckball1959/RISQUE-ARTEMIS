/**
 * ARTEMIS auto mock-save boot — zero keyboard shortcuts.
 * Enable with ?artemisAutoSave=cards|conquer-* on join URLs or host test launcher.
 * After fast-boot login, fetches the save JSON and jumps straight to cardplay or attack.
 * Does NOT set risqueArtemisPresetId / risqueArtemisPresetMode (avoids preset host-reject path).
 */
(function () {
  "use strict";

  if (!window.risqueArtemisMode) return;

  function normName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function resolveAutoSaveId() {
    if (window.risqueArtemisAutoSave) return String(window.risqueArtemisAutoSave);
    try {
      var q = new URL(window.location.href).searchParams.get("artemisAutoSave");
      if (q) return String(q);
    } catch (eQ) {
      /* ignore */
    }
    return "";
  }

  function isConquerAutoSave(id) {
    return /^conquer-/i.test(String(id || ""));
  }

  function autoSaveFileName(id) {
    var s = String(id || "cards").trim();
    if (!s) s = "cards";
    if (/\.json$/i.test(s)) return s;
    return s + ".json";
  }

  function readMockFirstSlot() {
    if (window.risqueArtemisMockFirstSlot) {
      var fromWin = Number(window.risqueArtemisMockFirstSlot) || 0;
      if (fromWin >= 1 && fromWin <= (window.risqueArtemisMaxSlots || 6)) return fromWin;
    }
    try {
      var s = sessionStorage.getItem("risqueArtemisMockFirstSlot");
      if (s) {
        var fromSs = Number(s) || 0;
        if (fromSs >= 1 && fromSs <= (window.risqueArtemisMaxSlots || 6)) return fromSs;
      }
    } catch (eSs) {
      /* ignore */
    }
    return 1;
  }

  function playerNameForSlot(out, slot) {
    slot = Number(slot) || 1;
    if (slot < 1 || slot > (window.risqueArtemisMaxSlots || 6)) slot = 1;
    var roster = Array.isArray(out.artemisRoster) ? out.artemisRoster : [];
    var fromRoster = roster.find(function (r) {
      return r && Number(r.slot) === slot && r.name;
    });
    if (fromRoster && fromRoster.name) return normName(fromRoster.name);
    return slot === 2 ? "MICTOR" : slot === 3 ? "NOOCH" : "GUIDO";
  }

  function applyMockFirstPlayer(out, slot) {
    if (!out || typeof out !== "object") return out;
    var name = playerNameForSlot(out, slot);
    out.currentPlayer = name;
    if (Array.isArray(out.turnOrder) && out.turnOrder.length) {
      var idx = out.turnOrder.findIndex(function (n) {
        return normName(n) === normName(name);
      });
      if (idx > 0) {
        out.turnOrder = out.turnOrder.slice(idx).concat(out.turnOrder.slice(0, idx));
      }
    }
    out.risqueArtemisAutoSaveLabel = "CARDPLAY TEST — Round 4 — " + name + " first to act";
    return out;
  }

  function mergeRosterIntoMock(mock, loginGs, saveId) {
    var out = mock;
    var roster =
      (loginGs && Array.isArray(loginGs.artemisRoster) && loginGs.artemisRoster.length
        ? loginGs.artemisRoster
        : null) ||
      (Array.isArray(out.artemisRoster) ? out.artemisRoster : []);
    if (roster.length) {
      out.artemisRoster = roster.map(function (r) {
        return { slot: r.slot, name: r.name, color: r.color };
      });
      roster.forEach(function (r) {
        if (!r || !r.name) return;
        var p = (out.players || []).find(function (pl) {
          return normName(pl && pl.name) === normName(r.name);
        });
        if (p && r.color) p.color = r.color;
      });
    }

    var isConquer =
      isConquerAutoSave(saveId) || String(out.phase || "").toLowerCase() === "attack";

    if (isConquer && (!out.artemisRoster || !out.artemisRoster.length)) {
      out.artemisRoster = ["GUIDO", "MICTOR", "NOOCH"].map(function (name, i) {
        var p = (out.players || []).find(function (pl) {
          return normName(pl && pl.name) === normName(name);
        });
        return { slot: i + 1, name: name, color: p && p.color ? p.color : name };
      });
    }

    if (!isConquer) {
      applyMockFirstPlayer(out, readMockFirstSlot());
      out.phase = "cardplay";
      out.risqueArtemisAutoSaveId = saveId || "cards";
      if (!out.risqueArtemisAutoSaveLabel) {
        out.risqueArtemisAutoSaveLabel = "CARDPLAY TEST — Round 4";
      }
    } else {
      out.risqueArtemisAutoSaveId = saveId || out.risqueArtemisAutoSaveId || "conquer";
      if (!out.attackPhase) out.attackPhase = "attack";
      if (!out.risqueArtemisAutoSaveLabel) {
        out.risqueArtemisAutoSaveLabel = "CONQUER TEST — attack to eliminate";
      }
    }

    if (typeof window.risqueArtemisForceControlSlotFromCurrentPlayer === "function") {
      window.risqueArtemisForceControlSlotFromCurrentPlayer(out);
    } else if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(out);
    }
    if (isConquer && typeof window.risqueArtemisClearSetupDeployWinnerLock === "function") {
      window.risqueArtemisClearSetupDeployWinnerLock(out);
    }
    if (isConquer) {
      out.risqueArtemisControlSeq = Math.max(Number(out.risqueArtemisControlSeq) || 0, 2);
    }
    out.setupComplete = true;
    out.isInitialDeploy = false;
    try {
      delete out.risqueArtemisPresetId;
      delete out.risqueArtemisPresetLabel;
    } catch (eClr) {
      /* ignore */
    }
    return out;
  }

  function persistState(gs) {
    window.gameState = gs;
    if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    }
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      /* ignore */
    }
  }

  function pushHostMirror(gs) {
    if (typeof window.risquePersistHostGameState === "function") {
      window.risquePersistHostGameState(gs);
    } else if (typeof window.risqueMirrorPushGameState === "function") {
      window.risqueMirrorPushGameState();
    }
  }

  function appendAutoSaveParam(url, saveId) {
    try {
      var autoId =
        saveId ||
        new URL(window.location.href).searchParams.get("artemisAutoSave") ||
        resolveAutoSaveId();
      if (autoId) {
        url +=
          (url.indexOf("?") >= 0 ? "&" : "?") +
          "artemisAutoSave=" +
          encodeURIComponent(autoId);
      }
    } catch (eUrl) {
      /* ignore */
    }
    return url;
  }

  function navigateMockPhase(gs, phase, saveId) {
    var url =
      String(phase || "").toLowerCase() === "attack"
        ? "game.html?phase=attack"
        : "game.html?phase=cardplay&legacyNext=income.html&postReceive=1";
    if (typeof window.risqueArtemisAppendSessionParams === "function") {
      url = window.risqueArtemisAppendSessionParams(url);
    }
    url = appendAutoSaveParam(url, saveId);

    if (typeof window.risqueNavigateGameHtmlSoft === "function" && window.risqueNavigateGameHtmlSoft(url)) {
      try {
        console.info("[ARTEMIS auto-save] soft-nav to " + phase + " ->", url);
      } catch (eLogNav) {
        /* ignore */
      }
      if (window.risqueArtemisHost) pushHostMirror(gs);
      return;
    }

    if (window.risqueArtemisHost) {
      var softAllowed =
        typeof window.risqueArtemisSoftNavAllowed === "function"
          ? window.risqueArtemisSoftNavAllowed()
          : !window.risqueDisplayIsPublic;
      var diag = {
        url: url,
        phase: phase,
        softAllowed: softAllowed,
        isPublic: !!window.risqueDisplayIsPublic,
        hasSoftFn: typeof window.risqueNavigateGameHtmlSoft === "function"
      };
      try {
        console.error(
          "[ARTEMIS auto-save] host soft-nav to " + phase + " REFUSED (would loop to sign-in). Diag:",
          diag
        );
      } catch (eLogRef) {
        /* ignore */
      }
      if (typeof window.risqueArtemisDiag === "function") {
        try {
          window.risqueArtemisDiag("auto-save-nav-refused", "host soft-nav refused", diag);
        } catch (eDiagRef) {
          /* ignore */
        }
      }
      if (typeof window.risqueArtemisSetTopStatus === "function") {
        window.risqueArtemisSetTopStatus(
          "MOCK NAV BLOCKED: soft-nav refused (isPublic=" +
            (!!window.risqueDisplayIsPublic) +
            "). Would loop to sign-in — see console.",
          "err"
        );
      }
      pushHostMirror(gs);
      return;
    }
    if (typeof window.risqueNavigateWithFade === "function") {
      window.risqueNavigateWithFade(url);
    } else {
      window.location.href = url;
    }
  }

  function showAutoSaveBanner(gs, saveId) {
    var isConquer = isConquerAutoSave(saveId);
    var who = gs && gs.currentPlayer ? String(gs.currentPlayer) : "GUIDO";
    var msg =
      gs && gs.risqueArtemisAutoSaveLabel
        ? gs.risqueArtemisAutoSaveLabel
        : isConquer
        ? "CONQUER TEST — " + who + "'s attack — eliminate the last territory"
        : "CARDPLAY TEST — " +
          who +
          "'s turn (R" +
          (gs && gs.round ? gs.round : 4) +
          ") — play the book, then check CARDS IN HAND";
    if (typeof window.risqueArtemisSetTopStatus === "function") {
      window.risqueArtemisSetTopStatus(msg, "ok");
    }
    try {
      console.info("[ARTEMIS auto-save]", msg);
    } catch (eLog) {
      /* ignore */
    }
    if (typeof window.risqueArtemisDiag === "function") {
      try {
        var curNm = normName(gs && gs.currentPlayer);
        var curP = (gs && gs.players || []).find(function (p) {
          return normName(p && p.name) === curNm;
        });
        window.risqueArtemisDiag("auto-save-boot", "Loaded mock save " + (saveId || ""), {
          saveId: saveId,
          phase: gs && gs.phase,
          round: gs && gs.round,
          currentPlayer: gs && gs.currentPlayer,
          handCount: curP
            ? Array.isArray(curP.cards)
              ? curP.cards.length
              : Number(curP.cardCount) || 0
            : -1,
          host: !!window.risqueArtemisHost
        });
      } catch (eDiag) {
        /* ignore */
      }
    }
  }

  function scheduleConquerAttackBootRecovery(gs, saveId) {
    if (!isConquerAutoSave(saveId)) return;
    var attempts = 0;
    var tick = function () {
      attempts += 1;
      var live = window.gameState || gs;
      if (!live || String(live.phase || "").toLowerCase() !== "attack") return;
      try {
        document.body.classList.remove("risque-artemis-attack-spectator");
        document.body.removeAttribute("data-risque-show-public-dice");
      } catch (eClrSpec) {
        /* ignore */
      }
      if (typeof window.risqueRestoreHostMapCanvasFromPhaseArtifacts === "function") {
        window.risqueRestoreHostMapCanvasFromPhaseArtifacts();
      }
      var uioBoot = document.getElementById("ui-overlay");
      if (
        uioBoot &&
        window.risqueRuntimeHud &&
        typeof window.risqueRuntimeHud.ensure === "function" &&
        (!document.getElementById("control-voice") || !document.getElementById("hud-main-panel"))
      ) {
        window.risqueRuntimeHud.ensure(uioBoot);
      }
      if (typeof window.risqueArtemisStampControlSlot === "function") {
        window.risqueArtemisStampControlSlot(live);
      }
      if (typeof window.risqueArtemisEnsureAttackInteractive === "function") {
        window.risqueArtemisEnsureAttackInteractive(live);
      } else if (typeof window.risqueArtemisSyncPortableAttack === "function") {
        window.risqueArtemisSyncPortableAttack(live);
      }
      var chromeReady =
        window.__risqueAttackInitialized &&
        document.getElementById("attack-toolbar-strip") &&
        document.getElementById("roll");
      if (!chromeReady && attempts < 10) {
        setTimeout(tick, attempts < 4 ? 120 : 280);
      }
    };
    setTimeout(tick, 0);
  }

  function bootAutoSave(loginGs) {
    var saveId = resolveAutoSaveId();
    if (!saveId) return false;
    var file = autoSaveFileName(saveId);

    fetch(file, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " fetching " + file);
        return r.json();
      })
      .then(function (mock) {
        if (!mock || !Array.isArray(mock.players)) {
          throw new Error(file + " is not a valid gameState");
        }
        var gs;
        try {
          gs = mergeRosterIntoMock(JSON.parse(JSON.stringify(mock)), loginGs, saveId);
        } catch (eMerge) {
          gs = mergeRosterIntoMock(mock, loginGs, saveId);
        }
        persistState(gs);
        showAutoSaveBanner(gs, saveId);
        var phase = String(gs.phase || "cardplay").toLowerCase();
        if (typeof window.risqueArtemisSetupMilestone === "function") {
          window.risqueArtemisSetupMilestone("AUTO-SAVE-" + phase, file);
        }
        navigateMockPhase(gs, phase, saveId);
        scheduleConquerAttackBootRecovery(gs, saveId);
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        try {
          console.error("[ARTEMIS auto-save] failed:", msg);
        } catch (eLog) {
          /* ignore */
        }
        if (typeof window.risqueArtemisSetTopStatus === "function") {
          window.risqueArtemisSetTopStatus("AUTO-SAVE FAILED: " + msg, "err");
        }
        try {
          alert(
            "Could not load mock save " +
              file +
              ".\n\n" +
              msg +
              "\n\nFalling back to normal setup."
          );
        } catch (eAlert) {
          /* ignore */
        }
        if (
          window.risqueArtemisHost &&
          typeof window.risqueArtemisBeginSetupAfterLogin === "function"
        ) {
          window.risqueArtemisBeginSetupAfterLogin(loginGs);
        }
      });
    return true;
  }

  window.risqueArtemisAutoSaveStartToCardplay = bootAutoSave;
  window.risqueArtemisAutoSaveBoot = bootAutoSave;

  window.risqueArtemisAutoSaveEnabled = function () {
    return !!resolveAutoSaveId();
  };

  window.risqueArtemisConquerAutoSaveId = function (scenario, entry) {
    scenario = Number(scenario) || 1;
    entry = entry === "cardplay" ? "cardplay" : "attack";
    var base =
      scenario === 1
        ? "conquer-guido"
        : scenario === 2
          ? "conquer-mictor-guido"
          : scenario === 3
            ? "conquer-mictor-nooch"
            : "conquer-nooch-guido";
    return entry === "cardplay" ? base + "-cardplay" : base;
  };
})();
