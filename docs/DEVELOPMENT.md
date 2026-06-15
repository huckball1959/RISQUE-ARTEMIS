# RISQUE / ARTEMIS — Development Guide

**Start here** for current project status, lab setup, and where to look in the codebase.

Last updated: **2026-06-07** (m221 — host mirror + deploy voice; **retest after reboot**).

---

## Reboot checklist (3 laptops)

1. **Reboot all 3 machines** if sluggish (clears browser/WebSocket state).
2. **Host:** run `scripts/SERVER/START-ARTEMIS.bat` — keep server window open (Node **5700**).
3. **All browsers:** hard refresh **Ctrl+Shift+R** — scripts must be **`artemis-m221-host-mirror-deploy-voice-2026-06-07`** (see `game.html`).
4. **Clients:** run `JOIN.bat` on laptop 2 and 3 (uses `launchers/profiles.json` via `/join/` — do not bookmark stale URLs).
5. **Lobby:** Ready ×3 → host Start — do **not** re-Start mid-session if stuck.
6. **If stuck:** tell Cursor **read diagnostics** — `logs/artemis-last-report.json` (sync, cardplayOrder, receiveCard, browserConsole).

**Current launcher profile (`profiles.json`):** `artemisMockPhases=0` — **full real phases**; `rigCardPlay=3` (Nooch wins cardplay-order roulette). Change rig in `launchers/profiles.json` only.

**Mock harness (when testing stubs):** `artemisMockPhases=1&artemisMockCardplay=0` — real cardplay, mock income. Full mock: `artemisMockCardplay=1`.

**Test save:** `3 players.json` in repo root (round 8, GUIDO/MICTOR/NOOCH — cardplay/income testing).

---

## Two tracks

| Track | Focus | Primary doc |
|-------|--------|-------------|
| **ARTEMIS** | 3-laptop network multiplayer (active) | This file + [ARTEMIS-DEVLOG.md](ARTEMIS-DEVLOG.md) |
| **Legacy runtime** | Single-machine hot-seat in `game.html` | [HANDOFF.md](HANDOFF.md), [MILESTONES.md](MILESTONES.md) |

ARTEMIS reuses the same phase modules and control panel DOM as hot-seat, but gates interaction by laptop slot and mirrors state through the host.

---

## Where we are now (ARTEMIS)

### Done (verified earlier)

| Step | Status | Notes |
|------|--------|-------|
| Lobby (Ready ×3 → host Start) | ✅ | `js/artemis-lobby.js` |
| Per-laptop login (name + color) | ✅ | `js/artemis-login.js`, `phases/login.js` |
| Welcome → first-card roulette → deal | ✅ | Mirrored setup chain |
| Setup deploy handoff (P1→P2→P3) | ✅ | m220 handoff recovery; m218 host-owner guard |
| Real cardplay (active client) | ✅ | m99+ mirror/view-class fixes |
| Real income / full real phases | ✅ | `profiles.json` has mock off for normal play |
| Turn deploy | ✅ | Per-laptop portable panel |
| Attack (active client) | ✅ | m96 portable panel |
| Reinforcement (active client) | ✅ | m98 portable panel |

### Implemented m221 — **retest after reboot**

| Step | Status | Notes |
|------|--------|-------|
| Host mirrors client **attack dice** | 🔜 retest | `risqueArtemisApplyHostAttackSpectator` — Guido was missing Nooch’s rolls |
| Deploy voice “X troops deployed to …” | 🔜 retest | All laptops via `risqueDeployTroopsDeployedToPhrase` + `deploy_live` |
| Host mirrors client **reinforce** | 🔜 retest | `risqueArtemisApplyHostReinforceSpectator` |
| Territory selection voice | 🔜 retest | m217 — all phases; Guido flicker may remain |

### Not done / reverted

