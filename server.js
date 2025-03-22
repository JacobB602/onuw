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

const rooms = {};
const roleTurnOrder = [
    "dream-wolf", "tanner", "villager-1", "villager-2", "villager-3", "werewolf-1", "werewolf-2", "alpha-wolf", "mystic-wolf", "minion", "apprentice-tanner",  "executioner",
    "seer", "apprentice-seer", "paranormal-investigator", "robber", "witch", "troublemaker", "gremlin", "drunk", "insomniac", "squire",
];

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('joinRoom', ({ roomCode }) => {
        console.log(`User ${socket.id} is trying to join room ${roomCode}`);
    
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [], roles: [], confirmedPlayers: {}, assignedRoles: {}, votes: {} };
        }
    
        // Check if the player is already in the room
        const existingPlayer = rooms[roomCode].players.find(player => player.id === socket.id);
        if (!existingPlayer) {
            rooms[roomCode].players.push({ id: socket.id }); // Add new player
        }
    
        socket.join(roomCode);
        console.log(`User ${socket.id} joined room: ${roomCode}`);
    
        if (rooms[roomCode].players.length > 0) {
            rooms[roomCode].hostId = rooms[roomCode].players[0].id;
        }
    
        console.log(`Updated players in room ${roomCode}:`, rooms[roomCode].players);
    
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
    });

    socket.on('joinRoomWithName', ({ roomCode, username }) => {
        console.log(`User ${socket.id} is setting their name to ${username} in room ${roomCode}`);
    
        if (!rooms[roomCode]) return;
    
        // Find the player and update their name
        const player = rooms[roomCode].players.find(player => player.id === socket.id);
        if (player) {
            player.name = username;
        } else {
            // If the player doesn't exist, add them (this should not happen if joinRoom is called first)
            rooms[roomCode].players.push({ id: socket.id, name: username });
        }
    
        console.log(`Updated players in room ${roomCode}:`, rooms[roomCode].players);
    
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
    });

    socket.on('updateRoles', ({ roomCode, roles }) => {
        if (!rooms[roomCode]) return;

        const hostId = rooms[roomCode].players[0]?.id;

        if (socket.id !== hostId) {
            console.log(`User ${socket.id} tried to update roles but is not the host.`);
            return;
        }

        rooms[roomCode].roles = roles;

        console.log(`Roles updated in room ${roomCode}:`, roles);

        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
    });

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
            io.to(socket.id).emit('error', { message: "Please select exactly " + requiredRoles + " roles." });
            return;
        }

        console.log("Starting game in room", roomCode, "...");

        rooms[roomCode].assignedRoles = assignRoles(room.players, room.roles);

        console.log("Assigned roles:", rooms[roomCode].assignedRoles);

        io.to(roomCode).emit('gameStart', rooms[roomCode].assignedRoles);

        console.log("Game started in room", roomCode);

        rooms[roomCode].gameRoleTurnOrder = roleTurnOrder.filter(role => Object.values(rooms[roomCode].assignedRoles).includes(role));
    });

    function assignRoles(players, roles) {
        const shuffledRoles = [...roles].sort(() => 0.5 - Math.random());
        const assignedRoles = {};

        players.forEach((player, index) => {
            assignedRoles[player.id] = shuffledRoles[index];
        });

        assignedRoles["center1"] = shuffledRoles[players.length];
        assignedRoles["center2"] = shuffledRoles[players.length + 1];
        assignedRoles["center3"] = shuffledRoles[players.length + 2];

        return assignedRoles;
    }

    socket.on('confirmRole', ({ roomCode }) => {
        if (!rooms[roomCode]) return;
        if (!rooms[roomCode].confirmedPlayers) {
            rooms[roomCode].confirmedPlayers = {};
        }
        rooms[roomCode].confirmedPlayers[socket.id] = true;

        io.to(roomCode).emit('roleConfirmed', {
            confirmedPlayers: rooms[roomCode].confirmedPlayers,
            players: rooms[roomCode].players
        });

        const allConfirmed = rooms[roomCode].players.every(player =>
            rooms[roomCode].confirmedPlayers[player.id]
        );

        if (allConfirmed) {
            rooms[roomCode].currentRoleIndex = 0;
            rooms[roomCode].nightPhaseActive = true;
            io.to(roomCode).emit('startNightPhase');
        }
        nextRoleTurn(roomCode);
    });

    function nextRoleTurn(roomCode) {
        if (!rooms[roomCode]) return;
        if (!rooms[roomCode].nightPhaseActive) return;

        if (rooms[roomCode].currentRoleIndex >= rooms[roomCode].gameRoleTurnOrder.length) {
            const playerCount = rooms[roomCode].players.length;
            const duration = playerCount * 5;

            const roleOrder = rooms[roomCode].gameRoleTurnOrder;
            io.to(roomCode).emit('dayPhase', { duration, roleOrder });

            let timer = duration;
            const intervalId = setInterval(() => {
                timer--;
                io.to(roomCode).emit('dayTimer', { timer });
                if (timer <= 0) {
                    clearInterval(intervalId);
                    io.to(roomCode).emit('endDayPhase');
                }
            }, 1000);
            return;
        }

        const currentRole = rooms[roomCode].gameRoleTurnOrder[rooms[roomCode].currentRoleIndex];
        const currentPlayer = rooms[roomCode].players.find(player => rooms[roomCode].assignedRoles[player.id] === currentRole);

        if (currentPlayer && currentPlayer.id.startsWith("center")) {
            rooms[roomCode].currentRoleIndex++;
            nextRoleTurn(roomCode);
            return;
        }

        io.to(roomCode).emit('nightTurn', { currentRole, currentPlayer: currentPlayer ? currentPlayer.id : null });

        let timer = 3;
        const intervalId = setInterval(() => {
            timer--;
            io.to(roomCode).emit('turnTimer', { timer });
            if (timer <= 0) {
                clearInterval(intervalId);
                rooms[roomCode].currentRoleIndex++;
                nextRoleTurn(roomCode);
            }
        }, 1000);

        if (!rooms[roomCode].turnIntervals) {
            rooms[roomCode].turnIntervals = {};
        }
        rooms[roomCode].turnIntervals[currentRole] = intervalId;
    }

    socket.on('nightActionComplete', ({ roomCode }) => {
        if (!rooms[roomCode]) return;
        const currentRole = rooms[roomCode].gameRoleTurnOrder[rooms[roomCode].currentRoleIndex];
        if (rooms[roomCode].turnIntervals && rooms[roomCode].turnIntervals[currentRole]) {
            clearInterval(rooms[roomCode].turnIntervals[currentRole]);
            delete rooms[roomCode].turnIntervals[currentRole];
        }
        rooms[roomCode].currentRoleIndex++;
        nextRoleTurn(roomCode);
    });

    socket.on('startDayPhase', (roomCode) => {
        if (!rooms[roomCode]) return;
        const duration = rooms[roomCode].players.length * 60; // 1 minute per player
        io.to(roomCode).emit('dayPhase', { duration, roleOrder: rooms[roomCode].gameRoleTurnOrder });

        let timer = duration;
        const intervalId = setInterval(() => {
            timer--;
            io.to(roomCode).emit('dayTimer', { timer });
            if (timer <= 0) {
                clearInterval(intervalId);
                io.to(roomCode).emit('endDayPhase');
            }
        }, 1000);
    });

    socket.on('endDayPhase', (roomCode) => {
        if (!rooms[roomCode]) return;
        rooms[roomCode].votes = {}; // Initialize votes
        io.to(roomCode).emit('endDayPhase');
    });

    socket.on('requestPlayerList', (roomCode) => {
        if (!rooms[roomCode]) return;
        io.to(socket.id).emit('playerList', rooms[roomCode].players);
    });

    socket.on('castVote', ({ roomCode, votedPlayerId }) => {
        if (!rooms[roomCode]) return;
        if (!rooms[roomCode].votes) {
            rooms[roomCode].votes = {};
        }

        rooms[roomCode].votes[votedPlayerId] = (rooms[roomCode].votes[votedPlayerId] || 0) + 1;

        console.log(`Room ${roomCode}: Vote cast - ${socket.id} voted for ${votedPlayerId}`);
        console.log(`Room ${roomCode}: Current votes -`, rooms[roomCode].votes);

        // No longer checking if all players voted, rely on timer instead.
    });

    socket.on('endVotingPhase', (roomCode) => {
        if (!rooms[roomCode]) return;

        // Determine the player with the most votes
        let maxVotes = 0;
        let votedPlayerId;
        for (const playerId in rooms[roomCode].votes) {
            if (rooms[roomCode].votes[playerId] > maxVotes) {
                maxVotes = rooms[roomCode].votes[playerId];
                votedPlayerId = playerId;
            }
        }

        // Determine the winner (logic based on your game rules)
        let winningTeam = determineWinner(rooms[roomCode].assignedRoles, votedPlayerId, rooms[roomCode].players);

        // Notify all players of the voting result and game outcome
        io.to(roomCode).emit('votingResult', { votedPlayerId, votes: rooms[roomCode].votes, winningTeam: winningTeam });
    });

    function determineWinner(assignedRoles, votedPlayerId, players) {
        const votedPlayerRole = assignedRoles[votedPlayerId];
        const werewolfRoles = ["werewolf-1", "werewolf-2", "alpha-wolf", "mystic-wolf", "dream-wolf"];
        const tannerRoles = ["tanner", "apprentice-tanner"];

        if (werewolfRoles.includes(votedPlayerRole)) {
            // Werewolf was voted out. Villagers win unless Tanner wins.
            if (tannerRoles.some(tannerRole => Object.values(assignedRoles).includes(tannerRole))) {
                return "Tanner";
            } else {
                return "Villagers";
            }
        } else {
            // Werewolf was not voted out. Werewolves win unless Tanner wins.
            if (tannerRoles.some(tannerRole => Object.values(assignedRoles).includes(tannerRole))) {
                return "Tanner";
            } else {
                return "Werewolves";
            }
        }
    }

    socket.on('playAgain', (roomCode) => {
        if (!rooms[roomCode]) return;
    
        // Initialize playAgainPlayers if it doesn't exist
        if (!rooms[roomCode].playAgainPlayers) {
            rooms[roomCode].playAgainPlayers = {};
        }
    
        // Mark the current player as ready to play again
        rooms[roomCode].playAgainPlayers[socket.id] = true;
    
        // Check if all players want to play again
        const allPlayAgain = rooms[roomCode].players.every(player =>
            rooms[roomCode].playAgainPlayers[player.id]
        );
    
        if (allPlayAgain) {
            // Reset the game state
            rooms[roomCode].confirmedPlayers = {};
            rooms[roomCode].assignedRoles = {}; // Clear assigned roles
            rooms[roomCode].votes = {};
            rooms[roomCode].playAgainPlayers = {};
            rooms[roomCode].nightPhaseActive = false;
            rooms[roomCode].currentRoleIndex = 0;
            rooms[roomCode].turnIntervals = {};
    
            // Notify all players to reset their UI
            io.to(roomCode).emit('resetGame');
    
            // Emit the updated player list and roles
            io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
        }
    });

    // Handle disconnects
    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);

        for (const roomCode in rooms) {
            rooms[roomCode].players = rooms[roomCode].players.filter(player => player.id !== socket.id);

            if (rooms[roomCode].players.length === 0) {
                delete rooms[roomCode];
                console.log(`Room ${roomCode} deleted (empty).`);
            } else {
                if (rooms[roomCode].players.length > 0) {
                    rooms[roomCode].hostId = rooms[roomCode].players[0].id;
                }
                io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
            }
        }
    });
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});