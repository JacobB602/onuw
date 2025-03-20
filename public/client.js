const socket = io(window.location.hostname === "localhost" ? 'http://localhost:3000' : 'https://onuw.onrender.com');

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

    // Log when room is joined
    console.log(`Room code entered: ${roomCode}`);
    
    // Ask the user for their name after joining the room
    setTimeout(() => {
        console.log("Asking for username...");
        const username = prompt("Please enter your name:");
        if (username) {
            currentUsername = username;
            console.log(`User entered name: ${username}`); // Debug log
            socket.emit('joinRoomWithName', { roomCode: currentRoom, username: currentUsername });
        } else {
            console.log('User did not enter a name.');
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
