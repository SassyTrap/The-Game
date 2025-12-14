const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity (Itch.io uses its own iframe domains)
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
  res.send('Chat Server is Running');
});

io.on('connection', (socket) => {
  console.log('a user connected: ' + socket.id);

  socket.on('chat message', (msg) => {
    // Broadcast to everyone including sender
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
