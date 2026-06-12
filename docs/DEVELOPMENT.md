# RISQUE / ARTEMIS — Development Guide

**Start here** for current project status, lab setup, and where to look in the codebase.

Last updated: **2026-06-09** (m99 — client cardplay active controls fix).

---

## Reboot checklist (3 laptops)

1. **Host:** run `scripts/SERVER/START-ARTEMIS.bat` — keep server window open.
2. **All browsers:** hard refresh **Ctrl+Shift+R** (must show `?v=m99` in URL).
3. **Clients:** run `JOIN.bat` on laptop 2 and 3 (do not bookmark old URLs).
4. **Lobby:** Ready ×3 → host Start — do **not** re-Start mid-session if stuck.
5. **Stuck?** Tell Cursor: **read diagnostics** (`logs/artemis-last-report.json`).

**Mock harness (default):** `artemisMockPhases=1&artemisMockCardplay=0` — **real cardplay**, **mock income** (+3 troops, CONTINUE). Full real phases: `&artemisMockPhases=0`. Full mock cardplay: add `&artemisMockCardplay=1`.

**Cardplay roulette rig:** `rigCardPlay=2` (Mictor wins) — default in launchers; `rigCardPlay=1` for Guido; `rigCardPlay=random` for fair spin.

---

## Two tracks

| Track | Focus | Primary doc |
|-------|--------|-------------|
| **ARTEMIS** | 3-laptop network multiplayer (active) | This file + [ARTEMIS-DEVLOG.md](ARTEMIS-DEVLOG.md) |
| **Legacy runtime** | Single-machine hot-seat in `game.html` | [HANDOFF.md](HANDOFF.md), [MILESTONES.md](MILESTONES.md) |

ARTEMIS reuses the same phase modules and control panel DOM as hot-seat, but gates interaction by laptop slot and mirrors state through the host.

---

## Where we are now (ARTEMIS)

### Done

| Step | Status | Notes |
|------|--------|-------|
| Lobby (Ready ×3 → host Start) | ✅ | `js/artemis-lobby.js` |
| Per-laptop login (name + color) | ✅ | `js/artemis-login.js`, `phases/login.js` |
| Welcome (~2.2s, mirrored) | ✅ | `js/artemis-setup-flow.js` — phase `welcome`, Control Voice |
| First-card roulette (mirrored) | ✅ | Host runs `phases/player-select.js`; clients mirror flash |
| Deal (mirrored territory pops) | ✅ | Host runs `phases/deal.js`; clients mirror pops |
| Deploy-order roulette | ✅ | Legacy flow after deal (unchanged) |
| Setup deploy handoff basics | ✅ | `artemisControlSlot`, CONFIRM → `player_state`, P3 last player |
| Deploy stale-mirror hardening | ✅ | `artemis-m23-deploy-relinquish` in `js/artemis-net.js` (undocumented in devlog) |

### In progress / next

| Step | Status | Notes |
|------|--------|-------|
| Setup deploy handoff | ✅ | P2→P3 CONFIRM chain + `deploy_finish` bus |
| Card-play order roulette | ✅ | Host runs `playerSelect` `cardPlay`; default rig → Mictor P2 (`rigCardPlay=2`) |
| **Real cardplay** (active client P2) | ⚠️ | m99 fixes mirror clobber + view-class — **retest 3-laptop smoke** |
| Mock income | ⚠️ | +3 troops + CONTINUE — keep until real income rebuilt |
| Turn deploy | ✅ | Host solo validated |
| Attack | ✅ | Restored m96 — user confirmed works very well |
| Reinforce | ⚠️ | Host stuck pre-m98; panel rewrite m98 — retest |
| Real income | ❌ | Still mocked — do not enable until rebuilt |
| Unified control panel | ⚠️ | Spec in [CONTROL-PANEL.md](CONTROL-PANEL.md); 168px voice lock m95; attack/reinforce use native chrome |

### Superseded / dev-only

- **`js/artemis-fast.js`** — dev-only skip welcome/deal (`?artemisFastDeploy=1`).
- **`artemis-skip-cardplay.js`** — removed m77; was auto-bypass to income (replaced by mock CONTINUE flow).

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
| Setup deploy UI | `js/artemis-deploy-panel.js`, `phases/deploy.js` |
| Mock harness | `js/artemis-mock-phases.js`, `js/artemis-cardplay-panel.js`, `js/artemis-income-panel.js` |
| Turn deploy UI | `js/artemis-turn-deploy-panel.js` |
| Attack / reinforce | `js/artemis-attack-panel.js`, `js/artemis-reinforce-panel.js` |
| HUD / control panel | `phases/runtime-hud.js`, `game.css` |
| Shell / mirror | `js/game-shell.js` |
| Shared core | `js/core.js` |
| Fast dev path | `js/artemis-fast.js` |

---

## Cache busting

ARTEMIS scripts in `game.html` use `?v=artemis-mNN-…` query params. **Bump the token** when changing `js/artemis-*.js`, `phases/deploy.js`, or ARTEMIS HUD CSS so all three laptops pick up changes.

Current tokens (as of 2026-06-09): launcher **`?v=m99`**; scripts **`artemis-m99-client-cardplay-fix-2026-06-09`** (see `game.html`).

---

## Latest diagnostics snapshot (2026-06-09)

**Last user session (host solo, pre-m98):** Setup deploy ✅ → real cardplay (SKIP twice to income) → mock income → turn deploy ✅ → attack ✅ → reinforce stuck (addressed m98). BOOK/CONFIRM untested (no cards in hand).

**Next test:** 3-laptop cardplay smoke — Mictor P2 active (`rigCardPlay=2`); spectators Guido + Nooch.

**Benign (historical):** `player_state_dropped_stale` P2 after deploy finish.

**Roster:** GUIDO P1, MICTOR P2, NOOCH P3.

---

## Test protocol (current)

1. Hard refresh all three laptops (`?v=m99`).
2. Lobby → Ready → Start.
3. Each laptop logs in (Guido / Mictor / Nooch + colors).
4. **Expect:** Welcome → first-card roulette → deal → setup deploy → card-play order roulette.
5. **Cardplay smoke (m98):** Mictor wins roulette → real cardplay on P2 only; one SKIP → mock income; spectators see **CARD PLAY-MICTOR**.
6. Optional full path: mock income CONTINUE → turn deploy → attack → reinforce (retest reinforce after m98).
7. Record failures or say **read diagnostics**.

---

## Legacy runtime status

Single-machine `game.html` runtime is canonical (legacy HTML phase pages removed).

| Milestone | Status |
|-----------|--------|
| M1 — Launcher + shell | ✅ Complete |
| M2 — Stabilize cardplay → receivecard | ⚠️ In progress |
| M3 — Full turn loop in shell | 🔜 Pending |

Recent single-machine fixes (attack log format, save sanitizer, load-game regression): [HANDOFF.md](HANDOFF.md).

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
