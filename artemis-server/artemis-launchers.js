"use strict";

const fs = require("fs");
const path = require("path");

const PROFILES_PATH = path.join(__dirname, "..", "launchers", "profiles.json");
const ACTIVE_MODE_PATH = path.join(__dirname, "..", "launchers", "active-mode.txt");
const JOIN_PAGE = path.join(__dirname, "..", "launchers", "join", "index.html");
const CLIENT_DIR = path.join(__dirname, "..", "launchers", "client");

/** @type {{ cacheVersion?: string, profiles?: Record<string, object>, aliases?: Record<string, string> } | null} */
let cachedConfig = null;
let cachedMtime = 0;

function loadConfig() {
  try {
    const st = fs.statSync(PROFILES_PATH);
    if (cachedConfig && st.mtimeMs === cachedMtime) return cachedConfig;
    cachedMtime = st.mtimeMs;
    cachedConfig = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
    return cachedConfig;
  } catch (e) {
    return null;
  }
}

function getActiveMode() {
  try {
    const raw = fs.readFileSync(ACTIVE_MODE_PATH, "utf8").trim().toLowerCase();
    return raw || "normal";
  } catch (e) {
    return "normal";
  }
}

function resolveProfileKey(rawKey) {
  const cfg = loadConfig();
  if (!cfg || !cfg.profiles) return null;
  let key = String(rawKey || "")
    .trim()
    .toLowerCase();
  if (!key) return null;
  if (cfg.aliases && cfg.aliases[key]) key = cfg.aliases[key];

  const mode = getActiveMode();
  const modeMap = cfg.modeMap && cfg.modeMap[mode];
  if (modeMap && modeMap[key]) key = modeMap[key];

  if (cfg.profiles[key]) return key;
  return null;
}

function buildJoinUrl(hostHeader, profileKey) {
  const cfg = loadConfig();
  if (!cfg) return null;
  const resolved = resolveProfileKey(profileKey);
  if (!resolved) return null;
  const profile = cfg.profiles[resolved];
  if (!profile) return null;

  const params = new URLSearchParams();
  const role = profile.role === "host" ? "host" : "client";
  if (!profile.path || !String(profile.path).includes("probe.html")) {
    params.set("artemis", role);
    params.set("slot", String(profile.slot));
    if (profile.name) params.set("name", String(profile.name));
  }
  const extra = profile.params && typeof profile.params === "object" ? profile.params : {};
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== "") params.set(k, String(v));
  }

  const host = hostHeader || "127.0.0.1";
  const page = profile.path ? String(profile.path).replace(/^\/+/, "") : "game.html";
  return `http://${host}/${page}?${params.toString()}`;
}

function launcherManifest() {
  const cfg = loadConfig();
  if (!cfg) return { ok: false, error: "profiles.json missing or invalid" };
  const profiles = {};
  for (const [key, p] of Object.entries(cfg.profiles || {})) {
    profiles[key] = {
      key,
      label: p.label || key,
      short: p.short || key,
      joinPath: `/join/${key}`,
    };
  }
  const clientFiles = [];
  try {
    for (const name of fs.readdirSync(CLIENT_DIR)) {
      if (/\.(bat|txt)$/i.test(name)) clientFiles.push(name);
    }
  } catch (e) {
    /* ignore */
  }
  clientFiles.sort();
  const mode = getActiveMode();
  const routed = {};
  for (const seat of ["host", "p2", "p3", "p4", "p5", "p6"]) {
    const resolved = resolveProfileKey(seat);
    routed[seat] = resolved
      ? { profile: resolved, joinPath: `/join/${seat}`, resolvesTo: `/join/${resolved}` }
      : null;
  }
  return {
    ok: true,
    cacheVersion: cfg.cacheVersion || "",
    activeMode: mode,
    routed,
    profiles,
    aliases: cfg.aliases || {},
    clientFiles,
    clientLauncher: "ARTEMIS-JOIN.bat",
    clientBase: "/launchers/client/",
    joinHub: "/join/",
  };
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

function sendText(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function serveClientFile(res, fileName) {
  const safe = path.basename(fileName);
  const full = path.join(CLIENT_DIR, safe);
  if (!full.startsWith(CLIENT_DIR + path.sep) && full !== CLIENT_DIR) {
    sendText(res, 403, "text/plain; charset=utf-8", "Forbidden");
    return true;
  }
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) {
      sendText(res, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }
    const ext = path.extname(full).toLowerCase();
    const type = ext === ".bat" ? "application/octet-stream" : "text/plain; charset=utf-8";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    fs.createReadStream(full).pipe(res);
  });
  return true;
}

/**
 * @returns {boolean} true if request was handled
 */
function handleLaunchers(req, res, urlPath, hostHeader) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  if (urlPath === "/join") {
    sendRedirect(res, "/join/");
    return true;
  }

  if (urlPath === "/join/") {
    fs.readFile(JOIN_PAGE, (err, data) => {
      if (err) {
        sendText(res, 500, "text/plain; charset=utf-8", "Join hub page missing");
        return;
      }
      sendText(res, 200, "text/html; charset=utf-8", data);
    });
    return true;
  }

  const joinMatch = urlPath.match(/^\/join\/([^/]+)$/);
  if (joinMatch) {
    const target = buildJoinUrl(hostHeader, joinMatch[1]);
    if (!target) {
      sendText(res, 404, "text/plain; charset=utf-8", "Unknown join profile");
      return true;
    }
    sendRedirect(res, target);
    return true;
  }

  if (urlPath === "/api/artemis/launchers") {
    sendText(res, 200, "application/json; charset=utf-8", JSON.stringify(launcherManifest()));
    return true;
  }

  const clientMatch = urlPath.match(/^\/launchers\/client\/([^/]+)$/);
  if (clientMatch) {
    return serveClientFile(res, decodeURIComponent(clientMatch[1]));
  }

  return false;
}

module.exports = {
  loadConfig,
  getActiveMode,
  resolveProfileKey,
  buildJoinUrl,
  launcherManifest,
  handleLaunchers,
};
