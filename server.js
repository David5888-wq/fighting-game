// server.js (Node.js)
const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = 443; // HTTPS использует порт 443

// SSL-сертификаты (нужно загрузить их на сервер)
const privateKey = fs.readFileSync('/etc/ssl/private/your-private.key', 'utf8');
const certificate = fs.readFileSync('/etc/ssl/certs/your-certificate.crt', 'utf8');
const ca = fs.readFileSync('/etc/ssl/certs/your-ca-bundle.crt', 'utf8');

const credentials = {
    key: privateKey,
    cert: certificate,
    ca: ca
};

// Отдача статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// HTTPS-сервер
const server = https.createServer(credentials, app);
server.listen(PORT, () => {
    console.log(`Server is running on https://myfighting-game.ru`);
});

// WebSocket-сервер
const wss = new WebSocket.Server({ server });

const games = new Map();

wss.on('connection', (ws) => {
    let playerId = generateId();
    let gameId = null;

    ws.send(JSON.stringify({ type: 'playerId', playerId }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'createGame') {
            gameId = generateId();
            games.set(gameId, {
                players: [playerId],
                state: null
            });
            ws.send(JSON.stringify({ 
                type: 'gameStart', 
                gameId,
                players: [playerId]
            }));
        }
        
        if (data.type === 'joinGame') {
            if (games.has(data.gameId)) {
                const game = games.get(data.gameId);
                game.players.push(playerId);
                game.state.currentPlayer = playerId;
                broadcast(gameId, {
                    type: 'gameStart',
                    gameId,
                    players: game.players
                });
            }
        }
        
        if (data.type === 'gameState') {
            const game = games.get(data.gameId);
            game.state = data.state;
            broadcast(data.gameId, {
                type: 'gameState',
                state: data.state
            });
        }
    });
});

function broadcast(gameId, message) {
    const game = games.get(gameId);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}