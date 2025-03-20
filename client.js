const socket = io('http://localhost:3000', {
    transports: ['websocket', 'polling']
});

socket.on('connect', () => {
    console.log("Connected to server with ID:", socket.id);
});

socket.on('serverToClient', (data) => {
    console.log("Message from server:", data);
    alert("Server says: " + data);
});

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("sendMessage").addEventListener("click", () => {
        const message = document.getElementById("messageInput").value;
        if (message.trim()) {
            socket.emit('clientToServer', message);
            document.getElementById("messageInput").value = "";
        }
    });
});
