'use strict';
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Настройки CORS с учетом среды выполнения
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://myfighting-game.ru', 'https://www.myfighting-game.ru']
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  serveClient: false
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
      imageSrc: path.join('/img/samuraiMack/Idle.png'),
      offset: { x: 215, y: 157 },
      attackBox: { offset: { x: 100, y: 50 }, width: 160, height: 50 }
    },
    {
      name: 'kenji',
      imageSrc: path.join('/img/kenji/Idle.png'),
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
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://myfighting-game.ru', 'https://www.myfighting-game.ru']
    : '*'
}));

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=3600');
  }
}));

// API для проверки состояния
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'ok',
    players: serverState.players.size,
    activeGames: serverState.activeGames.size,
    uptime: process.uptime()
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
    status: 'waiting',
    lastActive: Date.now()
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

// Проверка активности игрока
const checkPlayerActivity = () => {
  const now = Date.now();
  serverState.players.forEach((player, id) => {
    if (now - player.lastActive > 30000) { // 30 секунд неактивности
      const socket = io.sockets.sockets.get(id);
      if (socket) {
        socket.disconnect();
      }
    }
  });
};

// Обработчики Socket.IO
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  
  // Защита от перегрузки
  if (serverState.players.size >= MAX_PLAYERS) {
    socket.emit('error', { message: 'Server is full. Try again later.', code: 503 });
    socket.disconnect();
    return;
  }

  // Таймер проверки активности
  const activityCheck = setInterval(() => {
    const player = serverState.players.get(socket.id);
    if (player && Date.now() - player.lastActive > 30000) {
      socket.disconnect();
    }
  }, 10000);

  // Регистрация игрока
  socket.on('registerPlayer', (username, callback) => {
    try {
      if (!username || typeof username !== 'string') {
        throw new Error('Invalid username');
      }

      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
        throw new Error('Username must be between 2 and 20 characters');
      }

      if (Array.from(serverState.players.values()).some(p => p.username === trimmedUsername)) {
        throw new Error('Username already taken');
      }

      const player = initPlayer(socket.id, trimmedUsername, true);
      serverState.players.set(socket.id, player);

      callback({
        success: true,
        playerId: socket.id,
        username: trimmedUsername,
        characters: serverState.characters
      });

      io.emit('playerListUpdate', {
        players: Array.from(serverState.players.values())
          .filter(p => p.status === 'waiting')
      });

    } catch (err) {
      console.error('Registration error:', err);
      callback({ 
        success: false, 
        error: err.message,
        code: 400
      });
    }
  });

  // Вызов на бой
  socket.on('challengePlayer', (targetId, callback) => {
    try {
      if (!targetId || typeof targetId !== 'string') {
        throw new Error('Invalid player ID');
      }

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
          [targetId]: { ...target, status: 'inGame', position: { x: 400, y: 0 } }
        },
        startTime: Date.now(),
        timer: null
      };

      game.timer = setInterval(() => updateGameState(gameId), 1000/60);

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
      console.error('Challenge error:', err);
      callback({ 
        success: false, 
        error: err.message,
        code: 400
      });
    }
  });

  // Обновление состояния игрока
  socket.on('playerUpdate', (data) => {
    try {
      const player = serverState.players.get(socket.id);
      if (!player) return;

      player.lastActive = Date.now();

      const game = findPlayerGame(socket.id);
      if (!game) return;

      Object.assign(player, {
        position: data.position || player.position,
        velocity: data.velocity || player.velocity,
        isAttacking: data.isAttacking || false,
        facingRight: data.facingRight !== undefined ? data.facingRight : player.facingRight
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
    } catch (err) {
      console.error('Player update error:', err);
    }
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    clearInterval(activityCheck);

    const game = findPlayerGame(socket.id);
    if (game) {
      endGame(game.id, 'disconnect');
    }

    serverState.players.delete(socket.id);
    io.emit('playerListUpdate', {
      players: Array.from(serverState.players.values())
        .filter(p => p.status === 'waiting')
    });
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
  try {
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
      if (!player) return;

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
  } catch (err) {
    console.error('Game state update error:', err);
  }
}

function endGame(gameId, reason) {
  try {
    const game = serverState.activeGames.get(gameId);
    if (!game) return;

    if (game.timer) {
      clearInterval(game.timer);
    }
    
    let winnerId = null;
    const players = Object.keys(game.players);

    if (typeof reason === 'string') {
      if (reason === 'timeout') {
        const [p1, p2] = players;
        winnerId = game.players[p1].health > game.players[p2].health ? p1 : p2;
      } else if (reason !== 'disconnect') {
        winnerId = players.find(id => id !== reason);
      }
    }

    // Обновление статусов
    players.forEach(playerId => {
      const player = serverState.players.get(playerId);
      if (player) {
        player.status = 'waiting';
        player.health = 100;
        player.position = { x: playerId === players[0] ? 100 : 400, y: 0 };
        player.velocity = { x: 0, y: 0 };
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
  } catch (err) {
    console.error('Game end error:', err);
  }
}

// Запуск сервера
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Запуск проверки активности
  setInterval(checkPlayerActivity, 30000);
});

// Обработка ошибок
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('Server shutting down (SIGINT)...');
  shutdown();
});

process.on('SIGTERM', () => {
  console.log('Server shutting down (SIGTERM)...');
  shutdown();
});

function shutdown() {
  // Завершение всех игр
  serverState.activeGames.forEach((game, id) => {
    endGame(id, 'server shutdown');
  });

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Принудительное завершение через 5 секунд
  setTimeout(() => {
    console.error('Forcing shutdown...');
    process.exit(1);
  }, 5000);
}
