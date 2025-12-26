const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Basic Route for Health Check
app.get('/', (req, res) => {
    res.send('Game Server is Running!');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for dev/prod simplicity
        methods: ["GET", "POST"]
    }
});

const players = {};
let currentAudioLink = "";

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Create new player entry
    players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
        action: 'idle',
        health: 100
    };

    // Send current players to new player
    socket.emit('currentPlayers', players);

    // Send current audio if playing
    if (currentAudioLink) {
        socket.emit('playAudio', currentAudioLink);
    }

    // Notify others of new player
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Handle Movement
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;

            // Broadcast to others
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Handle Action (Animation)
    socket.on('playerAction', (actionData) => {
        if (players[socket.id]) {
            players[socket.id].action = actionData.action;
            socket.broadcast.emit('playerAction', { id: socket.id, action: actionData.action });
        }
    });

    // Handle Hit (Combat)
    socket.on('playerHit', (data) => {
        const targetId = data.targetId;
        if (players[targetId] && players[targetId].health > 0) {
            players[targetId].health -= 25;
            if (players[targetId].health < 0) players[targetId].health = 0;

            io.emit('playerDamaged', {
                id: targetId,
                health: players[targetId].health,
                damage: 25
            });

            if (players[targetId].health <= 0) {
                // Respawn logic
                setTimeout(() => {
                    if (players[targetId]) {
                        players[targetId].health = 100;
                        players[targetId].x = 0; // Reset pos if needed, or keep same
                        players[targetId].y = 0;
                        players[targetId].z = 0;
                        io.emit('playerRespawn', players[targetId]);
                    }
                }, 4000);
            }
        }
    });

    // Handle Chat
    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', { id: socket.id, msg: msg });
    });

    // Handle Audio
    socket.on('playAudio', (link) => {
        currentAudioLink = link;
        io.emit('playAudio', link);
    });

    socket.on('stopAudio', () => {
        currentAudioLink = "";
        io.emit('stopAudio');
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
