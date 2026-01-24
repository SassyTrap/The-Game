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

let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_game', (playerName) => {
        socket.playerName = playerName;

        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // Create a match
            console.log(`Matchmaking: ${waitingPlayer.playerName} vs ${playerName}`);

            const roomID = `match_${waitingPlayer.id}_${socket.id}`;
            socket.join(roomID);
            waitingPlayer.join(roomID);

            // Assign colors: Waiting player is White, New player is Black
            io.to(waitingPlayer.id).emit('start_game', {
                color: 'w',
                opponent: playerName,
                room: roomID
            });

            io.to(socket.id).emit('start_game', {
                color: 'b',
                opponent: waitingPlayer.playerName,
                room: roomID
            });

            waitingPlayer = null; // Reset waiting player
        } else {
            // Set as waiting player
            console.log(`Player ${playerName} is waiting...`);
            waitingPlayer = socket;
            socket.emit('waiting', true);
        }
    });

    socket.on('make_move', (data) => {
        // Relay move to opponent in the room
        socket.to(data.room).emit('opponent_move', data.move);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
        // Ideally notify opponent about disconnection here
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