| Step | Status | Notes |
|------|--------|-------|
| Portable receive-card UI | ❌ reverted | m169 broke reinforce — voice only |
| m219 voice pin + sync skip | ❌ reverted | Caused deploy/cardplay handoff regression |
| Perfect 3-laptop lockstep | ❌ | `sync_barrier_timeout` common; P3 often lags |

### Next session (suggested order)

1. **Verify m221** — attack dice on Guido, deploy troop voice, reinforce on Guido (see [SESSION_NOTES.md](SESSION_NOTES.md)).
2. Guido deploy selection voice persistence — minimal fix only; no sync skips.
3. Receive-card portable panel on a **branch** if m221 stable.
4. Commit m217–m221 when user requests.

**Git:** Local m217–m221 changes likely **uncommitted** — run `git status` after reboot.

---

## Lab topology (default)

| Laptop | Role | Slot | Test player | Color |
|--------|------|------|-------------|-------|
| 1 | Server + host + browser | P1 | Guido | Blue |
| 2 | Client browser | P2 | Mictor | Red |
| 3 | Client browser | P3 | Nooch | Yellow |

**Launch**

- Host: `scripts/SERVER/START-ARTEMIS.bat` (Node server on port **5700** in `artemis-server/`)
- Client 2: `scripts/LAPTOP 2/JOIN.bat`
- Client 3: `scripts/LAPTOP 3/JOIN.bat`

**Entry points:** [`index.html`](../index.html) (launcher) or [`game.html`](../game.html) (runtime shell).

Prefer **localhost HTTP** over `file://` (browser security warnings can interfere).

**Portable backup:** `X:\github\RISQUE-ARTEMIS` (robocopy `/MIR` from OneDrive canonical path when asked).

---

## Player flow (target)

### Setup (once)

```
Lobby → Login → Welcome → First-card roulette → Deal → Setup deployment → Card-play order roulette
```

### Turn loop (each turn)

```
Cardplay → Income → Deployment → Attack → Reinforcement → Receive card
```

Phase modules: `phases/cardplay.js`, `income.js`, `deploy.js`, `attack.js`, `reinforce.js`, `receivecard.js`.

Full step-by-step UX spec: [POST-LOGIN-FLOW.md](POST-LOGIN-FLOW.md).

---

## Turn routing (do not break)

| Mechanism | File | Role |
|-----------|------|------|
| `artemisControlSlot` | mirrored `gameState` | Which slot (1–3) owns controls |
| `risqueArtemisControlSeq` | mirrored `gameState` | Monotonic handoff counter; rejects stale `player_state` |
| `artemisDeployTurnAdvance` | ephemeral on CONFIRM push | Lets host accept handoff from previous slot |
| `risqueArtemisSyncPortableDeploy` | `js/artemis-deploy-panel.js` | Mount/teardown setup deploy UI per laptop |
| `risqueArtemisUseMockCardplay` / `UseMockIncome` | `js/artemis-mock-phases.js` | Split mock flags (m97); default real cardplay + mock income |
| `risqueArtemisSyncPortableAttack` | `js/artemis-attack-panel.js` | Attack mount per laptop (m96) |
| `risqueArtemisSyncPortableReinforce` | `js/artemis-reinforce-panel.js` | Reinforce mount per laptop (m98) |
| `risqueArtemisSyncPortableIncome` | `js/artemis-income-panel.js` | Income Continue on active laptop (m168 body button) |
| `risqueArtemisIsMyTurn` | `js/artemis-play.js` | Prefer `artemisControlSlot`, not name fallbacks |
| `applyHostClientState` | `js/artemis-net.js` | Host applies client edits + mirror |

**Regression:** `artemis-probe/probe.html` must still pass turn-click tests.

---

## Files agents touch most

