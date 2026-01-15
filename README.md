# Chaotic Showdown - Backend

Backend server for the Chaotic Showdown multiplayer game.

## Deployment to Render

1. **Create a new Web Service on Render**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository (or upload these backend files)

2. **Configure the service:**
   - **Name**: `chaotic-showdown-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or your preferred plan)

3. **Environment Variables** (if needed):
   - `PORT`: 10000 (Render sets this automatically)
   - `NODE_ENV`: production

4. **Deploy!**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Your backend URL will be: `https://your-service-name.onrender.com`

## Update Frontend

After deploying, update the `API_URL` in `frontend/game.js`:

```javascript
const API_URL = 'https://your-service-name.onrender.com';
```

## Local Testing

To test locally before deploying:

```bash
npm install
npm start
```

Server will run on http://localhost:10000

## API Endpoints

- `GET /` - Server status and statistics
- `GET /health` - Health check endpoint

## Socket Events

### Client → Server
- `findMatch` - Request to find an opponent
- `makeChoice` - Submit a fighter choice
- `updateScore` - Update player score
- `chatMessage` - Send a chat message
- `playAgain` - Request to play another round

### Server → Client
- `matchFound` - Match was found, game starting
- `waitingForOpponent` - Added to matchmaking queue
- `opponentChoice` - Opponent made their choice
- `opponentReady` - Opponent is ready
- `opponentDisconnected` - Opponent left the game
- `gameReset` - Game has been reset for new round
- `error` - Error message

## Features

- ✅ Real-time matchmaking lobby
- ✅ Automatic player pairing
- ✅ Room-based game sessions
- ✅ Disconnection handling
- ✅ Automatic cleanup of inactive games
- ✅ Health monitoring endpoints
