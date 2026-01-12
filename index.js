const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});
const PORT = process.env.PORT || 3000;

const players = {};
const suggestions = [];
const chathistory = [];

// Serve static if needed (for simple hosting)
// app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send Init Data
    socket.emit('init', { players, suggestions, chathistory });

    socket.on('join', (data) => {
        players[socket.id] = {
            id: socket.id,
            x: data.x || 0,
            y: data.y || 0,
            z: data.z || 0,
            rot: data.rot || 0,
            type: data.type || 'fox',
            name: data.name || 'Player',
            color: data.color || 'original',
            health: 100,
            anim: 'idle'
        };
        io.emit('player_joined', players[socket.id]);
    });

    socket.on('state', (data) => {
        if (players[socket.id]) {
            // Update local state
            Object.assign(players[socket.id], data);
            // Broadcast (exclude sender for optimization if client predicts? 
            // usually broadcast to others)
            socket.broadcast.emit('player_moved', { id: socket.id, ...data });
        }
    });

    socket.on('attack', (data) => {
        // data: { type: 'pellet'|'egg', origin, direction }
        socket.broadcast.emit('remote_attack', { id: socket.id, ...data });
    });

    socket.on('chat', (msg) => {
        if (!players[socket.id]) return;
        const entry = { name: players[socket.id].name, msg };
        chathistory.push(entry);
        if (chathistory.length > 50) chathistory.shift();
        io.emit('chat', entry);
    });

    socket.on('suggestion', (msg) => {
        suggestions.push(msg);
        io.emit('suggestion', msg);
    });

    socket.on('apple_eaten', (index) => {
        // Broadcast removal
        io.emit('remove_apple', index);
    });

    // Damage logic: Trust client who got hit or attacker?
    // Let's trust the "Victim" to report damage to self, or "Attacker" to report hit.
    // Simplest: Attacker calculates hit locally, sends 'damage_player' event.
    socket.on('damage_player', (data) => {
        const targetId = data.targetId;
        const amount = data.amount;
        if (players[targetId]) {
            players[targetId].health -= amount;
            io.emit('player_stats', { id: targetId, health: players[targetId].health });
            if (players[targetId].health <= 0) {
                // Respawn or Just die
                // We'll let client handle visuals, server just broadcasts
                players[targetId].health = 100; // Reset or wait?
                // Actually, let's keep it 0 and let client respawn
            }
        }
    });

    socket.on('respawn', () => {
        if (players[socket.id]) players[socket.id].health = 100;
        io.emit('player_stats', { id: socket.id, health: 100 });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        io.emit('player_left', socket.id);
    });
});

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
