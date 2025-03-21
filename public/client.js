document.addEventListener('DOMContentLoaded', function() {
    const socket = io('onuw.up.railway.app');

    let currentRoom = null;
    let currentUsername = null;
    let isHost = false;
    let playerCount = 0;
    let roles = {};

    document.getElementById("joinRoom").addEventListener("click", function() {
        const roomCode = document.getElementById("roomCode").value.trim();

        if (!roomCode) {
            alert("Please enter a room code!");
            return;
        }

        currentRoom = roomCode;
        socket.emit('joinRoom', { roomCode });

        document.getElementById("roomDisplay").textContent = roomCode;
        document.getElementById("lobby").style.display = "block";

        const username = prompt("Please enter your name:");
        if (username) {
            currentUsername = username;
            socket.emit('joinRoomWithName', { roomCode: currentRoom, username: currentUsername });
        }
    });

    socket.on('roomUpdate', (players, receivedRoles) => {
        console.log("Received room update:", players, receivedRoles);
        roles = receivedRoles;

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

        playerCount = players.length;
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
            const isSelected = roles.includes(roleName); // Treat roles as an array
    
            if (isSelected) {
                roleElement.classList.add('selected');
                if (["werewolf", "minion", "squire", "alpha-wolf", "mystic-wolf", "dream-wolf"].includes(roleName)) {
                    roleElement.classList.add('evil');
                    roleElement.classList.remove('good', 'neutral');
                } else if (["tanner", "apprentice-tanner", "executioner"].includes(roleName)) {
                    roleElement.classList.add('neutral');
                    roleElement.classList.remove('evil', 'good');
                } else {
                    roleElement.classList.add('good');
                    roleElement.classList.remove('evil', 'neutral');
                }
            } else {
                roleElement.classList.remove('selected', 'evil', 'good', 'neutral');
            }
    
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
                if (["werewolf", "minion", "squire", "alpha-wolf", "mystic-wolf", "dream-wolf"].includes(role.dataset.role)) {
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
    
        // Debug: Check if the gameScreen element exists
        const gameScreen = document.getElementById('gameScreen');
        if (!gameScreen) {
            console.error("gameScreen element not found!");
            return;
        }
    
        // Debug: Check if the lobby element exists
        const lobby = document.getElementById('lobby');
        if (!lobby) {
            console.error("lobby element not found!");
            return;
        }
    
        // Hide the lobby and show the game screen
        lobby.style.display = 'none';
        gameScreen.style.display = 'block';
    
        // Debug: Check if the player's role is assigned
        const myRole = assignedRoles[socket.id];
        if (!myRole) {
            console.error("No role assigned for this player!");
            return;
        }
        document.getElementById('gameMessage').textContent = `Your role is: ${myRole}`;
    
        // Optional: Display all player roles (for testing)
        const playerRoleDisplay = document.getElementById('playerRoleDisplay');
        playerRoleDisplay.innerHTML = '';
        for (const playerId in assignedRoles) {
            playerRoleDisplay.innerHTML += `<p>${playerId}: ${assignedRoles[playerId]}</p>`;
        }
    });

    socket.on('connect', () => {
        console.log("Socket.io connected!");
    });

    socket.on('disconnect', () => {
        console.log("Socket.io disconnected!");
    });
});