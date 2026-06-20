/**
 * Persistent right-column HUD: full game panel (stats, control voice, combat log, phase slot).
 * Setup phases use .runtime-hud-root--setup (attack row, dev row, slot strip, combat log, and voice report hidden via CSS).
 * #attack-dev-row-strip is shown only during data-risque-phase="attack" (see game.css).
 */
(function () {
  "use strict";

  function buildHudTitleStackHtml() {
    return (
      '<div id="hud-title-stack" class="hud-title-stack">' +
      '<div class="hud-title-stack__brand-row">' +
      '<div class="hud-title-stack__stats-slot" aria-hidden="true"></div>' +
      '<div id="hud-banner-game-title" class="hud-banner-game-title-main hud-banner-phase-title">SETUP</div>' +
      '<div class="hud-title-stack__host-top-buttons">' +
      '<button type="button" id="risque-private-stats-toggle" class="risque-private-stats-toggle risque-host-topbar-btn" role="switch" aria-checked="false" aria-label="Toggle large stats in control panel" title="STATS — enlarge table in panel">STATS</button>' +
      '<button type="button" id="risque-host-cards-played-toggle" class="risque-host-cards-played-toggle risque-host-topbar-btn" role="switch" aria-checked="false" aria-label="Toggle cards played gallery in control panel" title="Cards played — territory cards cashed in this game">CARDS PLAYED</button>' +
      '<button type="button" id="risque-host-tv-cursor-toggle" class="risque-host-tv-cursor-toggle risque-host-topbar-btn" role="switch" aria-checked="false" aria-label="Allow mouse on TV display" title="TV cursor: OFF (locked to laptop). Tap to allow cursor on external TV — works from Moonlight touch.">TV CURS</button>' +
      '<button type="button" id="risque-host-lucky-toggle" class="risque-host-lucky-toggle risque-host-topbar-btn" role="switch" aria-checked="false" aria-label="Toggle lucky dice and battle stats in control panel" title="Lucky — six rate and battle round win rates">LUCKY</button>' +
      '<button type="button" id="risque-host-cards-in-hand-toggle" class="risque-host-cards-in-hand-toggle risque-host-topbar-btn" role="switch" aria-checked="false" aria-label="Show current player cards in hand" title="Cards in hand — current player\'s territory cards">CARDS IN HAND</button>' +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function buildHudPhaseLineBelowStatsHtml() {
    return (
      '<div id="hud-phase-player-row" class="hud-phase-player-row">' +
      '<div id="attack-player-name" class="hud-turn-banner hud-turn-banner--player-phase"></div>' +
      "</div>"
    );
  }

  function buildPanelInnerHtml() {
    return (
      '<div id="risque-public-wayback-head" class="risque-public-wayback-head" hidden aria-hidden="true">' +
      '<div class="risque-public-wayback-brand" aria-label="Wayback Machine">WAYBACK MACHINE</div>' +
      '<div class="risque-public-wayback-round-row" role="status">' +
      '<span class="risque-public-wayback-round-label">ROUND PLAYING</span>' +
      '<span id="risque-public-wayback-round-num" class="risque-public-wayback-round-num">—</span>' +
      '<span id="risque-public-wayback-actor" class="risque-public-wayback-actor" hidden aria-hidden="true"></span>' +
      "</div></div>" +
      '<div id="hud-attack-chrome" class="hud-attack-chrome">' +
        '<div class="attack-dice-columns">' +
          '<div class="attack-dice-col attack-dice-col--attacker">' +
            '<div class="attack-dice-label-row">' +
            '<div class="attack-dice-row">' +
              '<div id="attacker-dice-0" class="attack-die attack-die-atk"><span id="attacker-dice-text-0">-</span></div>' +
              '<div id="attacker-dice-1" class="attack-die attack-die-atk"><span id="attacker-dice-text-1">-</span></div>' +
              '<div id="attacker-dice-2" class="attack-die attack-die-atk"><span id="attacker-dice-text-2">-</span></div>' +
            "</div>" +
            '<span class="attack-dice-column-label attack-dice-column-label--player" id="attacker-panel-name">—</span>' +
            "</div>" +
          "</div>" +
          '<div class="attack-dice-col attack-dice-col--defender">' +
            '<div class="attack-dice-label-row">' +
            '<div class="attack-dice-row">' +
              '<div id="defender-dice-0" class="attack-die attack-die-def"><span id="defender-dice-text-0">-</span></div>' +
              '<div id="defender-dice-1" class="attack-die attack-die-def"><span id="defender-dice-text-1">-</span></div>' +
            "</div>" +
            '<span class="attack-dice-column-label attack-dice-column-label--player" id="defender-panel-name">—</span>' +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div id="attack-toolbar-strip" class="ucp-slot-strip attack-toolbar-strip" aria-label="Attack controls">' +
          '<div class="ucp-slot-strip-main">' +
          '<div class="ucp-slot-strip-buttons">' +
          (typeof window.buildAttackToolbarStripButtonsInnerHtml === "function"
            ? window.buildAttackToolbarStripButtonsInnerHtml({ includeReinforceInStrip: false })
            : "") +
          "</div>" +
          '<div class="attack-step-ctl-wrap" id="attack-step-ctl-wrap" hidden aria-label="Blitz Step and Campaign Step">' +
          '<button type="button" id="attack-step-pause-btn" class="attack-ctl-btn attack-ctl-step-pause" title="Pause or resume">PAUSE</button>' +
          '<button type="button" id="attack-step-cancel-btn" class="attack-ctl-btn attack-ctl-step-cancel" title="Cancel and return to territory selection">CANCEL</button>' +
          "</div>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div id="hud-public-cardplay-strip" class="hud-public-cardplay-strip" hidden aria-label="Committed cards"></div>' +
      '<div id="control-voice" class="ucp-terminal ucp-control-voice" aria-live="polite">' +
        '<div id="control-voice-extras"></div>' +
        '<div class="ucp-voice-body">' +
        '<div id="risque-condition-tally" class="risque-condition-tally risque-condition-tally--in-voice" hidden aria-live="off" aria-label="Conditional stop countdown">' +
        '<div class="risque-condition-tally__num" id="risque-condition-tally-num">0</div>' +
        '<div class="risque-condition-tally__label">until condition is met</div>' +
        "</div>" +
        '<div class="ucp-voice-messages">' +
        '<div id="control-voice-text" class="ucp-voice-text"></div>' +
        '<div id="control-voice-report" class="ucp-voice-report"></div>' +
        "</div>" +
        "</div>" +
      "</div>" +
      '<div id="ucp-slot-strip" class="ucp-slot-strip">' +
        '<div class="ucp-slot-strip-main">' +
        '<div class="ucp-slot-strip-buttons">' +
          '<button type="button" class="ucp-slot-ctl ucp-slot-empty" id="control-btn-0" disabled title="" aria-label="Action slot 1"></button>' +
          '<button type="button" class="ucp-slot-ctl ucp-slot-empty" id="control-btn-1" disabled title="" aria-label="Action slot 2"></button>' +
          '<button type="button" class="ucp-slot-ctl ucp-slot-empty" id="control-btn-2" disabled title="" aria-label="Action slot 3"></button>' +
          '<button type="button" class="ucp-slot-ctl ucp-slot-empty" id="control-btn-3" disabled title="" aria-label="Action slot 4"></button>' +
        "</div>" +
        '<div class="ucp-slot-strip-num-wrap">' +
          '<label id="ucp-voice-number-label" class="ucp-slot-strip-label" for="troops-input">Amount</label>' +
          '<input type="number" id="troops-input" class="ucp-slot-strip-number" disabled value="" title="Amount" />' +
        "</div>" +
        "</div>" +
      "</div>" +
      '<div id="attack-dev-row-strip" class="ucp-slot-strip attack-dev-row-strip" aria-label="Developer controls">' +
        '<div class="ucp-slot-strip-main">' +
        (typeof window.buildAttackDevRowInnerHtml === "function"
          ? window.buildAttackDevRowInnerHtml()
          : "") +
        "</div>" +
      "</div>" +
      '<div id="log-text" class="ucp-terminal ucp-combat-log" aria-live="polite"></div>' +
      '<div class="attack-reinforce-footer" role="group" aria-label="Reinforcement phase">' +
      '<button id="reinforce" class="attack-ctl-btn attack-ctl-reinforce" type="button" title="Continue to reinforcement phase">CONTINUE TO REINFORCEMENT</button>' +
      '<div id="risque-host-deck-earned-visual" class="risque-host-deck-earned-visual" hidden aria-hidden="true">' +
      '<div id="risque-host-deck-earned-label" class="risque-host-deck-earned-label"></div>' +
      '<div class="risque-host-deck-earned-cardbox">' +
      '<img class="risque-host-deck-earned-back" src="assets/images/Cards/CARDBACK.webp" alt="" width="152" height="236" />' +
      '<span class="risque-host-deck-earned-forbid" aria-hidden="true"></span>' +
      '<span class="risque-host-deck-earned-check" aria-hidden="true"></span>' +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function buildFullHudRootHtml(extraRootClass) {
    var rc = "runtime-hud-root" + (extraRootClass ? " " + extraRootClass : "");
    return (
      '<div id="runtime-hud-root" class="' +
      rc +
      '">' +
      buildHudTitleStackHtml() +
      '<div id="hud-stats-panel" class="hud-stats-panel" aria-label="Game statistics"></div>' +
      '<div id="risque-host-cards-played-panel" class="risque-host-cards-played-panel" hidden aria-hidden="true"></div>' +
      '<div id="risque-host-lucky-panel" class="risque-host-lucky-panel" hidden aria-hidden="true"></div>' +
      '<div id="risque-host-cards-in-hand-panel" class="risque-host-cards-in-hand-panel" hidden aria-hidden="true"></div>' +
      buildHudPhaseLineBelowStatsHtml() +
      '<div class="attack-control-panel unified-attack-panel" id="hud-main-panel">' +
      '<div id="risque-main-panel-body" class="risque-main-panel-body">' +
      buildPanelInnerHtml() +
      "</div></div>" +
      '<div id="risque-phase-content" class="risque-phase-content"></div>' +
      '<div id="risque-grace-host-overlay" class="risque-grace-host-overlay" hidden aria-hidden="true">' +
      '<div class="risque-grace-host-overlay-inner">' +
      '<div id="risque-grace-host-screen-kidding" class="risque-grace-host-screen" hidden>' +
      '<p id="risque-grace-host-kidding-text" class="risque-grace-host-kidding-text"></p>' +
      '<button type="button" class="risque-grace-host-btn" id="risque-grace-host-kidding-close">Close</button>' +
      "</div>" +
      '<div id="risque-grace-host-screen-pick" class="risque-grace-host-screen" hidden>' +
      '<p class="risque-grace-host-title">Grace rollback</p>' +
      '<p class="risque-grace-host-desc">Rewind to a saved bookmark from this session. Undo uses the last write before your latest change (same tab).</p>' +
      '<p id="risque-grace-host-pick-warn" class="risque-grace-host-pick-warn" hidden></p>' +
      '<button type="button" class="risque-grace-host-btn risque-grace-host-btn--primary" id="risque-grace-host-opt-undo" disabled>1) Undo last save (one step back)</button>' +
      '<button type="button" class="risque-grace-host-btn risque-grace-host-btn--primary" id="risque-grace-host-opt-phase-start" disabled>2) Restart this phase (erase what you did this phase)</button>' +
      '<button type="button" class="risque-grace-host-btn risque-grace-host-btn--primary" id="risque-grace-host-opt-prev-phase" disabled>3) Undo last phase advance (KEEP this-phase results)</button>' +
      '<button type="button" class="risque-grace-host-btn risque-grace-host-btn--primary" id="risque-grace-host-opt-cycle" disabled>4) Restart this turn at cardplay</button>' +
      '<button type="button" class="risque-grace-host-btn" id="risque-grace-host-pick-cancel">Cancel</button>' +
      "</div>" +
      '<div id="risque-grace-host-screen-confirm" class="risque-grace-host-screen" hidden>' +
      '<p class="risque-grace-host-title">Are you sure?</p>' +
      '<p id="risque-grace-host-confirm-detail" class="risque-grace-host-desc"></p>' +
      '<button type="button" class="risque-grace-host-btn risque-grace-host-btn--danger" id="risque-grace-host-confirm-yes">Confirm rollback</button>' +
      '<button type="button" class="risque-grace-host-btn" id="risque-grace-host-confirm-no">Back</button>' +
      "</div>" +
      "</div></div>" +
      "</div>"
    );
  }

  /**
   * @param {string|null|undefined} primary
   * @param {string|null|undefined} report - second line under primary (scrolls with voice box)
   * @param {{ reportClass?: string, skipMirror?: boolean }=} opts
   */
  function setControlVoiceText(primary, report, opts) {
    opts = opts || {};
    var cvEl = document.getElementById("control-voice");
    /* Campaign uses innerHTML on #control-voice-text; textContent would strip Begin/Commit UI. Also avoid the
     * instant_committed + no shell class case where a forced voice write wiped buttons but left campaignMode set. */
    if (
      !opts.territorySelection &&
      typeof window.risqueIsAttackCampaignActive === "function" &&
      window.risqueIsAttackCampaignActive()
    ) {
      return;
    }
    var vt = document.getElementById("control-voice-text");
    var vr = document.getElementById("control-voice-report");
    var priText = primary != null ? String(primary) : "";
    var repText = report !== undefined && report != null ? String(report) : "";
    if (
      !opts.force &&
      vt &&
      String(vt.textContent || "") === priText &&
      (!vr || String(vr.textContent || "") === repText)
    ) {
      return;
    }
    if (vt) vt.textContent = priText;
    if (vr && report !== undefined) {
      var rt = repText;
      vr.textContent = rt;
      vr.style.display = rt ? "block" : "none";
      vr.className =
        "ucp-voice-report" + (rt && opts.reportClass ? " " + opts.reportClass : "");
    }
    /* Campaign ended but class lingered — strips stale shell so force voice updates and attack mount can't deadlock. */
    if (
      cvEl &&
      vt &&
      typeof window.risqueIsAttackCampaignActive === "function" &&
      !window.risqueIsAttackCampaignActive()
    ) {
      cvEl.classList.remove("ucp-control-voice--campaign-instant");
      vt.classList.remove("campaign-instant-voice");
    }
    try {
      if (window.gameState) {
        var rp = primary != null ? String(primary) : "";
        var rr = report !== undefined && report != null ? String(report) : "";
        window.gameState.risqueControlVoice = {
          primary: rp,
          report: rr,
          reportClass: opts && opts.reportClass ? String(opts.reportClass) : ""
        };
      }
    } catch (ePersist) {
      /* ignore */
    }
    if (typeof window.risqueMirrorPushGameState === "function" && !opts.skipMirror) {
      window.risqueMirrorPushGameState();
    }
    if (
      opts.artemisDeployOwner ||
      (window.risqueArtemisMode &&
        window.gameState &&
        String(window.gameState.phase || "") === "deploy" &&
        typeof window.risqueArtemisEnsureDeployOwnerVoiceChrome === "function" &&
        ((typeof window.risqueArtemisLocalOwnsSetupDeploy === "function" &&
          window.risqueArtemisLocalOwnsSetupDeploy(window.gameState)) ||
          (typeof window.risqueArtemisIsMyTurn === "function" &&
            window.risqueArtemisIsMyTurn(window.gameState))))
    ) {
      window.risqueArtemisEnsureDeployOwnerVoiceChrome(window.gameState);
    }
  }

  /**
   * Full game HUD shell (stats, control panel, voice, log). Replaces login or setup shells only.
   */
  function ensure(uiOverlay) {
    if (!uiOverlay) return;
    var existingRoot = document.getElementById("runtime-hud-root");
    if (
      existingRoot &&
      existingRoot.classList.contains("runtime-hud-root--setup") &&
      window.risqueArtemisMode &&
      window.gameState
    ) {
      var artemisPh = String(window.gameState.phase || "");
      if (
        artemisPh === "cardplay" ||
        artemisPh === "con-cardplay" ||
        artemisPh === "income" ||
        artemisPh === "con-income"
      ) {
        return;
      }
    }
    if (
      existingRoot &&
      !existingRoot.classList.contains("runtime-hud-root--login") &&
      !existingRoot.classList.contains("runtime-hud-root--setup")
    ) {
      return;
    }
    uiOverlay.classList.add("visible");
    uiOverlay.classList.remove("fade-out");
    uiOverlay.innerHTML = buildFullHudRootHtml("");
  }

  /**
   * Setup flow: same panel as in-game (stats + control voice + combat log) but attack chrome / slot strip hidden via CSS.
   * Phase-specific UI mounts in #risque-phase-content below the control voice.
   */
  /** ARTEMIS setup-deploy spectator: HUD rebuild must not wipe waiting narration. */
  function artemisPreserveDeploySpectatorVoice() {
    return (
      window.risqueArtemisMode &&
      window.gameState &&
      String(window.gameState.phase || "") === "deploy" &&
      typeof window.risqueArtemisLocalOwnsSetupDeploy === "function" &&
      !window.risqueArtemisLocalOwnsSetupDeploy(window.gameState)
    );
  }

  function captureControlVoicePrimary() {
    var vt = document.getElementById("control-voice-text");
    if (!vt) return "";
    var t = vt.textContent != null ? String(vt.textContent).trim() : "";
    return t;
  }

  function restoreDeploySpectatorVoiceAfterHudRebuild(priorVoice) {
    if (priorVoice && artemisPreserveDeploySpectatorVoice()) {
      setControlVoiceText(priorVoice, "", { skipMirror: true });
      return;
    }
    if (typeof window.risqueArtemisApplyDeployVoiceFromState === "function" && window.gameState) {
      try {
        window.risqueArtemisApplyDeployVoiceFromState(window.gameState);
      } catch (eDepVoice) {
        /* ignore */
      }
    }
  }

  function clearControlVoiceForHudRebuild() {
    if (artemisPreserveDeploySpectatorVoice()) {
      return;
    }
    setControlVoiceText("", "");
  }

  function ensureSetupUnifiedHud(uiOverlay, bannerText, opts) {
    opts = opts || {};
    if (!uiOverlay) return;
    uiOverlay.classList.add("visible");
    uiOverlay.classList.remove("fade-out");
    uiOverlay.classList.remove("risque-deploy1-ui");

    if (opts.force) {
      var voiceBeforeForce = captureControlVoicePrimary();
      uiOverlay.innerHTML = buildFullHudRootHtml("runtime-hud-root--setup");
      applyStandaloneBannerText(bannerText);
      setAttackChromeInteractive(false);
      clearControlVoiceForHudRebuild();
      var rhForce = document.getElementById("runtime-hud-root");
      if (rhForce && window.risqueArtemisMode) {
        rhForce.classList.add("runtime-hud-root--artemis-compact");
      }
      restoreDeploySpectatorVoiceAfterHudRebuild(voiceBeforeForce);
      return;
    }

    var existing = document.getElementById("runtime-hud-root");
    var isLoginMinimal = existing && existing.classList.contains("runtime-hud-root--login");
    var isSetupFull = existing && existing.classList.contains("runtime-hud-root--setup");

    if (existing && !isLoginMinimal && !isSetupFull) {
      if (window.risqueArtemisMode) {
        var phArtemisRebuild = String((window.gameState && window.gameState.phase) || "");
        if (phArtemisRebuild === "income" || phArtemisRebuild === "con-income") {
          existing.classList.add("runtime-hud-root--setup");
          existing.classList.remove("runtime-hud-root--cardplay-panel-only");
          existing.classList.remove("runtime-hud-root--host-cardplay-recap");
          existing.classList.remove("runtime-hud-root--public-cardplay-recap");
          existing.classList.remove("runtime-hud-root--artemis-cardplay");
          applyStandaloneBannerText(bannerText);
          setAttackChromeInteractive(false);
          return;
        }
        var voiceBeforeArtemis = captureControlVoicePrimary();
        uiOverlay.innerHTML = buildFullHudRootHtml("runtime-hud-root--setup");
        applyStandaloneBannerText(bannerText);
        setAttackChromeInteractive(false);
        clearControlVoiceForHudRebuild();
        var rhArtemis = document.getElementById("runtime-hud-root");
        if (rhArtemis) rhArtemis.classList.add("runtime-hud-root--artemis-compact");
        restoreDeploySpectatorVoiceAfterHudRebuild(voiceBeforeArtemis);
        return;
      }
      applyStandaloneBannerText(bannerText);
      return;
    }

    if (isSetupFull) {
      applyStandaloneBannerText(bannerText);
      if (window.risqueArtemisMode) {
        existing.classList.add("runtime-hud-root--artemis-compact");
        var phIncomeKeep = String((window.gameState && window.gameState.phase) || "");
        var incomeUiMounted =
          phIncomeKeep === "income" ||
          phIncomeKeep === "con-income"
            ? typeof window.risqueArtemisIncomeControlsPresent === "function" &&
              window.risqueArtemisIncomeControlsPresent()
            : false;
        if (!document.getElementById("risque-private-stats-toggle") && !incomeUiMounted) {
          var voiceBeforeRepair = captureControlVoicePrimary();
          uiOverlay.innerHTML = buildFullHudRootHtml("runtime-hud-root--setup");
          applyStandaloneBannerText(bannerText);
          setAttackChromeInteractive(false);
          clearControlVoiceForHudRebuild();
          var rhRepair = document.getElementById("runtime-hud-root");
          if (rhRepair) rhRepair.classList.add("runtime-hud-root--artemis-compact");
          restoreDeploySpectatorVoiceAfterHudRebuild(voiceBeforeRepair);
          return;
        }
      }
      var slot = document.getElementById("risque-phase-content");
      var artemisKeepDeploy =
        window.risqueArtemisMode &&
        typeof window.risqueArtemisIsMyTurn === "function" &&
        window.risqueArtemisIsMyTurn(window.gameState) &&
        (window.risqueDeploy1Active ||
          document.getElementById("deploy1-confirm") ||
          document.getElementById("risque-artemis-portable-deploy") ||
          (function () {
            var d = document.getElementById("risque-artemis-deploy-dock");
            return d && !d.hidden && d.childElementCount > 0;
          })());
      var artemisKeepCardplayDock =
        window.risqueArtemisMode &&
        (function () {
          var d = document.getElementById("risque-artemis-cardplay-dock");
          return d && !d.hidden && d.querySelector("#cardplay-skip-income-btn");
        })();
      var artemisKeepCycleDock =
        window.risqueArtemisCycleProbeActive &&
        (function () {
          var d = document.getElementById("risque-artemis-cycle-probe-dock");
          return (
            d &&
            !d.hidden &&
            (d.querySelector("#cycle-probe-active-panel") || d.querySelector("#cycle-probe-waiting-panel"))
          );
        })();
      var artemisKeepIncome =
        window.risqueArtemisMode &&
        (function () {
          var phKeep = String((window.gameState && window.gameState.phase) || "");
          if (phKeep !== "income" && phKeep !== "con-income") return false;
          if (
            typeof window.risqueArtemisIncomeControlsPresent === "function" &&
            window.risqueArtemisIncomeControlsPresent()
          ) {
            return true;
          }
          return !!document.querySelector("#risque-phase-content .income-hud-phase-stack");
        })();
      var artemisKeepPhaseSlot =
        artemisKeepDeploy ||
        artemisKeepCardplayDock ||
        artemisKeepCycleDock ||
        artemisKeepIncome ||
        (typeof window.risqueArtemisShouldKeepPhaseSlotContent === "function" &&
          window.risqueArtemisShouldKeepPhaseSlotContent());
      if (slot && !artemisKeepPhaseSlot) {
        slot.innerHTML = "";
      }
      setAttackChromeInteractive(false);
      return;
    }

    uiOverlay.innerHTML = buildFullHudRootHtml("runtime-hud-root--setup");
    applyStandaloneBannerText(bannerText);
    if (window.risqueArtemisMode) {
      var rhNew = document.getElementById("runtime-hud-root");
      if (rhNew) rhNew.classList.add("runtime-hud-root--artemis-compact");
    }
    setAttackChromeInteractive(false);
    clearControlVoiceForHudRebuild();
  }

  function clearPhaseSlot() {
    var slot = document.getElementById("risque-phase-content");
    if (slot) slot.innerHTML = "";
    var rh = document.getElementById("runtime-hud-root");
    if (rh) {
      rh.classList.remove("runtime-hud-root--cardplay-tight");
      rh.classList.remove("runtime-hud-root--cardplay-panel-only");
    }
  }

  /**
   * Stats + banner + empty phase slot (no attack chrome). Used for login and pre-game setup.
   */
  function ensureMinimalColumnHud(uiOverlay, bannerText) {
    if (!uiOverlay) return;
    uiOverlay.classList.add("visible");
    uiOverlay.classList.remove("fade-out");
    var existing = document.getElementById("runtime-hud-root");
    if (existing) {
      applyStandaloneBannerText(bannerText);
      return;
    }
    uiOverlay.innerHTML =
      '<div id="runtime-hud-root" class="runtime-hud-root runtime-hud-root--login">' +
      buildHudTitleStackHtml() +
      '<div id="hud-stats-panel" class="hud-stats-panel" aria-label="Game statistics"></div>' +
      '<div id="risque-host-cards-played-panel" class="risque-host-cards-played-panel" hidden aria-hidden="true"></div>' +
      '<div id="risque-host-lucky-panel" class="risque-host-lucky-panel" hidden aria-hidden="true"></div>' +
      '<div id="risque-host-cards-in-hand-panel" class="risque-host-cards-in-hand-panel" hidden aria-hidden="true"></div>' +
      buildHudPhaseLineBelowStatsHtml() +
      '<div id="risque-phase-content" class="risque-phase-content"></div>' +
      "</div>";
    applyStandaloneBannerText(bannerText);
  }

  function ensureLogin(uiOverlay) {
    if (!uiOverlay) return;
    if (document.getElementById("runtime-hud-root")) return;
    ensureMinimalColumnHud(uiOverlay, "RISQUE · Sign in");
  }

  /** Setup phases: full control panel + voice (attack row hidden); content goes in #risque-phase-content. */
  function ensureSetupHud(uiOverlay, bannerText) {
    ensureSetupUnifiedHud(uiOverlay, bannerText != null && String(bannerText) !== "" ? bannerText : "SETUP");
  }

  function attackStepStripShouldStayClickable() {
    var gs = window.gameState;
    return (
      (typeof window.risqueAttackStepControlsShouldStayActive === "function" &&
        window.risqueAttackStepControlsShouldStayActive()) ||
      !!(gs && gs.risqueHostAttackStepStripActive)
    );
  }

  /** Re-enable PAUSE/CANCEL after any code path re-disables chrome while Blitz/Campaign Step is active. */
  function repairAttackStepChromeButtons() {
    var chrome = document.getElementById("hud-attack-chrome");
    if (!chrome || !chrome.classList.contains("hud-chrome-disabled")) return;
    if (!attackStepStripShouldStayClickable()) return;
    var sp = document.getElementById("attack-step-pause-btn");
    var sc = document.getElementById("attack-step-cancel-btn");
    if (sp) {
      sp.disabled = false;
      sp.removeAttribute("disabled");
    }
    if (sc) {
      sc.disabled = false;
      sc.removeAttribute("disabled");
    }
  }

  function setAttackChromeInteractive(on) {
    if (
      on &&
      window.risqueArtemisMode &&
      typeof window.risqueArtemisShouldAttackChromeBeInteractive === "function" &&
      !window.risqueArtemisShouldAttackChromeBeInteractive(window.gameState)
    ) {
      on = false;
    }
    var chrome = document.getElementById("hud-attack-chrome");
    if (!chrome) return;
    chrome.classList.toggle("hud-chrome-disabled", !on);
    var shouldKeepStep = !on && attackStepStripShouldStayClickable();
    var buttons = chrome.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i += 1) {
      var btn = buttons[i];
      var bid = btn.id;
      if (shouldKeepStep && (bid === "attack-step-pause-btn" || bid === "attack-step-cancel-btn")) {
        btn.disabled = false;
        btn.removeAttribute("disabled");
      } else {
        btn.disabled = !on;
      }
    }
    var cond = document.getElementById("cond-threshold");
    if (cond) cond.disabled = !on;
    if (on && typeof window.risqueSyncAttackPhaseActionLocks === "function") {
      window.risqueSyncAttackPhaseActionLocks();
    }
    if (!on) {
      requestAnimationFrame(function () {
        repairAttackStepChromeButtons();
      });
    }
  }

  /**
   * Keep #log-text bottom inside the 1920×1080 board overlay with 20px logical px buffer; may shrink + scroll.
   */
  function clampCombatLogToCanvasBottom() {
    var logText = document.getElementById("log-text");
    var overlay = document.querySelector(".ui-overlay");
    var root = document.getElementById("runtime-hud-root");
    if (!logText || !overlay) return;
    if (
      root &&
      (root.classList.contains("runtime-hud-root--login") ||
        root.classList.contains("runtime-hud-root--setup"))
    ) {
      logText.style.maxHeight = "";
      return;
    }
    var ob = overlay.getBoundingClientRect();
    if (ob.height < 8) return;
    var lb = logText.getBoundingClientRect();
    var pad = (20 * ob.height) / 1080;
    var maxPx = Math.max(40, ob.bottom - lb.top - pad);
    logText.style.maxHeight = Math.floor(maxPx) + "px";
  }

  function isDeployPhaseHudOverflow() {
    var ph = document.body && document.body.getAttribute("data-risque-phase");
    return ph === "deploy" || ph === "deploy1" || ph === "deploy2" || ph === "con-deploy";
  }

  function syncPosition() {
    var root = document.getElementById("runtime-hud-root");
    if (!root) return;
    var svg =
      typeof window.risqueGetCanvasSvgOverlay === "function"
        ? window.risqueGetCanvasSvgOverlay()
        : document.querySelector("#canvas .svg-overlay");
    var topPx = 220;
    if (svg) {
      var sg = svg.querySelector("#stats-group");
      if (sg) {
        try {
          var b = sg.getBBox();
          if (b && typeof b.y === "number") {
            // Align column with top of stats; stats table is mirrored in HUD (SVG copy hidden).
            topPx = Math.max(8, Math.round(b.y));
          }
        } catch (e1) {
          /* ignore */
        }
      }
    }
    /* Nudge whole column down so title + control stack sit comfortably in the reserved strip */
    topPx += 23;
    root.style.top = topPx + "px";
    if (root.classList.contains("runtime-hud-root--login")) {
      /* Same as setup: let the column grow with content — no column scrollbar (login + preset fit in normal viewports). */
      root.style.maxHeight = "none";
      root.style.overflowY = "visible";
      root.style.overflowX = "hidden";
    } else if (root.classList.contains("runtime-hud-root--setup")) {
      /* No column scrollbar — selection UI fits under voice without inner scroll */
      root.style.maxHeight = "none";
      if (isDeployPhaseHudOverflow()) {
        /* Shorthand: overflow-x hidden + overflow-y visible computes visible→auto (scrollbar). */
        root.style.overflow = "visible";
        root.style.overflowY = "";
        root.style.overflowX = "";
      } else {
        root.style.overflowY = "visible";
        root.style.overflowX = "hidden";
        root.style.overflow = "";
      }
    } else if (root.classList.contains("runtime-hud-root--cardplay-panel-only")) {
      root.style.maxHeight = "none";
      /* Shorthand: overflow-x hidden + overflow-y visible computes visible→auto (scrollbar). */
      root.style.overflow = "visible";
    } else {
      root.style.maxHeight = "";
      root.style.overflow = "";
      root.style.overflowY = "";
      root.style.overflowX = "";
      requestAnimationFrame(function () {
        requestAnimationFrame(clampCombatLogToCanvasBottom);
      });
    }
  }

  function escapeHtmlBanner(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function artemisActivePlayerNameUpper(gs) {
    if (!gs) return "";
    var cpU = gs.currentPlayer ? String(gs.currentPlayer).trim().toUpperCase() : "";
    var ctrl = Number(gs.artemisControlSlot) || 0;
    if (ctrl >= 1 && ctrl <= 3 && Array.isArray(gs.players)) {
      var slotName = "";
      var roster = gs.artemisRoster;
      if (roster && Array.isArray(roster)) {
        var hit = roster.find(function (r) {
          return Number(r.slot) === ctrl;
        });
        if (hit && hit.name) {
          slotName = String(hit.name).trim().toUpperCase();
        }
      }
      if (!slotName) {
        var byOrder = gs.players.find(function (x) {
          return x && Number(x.playerOrder) === ctrl;
        });
        if (byOrder && byOrder.name) {
          slotName = String(byOrder.name).trim().toUpperCase();
        }
      }
      if (!slotName && gs.players[ctrl - 1] && gs.players[ctrl - 1].name) {
        slotName = String(gs.players[ctrl - 1].name).trim().toUpperCase();
      }
      if (slotName) {
        if (cpU && slotName !== cpU) {
          return cpU;
        }
        return slotName;
      }
    }
    if (cpU) {
      return cpU;
    }
    return "";
  }

  function artemisPhaseHudTitle(phase, gs, opts) {
    opts = opts || {};
    var activeOnly = !!opts.activePlayerOnly;
    var nameU = artemisActivePlayerNameUpper(gs);
    var nameSuffix = nameU ? "-" + nameU : "";
    var p = String(phase || "");
    if (p === "cardplay" || p === "con-cardplay") {
      if (window.risqueArtemisMode && gs) {
        var cpName = artemisActivePlayerNameUpper(gs);
        if (cpName) return "CARD PLAY-" + cpName;
      }
      return "CARD PLAY";
    }
    if (p === "income" || p === "con-income") {
      return activeOnly ? "INCOME" : "INCOME" + nameSuffix;
    }
    if (p === "deploy" || p === "deploy1" || p === "deploy2" || p === "con-deploy") {
      if (window.risqueArtemisMode && gs && isArtemisSetupDeployPhase(gs)) {
        var depName = artemisActivePlayerNameUpper(gs);
        return depName ? "FIRST DEPLOYMENT-" + depName : "FIRST DEPLOYMENT";
      }
      return activeOnly ? "DEPLOYMENT" : "DEPLOYMENT" + nameSuffix;
    }
    if (p === "attack") {
      return activeOnly ? "ATTACK" : "ATTACK" + nameSuffix;
    }
    if (p === "reinforce") {
      return activeOnly ? "REINFORCEMENT" : "REINFORCEMENT" + nameSuffix;
    }
    if (p === "receivecard" || p === "getcard") return "RECEIVE CARD";
    if (p === "playerSelect") {
      var sk = gs && String(gs.selectionPhase || gs.risquePublicUiSelectKind || "");
      if (sk === "firstCard") return "FIRST CARD";
      if (sk === "deployOrder") return "DEPLOY ORDER";
      if (sk === "cardPlay") return "CARD PLAY ORDER";
      return "PLAYER SELECT";
    }
    if (p === "deal") return "DEAL";
    if (p === "welcome") return "WELCOME";
    if (p === "login") return "SIGN IN";
    if (p === "conquer") return "CONQUER";
    if (p === "con-cardtransfer") return "CARD TRANSFER";
    if (!p) return "SETUP";
    return phaseToBannerSuffix(p).toUpperCase();
  }

  /** Setup / login: optional "TITLE · subtitle" splits across phase title + player line. */
  function applyStandaloneBannerText(bannerText) {
    if (bannerText == null || String(bannerText) === "") return;
    var b = document.getElementById("attack-player-name");
    var t = document.getElementById("hud-banner-game-title");
    var full = String(bannerText);
    var dot = full.indexOf("·");
    if (window.risqueArtemisMode && t) {
      if (dot !== -1) {
        t.textContent = full.slice(0, dot).trim();
        if (b) b.textContent = full.slice(dot + 1).trim();
      } else {
        t.textContent = full;
        if (b) b.textContent = "";
      }
      t.classList.add("hud-banner-phase-title");
      return;
    }
    if (t && b && dot !== -1) {
      t.textContent = full.slice(0, dot).trim();
      b.textContent = full.slice(dot + 1).trim();
    } else if (b) {
      if (t) t.textContent = "RISQUE";
      b.textContent = full;
    }
  }

  /** Dark / saturated blues need a light outline on black TV backgrounds. */
  function bannerPhaseLineNeedsLightOutline(hex) {
    var h = String(hex || "").trim();
    if (h.charAt(0) === "#") h = h.slice(1);
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return false;
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    /* Red-dominant player colors read clearly on black — no white halo (same idea as deploy banner). */
    if (r >= 120 && r > g + 30 && r > b + 30) return false;
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum >= 0.62) return false;
    var blueish = b > 100 && b > r + 25 && b > g + 15;
    /* Saturated blues: rely on banner CSS text-shadow — white stroke reads as a harsh halo (e.g. “Guido”). */
    if (blueish && lum < 0.58) return false;
    if (lum < 0.42) return true;
    return false;
  }

  function isArtemisSetupDeployPhase(gs) {
    if (!window.risqueArtemisMode || !gs || String(gs.phase || "") !== "deploy") return false;
    if (String(gs.risqueMirrorDeployRoute || "") === "setup") return true;
    var banks = 0;
    (gs.players || []).forEach(function (p) {
      if ((Number(p.bankValue) || 0) > 0) banks += 1;
    });
    return banks > 1;
  }

  function phaseToBannerSuffix(phase) {
    var p = String(phase || "");
    if (p === "cardplay" || p === "con-cardplay") return "CardPlay";
    if (p === "income" || p === "con-income") return "Income";
    if (p === "deploy1" || p === "deploy2" || p === "deploy" || p === "con-deploy") return "Deployment";
    if (p === "attack") return "Attack";
    if (p === "reinforce") return "Reinforcement";
    if (p === "receivecard" || p === "getcard") return "ReceiveCard";
    if (p === "conquer") return "Conquer";
    if (p === "con-cardtransfer") return "CardTransfer";
    if (p === "privacyGate" || p === "privacy-gate") return "Privacy";
    if (!p) return "Phase";
    return p.charAt(0).toUpperCase() + p.slice(1).replace(/_([a-z])/g, function (_, c) {
      return c.toUpperCase();
    });
  }

  function updateTurnBannerFromState(gs) {
    var el = document.getElementById("attack-player-name");
    if (!el || !gs || !window.gameUtils) {
      var rootEarly = document.getElementById("runtime-hud-root");
      if (rootEarly) rootEarly.classList.remove("runtime-hud-root--public-cardplay-processing-title");
      var titleEarly = document.getElementById("hud-banner-game-title");
      if (titleEarly) titleEarly.textContent = "RISQUE";
      return;
    }
    var titleEl = document.getElementById("hud-banner-game-title");
    var rootEl = document.getElementById("runtime-hud-root");
    var bookPh = "idle";
    var recapSteps = false;
    if (window.risqueDisplayIsPublic) {
      bookPh =
        typeof window.risquePublicBookSequencePhase === "function"
          ? window.risquePublicBookSequencePhase()
          : "idle";
      recapSteps = !!(
        gs.risquePublicBookProcessing &&
        Array.isArray(gs.risquePublicBookProcessing.steps) &&
        gs.risquePublicBookProcessing.steps.length > 0
      );
    }
    var pubCardProc = !!(window.risqueDisplayIsPublic && recapSteps && (bookPh === "summary" || bookPh === "step"));
    if (rootEl) {
      rootEl.classList.toggle("runtime-hud-root--public-cardplay-processing-title", pubCardProc);
    }
    if (titleEl) {
      if (pubCardProc) {
        var procPlayer = gs.players
          ? gs.players.find(function (x) {
              return x && x.name === gs.currentPlayer;
            })
          : null;
        var procNameU = procPlayer && procPlayer.name ? String(procPlayer.name).toUpperCase() : "PLAYER";
        var procColor = procPlayer ? window.gameUtils.colorMap[procPlayer.color] || "#ffffff" : "#ffffff";
        titleEl.innerHTML =
          '<span style="color:' +
          escapeHtmlBanner(procColor) +
          '">' +
          escapeHtmlBanner(procNameU) +
          '</span>-CARD PROCESSING';
      } else {
        titleEl.textContent = "RISQUE";
      }
    }
    var phase = gs.phase || "";
    /* Public TV: mirror phase may be "income" while the committed-cardplay recap still runs — banner stays CardPlay until the book finishes. */
    if (window.risqueDisplayIsPublic && recapSteps && (bookPh === "summary" || bookPh === "step")) {
      phase = "cardplay";
    }
    if (phase === "login") {
      el.classList.remove("hud-turn-banner--cardplay");
      el.classList.add("hud-turn-banner--player-phase");
      el.style.color = "";
      if (titleEl && window.risqueArtemisMode) {
        titleEl.textContent = "SIGN IN";
        titleEl.classList.add("hud-banner-phase-title");
      }
      el.innerHTML =
        '<span class="hud-banner-player-phase-line" style="color:#00ff00">' +
        escapeHtmlBanner(window.risqueArtemisMode && titleEl ? "" : "SIGN IN") +
        "</span>";
      if (window.risqueArtemisMode && titleEl) {
        el.textContent = "";
        el.innerHTML = "";
      }
      return;
    }
    if (phase === "postgame") {
      el.classList.remove("hud-turn-banner--cardplay");
      el.classList.add("hud-turn-banner--player-phase");
      el.style.color = "";
      var winPost = gs.winner ? String(gs.winner).toUpperCase() : "GAME OVER";
      el.innerHTML =
        '<span class="hud-banner-player-phase-line" style="color:#fbbf24">' +
        escapeHtmlBanner(winPost + " — POSTGAME") +
        "</span>";
      return;
    }
    /* Match refreshSetupStageChrome banners — not CURRENTPLAYER-DEAL on TV or host during setup draws */
    if (phase === "deal") {
      el.classList.remove("hud-turn-banner--cardplay");
      el.classList.add("hud-turn-banner--player-phase");
      el.style.color = "";
      if (titleEl && window.risqueArtemisMode) {
        titleEl.textContent = "DEAL";
        titleEl.classList.add("hud-banner-phase-title");
        el.textContent = "";
        el.innerHTML = "";
        return;
      }
      el.innerHTML =
        '<span class="hud-banner-player-phase-line" style="color:#00ff00">' +
        escapeHtmlBanner("DEAL") +
        "</span>";
      return;
    }
    if (phase === "welcome") {
      el.classList.remove("hud-turn-banner--cardplay");
      el.classList.add("hud-turn-banner--player-phase");
      el.style.color = "";
      if (titleEl && window.risqueArtemisMode) {
        titleEl.textContent = "WELCOME";
        titleEl.classList.add("hud-banner-phase-title");
        el.textContent = "";
        el.innerHTML = "";
        return;
      }
      el.innerHTML =
        '<span class="hud-banner-player-phase-line" style="color:#00ff00">' +
        escapeHtmlBanner("WELCOME") +
        "</span>";
      return;
    }
    if (phase === "playerSelect") {
      var sk = String(gs.selectionPhase || gs.risquePublicUiSelectKind || "");
      var fk =
        gs.risquePublicPlayerSelectFlash && gs.risquePublicPlayerSelectFlash.selectKind
          ? String(gs.risquePublicPlayerSelectFlash.selectKind)
          : "";
      if (!sk && fk) sk = fk;
      var sub = "SELECT";
      if (sk === "firstCard") sub = "FIRST CARD";
      else if (sk === "deployOrder") sub = "DEPLOY ORDER";
      else if (sk === "cardPlay") sub = "SELECTING PLAYER ONE";
      el.classList.remove("hud-turn-banner--cardplay");
      el.classList.add("hud-turn-banner--player-phase");
      el.style.color = "";
      if (titleEl && window.risqueArtemisMode) {
        titleEl.textContent = sub;
        titleEl.classList.add("hud-banner-phase-title");
        titleEl.style.color = "#00ff00";
        el.textContent = "";
        el.innerHTML = "";
        return;
      }
      el.innerHTML =
        '<span class="hud-banner-player-phase-line" style="color:#00ff00">' +
        escapeHtmlBanner(sub) +
        "</span>";
      return;
    }
    var p = null;
    if (
      window.risqueArtemisMode &&
      phase === "deploy" &&
      gs.players
    ) {
      var activeName = artemisActivePlayerNameUpper(gs);
      if (activeName) {
        p = gs.players.find(function (x) {
          return x && String(x.name || "").trim().toUpperCase() === activeName;
        });
      }
      if (
        !p &&
        Number(gs.artemisControlSlot) >= 1 &&
        Number(gs.artemisControlSlot) <= 3
      ) {
        var ctrlSlot = Number(gs.artemisControlSlot);
        var roster = gs.artemisRoster;
        if (roster && Array.isArray(roster)) {
          var rosterHit = roster.find(function (r) {
            return Number(r.slot) === ctrlSlot;
          });
          if (rosterHit && rosterHit.name) {
            var rosterName = String(rosterHit.name).trim().toUpperCase();
            p = gs.players.find(function (x) {
              return x && String(x.name || "").trim().toUpperCase() === rosterName;
            });
          }
        }
        if (!p) {
          p = gs.players.find(function (x) {
            return x && Number(x.playerOrder) === ctrlSlot;
          });
        }
        if (!p && gs.players[ctrlSlot - 1]) {
          p = gs.players[ctrlSlot - 1];
        }
      }
    }
    if (!p) {
      p = gs.players
        ? gs.players.find(function (x) {
            return x.name === gs.currentPlayer;
          })
        : null;
    }
    if (!p) {
      el.textContent = "";
      el.innerHTML = "";
      return;
    }
    var color = window.gameUtils.colorMap[p.color] || "#ffffff";
    var suffix = phaseToBannerSuffix(phase);
    var nameU = String(p.name || "").toUpperCase();
    var suffixU = String(suffix || "").toUpperCase();

    if (window.risqueArtemisMode && titleEl) {
      var artemisOwnsPhase =
        (typeof window.risqueArtemisIsMyTurn === "function" && window.risqueArtemisIsMyTurn(gs)) ||
        (typeof window.risqueArtemisClientNameMatchesCurrent === "function" &&
          window.risqueArtemisClientNameMatchesCurrent(gs));
      titleEl.textContent = artemisPhaseHudTitle(phase, gs, { activePlayerOnly: artemisOwnsPhase });
      titleEl.classList.add("hud-banner-phase-title");
      titleEl.style.color = color;
      el.textContent = "";
      el.innerHTML = "";
      var skipArtemisVoiceSync =
        phase === "attack" ||
        phase === "reinforce" ||
        phase === "receivecard" ||
        phase === "getcard" ||
        phase === "deploy" ||
        phase === "con-deploy" ||
        phase === "cardplay" ||
        phase === "con-cardplay";
      if (
        !skipArtemisVoiceSync &&
        typeof window.risqueArtemisSyncPhaseControlVoice === "function"
      ) {
        window.risqueArtemisSyncPhaseControlVoice(gs);
      }
      return;
    }

    el.classList.remove("hud-turn-banner--cardplay");
    el.classList.add("hud-turn-banner--player-phase");
    el.style.color = "";
    /* Deploy / attack: player color on black — no white stroke (readability from size + shadow in CSS) */
    /* Host income: smaller banner via CSS; omit outline so the name has no stroke */
    var outlineClass =
      phase === "deploy" ||
      phase === "attack" ||
      phase === "cardplay" ||
      phase === "con-cardplay" ||
      ((phase === "income" || phase === "con-income") && window.risqueDisplayIsPublic !== true)
        ? ""
        : bannerPhaseLineNeedsLightOutline(color)
          ? " hud-banner-player-phase-line--light-outline"
          : "";
    el.innerHTML =
      '<span class="hud-banner-player-phase-line' +
      outlineClass +
      '" style="color:' +
      escapeHtmlBanner(color) +
      '">' +
      escapeHtmlBanner(nameU) +
      "-" +
      escapeHtmlBanner(suffixU) +
      "</span>";
  }

  window.risqueRuntimeHud = {
    ensure: ensure,
    ensureLogin: ensureLogin,
    ensureSetupHud: ensureSetupHud,
    ensureSetupUnifiedHud: ensureSetupUnifiedHud,
    setControlVoiceText: setControlVoiceText,
    clearPhaseSlot: clearPhaseSlot,
    setAttackChromeInteractive: setAttackChromeInteractive,
    repairAttackStepChromeButtons: repairAttackStepChromeButtons,
    clampCombatLogToCanvasBottom: clampCombatLogToCanvasBottom,
    syncPosition: syncPosition,
    updateTurnBannerFromState: updateTurnBannerFromState,
    isPostSetupPhase: function (phase) {
      var p = String(phase || "");
      return (
        p === "cardplay" ||
        p === "con-cardplay" ||
        p === "income" ||
        p === "con-income" ||
        p === "deploy1" ||
        p === "deploy2" ||
        p === "deploy" ||
        p === "con-deploy" ||
        p === "attack" ||
        p === "reinforce" ||
        p === "receivecard" ||
        p === "getcard" ||
        p === "conquer" ||
        p === "con-cardtransfer" ||
        p === "postgame"
      );
    }
  };
})();
