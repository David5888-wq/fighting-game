const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;

let waitingPlayers = [];
let games = {};

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            return;
        }

        if (data.type === 'join') {
            ws.username = data.username;
            ws.isPlaying = false;
            waitingPlayers.push(ws);
            broadcastLobby();
        }

        if (data.type === 'invite') {
            const opponent = waitingPlayers.find(p => p.username === data.opponent);
            if (opponent && opponent.readyState === WebSocket.OPEN) {
                const gameId = Math.random().toString(36).substr(2, 9);
                games[gameId] = [ws, opponent];
                ws.isPlaying = true;
                opponent.isPlaying = true;
                ws.gameId = gameId;
                opponent.gameId = gameId;
                waitingPlayers = waitingPlayers.filter(p => p !== ws && p !== opponent);
                ws.send(JSON.stringify({ type: 'start', opponent: opponent.username, first: true, gameId }));
                opponent.send(JSON.stringify({ type: 'start', opponent: ws.username, first: false, gameId }));
                broadcastLobby();
            }
        }

        if (data.type === 'game') {
            const game = games[data.gameId];
            if (game) {
                game.forEach(player => {
                    if (player !== ws && player.readyState === WebSocket.OPEN) {
                        player.send(JSON.stringify({ type: 'game', payload: data.payload }));
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        waitingPlayers = waitingPlayers.filter(p => p !== ws);
        if (ws.gameId && games[ws.gameId]) {
            games[ws.gameId].forEach(player => {
                if (player !== ws && player.readyState === WebSocket.OPEN) {
                    player.send(JSON.stringify({ type: 'opponent_left' }));
                }
            });
            delete games[ws.gameId];
        }
        broadcastLobby();
    });
});

function broadcastLobby() {
    const lobby = waitingPlayers.filter(p => !p.isPlaying).map(p => p.username);
    waitingPlayers.forEach(p => {
        if (p.readyState === WebSocket.OPEN) {
            p.send(JSON.stringify({ type: 'lobby', lobby }));
        }
    });
}

server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});