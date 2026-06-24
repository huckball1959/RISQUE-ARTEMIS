# ARTEMIS — Agent handoff log

Read this before any ARTEMIS networking / three-laptop work.

## Repository locations

| Role | Path |
|------|------|
| **Canonical (edit here)** | `C:\Users\huckb\OneDrive\Documents\GitHub\RISQUE-ARTEMIS` |
| **Backup only** | `X:\github\RISQUE-ARTEMIS` |

Unless the user explicitly says otherwise, **all changes go to OneDrive**. Sync to X: only when asked for backup.

After JS/CSS changes, bump the cache query string in `game.html` (e.g. `artemis-m273-…`) and remind the user to **hard-refresh all three laptops** (Ctrl+Shift+R).

## Test hardware (3 laptops)

| Laptop | Role | Player slot | Notes |
|--------|------|-------------|--------|
| **Guido** | Server / host / map | Player 1 | Runs `artemis-server`; host browser is not a “client laptop” but uses host ARTEMIS mode |
| **Mictor** | Client | Player 2 | |
| **Nooch** | Client | Player 3 | |

## Rig / defaults

- **Guido is rigged to win player selection** for now, unless the user specifies otherwise.
- Do not commit or push unless the user asks.
- Typical flow: Guido hosts → Mictor + Nooch connect as clients → lobby → playtest cycle (deploy → attack → reinforce → cardplay → income → receive card, etc.).

## UI conventions (ARTEMIS)

- **Active player** on their laptop: full phase UI (deploy panel, attack chrome, cardplay two-pane, receive-card hand + staging).
- **Spectators** (other laptops + Guido when not active): mirrored map + control voice; card backs only (never opponent card faces in CV).
- **Receive card**: dual-pane layout (hand above, staging below); staging pane should sit near the canvas foot with **30px bottom buffer** on the HUD column.
- **Guido attack dice**: when a client attacks, Guido should see live dice animation via `attack_live` / `risqueArtemisApplyHostAttackSpectator` — not local roll controls.

## Key files (quick index)

- `game.html` — script cache busting
- `js/artemis-net.js` — WebSocket, `attack_live`, `player_state`, mirror
- `js/artemis-play.js` — omni HUD, login suppression, my-turn classes
- `js/artemis-receive-card-panel.js` — receive-card mount / spectator HUD
- `js/artemis-attack-panel.js` — host attack spectator + client attack mount
- `js/game-shell.js` — public voice mirror, soft nav, receive-card CV
- `phases/reinforce.js` — reinforce compact HUD + confirm gating
- `phases/runtime-hud.js` — HUD column position (`syncPosition`)
- `game.css` — receive-card pane fill, attack spectator dice visibility

## Changelog (agents append brief notes)

- **2026-06-10 m281** — Campaign Step on Guido: revert m279 leave-dock split; restore L1/L3 inside CV; drop host 2× button scaling; wire Commit/Begin/Reset onclick; CV min-height 240px. Guido host attack dice timing ~520ms (m280) confirmed good.
- **2026-06-10 m285** — Fix m284 regression: income teardown must not `hidden` entire attack chrome (blitz/campaign toolbar). Restore chrome on attack entry; hide only dice columns off-attack.
- **2026-06-10 m284** — Guido host: tear down attack-spectator dice when phase leaves attack (income/cardplay/deploy); CSS scoped `risque-artemis-attack-spectator` dice to `data-risque-phase="attack"` only.
- **2026-06-10 m283** — Spectator mirror fixes: reinforce CV title-only until source picked (no idle prompt / stale “Next player”); Guido +N reinforce wheel badge; attack transfer confirm flushes map to host/clients immediately; clear stale receive-card/cardplay CV backs during cardplay waiting.
- **2026-06-10 m282** — Cardplay spectator CV: grow when card backs in voice (fix 168px clip after receive-card→cardplay); clear receive-card flyer on cardplay paint. Income CV: remove 50vh cap + overflow-x/y pair (scrollbar bug); panel grows with breakdown.
