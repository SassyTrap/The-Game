import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connection from Itch.io and anywhere
        methods: ["GET", "POST"]
    }
});

// Serve static files from the 'dist' directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

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
        io.emit('message', data);
    });

    // Handle Music Updates
    socket.on('music_update', (data) => {
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
