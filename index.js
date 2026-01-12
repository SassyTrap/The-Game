const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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

// Store connected players
const players = {};

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'Raccoon Town Server Online 🦝',
        players: Object.keys(players).length
    });
});

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Initialize new player
    players[socket.id] = {
        id: socket.id,
        name: 'Raccoon',
        x: 0,
        z: 0,
        facingLeft: false,
        isMoving: false,
        customization: {
            color: 'normal',
            hat: false,
            glasses: false
        }
    };

    // Send current player their ID
    socket.emit('yourId', socket.id);

    // Send existing players to new player
    socket.emit('currentPlayers', players);

    // Notify others of new player
    socket.broadcast.emit('playerJoined', players[socket.id]);

    // Handle player info update (name, customization)
    socket.on('playerInfo', (data) => {
        if (players[socket.id]) {
            players[socket.id].name = data.name || 'Raccoon';
            players[socket.id].customization = data.customization || players[socket.id].customization;
            io.emit('playerUpdated', players[socket.id]);
        }
    });

    // Handle position updates
    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].z = data.z;
            players[socket.id].facingLeft = data.facingLeft;
            players[socket.id].isMoving = data.isMoving;

            // Broadcast to all other players
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: data.x,
                z: data.z,
                facingLeft: data.facingLeft,
                isMoving: data.isMoving
            });
        }
    });

    // Handle chat messages
    socket.on('chatMessage', (message) => {
        if (players[socket.id] && message.trim()) {
            io.emit('chatMessage', {
                id: socket.id,
                name: players[socket.id].name,
                message: message.substring(0, 200), // Limit message length
                timestamp: Date.now()
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🦝 Raccoon Town Server running on port ${PORT}`);
});
