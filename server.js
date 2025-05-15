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

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'createGame') {
                gameId = generateId();
                games.set(gameId, {
                    players: [playerId],
                    state: {
                        currentPlayer: playerId,
                        dice: [],
                        rollsLeft: 3,
                        scores: {}
                    }
                });
                ws.send(JSON.stringify({ 
                    type: 'gameStart', 
                    gameId,
                    players: [playerId],
                    isCreator: true
                }));
            }
            
            if (data.type === 'joinGame') {
                if (games.has(data.gameId)) {
                    gameId = data.gameId;
                    const game = games.get(gameId);
                    
                    if (game.players.length < 2) {
                        game.players.push(playerId);
                        
                        // Отправляем обновление обоим игрокам
                        broadcast(gameId, {
                            type: 'gameStart',
                            gameId,
                            players: game.players,
                            state: game.state
                        });
                    } else {
                        ws.send(JSON.stringify({ 
                            type: 'error', 
                            message: 'Игра уже заполнена' 
                        }));
                    }
                } else {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Игра не найдена' 
                    }));
                }
            }
            
            if (data.type === 'gameState') {
                const game = games.get(data.gameId);
                if (game) {
                    game.state = data.state;
                    broadcast(data.gameId, {
                        type: 'gameState',
                        state: data.state
                    });
                }
            }
            
            if (data.type === 'chatMessage') {
                broadcast(data.gameId, {
                    type: 'chatMessage',
                    playerId: playerId,
                    message: data.message
                });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        if (gameId && games.has(gameId)) {
            const game = games.get(gameId);
            game.players = game.players.filter(id => id !== playerId);
            
            if (game.players.length === 0) {
                games.delete(gameId);
            } else {
                broadcast(gameId, {
                    type: 'playerLeft',
                    playerId: playerId
                });
            }
        }
    });
});

function broadcast(gameId, message) {
    if (!games.has(gameId)) return;
    
    const game = games.get(gameId);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                ...message,
                gameId: gameId
            }));
        }
    });
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}