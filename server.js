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
  players: new Map(),     // Все подключенные игроки
  activeGames: new Map(), // Активные игры
  characters: [           // Список персонажей
    {
      name: 'samurai',
      imageSrc: './img/samuraiMack/Idle.png',
      offset: { x: 215, y: 157 },
      attackBox: { offset: { x: 100, y: 50 }, width: 160, height: 50 }
    },
    {
      name: 'kenji',
      imageSrc: './img/kenji/Idle.png',
      offset: { x: 215, y: 167 },
      attackBox: { offset: { x: -170, y: 50 }, width: 170, height: 50 }
    }
  ],
  settings: {
    gravity: 0.5,
    floorLevel: 330,
    playerSpeed: 5,
    jumpForce: -10,
    attackDamage: 20,
    gameDuration: 60      // Продолжительность игры в секундах
  }
};

// Генерация ID игры
const generateGameId = () => Math.random().toString(36).substr(2, 12);

// Инициализация игрока
const initPlayer = (socketId, username, isPlayer1, character) => ({
  id: socketId,
  username,
  position: { x: isPlayer1 ? 100 : 400, y: 0 },
  velocity: { x: 0, y: 0 },
  health: 100,
  isAttacking: false,
  attackBox: character.attackBox,
  facingRight: isPlayer1,
  lastKey: '',
  character               // Сохраняем данные персонажа
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

  // Регистрация игрока
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

    socket.broadcast.emit('playerJoined', {
      id: socket.id,
      username,
      status: 'waiting'
    });
  });

  // Вызов на бой
  socket.on('challengePlayer', (targetId) => {
    const challenger = serverState.players.get(socket.id);
    const target = serverState.players.get(targetId);

    if (!challenger || !target || target.status !== 'waiting') {
      socket.emit('challengeFailed', 'Игрок недоступен');
      return;
    }

    // Случайный выбор персонажей
    const availableChars = [...serverState.characters];
    const char1 = availableChars.splice(Math.floor(Math.random() * availableChars.length), 1)[0];
    const char2 = availableChars[0];

    const gameId = generateGameId();
    const newGame = {
      players: {
        [socket.id]: initPlayer(socket.id, challenger.username, true, char1),
        [targetId]: initPlayer(targetId, target.username, false, char2)
      },
      startTime: Date.now(),
      intervalId: null
    };

    // Обновление статусов игроков
    challenger.status = 'inGame';
    target.status = 'inGame';
    serverState.activeGames.set(gameId, newGame);

    // Запуск игрового цикла
    newGame.intervalId = setInterval(() => gameLoop(gameId), 1000/60);

    // Присоединение к игровой комнате
    socket.join(gameId);
    socket.to(targetId).socketsJoin(gameId);

    // Отправка начальных данных игры
    io.to(gameId).emit('gameStart', {
      gameId,
      players: newGame.players,
      characters: [char1, char2],
      settings: serverState.settings
    });

    // Обновление списка игроков
    io.emit('playerStatusChanged', { id: socket.id, status: 'inGame' });
    io.emit('playerStatusChanged', { id: targetId, status: 'inGame' });
  });

  // Обработка движения
  socket.on('movement', (data) => {
    try {
      const gameEntry = Array.from(serverState.activeGames.entries())
        .find(([_, game]) => game.players[socket.id]);

      if (!gameEntry) return;

      const [gameId, game] = gameEntry;
      const player = game.players[socket.id];

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

      io.to(gameId).emit('playerUpdate', {
        playerId: socket.id,
        ...player
      });
    } catch (error) {
      console.error(`Ошибка обработки движения: ${error}`);
    }
  });

  // Обработка атаки
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
      console.error(`Ошибка обработки атаки: ${error}`);
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log(`Отключение: ${socket.id}`);
    const player = serverState.players.get(socket.id);
    
    if (player) {
      serverState.players.delete(socket.id);
      io.emit('playerLeft', socket.id);

      // Поиск активной игры игрока
      const gameEntry = Array.from(serverState.activeGames.entries())
        .find(([_, game]) => game.players[socket.id]);

      if (gameEntry) {
        const [gameId, game] = gameEntry;
        const opponentId = Object.keys(game.players).find(id => id !== socket.id);
        
        // Завершение игры
        endGame(gameId, opponentId);
      }
    }
  });
});

// Игровой цикл
const gameLoop = (gameId) => {
  const game = serverState.activeGames.get(gameId);
  if (!game) return;

  const currentTime = Date.now();
  const elapsedTime = (currentTime - game.startTime) / 1000;
  
  // Проверка времени игры
  if (elapsedTime >= serverState.settings.gameDuration) {
    endGame(gameId, 'timeout');
    return;
  }

  // Обновление таймера
  io.to(gameId).emit('timerUpdate', Math.ceil(serverState.settings.gameDuration - elapsedTime));

  // Применение гравитации и обновление позиций
  Object.values(game.players).forEach(player => {
    player.velocity.y += serverState.settings.gravity;
    player.position.y += player.velocity.y;

    // Проверка столкновения с полом
    if (player.position.y + 150 >= serverState.settings.floorLevel) {
      player.position.y = serverState.settings.floorLevel - 150;
      player.velocity.y = 0;
    }
  });
};

// Завершение игры
const endGame = (gameId, winnerId) => {
  const game = serverState.activeGames.get(gameId);
  if (!game) return;

  // Очистка интервала
  if (game.intervalId) {
    clearInterval(game.intervalId);
  }

  // Определение победителя
  let winner;
  if (winnerId === 'timeout') {
    const player1 = Object.values(game.players)[0];
    const player2 = Object.values(game.players)[1];
    winner = player1.health > player2.health ? player1.id : player2.id;
  } else {
    winner = winnerId;
  }

  // Отправка результата игры
  io.to(gameId).emit('gameOver', {
    winner,
    players: game.players
  });

  // Обновление статусов игроков
  Object.keys(game.players).forEach(playerId => {
    const player = serverState.players.get(playerId);
    if (player) {
      player.status = 'waiting';
      io.emit('playerStatusChanged', { id: playerId, status: 'waiting' });
    }
  });

  // Удаление игры
  serverState.activeGames.delete(gameId);
};

// Обработчики ошибок
io.on('error', (error) => {
  console.error('Socket error:', error);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  server.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});