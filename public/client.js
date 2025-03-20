const socket = io(window.location.hostname === "localhost" ? 'http://localhost:10000' : 'https://onuw.onrender.com');

let currentRoom = null;
let currentUsername = null;
let isHost = false;

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

    setTimeout(() => {
        const username = prompt("Please enter your name:");
        if (username) {
            currentUsername = username;
            socket.emit('joinRoomWithName', { roomCode: currentRoom, username: currentUsername });
        }
    }, 500);
});

// Update room UI when players or roles change
socket.on('roomUpdate', (players, roles) => {
    console.log("Room update received:", players, roles);
    
    const playerList = document.getElementById("playerList");
    playerList.innerHTML = "";  

    // Identify if the current user is the host
    isHost = players.length > 0 && players[0].id === socket.id;

    // Update the button text based on host status
    const rolesButton = document.getElementById("roles");
    rolesButton.textContent = isHost ? "Role Settings" : "View Roles";

    players.forEach(player => {
        const listItem = document.createElement("li");
        listItem.textContent = player.name || 'Unnamed Player';

        // Display role selection for host only
        if (isHost) {
            const roleSelect = document.createElement("select");
            roleSelect.innerHTML = `
                <option value="">Select Role</option>
                <option value="Villager">Villager</option>
                <option value="Werewolf">Werewolf</option>
                <option value="Seer">Seer</option>
            `;
            roleSelect.value = roles[player.id] || "";
            roleSelect.addEventListener("change", () => {
                socket.emit('setRole', { roomCode: currentRoom, role: roleSelect.value, playerId: player.id });
            });
            listItem.appendChild(roleSelect);
        } else {
            // Non-hosts only see assigned roles, but can't change them
            listItem.textContent += ` - Role: ${roles[player.id] || "Not Assigned"}`;
        }

        playerList.appendChild(listItem);
    });
});

// Handle clicking on the "Roles" button
document.getElementById("roles").addEventListener("click", () => {
    const settingsPopup = document.getElementById("settingsPopup");

    if (isHost) {
        settingsPopup.style.display = "flex"; // Host can modify roles
    } else {
        alert("You can only view roles. The host manages them.");
    }
});
