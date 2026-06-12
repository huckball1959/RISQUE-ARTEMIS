# ARTEMIS Development Log

Living record for **network multiplayer** (3 Windows laptops). Future agents: read this before changing login, HUD, turn routing, or phase flow.

**Related docs**

| Doc | Purpose |
|-----|---------|
| [CONTROL-PANEL.md](CONTROL-PANEL.md) | Unified control panel geometry, layout stack, toggles, Control Voice |
| [POST-LOGIN-FLOW.md](POST-LOGIN-FLOW.md) | Step 1 — what every laptop sees after login (target vs current) |
| [HANDOFF.md](HANDOFF.md) | Legacy single-machine / hot-seat handoff |
| [../artemis-probe/](../artemis-probe/) | Turn-routing probe (must keep working) |

---

## Lab topology (default)

| Laptop | Role | Slot | Test player | Color |
|--------|------|------|-------------|-------|
| 1 | Server + host + browser | P1 | Guido | Blue |
| 2 | Client browser | P2 | Mictor | Red |
| 3 | Client browser | P3 | Nooch | Yellow |

- **Server:** Node in `artemis-server/` (port **5700**).
- **Launch:** `scripts/SERVER/START-ARTEMIS.bat` (host), `scripts/LAPTOP 2/JOIN.bat`, `scripts/LAPTOP 3/JOIN.bat`.
- **Cache bust:** Launcher uses `?v=m99`; ARTEMIS scripts in `game.html` use `?v=artemis-m99-client-cardplay-fix-2026-06-09` — bump when changing mock harness, panels, or sync code.

Unless specified otherwise, **all network development assumes this 3-laptop layout**.

---

## Hot-seat → network: design intent

The original game was **one machine, pass-the-laptop** (hot seat). ARTEMIS **reuses the same phase modules and control panel DOM** but changes:

1. **Who may interact** — only the laptop whose player is “up” gets phase controls (see `artemisControlSlot`).
2. **What is mirrored** — host publishes `public_state`; clients apply via `risquePublicMirrorGameState`.
3. **Who mutates state** — active client pushes `player_state` to host; host is authoritative.
4. **Unified control panel** — same right-column HUD on all laptops; host-only map tools stay on the **board** (left column), not in the panel.

Do **not** reintroduce hot-seat overlays (“hand the tablet to…”) in ARTEMIS mode — see `mountSetupDeployHandoff` in `phases/deploy.js`.

---

## Player cycle (in-turn order)

After setup completes, each turn cycles:

**Cardplay → Income → Deployment → Attack → Reinforcement → Receive card**

Setup (once per game) is separate: **login → welcome → first-card roulette → deal → setup deployment → card-play order roulette →** enter Cardplay cycle.

Phase modules: `phases/cardplay.js`, `income.js`, `deploy.js`, `attack.js`, `reinforce.js`, `receivecard.js`.

---

## Control panel (summary)

Full spec: [CONTROL-PANEL.md](CONTROL-PANEL.md).

- Canvas **1920×1080**; control panel **x = 1081…1920** (839px wide), full height.
- **30px** safe margin assumed for background frame on all sides.
- Vertical stack: **RISQUE title → four toggles → phase line → Control Voice → phase controls → combat log** (attack only).
- **Network toggles (only):** STATS, CARDS PLAYED, LUCKY, CARDS IN HAND — drop TV CURS and other host/TV-only affordances from the unified panel.
- **Control Voice** (`#control-voice`, `#control-voice-text`, `#control-voice-report`): universal prompt; phase modules write here via `risqueRuntimeHud.setControlVoiceText`.

Implementation today: `phases/runtime-hud.js` + `game.css` (`.runtime-hud-root`, `.ucp-*`).

---

## Turn routing (do not break)

