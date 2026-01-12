import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from anywhere (Itch.io, localhost)
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Game State
let players = {}; // { socketId: { x, y, z, rot, type, color, health, name, ... } }
let suggestions = []; // [{ text, date }]
let chatHistory = []; // Limit to last 50 maybe

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send initial data
    socket.emit('init', {
        id: socket.id,
        players: players,
        suggestions: suggestions,
        chatHistory: chatHistory
    });

    socket.on('join', (data) => {
        // data: { type, name, color, x, y, z }
        players[socket.id] = {
            id: socket.id,
            type: data.type,
            name: data.name,
            color: data.color,
            x: data.x,
            y: data.y,
            z: data.z,
            rot: 0,
            health: 100,
            maxHealth: 100,
            action: 'idle'
        };
        // Broadcast new player to everyone ELSE
        socket.broadcast.emit('playerJoined', players[socket.id]);
        console.log(`Player joined: ${data.name} (${socket.id})`);
    });

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].rot = data.rot;
            players[socket.id].action = data.action; // 'idle', 'walk', 'run', 'dodge'

            // Broadcast movement (optimize: volitile or throttled in real app, here direct)
            socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
        }
    });

    socket.on('updateColor', (hex) => {
        if (players[socket.id]) {
            players[socket.id].color = hex;
            io.emit('playerColorChanged', { id: socket.id, color: hex });
        }
    });

    socket.on('attack', (data) => {
        // data: { type: 'bite'|'pellet'|'egg', origin, direction }
        // Broadcast attack visual
        socket.broadcast.emit('playerAttacked', { id: socket.id, ...data });
    });

    socket.on('damage', (data) => {
        // data: { targetId, amount }
        // Ideally server checks logic, but we'll trust client for this prototype
        const target = players[data.targetId];
        if (target) {
            target.health -= data.amount;
            if (target.health < 0) target.health = 0;

            io.emit('playerDamaged', { id: data.targetId, health: target.health });

            if (target.health <= 0) {
                // Game Over logic
                io.emit('playerDied', { id: data.targetId });
                // Reset or respawn logic could be handled by client or here
                // For now, let's just mark them dead
            }
        }
    });

    socket.on('respawn', () => {
        if (players[socket.id]) {
            players[socket.id].health = 100;
            io.emit('playerRespawned', { id: socket.id, health: 100 });
        }
    });

    socket.on('chat', (msg) => {
        if (!players[socket.id]) return;
        const entry = { name: players[socket.id].name, text: msg, time: Date.now() };
        chatHistory.push(entry);
        if (chatHistory.length > 50) chatHistory.shift();
        io.emit('chatMessage', entry);
    });

    socket.on('suggestion', (text) => {
        const entry = { text, date: new Date().toISOString() };
        suggestions.push(entry);
        io.emit('newSuggestion', entry);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
