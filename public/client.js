const socket = io();
let currentRoom = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("joinRoomBtn").addEventListener("click", () => {
        const roomCode = document.getElementById("roomCode").value.trim();
        const username = document.getElementById("username").value.trim();

        if (roomCode && username) {
            currentRoom = roomCode;
            socket.emit('joinRoom', roomCode, username);
        }
    });

    socket.on('roomUpdate', (players) => {
        const playerList = document.getElementById("playerList");
        playerList.innerHTML = `<h3>Players in room: ${currentRoom}</h3>`;
        players.forEach(player => {
            playerList.innerHTML += `<p>${player.name}</p>`;
        });
    });
});
