const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Настройки CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.static(path.join(__dirname, 'public')));

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
  players: new Map(),
  activeGames: new Map(),
  characters: [
    {
      name: 'samurai',
      imageSrc: '/img/samuraiMack/Idle.png',
      offset: { x: 215, y: 157 },
      attackBox: { offset: { x: 100, y: 50 }, width: 160, height: 50 }
    },
    {
      name: 'kenji',
      imageSrc: '/img/kenji/Idle.png',
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
    gameDuration: 60
  }
};

// Генерация ID игры
const generateGameId = () => Math.random().toString(36).substr(2, 9);

// Инициализация игрока
const initPlayer = (socketId, username, isPlayer1, character) => ({
  id: socketId,
  username,
  position: { x: isPlayer1 ? 100 : 400, y: 0 },
  velocity: { x: 0, y: 0 },
  health: 100,
  isAttacking: false,
  facingRight: isPlayer1,
  lastKey: '',
  character,
  attackBox: {
    position: { x: 0, y: 0 },
    offset: character.attackBox.offset,
    width: character.attackBox.width,
    height: character.attackBox.height
  }
});

// Проверка столкновений
const checkCollision = (attacker, target) => {
  return (
    attacker.attackBox.position.x + attacker.attackBox.width >= target.position.x &&
    attacker.attackBox.position.x <= target.position.x + 50 &&
    attacker.attackBox.position.y + attacker.attackBox.height >= target.position.y &&
    attacker.attackBox.position.y <= target.position.y + 150
  );
};

// Обработка подключений
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

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
      socket.emit('challengeFailed', 'Player unavailable');
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
      settings: serverState.settings
    });

    // Обновление списка игроков
    io.emit('playerStatusChanged', { id: socket.id, status: 'inGame' });
    io.emit('playerStatusChanged', { id: targetId, status: 'inGame' });
  });

  // Обработка движения
  socket.on('movement', (data) => {
    const gameEntry = Array.from(serverState.activeGames.entries())
      .find(([_, game]) => game.players[socket.id]);

    if (!gameEntry) return;

    const [gameId, game] = gameEntry;
    const player = game.players[socket.id];

    player.position = data.position;
    player.velocity = data.velocity;
    player.facingRight = data.facingRight;
    player.isAttacking = data.isAttacking;
    player.lastKey = data.lastKey;

    // Обновление позиции атак бокса
    player.attackBox.position.x = player.position.x + 
      (player.facingRight ? player.attackBox.offset.x : -player.attackBox.offset.x);
    player.attackBox.position.y = player.position.y + player.attackBox.offset.y;

    io.to(gameId).emit('gameStateUpdate', {
      players: game.players,
      timeLeft: Math.max(0, serverState.settings.gameDuration - (Date.now() - game.startTime) / 1000)
    });
  });

  // Обработка атаки
  socket.on('attack', () => {
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
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    const player = serverState.players.get(socket.id);
    
    if (player) {
      serverState.players.delete(socket.id);
      io.emit('playerLeft', socket.id);
    }

    const gameEntry = Array.from(serverState.activeGames.entries())
      .find(([_, game]) => game.players[socket.id]);

    if (gameEntry) {
      const [gameId] = gameEntry;
      endGame(gameId, 'disconnect');
    }
  });
});

// Игровой цикл
const gameLoop = (gameId) => {
  const game = serverState.activeGames.get(gameId);
  if (!game) return;

  // Расчет времени
  const elapsed = (Date.now() - game.startTime) / 1000;
  const timeLeft = Math.max(0, serverState.settings.gameDuration - elapsed);

  // Проверка таймера
  if (timeLeft <= 0) {
    endGame(gameId, 'timeout');
    return;
  }

  // Физика
  Object.values(game.players).forEach(player => {
    player.velocity.y += serverState.settings.gravity;
    player.position.y += player.velocity.y;

    // Ограничение по земле
    if (player.position.y > serverState.settings.floorLevel) {
      player.position.y = serverState.settings.floorLevel;
      player.velocity.y = 0;
    }
  });

  // Отправка состояния
  io.to(gameId).emit('gameStateUpdate', {
    players: game.players,
    timeLeft: timeLeft.toFixed(1)
  });
};

// Завершение игры
const endGame = (gameId, reason) => {
  const game = serverState.activeGames.get(gameId);
  if (!game) return;

  clearInterval(game.intervalId);
  
  let winnerId = null;
  if (typeof reason === 'string') {
    const players = Object.keys(game.players);
    if (players.length === 2) winnerId = players.find(id => id !== reason);
  } else {
    winnerId = reason;
  }

  io.to(gameId).emit('gameOver', {
    reason: reason === 'timeout' ? 'Time is up!' : 
           (reason === 'disconnect' ? 'Player disconnected' : 'Server error'),
    winner: winnerId
  });

  Object.keys(game.players).forEach(playerId => {
    const player = serverState.players.get(playerId);
    if (player) {
      player.status = 'waiting';
      io.emit('playerStatusChanged', { id: playerId, status: 'waiting' });
    }
  });

  serverState.activeGames.delete(gameId);
  io.in(gameId).socketsLeave(gameId);
};

// Обработчики ошибок
server.on('error', (error) => {
  console.error('Server error:', error);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
