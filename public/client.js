const socket = io(window.location.hostname === "localhost" ? 'http://localhost:3000' : 'https://your-render-url.onrender.com');
let currentRoom = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("joinRoomBtn").addEventListener("click", () => {
        const roomCode = document.getElementById("roomCode").value.trim();
        const username = document.getElementById("username").value.trim();

        if (roomCode && username) {
            currentRoom = roomCode;
            socket.emit('joinRoom', roomCode, username);
            document.getElementById("roomDisplay").innerText = `Room Code: ${roomCode}`;
        }
    });

    socket.on('roomUpdate', (players) => {
        const playerList = document.getElementById("playerList");
        playerList.innerHTML = `<h3>Players in Room:</h3>`;
        
        if (players.length === 0) {
            playerList.innerHTML += "<p>No players in the room.</p>";
        } else {
            players.forEach(player => {
                playerList.innerHTML += `<p>${player.name}</p>`;
            });
        }

        console.log("Updated player list:", players);
    });
});
