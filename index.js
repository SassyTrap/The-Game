const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const cors = require('cors');

app.use(cors());

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all connections for simplicity
        methods: ["GET", "POST"]
    }
});

let playersQueue = [];

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_game', (playerName) => {
        socket.playerName = playerName;

        // Remove disconnected sockets from queue just in case
        playersQueue = playersQueue.filter(s => s.connected);

        if (playersQueue.length > 0) {
            // Someone is waiting!
            const opponent = playersQueue.shift();

            // Double check opponent is distinct (should be, assuming simple logic)
            if (opponent.id === socket.id) {
                playersQueue.push(socket);
                socket.emit('waiting', true);
                return;
            }

            console.log(`Matchmaking: ${opponent.playerName} (White) vs ${playerName} (Black)`);

            const roomID = `match_${opponent.id}_${socket.id}`;
            socket.join(roomID);
            opponent.join(roomID);

            // Assign colors: Waiting player (from queue) is White, New player is Black
            io.to(opponent.id).emit('start_game', {
                color: 'w',
                opponent: playerName,
                room: roomID
            });

            io.to(socket.id).emit('start_game', {
                color: 'b',
                opponent: opponent.playerName,
                room: roomID
            });
        } else {
            // No one waiting, add to queue
            console.log(`Player ${playerName} added to queue.`);
            playersQueue.push(socket);
            socket.emit('waiting', true);
        }
    });

    socket.on('make_move', (data) => {
        // Relay move to opponent in the room
        socket.to(data.room).emit('opponent_move', data.move);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Remove from queue if present
        playersQueue = playersQueue.filter(s => s.id !== socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
