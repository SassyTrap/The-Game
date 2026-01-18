# Ace Attorney Online Clone

A modern web-based clone of the Ace Attorney courtship interface.

## Features
- **Dialogue System**: Typewriter effect with click-to-skip.
- **Scene Management**: Dynamic background and character switching.
- **Animations**: Shake effects, flashes, and "Objection!" bubbles.
- **Lobby Screen**: A mock connection screen simulating the online experience.
- **Asset System**: Currently uses placeholders. You can replace images in `src/main.js`.

## How to Run
1. Ensure you have Node.js installed.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the local server.
4. Open the link (usually http://localhost:5173).

## Replacing Assets
To make it look like the real game, find transparent PNGs for:
- **Backgrounds**: Courtroom (Defense, Prosecution, Judge, Witness).
- **Characters**: Phoenix Wright, Edgeworth, Judge (various poses).
- **UI**: Speech boxes (optional, currently CSS styled).

Update the `ASSETS` object in `src/main.js` with your local paths (put images in `public/` folder and reference them like `/my-image.png`).
