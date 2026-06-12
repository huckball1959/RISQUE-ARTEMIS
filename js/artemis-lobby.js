/**
 * ARTEMIS M2 — lobby overlay (slot assignment + ready + host start).
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
      '<div class="risque-artemis-lobby-status" id="risque-artemis-lobby-status"></div>' +
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

  function renderLobby(state) {
    if (!state || window.risqueArtemisLobbyStarted) return;
    ensureOverlay();
    overlay.hidden = false;

    var youEl = document.getElementById("risque-artemis-lobby-you");
    var statusEl = document.getElementById("risque-artemis-lobby-status");
    var slotsEl = document.getElementById("risque-artemis-lobby-slots");
    var actionsEl = document.getElementById("risque-artemis-lobby-actions");
    var hintEl = document.getElementById("risque-artemis-lobby-hint");
    if (!actionsEl) return;

    if (youEl) {
      youEl.textContent = isArtemisHost()
        ? "You are the HOST (Player " + slotNum + ")."
        : "You are Player " + slotNum + " on this laptop.";
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

    if (slotsEl) {
      if (isArtemisHost()) {
        slotsEl.hidden = false;
        var html = "";
        (state.slots || []).forEach(function (s) {
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
        hintEl.textContent = isArtemisHost()
          ? "Fast boot — waiting for laptops 2 and 3 to JOIN…"
          : "Fast boot — connecting…";
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
