const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const waitingPlayers = new Map();
const activeGames = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register', (username) => {
        socket.username = username;
        waitingPlayers.set(socket.id, username);
        io.emit('updateWaitingList', Array.from(waitingPlayers.values()));
    });

    socket.on('challenge', (opponentUsername) => {
        const opponentSocket = Array.from(waitingPlayers.entries())
            .find(([_, username]) => username === opponentUsername)?.[0];

        if (opponentSocket) {
            const gameId = `${socket.id}-${opponentSocket}`;
            activeGames.set(gameId, {
                players: [socket.id, opponentSocket],
                currentTurn: socket.id
            });

            waitingPlayers.delete(socket.id);
            waitingPlayers.delete(opponentSocket);
            
            io.to(opponentSocket).emit('gameStart', {
                gameId,
                opponent: socket.username,
                isFirst: false
            });
            
            socket.emit('gameStart', {
                gameId,
                opponent: waitingPlayers.get(opponentSocket),
                isFirst: true
            });

            io.emit('updateWaitingList', Array.from(waitingPlayers.values()));
        }
    });

    socket.on('makeMove', (data) => {
        const game = activeGames.get(data.gameId);
        if (game && game.currentTurn === socket.id) {
            const opponentId = game.players.find(id => id !== socket.id);
            io.to(opponentId).emit('opponentMove', data.move);
            game.currentTurn = opponentId;
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayers.has(socket.id)) {
            waitingPlayers.delete(socket.id);
            io.emit('updateWaitingList', Array.from(waitingPlayers.values()));
        }
        
        // Обработка отключения во время игры
        for (const [gameId, game] of activeGames.entries()) {
            if (game.players.includes(socket.id)) {
                const opponentId = game.players.find(id => id !== socket.id);
                if (opponentId) {
                    io.to(opponentId).emit('opponentDisconnected');
                }
                activeGames.delete(gameId);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 