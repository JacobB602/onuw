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
                listItem.textContent += ` - ${role}`;
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
        document.getElementById('gameMessage').textContent = `Your role is: ${myRole}`;
    
        // Trigger the card flip animation
        const card = document.getElementById('card');
    
        // Create and append the button
        confirmButton = document.createElement("button");
        confirmButton.textContent = "Confirm Role";
        confirmButton.addEventListener("click", confirmRole);
    
        console.log("gameScreen element:", document.getElementById("gameScreen")); // Add this line
        console.log("confirmButton element:", confirmButton); // Add this line
    
        document.getElementById("gameScreen").appendChild(confirmButton);
    
        console.log("Button appended successfully."); // Add this line
    
        // Optional: Add some styling to the button to make it more visible
        confirmButton.style.marginTop = "20px"; // Add some space between the card and the button
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
        // Add night phase UI here
    });

    socket.on('connect', () => {
        console.log("Socket.io connected!");
    });

    socket.on('disconnect', () => {
        console.log("Socket.io disconnected!");
    });
});