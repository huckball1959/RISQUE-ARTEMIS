# Archived: Host test launcher (m306–m330)

**Removed in build m346** (2026-07-11). Restored for future agents if the START test menu is needed again.

## What this was

After Guido clicked map **START**, a modal intercepted normal login/setup with four modes:

1. **Normal play** — full setup, fair random
2. **Rigged** — full setup, pick who wins selection
3. **Load mock game** — `cards.json` round-4 cardplay; pick who starts
4. **Conquer test** — conquer-* attack/cardplay saves; pick chain + entry

## Files in this archive

| File | Contents |
|------|----------|
| `artemis-login-host-launcher.js.snippet` | Full launcher block from `js/artemis-login.js` (was ~lines 1066–1467): state, UI, `commitHostLauncherChoices`, `risqueArtemisShowHostTestLauncher`, etc. |
| `host-launcher.css.snippet` | `game.css` rules for `.risque-artemis-host-launcher*` + wayback badge hide |
| `host-launcher-subheading.css.snippet` | Extra `.risque-artemis-host-launcher-subheading` rule |
| `START-ARTEMIS.bat.pre-m346` | Batch that wrote `cardplay-test` to `active-mode.txt` (forced mock join URLs) |
| `tryHostStartGame-intercept-notes.txt` | Notes on START → menu intercept points |

## Where it lived (live tree)

- `js/artemis-login.js` — overlay + `tryHostStartGame` → `ShowHostTestLauncher`
- `game.css` — `.risque-artemis-host-launcher*` (~12076–12280) + subheading (~15251)
- `scripts/SERVER/START-ARTEMIS.bat` — `(echo cardplay-test)> launchers\active-mode.txt`

## Related code NOT removed (still in repo)

These are separate systems; keep unless you explicitly want them gone:

- **Welcome rig picker** (`#risque-artemis-rig-picker`) — normal post-welcome UI
- **`?rigSetup=`** URL rig (`game.html` / `artemis-net.js`)
- **`js/artemis-auto-save.js`** + `cards.json` / `conquer-*.json` — still load if URL has `?artemisAutoSave=`
- **`launchers/profiles.json`** `cardplay-test` modeMap — use via a dedicated batch if testing mocks
- **`phases/cardplay.js`** `cardplayRecoveryRedirect` mock guard

## How to restore (outline)

1. Re-insert `artemis-login-host-launcher.js.snippet` into `js/artemis-login.js` before the rig-picker block (`var rigPickerOverlay`).
2. Wire `tryHostStartGame` again: open launcher with `launchWithChoices` as continuation (see m307/m310 — capture continue fn **before** hide).
3. Restore CSS snippets into `game.css`.
4. Optionally restore `cardplay-test` default in `START-ARTEMIS.bat`, or add `START-CARDPLAY-TEST.bat`.
5. Bump `game.html` cache + note in `ARTEMIS-HANDOFF.md`.

## Normal START path after m346

```
Lobby 3/3 → host START
  → risqueArtemisBeatHostGateBeforeStart()
  → commitArtemisRoster()
  → risqueArtemisBeginSetupAfterLogin()
       → welcome → rig picker (unless ?rigSetup=) → roulettes → deal
```

`START-ARTEMIS.bat` writes `normal` to `launchers/active-mode.txt`.
