const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = {}; // Store rooms and connected players

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('joinRoom', (roomCode, username) => {
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [] };
        }

        // Check if the player is already in the room
        if (!rooms[roomCode].players.some(player => player.id === socket.id)) {
            rooms[roomCode].players.push({ id: socket.id, name: username });
        }

        socket.join(roomCode);
        console.log(`${username} joined room: ${roomCode}`);

        // Notify all clients in the room
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players);
    });

    socket.on('disconnect', () => {
        for (const roomCode in rooms) {
            rooms[roomCode].players = rooms[roomCode].players.filter(player => player.id !== socket.id);
            io.to(roomCode).emit('roomUpdate', rooms[roomCode].players);

            // If room is empty, delete it
            if (rooms[roomCode].players.length === 0) {
                delete rooms[roomCode];
            }
        }

        console.log(`User disconnected: ${socket.id}`);
    });
});

server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
