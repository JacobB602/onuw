console.log("client.js file loaded and executing!");

document.addEventListener('DOMContentLoaded', function () {
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
        'serpent': 'Serpent',
        'mystic-wolf': 'Mystic Wolf',
        'dream-wolf': 'Dream Wolf',
        'minion': 'Minion',
        'squire': 'Squire',
        'tanner': 'Tanner',
        'apprentice-tanner': 'Apprentice Tanner',
        'sentinel': 'Sentinel',
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

    // Handle name submission
    function handleSubmitName() {
        const usernameInput = document.getElementById('usernameInput');
        const username = usernameInput.value.trim();

        // Debugging: Log the username and its length
        console.log("Username:", username, "Length:", username.length);

        if (username && username.length > 0) {
            console.log("Username is valid:", username);
            socket.emit('joinRoomWithName', { roomCode: currentRoom, username });

            // Hide the modal
            const nameModal = document.getElementById('nameModal');
            nameModal.style.display = 'none';

            // Clear the input field
            usernameInput.value = '';
        } else {
            console.log("Username is invalid or empty!");
            alert("Please enter a valid name!");
            return; // Prevent further execution
        }
    }

    // Attach the submitName event listener
    const submitNameButton = document.getElementById('submitName');
    submitNameButton.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent form submission (if applicable)
        event.stopPropagation(); // Stop event propagation
        console.log("Submit button clicked!"); // Debugging
        handleSubmitName(); // Call the submit logic
    });

    // Close modal when clicking outside of it
    const nameModal = document.getElementById('nameModal');
    nameModal.addEventListener('click', (event) => {
        if (event.target === nameModal) {
            nameModal.style.display = 'none';
        }
    });

    // Submit name when pressing Enter
    document.getElementById('usernameInput').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission (if applicable)
            console.log("Enter key pressed!"); // Debugging
            handleSubmitName(); // Call the submit logic directly
        }
    });

    // Add fade-in animation to the modal
    const modalContent = document.querySelector('#nameModal .modal-content');
    modalContent.style.animation = 'fadeIn 0.3s ease-in-out';

    function getRoleAlignment(role) {
        if (["werewolf-1", "werewolf-2", "minion", "squire", "serpent", "mystic-wolf", "dream-wolf"].includes(role)) {
            return 'evil';
        } else if (["tanner", "apprentice-tanner"].includes(role)) {
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

    // Show the name submission modal when joining a room
    document.getElementById("joinRoom").addEventListener("click", function() {
        const roomCode = document.getElementById("roomCode").value.trim();
        if (!roomCode) {
            alert("Please enter a room code!");
            return;
        }
        currentRoom = roomCode;
        socket.emit('joinRoom', { roomCode });

        // Show the name submission modal
        const nameModal = document.getElementById('nameModal');
        nameModal.style.display = 'flex'; // Show the modal
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
    
            // Update selection state
            if (isSelected) {
                roleElement.classList.add('selected');
                if (["werewolf-1", "werewolf-2", "minion", "squire", "serpent", "mystic-wolf", "dream-wolf"].includes(roleName)) {
                    roleElement.classList.add('evil');
                    roleElement.classList.remove('good', 'neutral');
                } else if (["tanner", "apprentice-tanner"].includes(roleName)) {
                    roleElement.classList.add('neutral');
                    roleElement.classList.remove('evil', 'good');
                } else {
                    roleElement.classList.add('good');
                    roleElement.classList.remove('evil', 'neutral');
                }
            } else {
                roleElement.classList.remove('selected', 'evil', 'good', 'neutral');
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
                if (["werewolf-1", "werewolf-2", "minion", "squire", "serpent", "mystic-wolf", "dream-wolf"].includes(role.dataset.role)) {
                    role.classList.add("evil");
                    role.classList.remove("good", "neutral");
                } else if (["tanner", "apprentice-tanner"].includes(role.dataset.role)) {
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
            gameScreen.style.display = 'block'; // Ensure the game screen is visible
    
            // Clear the game screen content
            gameScreen.innerHTML = `
                <div class="game-screen">
                    <div class="card-wrapper">
                        <div class="card" id="card">
                            <div class="card-front">Click to Reveal Role</div>
                            <div class="card-back"><div class="game-message" id="gameMessage"></div></div>
                        </div>
                    </div>
                </div>
            `;
    
            // Update the player's role
            const myRole = assignedRoles[socket.id];
            if (!myRole) {
                console.error("No role assigned for this player!");
                return;
            }
    
            const gameMessage = document.getElementById('gameMessage');
            if (gameMessage) {
                gameMessage.textContent = `Your role is: ${roleDisplayNames[clientAssignedRoles[socket.id]] || clientAssignedRoles[socket.id]}`;
            }
    
            // Set card back color based on role alignment
            const cardBack = document.querySelector('.card-back');
            if (cardBack) {
                const roleAlignment = getRoleAlignment(clientAssignedRoles[socket.id]);
                setCardBackColor(cardBack, roleAlignment);
            }
    
            // Remove existing confirm button if it exists
            const existingConfirmButton = document.getElementById('confirmButton');
            if (existingConfirmButton) {
                existingConfirmButton.remove();
            }
    
            // Create and append the confirm button
            const confirmButton = document.createElement("button");
            confirmButton.id = "confirmButton"; // Add an ID for easy removal later
            confirmButton.textContent = "Confirm Role";
            confirmButton.addEventListener("click", confirmRole);
    
            // Style the button
            confirmButton.style.marginTop = "20px";
            confirmButton.style.padding = "10px 20px";
            confirmButton.style.fontSize = "16px";
    
            // Append the button to the game screen
            gameScreen.appendChild(confirmButton);
    
            // Reattach the card flip event listener
            const card = document.getElementById('card');
            if (card) {
                card.addEventListener('click', () => {
                    card.classList.toggle('flipped');
                });
            }
    
            console.log("Button appended successfully.");
        }
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
        document.getElementById("gameScreen").innerHTML = `
            <h1>Night Phase</h1>
            <p>Night phase is starting.</p>
            <div id="resultDisplay"></div> <!-- Add this line -->
        `;
    
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
        if (gameScreen) {
            gameScreen.innerHTML = `
                <h1>Night Phase</h1>
                <p>${roleDisplayNames[currentRole] || currentRole}'s turn.</p>
                <div id="resultDisplay"></div>
                <div id="turnTimerDisplay">15</div>
            `;
    
            if (currentPlayer === socket.id) {
                if (currentRole === 'seer') {
                    let seerActionTaken = false;
                    let centerCardsViewed = [];
    
                    // Add buttons for Seer's options
                    gameScreen.innerHTML += `
                        <p>It's your turn. Choose an action:</p>
                        <div id="seerOptions">
                            <button id="viewPlayer">View a Player's Card</button>
                            <button id="viewCenter">View 2 Center Cards</button>
                        </div>
                    `;
    
                    // Handle "View a Player's Card" option
                    document.getElementById('viewPlayer').addEventListener('click', () => {
                        if (seerActionTaken) return;
    
                        // Request the list of players
                        socket.emit('requestPlayerList', currentRoom);
                        socket.once('playerList', (players) => {
                            gameScreen.innerHTML += `
                                <div id="playerSelection">
                                    <h3>Select a Player:</h3>
                                    <ul>
                                        ${players.filter(player => player.id !== socket.id).map(player => `
                                            <li>
                                                <button class="selectPlayer" data-player-id="${player.id}">
                                                    ${player.name || "Unnamed"}
                                                </button>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                            `;
    
                            // Add event listeners for player selection
                            document.querySelectorAll('.selectPlayer').forEach(button => {
                                button.addEventListener('click', () => {
                                    const playerId = button.getAttribute('data-player-id');
                                    socket.emit('seerAction', { roomCode: currentRoom, target: playerId });
                                    seerActionTaken = true;
                                });
                            });
                        });
                    });
    
                    // Handle "View 2 Center Cards" option
                    document.getElementById('viewCenter').addEventListener('click', () => {
                        if (seerActionTaken) return;
    
                        gameScreen.innerHTML += `
                            <div id="centerSelection">
                                <h3>Select 2 Center Cards:</h3>
                                <ul>
                                    <li><button class="selectCenter" data-center="center1">Center 1</button></li>
                                    <li><button class="selectCenter" data-center="center2">Center 2</button></li>
                                    <li><button class="selectCenter" data-center="center3">Center 3</button></li>
                                </ul>
                            </div>
                        `;
    
                        // Add event listeners for center card selection
                        document.querySelectorAll('.selectCenter').forEach(button => {
                            button.addEventListener('click', () => {
                                const centerCard = button.getAttribute('data-center');
                                centerCardsViewed.push(centerCard);
                                button.disabled = true;
                        
                                if (centerCardsViewed.length === 2) {
                                    socket.emit('seerAction', { roomCode: currentRoom, target: centerCardsViewed });
                                    seerActionTaken = true;
                                } else {
                                    document.querySelector("#centerSelection h3").textContent = `Select ${2 - centerCardsViewed.length} Center Cards:`;
                                }
                            });
                        });
                    });
                } else if (currentRole === 'robber') {
                    // Robber's turn: Allow them to choose a player to rob
                    socket.emit('requestPlayerList', currentRoom);
                    socket.once('playerList', (players) => {
                        gameScreen.innerHTML += `
                            <p>Choose a player to rob:</p>
                            <div id="robberOptions">
                                <ul>
                                    ${players.filter(player => player.id !== socket.id).map(player => `
                                        <li>
                                            <button class="selectPlayer" data-player-id="${player.id}">
                                                ${player.name || "Unnamed"}
                                            </button>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        `;
                
                        // Add event listeners for player selection
                        document.querySelectorAll('.selectPlayer').forEach(button => {
                            button.addEventListener('click', () => {
                                const playerId = button.getAttribute('data-player-id');
                                socket.emit('robberAction', { roomCode: currentRoom, target: playerId });
                
                                // Disable all buttons after selection to prevent multiple clicks
                                document.querySelectorAll('.selectPlayer').forEach(btn => btn.disabled = true);
                            });
                        });
                    });
                } else if (currentRole === 'mystic-wolf') {
                    // Mystic Wolf's turn: Allow them to choose a player to view
                    socket.emit('requestPlayerList', currentRoom);
                    socket.once('playerList', (players) => {
                        gameScreen.innerHTML += `
                            <p>Choose a player to view their role:</p>
                            <div id="mysticWolfOptions">
                                <ul>
                                    ${players.filter(player => player.id !== socket.id).map(player => `
                                        <li>
                                            <button class="selectPlayer" data-player-id="${player.id}">
                                                ${player.name || "Unnamed"}
                                            </button>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        `;
    
                        // Add event listeners for player selection
                        document.querySelectorAll('.selectPlayer').forEach(button => {
                            button.addEventListener('click', () => {
                                const playerId = button.getAttribute('data-player-id');
                                socket.emit('mysticWolfAction', { roomCode: currentRoom, target: playerId });
    
                                // Disable all buttons after selection to prevent multiple clicks
                                document.querySelectorAll('.selectPlayer').forEach(btn => btn.disabled = true);
                            });
                        });
                    });
                } else if (currentRole === 'troublemaker') {
                    // Troublemaker's turn: Allow them to swap two players' roles
                    socket.emit('requestPlayerList', currentRoom);
                    socket.once('playerList', (players) => {
                        gameScreen.innerHTML += `
                            <p>Choose two players to swap their roles:</p>
                            <div id="troublemakerOptions">
                                <ul>
                                    ${players.filter(player => player.id !== socket.id).map(player => `
                                        <li>
                                            <button class="selectPlayer" data-player-id="${player.id}">
                                                ${player.name || "Unnamed"}
                                            </button>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        `;
    
                        let selectedPlayers = [];
                        document.querySelectorAll('.selectPlayer').forEach(button => {
                            button.addEventListener('click', () => {
                                const playerId = button.getAttribute('data-player-id');
                                selectedPlayers.push(playerId);
                                button.disabled = true;
    
                                if (selectedPlayers.length === 2) {
                                    socket.emit('troublemakerAction', { roomCode: currentRoom, targets: selectedPlayers });
                                } else {
                                    document.querySelector("#troublemakerOptions p").textContent = `Select ${2 - selectedPlayers.length} more player(s):`;
                                }
                            });
                        });
                    });
                } else if (currentRole === 'insomniac') {
                    // Insomniac's turn: Show their current role
                    const insomniacRole = clientAssignedRoles[socket.id];
                    gameScreen.innerHTML += `
                        <p>Your current role is: ${roleDisplayNames[insomniacRole] || insomniacRole}</p>
                    `;
                } else if (currentRole === 'werewolf-1' || currentRole === 'werewolf-2' || 
                    currentRole === 'mystic-wolf' || currentRole === 'dream-wolf') {
                    // First get list of all players and their roles
                    socket.emit('requestPlayerList', currentRoom);
                    socket.once('playerList', (players) => {
                        // Filter out other werewolves (excluding yourself)
                        const otherWerewolves = players.filter(player => 
                            player.id !== socket.id && 
                            ['werewolf-1', 'werewolf-2', 'mystic-wolf', 'dream-wolf', 'serpent']
                            .includes(clientAssignedRoles[player.id])
                        );
                
                        // Count other werewolves
                        const werewolfCount = otherWerewolves.length;
                
                        if (werewolfCount === 0) {
                            // Lone werewolf - show center card options
                            gameScreen.innerHTML += `
                                <p>You are the only Werewolf. Look at a center card:</p>
                                <div id="centerCardOptions">
                                    <button class="centerCard" data-card="center1">Center 1</button>
                                    <button class="centerCard" data-card="center2">Center 2</button>
                                    <button class="centerCard" data-card="center3">Center 3</button>
                                </div>
                                <div id="centerCardResult"></div>
                            `;
                
                            document.querySelectorAll('.centerCard').forEach(button => {
                                button.addEventListener('click', () => {
                                    const card = button.getAttribute('data-card');
                                    socket.emit('viewCenterCard', {
                                        roomCode: currentRoom,
                                        card: card
                                    });
                                });
                            });
                        } else {
                            // Show other werewolves count but not who they are
                            gameScreen.innerHTML += `
                                <p>There are ${werewolfCount} other Werewolves in the game.</p>
                                <p class="warning">You don't know who they are!</p>
                            `;
                        }
                    });
                } else if (currentRole === 'witch') {
                    // Always show Witch interface regardless of current role
                    gameScreen.innerHTML += `
                        <p>You are the Witch. Choose a center card to view:</p>
                        <div id="witchViewOptions">
                            <button class="selectCenter" data-center="center1">Center 1</button>
                            <button class="selectCenter" data-center="center2">Center 2</button>
                            <button class="selectCenter" data-center="center3">Center 3</button>
                        </div>
                        <div id="witchGiveOptions" style="display:none;"></div>
                    `;
                    
                    let selectedCenter = null;
                    
                    // View center card
                    document.querySelectorAll('.selectCenter').forEach(button => {
                        button.addEventListener('click', () => {
                            selectedCenter = button.getAttribute('data-center');
                            socket.emit('witchViewAction', { 
                                roomCode: currentRoom, 
                                centerCard: selectedCenter 
                            });
                            
                            document.getElementById('witchViewOptions').style.display = 'none';
                            document.getElementById('witchGiveOptions').style.display = 'block';
                            
                            // Get player list
                            socket.emit('requestPlayerList', currentRoom);
                        });
                    });
                
                    // Handle player list for giving card
                    socket.once('playerList', (players) => {
                        document.getElementById('witchGiveOptions').innerHTML = `
                            <p>Choose a player to give this card to:</p>
                            <ul>
                                ${players.map(player => `
                                    <li>
                                        <button class="selectPlayer" data-player-id="${player.id}">
                                            ${player.name || "Unnamed"}
                                        </button>
                                    </li>
                                `).join('')}
                            </ul>
                        `;
                
                        document.querySelectorAll('.selectPlayer').forEach(button => {
                            button.addEventListener('click', () => {
                                const playerId = button.getAttribute('data-player-id');
                                socket.emit('witchGiveAction', { 
                                    roomCode: currentRoom,
                                    centerCard: selectedCenter,
                                    targetPlayer: playerId
                                });
                            });
                        });
                    });
                } else if (currentRole === 'drunk') {
                    // Drunk's turn - must swap with a center card (without seeing it)
                    gameScreen.innerHTML += `
                        <p>You must swap with a center card (you won't know your new role until morning):</p>
                        <div id="drunkOptions">
                            <button class="selectCenter" data-center="center1">Center 1</button>
                            <button class="selectCenter" data-center="center2">Center 2</button>
                            <button class="selectCenter" data-center="center3">Center 3</button>
                        </div>
                    `;
                
                    document.querySelectorAll('.selectCenter').forEach(button => {
                        button.addEventListener('click', () => {
                            const centerCard = button.getAttribute('data-center');
                            socket.emit('drunkAction', { 
                                roomCode: currentRoom, 
                                targetCenter: centerCard 
                            });
                            
                            // Disable all buttons after selection
                            document.querySelectorAll('.selectCenter').forEach(btn => {
                                btn.disabled = true;
                            });
                            
                            // Show confirmation message without revealing the role
                            document.getElementById('resultDisplay').innerHTML = `
                                <p>You swapped with ${centerCard}!</p>
                                <p>You won't know your new role until morning.</p>
                            `;
                        });
                    });
                } else if (currentRole === 'paranormal-investigator') {
                    socket.emit('requestPlayerList', currentRoom);
                    socket.once('playerList', (players) => {
                        gameScreen.innerHTML += `
                            <p>Choose a player to investigate:</p>
                            <div id="piOptions">
                                <ul>
                                    ${players.filter(player => player.id !== socket.id).map(player => `
                                        <li>
                                            <button class="selectPlayer" data-player-id="${player.id}">
                                                ${player.name || "Unnamed"}
                                            </button>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                            <div id="piResult"></div>
                        `;
                
                        document.querySelectorAll('.selectPlayer').forEach(button => {
                            button.addEventListener('click', () => {
                                const playerId = button.getAttribute('data-player-id');
                                socket.emit('piAction', { 
                                    roomCode: currentRoom, 
                                    target: playerId 
                                });
                                // Disable all buttons after selection
                                document.querySelectorAll('.selectPlayer').forEach(btn => {
                                    btn.disabled = true;
                                    btn.style.opacity = '0.5';
                                });
                            });
                        });
                    });
                } else if (currentRole === 'gremlin') {
                    // Gremlin's turn: Can swap any two players (including themselves)
                    socket.emit('requestPlayerList', currentRoom);
                    socket.once('playerList', (players) => {
                        gameScreen.innerHTML += `
                            <p>Choose any two players to swap (can include yourself):</p>
                            <div id="gremlinOptions">
                                <ul>
                                    ${players.map(player => `
                                        <li>
                                            <button class="selectPlayer" data-player-id="${player.id}">
                                                ${player.name || "Unnamed"} ${player.id === socket.id ? '(You)' : ''}
                                            </button>
                                        </li>
                                    `).join('')}
                                </ul>
                                <p id="selectionStatus">Select 2 players</p>
                            </div>
                        `;
                
                        let selectedPlayers = [];
                        const updateSelectionStatus = () => {
                            const status = document.getElementById('selectionStatus');
                            if (selectedPlayers.length === 0) {
                                status.textContent = "Select 2 players";
                            } else if (selectedPlayers.length === 1) {
                                const playerName = players.find(p => p.id === selectedPlayers[0]).name;
                                status.textContent = `Selected: ${playerName}. Select 1 more.`;
                            } else {
                                const playerNames = selectedPlayers.map(id => 
                                    players.find(p => p.id === id).name).join(' and ');
                                status.textContent = `Will swap: ${playerNames}`;
                            }
                        };
                
                        document.querySelectorAll('.selectPlayer').forEach(button => {
                            button.addEventListener('click', () => {
                                const playerId = button.getAttribute('data-player-id');
                                
                                // Toggle selection
                                const index = selectedPlayers.indexOf(playerId);
                                if (index === -1) {
                                    if (selectedPlayers.length < 2) {
                                        selectedPlayers.push(playerId);
                                        button.style.backgroundColor = '#4682B4';
                                    }
                                } else {
                                    selectedPlayers.splice(index, 1);
                                    button.style.backgroundColor = '';
                                }
                
                                updateSelectionStatus();
                
                                // Auto-submit when 2 players selected
                                if (selectedPlayers.length === 2) {
                                    socket.emit('gremlinAction', { 
                                        roomCode: currentRoom, 
                                        targets: selectedPlayers 
                                    });
                                }
                            });
                        });
                    });
                } else if (currentRole === 'minion') {
                    // Minion's turn - automatically request werewolf info
                    socket.emit('minionAction', { roomCode: currentRoom });
                    
                    // Show loading message while waiting for response
                    document.getElementById('resultDisplay').innerHTML = `
                        <p>Revealing werewolves...</p>
                    `;
                } else if (currentRole === 'squire') {
                    // Squire's turn - automatically request werewolf info
                    socket.emit('squireAction', { roomCode: currentRoom });
                    
                    // Show loading message while waiting for response
                    document.getElementById('resultDisplay').innerHTML = `
                        <p>Identifying Werewolves...</p>
                    `;
                } else if (currentRole === 'apprentice-seer') {
                    // Apprentice Seer's turn - view one center card
                    gameScreen.innerHTML += `
                        <p>You are the Apprentice Seer. Select one center card to view:</p>
                        <div id="centerCardSelection">
                            <button class="centerCardBtn" data-card="center1">Center Card 1</button>
                            <button class="centerCardBtn" data-card="center2">Center Card 2</button>
                            <button class="centerCardBtn" data-card="center3">Center Card 3</button>
                        </div>
                        <div id="apprenticeSeerResult"></div>
                    `;
                
                    // Add click handlers for center card selection
                    document.querySelectorAll('.centerCardBtn').forEach(button => {
                        button.addEventListener('click', () => {
                            const selectedCard = button.getAttribute('data-card');
                            socket.emit('apprenticeSeerAction', { 
                                roomCode: currentRoom, 
                                card: selectedCard 
                            });
                            
                            // Disable all buttons after selection
                            document.querySelectorAll('.centerCardBtn').forEach(btn => {
                                btn.disabled = true;
                            });
                        });
                    });
                } else if (currentRole === 'serpent') {
                    socket.emit('requestPlayerList', currentRoom);
                    socket.once('playerList', (players) => {
                        // Check if Serpent is the only werewolf
                        const otherWerewolves = players.filter(player => 
                            player.id !== socket.id && 
                            ['werewolf-1', 'werewolf-2', 'mystic-wolf', 'dream-wolf']
                            .includes(clientAssignedRoles[player.id])
                        );
                        
                        const isLoneWerewolf = otherWerewolves.length === 0;
                        
                        let html = `
                            <div>
                                <h3>Serpent Actions</h3>
                        `;
                        
                        if (isLoneWerewolf) {
                            html += `
                                <p>You are the only Werewolf. You may look at a center card:</p>
                                <div id="centerCardOptions">
                                    <button class="centerCard" data-card="center1">Center 1</button>
                                    <button class="centerCard" data-card="center2">Center 2</button>
                                    <button class="centerCard" data-card="center3">Center 3</button>
                                </div>
                                <div id="centerCardResult"></div>
                            `;
                        } else {
                            html += `
                                <p>There are ${otherWerewolves.length} other Werewolves in the game.</p>
                            `;
                        }
                        
                        html += `
                                <h4>Your Serpent ability:</h4>
                                <button id="disguiseOnePlayer">Disguise 1 Player</button>
                                <button id="disguiseTwoCenters">Disguise 2 Center Cards</button>
                                <div id="serpentTargetSelection"></div>
                            </div>
                        `;
                        
                        gameScreen.innerHTML += html;
                        
                        if (isLoneWerewolf) {
                            document.querySelectorAll('.centerCard').forEach(button => {
                                button.addEventListener('click', () => {
                                    const card = button.getAttribute('data-card');
                                    socket.emit('viewCenterCard', {
                                        roomCode: currentRoom,
                                        card: card
                                    });
                                });
                            });
                        }
                        
                        // Player disguise
                        document.getElementById('disguiseOnePlayer').addEventListener('click', () => {
                            document.getElementById('serpentTargetSelection').innerHTML = `
                                ${players.filter(p => p.id !== socket.id).map(player => `
                                    <button class="target-btn" data-target="${player.id}">
                                        ${player.name || "Unnamed"}
                                    </button>
                                `).join('')}
                            `;
                
                            document.querySelectorAll('.target-btn').forEach(btn => {
                                btn.addEventListener('click', function() {
                                    socket.emit('serpentAction', {
                                        roomCode: currentRoom,
                                        targets: [this.getAttribute('data-target')]
                                    });
                                });
                            });
                        });
                        
                        // Center card disguise
                        document.getElementById('disguiseTwoCenters').addEventListener('click', () => {
                            document.getElementById('serpentTargetSelection').innerHTML = `
                                ${['center1', 'center2', 'center3'].map(center => `
                                    <button class="target-btn" data-target="${center}">
                                        ${center}
                                    </button>
                                `).join('')}
                                ${rooms[currentRoom]?.assignedRoles["center4"] ? 
                                    '<button class="target-btn" data-target="center4">center4</button>' : ''}
                                <p>Select 2</p>
                            `;
                
                            let selected = [];
                            document.querySelectorAll('.target-btn').forEach(btn => {
                                btn.addEventListener('click', function() {
                                    const target = this.getAttribute('data-target');
                                    if (selected.includes(target)) {
                                        selected = selected.filter(t => t !== target);
                                        this.style.backgroundColor = '';
                                    } else if (selected.length < 2) {
                                        selected.push(target);
                                        this.style.backgroundColor = '#ccc';
                                    }
                
                                    if (selected.length === 2) {
                                        socket.emit('serpentAction', {
                                            roomCode: currentRoom,
                                            targets: selected
                                        });
                                    }
                                });
                            });
                        });
                    });
                }
            } else {
                // Not this player's turn
                gameScreen.innerHTML += `<p>Waiting for ${roleDisplayNames[currentRole] || currentRole} to complete their action...</p>`;
            }
        }
    });

    socket.on('serpentResult', ({ targets }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        
        if (targets.length === 1) {
            // Player disguise result
            const playerName = rooms[currentRoom].players.find(p => p.id === targets[0])?.name || "Unknown";
            resultDisplay.innerHTML = `
                <p>You've successfully disguised ${playerName}'s card!</p>
                <p>Others will see a random role when viewing this card.</p>
            `;
        } else {
            // Center card disguise result
            resultDisplay.innerHTML = `
                <p>You've successfully disguised these center cards:</p>
                <ul>
                    ${targets.map(target => `<li>${target}</li>`).join('')}
                </ul>
                <p>Others will see random roles when viewing these cards.</p>
            `;
        }
    });

    socket.on('apprenticeSeerResult', ({ card, role }) => {
        const resultDisplay = document.getElementById('apprenticeSeerResult') || 
                             document.getElementById('resultDisplay');
        
        resultDisplay.innerHTML = `
            <p>${card} is: ${roleDisplayNames[role] || role}</p>
            <p>Remember this information for the discussion phase!</p>
        `;
    });

    socket.on('apprenticeTannerResult', ({ hasTanner, tannerName, isSelf }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        
        if (!hasTanner) {
            resultDisplay.innerHTML = `
                <p>There is no Tanner in this game.</p>
                <p class="warning">If someone claims to be the Tanner, they're bluffing!</p>
            `;
        } else if (isSelf) {
            resultDisplay.innerHTML = `
                <p>You are the only Tanner in the game!</p>
                <p class="warning">If you're killed, you win!</p>
            `;
        } else {
            resultDisplay.innerHTML = `
                <p>The Tanner is: ${tannerName}</p>
                <p class="warning">If they're killed, you win instead of them!</p>
            `;
        }
    });

    socket.on('squireResult', ({ werewolves, noWerewolves }) => {
        const resultDisplay = document.getElementById('squireResult') || 
                            document.getElementById('resultDisplay');
        
        if (noWerewolves) {
            resultDisplay.innerHTML = `
                <p>There are no Werewolves in the game!</p>
                <p class="warning">You must get someone else killed to win.</p>
            `;
        } else if (werewolves.length === 0) {
            resultDisplay.innerHTML = `<p>There are no Werewolves in the game.</p>`;
        } else {
            resultDisplay.innerHTML = `
                <p>Original Werewolf roles:</p>
                <ul>
                    ${werewolves.map(w => `
                        <li>${w.name} - ${roleDisplayNames[w.originalRole] || w.originalRole}</li>
                    `).join('')}
                </ul>
                <p class="warning">Remember these roles may have changed!</p>
            `;
        }
    });

    socket.on('minionResult', ({ werewolves, noWerewolves }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        
        if (noWerewolves) {
            resultDisplay.innerHTML = `
                <p>There are no Werewolves in the game!</p>
                <p class="warning">You must get someone else killed to win.</p>
            `;
        } else if (werewolves.length === 0) {
            resultDisplay.innerHTML = `<p>There are no Werewolves in the game.</p>`;
        } else {
            resultDisplay.innerHTML = `
                <p>The Werewolves are:</p>
                <ul>
                    ${werewolves.map(name => `<li>${name}</li>`).join('')}
                </ul>
                <p>Help them avoid being killed!</p>
            `;
        }
    });

    socket.on('gremlinResult', ({ message }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        resultDisplay.innerHTML = `<p>${message}</p>`;
    });

    socket.on('piResult', ({ isWerewolf, newRole, targetRole }) => {
        const resultDisplay = document.getElementById('piResult') || 
                             document.getElementById('resultDisplay');
        
        if (isWerewolf) {
            resultDisplay.innerHTML = `
                <p>This player is a ${roleDisplayNames[targetRole] || targetRole}!</p>
                <p class="warning">You have become a ${roleDisplayNames[newRole] || newRole}!</p>
            `;
            
            // Update the player's own role display
            if (document.getElementById('gameMessage')) {
                document.getElementById('gameMessage').textContent = 
                    `Your role is now: ${roleDisplayNames[newRole] || newRole}`;
            }
            
            // Update card color if visible
            const cardBack = document.querySelector('.card-back');
            if (cardBack) {
                cardBack.style.background = 'linear-gradient(135deg, rgb(236, 16, 16), rgb(180, 12, 12))';
                cardBack.style.border = '2px solid rgb(180, 12, 12)';
            }
        } else {
            resultDisplay.innerHTML = `
                <p>This player is not a Werewolf (${roleDisplayNames[targetRole] || targetRole}).</p>
            `;
        }
    });

    socket.on('drunkResult', ({ message }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        resultDisplay.innerHTML = `<p>${message}</p>`;
    });

    socket.on('witchViewResult', ({ centerCard, centerRole }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        resultDisplay.innerHTML = `
            <p>${centerCard} is: ${roleDisplayNames[centerRole] || centerRole}</p>
            <p>Now select a player to give this card to.</p>
        `;
    });
    
    socket.on('witchGiveResult', ({ message }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        resultDisplay.innerHTML = `<p>${message}</p>`;
    });
    
    socket.on('witchSwapResult', ({ message }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        resultDisplay.innerHTML = `<p>${message}</p>`;
    });
    
    socket.on('seerResult', ({ targetRole }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        if (resultDisplay) {
            if (Array.isArray(targetRole)) {
                // Handle center card results
                if (targetRole.length === 2) {
                    resultDisplay.textContent = `Center Card 1: ${roleDisplayNames[targetRole[0]] || targetRole[0]}, Center Card 2: ${roleDisplayNames[targetRole[1]] || targetRole[1]}`;
                } else {
                    resultDisplay.textContent = "Error: Invalid number of center card roles received.";
                }
            } else {
                // Handle player role result
                resultDisplay.textContent = `The role you viewed is: ${roleDisplayNames[targetRole] || targetRole}`;
            }
        }
    });
    
    socket.on('mysticWolfResult', ({ targetRole }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        if (resultDisplay) {
            resultDisplay.textContent = `The role you viewed is: ${roleDisplayNames[targetRole] || targetRole}`;
        }
    });
    
    socket.on('robberResult', ({ newRole }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        if (resultDisplay) {
            resultDisplay.textContent = `You stole a role! Your new role is: ${roleDisplayNames[newRole] || newRole}`;
        }
    });

    socket.on('troublemakerResult', ({ message }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        if (resultDisplay) {
            resultDisplay.textContent = message;
        }
    });

    socket.on('insomniacResult', ({ role }) => {
        const resultDisplay = document.getElementById('resultDisplay');
        if (resultDisplay) {
            resultDisplay.textContent = `Your current role is: ${roleDisplayNames[role] || role}`;
        }
    });

    socket.on('centerCardViewed', ({ card, role }) => {
        const resultDiv = document.getElementById('centerCardResult') || 
                         document.getElementById('resultDisplay');
        resultDiv.innerHTML = `
            <p>Center card (${card}) shows: ${roleDisplayNames[role] || role}</p>
        `;
        
        // Disable buttons after selection
        document.querySelectorAll('.centerCard').forEach(btn => {
            btn.disabled = true;
        });
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
    
    socket.on('startDayPhase', () => {
        console.log("Day phase is starting!");
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.innerHTML = `
                <h1>Day Phase</h1>
                <p>Discuss and vote for who you think is the werewolf!</p>
                <div id="dayTimerDisplay">00:00</div> <!-- Timer will be updated dynamically -->
            `;
    
            // Fetch the duration from the server (1 minute per player)
            socket.emit('requestDayPhaseDuration', currentRoom);
        }
    });

    socket.on('dayPhase', ({ duration, roleOrder }) => {
        console.log("Day phase is starting with duration:", duration);
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.innerHTML = `
                <h1>Day Phase</h1>
                <p>Discuss and vote for who you think is the werewolf!</p>
                <div id="dayTimerDisplay">${formatTime(duration)}</div>
                <div id="roleOrderDisplay">
                    <h3>Role Order:</h3>
                    <ul>${roleOrder.map(role => `<li>${roleDisplayNames[role] || role}</li>`).join('')}</ul>
                </div>
            `;
    
            // Start the day phase timer using the server-provided duration
            let timer = duration;
            const intervalId = setInterval(() => {
                timer--;
                document.getElementById('dayTimerDisplay').textContent = formatTime(timer);
    
                if (timer <= 0) {
                    clearInterval(intervalId);
                    socket.emit('endDayPhase', currentRoom); // Notify the server that the day phase has ended
                }
            }, 1000);
        }
    });
    
    // Helper function to format time as MM:SS
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

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
    }

    socket.on('votingResult', ({ votedPlayerId, votes, winningTeam }) => {
        // Display the voting result and game outcome
        socket.emit('requestPlayerList', currentRoom);
        socket.once('playerList', (players) => {
            const votedPlayerName = players.find(p => p.id === votedPlayerId)?.name || 'Unnamed';
    
            let votesDisplay = '<h2>Vote Counts:</h2>';
            for (const playerId in votes) {
                const playerName = players.find(p => p.id === playerId)?.name || 'Unnamed';
                votesDisplay += `<p>${playerName}: ${votes[playerId]}</p>`;
            }
    
            const gameScreen = document.getElementById('gameScreen');
            if (gameScreen) {
                gameScreen.innerHTML = `
                    <h1>Voting Result</h1>
                    <p>The player voted out was: ${votedPlayerName}</p>
                    ${votesDisplay}
                    <p>Winning Team: ${winningTeam}</p>
                    <button id="playAgainButton">Play Again</button>
                `;
    
                // Add event listener for the "Play Again" button
                const playAgainButton = document.getElementById('playAgainButton');
                if (playAgainButton) {
                    playAgainButton.addEventListener('click', () => {
                        socket.emit('playAgain', currentRoom);
                        playAgainButton.disabled = true; // Disable the button after clicking
                    });
                }
            } else {
                console.error("gameScreen element not found when trying to display voting results.");
            }
        });
    });
    
    socket.on('endVotingPhase', (roomCode) => {
        console.log("Client: endVotingPhase event received.");
        socket.emit('endVotingPhase', roomCode);
    });

    socket.on('resetGame', () => {
        console.log("Resetting game UI...");
    
        // Hide the game screen
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.style.display = 'none';
        }
    
        // Show the lobby
        const lobby = document.getElementById('lobby');
        if (lobby) {
            lobby.style.display = 'block';
        }
    
        // Clear dynamic elements (e.g., confirm button, timers)
        const confirmButton = document.getElementById('confirmButton');
        if (confirmButton) {
            confirmButton.remove();
        }
    
        const confirmationMessage = document.getElementById('confirmationMessage');
        if (confirmationMessage) {
            confirmationMessage.remove();
        }
    
        // Reset the roles button text
        const rolesButton = document.getElementById('roles');
        if (rolesButton) {
            rolesButton.textContent = "Loading...";
        }
    
        // Reset the start game button
        const startGameButton = document.getElementById('startGameButton');
        if (startGameButton) {
            startGameButton.disabled = true;
        }
    
        // Clear the player list
        const playerList = document.getElementById('playerList');
        if (playerList) {
            playerList.innerHTML = '';
        }
    
        console.log("Game UI reset complete.");
    });

    socket.on('connect', () => {
        console.log("Socket.io connected!");
    });

    socket.on('disconnect', () => {
        console.log("Socket.io disconnected!");
    });

    socket.on('reconnect', () => {
        if (currentRoom) {
            socket.emit('rejoinRoom', { roomCode: currentRoom, username: currentUsername });
        }
    });
});