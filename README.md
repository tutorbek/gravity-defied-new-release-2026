# Gravity Defied New Release 2026

A desktop-first web remake of the classic **Gravity Defied** trial racing experience.

This project focuses on opening directly into the game with no surrounding website UI. The gameplay is rendered on a fullscreen HTML5 Canvas, tuned for modern desktop displays, sharp visuals, smooth motion, unlocked content, new hard tracks, and upgraded bike/rider presentation.

![Preview](preview.gif)

## Highlights

- Pure game-only fullscreen experience.
- Desktop-first layout tuned for large displays.
- Hi-DPI canvas rendering for crisp graphics.
- Compact downhill mountain bike style rider and frame.
- Smooth render interpolation to reduce high-speed jitter.
- Wheel contact rolling sound and mountain moto bike engine sound.
- All original menu locks removed.
- Expanded level progression: `Easy`, `Medium`, `Pro`, `Expert`, `ExpertPro`, `ExpertProMax`.
- Updated vector-style bike, rider, wheels, shocks, road, and race flags.
- Checkered triangular race flags for start and finish markers.
- Keyboard support for both arrow keys and `WASD`.

## Controls

| Key | Action |
| --- | --- |
| `Up` / `W` | Accelerate |
| `Down` / `S` | Brake |
| `Left` / `A` | Lean rider backward |
| `Right` / `D` | Lean rider forward |
| `Enter` | Select menu item |
| `Escape` | Pause / back |

Audio starts after the first keyboard or pointer interaction because browsers require user input before playing game sound.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal.

## Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Deploy build for GitHub Pages:

```bash
npm run deploy
```

## Project Structure

```text
gravity-defied-new-release-2026/
├── src/
│   ├── app.ts                         # App bootstrap
│   ├── runtime/
│   │   ├── startGameRuntime.ts        # Browser game loop, fullscreen resize, input wiring
│   │   ├── browserInput.ts            # Keyboard mapping
│   │   └── RollingAudio.ts            # Rolling wheel and moto engine audio
│   ├── GameCanvas.ts                  # Canvas renderer and visual effects
│   ├── GamePhysics.ts                 # Bike physics, render interpolation, audio state
│   ├── LevelLoader.ts                 # Level loading and generated level integration
│   ├── generatedLevels.ts             # New Expert level sets
│   └── ...                            # Menus, records, utilities, J2ME-style support classes
├── index.html                         # HTML entry point
├── package.json                       # Scripts and development dependencies
├── vite.config.ts                     # Vite configuration
└── preview.gif                        # Gameplay preview
```

## Technical Notes

The remake keeps the core trial-bike physics behavior intact while modernizing the browser runtime around it.

- Rendering uses HTML5 Canvas with device-pixel-ratio scaling.
- The game loop runs fixed physics steps and interpolates render state for smoother visual motion.
- Bike and rider graphics are drawn as scalable canvas/vector details instead of relying on blurry low-resolution sprites.
- Sound is generated with the Web Audio API, including rolling contact noise and a layered moto engine tone.
- The game is written in TypeScript and built with Vite.

## Tech Stack

- TypeScript
- Vite
- HTML5 Canvas
- Web Audio API
- ESLint

## Credits

**Gravity Defied** is a classic mototrial mobile game originally developed by Codebrew Software for J2ME devices.

This project is an independent desktop-focused web remake inspired by the original game and based on the browser port/code lineage of Gravity Defied.

## Disclaimer

This project is not associated with Codebrew Software. All rights to the original Gravity Defied name, brand, logo, and original assets belong to their respective owners.

## License

This project is licensed under the GNU General Public License v2.0. See the repository license file for details.
