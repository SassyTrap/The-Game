# Rac Com Backend

This is the backend server for the Rac Com application.

## Deployment to Render

1.  Push this folder (or the root if you prefer monorepo) to a GitHub repository.
2.  Go to [Render.com](https://render.com).
3.  Create a new **Web Service**.
4.  Connect your GitHub repository.
5.  Set the **Root Directory** to `github-render` (if you uploaded the whole `Rac Com` folder) or leave empty if this folder is the root of the repo.
6.  Set the **Build Command** to `npm install`.
7.  Set the **Start Command** to `npm start`.
8.  Your service will live at `https://the-game-rivf.onrender.com`.

## Local Development

1.  `cd github-render`
2.  `npm install`
3.  `npm run dev`
