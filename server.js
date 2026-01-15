const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS configuration - Allow all origins for itch.io compatibility
app.use(cors({
    origin: true, // Allow all origins
    credentials: true
}));

app.use(express.json());

const io = socketIO(server, {
    cors: {
        origin: true, // Allow all origins for itch.io
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Game state
const waitingPlayers = [];
const activeGames = new Map();
const playerToRoom = new Map();

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'Chaotic Showdown Server Running',
        version: '1.0.0',
        activeGames: activeGames.size,
        waitingPlayers: waitingPlayers.length,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        activeConnections: io.engine.clientsCount
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Player requests to find a match
    socket.on('findMatch', () => {
        console.log(`Player ${socket.id} looking for match...`);

        // Check if there's a waiting player
        if (waitingPlayers.length > 0) {
            // Match found! Create a game room
            const opponent = waitingPlayers.shift();
            const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create game room
            socket.join(roomId);
            opponent.join(roomId);

            // Store game state
            activeGames.set(roomId, {
                players: [socket.id, opponent.id],
                choices: {},
                scores: {
                    [socket.id]: 0,
                    [opponent.id]: 0
                },
                round: 1,
                createdAt: Date.now()
            });

            playerToRoom.set(socket.id, roomId);
            playerToRoom.set(opponent.id, roomId);

            // Notify both players
            socket.emit('matchFound', {
                roomId,
                opponentId: opponent.id,
                playerNumber: 1
            });
            opponent.emit('matchFound', {
                roomId,
                opponentId: socket.id,
                playerNumber: 2
            });

            console.log(`Match created: ${roomId} | Players: ${socket.id} vs ${opponent.id}`);
        } else {
            // No opponent available, add to waiting list
            waitingPlayers.push(socket);
            socket.emit('waitingForOpponent');
            console.log(`Player ${socket.id} added to waiting list. Queue: ${waitingPlayers.length}`);
        }
    });

    // Player makes a choice
    socket.on('makeChoice', (data) => {
        const { roomId, choice } = data;
        const game = activeGames.get(roomId);

        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }

        // Store the player's choice
        game.choices[socket.id] = choice;

        console.log(`Player ${socket.id} chose ${choice} in room ${roomId}`);

        // Check if both players have made their choices
        if (Object.keys(game.choices).length === 2) {
            // Both players ready, send choices to each player
            const [player1Id, player2Id] = game.players;

            io.to(player1Id).emit('opponentChoice', game.choices[player2Id]);
            io.to(player2Id).emit('opponentChoice', game.choices[player1Id]);

            console.log(`Round ${game.round} complete in ${roomId}`);

            // Clear choices for next round
            game.choices = {};
            game.round++;
        } else {
            // Notify opponent that player has made their choice
            const opponentId = game.players.find(id => id !== socket.id);
            io.to(opponentId).emit('opponentReady');
        }
    });

    // Player updates their score
    socket.on('updateScore', (data) => {
        const { roomId, score } = data;
        const game = activeGames.get(roomId);

        if (game) {
            game.scores[socket.id] = score;
        }
    });

    // Handle chat messages (optional feature)
    socket.on('chatMessage', (data) => {
        const { roomId, message } = data;
        const room = playerToRoom.get(socket.id);

        if (room) {
            socket.to(room).emit('chatMessage', {
                playerId: socket.id,
                message,
                timestamp: Date.now()
            });
        }
    });

    // Player wants to play again
    socket.on('playAgain', () => {
        const roomId = playerToRoom.get(socket.id);

        if (roomId) {
            const game = activeGames.get(roomId);
            if (game) {
                game.playAgainRequests = game.playAgainRequests || [];
                game.playAgainRequests.push(socket.id);

                // If both players want to play again
                if (game.playAgainRequests.length === 2) {
                    // Reset game state
                    game.choices = {};
                    game.scores = {
                        [game.players[0]]: 0,
                        [game.players[1]]: 0
                    };
                    game.round = 1;
                    game.playAgainRequests = [];

                    // Notify both players
                    io.to(roomId).emit('gameReset');
                    console.log(`Game reset in room: ${roomId}`);
                }
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Remove from waiting list
        const waitingIndex = waitingPlayers.findIndex(s => s.id === socket.id);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
            console.log(`Removed ${socket.id} from waiting list`);
        }

        // Handle active game
        const roomId = playerToRoom.get(socket.id);
        if (roomId) {
            const game = activeGames.get(roomId);
            if (game) {
                // Notify opponent
                const opponentId = game.players.find(id => id !== socket.id);
                if (opponentId) {
                    io.to(opponentId).emit('opponentDisconnected');
                }

                // Clean up
                activeGames.delete(roomId);
                game.players.forEach(playerId => {
                    playerToRoom.delete(playerId);
                });

                console.log(`Game ended: ${roomId}`);
            }
        }
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
    });
});

// Cleanup inactive games periodically
setInterval(() => {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (const [roomId, game] of activeGames.entries()) {
        if (now - game.createdAt > timeout) {
            console.log(`Cleaning up inactive game: ${roomId}`);
            activeGames.delete(roomId);
            game.players.forEach(playerId => {
                playerToRoom.delete(playerId);
            });
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🎮 Chaotic Showdown Server running on port ${PORT}`);
    console.log(`🌍 Server started at ${new Date().toISOString()}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
