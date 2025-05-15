// server.js (Node.js)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

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