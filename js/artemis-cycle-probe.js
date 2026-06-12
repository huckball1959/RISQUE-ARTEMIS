/**
 * ARTEMIS 18-step cycle probe — 6 phases × 3 players.
 * Uses real game.html HUD + WebSocket mirror (not standalone probe.html).
 * Placeholder panels prove active vs waiting role on each laptop.
 */
(function () {
  "use strict";

  if (!window.risqueArtemisCycleProbeActive) return;

  var DOCK_ID = "risque-artemis-cycle-probe-dock";
  var HOST_BAR_ID = "risque-cycle-probe-host-bar";
  var CLIENT_BAR_ID = "risque-cycle-probe-client-bar";
  var BANNER_ID = "risque-cycle-probe-mode-banner";
  var autoTimer = null;
  var probeRunning = false;
  var currentStep = -1;
  var idlePollTimer = null;

  var PHASE_META = [
    { id: "cardplay", label: "CARD PLAY" },
    { id: "income", label: "INCOME" },
    { id: "deploy", label: "DEPLOY" },
    { id: "attack", label: "ATTACK" },
    { id: "reinforce", label: "REINFORCE" },
    { id: "receivecard", label: "RECEIVE CARD" }
  ];

  var SLOT_NAMES = { 1: "GUIDO", 2: "MICTOR", 3: "NOOCH" };

  function normName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function mySlot() {
    if (window.risqueArtemisHost) return 1;
    if (typeof window.risqueArtemisEnsureClientSlot === "function") {
      window.risqueArtemisEnsureClientSlot();
    }
    return Number(window.risqueArtemisPlayerSlot) || 0;
  }

  function rosterFromState(gs) {
    if (gs && gs.artemisRoster && gs.artemisRoster.length) {
      return gs.artemisRoster.slice();
    }
    try {
      var raw = sessionStorage.getItem("risqueArtemisRoster");
      if (raw) return JSON.parse(raw);
    } catch (eR) {
      /* ignore */
    }
    if (window.risqueArtemisFixedProfiles) {
      return [1, 2, 3].map(function (s) {
        var p = window.risqueArtemisFixedProfiles[s];
        return { slot: s, name: normName(p && p.name) };
      });
    }
    return [
      { slot: 1, name: "GUIDO" },
      { slot: 2, name: "MICTOR" },
      { slot: 3, name: "NOOCH" }
    ];
  }

  function buildSteps(roster) {
    var steps = [];
    /* Player-first: each player runs all 6 phases, then hand off to next player. */
    roster.forEach(function (r) {
      PHASE_META.forEach(function (ph) {
        steps.push({
          phase: ph.id,
          phaseLabel: ph.label,
          slot: Number(r.slot) || 0,
          player: normName(r.name)
        });
      });
    });
    return steps;
  }

  function nameForSlot(roster, slot) {
    var hit = roster.find(function (r) {
      return Number(r.slot) === Number(slot);
    });
    return hit && hit.name ? normName(hit.name) : SLOT_NAMES[slot] || "PLAYER" + slot;
  }

  function minimalPlayers(roster) {
    return roster.map(function (r, i) {
      return {
        name: normName(r.name),
        color: ["blue", "red", "yellow"][i] || "blue",
        playerOrder: Number(r.slot) || i + 1,
        territories: [],
        cards: [],
        cardCount: 0,
        bankValue: 0
      };
    });
  }

  function stepAt(index, roster) {
    var steps = buildSteps(roster);
    if (index < 0 || index >= steps.length) return null;
    return steps[index];
  }

  function probeIsLive(gs) {
    return !!(
      gs &&
      gs.artemisCycleProbe &&
      typeof gs.artemisCycleProbeStep === "number" &&
      gs.artemisCycleProbeStep >= 0
    );
  }

  function syncLocalProbeFlags(gs) {
    if (probeIsLive(gs)) {
      probeRunning = true;
      currentStep = Number(gs.artemisCycleProbeStep) || 0;
    }
    try {
      document.documentElement.classList.add("risque-artemis-cycle-probe-page");
    } catch (eCls) {
      /* ignore */
    }
  }

  function enterClientProbePlayMode() {
    if (!window.risqueArtemisNetClient || window.risqueArtemisHost) return;
    window.risqueArtemisClientPlaying = true;
    window.risqueDisplayIsPublic = false;
    window.risqueDisplayMode = "host";
    document.documentElement.classList.remove("risque-view-public");
    document.documentElement.classList.add("risque-view-host");
    document.documentElement.classList.add("risque-artemis-my-turn");
    document.body.classList.remove("risque-view-public");
    document.body.classList.add("risque-view-host");
  }

  function exitClientProbePlayMode() {
    if (!window.risqueArtemisNetClient || window.risqueArtemisHost) return;
    window.risqueArtemisClientPlaying = false;
    window.risqueDisplayIsPublic = true;
    window.risqueDisplayMode = "public";
    document.documentElement.classList.remove("risque-view-host");
    document.documentElement.classList.remove("risque-artemis-my-turn");
    document.documentElement.classList.add("risque-view-public");
    document.body.classList.remove("risque-view-host");
    document.body.classList.add("risque-view-public");
  }

  function allProfilesLoggedIn() {
    try {
      var raw = sessionStorage.getItem("risqueArtemisLoginProfiles");
      if (!raw) return false;
      var profs = JSON.parse(raw);
      return !!(profs && profs["1"] && profs["2"] && profs["3"]);
    } catch (eP) {
      return false;
    }
  }

  function isActiveForMe(gs) {
    if (!gs) return false;
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }
    if (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) {
      return true;
    }
    if (
      typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
      window.risqueArtemisClientNameMatchesCurrent(gs)
    ) {
      return true;
    }
    var local = mySlot();
    var ctrl = Number(gs.artemisControlSlot) || 0;
    return local >= 1 && ctrl === local;
  }

  function ensureCycleProbeBanner() {
    if (document.getElementById(BANNER_ID)) return;
    var bar = document.createElement("div");
    bar.id = BANNER_ID;
    bar.className = "risque-cycle-probe-mode-banner";
    bar.setAttribute("role", "status");
    bar.textContent =
      "CYCLE PROBE MODE — placeholder panels only. This is NOT the real game. Host: click BEGIN at the bottom.";
    document.body.appendChild(bar);
  }

  function renderPreBeginIdle() {
    if (probeRunning || probeIsLive(window.gameState)) return;
    var dock = ensureDock();
    var roster = rosterFromState(window.gameState);
    var ready = allProfilesLoggedIn();
    if (window.risqueArtemisHost) {
      dock.innerHTML =
        '<div class="cycle-probe-panel cycle-probe-panel--waiting" role="status">' +
        '<div class="cycle-probe-panel__badge">CYCLE PROBE</div>' +
        '<div class="cycle-probe-panel__phase">Ready to begin</div>' +
        '<div class="cycle-probe-panel__player">' +
        (ready
          ? "All 3 players signed in — use the green bar at the bottom."
          : "Waiting for all 3 players to sign in…") +
        "</div>" +
        '<div class="cycle-probe-panel__hint">Do not play the normal game. Click BEGIN 18-STEP PROBE below.</div>' +
        "</div>";
    } else {
      dock.innerHTML =
        '<div class="cycle-probe-panel cycle-probe-panel--waiting" role="status">' +
        '<div class="cycle-probe-panel__badge">WAITING</div>' +
        '<div class="cycle-probe-panel__phase">Cycle probe</div>' +
        '<div class="cycle-probe-panel__player">Waiting for host to click <strong>BEGIN</strong></div>' +
        '<div class="cycle-probe-panel__hint">Gray panel = correct. Green active panels start after BEGIN.</div>' +
        "</div>";
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
      window.risqueRuntimeHud.setControlVoiceText(
        ready ? "CYCLE PROBE — ready for BEGIN" : "CYCLE PROBE — waiting for sign-in",
        ready ? "Host: click BEGIN 18-STEP PROBE" : "All 3 players must sign in first"
      );
    }
  }

  window.risqueArtemisCycleProbeOnLoginComplete = function (gs) {
    ensureCycleProbeBanner();
    renderPreBeginIdle();
    updateHostBar(gs || window.gameState);
    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag("cycle_probe_login_ok", "Cycle probe idle after sign-in", {
        host: !!window.risqueArtemisHost,
        allReady: allProfilesLoggedIn()
      });
    }
  };

  function ensureDock() {
    var dock = document.getElementById(DOCK_ID);
    if (dock) {
      dock.hidden = false;
      return dock;
    }
    var phaseSlot = document.getElementById("risque-phase-content");
    dock = document.createElement("div");
    dock.id = DOCK_ID;
    dock.className = "risque-artemis-cycle-probe-dock";
    dock.setAttribute("role", "region");
    dock.setAttribute("aria-label", "Cycle probe placeholder");
    if (phaseSlot && phaseSlot.parentNode) {
      phaseSlot.parentNode.insertBefore(dock, phaseSlot.nextSibling);
    } else {
      var overlay = document.getElementById("ui-overlay");
      if (overlay) overlay.appendChild(dock);
      else document.body.appendChild(dock);
    }
    return dock;
  }

  function hideDock() {
    var dock = document.getElementById(DOCK_ID);
    if (dock) {
      dock.innerHTML = "";
      dock.hidden = true;
    }
  }

  function phaseBannerLabel(ph) {
    var hit = PHASE_META.find(function (p) {
      return p.id === ph;
    });
    return hit ? hit.label : String(ph || "PHASE").toUpperCase();
  }

  function activePlaceholderHtml(gs, step) {
    var phLabel = step ? step.phaseLabel : phaseBannerLabel(gs.phase);
    var name = normName(gs.currentPlayer);
    return (
      '<div id="cycle-probe-active-panel" class="cycle-probe-panel cycle-probe-panel--active" role="status">' +
      '<div class="cycle-probe-panel__badge">YOUR TURN</div>' +
      '<div class="cycle-probe-panel__phase">' +
      phLabel +
      "</div>" +
      '<div class="cycle-probe-panel__player">' +
      name +
      " · P" +
      String(step ? step.slot : gs.artemisControlSlot || "?") +
      "</div>" +
      '<div class="cycle-probe-panel__hint">Placeholder — tap SKIP or CONFIRM here, or host uses NEXT STEP below.</div>' +
      '<div class="cycle-probe-fake-toolbar">' +
      '<span class="cycle-probe-fake-btn">CARD</span>' +
      '<span class="cycle-probe-fake-btn">BOOK</span>' +
      '<button type="button" class="cycle-probe-fake-btn cycle-probe-fake-skip" id="cycle-probe-fake-skip">SKIP</button>' +
      '<button type="button" class="cycle-probe-fake-btn cycle-probe-fake-confirm" id="cycle-probe-fake-confirm">CONFIRM</button>' +
      "</div>" +
      "</div>"
    );
  }

  function waitingPlaceholderHtml(gs, step) {
    var phLabel = step ? step.phaseLabel : phaseBannerLabel(gs.phase);
    var name = normName(gs.currentPlayer);
    return (
      '<div id="cycle-probe-waiting-panel" class="cycle-probe-panel cycle-probe-panel--waiting" role="status">' +
      '<div class="cycle-probe-panel__badge">WAITING</div>' +
      '<div class="cycle-probe-panel__phase">' +
      phLabel +
      "</div>" +
      '<div class="cycle-probe-panel__player">Waiting for <strong>' +
      name +
      "</strong></div>" +
      '<div class="cycle-probe-panel__hint">Only their laptop should show the green active panel.</div>' +
      "</div>"
    );
  }

  function teardownRealPhaseUiForProbe() {
    if (typeof window.risqueArtemisStopCardplayWatchdog === "function") {
      try {
        window.risqueArtemisStopCardplayWatchdog();
      } catch (eWd) {
        /* ignore */
      }
    }
    [
      "risqueArtemisUnmountPortableCardplay",
      "risqueArtemisUnmountPortableTurnDeploy",
      "risqueArtemisUnmountPortableIncome",
      "risqueArtemisUnmountPortableAttack",
      "risqueArtemisUnmountPortableReinforce",
      "risqueArtemisUnmountPortableDeploy"
    ].forEach(function (fnName) {
      if (typeof window[fnName] === "function") {
        try {
          window[fnName]();
        } catch (eUn) {
          /* ignore */
        }
      }
    });
    if (typeof window.risqueArtemisTeardownMockPhases === "function") {
      try {
        window.risqueArtemisTeardownMockPhases();
      } catch (eMock) {
        /* ignore */
      }
    }
  }

  function requestProbeAdvance() {
    if (window.risqueArtemisHost) {
      stopAuto();
      advanceStep(1);
      return;
    }
    var gs = window.gameState;
    if (!gs || !probeIsLive(gs) || !isActiveForMe(gs)) return;
    if (typeof window.risqueArtemisSend === "function") {
      var sent = window.risqueArtemisSend({
        type: "cycle_probe_advance",
        slot: mySlot(),
        step: Number(gs.artemisCycleProbeStep) || 0
      });
      if (!sent && typeof window.risqueArtemisDiag === "function") {
        window.risqueArtemisDiag("cycle_probe_advance_fail", "P" + mySlot() + " could not send advance to host", {
          step: Number(gs.artemisCycleProbeStep) || 0
        });
      }
    }
  }

  function wireProbeAdvanceButton(el) {
    if (!el) return;
    el.classList.add("cycle-probe-fake-btn--live");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.style.pointerEvents = "auto";
    el.style.cursor = "pointer";
    el.onclick = function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      if (ev && ev.stopPropagation) ev.stopPropagation();
      requestProbeAdvance();
    };
  }

  function renderProbeUi(gs) {
    if (!gs || !gs.artemisCycleProbe) return;
    syncLocalProbeFlags(gs);

    if (typeof window.risqueArtemisStopCardplayWatchdog === "function") {
      try {
        window.risqueArtemisStopCardplayWatchdog();
      } catch (eWd2) {
        /* ignore */
      }
    }
    var phaseSlotClear = document.getElementById("risque-phase-content");
    if (phaseSlotClear) {
      phaseSlotClear.innerHTML = "";
    }

    var stepIndex = Number(gs.artemisCycleProbeStep) || 0;
    var roster = rosterFromState(gs);
    var step = stepAt(stepIndex, roster);
    var mine = isActiveForMe(gs);
    var dock = ensureDock();

    if (mine) {
      if (window.risqueArtemisNetClient && !window.risqueArtemisHost) {
        enterClientProbePlayMode();
      }
    } else if (window.risqueArtemisNetClient && !window.risqueArtemisHost) {
      exitClientProbePlayMode();
      if (typeof window.risqueArtemisUnmountPortableCardplay === "function") {
        try {
          window.risqueArtemisUnmountPortableCardplay();
        } catch (eUnCp) {
          /* ignore */
        }
      }
    }

    dock.innerHTML = mine ? activePlaceholderHtml(gs, step) : waitingPlaceholderHtml(gs, step);

    if (mine) {
      wireProbeAdvanceButton(document.getElementById("cycle-probe-fake-skip"));
      wireProbeAdvanceButton(document.getElementById("cycle-probe-fake-confirm"));
    }

    try {
      document.body.setAttribute("data-risque-phase", String(gs.phase || ""));
    } catch (ePh) {
      /* ignore */
    }

    var rh = document.getElementById("runtime-hud-root");
    if (rh) {
      rh.classList.add("runtime-hud-root--artemis-compact");
      rh.classList.add("runtime-hud-root--artemis-cycle-probe");
    }

    if (typeof window.risqueArtemisSyncMyTurnClass === "function") {
      window.risqueArtemisSyncMyTurnClass(gs);
    } else if (mine) {
      document.documentElement.classList.add("risque-artemis-my-turn");
    } else {
      document.documentElement.classList.remove("risque-artemis-my-turn");
    }
    if (window.risqueRuntimeHud && typeof window.risqueRuntimeHud.setControlVoiceText === "function") {
      var phLabel = step ? step.phaseLabel : phaseBannerLabel(gs.phase);
      if (mine) {
        window.risqueRuntimeHud.setControlVoiceText(
          normName(gs.currentPlayer) + " — " + phLabel,
          "Cycle probe step " + (stepIndex + 1) + "/" + (Number(gs.artemisCycleProbeTotal) || 18) + " — YOU ARE UP"
        );
      } else {
        window.risqueRuntimeHud.setControlVoiceText(
          "WAITING FOR " + normName(gs.currentPlayer) + " — " + phLabel,
          "Cycle probe step " + (stepIndex + 1) + "/" + (Number(gs.artemisCycleProbeTotal) || 18)
        );
      }
    }
    if (typeof window.risqueWireArtemisHudTogglesOnce === "function") {
      window.risqueWireArtemisHudTogglesOnce();
    }

    var domOk = mine
      ? !!document.getElementById("cycle-probe-active-panel") &&
        !!document.getElementById("cycle-probe-fake-skip")
      : !!document.getElementById("cycle-probe-waiting-panel") &&
        !document.getElementById("cycle-probe-active-panel");

    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag(
        domOk ? "cycle_probe_step_ok" : "cycle_probe_step_fail",
        "P" + mySlot() + " step " + (stepIndex + 1) + " " + String(gs.phase) + " " + (mine ? "ACTIVE" : "WAITING"),
        {
          step: stepIndex + 1,
          total: Number(gs.artemisCycleProbeTotal) || 18,
          phase: gs.phase,
          currentPlayer: gs.currentPlayer,
          controlSlot: gs.artemisControlSlot,
          expected: mine ? "active" : "waiting",
          domOk: domOk,
          clientPlaying: !!window.risqueArtemisClientPlaying,
          viewHost: document.documentElement.classList.contains("risque-view-host")
        }
      );
    }

    updateHostBar(gs);
    updateClientBar(gs);
  }

  function ensureClientBar() {
    if (window.risqueArtemisHost) return null;
    var bar = document.getElementById(CLIENT_BAR_ID);
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = CLIENT_BAR_ID;
    bar.className = "risque-cycle-probe-client-bar";
    bar.innerHTML =
      '<div class="risque-cycle-probe-client-bar__title">YOUR TURN — CYCLE PROBE</div>' +
      '<div class="risque-cycle-probe-client-bar__step" id="cycle-probe-client-step"></div>' +
      '<div class="risque-cycle-probe-client-bar__actions">' +
      '<button type="button" id="cycle-probe-client-next-btn" class="risque-cycle-probe-btn risque-cycle-probe-btn--go">NEXT STEP</button>' +
      "</div>";
    document.body.appendChild(bar);
    document.getElementById("cycle-probe-client-next-btn").addEventListener("click", function () {
      requestProbeAdvance();
    });
    return bar;
  }

  function hideClientBar() {
    var bar = document.getElementById(CLIENT_BAR_ID);
    if (bar) bar.hidden = true;
  }

  function updateClientBar(gs) {
    if (window.risqueArtemisHost) {
      hideClientBar();
      return;
    }
    if (!probeIsLive(gs) || !isActiveForMe(gs)) {
      hideClientBar();
      return;
    }
    var bar = ensureClientBar();
    if (!bar) return;
    bar.hidden = false;
    var stepEl = document.getElementById("cycle-probe-client-step");
    var stepIndex = Number(gs.artemisCycleProbeStep) || 0;
    var roster = rosterFromState(gs);
    var step = stepAt(stepIndex, roster);
    var total = Number(gs.artemisCycleProbeTotal) || buildSteps(roster).length;
    if (stepEl && step) {
      stepEl.textContent =
        "Step " +
        (stepIndex + 1) +
        "/" +
        total +
        " — " +
        step.phaseLabel +
        " — tap SKIP/CONFIRM above or NEXT STEP here";
    }
  }

  function buildStepState(stepIndex) {
    var roster = rosterFromState(window.gameState);
    var step = stepAt(stepIndex, roster);
    if (!step) return null;
    var total = buildSteps(roster).length;
    return {
      phase: step.phase,
      currentPlayer: step.player,
      artemisControlSlot: step.slot,
      artemisRoster: roster,
      artemisCycleProbe: true,
      artemisCycleProbeStep: stepIndex,
      artemisCycleProbeTotal: total,
      risqueArtemisControlSeq: stepIndex + 1,
      round: 1,
      turnOrder: roster.map(function (r) {
        return normName(r.name);
      }),
      players: minimalPlayers(roster),
      territories: {},
      continents: {}
    };
  }

  function hostPushStep(stepIndex) {
    if (!window.risqueArtemisHost) return;
    var gs = buildStepState(stepIndex);
    if (!gs) return;
    currentStep = stepIndex;
    probeRunning = true;
    teardownRealPhaseUiForProbe();
    window.gameState = gs;
    if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    }
    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      /* ignore */
    }
    try {
      sessionStorage.setItem("risqueArtemisRoster", JSON.stringify(gs.artemisRoster));
    } catch (eRos) {
      /* ignore */
    }
    if (typeof window.risqueArtemisCycleProbeSync === "function") {
      window.risqueArtemisCycleProbeSync(gs);
    }
    if (typeof window.risqueScheduleMirrorPush === "function") {
      window.risqueScheduleMirrorPush();
    } else if (typeof window.risqueMirrorPushGameState === "function") {
      setTimeout(function () {
        window.risqueMirrorPushGameState();
      }, 0);
    }
    if (typeof window.risqueArtemisDiag === "function") {
      window.risqueArtemisDiag("cycle_probe_advance", "Host step " + (stepIndex + 1) + " → " + gs.currentPlayer + " " + gs.phase, {
        step: stepIndex + 1,
        phase: gs.phase,
        currentPlayer: gs.currentPlayer,
        controlSlot: gs.artemisControlSlot
      });
    }
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function advanceStep(delta) {
    if (!window.risqueArtemisHost) return;
    var roster = rosterFromState(window.gameState);
    var total = buildSteps(roster).length;
    var next = currentStep + (delta || 1);
    if (next >= total) {
      stopAuto();
      if (typeof window.risqueArtemisDiag === "function") {
        window.risqueArtemisDiag("cycle_probe_complete", "All " + total + " steps published", { total: total });
      }
      updateHostBar(window.gameState);
      return;
    }
    hostPushStep(next);
  }

  function ensureHostBar() {
    if (!window.risqueArtemisHost) return;
    var bar = document.getElementById(HOST_BAR_ID);
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = HOST_BAR_ID;
    bar.className = "risque-cycle-probe-host-bar";
    bar.innerHTML =
      '<div class="risque-cycle-probe-host-bar__title">ARTEMIS CYCLE PROBE</div>' +
      '<div class="risque-cycle-probe-host-bar__step" id="cycle-probe-host-step">Waiting to begin…</div>' +
      '<div class="risque-cycle-probe-host-bar__actions">' +
      '<button type="button" id="cycle-probe-begin-btn" class="risque-cycle-probe-btn risque-cycle-probe-btn--go">BEGIN 18-STEP PROBE</button>' +
      '<button type="button" id="cycle-probe-next-btn" class="risque-cycle-probe-btn" hidden>NEXT STEP</button>' +
      '<button type="button" id="cycle-probe-auto-btn" class="risque-cycle-probe-btn" hidden>AUTO (2s)</button>' +
      '<button type="button" id="cycle-probe-stop-btn" class="risque-cycle-probe-btn" hidden>STOP AUTO</button>' +
      "</div>";
    document.body.appendChild(bar);

    document.getElementById("cycle-probe-begin-btn").addEventListener("click", function () {
      if (!allProfilesLoggedIn()) {
        alert("All 3 players must sign in before starting the cycle probe.");
        return;
      }
      stopAuto();
      var beginBtn = document.getElementById("cycle-probe-begin-btn");
      if (beginBtn) beginBtn.disabled = true;
      requestAnimationFrame(function () {
        hostPushStep(0);
        if (beginBtn) beginBtn.disabled = false;
      });
    });
    document.getElementById("cycle-probe-next-btn").addEventListener("click", function () {
      stopAuto();
      advanceStep(1);
    });
    document.getElementById("cycle-probe-auto-btn").addEventListener("click", function () {
      stopAuto();
      autoTimer = setInterval(function () {
        var roster = rosterFromState(window.gameState);
        var total = buildSteps(roster).length;
        if (currentStep + 1 >= total) {
          stopAuto();
          updateHostBar(window.gameState);
          return;
        }
        advanceStep(1);
      }, 2000);
      updateHostBar(window.gameState);
    });
    document.getElementById("cycle-probe-stop-btn").addEventListener("click", function () {
      stopAuto();
      updateHostBar(window.gameState);
    });
    return bar;
  }

  function updateHostBar(gs) {
    if (!window.risqueArtemisHost) return;
    ensureHostBar();
    var stepEl = document.getElementById("cycle-probe-host-step");
    var beginBtn = document.getElementById("cycle-probe-begin-btn");
    var nextBtn = document.getElementById("cycle-probe-next-btn");
    var autoBtn = document.getElementById("cycle-probe-auto-btn");
    var stopBtn = document.getElementById("cycle-probe-stop-btn");
    var roster = rosterFromState(gs);
    var total = buildSteps(roster).length;

    if (!probeRunning) {
      if (stepEl) {
        stepEl.textContent = allProfilesLoggedIn()
          ? "All players signed in — click BEGIN (18 steps: 6 phases per player × 3 players)."
          : "Sign in all 3 players, then click BEGIN.";
      }
      if (beginBtn) beginBtn.hidden = false;
      if (nextBtn) nextBtn.hidden = true;
      if (autoBtn) autoBtn.hidden = true;
      if (stopBtn) stopBtn.hidden = true;
      return;
    }

    var step = stepAt(currentStep, roster);
    if (stepEl && step) {
      stepEl.textContent =
        "Step " +
        (currentStep + 1) +
        "/" +
        total +
        " — " +
        step.phaseLabel +
        " — " +
        step.player +
        " (P" +
        step.slot +
        ")" +
        (currentStep + 1 >= total ? " — COMPLETE" : "");
    }
    if (beginBtn) beginBtn.hidden = true;
    if (nextBtn) nextBtn.hidden = currentStep + 1 >= total;
    if (autoBtn) autoBtn.hidden = currentStep + 1 >= total;
    if (stopBtn) stopBtn.hidden = !autoTimer;
  }

  window.risqueArtemisCycleProbeHostAdvance = function (delta) {
    if (!window.risqueArtemisHost) return;
    stopAuto();
    advanceStep(delta || 1);
  };

  window.risqueArtemisCycleProbeSync = function (gs) {
    if (!gs) return;
    if (
      !gs.artemisCycleProbe &&
      window.risqueArtemisCycleProbeActive &&
      typeof gs.artemisCycleProbeStep === "number" &&
      gs.artemisCycleProbeStep >= 0
    ) {
      gs.artemisCycleProbe = true;
    }
    if (!gs.artemisCycleProbe) return;
    syncLocalProbeFlags(gs);
    teardownRealPhaseUiForProbe();
    window.gameState = gs;
    if (typeof window.risqueArtemisEnsureOmniClientHud === "function") {
      window.risqueArtemisEnsureOmniClientHud(gs);
    }
    renderProbeUi(gs);
  };

  window.risqueArtemisShouldKeepPhaseSlotContent = (function (prev) {
    return function () {
      if (
        window.risqueArtemisCycleProbeActive &&
        (probeRunning || probeIsLive(window.gameState))
      ) {
        var dock = document.getElementById(DOCK_ID);
        if (dock && !dock.hidden && dock.childElementCount > 0) return true;
      }
      if (typeof prev === "function") return prev();
      return false;
    };
  })(window.risqueArtemisShouldKeepPhaseSlotContent);

  if (typeof window.risqueArtemisDiag === "function") {
    window.risqueArtemisDiag("cycle_probe_boot", "Cycle probe shell active on P" + mySlot(), {
      host: !!window.risqueArtemisHost,
      netClient: !!window.risqueArtemisNetClient
    });
  }
  try {
    console.info(
      "[ARTEMIS cycle probe] active on P" +
        mySlot() +
        (window.risqueArtemisHost ? " (host)" : " (client)")
    );
  } catch (eLog) {
    /* ignore */
  }

  if (window.risqueArtemisHost) {
    ensureCycleProbeBanner();
    ensureHostBar();
    renderPreBeginIdle();
    idlePollTimer = setInterval(function () {
      if (!probeRunning && !probeIsLive(window.gameState)) {
        updateHostBar(window.gameState);
        if (allProfilesLoggedIn()) renderPreBeginIdle();
      }
    }, 1500);
  } else {
    ensureCycleProbeBanner();
    renderPreBeginIdle();
    idlePollTimer = setInterval(function () {
      if (!probeRunning && !probeIsLive(window.gameState)) renderPreBeginIdle();
    }, 2000);
  }
})();
