# How to Deploy "The Animatronic" to Render.com

Since this is a Multiplayer Game with a Node.js server, you need to deploy it as a **Web Service**.

## Step 1: Push to GitHub
1. Create a new Repository on GitHub.
2. Upload all the files from your project (specifically the `GitHub_Source` folder I created in `_SUBMISSION`, or just the root folder minus `node_modules`).
3. Ensure `package.json`, `vite.config.js`, `index.html`, `src/`, and `server/` are in the repo.

## Step 2: Create Service on Render
1. Log in to [Render.com](https://render.com).
2. Click **"New +"** and select **"Web Service"**.
3. Connect your GitHub account and select your new repository.

## Step 3: Configure Settings
Fill in the following details exactly:

*   **Name:** `the-game-rivf` (To match your URL `https://the-game-rivf.onrender.com`)
*   **Region:** Any (e.g., Oregon, Frankfurt)
*   **Branch:** `main` (or `master`)
*   **Root Directory:** `.` (Leave blank or dot)
*   **Runtime:** `Node`
*   **Build Command:** `npm install && npm run build`
    *   *This installs game libraries and builds the 3D website.*
*   **Start Command:** `node server/server.js`
    *   *This starts the multiplayer server.*

## Step 4: Deploy
1. Click **"Create Web Service"**.
2. Wait for the logs to show "Build successful" and "Server listening on port...".
3. Your game will be live at `https://the-game-rivf.onrender.com`!

## Troubleshooting
*   If the screen is white: The `dist` folder might be missing. Check `npm run build` logs.
*   If chat works but 3D doesn't load: Check console (F12) for asset 404 errors. Assets must be in `public/` folder in your repo.
