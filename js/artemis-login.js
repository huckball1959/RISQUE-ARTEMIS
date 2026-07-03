/**
 * ARTEMIS — unified sign-in (Player 1 host + Player 2/3 clients).
 */
(function () {
  if (!window.risqueArtemisMode || !window.risqueArtemisPlayerSlot) return;

  var slotNum = window.risqueArtemisPlayerSlot;
  if (slotNum < 1 || slotNum > 3) return;

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
  var profiles = { 1: null, 2: null, 3: null };

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
        ? "Sign in — Host (Player 1)"
        : "Sign in — Player " + slotNum;
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
        ") — READY"
      );
    }
    return "Player " + slot + ": waiting…";
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
          ? " Map ready — START or LOAD on the map when all 3 are in."
          : isHost
            ? " Starting game…"
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
      titleEl.textContent = "Sign in — Player " + slotNum;
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
        " · " +
        (COLOR_LABEL[fixed.color] || fixed.color || "color").toUpperCase() +
        "</div>" +
        '<p class="risque-artemis-login-quick-hint">Assumed names & colors — signing in automatically…</p>';
    }
    setError("");
  }

  function showEntryForm() {
    if (isPastArtemisLoginPhase()) {
      hidePanel();
      return;
    }
    if (window.risqueArtemisFastBoot && myFixedProfile()) {
      showQuickLoginSplash();
      return;
    }
    if (confirmed) {
      renderRoster();
      return;
    }
    if (!document.body) {
      whenLoginDomReady(showEntryForm);
      return;
    }
    if (!ensureOverlay()) return;
    overlay.hidden = false;
    document.documentElement.classList.add("risque-artemis-login-active");
    document.documentElement.classList.remove("risque-artemis-login-confirmed");

    var lead = document.getElementById("risque-artemis-login-lead");
    var formEl = document.getElementById("risque-artemis-login-form");
    if (lead) {
      lead.textContent = isHost
        ? "Enter your name and color. Other players sign in on their laptops."
        : "Enter your name and pick a color.";
    }
    if (formEl) formEl.hidden = false;
    refreshColorButtons();
    renderRoster();
  }

  function hidePanel() {
    if (overlay) overlay.hidden = true;
    document.documentElement.classList.remove("risque-artemis-login-confirmed");
    document.documentElement.classList.remove("risque-artemis-login-active");
  }

  /** Game already past sign-in — do not resurrect login chrome over setup/cardplay. */
  function isPastArtemisLoginPhase() {
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
      setError("That color is taken — pick another.");
      return;
    }
    if (takenNames[name]) {
      setError("That name is taken — pick another.");
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
    for (s = 1; s <= 3; s += 1) {
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
    if (!gs || !roster || roster.length !== 3) {
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
    if (window.gameState && Array.isArray(window.gameState.artemisRoster) && window.gameState.artemisRoster.length === 3) {
      return window.gameState.artemisRoster.slice();
    }
    if (window.risqueArtemisFixedProfiles) {
      var fromFixed = [];
      var s;
      for (s = 1; s <= 3; s += 1) {
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
    if (!roster || roster.length !== 3) {
      return { ok: true, gs: gs, warnings: [] };
    }
    return adaptLoadedGameForArtemisRoster(gs, roster);
  };

  function hostCanBeginGame() {
    if (!isHost) return false;
    if (isPastArtemisLoginPhase() || window.risqueArtemisFastBootGameStarted) return false;
    return !!(profiles["1"] && profiles["2"] && profiles["3"]);
  }

  function markHostGameStarted() {
    window.risqueArtemisFastBootGameStarted = true;
    hideRigPicker();
    hideHostTestLauncher();
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
    if (typeof window.risqueArtemisHostLauncherIsOpen === "function" && window.risqueArtemisHostLauncherIsOpen()) {
      return;
    }
    if (!hostCanBeginGame()) {
      hostStartFeedback("Waiting for all 3 players to sign in.");
      return;
    }

    function runHostStartGame() {
      if (typeof window.risqueArtemisHideRigPicker === "function") {
        window.risqueArtemisHideRigPicker();
      }
      if (typeof window.risqueArtemisHideHostTestLauncher === "function") {
        window.risqueArtemisHideHostTestLauncher();
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
        hostStartFeedback("Game login is not ready — refresh and try again.");
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
      var result = window.risquePhases.login.commitArtemisRoster(profiles, {
        legacyNext: legacyNext,
        redirectDelayMs: 0,
        onLoginSuccess: function (gs) {
          if (typeof window.risqueArtemisLobbyHide === "function") {
            window.risqueArtemisLobbyHide();
          }
          hidePanel();
          var useAutoSave = false;
          var launchMode = "";
          try {
            launchMode = sessionStorage.getItem("risqueArtemisHostLaunchMode") || "";
          } catch (eLm) {
            launchMode = "";
          }
          if (launchMode === "mock") {
            useAutoSave = true;
          } else if (launchMode === "normal") {
            useAutoSave = false;
          } else {
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
        if (typeof window.risqueSyncBoardCornerArtemisStart === "function") {
          window.risqueSyncBoardCornerArtemisStart();
        }
        hostStartFeedback((result && result.error) || "Could not start — all 3 players must sign in.");
      }
    }

    // Sync/start AFTER the host picks in the launcher — otherwise the beat gate
    // goes stale while the menu is open and the roster commit bounces to sign-in.
    function launchWithChoices() {
      if (typeof window.risqueArtemisBeatHostGateBeforeStart === "function") {
        hostStartFeedback("Syncing all laptops before start…");
        window.risqueArtemisBeatHostGateBeforeStart().then(function () {
          runHostStartGame();
        });
        return;
      }
      runHostStartGame();
    }

    if (typeof window.risqueArtemisShowHostTestLauncher === "function") {
      window.risqueArtemisShowHostTestLauncher(launchWithChoices);
      return;
    }
    launchWithChoices();
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

  var RIG_PICKER_LEAD_AFTER_START =
    "Pick who wins first-card, deploy-order, and cardplay roulettes. The game continues after you choose.";
  var RIG_PICKER_OPTIONS = [
    { ui: 1, random: true, label: "True random", hint: "Fair roulette — no swap after spin" },
    { ui: 2, slot: 1, label: "Rigged — Guido", hint: "Player 1 wins setup roulettes" },
    { ui: 3, slot: 2, label: "Rigged — Mictor", hint: "Player 2 wins setup roulettes" },
    { ui: 4, slot: 3, label: "Rigged — Nooch", hint: "Player 3 wins setup roulettes" }
  ];

  // Host test launcher — three exclusive modes:
  //   "normal" → full setup, fair random roulettes (no rig)
  //   "rigged" → full setup, roulettes rigged for a chosen player (rigSlot)
  //   "mock"   → load cards.json mock cardplay, chosen player acts first (mockFirstSlot)
  var hostLauncherOverlay = null;
  var hostLauncherContinueFn = null;
  var hostLauncherState = {
    mode: null,
    rigSlot: 1,
    mockFirstSlot: 1
  };

  function slotPlayerLabel(slot) {
    var key = String(slot);
    var prof = profiles[key];
    if (prof && prof.name) return String(prof.name).trim().toUpperCase();
    return slot === 2 ? "MICTOR" : slot === 3 ? "NOOCH" : "GUIDO";
  }

  function resetHostLauncherState() {
    hostLauncherState.mode = null;
    hostLauncherState.rigSlot = 1;
    hostLauncherState.mockFirstSlot = 1;
  }

  function refreshHostLauncherUi() {
    if (!hostLauncherOverlay) return;
    var mode = hostLauncherState.mode;

    hostLauncherOverlay.querySelectorAll("[data-host-launch-mode]").forEach(function (btn) {
      btn.classList.toggle(
        "risque-artemis-host-launcher-mode--selected",
        btn.getAttribute("data-host-launch-mode") === mode
      );
    });

    var rigSection = hostLauncherOverlay.querySelector('[data-host-launch-panel="rigged"]');
    var mockSection = hostLauncherOverlay.querySelector('[data-host-launch-panel="mock"]');
    var normalNote = hostLauncherOverlay.querySelector('[data-host-launch-panel="normal"]');
    if (rigSection) rigSection.hidden = mode !== "rigged";
    if (mockSection) mockSection.hidden = mode !== "mock";
    if (normalNote) normalNote.hidden = mode !== "normal";

    hostLauncherOverlay.querySelectorAll("[data-host-launch-rig]").forEach(function (btn) {
      var slot = Number(btn.getAttribute("data-host-launch-rig")) || 0;
      btn.classList.toggle(
        "risque-artemis-host-launcher-chip--selected",
        mode === "rigged" && slot === hostLauncherState.rigSlot
      );
    });
    hostLauncherOverlay.querySelectorAll("[data-host-launch-first]").forEach(function (btn) {
      var slot = Number(btn.getAttribute("data-host-launch-first")) || 0;
      btn.classList.toggle(
        "risque-artemis-host-launcher-chip--selected",
        mode === "mock" && slot === hostLauncherState.mockFirstSlot
      );
    });

    var goBtn = hostLauncherOverlay.querySelector("#risque-artemis-host-launcher-go");
    if (goBtn) {
      var ready = mode === "normal" || mode === "rigged" || mode === "mock";
      goBtn.disabled = !ready;
      if (!mode) {
        goBtn.textContent = "Choose a mode above";
      } else if (mode === "normal") {
        goBtn.textContent = "Launch — Normal play (random)";
      } else if (mode === "rigged") {
        goBtn.textContent = "Launch — Rigged for " + slotPlayerLabel(hostLauncherState.rigSlot);
      } else {
        goBtn.textContent = "Launch — Mock, " + slotPlayerLabel(hostLauncherState.mockFirstSlot) + " starts";
      }
    }
  }

  function buildLauncherPlayerRow(dataAttr, onPick) {
    var row = document.createElement("div");
    row.className = "risque-artemis-host-launcher-row";
    [1, 2, 3].forEach(function (slot) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "risque-artemis-host-launcher-chip";
      btn.setAttribute(dataAttr, String(slot));
      btn.textContent = slotPlayerLabel(slot);
      btn.addEventListener("click", function () {
        onPick(slot);
        refreshHostLauncherUi();
      });
      row.appendChild(btn);
    });
    return row;
  }

  function ensureHostLauncherOverlay() {
    if (hostLauncherOverlay) return hostLauncherOverlay;
    if (!document.body) return null;
    hostLauncherOverlay = document.createElement("div");
    hostLauncherOverlay.id = "risque-artemis-host-launcher";
    hostLauncherOverlay.className = "risque-artemis-host-launcher";
    hostLauncherOverlay.hidden = true;
    hostLauncherOverlay.innerHTML =
      '<div class="risque-artemis-host-launcher-card" role="dialog" aria-labelledby="risque-artemis-host-launcher-title">' +
      '<h2 class="risque-artemis-rig-picker-title" id="risque-artemis-host-launcher-title">Start game — test menu</h2>' +
      '<p class="risque-artemis-rig-picker-lead">Choose how to begin. Pick a mode, set its option, then launch.</p>' +
      '<div class="risque-artemis-host-launcher-modes">' +
      '<button type="button" class="risque-artemis-host-launcher-mode" data-host-launch-mode="normal">' +
      '<span class="risque-artemis-host-launcher-mode-num">1</span>' +
      '<span class="risque-artemis-host-launcher-mode-text"><span class="risque-artemis-host-launcher-mode-label">Normal play</span>' +
      '<span class="risque-artemis-host-launcher-mode-hint">Full setup · fair random roulettes</span></span></button>' +
      '<button type="button" class="risque-artemis-host-launcher-mode" data-host-launch-mode="rigged">' +
      '<span class="risque-artemis-host-launcher-mode-num">2</span>' +
      '<span class="risque-artemis-host-launcher-mode-text"><span class="risque-artemis-host-launcher-mode-label">Rigged</span>' +
      '<span class="risque-artemis-host-launcher-mode-hint">Full setup · pick who wins selection</span></span></button>' +
      '<button type="button" class="risque-artemis-host-launcher-mode" data-host-launch-mode="mock">' +
      '<span class="risque-artemis-host-launcher-mode-num">3</span>' +
      '<span class="risque-artemis-host-launcher-mode-text"><span class="risque-artemis-host-launcher-mode-label">Load mock game</span>' +
      '<span class="risque-artemis-host-launcher-mode-hint">Round-4 cardplay · pick who starts</span></span></button>' +
      "</div>" +
      '<section class="risque-artemis-host-launcher-sub" data-host-launch-panel="normal" hidden>' +
      '<p class="risque-artemis-host-launcher-hint">Fair random selection — nobody is rigged. Continues welcome → roulettes → deal.</p>' +
      "</section>" +
      '<section class="risque-artemis-host-launcher-sub" data-host-launch-panel="rigged" hidden>' +
      '<h3 class="risque-artemis-host-launcher-heading">Rig selection for</h3>' +
      '<p class="risque-artemis-host-launcher-hint">This player wins first-card, deploy-order, and cardplay roulettes.</p>' +
      '<div data-host-launch-rig-row></div>' +
      "</section>" +
      '<section class="risque-artemis-host-launcher-sub" data-host-launch-panel="mock" hidden>' +
      '<h3 class="risque-artemis-host-launcher-heading">Mock — who starts</h3>' +
      '<p class="risque-artemis-host-launcher-hint">When mock cardplay loads, this player acts first.</p>' +
      '<div data-host-launch-first-row></div>' +
      "</section>" +
      '<button type="button" class="risque-artemis-host-launcher-go" id="risque-artemis-host-launcher-go" disabled>Choose a mode above</button>' +
      "</div>";
    document.body.appendChild(hostLauncherOverlay);

    var rigSlotContainer = hostLauncherOverlay.querySelector("[data-host-launch-rig-row]");
    if (rigSlotContainer) {
      rigSlotContainer.appendChild(
        buildLauncherPlayerRow("data-host-launch-rig", function (slot) {
          hostLauncherState.rigSlot = slot;
        })
      );
    }
    var firstContainer = hostLauncherOverlay.querySelector("[data-host-launch-first-row]");
    if (firstContainer) {
      firstContainer.appendChild(
        buildLauncherPlayerRow("data-host-launch-first", function (slot) {
          hostLauncherState.mockFirstSlot = slot;
        })
      );
    }

    hostLauncherOverlay.querySelectorAll("[data-host-launch-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        hostLauncherState.mode = btn.getAttribute("data-host-launch-mode");
        refreshHostLauncherUi();
      });
    });

    var goBtn = hostLauncherOverlay.querySelector("#risque-artemis-host-launcher-go");
    if (goBtn) {
      goBtn.addEventListener("click", function () {
        commitHostLauncherChoices();
      });
    }

    resetHostLauncherState();
    refreshHostLauncherUi();
    return hostLauncherOverlay;
  }

  function commitHostLauncherChoices() {
    var mode = hostLauncherState.mode;
    if (mode !== "normal" && mode !== "rigged" && mode !== "mock") return;

    if (typeof window.risqueArtemisClearRigSetup === "function") {
      window.risqueArtemisClearRigSetup();
    }

    // launchMode drives onLoginSuccess: "mock" auto-loads cards.json; "normal" runs full setup.
    var launchMode = mode === "mock" ? "mock" : "normal";
    var mockSlot = Number(hostLauncherState.mockFirstSlot) || 1;
    if (mockSlot < 1 || mockSlot > 3) mockSlot = 1;
    var rigSlot = Number(hostLauncherState.rigSlot) || 1;
    if (rigSlot < 1 || rigSlot > 3) rigSlot = 1;

    if (typeof window.risqueArtemisApplyRigSetup === "function") {
      if (mode === "rigged") {
        window.risqueArtemisApplyRigSetup({ slot: rigSlot });
      } else {
        // Normal + mock: fair random (locked so setup won't re-prompt the rig picker).
        window.risqueArtemisApplyRigSetup({ random: true });
      }
    }

    if (mode === "mock") {
      window.risqueArtemisAutoSave = "cards";
    } else {
      try {
        delete window.risqueArtemisAutoSave;
      } catch (eDelAuto) {
        window.risqueArtemisAutoSave = "";
      }
    }
    window.risqueArtemisMockFirstSlot = mockSlot;

    try {
      sessionStorage.setItem("risqueArtemisHostLaunchMode", launchMode);
      sessionStorage.setItem("risqueArtemisMockFirstSlot", String(mockSlot));
    } catch (eSs) {
      /* ignore */
    }

    if (window.gameState && typeof window.risqueArtemisCaptureRigIntoGameState === "function") {
      window.risqueArtemisCaptureRigIntoGameState(window.gameState);
      try {
        localStorage.setItem("gameState", JSON.stringify(window.gameState));
      } catch (eGs) {
        /* ignore */
      }
    }

    // Capture the continuation BEFORE hiding — hideHostTestLauncher() nulls
    // hostLauncherContinueFn, so reading it after would drop runHostStartGame
    // and leave the host stuck on login (the "Launch does nothing" bug).
    var cont = hostLauncherContinueFn;
    hostLauncherContinueFn = null;
    hideHostTestLauncher();
    var summary =
      mode === "mock"
        ? "Mock — " + slotPlayerLabel(mockSlot) + " starts"
        : mode === "rigged"
        ? "Rigged for " + slotPlayerLabel(rigSlot)
        : "Normal play (random)";
    if (typeof window.risqueSetBoardCornerMsg === "function") {
      window.risqueSetBoardCornerMsg(summary);
    }
    if (typeof cont === "function") {
      setTimeout(function () {
        try {
          cont();
        } catch (eCont) {
          try {
            console.error("[ARTEMIS host-launcher] continue failed:", eCont);
          } catch (eLog) {
            /* ignore */
          }
        }
      }, 0);
    }
  }

  function hideHostTestLauncher() {
    if (hostLauncherOverlay) hostLauncherOverlay.hidden = true;
    document.documentElement.classList.remove("risque-artemis-host-launcher-active");
    hostLauncherContinueFn = null;
  }

  function hostLauncherIsOpen() {
    return !!(hostLauncherOverlay && !hostLauncherOverlay.hidden);
  }

  window.risqueArtemisShowHostTestLauncher = function (continueFn) {
    if (!isHost) {
      if (typeof continueFn === "function") continueFn();
      return;
    }
    hostLauncherContinueFn = continueFn;
    if (!ensureHostLauncherOverlay()) {
      hostLauncherContinueFn = null;
      if (typeof continueFn === "function") continueFn();
      return;
    }
    resetHostLauncherState();
    hostLauncherOverlay.querySelectorAll("[data-host-launch-rig], [data-host-launch-first]").forEach(function (btn) {
      var slot =
        Number(btn.getAttribute("data-host-launch-rig") || btn.getAttribute("data-host-launch-first")) || 0;
      if (slot) btn.textContent = slotPlayerLabel(slot);
    });
    refreshHostLauncherUi();
    hostLauncherOverlay.hidden = false;
    document.documentElement.classList.add("risque-artemis-host-launcher-active");
    hostStartFeedback("");
  };

  window.risqueArtemisHideHostTestLauncher = hideHostTestLauncher;
  window.risqueArtemisHostLauncherIsOpen = hostLauncherIsOpen;

  var rigPickerOverlay = null;
  var rigPickContinueFn = null;

  function ensureRigPickerOverlay() {
    if (rigPickerOverlay) return rigPickerOverlay;
    if (!document.body) return null;
    rigPickerOverlay = document.createElement("div");
    rigPickerOverlay.id = "risque-artemis-rig-picker";
    rigPickerOverlay.className = "risque-artemis-rig-picker";
    rigPickerOverlay.hidden = true;
    rigPickerOverlay.innerHTML =
      '<div class="risque-artemis-rig-picker-card" role="dialog" aria-labelledby="risque-artemis-rig-picker-title">' +
      '<h2 class="risque-artemis-rig-picker-title" id="risque-artemis-rig-picker-title">Setup roulette rig</h2>' +
      '<p class="risque-artemis-rig-picker-lead" id="risque-artemis-rig-picker-lead">Pick who wins first-card, deploy-order, and cardplay roulettes. The game continues after you choose.</p>' +
      '<div class="risque-artemis-rig-picker-options" id="risque-artemis-rig-picker-options"></div>' +
      "</div>";
    document.body.appendChild(rigPickerOverlay);

    var optionsEl = document.getElementById("risque-artemis-rig-picker-options");
    if (optionsEl) {
      RIG_PICKER_OPTIONS.forEach(function (opt) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "risque-artemis-rig-picker-btn";
        btn.setAttribute("data-rig-ui", String(opt.ui));
        btn.innerHTML =
          '<span class="risque-artemis-rig-picker-btn-num">' +
          opt.ui +
          "</span>" +
          '<span class="risque-artemis-rig-picker-btn-text">' +
          '<span class="risque-artemis-rig-picker-btn-label">' +
          opt.label +
          "</span>" +
          '<span class="risque-artemis-rig-picker-btn-hint">' +
          opt.hint +
          "</span></span>";
        btn.addEventListener("click", function () {
          pickRigOption(opt);
        });
        optionsEl.appendChild(btn);
      });
    }
    return rigPickerOverlay;
  }

  function pickRigOption(opt) {
    if (!opt || typeof window.risqueArtemisApplyRigSetup !== "function") return;
    var cont = rigPickContinueFn;
    rigPickContinueFn = null;
    var label = "";
    if (opt.random) {
      label = window.risqueArtemisApplyRigSetup({ random: true });
    } else {
      label = window.risqueArtemisApplyRigSetup({ slot: opt.slot });
    }
    if (window.gameState && typeof window.risqueArtemisCaptureRigIntoGameState === "function") {
      window.risqueArtemisCaptureRigIntoGameState(window.gameState);
      try {
        localStorage.setItem("gameState", JSON.stringify(window.gameState));
      } catch (eGs) {
        /* ignore */
      }
      if (typeof window.risqueMirrorPushGameState === "function") {
        try {
          window.risqueMirrorPushGameState();
        } catch (eMir) {
          /* ignore */
        }
      }
    }
    if (rigPickerOverlay) rigPickerOverlay.hidden = true;
    document.documentElement.classList.remove("risque-artemis-rig-picker-active");
    if (typeof window.risqueSetBoardCornerMsg === "function" && label) {
      window.risqueSetBoardCornerMsg("Setup rig: " + label);
    }
    if (typeof cont === "function") {
      setTimeout(function () {
        try {
          cont();
        } catch (eCont) {
          try {
            console.error("[ARTEMIS rig] continue after pick failed:", eCont);
          } catch (eLog) {
            /* ignore */
          }
        }
      }, 0);
    }
  }

  function hideRigPicker() {
    if (rigPickerOverlay) rigPickerOverlay.hidden = true;
    document.documentElement.classList.remove("risque-artemis-rig-picker-active");
    rigPickContinueFn = null;
  }

  /** After START — welcome blank is visible; pause until host picks rig (fresh games only). */
  window.risqueArtemisShowRigPickerAfterStart = function (continueFn) {
    if (!isHost || !window.risqueArtemisFastBoot) {
      if (typeof continueFn === "function") continueFn();
      return;
    }
    rigPickContinueFn = continueFn;
    if (!ensureRigPickerOverlay()) {
      rigPickContinueFn = null;
      if (typeof continueFn === "function") continueFn();
      return;
    }
    var lead = document.getElementById("risque-artemis-rig-picker-lead");
    if (lead) lead.textContent = RIG_PICKER_LEAD_AFTER_START;
    rigPickerOverlay.hidden = false;
    document.documentElement.classList.add("risque-artemis-rig-picker-active");
  };

  window.risqueArtemisHideRigPicker = hideRigPicker;

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
    /* Host starts from map corner START — no auto-start after sign-in. */
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
    setError(msg || "Could not save — try again.");
  };
})();
