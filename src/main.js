import './style.css';
import { io } from "socket.io-client";

// --- Configuration & State ---
const GAME_STATE = {
  isTyping: false,
  username: 'Phoenix',
  role: 'defense',
  character: 'fighter',
  isConnected: false
};

// --- Connection ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const socketUrl = isLocal ? 'http://localhost:3000' : 'https://the-game-rivf.onrender.com';
const socket = io(socketUrl);

socket.on('connect', () => {
  console.log("Connected to server");
});

// --- Asset Map ---
const ASSETS = {
  backgrounds: {
    defense: '/background.jpg',
    prosecution: '/background.jpg',
    judge: '/background.jpg',
    witness: '/background.jpg'
  },
  characters: {
    fighter: {
      normal: '/fighter.png',
      point: '/fighter.png',
      sweat: '/fighter.png',
      desk_slam: '/fighter.png'
    }
  }
};

// --- Audio System ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const musicPlayer = new Audio();
musicPlayer.loop = true;

function playSFX(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'type') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'shout') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.3);
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'slam') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
    gainNode.gain.setValueAtTime(0.8, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }
}

// --- DOM Elements ---
const els = {
  bg: document.getElementById('background'),
  charContainer: document.getElementById('character-container'),
  box: document.getElementById('dialogue-box'),
  name: document.getElementById('speaker-name'),
  text: document.getElementById('dialogue-text'),
  overlay: document.getElementById('overlay'),
  controls: document.getElementById('player-controls'),
  input: document.getElementById('chat-input'),
  btnSend: document.getElementById('btn-send'),
  poseSelect: document.getElementById('pose-select'),
  btnsShout: document.querySelectorAll('.btn-shout'),
  lobby: document.getElementById('lobby-screen'),
  lobbyConnect: document.getElementById('btn-connect'),
  usernameInput: document.getElementById('username-input'),
  chatLog: document.getElementById('chat-log'),
  musicPanel: document.getElementById('music-player'),
  musicInput: document.getElementById('music-url'),
  btnPlayMusic: document.getElementById('btn-play-music'),
  nowPlaying: document.getElementById('now-playing-text')
};

// --- Game Logic ---

function sendMessage(text, shout = null) {
  if (!text && !shout) return;

  // SFX
  if (shout) playSFX('shout');

  const payload = {
    name: GAME_STATE.username,
    role: GAME_STATE.character,
    pose: els.poseSelect.value || 'normal',
    text: text,
    shout: shout,
    timestamp: Date.now()
  };

  // Send to server
  socket.emit('message', payload);

  // Clear input
  els.input.value = '';
}

socket.on('message', (data) => {
  playMessage(data);
});

function playMessage(data) {
  setBackground(data.role);

  const roleEvents = ASSETS.characters[data.role] ? data.role : 'fighter';
  setCharacter(roleEvents, data.pose);

  els.name.textContent = data.name;
  els.name.style.backgroundColor = '#444'; // standardized color for now

  els.box.classList.remove('hidden');
  addToLog(data);

  if (data.shout) {
    triggerObjection(data.shout);
    playSFX('shout');
    // Shake
    document.querySelector('.game-container').classList.add('shake');
    setTimeout(() => document.querySelector('.game-container').classList.remove('shake'), 500);

    setTimeout(() => {
      if (data.text) typeText(data.text);
    }, 1200);
  } else {
    if (data.text) typeText(data.text);
  }
}

function setBackground(role) {
  els.bg.style.backgroundImage = `url('/background.jpg')`;
}

function setCharacter(role, pose) {
  els.charContainer.innerHTML = '';
  const src = '/fighter.png';
  const img = document.createElement('img');
  img.src = src;
  img.classList.add('character-sprite');
  els.charContainer.appendChild(img);
}

