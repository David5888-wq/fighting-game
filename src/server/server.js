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
        currentPlayer: player1Id,
        dice: [0, 0, 0, 0, 0],
        rollsLeft: 3,
        scores: {
            player1: {},
            player2: {}
        }
    });
    return matchId;
}

io.on('connection', (socket) => {
    console.log('Новый игрок подключён:', socket.id);

    // Добавление игрока в список ожидания
    socket.on('joinQueue', (data) => {
        if (waitingPlayers.includes(socket.id)) return;
        players[socket.id] = {
            id: socket.id,
            name: data.name
        };
        waitingPlayers.push(socket.id);
        socket.emit('queueStatus', { position: waitingPlayers.length });
        // Отправляем список ожидающих всем
        io.emit('waitingPlayers', waitingPlayers.map(id => ({
            id,
            name: players[id].name
        })));
    });

    // Новое событие: приглашение в игру
    socket.on('inviteToGame', (data) => {
        const inviterId = socket.id;
        const invitedId = data.invitedId;
        // Проверяем, что оба в списке ожидания
        if (
            waitingPlayers.includes(inviterId) &&
            waitingPlayers.includes(invitedId)
        ) {
            // Удаляем обоих из очереди
            waitingPlayers.splice(waitingPlayers.indexOf(inviterId), 1);
            waitingPlayers.splice(waitingPlayers.indexOf(invitedId), 1);
            // Создаём матч
            const matchId = createMatch(inviterId, invitedId);
            // Уведомляем игроков
            io.to(inviterId).to(invitedId).emit('matchFound', {
                matchId,
                players: [inviterId, invitedId],
                names: {
                    [inviterId]: players[inviterId].name,
                    [invitedId]: players[invitedId].name
                }
            });
            // Отправляем начальное состояние игры
            const gameState = activeMatches.get(matchId);
            io.to(inviterId).to(invitedId).emit('gameState', gameState);
            // Обновляем список ожидания для всех
            io.emit('waitingPlayers', waitingPlayers.map(id => ({
                id,
                name: players[id].name
            })));
        }
    });

    // Обработка броска кубиков
    socket.on('diceRolled', (data) => {
        for (const [matchId, match] of activeMatches.entries()) {
            if (match.players.includes(socket.id)) {
                match.dice = data.dice;
                match.rollsLeft = data.rollsLeft;
                
                // Отправляем обновление всем игрокам в матче
                match.players.forEach(playerId => {
                    io.to(playerId).emit('gameState', match);
                });
                break;
            }
        }
    });

    // Обработка выбора комбинации
    socket.on('combinationSelected', (data) => {
        for (const [matchId, match] of activeMatches.entries()) {
            if (match.players.includes(socket.id)) {
                const playerKey = match.players.indexOf(socket.id) === 0 ? 'player1' : 'player2';
                match.scores[playerKey][data.combination] = data.score;
                
                // Отправляем обновление всем игрокам в матче
                match.players.forEach(playerId => {
                    io.to(playerId).emit('gameState', match);
                });
                break;
            }
        }
    });

    // Обработка завершения хода
    socket.on('turnEnded', () => {
        for (const [matchId, match] of activeMatches.entries()) {
            if (match.players.includes(socket.id)) {
                // Передаем ход следующему игроку
                const currentPlayerIndex = match.players.indexOf(match.currentPlayer);
                const nextPlayerIndex = (currentPlayerIndex + 1) % 2;
                match.currentPlayer = match.players[nextPlayerIndex];
                match.rollsLeft = 3;
                
                // Отправляем обновление всем игрокам в матче
                match.players.forEach(playerId => {
                    io.to(playerId).emit('gameState', match);
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
        
        // Обновляем список ожидающих игроков
        io.emit('waitingPlayers', waitingPlayers.map(id => ({
            id,
            name: players[id].name
        })));
    });
});

http.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер доступен по адресу http://localhost:${PORT}`);
}); 