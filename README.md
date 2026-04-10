# Gravity Defied New Release 2026

**Gravity Defied New Release 2026** is my desktop-first web remake of the classic Gravity Defied trial racing game.

The goal of this project is not to make a normal website around the game. The goal is simple: open the page and immediately play the game in a clean fullscreen desktop experience with sharper graphics, bigger objects, smoother motion, new difficult levels, unlocked content, and upgraded sound.

## Preview Video

<video src="./preview.mp4" controls muted loop playsinline width="100%"></video>

## What Changed In This Remake

This version includes many upgrades over the original browser port.

- Removed the website-style wrapper so the project opens directly into the game.
- Made the canvas fill the desktop viewport.
- Tuned the game for large desktop screens, including MacBook Air-style wide display usage.
- Increased the visual scale of the game world so the road, rider, bike, and objects feel larger and more readable.
- Added hi-DPI canvas rendering so visuals stay sharp on Retina and modern high-resolution screens.
- Reworked bike and rider rendering from blurry low-resolution sprite usage toward crisp canvas/vector drawing.
- Redesigned the bike into a compact downhill mountain bike inspired style.
- Made the bike frame thinner, cleaner, and closer to a lightweight bicycle/mountain bike shape.
- Added compact wheels with five-spoke disk styling.
- Improved rider proportions with a slimmer body, matching arms, legs, torso, and head scale.
- Preserved the original physics behavior: leaning, suspension movement, wheel rotation, landing reactions, crash behavior, and rider motion still follow the game physics.
- Added render interpolation to reduce unpleasant jitter when riding fast.
- Added rolling wheel contact sound when the wheels touch and move on the ground.
- Added mountain moto bike style engine/drive sound using the Web Audio API.
- Improved the engine sound so it is louder, cleaner, deeper, and less like a thin buzzing insect sound.
- Removed locked menu states so previously locked leagues/tracks are available.
- Added new level categories: `Expert`, `ExpertPro`, and `ExpertProMax`.
- Created harder generated maps inspired by the original levels.
- Kept the difficulty progression growing from `Easy` to `ExpertProMax`.
- Updated start and finish flags into triangular black-and-white checkered racing flags.
- Added `WASD` controls alongside the original arrow-key controls.
- Kept keyboard menu navigation with `Enter` and `Escape`.

## Game Experience

This build is focused on a pure game-only experience.

- No landing page.
- No marketing UI.
- No extra text around the game screen.
- No unnecessary buttons outside the original game flow.
- The game starts as the main visual element.
- The screen is used for gameplay, not website layout.

## Visual Upgrade

The graphics were adjusted for modern desktop displays.

- The game is rendered with device-pixel-ratio scaling for sharper output.
- The game view is enlarged so the bike, rider, track, and flags are easier to see.
- The moto/rider visuals are drawn with cleaner canvas details.
- Low-resolution sprite dependency was reduced where it caused blurry visuals.
- Wheels, frame, rider body, helmet, shocks, and limbs were tuned for a cleaner 2D look.
- The road and object scale were adjusted to feel better on fullscreen desktop.
- Race flags were redesigned as triangular checkered flags.

## Smoothness And Performance

The original physics step is preserved, but rendering is smoother.

- The physics still runs in fixed steps to keep the classic Gravity Defied feel.
- Render interpolation was added between physics steps.
- This reduces visible shaking and frame stepping when the bike is moving fast.
- Camera and render state now feel smoother on 60Hz desktop screens.

## Audio

The remake includes generated browser audio.

- Rolling tire sound plays when the wheel is touching the road and moving.
- Engine/drive sound reacts to throttle, load, speed, and pitch.
- Audio is generated with the Web Audio API.
- Sound starts after the first keyboard or pointer interaction because browsers block autoplay audio until the user interacts with the page.

## Levels

The level progression now includes six difficulty groups.

| Difficulty | Description |
| --- | --- |
| `Easy` | Starter tracks |
| `Medium` | More uneven terrain |
| `Pro` | Harder original-style tracks |
| `Expert` | New harder generated tracks |
| `ExpertPro` | More aggressive technical tracks |
| `ExpertProMax` | The hardest generated tracks |

All available levels and leagues are unlocked.

## Controls

| Key | Action |
| --- | --- |
| `Up` / `W` | Accelerate |
| `Down` / `S` | Brake |
| `Left` / `A` | Lean rider backward |
| `Right` / `D` | Lean rider forward |
| `Enter` | Select menu item |
| `Escape` | Pause / back |

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal.

## Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Build and deploy to GitHub Pages:

```bash
npm run deploy
```

## Project Structure

```text
gravity-defied-new-release-2026/
├── src/
│   ├── app.ts                         # Game-only app bootstrap
│   ├── main.ts                        # Application entry
│   ├── index.css                      # Fullscreen canvas layout
│   ├── runtime/
│   │   ├── startGameRuntime.ts        # Game loop, resize, pause, input, render interpolation
│   │   ├── browserInput.ts            # Keyboard mapping
│   │   └── RollingAudio.ts            # Rolling wheel and moto engine audio
│   ├── GameCanvas.ts                  # Canvas rendering, flags, HD drawing helpers
│   ├── GamePhysics.ts                 # Bike physics, rider motion, audio state, render state
│   ├── LevelLoader.ts                 # Original and generated level loading
│   ├── generatedLevels.ts             # Expert, ExpertPro, ExpertProMax tracks
│   ├── MenuManager.ts                 # Game menus and unlocked content
│   └── ...                            # Records, utilities, math, storage, UI compatibility classes
├── index.html                         # HTML entry point
├── package.json                       # Scripts and dependencies
├── vite.config.ts                     # Vite configuration
└── preview.gif                        # Preview media placeholder
```

## Tech Stack

- TypeScript
- Vite
- HTML5 Canvas
- Web Audio API
- ESLint

## Credits

Gravity Defied is a classic mototrial game originally developed by Codebrew Software for J2ME mobile devices.

This is an independent desktop-focused web remake project. It is inspired by the classic Gravity Defied gameplay and built from the browser port/codebase lineage, then heavily customized for a modern fullscreen desktop experience.

## Disclaimer

This project is not associated with Codebrew Software. All rights to the original Gravity Defied name, brand, logo, and original assets belong to their respective owners.

## License

This project is licensed under the GNU General Public License v2.0. See the repository license file for details.
