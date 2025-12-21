import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all connections for now (dev/render)
        methods: ["GET", "POST"]
    }
});

// Serve static files from 'dist' if building for production, or root for simplicity if strict static
// For Render, we might settle on serving 'dist' after build.
// But for now, let's assume we serve "public" or "dist".
app.use(express.static(path.join(__dirname, '../dist')));

// Fallback to index.html for SPA
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Game State
const players = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Initial Data
    socket.emit('currentPlayers', players);

    // New Player
    players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
        anim: 'idle',
        name: 'Guest',
        isAnimatronic: false
    };

    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Movement Update
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;
            players[socket.id].anim = movementData.anim;
            // Broadcast to others
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Chat
    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', { user: players[socket.id].name, text: msg });
    });

    // Name/Details Change
    socket.on('setDetails', (details) => {
        if (players[socket.id]) {
            players[socket.id].name = details.name;
            players[socket.id].isAnimatronic = details.isAnimatronic;
            socket.broadcast.emit('playerDetailsChanged', players[socket.id]);
        }
    });

    // Shooting / Damage
    socket.on('playerShoot', () => {
        socket.broadcast.emit('playerShot', { id: socket.id });
    });

    socket.on('playerDamage', (data) => {
        // data: { targetId: '...', damage: 20 }
        if (players[data.targetId]) {
            // Include targetId so clients know WHO got hit
            io.emit('playerHealthUpdate', { id: data.targetId, damage: data.damage });
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
