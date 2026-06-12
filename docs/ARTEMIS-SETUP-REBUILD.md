# ARTEMIS setup rebuild — sequential plan

**Launcher:** `scripts\SERVER\START-ARTEMIS.bat` (not `START-ARTEMIS-PRESET.bat`)

**Goal:** Rebuild network multiplayer setup the same way hot-seat works — one phase at a time — then diff legacy deploy vs a new simple deploy when both are stable.

---

## Why hot-seat worked but 3-laptop did not

Hot-seat uses one `gameState`, one screen, no mirror lag, no `player_state` echoes, no control-slot handoff. ARTEMIS adds:

- Host authoritative state + `public_state` mirror to clients
- Per-laptop control (`artemisControlSlot`) only on the active player
- Soft navigation on `game.html` (no full reload)
- Race: mirror push vs client push vs localStorage vs shell `state`

We debug each setup step with **console milestones** (`M0` … `M3`) before touching deploy handoff again.

---

## Phases (build in order)

| Step | Milestone | Host runs | Clients see |
|------|-----------|-----------|-------------|
| 0 | `M0-login-ok` | Fast-boot login, roster commit | Login mirror |
| 1 | `M1-welcome` | Welcome ~2.2s (`artemis-setup-flow.js`) | Welcome mirror |
| 2 | `M2-firstCard-*` | First-card roulette (`player-select.js`) | Name flash via mirror |
| 3 | `M3-deal-*` | Territory deal animation (`deal.js`) | Territory pops via mirror |
| 4 | *(next)* | Deploy-order roulette | Mirror |
| 5 | *(new)* | **Setup-deploy v2** — minimal CONFIRM cycle | Active laptop only |
| 6 | *(later)* | Diff v2 vs `firstdeploy.js` / `artemis-deploy-panel.js` | — |

First-card roulette stays for all player counts (2, 3, 6) even though rules only require it for 4–5.

---

## Test procedure (phase 1–3)

1. Host: `START-ARTEMIS.bat`
2. Laptops 2/3: `JOIN.bat` → hard refresh (Ctrl+Shift+R)
3. Wait for auto login (fast boot)
4. **Host console** should show in order:
   - `M0-login-ok`
   - `M1-welcome`
   - `M2-firstCard-roulette-start` → `M2-firstCard-winner`
   - `M3-deal-start`
5. **Client consoles** should show matching `M1-welcome-mirror`, `M2-firstCard-mirror`, `M3-deal-mirror`

If a milestone is missing on a client, the break is in **mirror sync** for that phase — not deploy yet.

---

## Dev shortcuts (off by default)

| URL flag | Effect |
|----------|--------|
| `artemisPreset=guidoR2Cardplay` | Skip setup — mid-game cardplay (separate launcher) |
| `artemisFastDeploy=1` | Skip welcome/deal — instant deploy (`artemis-fast.js`) |
| `rigDeploy=random` | Disable ARTEMIS deploy-order rig (default: **Guido / slot 1** deploys first) |

Normal sequential path uses neither preset nor fast-deploy flags.

---

## Setup-deploy v2 (not started)

When deal is stable on 3 laptops:

1. Add `js/artemis-setup-deploy-v2.js` — one territory tap, one CONFIRM, host-only handoff
2. Run full Guido → Mictor → Nooch cycle with v2 only
3. Diff against legacy setup deploy; keep what works, delete what does not

If the diff does not explain failures, ship v2 for setup and revisit legacy deploy only for turn deploy.
