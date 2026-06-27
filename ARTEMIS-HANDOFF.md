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

- **2026-06-27 m294** — Added ARTEMIS dev reload shortcut: `Ctrl+Shift+L` (`js/game-shell.js`). It ignores text inputs, saves the current host `gameState` when appropriate, stamps ARTEMIS session-resume flags in `sessionStorage`, rebuilds the URL with the live `gameState.phase` (including deploy `kind`), adds an `artemisDevReload=<timestamp>` cache-bust param, and navigates so host/client laptops can reload updated JS/CSS without restarting the game/lobby. Exposed as `window.risqueArtemisDevReload`. Updated top-bar hint and bumped `game-shell.js` cache in `game.html`; hard-refresh once to load m294, then use `Ctrl+Shift+L` for same-phase dev reloads.
- **2026-06-27 m293** — Four changes. (1) Deployment buttons (RESET / +2 / +5 / +10 / ALL / PROTECT-ALL / CONFIRM) ~50% larger for all players: base 14→21px, host HUD row 17→25px, host protect-all 11→16px, deploy-dock base 14→21px, deploy-dock host row 12→18px (`game.css`). (2) Receive-card Control Voice no longer prematurely shows "TOTAL CARDS IN HAND = N" on arrival — the tally is now set *after* the staging-merge flags, so it stays hidden until the card flies up (merge), then reveals via `receiveCardSetMessage("")` in `receiveCardScheduleAdvanceAfterStagingMerge`; observers' CV follows automatically via `risqueControlVoice` mirroring (`phases/receivecard.js`). (3) Observer (Guido/Nooch) receive-card panes now grow into two equal windows like the active player instead of collapsing (`runtime-hud-root--receivecard-panel-only` `.risque-public-receivecard-pane` / `-staging-wrap` → `flex: 1 1 0`, no `margin-top: auto`), which also gives the fly-up a real target window so the card no longer flies into empty space (`game.css`). (4) Campaign attack (instant + step): the FINAL acquired territory no longer auto-locks its troop transfer — `applyBattleRoundAfterRoll` detects the last hop and hands the attacker the normal manual transfer slider (resets campaign planning, re-enables attack chrome); the instant + step run loops detect `campaignFinalManualTransfer` and skip the success banner so CONFIRM resumes normal attack flow (`phases/attack.js`). Q-dev silent runs keep auto leave-1.
- **2026-06-25 m292** — Completes the m291 dice-capture fix. The active client's only attack-live push fired *before* the capture transferred ownership, so spectators never received the post-capture board until the transfer was confirmed. Added a `pushArtemisClientAttackLiveMirror()` right after `attackPhase = 'pending_transfer'` so the server relays the captured territory (attacker-owned, min troops) to host + other clients immediately (`phases/attack.js`).
- **2026-06-25 m291** — Two fixes. (1) Dice attack capture: observers (host + other clients) now see the captured territory flip to the attacker with the minimum auto-moved troops in real time. `applyAttackLiveSpectator` only updated troops of existing territories; it now transfers ownership of the acquired territory, pinned to min troops, with the source pinned to its post-capture snapshot so the attacker's additional-transfer preview stays hidden until CONFIRM (`js/artemis-net.js`). (2) Observer post-cardplay recap shelf opens as balanced 50/50 windows from first paint instead of the lower window opening oversized and resizing mid-animation (`game.css`).
- **2026-06-25 m290** — Receive-card phase (active host + clients): make the two panes ("Cards in hand" / "Received card") grow into equal halves instead of content-sized. Root cause: `runtime-hud-root--receivecard-panel-only` rule used `flex: 0 1 auto !important`, overriding the host's intended equal-split. Now `flex: 1 1 0`, min-height 0, max-height half; continue button keeps its own room below. CSS-only (`game.css`).
- **2026-06-25 m289** — Host cardplay recap shelf: keep upper/lower panes balanced while the upper pane is still empty (card staging). Removes the lower-window ballooning that snapped back to correct proportions once the card flew up. CSS-only (`game.css`).
- **2026-06-10 m288** — Client cardplay CONFIRM: push recap + board/hand to host (`player_state`); host accepts active player by roster name (not stale controlSlot); active client rejects stale mirror that rewinds hand; flush public mirror on recap publish.
- **2026-06-10 m287** — Host deploy when not first in order (e.g. Mictor rig P2 deploys first): fix owner slot conflating turn position with roster slot; Guido gets wheel/confirm on his deploy turn.
- **2026-06-10 m286** — Clients keep fullscreen on phase advances (attack, income, deploy, etc.): ARTEMIS net clients may use same-document soft navigation instead of full page reload.
- **2026-06-10 m281** — Campaign Step on Guido: revert m279 leave-dock split; restore L1/L3 inside CV; drop host 2× button scaling; wire Commit/Begin/Reset onclick; CV min-height 240px. Guido host attack dice timing ~520ms (m280) confirmed good.
- **2026-06-10 m285** — Fix m284 regression: income teardown must not `hidden` entire attack chrome (blitz/campaign toolbar). Restore chrome on attack entry; hide only dice columns off-attack.
- **2026-06-10 m284** — Guido host: tear down attack-spectator dice when phase leaves attack (income/cardplay/deploy); CSS scoped `risque-artemis-attack-spectator` dice to `data-risque-phase="attack"` only.
- **2026-06-10 m283** — Spectator mirror fixes: reinforce CV title-only until source picked (no idle prompt / stale “Next player”); Guido +N reinforce wheel badge; attack transfer confirm flushes map to host/clients immediately; clear stale receive-card/cardplay CV backs during cardplay waiting.
- **2026-06-10 m282** — Cardplay spectator CV: grow when card backs in voice (fix 168px clip after receive-card→cardplay); clear receive-card flyer on cardplay paint. Income CV: remove 50vh cap + overflow-x/y pair (scrollbar bug); panel grows with breakdown.
