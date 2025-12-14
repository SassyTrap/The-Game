const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ----------------------------------------------------------------
// GAME CONSTANTS
// ----------------------------------------------------------------
// 3x3 grid of 9x9 boards.
// Each board is 18 units wide.
// Center board is -9 to 9.
// Total world -27 to 27.
const WORLD_LIMIT = 27;

// ----------------------------------------------------------------
// GAME STATE
// ----------------------------------------------------------------
let players = {};

// ----------------------------------------------------------------
// GAME LOOP (10 Hz sufficient for movement sync if not combat)
// ----------------------------------------------------------------
setInterval(() => {
  // Broadcast state
  io.volatile.emit('gameState', {
    players: players
  });
}, 100);

// ----------------------------------------------------------------
// SOCKET HANDLERS
// ----------------------------------------------------------------
io.on('connection', (socket) => {
  console.log('user connected: ' + socket.id);

  socket.on('joinGame', (data) => {
    // Spawn in CENTER board.
    // Center board range: -8 to 8 (approx)
    // Snap to EVEN integers: -8, -6, -4, -2, 0, 2, 4, 6, 8.
    // Random integer between -4 and 4, multiplied by 2.
    const spawnX = (Math.floor(Math.random() * 9) - 4) * 2;
    const spawnZ = (Math.floor(Math.random() * 9) - 4) * 2;

    // Validate simple customization
    let validColor = ['white', 'black'].includes(data.color) ? data.color : 'white';
    let validHat = ['none', 'hat', 'glasses', 'halo'].includes(data.hat) ? data.hat : 'none';

    players[socket.id] = {
      id: socket.id,
      name: data.name || "Player",
      x: spawnX,
      z: spawnZ,
      hp: 100,
      kills: 0,
      isDead: false, // Legacy field
      model: {
        piece: 'pawn', // Keeping for legacy reference or removal
        class: data.class || 'knight',
        color: validColor,
        hat: validHat
      },
      stats: data.stats || {},
      // Removed abilities
    };

    io.emit('playerJoined', players[socket.id]);
    socket.emit('initGame', { players, leaderboard: getLeaderboard() });
  });

  socket.on('playerMovement', (pos) => {
    if (!players[socket.id]) return;

    // Validate bounds
    let x = pos.x;
    let z = pos.z;
    // World Limit 27. Valid Even max is 26.
    if (x < -WORLD_LIMIT) x = -26;
    if (x > WORLD_LIMIT) x = 26;
    if (z < -WORLD_LIMIT) z = -26;
    if (z > WORLD_LIMIT) z = 26;

    players[socket.id].x = x;
    players[socket.id].z = z;
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
    io.emit('leaderboardUpdate', getLeaderboard());
  });
});

function getLeaderboard() {
  // Just show player list
  return Object.values(players)
    .map(p => ({ name: p.name, kills: 0 }))
    .slice(0, 5);
}

app.get('/', (req, res) => {
  res.send('Chess Walker Server Running');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});