| Mechanism | File | Role |
|-----------|------|------|
| `artemisControlSlot` | mirrored `gameState` | Which slot (1–3) owns controls |
| `risqueArtemisControlSeq` | mirrored `gameState` | Monotonic handoff counter; rejects stale `player_state` |
| `artemisDeployTurnAdvance` | ephemeral on CONFIRM push | Lets host accept handoff from previous slot |
| Setup deploy handoff | `js/artemis-deploy-panel.js` | Mount/teardown setup deploy UI per laptop |
| Mock cardplay/income | `js/artemis-mock-phases.js` | Dev harness — **split flags** (m97): real cardplay + mock income default |
| Mock panels | `js/artemis-cardplay-panel.js`, `js/artemis-income-panel.js` | Route to mock dock vs real phase mount |
| Portable attack | `js/artemis-attack-panel.js` | Active laptop full attack mount; spectators non-interactive HUD (m96) |
| Portable reinforce | `js/artemis-reinforce-panel.js` | Same pattern as attack panel (m98) |
| Turn deploy | `js/artemis-turn-deploy-panel.js` | Per-laptop turn deploy controls |
| `risqueArtemisIsMyTurn` | `js/artemis-play.js` | **Prefer `artemisControlSlot`**, not name fallbacks |
| `applyHostClientState` | `js/artemis-net.js` | Host applies client edits + mirror |

**Probe regression:** `artemis-probe/probe.html` must still pass turn-click tests.

---

## Log entries

### 2026-06-09 — Client cardplay active controls (m99)

**Symptoms (3-laptop smoke, Mictor P2 active):** Active client saw mock “(mock)” hint text but **no SKIP**; Nooch had **no control voice**; client **toggles inert**; Guido host looked correct.

**Root causes**

1. `risqueArtemisClientShouldApplyPublicMirror` treated **mock income** (`UseMockPhases`) as “always mirror cardplay” — public mirror overwrote Mictor’s real cardplay mount every tick.
2. `artemisStampOmniHudDocumentClasses` re-applied `risque-view-public` on every sync, undoing `enterClientPlayMode()` — public-TV CSS hid toolbar buttons.
3. Clients missing `data-risque-phase` on `<body>` — ARTEMIS cardplay CSS overrides did not apply (Nooch `#hud-main-panel` hidden).

**Fixes**

| Piece | File | Behavior |
|-------|------|----------|
| Split mirror gate | `js/game-shell.js` | Mock mirror only when `UseMockCardplay` / `UseMockIncome` for that phase — not blanket `UseMockPhases` |
| Active client mirror | same | When `ClientPlaying` + owns cardplay slot, reject public mirror |
| Post-mirror ARTEMIS sync | same | After public mirror apply, call `risqueArtemisSyncFromState` for portable phases |
| View class stickiness | `js/artemis-play.js` | Preserve `risque-view-host` while `ClientPlaying`; stamp `data-risque-phase` |
| Cardplay remount | `js/artemis-cardplay-panel.js` | After mount, sync my-turn class + phase control voice |
| CSS | `game.css` | Show cardplay toolbar on active client; force control voice + main panel on ARTEMIS client spectators |

**Cache bust:** launcher `?v=m99`; scripts `artemis-m99-client-cardplay-fix-2026-06-09`.

---

### 2026-06-09 — Client cardplay smoke prep (m98)

**Context:** Host-only pass (Guido P1) validated mock income → turn deploy → attack → reinforce. Cardplay needed **two SKIP taps** to reach income; reinforce was stuck on host; next milestone is **3-laptop client cardplay** with Mictor (P2) as roulette winner.

**Implemented**

| Piece | File | Behavior |
|-------|------|----------|
| SKIP once → income | `phases/cardplay.js` | Tear down cardplay UI before deferred nav; **always** call `risqueArtemisSyncFromState` after skip (not only when soft-nav fails); recovery if phase already `income` |
| Roulette rig P2 | `js/artemis-net.js`, launchers | Default `rigCardPlay=2` (Mictor); `rigCardPlay=1` for Guido; `rigCardPlay=random` for fair roulette; param preserved in `risqueArtemisAppendSessionParams` |
| Reinforce restore | `js/artemis-reinforce-panel.js` | Mirrors m96 attack panel: strip setup HUD classes, `data-risque-phase=reinforce`, soft-nav mount, teardown prior portable phases, spectator vs active paths |

**Cache bust:** launcher `?v=m98`; scripts `artemis-m98-client-cardplay-2026-06-09` (`cardplay.js`, `artemis-net.js`, `artemis-reinforce-panel.js`, panels).

**Test protocol (next — 3-laptop cardplay smoke)**

