const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Настройки CORS
const allowedOrigins = [
  'https://myfighting-game.ru',
  'https://www.myfighting-game.ru',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Конфигурация Socket.IO
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingInterval: 5000,
  pingTimeout: 10000
});

const PORT = process.env.PORT || 3000;

// Состояние сервера
const serverState = {
  players: new Map(),    // Все подключенные игроки
  activeGames: new Map(), // Активные игры
  settings: {
    gravity: 0.5,
    floorLevel: 330,
    playerSpeed: 5,
    jumpForce: -10,
    attackDamage: 20,
    gameDuration: 60
  }
};

// Генерация ID игры
const generateGameId = () => Math.random().toString(36).substr(2, 12);

// Инициализация игрока
const initPlayer = (socketId, username, isPlayer1) => ({
  id: socketId,
  username,
  position: { x: isPlayer1 ? 100 : 400, y: 0 },
  velocity: { x: 0, y: 0 },
  health: 100,
  isAttacking: false,
  attackBox: { x: 0, y: 0, width: 100, height: 50 },
  facingRight: isPlayer1,
  lastKey: ''
});

// Проверка столкновений
const checkCollision = (attacker, target) => (
  attacker.attackBox.x + attacker.attackBox.width >= target.position.x &&
  attacker.attackBox.x <= target.position.x + 50 &&
  attacker.attackBox.y + attacker.attackBox.height >= target.position.y &&
  attacker.attackBox.y <= target.position.y + 150
);

// Обработка подключений
io.on('connection', (socket) => {
  console.log(`Новое подключение: ${socket.id}`);

  // Обработка регистрации игрока
  socket.on('registerPlayer', (username) => {
    if (!username || username.trim() === '') {
      username = `Player${Math.floor(Math.random() * 1000)}`;
    }
    
    serverState.players.set(socket.id, {
      id: socket.id,
      username,
      status: 'waiting'
    });

    socket.emit('registrationSuccess', {
      id: socket.id,
      username,
      players: Array.from(serverState.players.values())
        .filter(p => p.id !== socket.id && p.status === 'waiting')
    });

    // Уведомляем других игроков о новом подключении
    socket.broadcast.emit('playerJoined', {
      id: socket.id,
      username,
      status: 'waiting'
    });
  });

  // Обработка вызова на бой
  socket.on('challengePlayer', (targetId) => {
    const challenger = serverState.players.get(socket.id);
    const target = serverState.players.get(targetId);

    if (!challenger || !target || target.status !== 'waiting') {
      socket.emit('challengeFailed', 'Игрок недоступен');
      return;
    }

    // Создаем игру
    const gameId = generateGameId();
    const newGame = {
      players: {
        [socket.id]: initPlayer(socket.id, challenger.username, true),
        [targetId]: initPlayer(targetId, target.username, false)
      },
      startTime: Date.now(),
      intervalId: null
    };

    // Обновляем статусы игроков
    challenger.status = 'inGame';
    target.status = 'inGame';
    serverState.activeGames.set(gameId, newGame);

    // Настройка игрового цикла
    newGame.intervalId = setInterval(() => gameLoop(gameId), 1000/60);

    // Уведомление игроков
    io.to(socket.id).socketsJoin(gameId);
    io.to(targetId).socketsJoin(gameId);

    io.to(gameId).emit('gameStart', {
      gameId,
      players: newGame.players
    });

    // Уведомляем всех об изменении статусов
    io.emit('playerStatusChanged', {
      id: socket.id,
      status: 'inGame'
    });
    io.emit('playerStatusChanged', {
      id: targetId,
      status: 'inGame'
    });

    console.log(`Создана игра ${gameId} между ${socket.id} и ${targetId}`);
  });

  // Обработка движения игрока
  socket.on('movement', (data) => {
    try {
      const gameEntry = Array.from(serverState.activeGames.entries())
        .find(([_, game]) => game.players[socket.id]);

      if (!gameEntry) return;

      const [gameId, game] = gameEntry;
      const player = game.players[socket.id];

      // Обновление состояния игрока
      player.position = data.position;
      player.facingRight = data.facingRight;
      player.isAttacking = data.isAttacking;

      if (data.isAttacking) {
        player.attackBox = {
          x: player.position.x + (player.facingRight ? 50 : -100),
          y: player.position.y + 30,
          width: 100,
          height: 50
        };
      }

      // Отправка обновлений
      io.to(gameId).emit('playerUpdate', {
        playerId: socket.id,
        ...player
      });
    } catch (error) {
      console.error(`Ошибка в обработчике движения: ${error}`);
    }
  });

  // Обработка ударов
  socket.on('attack', () => {
    try {
      const gameEntry = Array.from(serverState.activeGames.entries())
        .find(([_, game]) => game.players[socket.id]);

      if (!gameEntry) return;

      const [gameId, game] = gameEntry;
      const attacker = game.players[socket.id];
      const opponentId = Object.keys(game.players).find(id => id !== socket.id);
      const opponent = game.players[opponentId];

      if (checkCollision(attacker, opponent)) {
        opponent.health = Math.max(0, opponent.health - serverState.settings.attackDamage);

        io.to(gameId).emit('hit', {
          targetId: opponentId,
          health: opponent.health,
          attackerId: socket.id
        });

        if (opponent.health <= 0) {
          endGame(gameId, socket.id);
        }
      }
    } catch (error) {
      console.error(`Ошибка в обработчике атаки: ${error}`);
    }
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    console.log(`Отключение: ${socket.id}`);
    const player = serverState.players.get(socket.id);
    
    if (player) {
      serverState.players.delete(socket.id);
      io.emit('playerLeft', socket.id);
    }

    // Поиск активной игры
    const gameEntry = Array.from(serverState.activeGames.entries())
      .find(([_, game]) => game.players[socket.id]);

    if (gameEntry) {
      const [gameId, game] = gameEntry;
      endGame(gameId, 'disconnect');
    }
  });
});

