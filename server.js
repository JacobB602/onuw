const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;
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

    // Handle joining a room
    socket.on('joinRoom', ({ roomCode }) => {
        console.log(`User ${socket.id} is trying to join room ${roomCode}`);

        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [], roles: [] };
        }

        // Join the room
        socket.join(roomCode);
        console.log(`User ${socket.id} joined room: ${roomCode}`);

        // Add player to the room
        rooms[roomCode].players.push({ id: socket.id });

        // Update hostId
        if (rooms[roomCode].players.length > 0) {
            rooms[roomCode].hostId = rooms[roomCode].players[0].id;
        }

        // Log the current players in the room
        console.log(`Updated players in room ${roomCode}:`, rooms[roomCode].players);

        // Notify all players of room updates
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
    });

    // Handle setting username
    socket.on('joinRoomWithName', ({ roomCode, username }) => {
        console.log(`User ${socket.id} is setting their name to ${username} in room ${roomCode}`);

        if (!rooms[roomCode]) return;

        // Assign username
        const player = rooms[roomCode].players.find(player => player.id === socket.id);
        if (player) {
            player.name = username;
        }

        console.log(`Updated players in room ${roomCode}:`, rooms[roomCode].players);

        // Notify all players of updates
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
    });

    // Handle updating roles (when host saves settings)
    socket.on('updateRoles', ({ roomCode, roles }) => {
        if (!rooms[roomCode]) return;
    
        // First player in list is the host
        const hostId = rooms[roomCode].players[0]?.id;
    
        // Check if the current user is the host
        if (socket.id !== hostId) {
            console.log(`User ${socket.id} tried to update roles but is not the host.`);
            return;
        }
    
        // Update the roles in the room (roles is already an array)
        rooms[roomCode].roles = roles;
    
        console.log(`Roles updated in room ${roomCode}:`, roles);
    
        // Notify all players in the room about the updated roles
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
    });

    // Handle starting the game (when the host clicks "Start Game")
    socket.on('startGame', ({ roomCode }) => {
        console.log("startGame event received for room:", roomCode);
        const room = rooms[roomCode];
        if (!room) return;
    
        if (room.hostId !== socket.id) {
            console.log("Only the host can start the game.");
            return;
        }
    
        const requiredRoles = room.players.length + 3;
        if (room.roles.length !== requiredRoles) {
            console.log("Incorrect number of roles selected.");
            return;
        }
    
        console.log("Starting game in room", roomCode, "...");
    
        // Assign roles to players
        const assignedRoles = assignRoles(room.players, room.roles);
    
        // Log assigned roles for debugging
        console.log("Assigned roles:", assignedRoles);
    
        // Send roles and start game event to clients
        io.to(roomCode).emit('gameStart', assignedRoles);
    
        console.log("Game started in room", roomCode);
    });
    
    function assignRoles(players, roles) {
        const shuffledRoles = [...roles].sort(() => 0.5 - Math.random()); // Shuffle roles
        const assignedRoles = {};
    
        players.forEach((player, index) => {
            assignedRoles[player.id] = shuffledRoles[index];
        });
    
        return assignedRoles;
    }

    // Handle disconnects
    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);

        for (const roomCode in rooms) {
            rooms[roomCode].players = rooms[roomCode].players.filter(player => player.id !== socket.id);

            if (rooms[roomCode].players.length === 0) {
                delete rooms[roomCode];
                console.log(`Room ${roomCode} deleted (empty).`);
            } else {
                // Update hostId
                if (rooms[roomCode].players.length > 0) {
                    rooms[roomCode].hostId = rooms[roomCode].players[0].id;
                }
                io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
            }
        }
    });
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
});