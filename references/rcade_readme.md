# RCade README (snapshot 2026-05-12)

Source: https://github.com/fcjr/RCade/blob/main/README.md

---

**Build games. Push to GitHub. Play on a real arcade machine.**

RCade is a custom-built arcade cabinet at The Recurse Center that runs games made by the community. This repo contains everything you need to create, deploy, and play your own arcade games.

---

## Create Your First Game in 60 Seconds

```bash
npm create rcade@latest
```

---

## Using Arcade Controls

### Classic Controls (`@rcade/plugin-input-classic`)

```javascript
import { PLAYER_1, PLAYER_2, SYSTEM } from "@rcade/plugin-input-classic";

if (PLAYER_1.DPAD.up) moveUp();
if (PLAYER_1.A) fire();
if (SYSTEM.TWO_PLAYER) startTwoPlayerGame();
```

**Development keyboard mapping:**

| Player   | Action           | Key |
|----------|------------------|-----|
| Player 1 | UP               | W   |
| Player 1 | DOWN             | S   |
| Player 1 | LEFT             | A   |
| Player 1 | RIGHT            | D   |
| Player 1 | A Button         | F   |
| Player 1 | B Button         | G   |
| Player 2 | UP               | I   |
| Player 2 | DOWN             | K   |
| Player 2 | LEFT             | J   |
| Player 2 | RIGHT            | L   |
| Player 2 | A Button         | ;   |
| Player 2 | B Button         | '   |
| System   | One Player Start | 1   |
| System   | Two Player Start | 2   |

### Spinner Controls (`@rcade/plugin-input-spinners`)

```javascript
import { PLAYER_1_SPINNER, PLAYER_2_SPINNER } from "@rcade/plugin-input-spinners";
// PLAYER_1_SPINNER.delta: number (positive = right, negative = left)
```

**Development keyboard mapping:**

| Player   | Action        | Key |
|----------|---------------|-----|
| Player 1 | Spinner Left  | C   |
| Player 1 | Spinner Right | V   |
| Player 2 | Spinner Left  | .   |
| Player 2 | Spinner Right | /   |

Spinners repeat at ~60Hz while held.

### Sandbox Restrictions

- Network requests: blocked
- localStorage / sessionStorage / indexedDB / cookies: blocked
- Direct `keydown` events: blocked — use plugins
- Node.js APIs: blocked
- File system: blocked — bundle all assets

---

## Manifest (`rcade.manifest.json`)

```json
{
  "$schema": "https://rcade.dev/manifest.schema.json",
  "name": "game-id",
  "display_name": "Display Name",
  "description": "...",
  "visibility": "public",
  "authors": [{ "display_name": "Your Name" }],
  "dependencies": [
    { "name": "@rcade/input-classic", "version": "1.0.0" },
    { "name": "@rcade/input-spinners", "version": "1.0.0" }
  ]
}
```

Visibility: `public` | `internal` | `private`.

---

## Deployment

Push to `main` → GitHub Actions auto-deploys via `.github/workflows/deploy.yaml`.
Auth uses GitHub OIDC — no secrets needed. Requires GitHub username linked to RC profile at recurse.com/settings/general.