1. Restart server; hard-refresh all laptops (`?v=m98`).
2. Full setup deploy → card-play order roulette → **Mictor wins** (`rigCardPlay=2`).
3. **Mictor (P2):** real CARD/BOOK/SKIP/CONFIRM; **one SKIP** → mock income (+3) → CONTINUE optional for this pass.
4. **Guido + Nooch:** phase title **CARD PLAY-MICTOR**, control voice, omni toggles — no mock SKIP dock.
5. Optional: rerun with `rigCardPlay=1` to confirm host-as-active cardplay on all three screens.

**Diagnostics:** `cardplay_skip_income`, `cardplay_controls_ok`, `mock_income_continue`; say **read diagnostics** if stuck.

---

### 2026-06-09 — Real cardplay reintroduction (m97)

**Context:** Attack path verified on m96. User asked to **re-introduce real cardplay** while keeping mock income for stability.

**Implemented**

| Piece | File | Behavior |
|-------|------|----------|
| Split mock flags | `js/artemis-mock-phases.js` | `risqueArtemisUseMockCardplay()`, `risqueArtemisUseMockIncome()`; legacy `artemisMockPhases=1\|0` still toggles both when granular flags unset |
| Launchers | `START-ARTEMIS.bat`, `JOIN.bat` | `artemisMockPhases=1&artemisMockCardplay=0` — **real cardplay, mock income** |
| Shell routing | `js/game-shell.js` | Mock cardplay gate uses `UseMockCardplay` only (not blanket mock); income mount uses `UseMockIncome` |
| Session params | `js/artemis-net.js` | Persist/propagate `artemisMockCardplay`, `artemisMockIncome`; host accepts cardplay→income from active player even when only income is mocked |

**Host solo retest (pre-m98):** Setup deploy ✅, turn deploy ✅, attack ✅, reinforce stuck (fixed m98), cardplay SKIP twice (fixed m98), no cards in hand (BOOK/CONFIRM untested).

**Cache bust:** launcher `?v=m97`; scripts `artemis-m97-cardplay-restore-2026-06-09`.

---

### 2026-06-09 — Attack phase restore (m96)

**Context:** After ARTEMIS HUD work, attack became a “butchered mess” — phase mounted then setup HUD clobbered attack chrome.

**Root cause:** `risqueArtemisEnsureOmniClientHud` forced setup HUD on attack; generic control voice overwrote attack voice; 168px compact CSS squashed attack layout.

**Implemented**

| Piece | File | Behavior |
|-------|------|----------|
| Portable attack | `js/artemis-attack-panel.js` | `risqueArtemisSyncPortableAttack` — active laptop full `attack.mount`; spectators get `runtimeHud.ensure()` non-interactive |
| HUD guard | `js/artemis-play.js` | `artemisUsesAttackHudLayout()` — skip setup HUD for attack/reinforce/receivecard |
| Runtime HUD | `phases/runtime-hud.js` | Skip generic phase voice on attack/reinforce/receivecard |
| CSS | `game.css` | Compact 168px voice excludes attack/reinforce phases |

**User confirmed:** attack works very well on m96.

**Cache bust:** `artemis-m96-attack-restore-2026-06-09`.

---

### 2026-06-09 — HUD, cardplay chrome, mock flow (m94–m95)

**Implemented**

| Piece | File | Behavior |
|-------|------|----------|
| Host deploy spectator voice | `js/artemis-deploy-panel.js`, `js/game-shell.js` | Live narration on host when spectating P2/P3 setup deploy (was stuck on “WAITING FOR …”) |
| Control voice size | `game.css`, `js/artemis-play.js` | Lock ARTEMIS control voice to **168px** (except attack/reinforce native chrome) |
| Client cardplay HUD | `game.css`, `phases/runtime-hud.js` | `#hud-main-panel` visible on clients during cardplay; phase title **CARD PLAY-{NAME}** |
| Mock CONTINUE dedupe | `js/artemis-mock-phases.js` | SKIP only in mock dock — removed stray fixed CONTINUE row |
| Host setup deploy clicks | `js/core.js` | `setupDeployActive` guard — Guido first territory no longer needs 2–3 clicks |

**Cache bust:** m94–m95 tokens on deploy-panel, play, runtime-hud, game.css.

---

