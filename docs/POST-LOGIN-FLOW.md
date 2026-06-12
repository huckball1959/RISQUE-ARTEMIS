# Step 1 — After Login (ARTEMIS)

**Goal:** Define what every laptop sees and does from **successful login** through the **start of setup** (first-card roulette, deal, setup deploy). This is the first sequential slice of the hot-seat → network redesign.

**Players:** P1 Guido (Blue, host), P2 Mictor (Red), P3 Nooch (Yellow).

---

## Principles

1. **One mirror, three views** — Host publishes state; all laptops render the same *phase* and *prompts*. Interaction is gated by slot.
2. **Unified control panel** — Same title, toggles, phase line, Control Voice on all machines ([CONTROL-PANEL.md](CONTROL-PANEL.md)).
3. **No hot-seat handoff UI** — No “pass the tablet” overlays in ARTEMIS.
4. **Host is authoritative** — Clients do not advance setup until host mirror says so (same pattern as setup deploy CONFIRM).

---

## Flow overview (target)

```
Lobby (Ready ×3 → Host Start)
        ↓
Per-laptop login (name + color) → Host commits roster
        ↓
Welcome / “Beginning game” (synchronized, ~2s)
        ↓
First-card roulette (playerSelect firstCard) — mirrored animation
        ↓
Deal (territories to players) — mirrored
        ↓
Setup deployment (each player, bank → map) — active laptop only
        ↓
Card-play order roulette (playerSelect cardPlay)
        ↓
Enter turn loop at Cardplay
```

---

## Step-by-step: what each laptop does

### A. Lobby (before login page)

| Machine | Sees | Actions |
|---------|------|---------|
| P1 Host | Lobby overlay: slot list, who’s Ready | Waits for P2/P3 Ready → **Start game** |
| P2/P3 | Lobby: “You are Player N”, Ready button | **Ready** / Not ready |

**Code:** `js/artemis-lobby.js`, WebSocket `lobby_start`.

---

### B. Login (identity)

| Machine | Sees | Actions |
|---------|------|---------|
| All | ARTEMIS login panel (name, color swatches) | Enter name, pick color, **Confirm** |
| P1 Host | Same + **Start game** when 3 profiles complete | Commits roster → triggers next step |
| P2/P3 | Locked after confirm; wait for host | Profile sent via `login_profile` |

**Code:** `js/artemis-login.js`, `phases/login.js` (`commitArtemisRoster`).

**Control panel during login:** Login HUD (`.runtime-hud-root--login`) — title RISQUE, phase line “SIGN IN”, minimal chrome.

---

### C. Welcome (target — not fully built)

**Purpose:** Brief synchronized beat so all three screens transition together after roster commit.

| Machine | Sees | Actions |
|---------|------|---------|
| All | Control Voice: e.g. “WELCOME TO RISQUE” / player names in color | None (spectator) |
| All | Phase line: `SETUP` or `BEGIN` | None |
| Map | Optional: faded map or logo on left 1080px | None |

**Duration:** ~2 seconds, then auto-advance to first-card roulette.

**Host:** Sets `gameState.phase = "playerSelect"`, `selectionPhase = "firstCard"`, pushes mirror.

**Current gap:** Host calls `risqueArtemisFastStartToDeploy` and skips welcome + first-card + deal. See `js/artemis-fast.js`, `js/artemis-login.js` `tryHostStartGame`.

---

### D. First-card roulette (`selectKind=firstCard`)

**Purpose:** Randomly pick which player receives the first card during **deal** (legacy `player-select.js`).

| Machine | Sees | Actions |
|---------|------|---------|
| All | Phase line: e.g. `SELECT` or dedicated setup banner | None |
| All | Control Voice: “SELECTING WHO GETS THE FIRST CARD” | None |
| All | Cycling player names (color-coded) in voice/report | None |
| All | Final: “{NAME} SELECTED” | None |

