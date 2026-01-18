const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connection from Itch.io and anywhere
        methods: ["GET", "POST"]
    }
});

// Serve static files from the 'dist' directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Also serve public folder if needed during dev, or handle by vite in dev mode.
// For production, we assume 'npm run build' has run and everything is in 'dist'.

let currentMusic = {
    url: '',
    timestamp: 0,
    isPlaying: false,
    startTime: 0
};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send current music state to new user
    socket.emit('music_sync', {
        ...currentMusic,
        serverTime: Date.now()
    });

    // Handle Chat/Action Messages
    socket.on('message', (data) => {
        // Broadcast to everyone including sender (or excluding if we handle local opt)
        // For simplicity, broadcast to all
        io.emit('message', data);
    });

    // Handle Music Updates
    socket.on('music_update', (data) => {
        // data = { url, isPlaying, timestamp }
        currentMusic = {
            ...data,
            startTime: Date.now() - (data.timestamp * 1000) // Rough sync reference
        };
        io.emit('music_sync', {
            ...currentMusic,
            serverTime: Date.now()
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