function typeText(text) {
  els.text.textContent = '';
  GAME_STATE.isTyping = true;
  let i = 0;
  playSFX('type'); // start beep

  const interval = setInterval(() => {
    if (i >= text.length) {
      clearInterval(interval);
      GAME_STATE.isTyping = false;
      return;
    }
    els.text.textContent += text[i];
    if (i % 2 === 0) playSFX('type'); // beep every other char
    i++;
  }, 30);

  els.box.onclick = () => {
    if (GAME_STATE.isTyping) {
      clearInterval(interval);
      els.text.textContent = text;
      GAME_STATE.isTyping = false;
    }
  };
}

function triggerObjection(type) {
  const text = type === 'attack' ? 'ATTACK!' : type === 'counter' ? 'COUNTER!' : type === 'break' ? 'BREAK!' : 'STRIKE!';
  els.overlay.classList.add('flash-animation');
  setTimeout(() => els.overlay.classList.remove('flash-animation'), 200);

  const bubble = document.createElement('div');
  bubble.classList.add('css-objection', 'objection-anim');
  bubble.innerText = text;
  if (type === 'counter') bubble.style.color = '#558b2f';
  else if (type === 'break') bubble.style.color = '#0055ff';

  document.getElementById('fx-container').appendChild(bubble);
  setTimeout(() => bubble.remove(), 1000);
}

function addToLog(data) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let content = '';
  if (data.shout) content = `<strong>[${data.shout.toUpperCase()}]</strong> `;
  content += data.text || '';
  entry.innerHTML = `
        <span class="timestamp">${time}</span>
        <span class="name">${data.name}:</span>
        <span class="message">${content}</span>
    `;
  els.chatLog.prepend(entry);
}

// --- Music Logic ---
els.btnPlayMusic.addEventListener('click', () => {
  const url = els.musicInput.value;
  if (url) {
    socket.emit('music_update', {
      url: url,
      isPlaying: true,
      timestamp: 0
    });
  }
});

socket.on('music_sync', (data) => {
  // data: url, isPlaying, serverTime
  if (data.url && data.url !== musicPlayer.src) {
    musicPlayer.src = data.url;
  }

  if (data.url) {
    els.nowPlaying.textContent = "Playing: " + data.url;

    if (data.isPlaying) {
      // Basic sync
      const expectedTime = (data.serverTime - data.startTime) / 1000;
      if (Math.abs(musicPlayer.currentTime - expectedTime) > 2) {
        musicPlayer.currentTime = Math.max(0, expectedTime);
      }
      musicPlayer.play().catch(e => console.log("Auto-play blocked", e));
    } else {
      musicPlayer.pause();
    }
  }
});

// --- Event Listeners ---

els.lobbyConnect.addEventListener('click', () => {
  const username = els.usernameInput.value;
  if (!username) { alert("Enter a name!"); return; }

  GAME_STATE.username = username;
  els.lobby.classList.add('hidden');
  document.getElementById('char-select-screen').classList.remove('hidden');
});

document.querySelectorAll('.char-card').forEach(card => {
  card.addEventListener('click', () => {
    const charName = card.dataset.char;
    GAME_STATE.character = charName;

    document.getElementById('char-select-screen').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('char-select-screen').classList.add('hidden');
      GAME_STATE.isConnected = true;
      els.controls.classList.remove('disabled');
      els.chatLog.classList.remove('hidden');
      els.musicPanel.classList.remove('hidden');

      const joinMsg = {
        name: 'System', role: 'judge', pose: 'normal',
        text: `Witness the arrival of ${GAME_STATE.username}!`, shout: null, timestamp: Date.now()
      };
      // socket will broadcast naturally if we send, but pure system msgs might be better handled by server?
      // For now, client sends system msg
      socket.emit('message', joinMsg);

      // Resume Audio Context on interaction
      if (audioCtx.state === 'suspended') audioCtx.resume();

    }, 500);
  });
});

els.btnSend.addEventListener('click', () => sendMessage(els.input.value));
els.input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage(els.input.value);
});

els.btnsShout.forEach(btn => {
  btn.addEventListener('click', (e) => {
    sendMessage(els.input.value, e.target.dataset.shout);
  });
});
