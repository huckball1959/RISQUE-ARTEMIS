/**
 * Continental elimination celebration + handoff to receive-card (conquest path).
 * Invoked from attack.js while phase stays "attack" until the host proceeds.
 */
(function () {
  "use strict";

  var CELEBRATION_FLASH_MS = 3500;
  var STYLE_ID = "risque-conquer-inline-v1";
  var celebrationTimer = null;
  var confettiStartedSig = "";
  var CONFETTI_SRC =
    "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      ".runtime-hud-root--conquest-celebration #hud-attack-chrome," +
      ".runtime-hud-root--conquest-celebration #ucp-slot-strip," +
      ".runtime-hud-root--conquest-celebration #log-text," +
      ".runtime-hud-root--conquest-celebration .attack-reinforce-footer { display: none !important; }";
    document.head.appendChild(st);
  }

  function playerColor(name, gs) {
    if (!name || !gs || !gs.players || !window.gameUtils || !window.gameUtils.colorMap) return "#fbbf24";
    var pl = gs.players.find(function (p) {
      return p && p.name === name;
    });
    return pl ? window.gameUtils.colorMap[pl.color] || "#fbbf24" : "#fbbf24";
  }

  function collectSessionPlayerNames(gs) {
    var names = [];
    var seen = {};
    function add(n) {
      n = n != null ? String(n).trim() : "";
      if (!n || seen[n]) return;
      seen[n] = true;
      names.push(n);
    }
    if (gs && gs.artemisRoster && Array.isArray(gs.artemisRoster)) {
      gs.artemisRoster.forEach(function (r) {
        if (r && r.name) add(r.name);
      });
    }
    if (gs && Array.isArray(gs.turnOrder)) {
      gs.turnOrder.forEach(add);
    }
    if (gs && Array.isArray(gs.players)) {
      gs.players.forEach(function (p) {
        if (p && p.name) add(p.name);
      });
    }
    return names;
  }

  function parseConquestNames(gs, line) {
    var defName = gs.defeatedPlayer != null ? String(gs.defeatedPlayer).trim() : "";
    var atkName = gs.currentPlayer != null ? String(gs.currentPlayer).trim() : "";
    var m = String(line || "").match(/^(.+?)\s+has conquered\s+(.+)$/i);
    if (m) {
      atkName = String(m[1] || atkName).trim() || atkName;
      defName = String(m[2] || defName).trim() || defName;
    }
    return { atkName: atkName, defName: defName };
  }

  function buildRosterHtml(gs, atkName, defName) {
    var names = collectSessionPlayerNames(gs);
    if (!names.length && (atkName || defName)) {
      if (atkName) names.push(atkName);
      if (defName && names.indexOf(defName) === -1) names.push(defName);
    }
    var items = names
      .map(function (name) {
        var cls = "risque-conquest-roster-item";
        var style = ' style="color:' + escapeHtml(playerColor(name, gs)) + '"';
        if (name === atkName) cls += " risque-conquest-roster-item--conqueror";
        if (name === defName) cls += " risque-conquest-roster-item--eliminated";
        return '<li class="' + cls + '"' + style + ">" + escapeHtml(name.toUpperCase()) + "</li>";
      })
      .join("");
    return (
      '<div class="risque-conquest-roster" aria-label="Active players">' +
      '<div class="risque-conquest-roster-label">Active players</div>' +
      '<ul class="risque-conquest-roster-list">' +
      items +
      "</ul></div>"
    );
  }

  function buildSparkleHtml() {
    var html = '<div class="risque-conquest-sparkles" aria-hidden="true">';
    for (var i = 0; i < 16; i += 1) {
      html += '<span class="risque-conquest-sparkle" style="--i:' + i + '"></span>';
    }
    return html + "</div>";
  }

  function removeConfettiCanvas() {
    var c = document.getElementById("risque-conquest-confetti-canvas");
    if (c && c.parentNode) c.parentNode.removeChild(c);
  }

  function loadConfettiScript(done) {
    if (window.confetti && typeof window.confetti.create === "function") {
      done(true);
      return;
    }
    var existing = document.querySelector('script[data-risque-confetti="1"]');
    if (existing) {
      existing.addEventListener("load", function () {
        done(!!(window.confetti && typeof window.confetti.create === "function"));
      });
      existing.addEventListener("error", function () {
        done(false);
      });
      return;
    }
    var s = document.createElement("script");
    s.src = CONFETTI_SRC;
    s.setAttribute("data-risque-confetti", "1");
    s.onload = function () {
      done(!!(window.confetti && typeof window.confetti.create === "function"));
    };
    s.onerror = function () {
      done(false);
    };
    document.head.appendChild(s);
  }

  function startConquestConfetti(sig) {
    if (!sig || confettiStartedSig === sig) return;
    confettiStartedSig = sig;
    loadConfettiScript(function (ok) {
      if (!ok) return;
      var wrapper = document.getElementById("canvas") || document.body;
      removeConfettiCanvas();
      var canvas = document.createElement("canvas");
      canvas.id = "risque-conquest-confetti-canvas";
      wrapper.appendChild(canvas);
      var confettiApi = window.confetti.create(canvas, { resize: true, useWorker: false });
      var end = Date.now() + 6500;
      var colors = ["#fbbf24", "#22c55e", "#38bdf8", "#f472b6", "#fde68a", "#ffffff"];
      function burst() {
        if (Date.now() > end) return;
        confettiApi({
          particleCount: 70,
          spread: 72,
          startVelocity: 42,
          origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.35 },
          colors: colors,
          zIndex: 100050
        });
        setTimeout(burst, 280 + Math.random() * 220);
      }
      burst();
      confettiApi({ particleCount: 120, spread: 100, origin: { y: 0.58 } });
    });
  }

  function removeConquestCelebrationOverlay() {
    var overlay = document.getElementById("risque-conquest-celebration-overlay");
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    removeConfettiCanvas();
    confettiStartedSig = "";
  }

  function syncConquestCelebrationOverlay(gs, atkName, defName, showBtn) {
    var sig = atkName + "|" + defName;
    var overlay = document.getElementById("risque-conquest-celebration-overlay");
    if (overlay && overlay.getAttribute("data-sig") === sig) {
      var proceedExisting = document.getElementById("risque-conquest-overlay-proceed");
      if (proceedExisting) {
        proceedExisting.hidden = !showBtn || !!window.risqueDisplayIsPublic;
        proceedExisting.classList.toggle("risque-conquest-overlay-proceed--visible", !!showBtn);
      }
      return;
    }
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);

    overlay = document.createElement("div");
    overlay.id = "risque-conquest-celebration-overlay";
    overlay.className = "risque-conquest-celebration-overlay";
    overlay.setAttribute("data-sig", sig);
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Player elimination");

    var atkColor = playerColor(atkName, gs);
    var defColor = playerColor(defName, gs);
    var hostPrivate = !window.risqueDisplayIsPublic;

    overlay.innerHTML =
      '<div class="risque-conquest-celebration-backdrop"></div>' +
      buildSparkleHtml() +
      '<div class="risque-conquest-celebration-panel">' +
      '<div class="risque-conquest-celebration-badge">Elimination</div>' +
      '<h1 class="risque-conquest-celebration-headline">' +
      '<span class="risque-conquest-celebration-conqueror" style="color:' +
      escapeHtml(atkColor) +
      '">' +
      escapeHtml((atkName || "?").toUpperCase()) +
      "</span>" +
      '<span class="risque-conquest-celebration-headline-mid">has conquered</span>' +
      '<span class="risque-conquest-celebration-defeated" style="color:' +
      escapeHtml(defColor) +
      '">' +
      escapeHtml((defName || "?").toUpperCase()) +
      "</span>" +
      "</h1>" +
      buildRosterHtml(gs, atkName, defName) +
      '<p class="risque-conquest-celebration-sub">' +
      (hostPrivate
        ? "Territories seized — card transfer comes next."
        : "Host advances the next step on the private screen.") +
      "</p>" +
      (hostPrivate
        ? '<button type="button" id="risque-conquest-overlay-proceed" class="risque-conquest-overlay-proceed"' +
          (showBtn ? "" : " hidden") +
          ">" +
          escapeHtml(
            "Proceed to take " + (defName ? defName.toUpperCase() + "'s cards" : "defeated cards")
          ) +
          "</button>"
        : "") +
      "</div>";

    document.body.appendChild(overlay);
    startConquestConfetti(sig);

    if (hostPrivate) {
      var obtn = document.getElementById("risque-conquest-overlay-proceed");
      if (obtn) {
        obtn.classList.toggle("risque-conquest-overlay-proceed--visible", !!showBtn);
        if (!obtn.__risqueConquestWired) {
          obtn.__risqueConquestWired = true;
          obtn.addEventListener("click", risqueConquerOnProceedToTakeCards);
        }
      }
    }

    requestAnimationFrame(function () {
      overlay.classList.add("risque-conquest-celebration-overlay--shown");
    });
  }

  function teardownConquestCelebration(gs) {
    var rhOff = document.getElementById("runtime-hud-root");
    if (rhOff) rhOff.classList.remove("runtime-hud-root--conquest-celebration");
    var vtOff = document.getElementById("control-voice-text");
    if (vtOff && vtOff.querySelector(".risque-conquest-celebration-root")) {
      vtOff.innerHTML = "";
    }
    removeConquestCelebrationOverlay();
    if (gs) delete gs.risquePublicConquestCelebrationHtml;
  }

  function persist(gs) {
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (e) {
      /* ignore */
    }
    if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    } else {
      window.gameState = gs;
    }
    if (typeof window.risqueMirrorPushGameState === "function") {
      window.risqueMirrorPushGameState();
    }
  }

  /**
   * Build / refresh celebration DOM from gameState (host + public TV).
   */
  function risqueConquerSyncCelebrationFromState(gs) {
    if (!gs) return;
    injectStyles();

    if (!gs.risqueConquestFlowActive) {
      teardownConquestCelebration(gs);
      return;
    }

    var line = gs.risqueConquestCelebrationLine != null ? String(gs.risqueConquestCelebrationLine) : "";
    var showBtn = !!gs.risqueConquestCelebrationShowButton;
    var names = parseConquestNames(gs, line);
    var atkName = names.atkName;
    var defName = names.defName;

    syncConquestCelebrationOverlay(gs, atkName, defName, showBtn);

    var ui = document.getElementById("ui-overlay");
    if (!ui || !window.risqueRuntimeHud) return;

    window.risqueRuntimeHud.ensure(ui);
    window.risqueRuntimeHud.setAttackChromeInteractive(false);
    window.risqueRuntimeHud.clearPhaseSlot();

    var rh = document.getElementById("runtime-hud-root");
    if (rh) rh.classList.add("runtime-hud-root--conquest-celebration");

    var html =
      '<div class="risque-conquest-celebration-root" role="region" aria-label="Elimination">' +
      '<div class="risque-conquest-celebration-line' +
      (showBtn ? " risque-conquest-celebration-line--steady" : "") +
      '">' +
      escapeHtml(line) +
      "</div>";

    if (window.risqueDisplayIsPublic) {
      html +=
        '<div class="risque-conquest-celebration-tv-hint" role="status">Celebration on all screens — host advances on the private screen.</div>';
    } else if (showBtn) {
      html +=
        '<button type="button" id="risque-conquest-proceed-take-cards" class="risque-conquest-celebration-btn">' +
        escapeHtml("PROCEED TO TAKE " + (defName ? defName.toUpperCase() + "'S CARDS" : "DEFEATED CARDS")) +
        "</button>";
    } else {
      html += '<div class="risque-conquest-celebration-wait">Celebrating…</div>';
    }

    html += "</div>";

    var vt = document.getElementById("control-voice-text");
    var vr = document.getElementById("control-voice-report");
    if (!vt) return;
    vt.innerHTML = html;
    if (vr) {
      vr.textContent = "";
      vr.style.display = "none";
    }

    gs.risquePublicConquestCelebrationHtml = html;
    try {
      gs.risqueControlVoice = {
        primary: line,
        report: "",
        reportClass: ""
      };
    } catch (eCv) {
      /* ignore */
    }

    if (!window.risqueDisplayIsPublic && showBtn) {
      var btn = document.getElementById("risque-conquest-proceed-take-cards");
      if (btn && !btn.__risqueConquestWired) {
        btn.__risqueConquestWired = true;
        btn.addEventListener("click", risqueConquerOnProceedToTakeCards);
        btn.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            risqueConquerOnProceedToTakeCards();
          }
        });
      }
    }

    requestAnimationFrame(function () {
      if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.syncPosition === "function") {
        window.risqueRuntimeHud.syncPosition();
      }
    });
  }

  function risqueConquerOnProceedToTakeCards() {
    var gs = window.gameState;
    if (!gs || !gs.risqueConquestFlowActive) return;

    if (celebrationTimer != null) {
      clearTimeout(celebrationTimer);
      celebrationTimer = null;
    }

    gs.risqueConquestFlowActive = false;
    delete gs.risqueConquestCelebrationLine;
    gs.risqueConquestCelebrationShowButton = false;
    delete gs.risquePublicConquestCelebrationHtml;
    gs.risqueConquestElimReceiveCard = true;
    gs.phase = "receivecard";
    gs.risqueConquestChainActive = true;
    if (
      window.gameUtils &&
      typeof window.gameUtils.syncConquestPendingNewContinents === "function"
    ) {
      window.gameUtils.syncConquestPendingNewContinents(gs);
    }

    var rh = document.getElementById("runtime-hud-root");
    if (rh) rh.classList.remove("runtime-hud-root--conquest-celebration");
    var vtDone = document.getElementById("control-voice-text");
    if (vtDone) vtDone.innerHTML = "";
    removeConquestCelebrationOverlay();

    persist(gs);

    var nav = "game.html?phase=receivecard&conquestElim=1";
    if (window.risqueNavigateWithFade) {
      window.risqueNavigateWithFade(nav);
    } else {
      window.location.href = nav;
    }
  }

  /**
   * Entry from attack.js after combat elimination (replaces modal + game.html?phase=conquer hop).
   */
  function risqueConquerStartEliminationFlow(attackerPlayer, defenderPlayer) {
    injectStyles();

    var gsPre = window.gameState;
    /* Match attack.js: only bail while deferred elimination troop transfer is active — not for
     * any stale pending_transfer snapshot (would skip celebration on a later elimination). */
    if (
      gsPre &&
      String(gsPre.phase || "") === "attack" &&
      String(gsPre.attackPhase || "") === "pending_transfer" &&
      gsPre.acquiredTerritory &&
      gsPre.attackingTerritory &&
      gsPre.risqueDeferConquerElimination
    ) {
      return;
    }

    if (typeof window.risqueDismissAttackPrompt === "function") {
      window.risqueDismissAttackPrompt();
    }

    var atkName = attackerPlayer && attackerPlayer.name ? String(attackerPlayer.name) : "";
    var defName = defenderPlayer && defenderPlayer.name ? String(defenderPlayer.name) : "";
    var gs = window.gameState;
    if (!gs) return;

    gs.risqueConquestChainActive = true;
    gs.risqueConquestFlowActive = true;
    gs.risqueConquestCelebrationLine = atkName + " has conquered " + defName;
    gs.risqueConquestCelebrationShowButton = false;
    delete gs.risquePublicEliminationBanner;
    delete gs.risqueControlVoice;

    /* Build HTML + gs.risquePublicConquestCelebrationHtml before persist so the public mirror includes it. */
    risqueConquerSyncCelebrationFromState(gs);
    persist(gs);

    if (celebrationTimer != null) {
      clearTimeout(celebrationTimer);
      celebrationTimer = null;
    }
    celebrationTimer = setTimeout(function () {
      celebrationTimer = null;
      var g2 = window.gameState;
      if (!g2 || !g2.risqueConquestFlowActive) return;
      g2.risqueConquestCelebrationShowButton = true;
      risqueConquerSyncCelebrationFromState(g2);
      persist(g2);
    }, CELEBRATION_FLASH_MS);
  }

  window.risqueConquerStartEliminationFlow = risqueConquerStartEliminationFlow;
  window.risqueConquerSyncCelebrationFromState = risqueConquerSyncCelebrationFromState;
})();
