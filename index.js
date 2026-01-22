const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Use allow-all CORS for simplicity in this setup
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// IN-MEMORY DATA STORAGE (Note: This wipes if server restarts. Real apps use a Database)
let users = [
    { id: 99999, username: "RacBot", avatar: "logo.png", isBot: true }
];
let posts = [
    {
        id: 1,
        userId: 999,
        username: "Admin",
        avatar: "img/default-avatar.png",
        content: "Welcome to Rac Com Global! This is the start of the public feed.",
        likes: 0,
        likedBy: [],
        dislikes: 0,
        dislikedBy: [],
        comments: [],
        createdAt: new Date().toISOString()
    }
];
let messages = []; // { id, senderId, receiverId, text, time }

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send('Rac Com Backend Live');
});

// GET All Users
app.get('/api/users', (req, res) => {
    res.json(users);
});

// LOGIN/REGISTER
app.post('/api/users', (req, res) => {
    const user = req.body;

    // Check for Username Collision (Case-insensitive)
    const collision = users.find(u =>
        u.username.toLowerCase() === user.username.toLowerCase() &&
        u.id !== user.id
    );

    if (collision) {
        return res.status(409).json({ error: "Username already taken" });
    }

    const existing = users.find(u => u.id === user.id);
    if (!existing) {
        users.push(user);
    } else {
        Object.assign(existing, user);
    }
    io.emit('update-user-list', users);
    res.json({ status: 'ok' });
});

// GET Public Feed
app.get('/api/posts', (req, res) => {
    // Return posts sorted new to old
    res.json(posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// CREATE Post
app.post('/api/posts', (req, res) => {
    const { userId, username, avatar, content } = req.body;

    const newPost = {
        id: Date.now(), // simple ID
        userId,
        username,
        avatar,
        content,
        likes: 0,
        likedBy: [],
        dislikes: 0,
        dislikedBy: [],
        comments: [],
        createdAt: new Date().toISOString()
    };

    posts.unshift(newPost); // Add to top

    // Broadcast via Socket so everyone sees it instantly
    io.emit('new-post', newPost);

    res.status(201).json(newPost);
});

// LIKE Post
app.post('/api/posts/:id/like', (req, res) => {
    const { userId } = req.body;
    const postId = parseInt(req.params.id);
    const post = posts.find(p => p.id === postId);

    if (post) {
        if (!post.likedBy.includes(userId)) {
            post.likedBy.push(userId);
            post.likes++;
        }
        io.emit('update-post', post); // Update everyone's view
        res.json(post);
    } else {
        res.status(404).json({ error: "Post not found" });
    }
});

// COMMENT on Post
app.post('/api/posts/:id/comment', (req, res) => {
    const { userId, username, avatar, text } = req.body;
    const postId = parseInt(req.params.id);
    const post = posts.find(p => p.id === postId);

    if (post) {
        const newComment = {
            id: Date.now(),
            userId,
            username,
            avatar,
            text,
            createdAt: new Date().toISOString()
        };
        post.comments.push(newComment);
        io.emit('update-post', post);

        // Notification Logic
        if (post.userId !== userId) {
            io.to('user_' + post.userId).emit('notification', {
                type: 'reply',
                text: `${username} commented on your post`,
                postId: postId
            });
        }

        res.json(post);
    } else {
        res.status(404).json({ error: "Post not found" });
    }
});

// --- SOCKETS (Real-time) ---

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a personal room for DMs based on UserID
    socket.on('join', (userId) => {
        socket.join('user_' + userId);
        console.log(`User ${userId} joined room user_${userId}`);
    });

    // Handle Private Message
    socket.on('private-message', ({ senderId, receiverId, text }) => {
        const msg = {
            id: Date.now(),
            senderId,
            receiverId,
            text,
            time: new Date().toISOString()
        };
        messages.push(msg);

        // Send to specific receiver ONLY
        io.to('user_' + receiverId).emit('dm-received', msg);
        // Also send back to sender so they see it
        socket.emit('dm-sent', msg);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Render URL: https://the-game-rivf.onrender.com`);
});
