const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });
const PORT = 3000;
const players = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Новый игрок подключён:', socket.id);

    // Определение цвета игрока
    const color = Object.keys(players).length === 0 ? 'red' : 'blue';
    
    // Создание данных игрока
    players[socket.id] = {
        id: socket.id,
        position: { x: color === 'red' ? 0 : 400, y: 0 },
        velocity: { x: 0, y: 0 },
        lastKey: null,
        color: color
    };

    // Отправка данных текущему игроку
    socket.emit('init', { color: color });

    // Уведомление других игроков о новом подключении
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Отправка списка игроков новому клиенту
    socket.emit('currentPlayers', players);

    // Обработка движения
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].position = movementData.position;
            players[socket.id].velocity = movementData.velocity;
            players[socket.id].lastKey = movementData.lastKey;
            // Пересылка данных всем, кроме отправителя
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Обработка отключения
    socket.on('disconnect', () => {
        console.log('Игрок отключён:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

http.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер доступен по адресу http://192.168.0.131:${PORT}`);
});