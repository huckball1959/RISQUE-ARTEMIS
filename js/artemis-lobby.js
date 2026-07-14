/**
 * ARTEMIS M2 — lobby overlay (slot assignment + ready + host start).
 * Also hosts Quick vs Open mode picker and player-count (3–5 for testing).
 */
(function () {
  if (!window.risqueArtemisMode) return;

  var overlay = null;
  var slotNum = window.risqueArtemisPlayerSlot || 0;

  function isArtemisHost() {
    return !!window.risqueArtemisHost;
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "risque-artemis-lobby";
    overlay.className = "risque-artemis-lobby";
    overlay.innerHTML =
      '<div class="risque-artemis-lobby-card">' +
      '<h2 class="risque-artemis-lobby-title">ARTEMIS Lobby</h2>' +
      '<p class="risque-artemis-lobby-you" id="risque-artemis-lobby-you"></p>' +
      '<div class="risque-artemis-lobby-mode" id="risque-artemis-lobby-mode" hidden></div>' +
      '<div class="risque-artemis-lobby-status" id="risque-artemis-lobby-status"></div>' +
      '<div class="risque-artemis-lobby-expected" id="risque-artemis-lobby-expected" hidden></div>' +
      '<ul class="risque-artemis-lobby-slots" id="risque-artemis-lobby-slots"></ul>' +
      '<div class="risque-artemis-lobby-actions" id="risque-artemis-lobby-actions"></div>' +
      '<p class="risque-artemis-lobby-hint" id="risque-artemis-lobby-hint"></p>' +
      "</div>";
    document.body.appendChild(overlay);
    return overlay;
  }

  function toggleReady(currentReady) {
    if (typeof window.risqueArtemisSend === "function") {
      window.risqueArtemisSend({ type: "lobby_ready", ready: !currentReady });
    }
  }

  function setExpectedPlayers(n) {
    if (typeof window.risqueArtemisSend === "function") {
      var mode =
        typeof window.risqueArtemisGetLobbyMode === "function"
          ? window.risqueArtemisGetLobbyMode()
          : window.risqueArtemisLobbyMode === "open"
            ? "open"
            : "quick";
      window.risqueArtemisSend({
        type: "lobby_set_expected",
        count: n,
        lobbyMode: mode
      });
    }
    window.risqueArtemisExpectedPlayers = n;
  }

  function currentLobbyMode(state) {
    if (state && (state.lobbyMode === "open" || state.lobbyMode === "quick")) {
      return state.lobbyMode;
    }
    if (typeof window.risqueArtemisGetLobbyMode === "function") {
      return window.risqueArtemisGetLobbyMode();
    }
    return window.risqueArtemisLobbyMode === "open" ? "open" : "quick";
  }

  function renderLobby(state) {
    if (!state || window.risqueArtemisLobbyStarted) return;
    ensureOverlay();
    overlay.hidden = false;

    var youEl = document.getElementById("risque-artemis-lobby-you");
    var modeEl = document.getElementById("risque-artemis-lobby-mode");
    var statusEl = document.getElementById("risque-artemis-lobby-status");
    var expectedEl = document.getElementById("risque-artemis-lobby-expected");
    var slotsEl = document.getElementById("risque-artemis-lobby-slots");
    var actionsEl = document.getElementById("risque-artemis-lobby-actions");
    var hintEl = document.getElementById("risque-artemis-lobby-hint");
    if (!actionsEl) return;

    var lobbyMode = currentLobbyMode(state);
    var expected = Math.max(
      2,
      Math.min(6, Number(state.expectedPlayers || window.risqueArtemisExpectedPlayers || 3))
    );

    if (youEl) {
      youEl.textContent = isArtemisHost()
        ? "You are the HOST (Player " + slotNum + ")."
        : "You are Player " + slotNum + " on this laptop.";
    }

    if (modeEl) {
      if (isArtemisHost()) {
        modeEl.hidden = false;
        modeEl.innerHTML =
          '<span class="risque-artemis-lobby-expected-label">Login mode:</span> ' +
          '<button type="button" class="risque-artemis-lobby-exp-btn' +
          (lobbyMode !== "open" ? " is-active" : "") +
          '" data-lobby-mode="quick">Quick</button>' +
          '<button type="button" class="risque-artemis-lobby-exp-btn' +
          (lobbyMode === "open" ? " is-active" : "") +
          '" data-lobby-mode="open">Open lobby</button>';
        Array.prototype.forEach.call(modeEl.querySelectorAll("[data-lobby-mode]"), function (btn) {
          btn.addEventListener("click", function () {
            var m = btn.getAttribute("data-lobby-mode");
            if (typeof window.risqueArtemisApplyLobbyMode === "function") {
              window.risqueArtemisApplyLobbyMode(m, { broadcast: true, remount: false });
            } else if (typeof window.risqueArtemisSend === "function") {
              window.risqueArtemisSend({ type: "lobby_set_mode", mode: m });
            }
          });
        });
      } else {
        modeEl.hidden = false;
        modeEl.innerHTML =
          '<span class="risque-artemis-lobby-expected-label">Mode:</span> ' +
          (lobbyMode === "open"
            ? "Open lobby (you will type name + color)"
            : "Quick (host picks roster; you just connect)");
      }
    }

    if (statusEl) {
      if (isArtemisHost()) {
        statusEl.hidden = true;
        statusEl.textContent = "";
      } else {
        statusEl.hidden = false;
        statusEl.className =
          "risque-artemis-lobby-status" +
          (state.myReady ? " risque-artemis-lobby-status--ready" : "");
        statusEl.textContent = state.myReady ? "YOU ARE READY" : "Click Ready when you are set";
      }
    }

    if (expectedEl) {
      if (isArtemisHost()) {
        expectedEl.hidden = false;
        var expHtml =
          '<span class="risque-artemis-lobby-expected-label">Players tonight:</span> ';
        /* Testing band is 3–5; keep 2 and 6 available for rare cases. */
        for (var n = 2; n <= 6; n += 1) {
          expHtml +=
            '<button type="button" class="risque-artemis-lobby-exp-btn' +
            (n === expected ? " is-active" : "") +
            '" data-count="' +
            n +
            '">' +
            n +
            "</button>";
        }
        expectedEl.innerHTML = expHtml;
        Array.prototype.forEach.call(
          expectedEl.querySelectorAll(".risque-artemis-lobby-exp-btn"),
          function (btn) {
            btn.addEventListener("click", function () {
              setExpectedPlayers(parseInt(btn.getAttribute("data-count"), 10));
            });
          }
        );
      } else {
        expectedEl.hidden = true;
        expectedEl.innerHTML = "";
      }
    }

    if (slotsEl) {
      if (isArtemisHost()) {
        slotsEl.hidden = false;
        var html = "";
        (state.slots || []).forEach(function (s) {
          if (s.slot > expected) return;
          var occupied = !!s.clientId;
          var ready = !!s.ready;
          var line = "Player " + s.slot + ": ";
          if (!occupied) line += "waiting…";
          else line += (s.name || "Connected") + (ready ? " — READY" : " — not ready");
          if (s.clientId === window.risqueArtemisClientId) line += " (you)";
          html +=
            '<li class="risque-artemis-lobby-slot' +
            (occupied ? " risque-artemis-lobby-slot--on" : "") +
            (ready ? " risque-artemis-lobby-slot--ready" : "") +
            '">' +
            line +
            "</li>";
        });
        slotsEl.innerHTML = html;
      } else {
        slotsEl.hidden = true;
        slotsEl.innerHTML = "";
      }
    }

    actionsEl.innerHTML = "";
    if (!window.risqueArtemisFastBoot) {
      var readyBtn = document.createElement("button");
      readyBtn.type = "button";
      readyBtn.className = "risque-artemis-lobby-btn risque-artemis-lobby-btn--ready";
      readyBtn.textContent = state.myReady ? "Not ready" : "Ready";
      readyBtn.addEventListener("click", function () {
        toggleReady(state.myReady);
      });
      actionsEl.appendChild(readyBtn);

      if (isArtemisHost()) {
        var startBtn = document.createElement("button");
        startBtn.type = "button";
        startBtn.className = "risque-artemis-lobby-btn risque-artemis-lobby-btn--primary";
        startBtn.textContent = "Start game";
        startBtn.disabled = !state.canStart;
        startBtn.addEventListener("click", function () {
          if (typeof window.risqueArtemisSend === "function") {
            window.risqueArtemisSend({ type: "lobby_start" });
          }
        });
        actionsEl.appendChild(startBtn);
      }
    }

    if (hintEl) {
      if (window.risqueArtemisFastBoot) {
        if (lobbyMode === "open") {
          hintEl.textContent = isArtemisHost()
            ? "Waiting for " +
              expected +
              " laptops, then each player types name + color. START when everyone is signed in."
            : "Connected — open lobby: you will type your name and color (seats: " +
              expected +
              ").";
        } else {
          hintEl.textContent = isArtemisHost()
            ? "Waiting for " +
              expected +
              " laptops, then pick who's playing with checkboxes…"
            : "Connected — Quick mode: host picks the roster (player count: " +
              expected +
              ")…";
        }
      } else {
        hintEl.textContent = isArtemisHost()
          ? state.canStart
            ? "All connected players are ready. Click Start game."
            : "Wait for each laptop to connect and press Ready."
          : state.myReady
            ? "Waiting for other players and the host to start."
            : "Press Ready, then wait for the host.";
      }
    }
  }

  function hideLobby() {
    if (overlay) overlay.hidden = true;
  }

  window.risqueArtemisLobbyRender = renderLobby;
  window.risqueArtemisLobbyHide = hideLobby;
})();
