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

  // Create new player
  players[socket.id] = {
    id: socket.id,
    x: 0,
    z: 0,
    // Assign a random color for the pawn
    color: '#' + Math.floor(Math.random() * 16777215).toString(16)
  };

  // Send current players to the new user
  socket.emit('currentPlayers', players);

  // Broadcast new player to everyone else
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].z = movementData.z;
      // Broadcast movement to others
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
