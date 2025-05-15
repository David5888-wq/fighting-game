const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Создаем HTTP сервер для обслуживания статики
const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    let contentType = 'text/html';

    switch (ext) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Создаем WebSocket сервер на том же порту
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
                        dice: [1,1,1,1,1],
                        locked: [false,false,false,false,false],
                        rollsLeft: 3,
                        currentPlayer: playerId,
                        scores: { player: {}, opponent: {} }
                    }
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
                    if (game.players.length < 2) {
                        game.players.push(playerId);
                        broadcast(gameId, {
                            type: 'gameStart',
                            gameId,
                            players: game.players
                        });
                    }
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
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    ws.on('close', () => {
        if (gameId && games.has(gameId)) {
            const game = games.get(gameId);
            game.players = game.players.filter(p => p !== playerId);
            if (game.players.length === 0) {
                games.delete(gameId);
            } else {
                broadcast(gameId, {
                    type: 'playerLeft',
                    playerId
                });
            }
        }
    });
});

function broadcast(gameId, message) {
    const game = games.get(gameId);
    if (game) {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && game.players.includes(client.playerId)) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Запускаем сервер на порту 8080
server.listen(8080, () => {
    console.log('Server started on port 8080');
});