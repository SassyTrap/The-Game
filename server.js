const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const io = socketIO(server, {
    cors: { origin: true, methods: ['GET', 'POST'], credentials: true }
});

// Fighter battle logic
const FIGHTERS = {
    drugs: { beats: 'weirdo' },
    dog: { beats: 'drugs' },
    weirdo: { beats: 'intrusive' },
    intrusive: { beats: 'thinking' },
    thinking: { beats: 'dog' }
};

// Game constants
const ARENA_WIDTH = 1920;
const ARENA_HEIGHT = 1080;
const PLAYER_SIZE = 40;
const PLAYER_SPEED = 3;
const MIN_PLAYERS = 2;
const TICK_RATE = 60; // 60 FPS

// Game state
let lobby = {
    players: new Map(),
    gameStarted: false
};

let game = {
    active: false,
    players: new Map(),
    lastUpdate: Date.now()
};

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'Chaotic Battle Royale Server Running',
        version: '2.0.0',
        playersInLobby: lobby.players.size,
        gameActive: game.active,
        playersInGame: game.players.size,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
});

// Socket.IO
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Add to lobby
    const player = {
        id: socket.id,
        name: `Player${Math.floor(Math.random() * 9999)}`,
        fighter: null,
        isReady: false,
        x: 0,
        y: 0,
        isAlive: true
    };

    lobby.players.set(socket.id, player);

    // Send player their ID
    socket.emit('playerId', { id: socket.id, name: player.name });

    // Send lobby update to all
    broadcastLobbyUpdate();

    // Fighter selection
    socket.on('selectFighter', (data) => {
        const player = lobby.players.get(socket.id);
        if (player) {
            player.fighter = data.fighter;
            player.isReady = true;
            console.log(`${player.name} selected ${data.fighter}`);

            broadcastLobbyUpdate();
            checkGameStart();
        }
    });

    // Player input
    socket.on('playerInput', (input) => {
        if (game.active) {
            const player = game.players.get(socket.id);
            if (player && player.isAlive) {
                // Update player position based on input
                if (input.w) player.y -= PLAYER_SPEED;
                if (input.s) player.y += PLAYER_SPEED;
                if (input.a) player.x -= PLAYER_SPEED;
                if (input.d) player.x += PLAYER_SPEED;

                // Clamp to arena bounds
                player.x = Math.max(PLAYER_SIZE / 2, Math.min(player.x, ARENA_WIDTH - PLAYER_SIZE / 2));
                player.y = Math.max(PLAYER_SIZE / 2, Math.min(player.y, ARENA_HEIGHT - PLAYER_SIZE / 2));
            }
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Remove from lobby
        lobby.players.delete(socket.id);
        broadcastLobbyUpdate();

        // Remove from game
        if (game.players.has(socket.id)) {
            game.players.delete(socket.id);
            checkGameOver();
        }
    });
});

function broadcastLobbyUpdate() {
    const players = Array.from(lobby.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        fighter: p.fighter,
        isReady: p.isReady
    }));

    io.emit('lobbyUpdate', { players });
}

function checkGameStart() {
    // Check if we have enough players and all are ready
    const players = Array.from(lobby.players.values());

    if (players.length >= MIN_PLAYERS && players.every(p => p.isReady) && !lobby.gameStarted) {
        lobby.gameStarted = true;
        startGame();
    }
}

function startGame() {
    console.log('Starting game!');

    game.active = true;
    game.players.clear();

    // Move players from lobby to game
    lobby.players.forEach((player, id) => {
        // Random spawn position
        player.x = Math.random() * (ARENA_WIDTH - 100) + 50;
        player.y = Math.random() * (ARENA_HEIGHT - 100) + 50;
        player.isAlive = true;

        game.players.set(id, player);
    });

    // Clear lobby
    lobby.players.clear();
    lobby.gameStarted = false;

    // Notify all players
    const players = Array.from(game.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        fighter: p.fighter,
        x: p.x,
        y: p.y,
        isAlive: p.isAlive
    }));

    io.emit('gameStart', { players });

    // Start game loop
    startGameLoop();
}

function startGameLoop() {
    const gameInterval = setInterval(() => {
        if (!game.active) {
            clearInterval(gameInterval);
            return;
        }

        // Check collisions
        checkCollisions();

        // Send game update to all players
        const players = Array.from(game.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            fighter: p.fighter,
            x: p.x,
            y: p.y,
            isAlive: p.isAlive
        }));

        io.emit('gameUpdate', { players });

        // Check for game over
        checkGameOver();

    }, 1000 / TICK_RATE);
}

function checkCollisions() {
    const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive);

    for (let i = 0; i < alivePlayers.length; i++) {
        for (let j = i + 1; j < alivePlayers.length; j++) {
            const p1 = alivePlayers[i];
            const p2 = alivePlayers[j];

            // Calculate distance
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check collision
            if (distance < PLAYER_SIZE) {
                // Battle!
                handleBattle(p1, p2);
            }
        }
    }
}

function handleBattle(p1, p2) {
    // Determine winner based on fighter types
    let winner, loser;

    if (FIGHTERS[p1.fighter].beats === p2.fighter) {
        winner = p1;
        loser = p2;
    } else if (FIGHTERS[p2.fighter].beats === p1.fighter) {
        winner = p2;
        loser = p1;
    } else {
        // Same fighter type - no one wins
        return;
    }

    // Eliminate loser
    loser.isAlive = false;

    console.log(`${winner.name} (${winner.fighter}) eliminated ${loser.name} (${loser.fighter})`);

    // Broadcast elimination
    io.emit('playerEliminated', {
        winner: {
            id: winner.id,
            name: winner.name,
            fighter: winner.fighter
        },
        loser: {
            id: loser.id,
            name: loser.name,
            fighter: loser.fighter
        }
    });

    // Push loser away slightly
    const dx = loser.x - winner.x;
    const dy = loser.y - winner.y;
    const angle = Math.atan2(dy, dx);
    loser.x += Math.cos(angle) * 50;
    loser.y += Math.sin(angle) * 50;
}

function checkGameOver() {
    const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive);

    if (alivePlayers.length === 1) {
        // We have a winner!
        const winner = alivePlayers[0];

        console.log(`Game over! Winner: ${winner.name}`);

        io.emit('gameOver', {
            winner: {
                id: winner.id,
                name: winner.name,
                fighter: winner.fighter
            }
        });

        // Reset game
        game.active = false;
        game.players.clear();
    } else if (alivePlayers.length === 0) {
        // Everyone died somehow? Reset
        console.log('Game over - no winners!');
        game.active = false;
        game.players.clear();
    }
}

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🎮 Chaotic Battle Royale Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
