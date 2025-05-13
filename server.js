const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });
const PORT = 3000;

const players = {};
const waitingPlayers = [];
const activeMatches = new Map();

app.use(express.static('public'));

function createMatch(player1Id, player2Id) {
    const matchId = `${player1Id}-${player2Id}`;
    activeMatches.set(matchId, {
        players: [player1Id, player2Id],
        scores: { [player1Id]: 0, [player2Id]: 0 }
    });
    return matchId;
}

io.on('connection', (socket) => {
    console.log('Новый игрок подключён:', socket.id);

    // Добавление игрока в список ожидания
    socket.on('joinQueue', () => {
        if (waitingPlayers.includes(socket.id)) return;
        
        waitingPlayers.push(socket.id);
        socket.emit('queueStatus', { position: waitingPlayers.length });
        
        // Если есть как минимум 2 игрока в очереди, создаем матч
        if (waitingPlayers.length >= 2) {
            const player1 = waitingPlayers.shift();
            const player2 = waitingPlayers.shift();
            
            const matchId = createMatch(player1, player2);
            
            // Определение цветов игроков
            players[player1] = { id: player1, color: 'red', position: { x: 0, y: 0 } };
            players[player2] = { id: player2, color: 'blue', position: { x: 400, y: 0 } };
            
            // Уведомляем игроков о начале матча
            io.to(player1).to(player2).emit('matchFound', {
                matchId,
                players: [player1, player2],
                colors: { [player1]: 'red', [player2]: 'blue' }
            });
        }
    });

    // Обработка движения
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].position = movementData.position;
            players[socket.id].velocity = movementData.velocity;
            players[socket.id].lastKey = movementData.lastKey;
            
            // Находим текущий матч игрока
            for (const [matchId, match] of activeMatches.entries()) {
                if (match.players.includes(socket.id)) {
                    // Отправляем обновление только игрокам в этом матче
                    match.players.forEach(playerId => {
                        if (playerId !== socket.id) {
                            io.to(playerId).emit('playerMoved', players[socket.id]);
                        }
                    });
                    break;
                }
            }
        }
    });

    // Обработка удара
    socket.on('playerAttack', (attackData) => {
        for (const [matchId, match] of activeMatches.entries()) {
            if (match.players.includes(socket.id)) {
                match.players.forEach(playerId => {
                    if (playerId !== socket.id) {
                        io.to(playerId).emit('enemyAttack', attackData);
                    }
                });
                break;
            }
        }
    });

    // Обработка отключения
    socket.on('disconnect', () => {
        console.log('Игрок отключён:', socket.id);
        
        // Удаляем из списка ожидания
        const queueIndex = waitingPlayers.indexOf(socket.id);
        if (queueIndex !== -1) {
            waitingPlayers.splice(queueIndex, 1);
        }
        
        // Удаляем из активных матчей
        for (const [matchId, match] of activeMatches.entries()) {
            if (match.players.includes(socket.id)) {
                match.players.forEach(playerId => {
                    if (playerId !== socket.id) {
                        io.to(playerId).emit('opponentDisconnected');
                    }
                });
                activeMatches.delete(matchId);
                break;
            }
        }
        
        delete players[socket.id];
    });
});

http.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер доступен по адресу http://localhost:${PORT}`);
});