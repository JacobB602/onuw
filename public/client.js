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

    // ✅ Corrected Role Highlighting Logic
    document.querySelectorAll('.role').forEach(roleElement => {
        const roleName = roleElement.getAttribute('data-role');

        // Check if this specific role is selected in the roles object
        const isSelected = Object.values(roles).some(selectedRole => selectedRole === roleName);

        if (isSelected) {
            roleElement.classList.add('selected'); // Highlight role
            
            // Assign correct colors based on role type
            if (['werewolf', 'minion', 'squire'].includes(roleName)) {
                roleElement.classList.add('evil');
                roleElement.classList.remove('neutral');
            } else if (['tanner', 'executioner', 'apprentice-tanner'].includes(roleName)) {
                roleElement.classList.add('neutral');
                roleElement.classList.remove('evil');
            } else {
                roleElement.classList.remove('evil', 'neutral'); // Default "good" roles
            }
        } else {
            roleElement.classList.remove('selected', 'evil', 'neutral'); // Remove highlights
        }
    });
});

// Handle clicking on the "Roles" button
document.getElementById("roles").addEventListener("click", () => {
    const settingsPopup = document.getElementById("settingsPopup");

    if (isHost) {
        settingsPopup.style.display = "flex"; // Host can modify roles
    } else {
        // For non-hosts, show the available roles in a simple popup
        const availableRoles = Object.keys(roles).map(role => {
            return `<div>${role}: ${roles[role] ? "Enabled" : "Disabled"}</div>`;
        }).join("");

        // Display the roles that the host has enabled (not assigned yet)
        const rolesListPopup = document.getElementById("rolesListPopup");
        rolesListPopup.innerHTML = `<strong>Available Roles:</strong><br>${availableRoles}`;
        rolesListPopup.style.display = "block";  // Show the popup
    }
});


