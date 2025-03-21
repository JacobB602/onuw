console.log("client.js file loaded and executing!");

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded event listener added!");
    let socket;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        // Local testing
        socket = io('http://localhost:10000');
    } else {
        // Deployed on Railway
        socket = io('https://onuw.up.railway.app');
    }

    let currentRoom = null;
    let currentUsername = null;
    let isHost = false;
    let playerCount = 0;
    let roles = {};
    let confirmButton;
    let originalRoleCard;
    let clientAssignedRoles;

    const roleDisplayNames = {
        'werewolf-1': 'Werewolf',
        'werewolf-2': 'Werewolf',
        'alpha-wolf': 'Alpha Wolf',
        'mystic-wolf': 'Mystic Wolf',
        'dream-wolf': 'Dream Wolf',
        'minion': 'Minion',
        'squire': 'Squire',
        'tanner': 'Tanner',
        'apprentice-tanner': 'Apprentice Tanner',
        'executioner': 'Executioner',
        'villager-1': 'Villager',
        'villager-2': 'Villager',
        'villager-3': 'Villager',
        'seer': 'Seer',
        'apprentice-seer': 'Apprentice Seer',
        'troublemaker': 'Troublemaker',
        'gremlin': 'Gremlin',
        'paranormal-investigator': 'Paranormal Investigator',
        'robber': 'Robber',
        'witch': 'Witch',
        'drunk': 'Drunk',
        'insomniac': 'Insomniac',
        // Add other roles as needed
    };

    function getRoleAlignment(role) {
        if (["werewolf-1", "werewolf-2", "minion", "squire", "alpha-wolf", "mystic-wolf", "dream-wolf"].includes(role)) {
            return 'evil';
        } else if (["tanner", "apprentice-tanner", "executioner"].includes(role)) {
            return 'neutral';
        } else {
            return 'good';
        }
    }

    function setCardBackColor(cardBack, roleAlignment) {
        if (roleAlignment === 'evil') {
            cardBack.style.background = 'linear-gradient(135deg, rgb(236, 16, 16), rgb(180, 12, 12))'; // Gradient red for evil
            cardBack.style.border = '2px solid rgb(180, 12, 12)';
        } else if (roleAlignment === 'neutral') {
            cardBack.style.background = 'linear-gradient(135deg, orange, rgb(200, 140, 0))'; // Gradient orange for neutral
            cardBack.style.border = '2px solid rgb(200, 140, 0)';
        } else {
            cardBack.style.background = 'linear-gradient(135deg, rgb(0, 89, 255), rgb(0, 60, 200))'; // Gradient blue for good
            cardBack.style.border = '2px solid rgb(0, 60, 200)';
        }
    }

    document.getElementById("joinRoom").addEventListener("click", function() {
        const roomCode = document.getElementById("roomCode").value.trim();
        if (!roomCode) {
            alert("Please enter a room code!");
            return;
        }
        currentRoom = roomCode;
        socket.emit('joinRoom', { roomCode });
    
        // Show the lobby (including the join room button and input box)
        document.getElementById("lobby").style.display = "block";
    
        // Hide the game screen (if visible)
        document.getElementById("gameScreen").style.display = "none";
    
        // Prompt for username
        const username = prompt("Please enter your name:");
        if (username) {
            socket.emit('joinRoomWithName', { roomCode: currentRoom, username });
        }
    });

    socket.on('roomUpdate', (players, receivedRoles) => {
        console.log("roomUpdate event received");
        console.log("Received room update:", players, receivedRoles);
        roles = receivedRoles;
    
        playerCount = players.length; // Correctly sets playerCount
    
        const playerList = document.getElementById("playerList");
        playerList.innerHTML = "";
    
        players.forEach(player => {
            const listItem = document.createElement("li");
            listItem.textContent = player.name || "Unnamed";
            const role = roles[player.id];
            if (role) {
                listItem.textContent += ` - ${roleDisplayNames[role] || role}`; // Use displayName or original if not found
            }
            playerList.appendChild(listItem);
        });
    
        // Update the rolesRequiredText element
        document.getElementById("rolesRequiredText").textContent = `Roles to select: ${playerCount + 3}`;
    
        updateRolesUI(roles);
        isHost = players[0]?.id === socket.id;
    
        const rolesButton = document.getElementById("roles");
        if (isHost) {
            rolesButton.textContent = "Edit Roles";
            rolesButton.onclick = function() {
                document.getElementById("settingsPopup").style.display = "flex";
            };
        } else {
            rolesButton.textContent = "View Roles";
            rolesButton.onclick = function() {
                document.getElementById("settingsPopup").style.display = "flex";
            };
        }
    
        updateStartGameButtonState(roles);
    });

    function updateRolesUI(roles) {
        document.querySelectorAll('.role').forEach(roleElement => {
            const roleName = roleElement.getAttribute('data-role');
            const isSelected = roles.includes(roleName);
    
            // Only update the role's selection state and color if it's not already selected
            if (isSelected && !roleElement.classList.contains('selected')) {
                roleElement.classList.add('selected');
                if (["werewolf-1", "werewolf-2", "minion", "squire", "alpha-wolf", "mystic-wolf", "dream-wolf"].includes(roleName)) {
                    roleElement.classList.add('evil');
                    roleElement.classList.remove('good', 'neutral');
                } else if (["tanner", "apprentice-tanner", "executioner"].includes(roleName)) {
                    roleElement.classList.add('neutral');
                    roleElement.classList.remove('evil', 'good');
                } else {
                    roleElement.classList.add('good');
                    roleElement.classList.remove('evil', 'neutral');
                }
            }
    
            // Disable roles for non-host players
            if (!isHost) {
                roleElement.classList.add('disabled');
            } else {
                roleElement.classList.remove('disabled');
            }
        });
    }

    function updateStartGameButtonState(roles) {
        const requiredRoles = playerCount + 3;
        const selectedRolesCount = roles.length; // Treat roles as an array
        const startGameButton = document.getElementById("startGameButton");
        if (isHost && selectedRolesCount === requiredRoles) {
            startGameButton.disabled = false;
        } else {
            startGameButton.disabled = true;
        }
    }

    document.getElementById("roles").addEventListener("click", () => {
        document.getElementById("settingsPopup").style.display = "flex";
    });

    document.getElementById("closePopup").addEventListener("click", function() {
        document.getElementById("settingsPopup").style.display = "none";
    });

    document.querySelectorAll(".role").forEach(function(role) {
        role.addEventListener("click", function() {
            if (!isHost) return;
            role.classList.toggle("selected");
            const selectedRoles = Array.from(document.querySelectorAll(".role.selected")).map(selectedRole => selectedRole.dataset.role);
            socket.emit('updateRoles', { roomCode: currentRoom, roles: selectedRoles });
    
            if (role.classList.contains("selected")) {
                if (["werewolf-1", "werewolf-2", "minion", "squire", "alpha-wolf", "mystic-wolf", "dream-wolf"].includes(role.dataset.role)) {
                    role.classList.add("evil");
                    role.classList.remove("good", "neutral");
                } else if (["tanner", "apprentice-tanner", "executioner"].includes(role.dataset.role)) {
                    role.classList.add("neutral");
                    role.classList.remove("evil", "good");
                } else {
                    role.classList.add("good");
                    role.classList.remove("evil", "neutral");
                }
            } else {
                role.classList.remove("evil", "good", "neutral");
            }
        });
    });

    // Start game button
    document.getElementById("startGameButton").addEventListener("click", function() {
        console.log("Start game button clicked! (listener active)");
        console.log("Start game button disabled state:", document.getElementById("startGameButton").disabled);
        console.log("Emitting startGame event for room:", currentRoom, "socket:", socket.id);
        socket.emit("startGame", { roomCode: currentRoom });
    });

    socket.on('gameStart', (assignedRoles) => {
        console.log("gameStart event handler is running!");
        console.log("gameStart event received:", assignedRoles);
        console.log("My socket.id:", socket.id);

        clientAssignedRoles = assignedRoles;

        // Hide the lobby
        const lobby = document.getElementById('lobby');
        if (lobby) {
            lobby.style.display = 'none';
        }

        // Show the game screen
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.style.display = 'block';
        }

        // Display the player's role
        const myRole = assignedRoles[socket.id];
        if (!myRole) {
            console.error("No role assigned for this player!");
            return;
        }
        document.getElementById('gameMessage').textContent = `Your role is: ${roleDisplayNames[clientAssignedRoles[socket.id]] || clientAssignedRoles[socket.id]}`;

        // Set card back color based on role alignment
        const cardBack = document.querySelector('.card-back');
        const roleAlignment = getRoleAlignment(clientAssignedRoles[socket.id]);
        setCardBackColor(cardBack, roleAlignment);

        // Create and append the button
        const confirmButton = document.createElement("button");
        confirmButton.textContent = "Confirm Role";
        confirmButton.addEventListener("click", confirmRole);

        console.log("gameScreen element:", document.getElementById("gameScreen"));
        console.log("confirmButton element:", confirmButton);

        gameScreen.appendChild(confirmButton);

        console.log("Button appended successfully.");

        // Optional: Add some styling to the button to make it more visible
        confirmButton.style.marginTop = "20px";
        confirmButton.style.padding = "10px 20px";
        confirmButton.style.fontSize = "16px";
    });
    
    document.getElementById('card').addEventListener('click', () => {
        document.getElementById('card').classList.toggle('flipped');
    });

    function confirmRole() {
        socket.emit('confirmRole', { roomCode: currentRoom });
        if (confirmButton) {
            confirmButton.remove();
        }
        document.getElementById("gameScreen").innerHTML += '<p id="confirmationMessage">Waiting on others...</p>';
    }

    socket.on('roleConfirmed', ({ confirmedPlayers, players }) => {
        const confirmationMessage = document.getElementById("confirmationMessage");
        if (confirmationMessage) {
            const waitingPlayers = players
                .filter(player => !confirmedPlayers[player.id])
                .map(player => player.name || "Unnamed");
    
            if (waitingPlayers.length > 0) {
                confirmationMessage.textContent = `Waiting on: ${waitingPlayers.join(", ")}`;
            } else {
                confirmationMessage.textContent = "All players confirmed!";
            }
        }
    });
    
    socket.on('startNightPhase', () => {
        document.getElementById("gameScreen").innerHTML = "<h1>Night Phase</h1><p>Night phase is starting.</p>";
    
        // Remove old card if exists
        if (document.getElementById('originalRoleCard')) {
            document.getElementById('originalRoleCard').remove();
        }
    
        // Create a mini card wrapper and the card itself
        const cardWrapper = document.createElement('div');
        cardWrapper.classList.add('card-wrapper', 'mini-card-wrapper');
    
        const card = document.createElement('div');
        card.id = 'originalRoleCard';
        card.classList.add('card', 'mini-card');
    
        const cardFront = document.createElement('div');
        cardFront.classList.add('card-front', 'mini-card-front');
    
        const cardBack = document.createElement('div');
        cardBack.classList.add('card-back', 'mini-card-back');
        cardBack.textContent = `${roleDisplayNames[clientAssignedRoles[socket.id]] || clientAssignedRoles[socket.id]}`;
    
        // Append card elements
        card.appendChild(cardFront);
        card.appendChild(cardBack);
        cardWrapper.appendChild(card);
        document.body.appendChild(cardWrapper);
    
        // Set mini card back color (moved after appending)
        const miniCardBack = document.querySelector('.mini-card-back');
        const roleAlignment = getRoleAlignment(clientAssignedRoles[socket.id]);
        setCardBackColor(miniCardBack, roleAlignment);
    
        // Add flip functionality
        card.addEventListener('click', () => {
            card.classList.toggle('flipped');
        });
    
        // Center cards
        const centerCardsDiv = document.createElement('div');
        centerCardsDiv.id = 'centerCards';
        centerCardsDiv.innerHTML = `
            <div class="card" id="center1">Center 1</div>
            <div class="card" id="center2">Center 2</div>
            <div class="card" id="center3">Center 3</div>
        `;
        document.getElementById("gameScreen").appendChild(centerCardsDiv);
    });
    
    socket.on('nightTurn', ({ currentRole, currentPlayer }) => {
        const gameScreen = document.getElementById("gameScreen");
        gameScreen.innerHTML = `<h1>Night Phase</h1><p>${roleDisplayNames[currentRole] || currentRole}'s turn.</p>`;    
    
        if (currentPlayer === socket.id) {
            gameScreen.innerHTML += `<p>It's your turn. Take your action.</p><button id="completeTurn">Complete Turn</button><div id="turnTimerDisplay">15</div>`; // Add timer display
            const completeTurnButton = document.getElementById("completeTurn");
            completeTurnButton.addEventListener("click", () => {
                socket.emit('nightActionComplete', { roomCode: currentRoom });
            });
    
            // Play audio alert
            const audio = new Audio('big_dog.ogg'); // Replace with your audio file
            audio.play();
        } else {
            gameScreen.innerHTML += `<p>Waiting for another player to complete their action.</p><div id="turnTimerDisplay">15</div>`; // Add timer display
        }
    });
    
    socket.on('turnTimer', ({ timer }) => {
        const timerDisplay = document.getElementById("turnTimerDisplay");
        if (timerDisplay) {
            timerDisplay.textContent = timer;
        }
    
        const completeTurnButton = document.getElementById("completeTurn");
        if (completeTurnButton) {
            completeTurnButton.disabled = timer > 0;
        }
    });
    
    socket.on('dayPhase', ({ duration, roleOrder }) => { // Corrected event name
        document.getElementById('gameScreen').innerHTML = `
            <h1>Day Phase</h1>
            <p>Day phase is starting. Discuss!</p>
            <div id="dayTimerDisplay">${duration}</div>
            <div id="roleOrderDisplay">
                <h3>Role Order:</h3>
                <ul>${roleOrder.map(role => `<li>${roleDisplayNames[role] || role}</li>`).join('')}</ul>
            </div>
        `;
    
        if (originalRoleCard) {
            originalRoleCard.remove();
        }
    });
    
    socket.on('dayTimer', ({ timer }) => {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
        const timerDisplay = document.getElementById('dayTimerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = formattedTime;
        }
    });

    socket.on('endDayPhase', () => {
        console.log("Voting phase started!");
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.style.display = 'block';
            gameScreen.innerHTML = '<h1>Voting Phase</h1><p>Vote for who you think is the werewolf!</p><div id="votingButtons"></div>';
    
            // Remove the mini card
            const miniCardWrapper = document.querySelector('.mini-card-wrapper');
            if (miniCardWrapper) {
                miniCardWrapper.remove();
            }
    
            // Call addVotingUI directly after creating the div
            addVotingUI();
        } else {
            console.error("gameScreen element not found during endDayPhase.");
            return;
        }
    });
    
    function addVotingUI() {
        let selectedVote = null;
        let timer = 15; // 15 seconds voting time
    
        const timerDisplay = document.createElement('div');
        timerDisplay.id = 'turnTimerDisplay';
        timerDisplay.textContent = `Time remaining: ${timer}s`;
        document.getElementById('votingButtons').appendChild(timerDisplay);
    
        socket.emit('requestPlayerList', currentRoom);
    
        socket.once('playerList', (players) => {
            const votingButtonsDiv = document.getElementById('votingButtons');
            if (votingButtonsDiv) {
                players.forEach(player => {
                    if (player.id !== socket.id) {
                        const voteButton = document.createElement('button');
                        voteButton.textContent = player.name || 'Unnamed';
                        voteButton.style.display = 'block';
                        voteButton.style.margin = '10px auto';
                        voteButton.style.width = '200px';
                        voteButton.style.padding = '10px 20px';
                        voteButton.style.backgroundColor = '#87CEEB';
                        voteButton.style.border = '1px solid #4682B4';
                        voteButton.style.borderRadius = '5px';
                        voteButton.style.boxShadow = '2px 2px 5px rgba(0, 0, 0, 0.2)';
                        voteButton.addEventListener('click', () => {
                            selectedVote = player.id;
                            players.forEach(p => {
                                const button = Array.from(document.querySelectorAll('#votingButtons button')).find(b => b.textContent === (p.name || 'Unnamed'));
                                if (button) {
                                    button.style.boxShadow = p.id === player.id ? '4px 4px 8px rgba(0, 0, 0, 0.4)' : '2px 2px 5px rgba(0, 0, 0, 0.2)';
                                    button.style.backgroundColor = p.id === player.id ? '#4682B4' : '#87CEEB';
                                }
                            });
                        });
                        votingButtonsDiv.appendChild(voteButton);
                    }
                });
    
                const countdown = setInterval(() => {
                    timer--;
                    timerDisplay.textContent = `Time remaining: ${timer}s`;
                    if (timer <= 0) {
                        clearInterval(countdown);
                        if (selectedVote) {
                            socket.emit('castVote', { roomCode: currentRoom, votedPlayerId: selectedVote });
                            console.log(`Client: Vote cast for ${selectedVote}`);
                        }
                        // Remove timer display and voting buttons
                        timerDisplay.remove();
                        const allButtons = document.querySelectorAll('#votingButtons button');
                        allButtons.forEach(button => button.remove());
    
                        // Request voting results
                        socket.emit('endVotingPhase', currentRoom);
                    }
                }, 1000);
            } else {
                console.error("votingButtonsDiv element not found.");
            }
        });
    
        // Listen for voting results
        socket.on('votingResult', ({ votedPlayerId, votes, winningTeam }) => {
            const votingResultsDiv = document.createElement('div');
            votingResultsDiv.innerHTML = `
                <h2>Voting Results</h2>
                <p>Player with most votes: ${votedPlayerId}</p>
                <p>Votes: ${JSON.stringify(votes)}</p>
                <p>Winning Team: ${winningTeam}</p>
            `;
            document.getElementById('votingButtons').appendChild(votingResultsDiv);
        });
    }
    
    socket.on('endVotingPhase', (roomCode) => {
        console.log("Client: endVotingPhase event received.");
        socket.emit('endVotingPhase', roomCode);
    });
    
socket.on('votingResult', ({ votedPlayerId, votes, winningTeam }) => {
    // Display the voting result and game outcome.
    socket.emit('requestPlayerList', currentRoom);
    socket.on('playerList', (players) => {
        const votedPlayerName = players.find(p => p.id === votedPlayerId)?.name || 'Unnamed';

        let votesDisplay = '<h2>Vote Counts:</h2>';
        for (const playerId in votes) {
            const playerName = players.find(p => p.id === playerId)?.name || 'Unnamed';
            votesDisplay += `<p>${playerName}: ${votes[playerId]}</p>`;
        }

        const gameScreen = document.getElementById('gameScreen'); // Get the gameScreen element

        if (gameScreen) { // Check if gameScreen exists
            gameScreen.innerHTML = `
                <h1>Voting Result</h1>
                <p>The player voted out was: ${votedPlayerName}</p>
                ${votesDisplay}
                <p>Winning Team: ${winningTeam}</p>
            `;
        } else {
            console.error("gameScreen element not found when trying to display voting results.");
        }
    });
});

    socket.on('connect', () => {
        console.log("Socket.io connected!");
    });

    socket.on('disconnect', () => {
        console.log("Socket.io disconnected!");
    });
});