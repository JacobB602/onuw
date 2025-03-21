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

    // Prompt for the username immediately after joining the room
    const username = prompt("Please enter your name:");
    if (username) {
        currentUsername = username;
        socket.emit('joinRoomWithName', { roomCode: currentRoom, username: currentUsername });
    }
});

// Update room UI when players or roles change
socket.on('roomUpdate', (players, roles) => {
    console.log("Received room update:", players, roles);

    const playerList = document.getElementById("playerList");
    playerList.innerHTML = "";

    // Update player list with names and assigned roles
    players.forEach(player => {
        const listItem = document.createElement("li");
        listItem.textContent = player.name || "Unnamed";

        // Add role to the player list item
        const role = roles[player.id];  // Get the player's role
        if (role) {
            listItem.textContent += ` - ${role}`;  // Append the role to the name
        }

        playerList.appendChild(listItem);
    });

    // Update role highlighting
    updateRolesUI(roles);

    // Check if this player is the host
    isHost = players[0].id === socket.id;

    // Update the roles button text and functionality
    const rolesButton = document.getElementById("roles");
    if (isHost) {
        rolesButton.textContent = "Edit Roles"; // Host can edit roles
        rolesButton.onclick = function () {
            document.getElementById("settingsPopup").style.display = "flex";
        };
    } else {
        rolesButton.textContent = "View Roles"; // Non-hosts can only view roles
        rolesButton.onclick = function () {
            document.getElementById("settingsPopup").style.display = "flex";
        };
    }
});

// Function to update the roles UI
function updateRolesUI(roles) {
    document.querySelectorAll(".role").forEach(roleElement => {
        roleElement.addEventListener("click", function () {
            if (!isHost) return; // Only the host can select roles

            const roleName = this.getAttribute("data-role");

            // Toggle selection
            if (this.classList.contains("selected")) {
                this.classList.remove("selected", "evil", "good", "neutral");
            } else {
                this.classList.add("selected");

                // Assign colors based on role type
                if (
                    roleName === "werewolf" ||
                    roleName === "minion" ||
                    roleName === "squire" ||
                    roleName === "alpha-wolf" ||
                    roleName === "mystic-wolf" ||
                    roleName === "dream-wolf"
                ) {
                    this.classList.add("evil");
                } else if (
                    roleName === "tanner" ||
                    roleName === "apprentice-tanner" ||
                    roleName === "executioner"
                ) {
                    this.classList.add("neutral");
                } else {
                    this.classList.add("good");
                }
            }

            // Send live update to server
            const selectedRoles = Array.from(document.querySelectorAll(".role.selected")).map(role => role.dataset.role);
            socket.emit("updateRoles", { roomCode: currentRoom, roles: selectedRoles });
        });
    });  
}

// Handle clicking on the "Roles" button
document.getElementById("roles").addEventListener("click", () => {
    const settingsPopup = document.getElementById("settingsPopup");

    if (isHost) {
        settingsPopup.style.display = "flex"; // Host can modify roles
    } else {
        settingsPopup.style.display = "flex"; // Non-hosts can view roles
    }
});

// Handle saving role settings
document.getElementById("saveSettings").style.display = "none";

// Handle closing the popup
document.getElementById("closePopup").addEventListener("click", function() {
    document.getElementById("settingsPopup").style.display = "none";
});