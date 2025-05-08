const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });
const PORT = 3000;

// Хранение данных игроков и матчей
const players = {};
const waitingPlayers = [];
const activeMatches = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Новый игрок подключён:', socket.id);

    // Обработка входа игрока
    socket.on('playerLogin', (nickname) => {
        players[socket.id] = {
            id: socket.id,
            nickname: nickname,
            status: 'waiting',
            character: null
        };
        
        // Добавляем игрока в список ожидания
        waitingPlayers.push(socket.id);
        
        // Отправляем обновленный список ожидающих игроков всем
        io.emit('waitingPlayersUpdate', waitingPlayers.map(id => ({
            id: id,
            nickname: players[id].nickname
        })));
    });

    // Обработка выбора противника
    socket.on('challengePlayer', (targetId) => {
        const challenger = players[socket.id];
        const target = players[targetId];
        
        if (target && target.status === 'waiting') {
            // Создаем новый матч
            const matchId = `${socket.id}-${targetId}`;
            const characters = ['samuraiMack', 'kenji'];
            const randomCharacters = characters.sort(() => Math.random() - 0.5);
            
            activeMatches[matchId] = {
                players: [socket.id, targetId],
                characters: randomCharacters,
                status: 'active'
            };
            
            // Обновляем статусы игроков
            players[socket.id].status = 'inMatch';
            players[socket.id].character = randomCharacters[0];
            players[targetId].status = 'inMatch';
            players[targetId].character = randomCharacters[1];
            
            // Удаляем игроков из списка ожидания
            const index1 = waitingPlayers.indexOf(socket.id);
            const index2 = waitingPlayers.indexOf(targetId);
            if (index1 > -1) waitingPlayers.splice(index1, 1);
            if (index2 > -1) waitingPlayers.splice(index2, 1);
            
            // Отправляем информацию о матче обоим игрокам
            io.to(socket.id).emit('matchStart', {
                matchId: matchId,
                character: randomCharacters[0],
                opponent: {
                    id: targetId,
                    nickname: target.nickname
                }
            });
            
            io.to(targetId).emit('matchStart', {
                matchId: matchId,
                character: randomCharacters[1],
                opponent: {
                    id: socket.id,
                    nickname: challenger.nickname
                }
            });
            
            // Обновляем список ожидающих игроков
            io.emit('waitingPlayersUpdate', waitingPlayers.map(id => ({
                id: id,
                nickname: players[id].nickname
            })));
        }
    });

    // Обработка движения в матче
    socket.on('playerMovement', (data) => {
        const { matchId, position, velocity, lastKey } = data;
        if (activeMatches[matchId]) {
            socket.to(matchId).emit('opponentMoved', {
                position,
                velocity,
                lastKey
            });
        }
    });

    // Обработка атаки
    socket.on('playerAttack', (data) => {
        const { matchId, attackData } = data;
        if (activeMatches[matchId]) {
            socket.to(matchId).emit('opponentAttack', attackData);
        }
    });

    // Обработка окончания матча
    socket.on('matchEnd', (data) => {
        const { matchId, winner } = data;
        if (activeMatches[matchId]) {
            const match = activeMatches[matchId];
            
            // Возвращаем игроков в лобби
            match.players.forEach(playerId => {
                players[playerId].status = 'waiting';
                players[playerId].character = null;
                waitingPlayers.push(playerId);
            });
            
            // Отправляем результат матча обоим игрокам
            io.to(matchId).emit('matchResult', { winner });
            
            // Удаляем матч
            delete activeMatches[matchId];
            
            // Обновляем список ожидающих игроков
            io.emit('waitingPlayersUpdate', waitingPlayers.map(id => ({
                id: id,
                nickname: players[id].nickname
            })));
        }
    });

    // Обработка отключения
    socket.on('disconnect', () => {
        console.log('Игрок отключён:', socket.id);
        
        // Удаляем игрока из списка ожидания
        const waitingIndex = waitingPlayers.indexOf(socket.id);
        if (waitingIndex > -1) {
            waitingPlayers.splice(waitingIndex, 1);
        }
        
        // Находим и завершаем активный матч игрока
        for (const [matchId, match] of Object.entries(activeMatches)) {
            if (match.players.includes(socket.id)) {
                const opponentId = match.players.find(id => id !== socket.id);
                if (opponentId) {
                    io.to(opponentId).emit('opponentDisconnected');
                    players[opponentId].status = 'waiting';
                    players[opponentId].character = null;
                    waitingPlayers.push(opponentId);
                }
                delete activeMatches[matchId];
            }
        }
        
        // Удаляем данные игрока
        delete players[socket.id];
        
        // Обновляем список ожидающих игроков
        io.emit('waitingPlayersUpdate', waitingPlayers.map(id => ({
            id: id,
            nickname: players[id].nickname
        })));
    });
});

http.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер доступен по адресу http://localhost:${PORT}`);
});