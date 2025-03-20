const socket = io();

socket.on('connect', () => {
    console.log("Connected to server with ID:", socket.id);
    document.getElementById("status").innerText = "Connected to server!";
});

socket.on('serverToClient', (data) => {
    console.log("Message from server:", data);
    alert("Server says: " + data);
});

document.addEventListener("DOMContentLoaded", () => {
    const sendMessageButton = document.getElementById("sendMessage");
    const messageInput = document.getElementById("messageInput");

    if (sendMessageButton && messageInput) {
        sendMessageButton.addEventListener("click", () => {
            const message = messageInput.value.trim();
            if (message) {
                socket.emit('clientToServer', message);
                messageInput.value = "";
            }
        });
    } else {
        console.error("sendMessage or messageInput element not found.");
    }
});