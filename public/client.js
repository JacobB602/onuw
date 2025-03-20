const socket = io(window.location.hostname === "localhost" ? 'http://localhost:3000' : 'https://one-night-werewolf.onrender.com');
let currentRoom = null;
let currentUsername = null;

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

    // Ask the user for their name after joining the room
    setTimeout(() => {
        const username = prompt("Please enter your name:");
        if (username) {
            currentUsername = username;
            socket.emit('joinRoomWithName', { roomCode: currentRoom, username: currentUsername });
        }
    }, 500); // Delay to ensure the room join is processed
});

socket.on('roomUpdate', (players) => {
    console.log("Received room update:", players);
    const playerList = document.getElementById("playerList");
    playerList.innerHTML = "";  // Clear existing list
    players.forEach(player => {
        const listItem = document.createElement("li");
        listItem.textContent = player.name || 'Unnamed Player';  // Add player's name
        playerList.appendChild(listItem);
    });
});
