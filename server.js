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

function getGameRoleTurnOrder(selectedRoles) {
    // This is the canonical turn order
    const fullOrder = [
        "dream-wolf", "tanner", "villager-1", "villager-2", "villager-3",
        "werewolf-1", "werewolf-2", "serpent", "mystic-wolf", "minion",
        "apprentice-tanner", "sentinel", "seer", "apprentice-seer",
        "paranormal-investigator", "robber", "witch", "troublemaker",
        "gremlin", "drunk", "insomniac", "squire"
    ];
    
    // Filter to only include roles that are actually in the game
    return fullOrder.filter(role => selectedRoles.includes(role));
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('joinRoom', ({ roomCode }) => {
        console.log(`User ${socket.id} is trying to join room ${roomCode}`);
    
        if (!rooms[roomCode]) {
            rooms[roomCode] = { 
                players: [], 
                roles: [], 
                confirmedPlayers: {}, 
                assignedRoles: {}, 
                votes: {} 
            };
        }
    
        const existingPlayer = rooms[roomCode].players.find(player => player.id === socket.id);
        if (!existingPlayer) {
            rooms[roomCode].players.push({ id: socket.id });
        }
    
        socket.join(roomCode);
        console.log(`User ${socket.id} joined room: ${roomCode}`);
    
        if (rooms[roomCode].players.length > 0) {
            rooms[roomCode].hostId = rooms[roomCode].players[0].id;
        }
    
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
    });

    socket.on('joinRoomWithName', ({ roomCode, username }) => {
        if (!rooms[roomCode]) return;
    
        const player = rooms[roomCode].players.find(player => player.id === socket.id);
        if (player) {
            player.name = username;
        } else {
            rooms[roomCode].players.push({ id: socket.id, name: username });
        }
    
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
    });

    socket.on('updateRoles', ({ roomCode, roles }) => {
        if (!rooms[roomCode]) return;

        if (socket.id !== rooms[roomCode].players[0]?.id) {
            console.log(`User ${socket.id} tried to update roles but is not the host.`);
            return;
        }

        rooms[roomCode].roles = roles;
        io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
    });

    socket.on('startGame', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Reset game state
        room.confirmedPlayers = {};
        room.currentRoleIndex = 0;
        room.nightPhaseActive = false;
        
        // Generate turn order based on ACTUAL selected roles
        room.gameRoleTurnOrder = getGameRoleTurnOrder(room.roles);
        console.log('Game turn order:', room.gameRoleTurnOrder);
        
        // Assign roles
        room.assignedRoles = assignRoles(roomCode, room.players, room.roles);
        io.to(roomCode).emit('gameStart', room.assignedRoles);
    });

    function assignRoles(roomCode, players, roles) {
        // Create a copy of roles without modifying the original
        const rolesToAssign = [...roles];
        
        // Remove 3 center cards first
        const centerRoles = [];
        for (let i = 0; i < 3; i++) {
            const randomIndex = Math.floor(Math.random() * rolesToAssign.length);
            centerRoles.push(rolesToAssign.splice(randomIndex, 1)[0]);
        }
    
        // Assign player roles
        const assignedRoles = {};
        players.forEach(player => {
            const randomIndex = Math.floor(Math.random() * rolesToAssign.length);
            assignedRoles[player.id] = rolesToAssign.splice(randomIndex, 1)[0];
        });
    
        // Assign center roles
        assignedRoles["center1"] = centerRoles[0];
        assignedRoles["center2"] = centerRoles[1];
        assignedRoles["center3"] = centerRoles[2];
    
        // Store in room state
        rooms[roomCode].startingRoles = {...assignedRoles};
        rooms[roomCode].originalRoles = {...assignedRoles};
        rooms[roomCode].assignedRoles = {...assignedRoles};
    
        // ===== ADD LOGGING RIGHT HERE =====
        console.log('\n=== ROLE ASSIGNMENT DEBUG ===');
        console.log(`Room: ${roomCode}`);
        console.log('Players:');
        players.forEach(player => {
            console.log(`- ${player.name || 'Unnamed'} (${player.id}): ${assignedRoles[player.id]}`);
        });
        console.log('Center Cards:');
        console.log(`- Center 1: ${assignedRoles["center1"]}`);
        console.log(`- Center 2: ${assignedRoles["center2"]}`);
        console.log(`- Center 3: ${assignedRoles["center3"]}\n`);
        // ===== END LOGGING =====
    
        return assignedRoles;
    }

    socket.on('confirmRole', ({ roomCode }) => {
        if (!rooms[roomCode]) return;
        
        rooms[roomCode].confirmedPlayers[socket.id] = true;
        
        const allConfirmed = rooms[roomCode].players.every(player =>
            rooms[roomCode].confirmedPlayers[player.id]
        );
    
        if (allConfirmed) {
            rooms[roomCode].currentRoleIndex = 0;
            rooms[roomCode].nightPhaseActive = true;
            
            // Force all clients to clear their UI first
            io.to(roomCode).emit('prepareForNightPhase');
            
            // Small delay to ensure clients are ready
            setTimeout(() => {
                nextRoleTurn(roomCode);
            }, 100);
        } else {
            // Update confirmation status
            io.to(roomCode).emit('roleConfirmed', {
                confirmedPlayers: rooms[roomCode].confirmedPlayers,
                players: rooms[roomCode].players
            });
        }
    });

    // Role-specific action handlers
    socket.on('seerAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        if (Array.isArray(target)) {
            const centerRoles = target.map(centerCard => getShownRole(room, centerCard));
            io.to(socket.id).emit('seerResult', { targetRole: centerRoles });
        } else {
            const playerRole = getShownRole(room, target);
            io.to(socket.id).emit('seerResult', { targetRole: playerRole });
        }
    });
    
    socket.on('mysticWolfAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const targetRole = getShownRole(room, target);
        if (!targetRole) {
            io.to(socket.id).emit('error', { message: "Invalid player selected." });
            return;
        }
    
        io.to(socket.id).emit('mysticWolfResult', { targetRole });
    });

    socket.on('robberAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        if (room.assignedRoles[socket.id].startsWith('stolen-')) {
            io.to(socket.id).emit('error', { message: "You can only steal one role per game." });
            return;
        }
    
        const robberRole = room.assignedRoles[socket.id];
        const targetRole = room.assignedRoles[target];
        room.assignedRoles[socket.id] = `stolen-${targetRole}`;
        room.assignedRoles[target] = robberRole;
    
        io.to(socket.id).emit('robberResult', { newRole: targetRole });
    });

    socket.on('troublemakerAction', ({ roomCode, targets }) => {
        const room = rooms[roomCode];
        if (!room || targets.length !== 2) {
            io.to(socket.id).emit('error', { message: "You must select exactly two players." });
            return;
        }
    
        const [player1, player2] = targets;
        const tempRole = room.assignedRoles[player1];
        room.assignedRoles[player1] = room.assignedRoles[player2];
        room.assignedRoles[player2] = tempRole;
    
        io.to(socket.id).emit('troublemakerResult', { message: "Roles swapped successfully!" });
    });

    socket.on('insomniacAction', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const insomniacRole = room.assignedRoles[socket.id];
        io.to(socket.id).emit('insomniacResult', { role: insomniacRole });
    });

    socket.on('witchViewAction', ({ roomCode, centerCard }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const cardRole = getShownRole(room, centerCard);
        io.to(socket.id).emit('witchViewResult', { 
            centerCard: centerCard,
            centerRole: cardRole 
        });
    });
    
    socket.on('witchGiveAction', ({ roomCode, centerCard, targetPlayer }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const centerRole = room.assignedRoles[centerCard];
        const playerRole = room.assignedRoles[targetPlayer];
        
        room.assignedRoles[centerCard] = playerRole;
        room.assignedRoles[targetPlayer] = centerRole;
    
        io.to(socket.id).emit('witchGiveResult', { 
            message: `You gave ${centerCard} to ${room.players.find(p => p.id === targetPlayer)?.name || "Unknown"}` 
        });
    
        room.currentRoleIndex++;
        nextRoleTurn(roomCode);
    });

    socket.on('drunkAction', ({ roomCode, targetCenter }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const drunkRole = room.assignedRoles[socket.id];
        const centerRole = room.assignedRoles[targetCenter];
        
        room.assignedRoles[socket.id] = centerRole;
        room.assignedRoles[targetCenter] = drunkRole;
        
        io.to(socket.id).emit('drunkResult', { 
            message: `You swapped with ${targetCenter}` 
        });
    });

    socket.on('piAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room || !room.nightPhaseActive) return;
    
        const targetRole = getShownRole(room, target);
        const isWerewolf = ['werewolf-1', 'werewolf-2', 'serpent', 'mystic-wolf', 'dream-wolf']
            .includes(targetRole);
    
        if (isWerewolf) {
            const newWerewolfType = ['werewolf-1', 'werewolf-2'][Math.floor(Math.random() * 2)];
            room.assignedRoles[socket.id] = newWerewolfType;
            
            io.to(socket.id).emit('piResult', { 
                isWerewolf: true,
                newRole: newWerewolfType,
                targetRole
            });
        } else {
            io.to(socket.id).emit('piResult', { 
                isWerewolf: false,
                targetRole
            });
        }
    });

    socket.on('gremlinAction', ({ roomCode, targets }) => {
        const room = rooms[roomCode];
        if (!room || targets.length !== 2) {
            io.to(socket.id).emit('error', { message: "You must select exactly two players" });
            return;
        }
    
        const temp = room.assignedRoles[targets[0]];
        room.assignedRoles[targets[0]] = room.assignedRoles[targets[1]];
        room.assignedRoles[targets[1]] = temp;
    
        io.to(socket.id).emit('gremlinResult', { 
            message: "Roles swapped successfully!"
        });
    });

    socket.on('minionAction', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const werewolves = room.players.filter(player => 
            ["werewolf-1", "werewolf-2", "serpent", "mystic-wolf", "dream-wolf"]
            .includes(room.assignedRoles[player.id])
        ).map(w => w.name || "Unnamed");
    
        io.to(socket.id).emit('minionResult', { 
            werewolves,
            noWerewolves: werewolves.length === 0
        });
    });

    socket.on('squireAction', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const currentWerewolves = room.players.filter(player => 
            ["werewolf-1", "werewolf-2", "mystic-wolf", "dream-wolf", "serpent"]
            .includes(room.assignedRoles[player.id])
        ).map(w => ({
            name: w.name || "Unnamed",
            originalRole: room.originalRoles[w.id]
        }));
    
        io.to(socket.id).emit('squireResult', { 
            werewolves: currentWerewolves,
            noWerewolves: currentWerewolves.length === 0
        });
    });

    socket.on('apprenticeSeerAction', ({ roomCode, card }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const cardRole = getShownRole(room, card);
        io.to(socket.id).emit('apprenticeSeerResult', {
            card: card,
            role: cardRole
        });
    });

    socket.on('serpentAction', ({ roomCode, targets }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const allRoles = [...new Set([...room.roles, ...Object.values(room.assignedRoles)])];
    
        if (!room.serpentDeceptions) {
            room.serpentDeceptions = {};
        }
    
        targets.forEach(target => {
            if (!room.serpentDeceptions[target]) {
                room.serpentDeceptions[target] = {
                    actual: room.assignedRoles[target],
                    shown: allRoles[Math.floor(Math.random() * allRoles.length)]
                };
            }
        });
    
        io.to(socket.id).emit('serpentResult', { targets });
    });

    function getShownRole(room, target) {
        if (room.serpentDeceptions && room.serpentDeceptions[target]) {
            return room.serpentDeceptions[target].shown;
        }
        return room.assignedRoles[target];
    }

    socket.on('werewolfActionComplete', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || !room.currentTimer) return;
        
        // Force move to next role
        clearInterval(room.currentTimer);
        room.currentRoleIndex++;
        nextRoleTurn(roomCode);
    });

    socket.on('viewCenterCard', ({ roomCode, card }) => {
        const room = rooms[roomCode];
        if (!room) return;
        
        io.to(socket.id).emit('centerCardViewed', {
            card: card,
            role: getShownRole(room, card)
        });
    });

    socket.on('requestPlayerList', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            const players = room.players.map(player => ({
                id: player.id,
                name: player.name
            }));
            socket.emit('playerList', players);
        }
    });

    function nextRoleTurn(roomCode) {
        const room = rooms[roomCode];
        if (!room || !room.nightPhaseActive) return;
    
        if (room.currentTimer) clearInterval(room.currentTimer);
    
        // Skip roles with no active players
        while (room.currentRoleIndex < room.gameRoleTurnOrder.length) {
            const currentRole = room.gameRoleTurnOrder[room.currentRoleIndex];
            const activePlayers = room.players.filter(p => 
                room.startingRoles[p.id] === currentRole
            );
            
            if (activePlayers.length > 0 || Object.values(room.startingRoles).includes(currentRole)) {
                break;
            }
            room.currentRoleIndex++;
        }
    
        if (room.currentRoleIndex >= room.gameRoleTurnOrder.length) {
            room.nightPhaseActive = false;
            io.to(roomCode).emit('startDayPhase');
            return;
        }
    
        const currentRole = room.gameRoleTurnOrder[room.currentRoleIndex];
        const currentPlayers = room.players.filter(p => 
            room.startingRoles[p.id] === currentRole
        );
    
        // Special case for werewolves - extend timer if multiple
        const timerDuration = (['werewolf-1', 'werewolf-2', 'mystic-wolf', 'dream-wolf', 'serpent'].includes(currentRole) && 
                             currentPlayers.length > 1) ? 25 : 15;
    
        let timer = timerDuration;
        room.currentTimer = setInterval(() => {
            timer--;
            io.to(roomCode).emit('turnTimer', { timer });
            
            if (timer <= 0) {
                clearInterval(room.currentTimer);
                room.currentRoleIndex++;
                nextRoleTurn(roomCode);
            }
        }, 1000);
    
        // Notify players
        currentPlayers.forEach(player => {
            io.to(player.id).emit('nightTurn', {
                currentRole: currentRole,
                currentPlayer: player.id,
                isOriginalRole: room.assignedRoles[player.id] === room.startingRoles[player.id],
                actualCurrentRole: room.assignedRoles[player.id]
            });
        });
        
        room.players.forEach(player => {
            if (!currentPlayers.some(p => p.id === player.id)) {
                io.to(player.id).emit('nightTurn', {
                    currentRole: currentRole,
                    currentPlayer: null
                });
            }
        });
    }

    socket.on('startDayPhase', (roomCode) => {
        if (!rooms[roomCode]) return;
        const duration = rooms[roomCode].players.length * 60;
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
        rooms[roomCode].votes = {};
        io.to(roomCode).emit('endDayPhase');
    });

    socket.on('castVote', ({ roomCode, votedPlayerId }) => {
        if (!rooms[roomCode]) return;
        if (!rooms[roomCode].votes) {
            rooms[roomCode].votes = {};
        }

        rooms[roomCode].votes[votedPlayerId] = (rooms[roomCode].votes[votedPlayerId] || 0) + 1;
    });

    socket.on('endVotingPhase', (roomCode) => {
        if (!rooms[roomCode]) return;
    
        let maxVotes = 0;
        let votedPlayerId;
        for (const playerId in rooms[roomCode].votes) {
            if (rooms[roomCode].votes[playerId] > maxVotes) {
                maxVotes = rooms[roomCode].votes[playerId];
                votedPlayerId = playerId;
            }
        }
    
        const winningTeam = determineWinner(rooms[roomCode].assignedRoles, votedPlayerId, rooms[roomCode].players);
        const roleReveal = rooms[roomCode].players.map(player => ({
            id: player.id,
            name: player.name || "Unnamed",
            role: rooms[roomCode].assignedRoles[player.id],
            originalRole: rooms[roomCode].startingRoles[player.id]
        }));
    
        const centerCards = {
            center1: rooms[roomCode].assignedRoles["center1"],
            center2: rooms[roomCode].assignedRoles["center2"],
            center3: rooms[roomCode].assignedRoles["center3"]
        };
    
        io.to(roomCode).emit('votingResult', { 
            votedPlayerId, 
            votes: rooms[roomCode].votes, 
            winningTeam,
            roleReveal,
            centerCards
        });
    });

    function determineWinner(assignedRoles, votedPlayerId, players) {
        const werewolfRoles = ["werewolf-1", "werewolf-2", "serpent", "mystic-wolf", "dream-wolf"];
        const tannerRoles = ["tanner", "apprentice-tanner"];
        
        const someoneDied = votedPlayerId !== undefined && votedPlayerId !== null;
        const votedPlayerRole = someoneDied ? assignedRoles[votedPlayerId] : null;
    
        if (someoneDied && tannerRoles.includes(votedPlayerRole)) {
            return "Tanner";
        }
    
        const werewolvesPresent = werewolfRoles.some(role => 
            Object.values(assignedRoles).includes(role)
        );
        const werewolfDied = someoneDied && werewolfRoles.includes(votedPlayerRole);
    
        if (werewolfDied || (!werewolvesPresent && !someoneDied)) {
            return "Villagers";
        }
    
        if (werewolvesPresent && !werewolfDied) {
            return "Werewolves";
        }
    
        return "Villagers";
    }

    socket.on('playAgain', (roomCode) => {
        if (!rooms[roomCode]) return;
    
        if (!rooms[roomCode].playAgainPlayers) {
            rooms[roomCode].playAgainPlayers = {};
        }
    
        rooms[roomCode].playAgainPlayers[socket.id] = true;
    
        const allPlayAgain = rooms[roomCode].players.every(player =>
            rooms[roomCode].playAgainPlayers[player.id]
        );
    
        if (allPlayAgain) {
            if (rooms[roomCode].currentTimer) {
                clearInterval(rooms[roomCode].currentTimer);
            }
            
            rooms[roomCode].confirmedPlayers = {};
            rooms[roomCode].assignedRoles = {};
            rooms[roomCode].votes = {};
            rooms[roomCode].playAgainPlayers = {};
            rooms[roomCode].nightPhaseActive = false;
            rooms[roomCode].currentRoleIndex = 0;
    
            io.to(roomCode).emit('resetGame');
            io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);

        for (const roomCode in rooms) {
            rooms[roomCode].players = rooms[roomCode].players.filter(player => player.id !== socket.id);

            if (rooms[roomCode].players.length === 0) {
                delete rooms[roomCode];
            } else if (rooms[roomCode].players.length > 0) {
                rooms[roomCode].hostId = rooms[roomCode].players[0].id;
                io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
            }
        }
    });
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});