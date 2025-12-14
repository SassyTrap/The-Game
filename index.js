const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Game State
const players = {};

app.get('/', (req, res) => {
  res.send('Game Server is Running');
});

io.on('connection', (socket) => {
  console.log('user connected: ' + socket.id);

  // Create new player state (but don't spawn until they join)
  // We wait for 'initGame' for full spawn

  socket.on('initGame', (data) => {
    players[socket.id] = {
      id: socket.id,
      x: 0,
      z: 0,
      hp: 100,
      maxHp: 100,
      kills: 0,
      deaths: 0,
      hat: data.hat || 0,
      color: data.color || 'white',
      piece: data.piece || 'pawn',
      ability: data.ability || 'arise',
      isSuperSaiyan: false,
      isInvisible: false
    };

    // Send current state to new player
    socket.emit('currentPlayers', players);
    // Broadcast new player to everyone
    socket.broadcast.emit('newPlayer', players[socket.id]);
  });

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].z = movementData.z;
      players[socket.id].rotation = movementData.rotation; // Synced rotation
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  socket.on('shoot', (bulletData) => {
    // Broadcast bullet to all clients to render
    socket.broadcast.emit('bulletFired', {
      id: socket.id,
      ...bulletData
    });
  });

  socket.on('hit', (data) => {
    // data: { targetId, damage }
    const attacker = players[socket.id];
    const victim = players[data.targetId];

    if (attacker && victim && victim.hp > 0) {
      let dmg = data.damage;
      if (attacker.isSuperSaiyan) dmg *= 2;

      victim.hp -= dmg;

      io.emit('playerDamaged', { id: data.targetId, hp: victim.hp });

      if (victim.hp <= 0) {
        // Kill
        attacker.kills++;
        victim.deaths++;
        victim.hp = 0;

        const killFeedMsg = `${getPlayerName(socket.id)} killed ${getPlayerName(data.targetId)}`;
        io.emit('playerKilled', {
          victimId: data.targetId,
          attackerId: socket.id,
          message: killFeedMsg
        });

        io.emit('leaderboardUpdate', getLeaderboard());

        // Respawn logic
        setTimeout(() => {
          if (players[data.targetId]) {
            players[data.targetId].hp = 100;
            players[data.targetId].x = (Math.random() - 0.5) * 40;
            players[data.targetId].z = (Math.random() - 0.5) * 40;
            io.emit('playerRespawn', players[data.targetId]);
          }
        }, 5000);
      }
    }
  });

  socket.on('activateAbility', (type) => {
    if (!players[socket.id]) return;
    socket.broadcast.emit('abilityUsed', { id: socket.id, type: type });

    if (type === 'super_saiyan') {
      players[socket.id].isSuperSaiyan = true;
      setTimeout(() => {
        if (players[socket.id]) players[socket.id].isSuperSaiyan = false;
      }, 10000); // 10s duration
    }

    if (type === 'scaredy_cat') {
      players[socket.id].isInvisible = true;
      setTimeout(() => {
        if (players[socket.id]) players[socket.id].isInvisible = false;
      }, 5000);
    }
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
  return Object.values(players)
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 5)
    .map(p => ({ id: p.id, kills: p.kills, piece: p.piece }));
}

// Helper to get a readable name (or just ID)
function getPlayerName(id) {
  if (players[id]) return players[id].piece + " (" + id.substr(0, 4) + ")";
  return "Unknown";
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