// Игровой цикл
const gameLoop = (gameId) => {
  try {
    const game = serverState.activeGames.get(gameId);
    if (!game) return;

    // Проверка времени
    const elapsed = (Date.now() - game.startTime) / 1000;
    if (elapsed >= serverState.settings.gameDuration) {
      endGame(gameId, 'timeout');
      return;
    }

    // Обновление физики
    Object.values(game.players).forEach(player => {
      player.velocity.y += serverState.settings.gravity;
      player.position.x += player.velocity.x * serverState.settings.playerSpeed;
      player.position.y += player.velocity.y;

      if (player.position.y > serverState.settings.floorLevel) {
        player.position.y = serverState.settings.floorLevel;
        player.velocity.y = 0;
      }
    });

    // Синхронизация состояния
    io.to(gameId).emit('gameStateUpdate', {
      players: game.players,
      timeLeft: Math.max(0, serverState.settings.gameDuration - elapsed)
    });
  } catch (error) {
    console.error(`Ошибка в игровом цикле: ${error}`);
    endGame(gameId, 'server_error');
  }
};

// Завершение игры
const endGame = (gameId, reason) => {
  try {
    const game = serverState.activeGames.get(gameId);
    if (!game) return;

    clearInterval(game.intervalId);
    
    // Определяем победителя
    let winnerId = null;
    if (typeof reason === 'string') {
      const players = Object.keys(game.players);
      if (players.length === 2) {
        winnerId = players.find(id => id !== reason);
      }
    } else {
      winnerId = reason;
    }

    io.to(gameId).emit('gameOver', {
      reason: reason === 'timeout' ? 'Время вышло!' : 
             (reason === 'disconnect' ? 'Игрок отключился' : 'Ошибка сервера'),
      winner: winnerId
    });

    // Обновляем статусы игроков
    Object.keys(game.players).forEach(playerId => {
      const player = serverState.players.get(playerId);
      if (player) {
        player.status = 'waiting';
        io.emit('playerStatusChanged', {
          id: playerId,
          status: 'waiting'
        });
      }
    });

    serverState.activeGames.delete(gameId);
    io.in(gameId).socketsLeave(gameId);
  } catch (error) {
    console.error(`Ошибка при завершении игры: ${error}`);
  }
};

// Обработка ошибок сервера
server.on('error', (error) => {
  console.error('Server error:', error);
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});