/**
 * ARTEMIS fast start — instant deal + random first deployer → setup deploy.
 * Skips player-select roulette and animated deal (probe-validated path).
 */
(function () {
  "use strict";

  if (!window.risqueArtemisMode) return;

  var TERRITORIES = [
    "afghanistan", "alaska", "alberta", "argentina", "brazil", "central_america", "china", "congo",
    "east_africa", "eastern_australia", "eastern_united_states", "egypt", "great_britain", "greenland",
    "iceland", "india", "indonesia", "irkutsk", "japan", "kamchatka", "madagascar", "middle_east",
    "mongolia", "new_guinea", "north_africa", "northern_europe", "northwest_territory", "ontario",
    "peru", "quebec", "scandinavia", "siam", "siberia", "south_africa", "southern_europe", "ukraine",
    "ural", "venezuela", "western_australia", "western_europe", "western_united_states", "yakutsk"
  ];

  function shuffle(arr) {
    var a = arr.slice();
    var i;
    for (i = a.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function instantDeal(gs) {
    var players = gs.players || [];
    var pool = shuffle(TERRITORIES);
    var pi = 0;
    players.forEach(function (p) {
      p.territories = [];
      p.troopsTotal = 0;
    });
    pool.forEach(function (terr) {
      var p = players[pi % players.length];
      if (!p) return;
      p.territories.push({ name: terr, troops: 1 });
      p.troopsTotal = (p.troopsTotal || 0) + 1;
      pi += 1;
    });
  }

  function pickRandomFirstDeployer(gs) {
    var names = (gs.players || []).map(function (p) {
      return p.name;
    });
    if (!names.length) return;
    var winner = names[Math.floor(Math.random() * names.length)];
    gs.currentPlayer = winner;
    gs.turnOrder = [winner].concat(
      names.filter(function (n) {
        return n !== winner;
      })
    );
    gs.risqueArtemisFirstDeployer = winner;
  }

  function navigateDeploy() {
    var url = "game.html?phase=deploy&kind=setup";
    if (typeof window.risqueArtemisAppendSessionParams === "function") {
      url = window.risqueArtemisAppendSessionParams(url);
    }
    if (typeof window.risqueNavigateWithFade === "function") {
      window.risqueNavigateWithFade(url);
    } else {
      window.location.href = url;
    }
  }

  window.risqueArtemisFastStartToDeploy = function (gs) {
    if (!window.risqueArtemisHost || !gs) return false;
    var fastDeploy = false;
    try {
      fastDeploy = new URL(window.location.href).searchParams.get("artemisFastDeploy") === "1";
    } catch (eFd) {
      fastDeploy = false;
    }
    if (!fastDeploy) {
      try {
        console.info(
          "[ARTEMIS fast] skipped — add ?artemisFastDeploy=1 to host URL to skip welcome/deal (dev only)"
        );
      } catch (eSkip) {
        /* ignore */
      }
      return false;
    }
    instantDeal(gs);
    pickRandomFirstDeployer(gs);
    if (!gs.artemisRoster || !Array.isArray(gs.artemisRoster)) {
      try {
        var storedRoster = sessionStorage.getItem("risqueArtemisRoster");
        if (storedRoster) gs.artemisRoster = JSON.parse(storedRoster);
      } catch (eRos) {
        /* ignore */
      }
    }
    gs.phase = "deploy";
    gs.selectionPhase = "cardPlay";
    gs.setupComplete = false;
    gs.isInitialDeploy = true;
    gs.risqueMirrorDeployRoute = "setup";
    delete gs.risquePublicDealPopTerritory;
    delete gs.risquePublicPlayerSelectFlash;
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    }

    try {
      localStorage.setItem("gameState", JSON.stringify(gs));
    } catch (eLs) {
      return false;
    }

    if (typeof window.risqueHostReplaceShellGameState === "function") {
      window.risqueHostReplaceShellGameState(gs);
    } else {
      window.gameState = gs;
    }

    if (typeof window.risqueSetMirrorDeployRoute === "function") {
      window.risqueSetMirrorDeployRoute("setup");
    }

    if (typeof window.risquePersistHostGameState === "function") {
      window.risquePersistHostGameState(gs);
    }

    if (typeof window.risqueArtemisSyncFromState === "function") {
      window.risqueArtemisSyncFromState(gs);
    }

    if (typeof window.risqueArtemisSetTopStatus === "function") {
      window.risqueArtemisSetTopStatus(
        "ARTEMIS — " + String(gs.currentPlayer || "?") + " deploys first",
        "ok"
      );
    }

    try {
      console.info("[ARTEMIS fast] deploy first:", gs.currentPlayer);
    } catch (eLog) {
      /* ignore */
    }

    navigateDeploy();
    return true;
  };
})();
