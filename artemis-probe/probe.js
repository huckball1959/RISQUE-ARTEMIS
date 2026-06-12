/**
 * ARTEMIS Turn Probe — standalone harness for slot identity + control handoff.
 * Uses the same artemis-server WebSocket protocol as the main game.
 */
(function () {
  "use strict";

  var q;
  try {
    q = new URL(window.location.href).searchParams;
  } catch (eQ) {
    return;
  }

  var mode = String(q.get("artemis") || "").toLowerCase();
  if (mode !== "host" && mode !== "client") {
    document.body.innerHTML =
      "<p style='padding:24px;font-family:sans-serif'>Open with ?artemis=host&amp;slot=1 or ?artemis=client&amp;slot=2|3</p>";
    return;
  }

  var SLOT = parseInt(String(q.get("slot") || ""), 10);
  if (mode === "host") SLOT = 1;
  if (mode === "client" && (SLOT < 2 || SLOT > 3)) {
    document.body.innerHTML = "<p style='padding:24px'>Client requires slot=2 or slot=3</p>";
    return;
  }

  var IS_HOST = mode === "host";
  var SLOT_COLORS = { 1: "blue", 2: "red", 3: "yellow" };
  var PICK_MS = 1800;
  var COUNTDOWN_MS = 2000;

  var ws = null;
  var connected = false;
  var lobbyStarted = false;
  var myName = "";
  var loginConfirmed = false;
  var profiles = { 1: null, 2: null, 3: null };
  var lastAppliedSeq = -1;

  /** @type {object|null} */
  var probe = null;
  var pickTimer = null;
  var countdownTimer = null;

  var el = {
    barStatus: document.getElementById("probe-bar-status"),
    panelLobby: document.getElementById("panel-lobby"),
    panelLogin: document.getElementById("panel-login"),
    panelTurn: document.getElementById("panel-turn"),
    lobbyYou: document.getElementById("lobby-you"),
    lobbySlots: document.getElementById("lobby-slots"),
    lobbyActions: document.getElementById("lobby-actions"),
    lobbyHint: document.getElementById("lobby-hint"),
    loginLead: document.getElementById("login-lead"),
    loginName: document.getElementById("login-name"),
    loginError: document.getElementById("login-error"),
    loginBtn: document.getElementById("login-btn"),
    loginRoster: document.getElementById("login-roster"),
    beginProbeBtn: document.getElementById("begin-probe-btn"),
    turnBanner: document.getElementById("turn-banner"),
    turnCountdown: document.getElementById("turn-countdown"),
    controlBtn: document.getElementById("control-btn"),
    turnSpectator: document.getElementById("turn-spectator"),
    truth: document.getElementById("probe-truth"),
    log: document.getElementById("probe-log")
  };

  function normName(n) {
    return String(n || "")
      .trim()
      .toUpperCase();
  }

  function setBar(text, kind) {
    if (el.barStatus) {
      el.barStatus.textContent = text;
      el.barStatus.setAttribute("data-kind", kind || "wait");
    }
  }

  function localLog(msg, highlight) {
    if (!el.log) return;
    var li = document.createElement("li");
    if (highlight) li.className = "mine";
    var ts = new Date().toLocaleTimeString();
    li.textContent = ts + " " + msg;
    el.log.insertBefore(li, el.log.firstChild);
    while (el.log.children.length > 40) {
      el.log.removeChild(el.log.lastChild);
    }
  }

  function rosterFromProfiles() {
    var out = [];
    [1, 2, 3].forEach(function (s) {
      var p = profiles[String(s)];
      if (p && p.name) {
        out.push({ slot: s, name: normName(p.name) });
      }
    });
    return out;
  }

  function allProfilesReady() {
    return profiles["1"] && profiles["2"] && profiles["3"];
  }

  function freshProbeState() {
    return {
      phase: "probe",
      roster: rosterFromProfiles(),
      currentPlayer: null,
      status: "idle",
      pickFlash: null,
      controlSeq: 0,
      countdownEnd: 0,
      clicks: 0,
      log: []
    };
  }

  function probeLog(state, line) {
    state.log = state.log || [];
    state.log.unshift({ t: Date.now(), line: line });
    if (state.log.length > 30) state.log.length = 30;
  }

  function publishState(state) {
    if (!IS_HOST || !state) return;
    state.roster = rosterFromProfiles();
    probe = state;
    lastAppliedSeq += 1;
    send({ type: "public_state", state: state });
    renderProbe();
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  function wsUrl() {
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + location.host + "/ws";
  }

  function connect() {
    setBar("Connecting…", "wait");
    ws = new WebSocket(wsUrl());
    ws.onopen = function () {
      connected = true;
      send({
        type: "join",
        role: mode,
        name: "Player" + SLOT,
        slot: SLOT
      });
    };
    ws.onmessage = function (ev) {
      var msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch (e) {
        return;
      }
      if (!msg || !msg.type) return;

      if (msg.type === "joined") {
        setBar(
          IS_HOST ? "Lobby — host (slot " + SLOT + ")" : "Lobby — player " + SLOT,
          "ok"
        );
        if (msg.lobbyStarted) onLobbyStarted();
        if (msg.publicState) {
          applyPublicState({ seq: msg.publicStateSeq || 0, state: msg.publicState });
        }
        return;
      }
      if (msg.type === "lobby_state") {
        renderLobby(msg.lobby);
        return;
      }
      if (msg.type === "lobby_started") {
        onLobbyStarted();
        return;
      }
      if (msg.type === "login_profiles") {
        applyProfiles(msg.profiles);
        return;
      }
      if (msg.type === "public_state") {
        applyPublicState(msg);
        return;
      }
      if (msg.type === "client_state") {
        if (IS_HOST) onClientClick(msg);
        return;
      }
      if (msg.type === "error") {
        setBar(msg.message || msg.code || "Error", "err");
        localLog("SERVER: " + (msg.message || msg.code));
        if (el.loginError && (msg.code === "color_taken" || msg.code === "name_taken" || msg.code === "bad_profile")) {
          el.loginError.textContent = msg.message || "Could not log in";
        }
      }
    };
    ws.onclose = function () {
      connected = false;
      setBar("Disconnected — refresh page", "err");
    };
  }

  function showPanel(name) {
    el.panelLobby.hidden = name !== "lobby";
    el.panelLogin.hidden = name !== "login";
    el.panelTurn.hidden = name !== "turn";
  }

  function renderLobby(lobby) {
    if (!lobby || lobbyStarted) return;
    showPanel("lobby");

    if (el.lobbyYou) {
      el.lobbyYou.textContent = IS_HOST
        ? "You are the HOST on this computer (Player 1)."
        : "You are Player " + SLOT + " on this laptop.";
    }

    if (el.lobbySlots && IS_HOST) {
      el.lobbySlots.innerHTML = "";
      (lobby.slots || []).forEach(function (s) {
        var li = document.createElement("li");
        if (s.ready && s.clientId) li.className = "ready";
        var line = "Player " + s.slot + ": ";
        if (!s.clientId) line += "waiting…";
        else line += (s.name || "Connected") + (s.ready ? " — READY" : " — not ready");
        li.textContent = line;
        el.lobbySlots.appendChild(li);
      });
    } else if (el.lobbySlots) {
      el.lobbySlots.innerHTML = "";
    }

    if (el.lobbyActions) {
      el.lobbyActions.innerHTML = "";
      var readyBtn = document.createElement("button");
      readyBtn.type = "button";
      readyBtn.className = "probe-btn probe-btn--ready";
      readyBtn.textContent = lobby.myReady ? "Not ready" : "Ready";
      readyBtn.addEventListener("click", function () {
        send({ type: "lobby_ready", ready: !lobby.myReady });
      });
      el.lobbyActions.appendChild(readyBtn);

      if (IS_HOST) {
        var startBtn = document.createElement("button");
        startBtn.type = "button";
        startBtn.className = "probe-btn probe-btn--primary";
        startBtn.textContent = "Start session";
        startBtn.disabled = !lobby.canStart;
        startBtn.addEventListener("click", function () {
          send({ type: "lobby_start" });
        });
        el.lobbyActions.appendChild(startBtn);
      }
    }

    if (el.lobbyHint) {
      el.lobbyHint.textContent = IS_HOST
        ? lobby.canStart
          ? "All players ready — click Start session."
          : "Wait for laptops 2 and 3 to connect and press Ready."
        : lobby.myReady
          ? "Waiting for host to start."
          : "Press Ready, then wait for the host.";
    }
  }

  function onLobbyStarted() {
    if (lobbyStarted) return;
    lobbyStarted = true;
    showPanel("login");
    setBar("Sign in with your name", "wait");
    if (el.loginLead) {
      el.loginLead.textContent = IS_HOST
        ? "Enter your name. Players 2 and 3 sign in on their laptops. (Color is auto-assigned by slot — not needed for this test.)"
        : "Enter your name for this laptop.";
    }
    localLog("Session started — sign in");
  }

  function applyProfiles(incoming) {
    if (!incoming) return;
    profiles = { 1: null, 2: null, 3: null };
    Object.keys(incoming).forEach(function (key) {
      profiles[key] = incoming[key];
    });

    var mine = profiles[String(SLOT)];
    if (mine && mine.name) {
      myName = normName(mine.name);
      loginConfirmed = true;
      if (el.loginName) el.loginName.value = myName;
      if (el.loginLead) {
        el.loginLead.textContent = "YOU ARE " + myName + (IS_HOST ? " (slot 1, host)." : ". Waiting for host to begin probe.");
      }
      if (el.loginBtn) el.loginBtn.hidden = true;
      if (el.loginName) el.loginName.disabled = true;
    }

    if (el.loginRoster) {
      el.loginRoster.innerHTML = "";
      [1, 2, 3].forEach(function (s) {
        var p = profiles[String(s)];
        var li = document.createElement("li");
        if (p && p.name) {
          li.className = "ready";
          li.textContent = "Player " + s + ": " + normName(p.name) + " — READY";
        } else {
          li.textContent = "Player " + s + ": waiting…";
        }
        el.loginRoster.appendChild(li);
      });
    }

    if (IS_HOST && el.beginProbeBtn) {
      el.beginProbeBtn.hidden = !allProfilesReady();
    }
  }

  function isMyTurn(state) {
    if (!state || !myName) return false;
    return normName(state.currentPlayer) === myName;
  }

  function applyPublicState(msg) {
    if (!msg || !msg.state) return;
    var seq = Number(msg.seq) || 0;
    if (seq <= lastAppliedSeq) return;
    lastAppliedSeq = seq;
    probe = msg.state;
    renderProbe();
  }

  function renderTruth() {
    if (!el.truth) return;
    var s = probe || {};
    var rows = [
      ["Role", IS_HOST ? "HOST" : "CLIENT"],
      ["Slot", String(SLOT)],
      ["My name", myName || "(not signed in)"],
      ["Current player", s.currentPlayer || "—"],
      ["Status", s.status || "—"],
      ["My turn", isMyTurn(s) ? "YES" : "NO"],
      ["Control seq", String(s.controlSeq != null ? s.controlSeq : "—")],
      ["Mirror seq", String(lastAppliedSeq)],
      ["Total clicks", String(s.clicks != null ? s.clicks : 0)],
      [
        "Roster",
        (s.roster || [])
          .map(function (r) {
            return r.slot + "=" + r.name;
          })
          .join(" · ") || "—"
      ]
    ];
    el.truth.innerHTML = rows
      .map(function (row) {
        return "<dt>" + row[0] + "</dt><dd>" + row[1] + "</dd>";
      })
      .join("");
  }

  function renderProbe() {
    if (!probe || probe.phase !== "probe") return;
    showPanel("turn");
    renderTruth();

    var st = probe.status;
    var cur = probe.currentPlayer ? normName(probe.currentPlayer) : "";
    var mine = isMyTurn(probe);

    if (el.turnBanner) {
      el.turnBanner.className = "probe-turn-banner";
      if (st === "picking") {
        el.turnBanner.className += " picking";
        el.turnBanner.textContent = "Selecting… " + (probe.pickFlash || "…");
      } else if (st === "countdown") {
        el.turnBanner.textContent = cur + " will have control";
      } else if (st === "active") {
        el.turnBanner.className += mine ? " active-mine" : " active-theirs";
        el.turnBanner.textContent = mine ? "YOUR TURN — click the button" : cur + " has control";
      } else {
        el.turnBanner.textContent = "Waiting for host…";
      }
    }

    if (el.turnCountdown) {
      if (st === "countdown" && probe.countdownEnd) {
        var left = Math.max(0, Math.ceil((probe.countdownEnd - Date.now()) / 1000));
        el.turnCountdown.hidden = false;
        el.turnCountdown.textContent = left > 0 ? String(left) : "GO";
      } else {
        el.turnCountdown.hidden = true;
      }
    }

    if (el.controlBtn) {
      var canClick = st === "active" && mine;
      el.controlBtn.disabled = !canClick;
      el.controlBtn.textContent = canClick ? "I TOOK CONTROL" : "I TOOK CONTROL";
    }

    if (el.turnSpectator) {
      if (st === "active" && mine) {
        el.turnSpectator.textContent = "You have control — click the button on this computer.";
      } else if (st === "active" && !mine) {
        el.turnSpectator.textContent = "Watching — only " + cur + "'s computer can click.";
      } else if (st === "countdown") {
        el.turnSpectator.textContent = "Control passes in a moment…";
      } else if (st === "picking") {
        el.turnSpectator.textContent = "Random selection in progress…";
      } else {
        el.turnSpectator.textContent = "";
      }
    }

    if (probe.log && probe.log.length) {
      var top = probe.log[0];
      if (top && top.line) {
        setBar(top.line, mine && st === "active" ? "ok" : "wait");
      }
    }
  }

  function clearTimers() {
    if (pickTimer) {
      clearInterval(pickTimer);
      pickTimer = null;
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function namesForPick() {
    return rosterFromProfiles().map(function (r) {
      return r.name;
    });
  }

  function startRandomRound(state, reason) {
    if (!IS_HOST) return;
    clearTimers();
    var names = namesForPick();
    if (names.length < 2) return;

    state.status = "picking";
    state.pickFlash = names[0];
    state.currentPlayer = null;
    state.countdownEnd = 0;
    probeLog(state, reason || "Picking random player…");
    publishState(state);

    var start = Date.now();
    var idx = 0;
    pickTimer = setInterval(function () {
      idx = (idx + 1) % names.length;
      state.pickFlash = names[idx];
      publishState(state);
      if (Date.now() - start >= PICK_MS) {
        clearInterval(pickTimer);
        pickTimer = null;
        var winner = names[Math.floor(Math.random() * names.length)];
        state.currentPlayer = winner;
        state.status = "countdown";
        state.countdownEnd = Date.now() + COUNTDOWN_MS;
        probeLog(state, "Selected " + winner + " — countdown 2s");
        publishState(state);

        countdownTimer = setInterval(function () {
          publishState(state);
          if (Date.now() >= state.countdownEnd) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            state.status = "active";
            probeLog(state, winner + " — CONTROLS ENABLED on their laptop");
            publishState(state);
          }
        }, 200);
      }
    }, 80);
  }

  function beginProbe() {
    if (!IS_HOST || !allProfilesReady()) return;
    probe = freshProbeState();
    showPanel("turn");
    localLog("Probe started");
    renderProbe();
    startRandomRound(probe, "Probe started — first pick");
  }

  function processControlClick(senderSlot, clickState) {
    if (!IS_HOST || !probe || !clickState || !clickState.probeClick) return;

    var sender = rosterFromProfiles().find(function (r) {
      return r.slot === senderSlot;
    });
    if (!sender) {
      probeLog(probe, "REJECT click — unknown slot " + senderSlot);
      publishState(probe);
      return;
    }

    if (probe.status !== "active") {
      probeLog(probe, "REJECT " + sender.name + " — not active phase");
      publishState(probe);
      return;
    }

    if (normName(probe.currentPlayer) !== sender.name) {
      probeLog(probe, "REJECT " + sender.name + " — not their turn (up: " + probe.currentPlayer + ")");
      publishState(probe);
      return;
    }

    if (Number(clickState.controlSeq) !== Number(probe.controlSeq)) {
      probeLog(probe, "REJECT " + sender.name + " — stale seq");
      publishState(probe);
      return;
    }

    probe.clicks = (probe.clicks || 0) + 1;
    probe.controlSeq += 1;
    probeLog(probe, sender.name + " CLICKED ✓ (" + probe.clicks + " total)");
    localLog(sender.name + " took control (#" + probe.clicks + ")", true);
    startRandomRound(probe, "Next random pick after " + sender.name);
  }

  function onClientClick(msg) {
    if (!msg || !msg.state) return;
    processControlClick(msg.slot, msg.state);
  }

  function submitLogin() {
    if (loginConfirmed) return;
    var name = el.loginName ? normName(el.loginName.value) : "";
    if (!name) {
      if (el.loginError) el.loginError.textContent = "Enter your name.";
      return;
    }
    if (el.loginError) el.loginError.textContent = "";
    send({
      type: "login_profile",
      slot: SLOT,
      name: name,
      color: SLOT_COLORS[SLOT] || "blue"
    });
  }

  function onControlClick() {
    if (!probe || !isMyTurn(probe) || probe.status !== "active") return;
    localLog("Click — taking control…", true);
    if (IS_HOST) {
      processControlClick(SLOT, {
        probeClick: true,
        controlSeq: probe.controlSeq,
        name: myName,
        slot: SLOT
      });
      return;
    }
    send({
      type: "player_state",
      slot: SLOT,
      state: {
        probeClick: true,
        controlSeq: probe.controlSeq,
        name: myName,
        slot: SLOT
      }
    });
  }

  if (el.loginBtn) el.loginBtn.addEventListener("click", submitLogin);
  if (el.loginName) {
    el.loginName.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") submitLogin();
    });
  }
  if (el.beginProbeBtn) el.beginProbeBtn.addEventListener("click", beginProbe);
  if (el.controlBtn) el.controlBtn.addEventListener("click", onControlClick);

  connect();
})();
