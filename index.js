const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ----------------------------------------------------------------
// GAME CONSTANTS
// ----------------------------------------------------------------
const MAP_SIZE = 50; // -25 to 25
const PLAYER_RADIUS = 0.5;
const BULLET_SPEED = 0.8;
const BULLET_RADIUS = 0.2;
const MINION_SPEED = 0.15;

// ----------------------------------------------------------------
// GAME STATE
// ----------------------------------------------------------------
let players = {};
let bullets = [];
let minions = []; // For 'Arise' ability

// ----------------------------------------------------------------
// GAME LOOP (60 FPS)
// ----------------------------------------------------------------
setInterval(() => {
  updateBullets();
  updateMinions();
  updateAbilities();

  // Broadcast fast-changing state (positions) via volatile to reduce lag
  io.volatile.emit('gameState', {
    players: players,
    bullets: bullets,
    minions: minions
  });
}, 1000 / 60);

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.z += b.vz;
    b.life--;

    // Remove if timed out
    if (b.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    // Boundary Check (Despawn if OOB)
    if (Math.abs(b.x) > MAP_SIZE || Math.abs(b.z) > MAP_SIZE) {
      bullets.splice(i, 1);
      continue;
    }

    // Collision Check vs Players
    for (let id in players) {
      if (id === b.ownerId) continue; // Don't hit self
      const p = players[id];
      if (p.isDead) continue;

      // Distance Check
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < (PLAYER_RADIUS + BULLET_RADIUS)) {
        // HIT!
        applyDamage(id, b.damage, b.ownerId);
        bullets.splice(i, 1); // Remove bullet
        break; // One hit per bullet
      }
    }
  }
}

function updateMinions() {
  // "Arise" minions track nearest enemy
  for (let i = minions.length - 1; i >= 0; i--) {
    const m = minions[i];
    m.life--;
    if (m.life <= 0) {
      minions.splice(i, 1);
      continue;
    }

    // Find nearest target
    let target = null;
    let minDist = 999;

    for (let id in players) {
      if (id === m.ownerId) continue;
      const p = players[id];
      if (p.isDead) continue;

      // Check for invisibility (Scaredy Cat)
      // If target is invisible, minion ignores them unless very close
      if (p.invisible && Math.random() > 0.1) continue;

      const d = Math.sqrt((p.x - m.x) ** 2 + (p.z - m.z) ** 2);
      if (d < minDist) {
        minDist = d;
        target = p;
      }
    }

    if (target) {
      // Move towards target
      const angle = Math.atan2(target.x - m.x, target.z - m.z);
      m.x += Math.sin(angle) * MINION_SPEED;
      m.z += Math.cos(angle) * MINION_SPEED;

      // Collision (Boom)
      if (minDist < 1.0) {
        applyDamage(target.id, 20, m.ownerId);
        minions.splice(i, 1); // Minion explodes
      }
    }
  }
}

function updateAbilities() {
  const now = Date.now();
  for (let id in players) {
    const p = players[id];
    // Handle temporary buffs expiring
    if (p.buffParams.endTime && now > p.buffParams.endTime) {
      // Expire buff
      if (p.buffParams.type === 'saiyan') {
        p.damageMultiplier = 1;
      } else if (p.buffParams.type === 'scaredy') {
        p.invisible = false;
      }
      p.buffParams = {};
    }
  }
}

function applyDamage(targetId, amount, attackerId) {
  const p = players[targetId];
  if (!p) return;

  p.hp -= amount;

  // Broadcast hit event for visuals
  io.emit('playerHit', { id: targetId, hp: p.hp });

  if (p.hp <= 0 && !p.isDead) {
    p.isDead = true;
    p.hp = 0;

    // Award Kill
    if (players[attackerId]) {
      players[attackerId].kills++;
      // Broadcast kill feed
      const killerName = players[attackerId].name || "Unknown";
      const victimName = p.name || "Unknown";
      io.emit('killFeed', { killer: killerName, victim: victimName, killerId: attackerId });
      io.emit('leaderboardUpdate', getLeaderboard());
    }

    // Notify victim
    io.to(targetId).emit('youDied', { killer: players[attackerId]?.name || "Unknown", seconds: 5 });

    // Queue Respawn
    setTimeout(() => {
      respawnPlayer(targetId);
    }, 5000);
  }
}

