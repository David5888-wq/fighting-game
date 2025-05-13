const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });
const PORT = 3000;

// Хранение данных игроков и матчей
const players = {};
const waitingPlayers = [];
const activeMatches = {};

// Список доступных персонажей
const characters = ['ryu', 'ken', 'chunli', 'guile', 'dhalsim', 'zangief'];

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Новый игрок подключён:', socket.id);

    // Обработка входа в лобби
    socket.on('joinLobby', (playerData) => {
        const player = {
            id: socket.id,
            nickname: playerData.nickname,
            character: null,
            inMatch: false
        };
        
        players[socket.id] = player;
        waitingPlayers.push(socket.id);
        
        // Отправляем обновленный список ожидающих игроков всем
        io.emit('lobbyUpdate', waitingPlayers.map(id => ({
            id: id,
            nickname: players[id].nickname
        })));
    });

    // Обработка выбора противника
    socket.on('challengePlayer', (targetId) => {
        const challenger = players[socket.id];
        const target = players[targetId];
        
        if (challenger && target && !challenger.inMatch && !target.inMatch) {
            // Случайный выбор персонажей
            challenger.character = characters[Math.floor(Math.random() * characters.length)];
            target.character = characters[Math.floor(Math.random() * characters.length)];
            
            // Создаем матч
            const matchId = `${socket.id}-${targetId}`;
            activeMatches[matchId] = {
                players: [socket.id, targetId],
                characters: [challenger.character, target.character],
                scores: [0, 0]
            };
            
            // Обновляем статус игроков
            challenger.inMatch = true;
            target.inMatch = true;
            
            // Удаляем из списка ожидания
            waitingPlayers.splice(waitingPlayers.indexOf(socket.id), 1);
            waitingPlayers.splice(waitingPlayers.indexOf(targetId), 1);
            
            // Отправляем информацию о начале матча
            io.to(socket.id).emit('matchStart', {
                matchId: matchId,
                opponent: target.nickname,
                yourCharacter: challenger.character,
                opponentCharacter: target.character
            });
            
            io.to(targetId).emit('matchStart', {
                matchId: matchId,
                opponent: challenger.nickname,
                yourCharacter: target.character,
                opponentCharacter: challenger.character
            });
            
            // Обновляем лобби для всех
            io.emit('lobbyUpdate', waitingPlayers.map(id => ({
                id: id,
                nickname: players[id].nickname
            })));
        }
    });

    // Обработка движения в матче
    socket.on('playerMovement', (data) => {
        const matchId = Object.keys(activeMatches).find(id => 
            activeMatches[id].players.includes(socket.id)
        );
        
        if (matchId) {
            const opponentId = activeMatches[matchId].players.find(id => id !== socket.id);
            io.to(opponentId).emit('opponentMoved', data);
        }
    });

    // Обработка завершения матча
    socket.on('matchEnd', (data) => {
        const matchId = Object.keys(activeMatches).find(id => 
            activeMatches[id].players.includes(socket.id)
        );
        
        if (matchId) {
            const match = activeMatches[matchId];
            const players = match.players;
            
            // Возвращаем игроков в лобби
            players.forEach(playerId => {
                if (players[playerId]) {
                    players[playerId].inMatch = false;
                    players[playerId].character = null;
                    waitingPlayers.push(playerId);
                }
            });
            
            // Удаляем матч
            delete activeMatches[matchId];
            
            // Обновляем лобби
            io.emit('lobbyUpdate', waitingPlayers.map(id => ({
                id: id,
                nickname: players[id].nickname
            })));
        }
    });

    // Обработка отключения
    socket.on('disconnect', () => {
        console.log('Игрок отключён:', socket.id);
        
        // Удаляем из списка ожидания
        const waitingIndex = waitingPlayers.indexOf(socket.id);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
        }
        
        // Удаляем из активных матчей
        const matchId = Object.keys(activeMatches).find(id => 
            activeMatches[id].players.includes(socket.id)
        );
        
        if (matchId) {
            const opponentId = activeMatches[matchId].players.find(id => id !== socket.id);
            io.to(opponentId).emit('opponentDisconnected');
            delete activeMatches[matchId];
        }
        
        delete players[socket.id];
        
        // Обновляем лобби
        io.emit('lobbyUpdate', waitingPlayers.map(id => ({
            id: id,
            nickname: players[id].nickname
        })));
    });
});

http.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});