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
    "dream-wolf", "tanner", "villager-1", "villager-2", "villager-3", "werewolf-1", "werewolf-2", "serpent", "mystic-wolf", "minion", "apprentice-tanner",  "sentinel",
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

        rooms[roomCode].assignedRoles = assignRoles(roomCode, room.players, room.roles);

        console.log("Assigned roles:", rooms[roomCode].assignedRoles);

        io.to(roomCode).emit('gameStart', rooms[roomCode].assignedRoles);

        console.log("Game started in room", roomCode);

        rooms[roomCode].gameRoleTurnOrder = roleTurnOrder.filter(role => Object.values(rooms[roomCode].assignedRoles).includes(role));
    });

    // Track starting roles separately
    function assignRoles(roomCode, players, roles) {
        const shuffledRoles = [...roles].sort(() => 0.5 - Math.random());
        const assignedRoles = {};

        players.forEach((player, index) => {
            assignedRoles[player.id] = shuffledRoles[index];
        });

        assignedRoles["center1"] = shuffledRoles[players.length];
        assignedRoles["center2"] = shuffledRoles[players.length + 1];
        assignedRoles["center3"] = shuffledRoles[players.length + 2];

        // Store starting roles
        rooms[roomCode].startingRoles = {...assignedRoles};
        rooms[roomCode].assignedRoles = {...assignedRoles}; // Current roles may change

        if (roles.includes('serpent')) {
            rooms[roomCode].serpentDeceptions = {};
        }

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

    socket.on('seerAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        if (Array.isArray(target)) {
            // Handle center card selection
            const centerRoles = target.map(centerCard => room.assignedRoles[centerCard]);
            io.to(socket.id).emit('seerResult', { targetRole: centerRoles });
        } else {
            // Handle player selection
            const playerRole = room.assignedRoles[target];
            io.to(socket.id).emit('seerResult', { targetRole: playerRole });
        }
    });
    
    socket.on('mysticWolfAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Get the target player's role
        const targetRole = room.assignedRoles[target];
        if (!targetRole) {
            console.log(`Invalid target player: ${target}`);
            io.to(socket.id).emit('error', { message: "Invalid player selected." });
            return;
        }
    
        // Send the result back to the Mystic Wolf
        io.to(socket.id).emit('mysticWolfResult', { targetRole });
    
        // Do NOT move to the next role's turn here
        // The timer will continue running until it expires naturally
    });

    socket.on('robberAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Check if the Robber has already stolen a role
        if (room.assignedRoles[socket.id].startsWith('stolen-')) {
            console.log(`Robber ${socket.id} has already stolen a role.`);
            io.to(socket.id).emit('error', { message: "You can only steal one role per game." });
            return;
        }
    
        // Swap roles between the Robber and the target player
        const robberRole = room.assignedRoles[socket.id];
        const targetRole = room.assignedRoles[target];
        room.assignedRoles[socket.id] = `stolen-${targetRole}`; // Mark the role as stolen
        room.assignedRoles[target] = robberRole;
    
        // Notify the Robber of their new role
        io.to(socket.id).emit('robberResult', { newRole: targetRole });
    });

    socket.on('troublemakerAction', ({ roomCode, targets }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Validate that exactly two players are selected
        if (targets.length !== 2) {
            console.log(`Invalid number of players selected: ${targets.length}`);
            io.to(socket.id).emit('error', { message: "You must select exactly two players." });
            return;
        }
    
        // Swap the roles of the selected players
        const [player1, player2] = targets;
        const tempRole = room.assignedRoles[player1];
        room.assignedRoles[player1] = room.assignedRoles[player2];
        room.assignedRoles[player2] = tempRole;
    
        // Notify the Troublemaker of the successful swap
        io.to(socket.id).emit('troublemakerResult', { message: "Roles swapped successfully!" });
    });

    socket.on('insomniacAction', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Get the Insomniac's current role
        const insomniacRole = room.assignedRoles[socket.id];
        if (!insomniacRole) {
            console.log(`Invalid role for Insomniac: ${socket.id}`);
            io.to(socket.id).emit('error', { message: "Unable to retrieve your role." });
            return;
        }
    
        // Send the Insomniac's role back to them
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
    
        // Perform the swap
        const centerRole = room.assignedRoles[centerCard];
        const playerRole = room.assignedRoles[targetPlayer];
        
        room.assignedRoles[centerCard] = playerRole;
        room.assignedRoles[targetPlayer] = centerRole;
    
        io.to(socket.id).emit('witchGiveResult', { 
            message: `You gave ${centerCard} to ${room.players.find(p => p.id === targetPlayer)?.name || "Unknown"}` 
        });
    
        // Advance turn
        room.currentRoleIndex++;
        nextRoleTurn(roomCode);
    });

    socket.on('drunkAction', ({ roomCode, targetCenter }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Swap roles without telling the Drunk what they got
        const drunkRole = room.assignedRoles[socket.id];
        const centerRole = room.assignedRoles[targetCenter];
        
        room.assignedRoles[socket.id] = centerRole;
        room.assignedRoles[targetCenter] = drunkRole;
        
        // Just acknowledge the action without revealing the role
        io.to(socket.id).emit('drunkResult', { 
            message: `You swapped with ${targetCenter}` 
        });
    });

    socket.on('piAction', ({ roomCode, target }) => {
        const room = rooms[roomCode];
        if (!room || !room.nightPhaseActive) return;
    
        const targetRole = room.assignedRoles[target];
        const isWerewolf = ['werewolf-1', 'werewolf-2', 'serpent', 'mystic-wolf', 'dream-wolf']
            .includes(targetRole);
    
        if (isWerewolf) {
            // Convert PI to werewolf
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
        
        // DON'T manually advance turn - let timer handle it
        // Just disable further actions from this PI
        room.completedActions = room.completedActions || [];
        room.completedActions.push(socket.id);
    });

    socket.on('gremlinAction', ({ roomCode, targets }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Must select exactly 2 targets (could include themselves)
        if (targets.length !== 2) {
            io.to(socket.id).emit('error', { message: "You must select exactly two players" });
            return;
        }
    
        // Swap the roles
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
    
        // Identify all werewolves
        const werewolves = room.players.filter(player => 
            ["werewolf-1", "werewolf-2", "serpent", "mystic-wolf", "dream-wolf"]
            .includes(room.assignedRoles[player.id])
        ).map(w => w.name || "Unnamed");
    
        // Immediately send the result to the Minion
        io.to(socket.id).emit('minionResult', { 
            werewolves,
            noWerewolves: werewolves.length === 0
        });
    });

    socket.on('squireAction', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Get current werewolves (including original and any converted)
        const currentWerewolves = room.players.filter(player => 
            ["werewolf-1", "werewolf-2", "mystic-wolf", "dream-wolf", "serpent"]
            .includes(room.assignedRoles[player.id])
        ).map(w => ({
            name: w.name || "Unnamed",
            originalRole: room.originalRoles?.[w.id] || room.assignedRoles[w.id]
        }));
    
        // Immediately send the result to the Squire
        io.to(socket.id).emit('squireResult', { 
            werewolves: currentWerewolves,
            noWerewolves: currentWerewolves.length === 0
        });
    
        // Don't advance turn here - let the timer handle it
    });

    socket.on('apprenticeTannerAction', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Find the Tanner in this game
        const tannerPlayer = room.players.find(player => 
            ['tanner', 'apprentice-tanner'].includes(room.assignedRoles[player.id])
        );
    
        if (tannerPlayer) {
            // Send the Tanner's name to the Apprentice Tanner
            io.to(socket.id).emit('apprenticeTannerResult', {
                hasTanner: true,
                tannerName: tannerPlayer.name || "Unnamed",
                isSelf: tannerPlayer.id === socket.id
            });
        } else {
            // No Tanner in the game
            io.to(socket.id).emit('apprenticeTannerResult', {
                hasTanner: false
            });
        }
    });

    socket.on('apprenticeSeerAction', ({ roomCode, card }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Get the role from the selected center card (checking for serpent deceptions)
        const cardRole = getShownRole(room, card);
        
        // Send the result back to the Apprentice Seer
        io.to(socket.id).emit('apprenticeSeerResult', {
            card: card,
            role: cardRole
        });
    });

    socket.on('serpentAction', ({ roomCode, targets }) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        // Get all possible roles in game
        const allRoles = [...new Set([...room.roles, ...Object.values(room.assignedRoles)])];
    
        // Initialize serpentDeceptions if it doesn't exist
        if (!room.serpentDeceptions) {
            room.serpentDeceptions = {};
        }
    
        targets.forEach(target => {
            if (!room.serpentDeceptions[target]) {
                // Store the actual role and a random disguised role
                room.serpentDeceptions[target] = {
                    actual: room.assignedRoles[target],
                    shown: allRoles[Math.floor(Math.random() * allRoles.length)]
                };
            }
        });
    
        // Notify the serpent that the action was successful
        io.to(socket.id).emit('serpentResult', { targets });
    });

    function getShownRole(room, target) {
        // Check if this card has been disguised by the serpent
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
            role: room.assignedRoles[card]
        });
    });

    function nextRoleTurn(roomCode) {
        const room = rooms[roomCode];
        if (!room || !room.nightPhaseActive) return;
    
        // Clear previous timer
        if (room.currentTimer) clearInterval(room.currentTimer);
    
        // Skip no-action roles
        const noActionRoles = ['villager-1', 'villager-2', 'villager-3', 'tanner', 'dream-wolf'];
        while (room.currentRoleIndex < room.gameRoleTurnOrder.length && 
               noActionRoles.includes(room.gameRoleTurnOrder[room.currentRoleIndex])) {
            room.currentRoleIndex++;
        }
    
        if (room.currentRoleIndex >= room.gameRoleTurnOrder.length) {
            room.nightPhaseActive = false;
            io.to(roomCode).emit('startDayPhase');
            return;
        }
    
        const currentRole = room.gameRoleTurnOrder[room.currentRoleIndex];
        
        // Find players who STARTED as this role
        const currentPlayers = room.players.filter(p => 
            room.startingRoles[p.id] === currentRole
        );
    
        // Start timer
        let timer = 15;
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
                isOriginalRole: room.assignedRoles[player.id] === room.startingRoles[player.id]
            });
        });
        
        // Notify other players
        room.players.forEach(player => {
            if (!currentPlayers.some(p => p.id === player.id)) {
                io.to(player.id).emit('nightTurn', {
                    currentRole: currentRole,
                    currentPlayer: null
                });
            }
        });
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

    socket.on('requestDayPhaseDuration', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;
    
        const duration = room.players.length * 60; // 1 minute per player
        io.to(roomCode).emit('dayPhase', { duration, roleOrder: room.gameRoleTurnOrder });
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
        const werewolfRoles = ["werewolf-1", "werewolf-2", "serpent", "mystic-wolf", "dream-wolf"];
        const tannerRoles = ["tanner", "apprentice-tanner"];
        
        // 1. Check if someone was voted out
        const someoneDied = votedPlayerId !== undefined && votedPlayerId !== null;
        const votedPlayerRole = someoneDied ? assignedRoles[votedPlayerId] : null;
    
        // 2. Check special roles (Tanner) - these override everything
        if (someoneDied && tannerRoles.includes(votedPlayerRole)) {
            return "Tanner";
        }
    
        // 3. Check werewolf presence in the game
        const werewolvesPresent = werewolfRoles.some(role => 
            Object.values(assignedRoles).includes(role)
        );
    
        // 4. Check if any werewolves died
        const werewolfDied = someoneDied && werewolfRoles.includes(votedPlayerRole);
    
        // 5. Minion-specific checks
        const minionPresent = Object.values(assignedRoles).includes("minion");
        const minionDied = someoneDied && assignedRoles[votedPlayerId] === "minion";

        // 6. Squire-specific checks
        const squirePresent = Object.values(assignedRoles).includes("squire");
        const squireDied = someoneDied && assignedRoles[votedPlayerId] === "squire";
    
        // 7. Official Win Conditions:
        
        // Case 1: Tanner wins if tanner dies (already handled above)
        
        // Case 2: Village wins if:
        //   - At least one werewolf dies, OR
        //   - No werewolves in game AND no one dies
        if (werewolfDied || (!werewolvesPresent && !someoneDied)) {
            return "Villagers";
        }
    
        // Case 3: Werewolves win if:
        //   - No werewolves died AND werewolves exist in game
        //   - (Minion automatically wins with werewolves in this case)
        if (werewolvesPresent && !werewolfDied) {
            return "Werewolves";
        }
    
        // Case 4: Special Minion-alone case
        if (minionPresent && !werewolvesPresent) {
            if (!someoneDied) {
                return "Villagers"; // No one dies - villagers win
            }
            return minionDied ? "Villagers" : "Minion";
        }

        // Case 5: Squire win conditions:
        if (squirePresent) {
            // Case 1: No werewolves in game
            if (!werewolvesPresent) {
                if (!someoneDied) {
                    return "Villagers"; // No one dies
                }
                return squireDied ? "Villagers" : "Squire";
            }
            // Case 2: Werewolves present and none died
            else if (!werewolfDied) {
                return "Werewolves"; // Squire wins with werewolves
            }
        }
    
        // Default fallback (should theoretically never reach here)
        return "Villagers";
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