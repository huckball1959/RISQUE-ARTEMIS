/**
 * ARTEMIS - unified sign-in (Player 1 host + Player 2/3 clients).
 */
(function () {
  if (!window.risqueArtemisMode || !window.risqueArtemisPlayerSlot) return;

  var slotNum = window.risqueArtemisPlayerSlot;
  if (slotNum < 1 || slotNum > 6) return;

  var isHost = !!window.risqueArtemisHost;
  var COLORS = ["blue", "red", "yellow", "green", "pink", "white"];
  var COLOR_LABEL = {
    blue: "Blue",
    red: "Red",
    yellow: "Yellow",
    green: "Green",
    pink: "Pink",
    white: "White"
  };

  var overlay = null;
  var loginDomReady = false;
  var loginDomReadyQueue = [];
  var pickedColor = "";
  var confirmed = false;
  var takenColors = {};
  var takenNames = {};
  var profiles = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };

  function profileKey(slot) {
    return String(slot);
  }

  function flushLoginDomReady() {
    if (loginDomReady) return;
    if (!document.body) return;
    loginDomReady = true;
    var queue = loginDomReadyQueue.slice();
    loginDomReadyQueue = [];
    queue.forEach(function (fn) {
      try {
        fn();
      } catch (eReady) {
        /* ignore */
      }
    });
  }

  function whenLoginDomReady(fn) {
    if (typeof fn !== "function") return;
    if (loginDomReady && document.body) {
      fn();
      return;
    }
    loginDomReadyQueue.push(fn);
    flushLoginDomReady();
  }

  if (document.body) {
    flushLoginDomReady();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", flushLoginDomReady);
  } else {
    setTimeout(flushLoginDomReady, 0);
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    if (!document.body) return null;
    overlay = document.createElement("div");
    overlay.id = "risque-artemis-login";
    overlay.className = "risque-artemis-login";
    overlay.innerHTML =
      '<div class="risque-artemis-login-card">' +
      '<h2 class="risque-artemis-login-title" id="risque-artemis-login-title"></h2>' +
      '<p class="risque-artemis-login-lead" id="risque-artemis-login-lead"></p>' +
      '<div id="risque-artemis-login-form">' +
      '<label class="risque-artemis-login-label" for="risque-artemis-login-name">Your name</label>' +
      '<input type="text" id="risque-artemis-login-name" class="risque-artemis-login-name" maxlength="32" autocomplete="off" placeholder="Name" />' +
      '<p class="risque-artemis-login-sublabel">Pick your color</p>' +
      '<div class="risque-artemis-login-colors" id="risque-artemis-login-colors"></div>' +
      '<p class="risque-artemis-login-error" id="risque-artemis-login-error"></p>' +
      '<div class="risque-artemis-login-action risque-artemis-login-btn" id="risque-artemis-login-btn" role="button" tabindex="0">LOG IN</div>' +
      "</div>" +
      '<ul class="risque-artemis-login-roster" id="risque-artemis-login-roster" hidden></ul>' +
      "</div>";
    document.body.appendChild(overlay);

    var titleEl = document.getElementById("risque-artemis-login-title");
    if (titleEl) {
      titleEl.textContent = isHost
        ? "Sign in - Host (Player 1)"
        : "Sign in - Player " + slotNum;
    }

    var colorsEl = document.getElementById("risque-artemis-login-colors");
    if (colorsEl) {
      COLORS.forEach(function (c) {
        var chip = document.createElement("div");
        chip.className = "risque-artemis-login-color risque-artemis-login-color--" + c;
        chip.setAttribute("data-color", c);
        chip.setAttribute("role", "button");
        chip.setAttribute("tabindex", "0");
        chip.textContent = COLOR_LABEL[c] || c;
        chip.addEventListener("click", function () {
          pickColor(c, chip);
        });
        chip.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            pickColor(c, chip);
          }
        });
        colorsEl.appendChild(chip);
      });
    }

    function wireAction(el, fn) {
      if (!el) return;
      el.addEventListener("click", fn);
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          fn();
        }
      });
    }

    wireAction(document.getElementById("risque-artemis-login-btn"), submitProfile);

    var nameInput = document.getElementById("risque-artemis-login-name");
    if (nameInput) {
      nameInput.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") submitProfile();
      });
    }

    return overlay;
  }

  function setError(msg) {
    var el = document.getElementById("risque-artemis-login-error");
    if (el) el.textContent = msg || "";
  }

  function pickColor(color, chipEl) {
    if (confirmed) return;
    if (chipEl && chipEl.classList.contains("risque-artemis-login-color--taken")) return;
    pickedColor = color;
    var colorsEl = document.getElementById("risque-artemis-login-colors");
    if (colorsEl) {
      colorsEl.querySelectorAll(".risque-artemis-login-color").forEach(function (b) {
        b.classList.toggle(
          "risque-artemis-login-color--picked",
          b.getAttribute("data-color") === color
        );
      });
    }
    setError("");
  }

  function refreshColorButtons() {
    var colorsEl = document.getElementById("risque-artemis-login-colors");
    if (!colorsEl) return;
    colorsEl.querySelectorAll(".risque-artemis-login-color").forEach(function (btn) {
      var c = btn.getAttribute("data-color");
      var taken = !!takenColors[c];
      btn.classList.toggle("risque-artemis-login-color--taken", taken);
      btn.setAttribute("aria-disabled", taken ? "true" : "false");
      if (taken && pickedColor === c) {
        pickedColor = "";
        btn.classList.remove("risque-artemis-login-color--picked");
      }
    });
  }

  function rosterLine(slot, prof) {
    if (prof && prof.name && prof.color) {
      return (
        "Player " +
        slot +
        ": " +
        String(prof.name).toUpperCase() +
        " (" +
        (COLOR_LABEL[prof.color] || prof.color).toUpperCase() +
        ") - READY"
      );
    }
    return "Player " + slot + ": waiting...";
  }

  function renderRoster() {
    var rosterEl = document.getElementById("risque-artemis-login-roster");
    if (!rosterEl) return;
    rosterEl.hidden = true;
    rosterEl.innerHTML = "";
  }

  function showSelfConfirmed(name, color) {
    confirmed = true;
    var formEl = document.getElementById("risque-artemis-login-form");
    if (formEl) formEl.hidden = true;
    setError("");
    var lead = document.getElementById("risque-artemis-login-lead");
    if (lead) {
      lead.textContent =
        "YOU ARE " +
        String(name || "").toUpperCase() +
        " (" +
        (COLOR_LABEL[color] || color).toUpperCase() +
        ")." +
        (isHost && window.risqueArtemisFastBoot
          ? " Map ready - START or LOAD on the map when all 3 are in."
          : isHost
            ? " Starting game..."
            : " Waiting for the host to start the game.");
    }
    renderRoster();
    if (isHost && window.risqueArtemisFastBoot) {
      hidePanel();
    }
  }

  function myFixedProfile() {
    if (typeof window.risqueArtemisFixedProfile === "function") {
      return window.risqueArtemisFixedProfile(slotNum);
    }
    if (window.risqueArtemisFixedProfiles) {
      return (
        window.risqueArtemisFixedProfiles[slotNum] ||
        window.risqueArtemisFixedProfiles[String(slotNum)] ||
        null
      );
    }
    return null;
  }

  function showQuickLoginSplash() {
    if (!window.risqueArtemisFastBoot) return;
    if (isPastArtemisLoginPhase()) return;
    if (hostDrivenLoginEnabled()) {
      if (isHost) return;
      showEntryForm();
      return;
    }
    var fixed = myFixedProfile();
    if (!fixed) return;
    if (!document.body) {
      whenLoginDomReady(showQuickLoginSplash);
      return;
    }
    if (!ensureOverlay()) return;
    if (isHost) {
      return;
    }
    overlay.classList.add("risque-artemis-login--quick");
    overlay.hidden = false;
    document.documentElement.classList.add("risque-artemis-login-active");
    var titleEl = document.getElementById("risque-artemis-login-title");
    if (titleEl) {
      titleEl.textContent = "Sign in - Player " + slotNum;
    }
    var formEl = document.getElementById("risque-artemis-login-form");
    if (formEl) formEl.hidden = true;
    var lead = document.getElementById("risque-artemis-login-lead");
    if (lead) {
      lead.innerHTML =
        '<div class="risque-artemis-login-quick-badge risque-artemis-login-quick-badge--' +
        String(fixed.color || "blue") +
        '">' +
        String(fixed.name || "").toUpperCase() +
        " Â· " +
        (COLOR_LABEL[fixed.color] || fixed.color || "color").toUpperCase() +
        "</div>" +
        '<p class="risque-artemis-login-quick-hint">Assumed names & colors - signing in automatically...</p>';
    }
    setError("");
  }

  function showEntryForm() {
    if (isPastArtemisLoginPhase()) {
      hidePanel();
      return;
    }
    syncLobbyModeDomClasses();
    /* Quick: host uses hot-seat HUD; clients only wait. */
    if (hostDrivenLoginEnabled()) {
      document.documentElement.classList.add("risque-artemis-host-driven-login");
      if (isHost) {
        hidePanel();
        document.documentElement.classList.remove("risque-artemis-login-active");
        return;
      }
      if (!document.body) {
        whenLoginDomReady(showEntryForm);
        return;
      }
      if (!ensureOverlay()) return;
      overlay.classList.add("risque-artemis-login--quick");
      overlay.hidden = false;
      document.documentElement.classList.add("risque-artemis-login-active");
      var titleEl = document.getElementById("risque-artemis-login-title");
      if (titleEl) titleEl.textContent = "Connected — Player " + slotNum;
      var formEl = document.getElementById("risque-artemis-login-form");
      if (formEl) {
        formEl.hidden = true;
        formEl.setAttribute("hidden", "");
        formEl.style.display = "none";
      }
      var colorsEl = document.getElementById("risque-artemis-login-colors");
      if (colorsEl) colorsEl.style.display = "none";
      var btnEl = document.getElementById("risque-artemis-login-btn");
      if (btnEl) btnEl.style.display = "none";
      var nameEl = document.getElementById("risque-artemis-login-name");
      if (nameEl) nameEl.style.display = "none";
      var lead = document.getElementById("risque-artemis-login-lead");
      if (lead) {
        lead.textContent =
          "Connected. Waiting for the host to pick who's playing and start the game.";
      }
      setError("");
      return;
    }
    /* Open lobby: every laptop types name + color (no fixed auto-login). */
    if (confirmed) {
      renderRoster();
      return;
    }
    if (!document.body) {
      whenLoginDomReady(showEntryForm);
      return;
    }
    if (!ensureOverlay()) return;
    overlay.classList.remove("risque-artemis-login--quick");
    overlay.hidden = false;
    document.documentElement.classList.add("risque-artemis-login-active");
    document.documentElement.classList.remove("risque-artemis-login-confirmed");
    document.documentElement.classList.remove("risque-artemis-host-driven-login");

    var leadOpen = document.getElementById("risque-artemis-login-lead");
    var formElOpen = document.getElementById("risque-artemis-login-form");
    var colorsElOpen = document.getElementById("risque-artemis-login-colors");
    var btnElOpen = document.getElementById("risque-artemis-login-btn");
    var nameElOpen = document.getElementById("risque-artemis-login-name");
    if (leadOpen) {
      leadOpen.textContent = isHost
        ? "Open lobby — enter your name and color. Other players sign in on their laptops. Start when everyone is in."
        : "Open lobby — enter your name and pick a color.";
    }
    if (formElOpen) {
      formElOpen.hidden = false;
      formElOpen.removeAttribute("hidden");
      formElOpen.style.display = "";
    }
    if (colorsElOpen) colorsElOpen.style.display = "";
    if (btnElOpen) btnElOpen.style.display = "";
    if (nameElOpen) nameElOpen.style.display = "";
    refreshColorButtons();
    renderRoster();
  }

  function hidePanel() {
    if (overlay) overlay.hidden = true;
    document.documentElement.classList.remove("risque-artemis-login-confirmed");
    document.documentElement.classList.remove("risque-artemis-login-active");
  }

  /** Game already past sign-in - do not resurrect login chrome over setup/cardplay/postgame. */
  function isPastArtemisLoginPhase() {
    try {
      var q = new URLSearchParams(window.location.search);
      var forced = String(q.get("phase") || "");
      if (forced === "postgame") return true;
    } catch (eQ) {
      /* ignore */
    }
    if (window.gameState) {
      var livePh = String(window.gameState.phase || "");
      if (livePh === "postgame") return true;
    }
    try {
      var raw = localStorage.getItem("gameState");
      if (raw) {
        var st = JSON.parse(raw);
        if (st && String(st.phase || "") === "postgame") return true;
      }
    } catch (eLs) {
      /* ignore */
    }
    if (!window.risqueArtemisLobbyStarted) return false;
    var ph = window.gameState ? String(window.gameState.phase || "") : "";
    return !!ph && ph !== "login";
  }

  function pushLoginMirror() {
    if (!isHost || typeof window.risqueMirrorPushGameState !== "function") return;
    if (!window.gameState || String(window.gameState.phase || "") !== "login") return;
    var rows = [];
    var s;
    for (s = 1; s <= 6; s += 1) {
      var p = profiles[profileKey(s)];
      rows.push(
        p && p.name && p.color
          ? { name: String(p.name).toUpperCase(), color: p.color }
          : { name: "", color: "" }
      );
    }
    window.gameState.risquePublicLoginFormMirror = { rows: rows, v: 1 };
    try {
      window.risqueMirrorPushGameState();
    } catch (ePush) {
      /* ignore */
    }
  }

  window.risqueArtemisScheduleLoginMirrorPush = pushLoginMirror;

  function submitProfile() {
    if (confirmed) return;
    var nameInput = document.getElementById("risque-artemis-login-name");
    var name = nameInput ? String(nameInput.value || "").trim().toUpperCase() : "";
    if (!name) {
      setError("Enter your name.");
      return;
    }
    if (!pickedColor) {
      setError("Pick a color.");
      return;
    }
    if (takenColors[pickedColor]) {
      setError("That color is taken - pick another.");
      return;
    }
    if (takenNames[name]) {
      setError("That name is taken - pick another.");
      return;
    }
    setError("");
    if (typeof window.risqueArtemisSend === "function") {
      window.risqueArtemisSend({
        type: "login_profile",
        slot: slotNum,
        name: name,
        color: pickedColor
      });
    }
  }

  function normLoadName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function buildArtemisRosterFromProfiles() {
    var roster = [];
    var s;
    for (s = 1; s <= (window.risqueArtemisMaxSlots || 6); s += 1) {
      var prof = profiles[profileKey(s)];
      if (!prof || !prof.name || !prof.color) {
        return null;
      }
      roster.push({
        slot: s,
        name: String(prof.name).trim().toUpperCase(),
        color: String(prof.color).trim().toLowerCase()
      });
    }
    return roster;
  }

  function territoryIdFromEntry(entry) {
    if (!entry) return "";
    if (typeof entry === "string") return String(entry).trim().toLowerCase();
    if (entry.name) return String(entry.name).trim().toLowerCase();
    return "";
  }

  function continentKeyForTerritory(gs, terrId) {
    var id = territoryIdFromEntry(terrId);
    if (!id) return "";
    var sources = [];
    if (gs && gs.continents && typeof gs.continents === "object") {
      sources.push(gs.continents);
    }
    if (window.gameUtils && window.gameUtils.continents) {
      sources.push(window.gameUtils.continents);
    }
    var si;
    for (si = 0; si < sources.length; si += 1) {
      var cont = sources[si];
      var keys = Object.keys(cont || {});
      var ki;
      for (ki = 0; ki < keys.length; ki += 1) {
        var k = keys[ki];
        var entry = cont[k];
        var list = Array.isArray(entry)
          ? entry
          : entry && Array.isArray(entry.territories)
            ? entry.territories
            : null;
        if (list && list.indexOf(id) >= 0) {
          return k;
        }
      }
    }
    return "";
  }

  function playerTerritoryCountInContinent(player, contKey, gs) {
    if (!player || !contKey || !Array.isArray(player.territories)) return 0;
    var n = 0;
    var ti;
    for (ti = 0; ti < player.territories.length; ti += 1) {
      var tid = territoryIdFromEntry(player.territories[ti]);
      if (tid && continentKeyForTerritory(gs, tid) === contKey) {
        n += 1;
      }
    }
    return n;
  }

  function pickRedistributionOwner(terrId, keptPlayers, gs) {
    if (!keptPlayers || !keptPlayers.length) return null;
    var contKey = continentKeyForTerritory(gs, terrId);
    var best = null;
    var bestContCount = -1;
    var pi;
    if (contKey) {
      for (pi = 0; pi < keptPlayers.length; pi += 1) {
        var c = playerTerritoryCountInContinent(keptPlayers[pi], contKey, gs);
        if (c > bestContCount) {
          bestContCount = c;
          best = keptPlayers[pi];
        }
      }
      if (best && bestContCount > 0) {
        return best;
      }
    }
    best = keptPlayers[0];
    var minTotal = Infinity;
    for (pi = 0; pi < keptPlayers.length; pi += 1) {
      var total = Array.isArray(keptPlayers[pi].territories)
        ? keptPlayers[pi].territories.length
        : 0;
      if (total < minTotal) {
        minTotal = total;
        best = keptPlayers[pi];
      }
    }
    return best;
  }

  function mergeTerritoryIntoPlayer(player, terrEntry) {
    if (!player) return;
    var tid = territoryIdFromEntry(terrEntry);
    if (!tid) return;
    if (!Array.isArray(player.territories)) {
      player.territories = [];
    }
    var troops = Number(terrEntry && terrEntry.troops) || 1;
    var existing = null;
    var ti;
    for (ti = 0; ti < player.territories.length; ti += 1) {
      if (territoryIdFromEntry(player.territories[ti]) === tid) {
        existing = player.territories[ti];
        break;
      }
    }
    if (existing) {
      existing.troops = (Number(existing.troops) || 0) + troops;
    } else {
      player.territories.push({ name: tid, troops: troops });
    }
  }

  function recalcPlayerTroopTotals(player) {
    if (!player) return;
    var sum = 0;
    if (Array.isArray(player.territories)) {
      player.territories.forEach(function (t) {
        sum += Number(t && t.troops) || 0;
      });
    }
    player.troopsTotal = sum + (Number(player.bankValue) || 0);
  }

  function returnPlayerCardsToDeck(gs, player) {
    if (!gs || !player) return 0;
    if (!Array.isArray(gs.deck)) {
      gs.deck = [];
    }
    var returned = 0;
    if (Array.isArray(player.cards)) {
      player.cards.forEach(function (card) {
        var name = card && card.name ? String(card.name).trim() : "";
        if (name) {
          gs.deck.push(name);
          returned += 1;
        }
      });
    }
    player.cards = [];
    player.cardCount = 0;
    return returned;
  }

  function consolidateDroppedPlayersForArtemis(gs, keptPlayers, droppedPlayers, warnings) {
    if (!droppedPlayers || !droppedPlayers.length) return;
    if (!Array.isArray(gs.risqueLuckyEliminatedNames)) {
      gs.risqueLuckyEliminatedNames = [];
    }
    var di;
    for (di = 0; di < droppedPlayers.length; di += 1) {
      var dropped = droppedPlayers[di];
      if (!dropped) continue;
      var dropName = String(dropped.name || "Player").trim();
      var cardsBack = returnPlayerCardsToDeck(gs, dropped);
      var terrList = Array.isArray(dropped.territories) ? dropped.territories.slice() : [];
      var ti;
      for (ti = 0; ti < terrList.length; ti += 1) {
        var owner = pickRedistributionOwner(territoryIdFromEntry(terrList[ti]), keptPlayers, gs);
        if (owner) {
          mergeTerritoryIntoPlayer(owner, terrList[ti]);
        }
      }
      var elimNorm = normLoadName(dropName);
      if (
        elimNorm &&
        gs.risqueLuckyEliminatedNames.every(function (n) {
          return normLoadName(n) !== elimNorm;
        })
      ) {
        gs.risqueLuckyEliminatedNames.push(dropName);
      }
      warnings.push(
        "Removed " +
          dropName +
          ": " +
          terrList.length +
          " territor" +
          (terrList.length === 1 ? "y" : "ies") +
          " redistributed, " +
          cardsBack +
          " card(s) returned to deck."
      );
    }
    keptPlayers.forEach(function (p) {
      recalcPlayerTroopTotals(p);
    });
    if (
      gs.deck.length > 1 &&
      window.gameUtils &&
      typeof window.gameUtils.risqueShuffleStringArray === "function"
    ) {
      gs.deck = window.gameUtils.risqueShuffleStringArray(gs.deck);
    }
    if (gs.defeatedPlayer) {
      var defNorm = normLoadName(gs.defeatedPlayer);
      var stillPresent = droppedPlayers.some(function (p) {
        return normLoadName(p && p.name) === defNorm;
      });
      if (stillPresent) {
        gs.defeatedPlayer = null;
      }
    }
    gs.risqueLuckySessionRoster = keptPlayers
      .map(function (p) {
        return p && p.name ? String(p.name) : "";
      })
      .filter(Boolean);
  }

  function finalizeArtemisLoadedGameState(gs, roster) {
    if (!gs || !Array.isArray(gs.players)) return;
    gs.players.forEach(function (p) {
      if (!p) return;
      if (!Array.isArray(p.cards)) {
        p.cards = [];
      }
      p.cardCount = p.cards.length;
      recalcPlayerTroopTotals(p);
    });
    if (window.gameUtils && typeof window.gameUtils.sanitizeTransientState === "function") {
      window.gameUtils.sanitizeTransientState(gs);
    }
    if (roster && roster.length) {
      gs.artemisRoster = roster.slice();
    }
    gs.setupComplete = true;
  }

  /**
   * Mock / solo saves often have 4 players or nicknames (e.g. Mickey vs MICTOR).
   * Map the save onto the signed-in ARTEMIS roster by name, then by playerOrder slot.
   * Extra players: territories redistributed, cards returned to deck.
   */
  function adaptLoadedGameForArtemisRoster(gs, roster) {
    if (!gs || !roster || roster.length < 2) {
      return { ok: false, error: "ARTEMIS roster not ready." };
    }
    var srcPlayers = Array.isArray(gs.players) ? gs.players.slice() : [];
    if (srcPlayers.length < 2) {
      return { ok: false, error: "Save needs at least 2 players." };
    }
    var picked = [];
    var used = {};
    var warnings = [];
    var r;
    for (var ri = 0; ri < roster.length; ri += 1) {
      r = roster[ri];
      var slot = Number(r.slot);
      var want = normLoadName(r.name);
      var hit = null;
      var hi;
      for (hi = 0; hi < srcPlayers.length; hi += 1) {
        if (used[hi]) continue;
        if (normLoadName(srcPlayers[hi].name) === want) {
          hit = srcPlayers[hi];
          used[hi] = true;
          break;
        }
      }
      if (!hit) {
        for (var hj = 0; hj < srcPlayers.length; hj += 1) {
          if (used[hj]) continue;
          if (Number(srcPlayers[hj].playerOrder) === slot) {
            hit = srcPlayers[hj];
            used[hj] = true;
            warnings.push(
              "Slot " +
                slot +
                ': save player "' +
                hit.name +
                '" mapped to ' +
                r.name +
                " by player order."
            );
            break;
          }
        }
      }
      if (!hit) {
        return {
          ok: false,
          error:
            "Save has no player for ARTEMIS slot " +
            slot +
            " (" +
            r.name +
            "). Save players: " +
            srcPlayers
              .map(function (p) {
                return p.name;
              })
              .join(", ") +
            "."
        };
      }
      var clone;
      try {
        clone = JSON.parse(JSON.stringify(hit));
      } catch (eClone) {
        clone = hit;
      }
      clone.name = r.name;
      clone.color = r.color;
      clone.playerOrder = slot;
      picked.push(clone);
    }
    var droppedPlayers = [];
    var dj;
    for (dj = 0; dj < srcPlayers.length; dj += 1) {
      if (!used[dj]) {
        droppedPlayers.push(srcPlayers[dj]);
      }
    }
    if (droppedPlayers.length) {
      consolidateDroppedPlayersForArtemis(gs, picked, droppedPlayers, warnings);
    }
    gs.players = picked;
    var nameByNorm = {};
    picked.forEach(function (p) {
      nameByNorm[normLoadName(p.name)] = p.name;
    });
    var oldOrder = Array.isArray(gs.turnOrder) ? gs.turnOrder.slice() : [];
    gs.turnOrder = [];
    oldOrder.forEach(function (nm) {
      var mapped = nameByNorm[normLoadName(nm)];
      if (!mapped) {
        var srcHit = null;
        var si;
        for (si = 0; si < srcPlayers.length; si += 1) {
          if (normLoadName(srcPlayers[si].name) === normLoadName(nm)) {
            srcHit = srcPlayers[si];
            break;
          }
        }
        if (srcHit && Number(srcHit.playerOrder) >= 1 && Number(srcHit.playerOrder) <= 3) {
          mapped = picked[Number(srcHit.playerOrder) - 1].name;
        }
      }
      if (mapped && gs.turnOrder.indexOf(mapped) < 0) {
        gs.turnOrder.push(mapped);
      }
    });
    picked.forEach(function (p) {
      if (gs.turnOrder.indexOf(p.name) < 0) {
        gs.turnOrder.push(p.name);
      }
    });
    var cpNorm = normLoadName(gs.currentPlayer);
    if (!nameByNorm[cpNorm]) {
      var cpSrc = null;
      var ci;
      for (ci = 0; ci < srcPlayers.length; ci += 1) {
        if (normLoadName(srcPlayers[ci].name) === cpNorm) {
          cpSrc = srcPlayers[ci];
          break;
        }
      }
      if (cpSrc && Number(cpSrc.playerOrder) >= 1 && Number(cpSrc.playerOrder) <= 3) {
        gs.currentPlayer = picked[Number(cpSrc.playerOrder) - 1].name;
        warnings.push("Remapped current player to " + gs.currentPlayer + ".");
      } else if (gs.turnOrder.length) {
        gs.currentPlayer = gs.turnOrder[0];
      }
    } else {
      gs.currentPlayer = nameByNorm[cpNorm];
    }
    finalizeArtemisLoadedGameState(gs, roster);
    if (typeof window.risqueArtemisStampControlSlot === "function") {
      window.risqueArtemisStampControlSlot(gs);
    } else {
      var curIdx = gs.turnOrder.indexOf(gs.currentPlayer);
      gs.artemisControlSlot = curIdx >= 0 ? curIdx + 1 : 1;
    }
    return { ok: true, gs: gs, warnings: warnings };
  }

  function buildArtemisRosterForLoad() {
    try {
      var raw = sessionStorage.getItem("risqueArtemisRoster");
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 3) {
          return parsed;
        }
      }
    } catch (eRos) {
      /* ignore */
    }
    if (window.gameState && Array.isArray(window.gameState.artemisRoster) && window.gameState.artemisRoster.length >= 2) {
      return window.gameState.artemisRoster.slice();
    }
    if (window.risqueArtemisFixedProfiles) {
      var fromFixed = [];
      var s;
      for (s = 1; s <= (window.risqueArtemisMaxSlots || 6); s += 1) {
        var fp = window.risqueArtemisFixedProfiles[s] || window.risqueArtemisFixedProfiles[String(s)];
        if (!fp || !fp.name || !fp.color) {
          return null;
        }
        fromFixed.push({
          slot: s,
          name: String(fp.name).trim().toUpperCase(),
          color: String(fp.color).trim().toLowerCase()
        });
      }
      return fromFixed;
    }
    return buildArtemisRosterFromProfiles();
  }

  window.risqueArtemisAdaptLoadedSave = function (gs) {
    if (!gs || !window.risqueArtemisMode) {
      return { ok: true, gs: gs, warnings: [] };
    }
    var roster = buildArtemisRosterForLoad();
    if (!roster || roster.length < 2) {
      return { ok: true, gs: gs, warnings: [] };
    }
    return adaptLoadedGameForArtemisRoster(gs, roster);
  };

  function maxArtemisSlots() {
    return Math.max(2, Math.min(6, Number(window.risqueArtemisMaxSlots) || 6));
  }

  function getLobbyMode() {
    var m = String(window.risqueArtemisLobbyMode || "").toLowerCase();
    if (m === "open") return "open";
    return "quick";
  }

  function syncLobbyModeDomClasses() {
    var mode = getLobbyMode();
    var quick = mode !== "open";
    window.risqueArtemisHostDrivenLogin = quick;
    try {
      document.documentElement.classList.toggle("risque-artemis-host-driven-login", quick);
      document.documentElement.classList.toggle("risque-artemis-lobby-mode-quick", quick);
      document.documentElement.classList.toggle("risque-artemis-lobby-mode-open", !quick);
    } catch (eCls) {
      /* ignore */
    }
  }

  /**
   * Apply Quick vs Open lobby mode on every laptop (host broadcasts via lobby_set_mode).
   * @param {"quick"|"open"} mode
   * @param {{ broadcast?: boolean, remount?: boolean }} [opts]
   */
  function applyLobbyMode(mode, opts) {
    opts = opts || {};
    var next = mode === "open" ? "open" : "quick";
    var prev = getLobbyMode();
    window.risqueArtemisLobbyMode = next;
    try {
      localStorage.setItem("risqueArtemisLobbyMode", next);
    } catch (eStore) {
      /* ignore */
    }
    syncLobbyModeDomClasses();
    if (opts.broadcast !== false && isHost && typeof window.risqueArtemisSend === "function") {
      window.risqueArtemisSend({ type: "lobby_set_mode", mode: next });
    }
    if (opts.remount !== false && prev !== next && window.risqueArtemisLobbyStarted) {
      try {
        if (next === "open") {
          var rootClr = document.getElementById("risque-login-hud-root");
          if (rootClr && isHost) {
            rootClr.innerHTML = "";
            rootClr.hidden = true;
          }
          document.documentElement.classList.remove("risque-artemis-host-driven-login");
          showEntryForm();
        } else if (
          isHost &&
          window.risquePhases &&
          window.risquePhases.login &&
          typeof window.risquePhases.login.mount === "function"
        ) {
          hidePanel();
          var uio =
            document.getElementById("risque-ui-overlay") ||
            document.querySelector(".risque-ui-overlay") ||
            document.body;
          window.risquePhases.login.mount(uio, {});
        } else if (typeof window.risqueArtemisShowLoginPanel === "function") {
          showEntryForm();
        }
      } catch (eRemount) {
        /* ignore */
      }
    }
    if (typeof window.risqueSyncBoardCornerArtemisStart === "function") {
      window.risqueSyncBoardCornerArtemisStart();
    }
  }

  window.risqueArtemisGetLobbyMode = getLobbyMode;
  window.risqueArtemisApplyLobbyMode = applyLobbyMode;

  function hostDrivenLoginEnabled() {
    return getLobbyMode() !== "open";
  }

  function openLobbyExpectedCount() {
    var lobby = window.risqueArtemisLastLobbyState;
    var n =
      (lobby && Number(lobby.expectedPlayers)) ||
      Number(window.risqueArtemisExpectedPlayers) ||
      3;
    return Math.max(3, Math.min(5, n));
  }

  function readHostFormFilledRows() {
    var root = document.getElementById("risque-login-hud-root");
    if (!root) return [];
    if (
      window.risquePhases &&
      window.risquePhases.login &&
      typeof window.risquePhases.login.readFilledPlayerRows === "function"
    ) {
      return window.risquePhases.login.readFilledPlayerRows(root) || [];
    }
    return [];
  }

  function profilesFromHostForm() {
    var filled = readHostFormFilledRows();
    var out = {};
    for (var i = 0; i < filled.length; i += 1) {
      out[String(i + 1)] = {
        name: filled[i].name,
        color: filled[i].color
      };
    }
    return out;
  }

  function lobbyConnectedCount() {
    var lobby = window.risqueArtemisLastLobbyState;
    if (!lobby || !Array.isArray(lobby.slots)) return 0;
    var n = hostDrivenLoginEnabled()
      ? filledOrExpectedPlayerCount()
      : openLobbyExpectedCount();
    var connected = 0;
    for (var slot = 1; slot <= n; slot += 1) {
      var hit = lobby.slots.find(function (x) {
        return Number(x.slot) === slot;
      });
      if (hit && hit.clientId) connected += 1;
    }
    return connected;
  }

  function filledOrExpectedPlayerCount() {
    var filled = readHostFormFilledRows();
    if (filled.length >= 2) return filled.length;
    var lobby = window.risqueArtemisLastLobbyState;
    if (lobby && lobby.expectedPlayers) {
      return Math.max(2, Math.min(6, Number(lobby.expectedPlayers) || 3));
    }
    return Number(window.risqueArtemisExpectedPlayers) || 3;
  }

  function openLobbySignedInCount() {
    var expected = openLobbyExpectedCount();
    var n = 0;
    for (var s = 1; s <= expected; s += 1) {
      var p = profiles[String(s)];
      if (p && p.name && p.color) n += 1;
    }
    return n;
  }

  function hostCanBeginGame() {
    if (!isHost) return false;
    if (isPastArtemisLoginPhase() || window.risqueArtemisFastBootGameStarted) return false;
    if (hostDrivenLoginEnabled()) {
      var filled = readHostFormFilledRows();
      if (filled.length < 3) return false;
      if (filled.length > 5) return false;
      var connected = lobbyConnectedCount();
      return connected >= filled.length;
    }
    var expected = openLobbyExpectedCount();
    if (openLobbySignedInCount() < expected) return false;
    return lobbyConnectedCount() >= expected;
  }

  function clearHostLoginFormForSetup() {
    try {
      document.documentElement.classList.add("risque-artemis-setup-started");
      document.documentElement.classList.remove("risque-artemis-login-active");
    } catch (eCls) {
      /* ignore */
    }
    try {
      var root = document.getElementById("risque-login-hud-root");
      if (root) {
        root.hidden = true;
        root.style.display = "none";
        root.innerHTML = "";
      }
      var slot = document.getElementById("risque-phase-content");
      if (slot && slot.querySelector("#risque-login-hud-root, .risque-login-compact-root, .risque-login-preset-bar")) {
        /* leave empty for welcome/setup chrome to fill */
        if (!slot.querySelector(".risque-player-select-root")) {
          slot.innerHTML = "";
        }
      }
    } catch (eDom) {
      /* ignore */
    }
    if (typeof window.risqueSetBoardCornerMsg === "function") {
      window.risqueSetBoardCornerMsg("");
    }
  }

  function markHostGameStarted() {
    window.risqueArtemisFastBootGameStarted = true;
    clearHostLoginFormForSetup();
    if (typeof window.risqueArtemisHideRigPicker === "function") {
      window.risqueArtemisHideRigPicker();
    }
    renderRoster();
    if (typeof window.risqueSyncBoardCornerArtemisStart === "function") {
      window.risqueSyncBoardCornerArtemisStart();
    }
  }

  function hostStartFeedback(msg) {
    if (msg) {
      setError(msg);
    }
    if (typeof window.risqueSetBoardCornerMsg === "function") {
      window.risqueSetBoardCornerMsg(msg || "");
    }
  }

  function tryHostStartGame() {
    if (!isHost) return;
    if (window.risqueArtemisFastBootGameStarted) return;
    if (isPastArtemisLoginPhase()) return;
    if (!hostCanBeginGame()) {
      if (hostDrivenLoginEnabled()) {
        var filledN = readHostFormFilledRows().length;
        var connN = lobbyConnectedCount();
        if (filledN < 3) {
          hostStartFeedback("Quick: check at least 3 players (Guido + 2 friends).");
        } else if (filledN > 5) {
          hostStartFeedback("Quick: at most 5 players for testing.");
        } else if (connN < filledN) {
          hostStartFeedback(
            "Waiting for laptops (" + connN + "/" + filledN + " connected)."
          );
        } else {
          hostStartFeedback("Waiting for all players to connect.");
        }
      } else {
        var expOpen = openLobbyExpectedCount();
        var signed = openLobbySignedInCount();
        var connOpen = lobbyConnectedCount();
        if (signed < expOpen) {
          hostStartFeedback(
            "Open lobby: waiting for sign-ins (" + signed + "/" + expOpen + ")."
          );
        } else if (connOpen < expOpen) {
          hostStartFeedback(
            "Open lobby: waiting for laptops (" + connOpen + "/" + expOpen + ")."
          );
        } else {
          hostStartFeedback("Waiting for all players to sign in.");
        }
      }
      return;
    }

    function runHostStartGame() {
      if (typeof window.risqueArtemisHideRigPicker === "function") {
        window.risqueArtemisHideRigPicker();
      }
      /* Capture roster BEFORE clearing the login HUD. */
      var startProfiles = hostDrivenLoginEnabled() ? profilesFromHostForm() : profiles;
      if (hostDrivenLoginEnabled()) {
        var filledCheck = readHostFormFilledRows();
        if (filledCheck.length < 3 || filledCheck.length > 5) {
          hostStartFeedback("Quick: pick 3–5 players with the checkboxes.");
          return;
        }
      } else if (openLobbySignedInCount() < openLobbyExpectedCount()) {
        hostStartFeedback("Open lobby: not everyone has signed in yet.");
        return;
      }
      markHostGameStarted();
      if (typeof window.risqueSyncBoardCornerArtemisStart === "function") {
        window.risqueSyncBoardCornerArtemisStart();
      }
      if (typeof window.risqueArtemisLobbyHide === "function") {
        window.risqueArtemisLobbyHide();
      }
      setError("");
      if (
        !window.risquePhases ||
        !window.risquePhases.login ||
        typeof window.risquePhases.login.commitArtemisRoster !== "function"
      ) {
        window.risqueArtemisFastBootGameStarted = false;
        try {
          document.documentElement.classList.remove("risque-artemis-setup-started");
        } catch (eCls2) {
          /* ignore */
        }
        hostStartFeedback("Game login is not ready - refresh and try again.");
        return;
      }
      var legacyNext = "game.html?phase=playerSelect&selectKind=firstCard";
      try {
        var q = new URL(window.location.href).searchParams;
        var ln = q.get("loginLegacyNext");
        if (ln) legacyNext = ln;
      } catch (eQ) {
        /* ignore */
      }
      if (
        window.risqueArtemisCycleProbeActive ||
        (function () {
          try {
            return sessionStorage.getItem("risqueArtemisCycleProbe") === "1";
          } catch (eSs) {
            return false;
          }
        })()
      ) {
        window.risqueArtemisCycleProbeActive = true;
        legacyNext = "game.html?phase=login&artemisCycleProbe=1";
      }
      var result = window.risquePhases.login.commitArtemisRoster(startProfiles, {
        legacyNext: legacyNext,
        redirectDelayMs: 0,
        onLoginSuccess: function (gs) {
          if (typeof window.risqueArtemisLobbyHide === "function") {
            window.risqueArtemisLobbyHide();
          }
          hidePanel();
          clearHostLoginFormForSetup();
          /* Host test launcher removed (m346). Clear leftover session keys from older builds. */
          try {
            sessionStorage.removeItem("risqueArtemisHostLaunchMode");
            sessionStorage.removeItem("risqueArtemisMockFirstSlot");
          } catch (eClrLaunch) {
            /* ignore */
          }
          /* Explicit URL/dev only: ?artemisAutoSave= still boots mock saves; normal START does not. */
          var useAutoSave = false;
          try {
            useAutoSave =
              !!new URL(window.location.href).searchParams.get("artemisAutoSave") ||
              (typeof window.risqueArtemisAutoSaveEnabled === "function" &&
                window.risqueArtemisAutoSaveEnabled());
          } catch (eAutoQ) {
            useAutoSave =
              typeof window.risqueArtemisAutoSaveEnabled === "function" &&
              window.risqueArtemisAutoSaveEnabled();
          }
          if (
            useAutoSave &&
            typeof window.risqueArtemisAutoSaveStartToCardplay === "function" &&
            window.risqueArtemisAutoSaveStartToCardplay(gs)
          ) {
            if (typeof window.risqueArtemisSetupMilestone === "function") {
              window.risqueArtemisSetupMilestone("AUTO-SAVE-skip-setup", "cards");
            }
            return;
          }
          var usePreset = false;
          try {
            usePreset = !!new URL(window.location.href).searchParams.get("artemisPreset");
          } catch (ePresetQ) {
            usePreset = !!window.risqueArtemisPresetMode;
          }
          if (
            (window.risqueArtemisCycleProbeActive ||
              (function () {
                try {
                  return sessionStorage.getItem("risqueArtemisCycleProbe") === "1";
                } catch (eCp) {
                  return false;
                }
              })()) &&
            typeof window.risqueArtemisCycleProbeOnLoginComplete === "function"
          ) {
            window.risqueArtemisCycleProbeActive = true;
            try {
              sessionStorage.setItem("risqueArtemisCycleProbe", "1");
            } catch (eCpStore) {
              /* ignore */
            }
            window.risqueArtemisCycleProbeOnLoginComplete(gs);
            return;
          }
          if (
            usePreset &&
            window.risqueArtemisPresetMode &&
            typeof window.risqueArtemisPresetStartToCardplay === "function" &&
            window.risqueArtemisPresetStartToCardplay(gs)
          ) {
            if (typeof window.risqueArtemisSetupMilestone === "function") {
              window.risqueArtemisSetupMilestone("PRESET-skip-setup", window.risqueArtemisPresetMode);
            }
            return;
          }
          if (
            window.risqueArtemisHost &&
            typeof window.risqueArtemisBeginSetupAfterLogin === "function"
          ) {
            if (typeof window.risqueArtemisSetupMilestone === "function") {
              window.risqueArtemisSetupMilestone("M0-login-ok", "sequential setup path");
            }
            window.risqueArtemisBeginSetupAfterLogin(gs);
          } else if (typeof window.risqueNavigateWithFade === "function") {
            window.risqueNavigateWithFade(legacyNext);
          } else {
            window.location.href = legacyNext;
          }
        },
        onLog: function (msg) {
          try {
            console.info("[ARTEMIS login]", msg);
          } catch (eLog) {
            /* ignore */
          }
        }
      });
      if (!result || !result.ok) {
        window.risqueArtemisFastBootGameStarted = false;
        try {
          document.documentElement.classList.remove("risque-artemis-setup-started");
        } catch (eCls3) {
          /* ignore */
        }
        if (typeof window.risqueSyncBoardCornerArtemisStart === "function") {
          window.risqueSyncBoardCornerArtemisStart();
        }
        hostStartFeedback((result && result.error) || "Could not start — check names and colors.");
      }
    }

    /* Kitchen-table host-driven: do not block START on beat/sync gate (clients are waiting-only). */
    if (hostDrivenLoginEnabled()) {
      runHostStartGame();
      return;
    }
    if (typeof window.risqueArtemisBeatHostGateBeforeStart === "function") {
      hostStartFeedback("Syncing all laptops before start...");
      window.risqueArtemisBeatHostGateBeforeStart()
        .then(function () {
          runHostStartGame();
        })
        .catch(function () {
          runHostStartGame();
        });
      return;
    }
    runHostStartGame();
  }

  window.risqueArtemisHostCanBeginGame = hostCanBeginGame;
  window.risqueArtemisTryHostStartGame = tryHostStartGame;

  function artemisHostMapIdle() {
    if (!isHost || !window.risqueArtemisFastBoot) return false;
    if (window.risqueArtemisFastBootGameStarted) return false;
    if (!window.risqueArtemisLobbyStarted) return false;
    var ph = window.gameState ? String(window.gameState.phase || "") : "";
    return !ph || ph === "login";
  }

  window.risqueArtemisHostMapIdle = artemisHostMapIdle;

  /* Setup rig picker REMOVED (m349). Archive: dev/archived/setup-rig-picker-m349/
   * Roulettes are fair random unless ?rigSetup= is set in the URL (dev only).
   */
  window.risqueArtemisShowRigPickerAfterStart = function (continueFn) {
    if (typeof window.risqueArtemisApplyRigSetup === "function") {
      try {
        window.risqueArtemisApplyRigSetup({ random: true });
        if (window.gameState && typeof window.risqueArtemisCaptureRigIntoGameState === "function") {
          window.risqueArtemisCaptureRigIntoGameState(window.gameState);
        }
      } catch (eRigFair) {
        /* ignore */
      }
    }
    if (typeof continueFn === "function") continueFn();
  };
  window.risqueArtemisHideRigPicker = function () {};


  function applyProfiles(incoming) {
    if (!incoming) return;
    profiles = { 1: null, 2: null, 3: null };
    takenColors = {};
    takenNames = {};
    Object.keys(incoming).forEach(function (key) {
      var prof = incoming[key];
      if (!prof) return;
      profiles[key] = prof;
      if (prof.color) takenColors[prof.color] = true;
      if (prof.name) takenNames[String(prof.name).toUpperCase()] = true;
    });

    var mine = profiles[profileKey(slotNum)];
    if (mine && mine.name && mine.color) {
      window.risqueArtemisPlayerName = String(mine.name).trim().toUpperCase();
      try {
        sessionStorage.setItem("risqueArtemisPlayerName", window.risqueArtemisPlayerName);
      } catch (eNm) {
        /* ignore */
      }
      if (!confirmed) {
        showSelfConfirmed(mine.name, mine.color);
        document.documentElement.classList.add("risque-artemis-login-confirmed");
      }
      if (window.risqueArtemisFastBoot) {
        hidePanel();
      } else if (isPastArtemisLoginPhase()) {
        hidePanel();
      } else if (document.body && ensureOverlay()) {
        overlay.hidden = false;
      }
    } else if (!confirmed) {
      if (window.risqueArtemisFastBoot && myFixedProfile()) {
        showQuickLoginSplash();
      } else {
        showEntryForm();
      }
    }

    renderRoster();
    if (isHost) pushLoginMirror();
    if (typeof window.risqueSyncBoardCornerArtemisStart === "function") {
      window.risqueSyncBoardCornerArtemisStart();
    }
  }

  function tryFastBootLoginOnce() {
    if (!window.risqueArtemisFastBoot || confirmed) return;
    if (!window.risqueArtemisLobbyStarted) return;
    /* Host-driven: clients do not auto-submit fixed names. */
    if (hostDrivenLoginEnabled()) {
      if (!isHost) showEntryForm();
      return;
    }
    if (typeof window.risqueArtemisAutoSendFixedLoginProfile === "function") {
      window.risqueArtemisAutoSendFixedLoginProfile();
      return;
    }
    var fixed =
      typeof window.risqueArtemisFixedProfile === "function"
        ? window.risqueArtemisFixedProfile(slotNum)
        : null;
    if (!fixed) return;
    pickedColor = fixed.color;
    var nameInput = document.getElementById("risque-artemis-login-name");
    if (nameInput) nameInput.value = fixed.name;
    submitProfile();
  }

  function tryFastBootHostStartOnce() {
    /* Host starts from map corner START - no auto-start after sign-in. */
  }

  window.risqueArtemisTryFastBootHostStart = tryFastBootHostStartOnce;

  if (window.risqueArtemisFastBoot) {
    whenLoginDomReady(function () {
      if (!isHost) {
        showQuickLoginSplash();
      }
    });
    (function pollFastBootLogin() {
      var ticks = 0;
      function tick() {
        ticks += 1;
        if (window.risqueArtemisLobbyStarted) {
          tryFastBootLoginOnce();
        }
        if (ticks < 48 && !confirmed) {
          setTimeout(tick, 250);
        }
      }
      tick();
    })();
  }

  window.risqueArtemisShowLoginPanel = showEntryForm;
  window.risqueArtemisHideLoginPanel = hidePanel;
  window.risqueArtemisOnLoginProfiles = applyProfiles;
  window.risqueArtemisLoginShowError = function (msg) {
    if (confirmed && !isHost) return;
    setError(msg || "Could not save - try again.");
  };
})();