| Area | Files |
|------|--------|
| Network | `js/artemis-net.js`, `artemis-server/server.js` |
| Setup sequence | `js/artemis-setup-flow.js`, `js/artemis-login.js` |
| Lobby | `js/artemis-lobby.js` |
| Turn / identity | `js/artemis-play.js` |
| Setup deploy UI | `js/artemis-deploy-panel.js`, `phases/firstdeploy.js`, `phases/deploy.js` |
| Mock harness | `js/artemis-mock-phases.js`, `js/artemis-cardplay-panel.js`, `js/artemis-income-panel.js` |
| Turn deploy UI | `js/artemis-turn-deploy-panel.js` |
| Attack / reinforce | `js/artemis-attack-panel.js`, `js/artemis-reinforce-panel.js` |
| HUD / control panel | `phases/runtime-hud.js`, `game.css` |
| Shell / mirror | `js/game-shell.js` |
| Shared core | `js/core.js` |
| Fast dev path | `js/artemis-fast.js` |

---

## Cache busting

ARTEMIS scripts in `game.html` use `?v=artemis-mNN-…` query params. **Bump the token** when changing `js/artemis-*.js`, phase modules, or ARTEMIS HUD CSS so all three laptops pick up changes.

**Current (2026-06-07):** launcher **`m168`** (`launchers/profiles.json`); most scripts **`artemis-m168-income-mini-btn-2026-06-09`**; reinforce panel still **`artemis-m99-client-cardplay-fix-2026-06-09`**; `phases/reinforce.js` **`artemis-m71-reinforce-clicks-2026-06-08`** — see `game.html`.

---

## Latest session snapshot (2026-06-07)

**Shipped in repo:** Full ARTEMIS stack + income Continue fix (`0be1a7f`).

**Tonight:** Attempted receive-card portable panel (m169) → reinforcement regression. Attempted m170 fix → worse. **Rolled back** to `0be1a7f`; user confirmed reinforcement good again.

**Receive card today:** Active player sees control voice only; no hand/staging animation.

**Roster:** GUIDO P1, MICTOR P2, NOOCH P3.

---

## Test protocol (current)

1. Hard refresh all three laptops (**m168**).
2. Lobby → Ready → Start.
3. Each laptop logs in (Guido / Mictor / Nooch + colors).
4. Full setup chain → enter turn loop.
5. On active laptop each phase: confirm controls (cardplay SKIP, income Continue, deploy CONFIRM, attack toolbar, **reinforce SKIP**).
6. After reinforce: receive card (voice only) → cardplay.
7. Record failures or say **read diagnostics**.

---

## Legacy runtime status

Single-machine `game.html` runtime is canonical (legacy HTML phase pages removed).

| Milestone | Status |
|-----------|--------|
| M1 — Launcher + shell | ✅ Complete |
| M2 — Stabilize cardplay → receivecard | ⚠️ In progress |
| M3 — Full turn loop in shell | 🔜 Pending |

Recent single-machine fixes: [HANDOFF.md](HANDOFF.md).

---

## Related docs

| File | Contents |
|------|----------|
| [ARTEMIS-DEVLOG.md](ARTEMIS-DEVLOG.md) | Dated change log — append new entries here |
| [POST-LOGIN-FLOW.md](POST-LOGIN-FLOW.md) | Post-login UX spec (target vs current) |
| [CONTROL-PANEL.md](CONTROL-PANEL.md) | Unified 1920×1080 control panel spec |
| [HANDOFF.md](HANDOFF.md) | Legacy single-machine handoff + fix notes |
| [MILESTONES.md](MILESTONES.md) | Migration milestone tracking |
| [SESSION_NOTES.md](SESSION_NOTES.md) | Archived session (2026-03-30) |
| [manual.html](manual.html) | Game rules |
| [help.html](help.html) | App help / troubleshooting |

---

## How to update this guide

When shipping meaningful ARTEMIS work:

1. Add a dated section under **Log entries** in [ARTEMIS-DEVLOG.md](ARTEMIS-DEVLOG.md).
2. Update the **Where we are now** table in this file if flow status changed.
3. Bump cache-bust tokens in `game.html` if scripts changed.
