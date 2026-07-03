/**
 * ARTEMIS auto mock-save boot — zero keyboard shortcuts.
 * Enable with ?artemisAutoSave=cards on join URLs (see launchers/profiles.json cardplay-test mode).
 * After fast-boot login, fetches cards.json and jumps straight to round-4 cardplay (Guido + book).
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

  function autoSaveFileName(id) {
    var s = String(id || "cards").trim();
    if (!s) s = "cards";
    if (/\.json$/i.test(s)) return s;
    return s + ".json";
  }

  function readMockFirstSlot() {
    if (window.risqueArtemisMockFirstSlot) {
      var fromWin = Number(window.risqueArtemisMockFirstSlot) || 0;
      if (fromWin >= 1 && fromWin <= 3) return fromWin;
    }
    try {
      var s = sessionStorage.getItem("risqueArtemisMockFirstSlot");
      if (s) {
        var fromSs = Number(s) || 0;
        if (fromSs >= 1 && fromSs <= 3) return fromSs;
      }
    } catch (eSs) {
      /* ignore */
    }
    return 1;
  }

  function playerNameForSlot(out, slot) {
    slot = Number(slot) || 1;
    if (slot < 1 || slot > 3) slot = 1;
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

  function mergeRosterIntoMock(mock, loginGs) {
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
    applyMockFirstPlayer(out, readMockFirstSlot());
    if (typeof window.risqueArtemisForceControlSlotFromCurrentPlayer === "function") {
      window.risqueArtemisForceControlSlotFromCurrentPlayer(out);
    } else if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(out);
    }
    out.setupComplete = true;
    out.isInitialDeploy = false;
    out.phase = "cardplay";
    out.risqueArtemisAutoSaveId = "cards";
    if (!out.risqueArtemisAutoSaveLabel) {
      out.risqueArtemisAutoSaveLabel = "CARDPLAY TEST — Round 4";
    }
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

  function navigateCardplay(gs) {
    var url = "game.html?phase=cardplay&legacyNext=income.html&postReceive=1";
    if (typeof window.risqueArtemisAppendSessionParams === "function") {
      url = window.risqueArtemisAppendSessionParams(url);
    }
    try {
      var q = new URL(window.location.href).searchParams;
      var autoId = q.get("artemisAutoSave");
      if (autoId) {
        url += (url.indexOf("?") >= 0 ? "&" : "?") + "artemisAutoSave=" + encodeURIComponent(autoId);
      }
    } catch (eUrl) {
      /* ignore */
    }
    if (typeof window.risqueNavigateGameHtmlSoft === "function" && window.risqueNavigateGameHtmlSoft(url)) {
      try {
        console.info("[ARTEMIS auto-save] soft-nav to cardplay ->", url);
      } catch (eLogNav) {
        /* ignore */
      }
      if (window.risqueArtemisHost) pushHostMirror(gs);
      return;
    }
    // A FULL page reload on the host = the sign-in trap (game already started server-side,
    // host can't re-join, lands on login). Never full-reload the host during mock boot;
    // surface the failure instead so we can see why soft-nav was refused.
    if (window.risqueArtemisHost) {
      var softAllowed =
        typeof window.risqueArtemisSoftNavAllowed === "function"
          ? window.risqueArtemisSoftNavAllowed()
          : !window.risqueDisplayIsPublic;
      var diag = {
        url: url,
        softAllowed: softAllowed,
        isPublic: !!window.risqueDisplayIsPublic,
        hasSoftFn: typeof window.risqueNavigateGameHtmlSoft === "function"
      };
      try {
        console.error("[ARTEMIS auto-save] host soft-nav to cardplay REFUSED (would loop to sign-in). Diag:", diag);
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

  function showAutoSaveBanner(gs) {
    var who = gs && gs.currentPlayer ? String(gs.currentPlayer) : "GUIDO";
    var msg =
      "CARDPLAY TEST — " +
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
        window.risqueArtemisDiag("auto-save-boot", "Loaded cards.json mock save", {
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

  window.risqueArtemisAutoSaveStartToCardplay = function (loginGs) {
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
          gs = mergeRosterIntoMock(JSON.parse(JSON.stringify(mock)), loginGs);
        } catch (eMerge) {
          gs = mergeRosterIntoMock(mock, loginGs);
        }
        persistState(gs);
        showAutoSaveBanner(gs);
        if (typeof window.risqueArtemisSetupMilestone === "function") {
          window.risqueArtemisSetupMilestone("AUTO-SAVE-cardplay", file);
        }
        navigateCardplay(gs);
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
  };

  window.risqueArtemisAutoSaveEnabled = function () {
    return !!resolveAutoSaveId();
  };
})();