### 2026-06-09 — Mock cardplay/income harness (m77–m78); real phases sidelined

**Context:** Real `phases/cardplay.js` and `phases/income.js` caused host freezes, missing client controls, and phase/banner desync (e.g. “MICTOR-CARDPLAY” banner while shell showed attack). Strategy: **stub turn loop with mock UI** until deploy → attack is stable, then rebuild real cardplay/income from scratch.

**Implemented**

| Piece | File | Behavior |
|-------|------|----------|
| Mock harness flag | `js/artemis-mock-phases.js` | `?artemisMockPhases=1` (default ON for host via `START-ARTEMIS.bat`); disable with `&artemisMockPhases=0` |
| Mock cardplay | same | “No cards in hand” + **CONTINUE** → sets `phase: income`, clears cardplay mirror fields, soft-nav + mirror |
| Mock income | same | Fixed **+3 troops** + **CONTINUE** → `bankValue=3`, `phase: deploy`, `risqueMirrorDeployRoute: turn` |
| Persistent dock | same | Controls in `#risque-artemis-mock-dock` (not `#risque-phase-content`) so mirror churn does not wipe buttons |
| Panel routing | `js/artemis-cardplay-panel.js`, `js/artemis-income-panel.js` | Skip real phase `.mount()` when mock flag on |
| Shell guard | `js/game-shell.js` | Skip heavy `cardplay.mount` / `income.mount` in mock mode; permissive client mirror apply for cardplay/income |
| Phase chrome | `js/artemis-play.js` | `risqueArtemisSyncMockPhaseChrome` on sync; teardown mock when leaving cardplay/income; income in `isMyTurn` ctrl path |
| Watchdog | `js/artemis-mock-phases.js` | 450ms retry + diag `mock_cardplay_controls_ok` / `mock_cardplay_controls_missing` |

**Removed:** `js/artemis-skip-cardplay.js` (auto-bypass straight to income — replaced by mock cardplay with explicit CONTINUE).

**Cache bust:** launcher `?v=m78`; scripts `artemis-m78-mock-dock-sync-2026-06-09`.

**Known issues (pre-m78, may persist until retest)**

- Active client (e.g. Mictor P2) sometimes got **no CONTINUE** — mock UI was in `#risque-phase-content` and mirror blocked updates after `risqueArtemisClientPlaying` without controls mounted.
- **Banner vs phase mismatch** — HUD showed cardplay suffix while `gameState.phase` had advanced (attack/deploy).
- Real income on host still **unresponsive without clicking** if mock flag off — do not disable mock until real phases rebuilt.

**Diagnostics to watch after reboot**

| Event | Meaning |
|-------|---------|
| `deploy_finish_ok` | Setup deploy done → card-play order roulette next |
| `mock_cardplay_controls_ok` | Active laptop has CONTINUE in mock dock |
| `mock_cardplay_controls_missing` | Active laptop failed mount — tell Cursor “read diagnostics” |
| `mock_cardplay_continue` / `mock_income_continue` | Mock phase handoff fired |
| `player_state_dropped_stale` P2 after deploy finish | Benign — late echo after seq advanced |

**Test protocol (post-reboot)**

1. Restart server (`START-ARTEMIS.bat`); hard-refresh all laptops (**Ctrl+Shift+R**, `?v=m78`).
2. Full sequential setup through setup deploy (unchanged — still solid in logs).
3. Card-play order roulette → **mock cardplay** on winner’s laptop only; others “Waiting for …”.
4. CONTINUE → mock income (+3) → CONTINUE → turn deploy → **attack** (known-good path).
5. If stuck: **“read diagnostics”** — do not mid-session Start on host.

---

### 2026-06-08 — Cardplay bypass attempt (m76); superseded by mock harness

**Implemented:** `artemis-skip-cardplay.js` jumped player-select `cardPlay` winner straight to income (no cardplay UI). Host income still froze on load; user redirected to mock-phase strategy (m77+).

**Cache bust:** `?v=m76` — replaced by m78.

---

### 2026-06-06 — Sequential setup after login (welcome → first card → deal)

**Implemented:** Removed fast-start skip from login. Host now runs:

