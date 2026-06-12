# Unified Control Panel (ARTEMIS)

Specification for the **right-column control panel** shared by all three laptops in network play. Hot-seat had one panel passed between players; ARTEMIS shows the **same panel chrome** on every machine, with **phase controls active only on the laptop that owns the turn**.

---

## Coordinate system

| Item | Value |
|------|--------|
| Canvas (stage) | **1920 × 1080** px |
| Map / board region | **x = 0…1080** (left column; includes ~30px frame buffer) |
| Control panel region | **x = 1081…1920**, **y = 0…1080** |
| Panel content width | **839px** (1920 − 1081) |
| Safe inset | **30px** margin from panel edges for background artwork |

The panel is implemented as `#runtime-hud-root` inside `#ui-overlay`, positioned over the right column. CSS lives primarily in `game.css` (`.runtime-hud-root`, `.ucp-*`, `.hud-title-stack`).

---

## Vertical layout (top → bottom)

All players see the same structure. Only **contents** of Control Voice and phase slots change.

```
┌─────────────────────────────────────┐  ← y ≈ 0 (+ 30px safe)
│            RISQUE                   │  centered game title (#hud-banner-game-title)
├─────────────────────────────────────┤
│ STATS │ CARDS PLAYED │ LUCKY │ HAND │  four toggles, equal width, host styling
├─────────────────────────────────────┤
│         NOOCH-DEPLOYMENT            │  phase line (#attack-player-name)
├─────────────────────────────────────┤
│                                     │
│         CONTROL VOICE               │  #control-voice / #control-voice-text
│         (primary prompt)            │  #control-voice-report (secondary)
│                                     │
├─────────────────────────────────────┤
│      Phase-specific controls        │  #risque-phase-content, #ucp-slot-strip,
│      (buttons, bank, CONFIRM, …)    │  deploy dock, attack toolbar, etc.
├─────────────────────────────────────┤
│      Combat log (attack only)       │  #log-text
└─────────────────────────────────────┘  ← y = 1080 (− 30px safe)
```

### 1. Game title

- Text: **RISQUE** (setup and most phases); special cases (e.g. card-processing) documented per phase.
- Same font treatment on host and clients.
- **Not** the player name — player + phase live on the line below.

### 2. Toggle row (network only)

| Toggle | ID | Purpose |
|--------|-----|---------|
| STATS | `#risque-private-stats-toggle` | Enlarge stats table in panel |
| CARDS PLAYED | `#risque-host-cards-played-toggle` | Territory cards cashed this game |
| LUCKY | `#risque-host-lucky-toggle` | Dice / battle luck stats |
| CARDS IN HAND | `#risque-host-cards-in-hand-toggle` | Current **active** player's hand |

**Remove from network builds:** `#risque-host-tv-cursor-toggle` (TV CURS) and any other TV-only or hot-seat-only chrome in the toggle row.

Styling reference: `game.css` — `.risque-host-topbar-btn`, ARTEMIS override block `html.risque-artemis-* .risque-host-topbar-btn` (font `clamp(14.5px, 1.35vw, 17px)`, green buttons).

Toggles are **private panel views** — they do not change game state; they may be used on **any** laptop at any time.

### 3. Phase line

- Format: `{PLAYER}-{PHASE}` e.g. `NOOCH-DEPLOYMENT`, `MICTOR-ATTACK`.
- Player color on phase text; CSS class `.hud-turn-banner--player-phase`.
- In ARTEMIS, prefer **`artemisControlSlot`** to resolve display name when `currentPlayer` and slot briefly disagree (`phases/runtime-hud.js` `updateTurnBannerFromState`).

### 4. Control Voice

Universal prompt window — the “narrator” of the control panel.

| Element | ID | Role |
|---------|-----|------|
| Container | `#control-voice` | Terminal-style box |
| Primary | `#control-voice-text` | Main instruction (large) |
| Secondary | `#control-voice-report` | Cycling name, warnings, income grid, etc. |
| API | `risqueRuntimeHud.setControlVoiceText(primary, report)` | Phase modules set copy |

Examples:

- Setup roulette: “SELECTING WHO GETS THE FIRST CARD” + cycling name in report/primary.
- Deploy: “DEPLOY ALL TROOPS FROM YOUR BANK” + bank remaining.
- Attack: prompts from `phases/attack.js` (sanitized on mirror clients).

Spectators see the same voice text as everyone else; only **buttons** are restricted.

### 5. Phase-specific controls

Mounted in `#risque-phase-content` and/or `#risque-artemis-deploy-dock` (setup deploy). Existing implementations:

| Phase | Module | Typical controls |
|-------|--------|------------------|
| Setup deploy | `phases/deploy.js` `runSetup` | Bank, RESET, +2/+5/+10/ALL, CONFIRM |
| Turn deploy | `deploy.js` `runTurn` | Same pattern, one player |
| Attack | `phases/attack.js` | Dice, blitz, step, END ATTACK |
| Reinforce | `phases/reinforce.js` | Transfer, confirm |
| Cardplay | `phases/cardplay.js` | Card UI in panel |
| Income | `phases/income.js` | Spreadsheet in voice + continue |
| Receive card | `phases/receivecard.js` | Draw / confirm |

**Network rule:** Mount interactive controls only when `risqueArtemisIsMyTurn(gameState)` (or phase-specific equivalent). Others see Control Voice + phase line + “waiting” copy.

### 6. Combat log

- `#log-text` — attack phase only; hidden in setup CSS (`.runtime-hud-root--setup #log-text`).

---

## Host-only: map area (not in control panel)

These stay on the **left/board** side for laptop 1 only:

- `#risque-board-corner-tools` (load/save, dev shortcuts, etc.)
- Map interaction (territory clicks) when local play is allowed

Do **not** duplicate these in the unified panel on clients.

---

## CSS / HUD modes

| Class / flag | Meaning |
|--------------|---------|
| `.runtime-hud-root--login` | Login / welcome layout |
| `.runtime-hud-root--setup` | Deal, player-select, setup deploy — hides attack chrome & combat log |
| `html.risque-artemis-setup-deploy` | ARTEMIS setup deploy dock visible |
| `html.risque-view-host` vs `risque-view-public` | Client “play mode” vs spectator mirror mode |
| `body[data-risque-phase="…"]` | Phase-specific strip visibility |

---

## Setup vs player cycle

**Setup (once):** login → welcome → first-card select → deal → setup deployment → card-play order select.

**Player cycle (repeats):** Cardplay → Income → Deployment → Attack → Reinforcement → Receive card.

Setup may use simplified HUD (`.runtime-hud-root--setup`) but **same title + toggle + phase line + voice** stack.

---

## Implementation checklist (network HUD)

- [ ] Hide TV CURS toggle when `risqueArtemisMode`
- [ ] Same toggle row HTML on host + clients (`risqueWireArtemisHudTogglesOnce`)
- [ ] Phase line from mirrored state on all machines
- [ ] Control Voice driven by mirror (`risqueControlVoice` on `gameState` where needed)
- [ ] Per-phase mount gated by `artemisControlSlot`
- [ ] Document each phase’s spectator copy in POST-LOGIN / phase-specific devlog entries