function respawnPlayer(id) {
  if (players[id]) {
    players[id].isDead = false;
    players[id].hp = 100;
    players[id].x = (Math.random() * 40) - 20;
    players[id].z = (Math.random() * 40) - 20;
    players[id].invisible = false;
    players[id].damageMultiplier = 1;
    io.emit('playerRespawn', players[id]);
  }
}

function getLeaderboard() {
  return Object.values(players)
    .sort((a, b) => b.kills - a.kills)
    .map(p => ({ name: p.name, kills: p.kills }))
    .slice(0, 5); // Top 5
}

// ----------------------------------------------------------------
// SOCKET HANDLERS
// ----------------------------------------------------------------
io.on('connection', (socket) => {
  console.log('user connected: ' + socket.id);

  // Initial placeholder, waiting for 'joinGame'
  // We do NOT add to 'players' yet until they click PLAY in lobby

  socket.on('joinGame', (data) => {
    // data: { name, piece, color, hat, ability }
    players[socket.id] = {
      id: socket.id,
      name: data.name || "Player",
      x: (Math.random() * 40) - 20,
      z: (Math.random() * 40) - 20,
      hp: 100,
      kills: 0,
      isDead: false,
      // Customization
      model: {
        piece: data.piece,
        color: data.color,
        hat: data.hat
      },
      ability: data.ability,
      cooldowns: { ability: 0 },
      // Status effects
      invisible: false,
      damageMultiplier: 1,
      buffParams: {}
    };

    // Notify everyone
    io.emit('playerJoined', players[socket.id]);
    // Send world state to new player
    socket.emit('initGame', { players, leaderboard: getLeaderboard() });
  });

  socket.on('playerMovement', (pos) => {
    if (!players[socket.id] || players[socket.id].isDead) return;

    // Simple trust for now (authoritative would prevent speed hacking)
    players[socket.id].x = pos.x;
    players[socket.id].z = pos.z;
  });

  socket.on('shoot', (aimData) => {
    // aimData: { angle }
    const p = players[socket.id];
    if (!p || p.isDead) return;
    if (p.invisible) return; // Can't shoot while invisible

    // Create bullet
    const bx = p.x;
    const bz = p.z;
    const vx = Math.sin(aimData.angle) * BULLET_SPEED;
    const vz = Math.cos(aimData.angle) * BULLET_SPEED;

    bullets.push({
      id: uuidv4(),
      ownerId: socket.id,
      x: bx, z: bz,
      vx: vx, vz: vz,
      damage: 10 * p.damageMultiplier,
      life: 120 // 2 seconds at 60fps
    });
  });

  socket.on('useAbility', () => {
    const p = players[socket.id];
    if (!p || p.isDead) return;

    const now = Date.now();
    if (now < p.cooldowns.ability) return; // On Cooldown

    // Activate Ability
    if (p.ability === 'arise') {
      // Summon Minion
      minions.push({
        x: p.x + (Math.random() * 2 - 1),
        z: p.z + (Math.random() * 2 - 1),
        ownerId: socket.id,
        life: 600 // 10 seconds
      });
      p.cooldowns.ability = now + 15000; // 15s CD
      io.emit('abilityUsed', { id: socket.id, type: 'arise' });

    } else if (p.ability === 'scaredy') {
      // Invisibility
      p.invisible = true;
      p.buffParams = { type: 'scaredy', endTime: now + 5000 };
      p.cooldowns.ability = now + 20000; // 20s CD
      io.emit('abilityUsed', { id: socket.id, type: 'scaredy' });

    } else if (p.ability === 'saiyan') {
      // Super Damage
      p.damageMultiplier = 2;
      p.buffParams = { type: 'saiyan', endTime: now + 10000 };
      p.cooldowns.ability = now + 40000; // 40s CD
      io.emit('abilityUsed', { id: socket.id, type: 'saiyan' });
    }

    // Notify client to update HUD cooldown
    socket.emit('cooldownStart', { duration: p.cooldowns.ability - now });
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
    io.emit('leaderboardUpdate', getLeaderboard());
  });
});

app.get('/', (req, res) => {
  res.send('Chess Shooter Server Running');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});

