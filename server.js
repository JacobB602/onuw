
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
    const turnOrder = [
        // Individual werewolf roles
        "mystic-wolf",
        "dream-wolf",
        "serpent",
        
        // Information roles
        "minion",
        "apprentice-tanner",
        
        // Action roles
        "seer",
        "apprentice-seer",
        "paranormal-investigator",
        "robber",
        "witch",
        "troublemaker",
        "gremlin",
        "drunk",
        
        // End of night roles
        "squire",
        "insomniac"       
    ];

    // Filter to only include roles that are in the game
    return turnOrder.filter(role => 
        role === "werewolf-team" || // Always include team phase if we added it
        selectedRoles.includes(role)
    );
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
                originalRoles: {},
                votes: {},
                nightPhaseActive: false,
                currentRoleIndex: 0
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

        // Only host can update roles
        if (socket.id !== rooms[roomCode].hostId) {
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
        room.votes = {};
        
        // Generate turn order based on selected roles
        room.gameRoleTurnOrder = getGameRoleTurnOrder(room.roles);
        console.log('Game turn order:', room.gameRoleTurnOrder);
        
        // Assign roles
        assignRoles(roomCode);
        io.to(roomCode).emit('gameStart', room.assignedRoles);
    });

    function assignRoles(roomCode) {
        const room = rooms[roomCode];
        if (!room) return;
        
        // Create a copy of roles without modifying the original
        const rolesToAssign = [...room.roles];
        
        // Remove 3 center cards first
        const centerRoles = [];
        for (let i = 0; i < 3; i++) {
            const randomIndex = Math.floor(Math.random() * rolesToAssign.length);
            centerRoles.push(rolesToAssign.splice(randomIndex, 1)[0]);
        }
    
        // Assign player roles
        const assignedRoles = {};
        room.players.forEach(player => {
            const randomIndex = Math.floor(Math.random() * rolesToAssign.length);
            assignedRoles[player.id] = rolesToAssign.splice(randomIndex, 1)[0];
        });
    
        // Assign center roles
        assignedRoles["center1"] = centerRoles[0];
        assignedRoles["center2"] = centerRoles[1];
        assignedRoles["center3"] = centerRoles[2];
    
        // Store in room state
        room.startingRoles = {...assignedRoles};
        room.originalRoles = {...assignedRoles};
        room.assignedRoles = {...assignedRoles};
    
        // Debug logging
        console.log('\n=== ROLE ASSIGNMENT ===');
        console.log(`Room: ${roomCode}`);
        console.log('Players:');
        room.players.forEach(player => {
            console.log(`- ${player.name || 'Unnamed'} (${player.id}): ${assignedRoles[player.id]}`);
        });
        console.log('Center Cards:');
        console.log(`- Center 1: ${assignedRoles["center1"]}`);
        console.log(`- Center 2: ${assignedRoles["center2"]}`);
        console.log(`- Center 3: ${assignedRoles["center3"]}\n`);
    }

    socket.on('confirmRole', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
        
        room.confirmedPlayers[socket.id] = true;
        
        const allConfirmed = room.players.every(player =>
            room.confirmedPlayers[player.id]
        );
    
        if (allConfirmed) {
            room.currentRoleIndex = 0;
            room.nightPhaseActive = true;
            
            // Clear all clients' UI first
            io.to(roomCode).emit('prepareForNightPhase');
            
            // Small delay to ensure clients are ready
            setTimeout(() => {
                nextRoleTurn(roomCode);
            }, 100);
        } else {
            // Update confirmation status
            io.to(roomCode).emit('roleConfirmed', {
                confirmedPlayers: room.confirmedPlayers,
                players: room.players
            });
        }
    });

    // Role action handlers
    socket.on('seerAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        if (Array.isArray(target)) {
            // View two center cards
            const centerRoles = target.map(centerCard => getShownRole(room, centerCard));
            io.to(socket.id).emit('seerResult', { targetRole: centerRoles });
        } else {
            // View one player's card
            const playerRole = getShownRole(room, target);
            io.to(socket.id).emit('seerResult', { targetRole: playerRole });
        }
    });
    
    socket.on('mysticWolfAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Find the target player
        const targetPlayer = room.players.find(p => p.id === target);
        if (!targetPlayer) {
            io.to(socket.id).emit('error', { message: "Player not found" });
            return;
        }
    
        // Get the target's role (accounting for any deception)
        const targetRole = getShownRole(room, target);
        
        // Send the result to the Mystic Wolf
        io.to(socket.id).emit('mysticWolfResult', { 
            targetRole: targetRole,
            targetName: targetPlayer.name || "Unknown"
        });
    
        // Mark action as complete (but don't advance turn yet)
        if (room.gameState) {
            room.gameState.completedActions.push('mystic-wolf');
        }
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
        if (!room || targets.length !== 2) return;
    
        const [player1, player2] = targets;
        const tempRole = room.assignedRoles[player1];
        room.assignedRoles[player1] = room.assignedRoles[player2];
        room.assignedRoles[player2] = tempRole;
    
        io.to(socket.id).emit('troublemakerResult', { message: "Roles swapped successfully!" });
    });

    socket.on('insomniacAction', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const currentRole = room.assignedRoles[socket.id];
        const originalRole = room.startingRoles[socket.id];
        const roleChanged = currentRole !== originalRole;
    
        io.to(socket.id).emit('insomniacResult', { 
            role: currentRole,
            originalRole: originalRole,
            changed: roleChanged
        });
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
        
        // Swap the roles
        room.assignedRoles[centerCard] = playerRole;
        room.assignedRoles[targetPlayer] = centerRole;
        
        io.to(socket.id).emit('witchGiveResult', { 
            message: `You gave ${centerCard} to ${room.players.find(p => p.id === targetPlayer)?.name || "Unknown"}` 
        });
    });

    socket.on('drunkAction', ({ roomCode, targetCenter }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Perform the swap without revealing the card to the Drunk
        const drunkRole = room.assignedRoles[socket.id];
        const centerRole = room.assignedRoles[targetCenter];
        
        room.assignedRoles[socket.id] = centerRole;
        room.assignedRoles[targetCenter] = drunkRole;
        
        // Just acknowledge the action was completed without revealing info
        io.to(socket.id).emit('actionComplete', { 
            role: 'drunk',
            message: 'You swapped with a center card (you won\'t know which one)' 
        });
    
        // Mark the Drunk's action as complete in game state
        if (room.gameState) {
            room.gameState.completedActions.push('drunk');
        }
    
        // Notify other players if needed (like for game flow)
        io.to(roomCode).emit('playerActionCompleted', {
            playerId: socket.id,
            role: 'drunk'
        });
    });

    socket.on('piAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
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
        if (!room || targets.length !== 2) return;
    
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
    
        // Find all werewolves (including special werewolves)
        const werewolves = room.players.filter(player => {
            const role = room.assignedRoles[player.id];
            return ['werewolf-1', 'werewolf-2', 'mystic-wolf', 'dream-wolf', 'serpent'].includes(role);
        }).map(w => w.name || "Unnamed");
    
        // Check if there are no werewolves
        const noWerewolves = werewolves.length === 0;
    
        io.to(socket.id).emit('minionResult', { 
            werewolves,
            noWerewolves,
            message: noWerewolves ? 
                "There are no Werewolves. You must ensure someone dies to win!" :
                "These are the Werewolves:"
        });
    
        // Notify werewolves that the Minion is viewing them
        werewolves.forEach(werewolf => {
            const werewolfPlayer = room.players.find(p => p.name === werewolf);
            if (werewolfPlayer) {
                io.to(werewolfPlayer.id).emit('minionViewing');
            }
        });
    });

    socket.on('squireAction', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Find all werewolves with their CURRENT roles
        const currentWerewolves = room.players.filter(player => {
            const role = room.assignedRoles[player.id];
            return ['werewolf-1', 'werewolf-2', 'mystic-wolf', 'dream-wolf', 'serpent'].includes(role);
        }).map(w => ({
            name: w.name || "Unnamed",
            currentRole: room.assignedRoles[w.id],
            originalRole: room.startingRoles[w.id]
        }));
    
        io.to(socket.id).emit('squireResult', { 
            werewolves: currentWerewolves,
            noWerewolves: currentWerewolves.length === 0,
            message: currentWerewolves.length === 0 ?
                "There are no Werewolves in the game!" :
                "Current Werewolf Team:"
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
            startDayPhase(roomCode);
            return;
        }
    
        const currentRole = room.gameRoleTurnOrder[room.currentRoleIndex];
        const currentPlayers = room.players.filter(p => 
            room.startingRoles[p.id] === currentRole
        );
    
        let timer = 15; // Default timer for most roles
        if (currentRole === "werewolf-team") {
            timer = 25; // Extra time for werewolf team discussion
        } else if (currentRole === "seer") {
            timer = 20; // Extra time for seer decisions
        }
    
        room.currentTimer = setInterval(() => {
            timer--;
            io.to(roomCode).emit('turnTimer', { timer });
            
            if (timer <= 0) {
                clearInterval(room.currentTimer);
                room.currentRoleIndex++;
                nextRoleTurn(roomCode); // Advance to next turn
            }
        }, 1000);
    
        // Notify active players it's their turn
        currentPlayers.forEach(player => {
            io.to(player.id).emit('nightTurn', {
                currentRole: currentRole,
                currentPlayer: player.id,
                isOriginalRole: room.assignedRoles[player.id] === room.startingRoles[player.id],
                actualCurrentRole: room.assignedRoles[player.id]
            });
        });
        
        // Notify other players to wait
        room.players.forEach(player => {
            if (!currentPlayers.some(p => p.id === player.id)) {
                io.to(player.id).emit('nightTurn', {
                    currentRole: currentRole,
                    currentPlayer: null
                });
            }
        });
    }

    function startDayPhase(roomCode) {
        const room = rooms[roomCode];
        if (!room) return;
        
        const duration = Math.min(room.players.length * 60, 300); // Max 5 minutes
        io.to(roomCode).emit('startDayPhase');
        
        let timer = duration;
        room.dayTimer = setInterval(() => {
            timer--;
            io.to(roomCode).emit('dayTimer', { timer });
            
            if (timer <= 0) {
                clearInterval(room.dayTimer);
                endDayPhase(roomCode);
            }
        }, 1000);
    }

    function endDayPhase(roomCode) {
        const room = rooms[roomCode];
        if (!room) return;
        
        room.votes = {};
        io.to(roomCode).emit('endDayPhase');
        
        // Start voting timer
        let voteTimer = 15;
        room.voteTimer = setInterval(() => {
            voteTimer--;
            io.to(roomCode).emit('voteTimer', { timer: voteTimer });
            
            if (voteTimer <= 0) {
                clearInterval(room.voteTimer);
                endVotingPhase(roomCode);
            }
        }, 1000);
    }

    socket.on('castVote', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room) return;
        
        if (!room.votes) {
            room.votes = {};
        }
        
        // Remove previous vote from this player
        for (const playerId in room.votes) {
            if (room.votes[playerId].voter === socket.id) {
                delete room.votes[playerId];
                break;
            }
        }
        
        // Add new vote
        room.votes[target] = room.votes[target] || { count: 0, voters: [] };
        room.votes[target].count++;
        room.votes[target].voters.push(socket.id);
    });

    function endVotingPhase(roomCode) {
        const room = rooms[roomCode];
        if (!room) return;
        
        let maxVotes = 0;
        let votedPlayerId;
        
        // Find player with most votes
        for (const playerId in room.votes) {
            if (room.votes[playerId].count > maxVotes) {
                maxVotes = room.votes[playerId].count;
                votedPlayerId = playerId;
            }
        }
        
        const winningTeam = determineWinner(room.assignedRoles, votedPlayerId, room.players);
        const roleReveal = room.players.map(player => ({
            id: player.id,
            name: player.name || "Unnamed",
            role: room.assignedRoles[player.id],
            originalRole: room.startingRoles[player.id]
        }));
        
        const centerCards = [
            room.assignedRoles["center1"],
            room.assignedRoles["center2"],
            room.assignedRoles["center3"]
        ];
        
        io.to(roomCode).emit('votingResult', { 
            votedPlayerId, 
            votes: room.votes, 
            winningTeam,
            roleReveal,
            centerCards
        });
    }

    function determineWinner(assignedRoles, votedPlayerId, players) {
        const werewolfRoles = ["werewolf-1", "werewolf-2", "serpent", "mystic-wolf", "dream-wolf"];
        const tannerRoles = ["tanner", "apprentice-tanner"];
        const minionRole = "minion";
        
        const someoneDied = votedPlayerId !== undefined;
        const votedPlayerRole = someoneDied ? assignedRoles[votedPlayerId] : null;
    
        // Tanner wins if they were voted out
        if (someoneDied && tannerRoles.includes(votedPlayerRole)) {
            return "Tanner";
        }
    
        // Check if any werewolves exist
        const werewolves = players.filter(p => 
            werewolfRoles.includes(assignedRoles[p.id])
        );
        
        // Check if minion exists
        const minion = players.find(p => assignedRoles[p.id] === minionRole);
    
        // Werewolf team wins if:
        // 1. No werewolves died AND (werewolves exist OR only minion exists)
        const werewolfTeamWins = 
            (!someoneDied || !werewolfRoles.includes(votedPlayerRole)) &&
            (werewolves.length > 0 || (minion && werewolves.length === 0));
    
        if (werewolfTeamWins) {
            return werewolves.length > 0 ? "Werewolves" : "Minion";
        }
    
        // Villagers win if they killed a werewolf when minion exists
        // or if they killed someone when no werewolves exist
        const villagersWin = 
            (someoneDied && werewolfRoles.includes(votedPlayerRole)) ||
            (someoneDied && werewolves.length === 0 && votedPlayerRole !== minionRole);
    
        if (villagersWin) {
            return "Villagers";
        }
    
        // Default to villagers winning if nothing else applies
        return "Villagers";
    }

    socket.on('playAgain', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;
        
        if (!room.playAgainPlayers) {
            room.playAgainPlayers = {};
        }
        
        room.playAgainPlayers[socket.id] = true;
        
        const allPlayAgain = room.players.every(player =>
            room.playAgainPlayers[player.id]
        );
        
        if (allPlayAgain) {
            // Clear all timers
            if (room.currentTimer) clearInterval(room.currentTimer);
            if (room.dayTimer) clearInterval(room.dayTimer);
            if (room.voteTimer) clearInterval(room.voteTimer);
            
            // Reset game state
            room.confirmedPlayers = {};
            room.assignedRoles = {};
            room.votes = {};
            room.playAgainPlayers = {};
            room.nightPhaseActive = false;
            room.currentRoleIndex = 0;
            room.serpentDeceptions = null;
            
            io.to(roomCode).emit('resetGame');
            io.to(roomCode).emit('roomUpdate', room.players, room.roles);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);
        
        for (const roomCode in rooms) {
            rooms[roomCode].players = rooms[roomCode].players.filter(
                player => player.id !== socket.id
            );
            
            if (rooms[roomCode].players.length === 0) {
                // Clean up empty room
                if (rooms[roomCode].currentTimer) clearInterval(rooms[roomCode].currentTimer);
                if (rooms[roomCode].dayTimer) clearInterval(rooms[roomCode].dayTimer);
                if (rooms[roomCode].voteTimer) clearInterval(rooms[roomCode].voteTimer);
                delete rooms[roomCode];
            } else {
                // Update host if needed
                if (rooms[roomCode].hostId === socket.id) {
                    rooms[roomCode].hostId = rooms[roomCode].players[0]?.id;
                }
                io.to(roomCode).emit('roomUpdate', rooms[roomCode].players, rooms[roomCode].roles);
            }
        }
    });
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
