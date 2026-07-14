# Archived: Setup roulette rig picker

**Removed in build m349** (2026-07-11).

## What this was
After host START / login success, a modal asked who wins setup roulettes:
True random / Rigged Guido / Mictor / Nooch.

## Files
- `artemis-login-rig-picker.js.snippet` — from `js/artemis-login.js`
- `host-rig-picker.css.snippet` — from `game.css`

## Where it was wired
- `js/artemis-setup-flow.js` called `risqueArtemisShowRigPickerAfterStart`
- Now setup always continues with **fair random** (unless `?rigSetup=` URL)

## Restore
1. Re-insert JS snippet before `applyProfiles` in artemis-login.js
2. Restore CSS into game.css
3. Wire setup-flow to ShowRigPickerAfterStart again
