require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Настройки CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://myfighting-game.ru', 'https://www.myfighting-game.ru']
      : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Конфигурация сервера
const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 100;
const GAME_DURATION = 60; // секунд

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
    jumpForce: -15,
    attackDamage: 20
  }
};

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// API для проверки состояния
app.get('/api/status', (req, res) => {
  res.json({
    players: serverState.players.size,
    activeGames: serverState.activeGames.size,
    status: 'online'
  });
});

// Инициализация игрока
const initPlayer = (socketId, username, isPlayer1) => {
  const availableChars = [...serverState.characters];
  const character = isPlayer1 
    ? availableChars.shift() 
    : availableChars.pop();

  return {
    id: socketId,
    username: username.trim(),
    position: { x: isPlayer1 ? 100 : 400, y: 0 },
    velocity: { x: 0, y: 0 },
    health: 100,
    isAttacking: false,
    character,
    lastKey: '',
    facingRight: isPlayer1,
    status: 'waiting'
  };
};

// Проверка столкновений
const checkCollision = (attacker, target) => {
  return (
    attacker.attackBox.x + attacker.attackBox.width >= target.position.x &&
    attacker.attackBox.x <= target.position.x + 50 &&
    attacker.attackBox.y + attacker.attackBox.height >= target.position.y &&
    attacker.attackBox.y <= target.position.y + 150
  );
};

// Обработчики Socket.IO
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  
  // Защита от перегрузки
  if (serverState.players.size >= MAX_PLAYERS) {
    socket.emit('error', 'Server is full. Try again later.');
    socket.disconnect();
    return;
  }

  // Регистрация игрока
  socket.on('registerPlayer', (username, callback) => {
    try {
      if (!username || username.trim().length < 2) {
        throw new Error('Username must be at least 2 characters');
      }

      if (Array.from(serverState.players.values()).some(p => p.username === username.trim())) {
        throw new Error('Username already taken');
      }

      const player = initPlayer(socket.id, username, true);
      serverState.players.set(socket.id, player);

      callback({
        success: true,
        playerId: socket.id,
        characters: serverState.characters
      });

      io.emit('playerListUpdate', {
        players: Array.from(serverState.players.values())
          .filter(p => p.status === 'waiting')
      });

    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // Вызов на бой
  socket.on('challengePlayer', (targetId, callback) => {
    try {
      const challenger = serverState.players.get(socket.id);
      const target = serverState.players.get(targetId);

      if (!challenger || !target || target.status !== 'waiting') {
        throw new Error('Player not available');
      }

      const gameId = `game_${Date.now()}`;
      const game = {
        id: gameId,
        players: {
          [socket.id]: { ...challenger, status: 'inGame' },
          [targetId]: { ...target, status: 'inGame' }
        },
        startTime: Date.now(),
        timer: setInterval(() => updateGameState(gameId), 1000/60)
      };

      serverState.activeGames.set(gameId, game);
      serverState.players.get(socket.id).status = 'inGame';
      serverState.players.get(targetId).status = 'inGame';

      socket.join(gameId);
      socket.to(targetId).socketsJoin(gameId);

      io.to(gameId).emit('gameStart', {
        gameId,
        players: game.players,
        settings: serverState.settings
      });

      callback({ success: true });

    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // Обновление состояния игрока
  socket.on('playerUpdate', (data) => {
    const game = findPlayerGame(socket.id);
    if (!game) return;

    const player = game.players[socket.id];
    if (!player) return;

    Object.assign(player, {
      position: data.position,
      velocity: data.velocity,
      isAttacking: data.isAttacking,
      facingRight: data.facingRight
    });

    if (data.isAttacking) {
      player.attackBox = {
        x: player.position.x + (player.facingRight ? 50 : -100),
        y: player.position.y + 30,
        width: 100,
        height: 50
      };
    }

    socket.to(game.id).emit('enemyUpdate', {
      playerId: socket.id,
      ...player
    });
  });

  // Обработка атаки
  socket.on('attack', () => {
    const game = findPlayerGame(socket.id);
    if (!game) return;

    const attacker = game.players[socket.id];
    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    const opponent = game.players[opponentId];

    if (checkCollision(attacker, opponent)) {
      opponent.health = Math.max(0, opponent.health - serverState.settings.attackDamage);

      io.to(game.id).emit('playerHit', {
        targetId: opponentId,
        health: opponent.health,
        attackerId: socket.id
      });

      if (opponent.health <= 0) {
        endGame(game.id, socket.id);
      }
    }
  });

  // Отключение игрока
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    const game = findPlayerGame(socket.id);
    
    if (game) {
      endGame(game.id, 'disconnect');
    } else {
      serverState.players.delete(socket.id);
      io.emit('playerListUpdate', {
        players: Array.from(serverState.players.values())
          .filter(p => p.status === 'waiting')
      });
    }
  });
});

// Вспомогательные функции
function findPlayerGame(playerId) {
  for (const [id, game] of serverState.activeGames) {
    if (game.players[playerId]) {
      return game;
    }
  }
  return null;
}

function updateGameState(gameId) {
  const game = serverState.activeGames.get(gameId);
  if (!game) return;

  // Проверка времени
  const elapsed = (Date.now() - game.startTime) / 1000;
  if (elapsed >= GAME_DURATION) {
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
    timeLeft: Math.floor(GAME_DURATION - elapsed)
  });
}

function endGame(gameId, reason) {
  const game = serverState.activeGames.get(gameId);
  if (!game) return;

  clearInterval(game.timer);
  
  let winnerId = null;
  const players = Object.keys(game.players);

  if (typeof reason === 'string') {
    if (reason === 'timeout') {
      // Побеждает игрок с большим здоровьем
      const [p1, p2] = players;
      winnerId = game.players[p1].health > game.players[p2].health ? p1 : p2;
    }
  } else {
    winnerId = reason;
  }

  // Обновление статусов
  players.forEach(playerId => {
    const player = serverState.players.get(playerId);
    if (player) {
      player.status = 'waiting';
      player.health = 100;
    }
  });

  io.to(gameId).emit('gameOver', {
    winner: winnerId,
    reason: reason === 'timeout' ? 'Time is up!' : 
           reason === 'disconnect' ? 'Player disconnected' : 'Game finished'
  });

  serverState.activeGames.delete(gameId);
  io.in(gameId).socketsLeave(gameId);

  // Обновление списка игроков
  io.emit('playerListUpdate', {
    players: Array.from(serverState.players.values())
      .filter(p => p.status === 'waiting')
  });
}

// Запуск сервера
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Обработка ошибок
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
