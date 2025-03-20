const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins during development
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.emit('serverToClient', "Welcome to the server!");

    socket.on('clientToServer', (data) => {
        console.log(`Message from ${socket.id}:`, data);
        io.emit('serverToClient', `User ${socket.id} says: ${data}`);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
