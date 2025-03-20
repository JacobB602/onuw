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

const rooms = {}; // Stores active rooms

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle joining a room with only the room code
    socket.on('joinRoom', ({ roomCode }) => {
        console.log(`User ${socket.id} is trying to join room ${roomCode}`);

        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [] };
        }

        // Join the room without a name yet
        socket.join(roomCode);
        console.log(`User ${socket.id} joined room: ${roomCode}`);

        // Add player by ID (name will be added later)
        rooms[roomCode].players.push({ id: socket.id });

        // Log the current players in the room
        console.log(`Updated players in room ${roomCode}:`, rooms[roomCode].players);

        // Broadcast updated player list to everyone in the room
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players);
    });

    // Handle joining with a name after entering the room
    socket.on('joinRoomWithName', ({ roomCode, username }) => {
        console.log(`User ${socket.id} is setting their name to ${username} in room ${roomCode}`);
    
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [] };
        }
    
        // Find the player by ID and update their name
        const player = rooms[roomCode].players.find(player => player.id === socket.id);
        if (player) {
            player.name = username;
            console.log(`Updated player ${socket.id} with name: ${username}`);
        }
    
        // Log the current players in the room
        console.log(`Updated players in room ${roomCode}:`, rooms[roomCode].players);
    
        // Broadcast updated player list to everyone in the room
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players);
    });

    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);
        for (const roomCode in rooms) {
            const prevLength = rooms[roomCode].players.length;
            rooms[roomCode].players = rooms[roomCode].players.filter(player => player.id !== socket.id);

            // Log the updated player list after a disconnection
            console.log(`Updated players in room ${roomCode} after disconnection:`, rooms[roomCode].players);

            // Notify remaining players in the room
            io.to(roomCode).emit('roomUpdate', rooms[roomCode].players);

            if (rooms[roomCode].players.length === 0) {
                delete rooms[roomCode];
                console.log(`Room ${roomCode} deleted (was empty).`);
            }
        }
    });
});

server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