1. **Welcome** (~2.2s) — phase `welcome`, Control Voice “WELCOME TO RISQUE”, mirrored to all laptops.
2. **First-card roulette** — existing `player-select.js` on **host only**; clients mirror `risquePublicPlayerSelectFlash` in Control Voice.
3. **Deal** — existing `deal.js` on **host only**; clients mirror `risquePublicDealPopTerritory` territory pop-ins.

**Files:** `js/artemis-setup-flow.js`, `js/artemis-login.js`, `js/artemis-net.js`, `phases/player-select.js`, `phases/deal.js`, `phases/runtime-hud.js`, `js/game-shell.js` (welcome in setup HUD).

**Cache bust:** `artemis-m17-setup-flow-2026-06-06`

**Note:** `js/artemis-fast.js` remains for dev but is no longer called from login. After deal, legacy flow still advances to **deploy-order** roulette (next slice).

---

**Context:** Setup deploy handoff stabilized (P3 last player, CONFIRM `artemisDeployTurnAdvance` strip bug). User asked to pause feature churn and **define the unified control panel** and **document post-login flow** for sequential network redesign.

**Decisions recorded**

1. Unified control panel for all players; host uniqueness limited to **map-area** tools (`#risque-board-corner-tools`, etc.).
2. Four toggles only in network builds.
3. Work **sequentially** starting with **after login** — see [POST-LOGIN-FLOW.md](POST-LOGIN-FLOW.md).
4. Fast-start shortcut (`risqueArtemisFastStartToDeploy`) is **dev convenience only** — not the target player-facing flow.

**Current vs target (login → gameplay)**

| Step | Target (player-facing) | Current ARTEMIS code |
|------|--------------------------|----------------------|
| Connect | Lobby: Ready ×3, host Start | ✅ `js/artemis-lobby.js` |
| Identity | Each laptop: name + color | ✅ `js/artemis-login.js` |
| Welcome | Synchronized welcome / “game beginning” | ⚠️ Partial — login fade only |
| First card | `playerSelect` `firstCard` roulette, mirrored | ❌ Skipped — fast-start → deploy |
| Deal | Deal animation / territories | ❌ Skipped — `instantDeal` in `js/artemis-fast.js` |
| Setup deploy | Per-laptop deploy controls | ✅ In progress (`artemis-deploy-panel.js`) |
| Card-play order | `playerSelect` `cardPlay` roulette | ❌ Skipped |
| Turn loop | Cardplay → … | 🔜 Not wired for network turn routing yet |

**Next implementation slice (when coding resumes):** Replace fast-start with mirrored setup chain; keep `artemisControlSlot` pattern for any phase that needs local controls.

---

### 2026-06-06 — Setup deploy handoff fixes (reference)

- Client CONFIRM must send `artemisDeployTurnAdvance` **before** bumping `window.gameState` locally (`phases/deploy.js`, `js/artemis-play.js`).
- Last setup deployer: `isSetupDeploy` must not require `banks > 1` (`js/artemis-deploy-panel.js`).
- Banner should follow `artemisControlSlot`, not flickering `currentPlayer` (`phases/runtime-hud.js`).

---

## Files agents touch most (ARTEMIS)

| Area | Files |
|------|--------|
| Network | `js/artemis-net.js`, `artemis-server/server.js` |
| Lobby / login | `js/artemis-lobby.js`, `js/artemis-login.js`, `phases/login.js` |
| Turn / identity | `js/artemis-play.js` |
| Setup deploy UI | `js/artemis-deploy-panel.js`, `phases/deploy.js` |
| Turn deploy UI | `js/artemis-turn-deploy-panel.js` |
| Cardplay / income panels | `js/artemis-cardplay-panel.js`, `js/artemis-income-panel.js` |
| Attack / reinforce panels | `js/artemis-attack-panel.js`, `js/artemis-reinforce-panel.js` |
| Mock harness | `js/artemis-mock-phases.js` |
| HUD / control panel | `phases/runtime-hud.js`, `game.css` |
| Shell / mirror | `js/game-shell.js` |
| Fast dev path | `js/artemis-fast.js` |

---

## How to append to this log

Add a dated `### YYYY-MM-DD — Title` section under **Log entries** with:

- What changed and **why**
- Target vs current table if UX flow shifted
- Known bugs / test protocol
- Cache-bust token if scripts changed