**Authority:** Host runs roulette logic (or host-only random seed in mirrored state); clients **only apply** `public_state` updates — no local random winner.

**Existing module:** `phases/player-select.js` — already uses Control Voice + `#attack-player-name` when `#risque-phase-content` exists.

**Mirror needs:** `risquePublicPlayerSelectFlash` or equivalent already used for TV — extend for ARTEMIS step sync.

**After winner:** Navigate / soft-phase to **deal** with winner stored on `gameState` (deal order).

---

### E. Deal

| Machine | Sees | Actions |
|---------|------|---------|
| All | Phase line: `DEAL` | None |
| All | Map: territories appearing / pop animation | None |
| All | Control Voice: deal status if voice used | None |

**Authority:** Host runs deal; mirror carries `gameState.players[].territories`.

**Existing module:** `phases/deal.js`.

---

### F. Setup deployment (covered in devlog — in progress)

| Machine | Sees | Actions |
|---------|------|---------|
| Active slot only | Deploy controls in panel + dock | Bank, map clicks, CONFIRM |
| Others | “Waiting for {NAME}” in phase slot | Toggles only |

**Authority:** Active client pushes troop edits; CONFIRM sends `player_state` with `artemisDeployTurnAdvance`; host mirrors.

**Code:** `js/artemis-deploy-panel.js`, `phases/deploy.js`, `js/artemis-net.js`.

---

## Control panel during Step 1 (after login)

| Region | Welcome | First-card roulette | Deal |
|--------|---------|---------------------|------|
| Title | RISQUE | RISQUE | RISQUE |
| Toggles | 4 network toggles (optional hide until game start — TBD) | Same | Same |
| Phase line | SETUP / BEGIN | SELECT / FIRST CARD | DEAL |
| Control Voice | Welcome copy | Roulette instruction + cycling name | Deal narration (optional) |
| Phase slot | Empty or logo | Empty (voice holds animation) | Empty or minimal |
| Map | Logo or dim board | Full board visible | Deal animation |

---

## Current vs target (summary)

| Step | Target | Current ARTEMIS |
|------|--------|-----------------|
| Lobby | ✅ | ✅ |
| Login | ✅ | ✅ |
| Welcome | Synchronized 2s beat | ✅ `artemis-setup-flow.js` |
| First-card | Mirrored `player-select` | ✅ Host runs; clients mirror flash |
| Deal | Mirrored `deal.js` pops | ✅ Host runs; clients mirror pops |
| Deploy-order roulette | Mirrored (legacy) | ✅ After deal (unchanged legacy) |
| Setup deploy | Per-laptop controls | ⚠️ Next wiring slice |
| Card-play order | Mirrored roulette | 🔜 After setup deploy |

---

## Open questions (for next design pass)

1. **Toggles during welcome / roulette** — visible but disabled, or hidden until first turn?
2. **Welcome copy** — single string or roster roll-call (“Guido, Mictor, Nooch”)?
3. **Roulette timing** — fixed 2s max (legacy) or host-controlled tick via mirror seq?
4. **Fast-start** — keep as host-only dev flag (`?artemisFast=1`) for QA?

---

## Suggested implementation order (when coding)

1. Add `welcome` pseudo-phase or `playerSelect` subkind with mirror-only animation.
2. Remove unconditional `risqueArtemisFastStartToDeploy` from login success; gate behind dev flag.
3. Wire `player-select` firstCard with host-driven cycle + mirror (reuse public TV flash fields).
4. Wire `deal.js` on host; clients mirror-only.
5. Reuse existing setup deploy ARTEMIS path (already slot-based).

---

## Test protocol (Step 1)

1. Hard refresh all three laptops.
2. Lobby → Ready → Start.
3. Each laptop logs in (Guido / Mictor / Nooch colors).
4. **Expect:** Same welcome on all three → same roulette names → same winner → same deal result → first deployer gets controls on **one** laptop only.

Record failures in [ARTEMIS-DEVLOG.md](ARTEMIS-DEVLOG.md).
