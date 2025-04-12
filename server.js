const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Настройки CORS
app.use(cors({
  origin: ['https://myfighting-game.ru', 'https://www.myfighting-game.ru'],
  methods: ['GET', 'POST']
}));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Конфигурация Socket.IO
const io = socketIo(server, {
  cors: {
    origin: ['https://myfighting-game.ru', 'https://www.myfighting-game.ru'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket']
});

const PORT = process.env.PORT || 3000;

// Состояние игры
const gameState = {
  waitingPlayers: [],
  activeGames: {},
  settings: {
    gravity: 0.5,
    floorLevel: 330,
    playerSpeed: 5,
    jumpForce: -10,
    attackDamage: 20,
    gameDuration: 60 // секунд
  }
};

// Генерация ID игры
const generateGameId = () => Math.random().toString(36).substr(2, 8);

// Инициализация игрока
const initPlayer = (socketId) => ({
  id: socketId,
  position: { x: 100, y: 0 },
  velocity: { x: 0, y: 0 },
  health: 100,
  isAttacking: false,
  attackBox: { x: 0, y: 0, width: 100, height: 50 },
  facingRight: true,
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

  // Добавляем игрока в очередь ожидания
  gameState.waitingPlayers.push(socket.id);
  socket.emit('status', 'Ожидание второго игрока...');

  // Если есть 2 игрока - создаем игру
  if (gameState.waitingPlayers.length >= 2) {
    const player1 = gameState.waitingPlayers.shift();
    const player2 = gameState.waitingPlayers.shift();
    const gameId = generateGameId();

    gameState.activeGames[gameId] = {
      players: {
        [player1]: { ...initPlayer(player1), position: { x: 100, y: 0 } },
        [player2]: { ...initPlayer(player2), position: { x: 400, y: 0 } }
      },
      startTime: Date.now()
    };

    // Уведомляем игроков
    io.to(player1).emit('gameStart', { 
      gameId, 
      playerId: player1,
      opponentId: player2,
      isPlayer1: true 
    });

    io.to(player2).emit('gameStart', { 
      gameId, 
      playerId: player2,
      opponentId: player1,
      isPlayer1: false 
    });

    console.log(`Создана игра ${gameId} между ${player1} и ${player2}`);
  }

  // Обработка движения игрока
  socket.on('movement', (data) => {
    const game = Object.values(gameState.activeGames).find(g => g.players[socket.id]);
    if (!game) return;

    const player = game.players[socket.id];
    player.position.x = data.position.x;
    player.position.y = data.position.y;
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

    // Отправляем обновление второму игроку
    socket.to(Object.keys(game.players).filter(id => id !== socket.id)).emit('playerUpdate', {
      playerId: socket.id,
      position: player.position,
      facingRight: player.facingRight,
      isAttacking: player.isAttacking
    });
  });

  // Обработка ударов
  socket.on('attack', () => {
    const game = Object.values(gameState.activeGames).find(g => g.players[socket.id]);
    if (!game) return;

    const attacker = game.players[socket.id];
    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    const opponent = game.players[opponentId];

    if (checkCollision(attacker, opponent)) {
      opponent.health -= gameState.settings.attackDamage;
      io.to(opponentId).emit('hit', { 
        health: opponent.health,
        attackerId: socket.id 
      });

      if (opponent.health <= 0) {
        io.to(socket.id).emit('gameOver', { winner: socket.id });
        io.to(opponentId).emit('gameOver', { winner: socket.id });
        delete gameState.activeGames[Object.keys(gameState.activeGames)
          .find(key => gameState.activeGames[key] === game)];
      }
    }
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    console.log(`Игрок отключился: ${socket.id}`);
    gameState.waitingPlayers = gameState.waitingPlayers.filter(id => id !== socket.id);

    // Завершаем игру, если игрок вышел во время матча
    const game = Object.values(gameState.activeGames).find(g => g.players[socket.id]);
    if (game) {
      const opponentId = Object.keys(game.players).find(id => id !== socket.id);
      if (opponentId) {
        io.to(opponentId).emit('opponentDisconnected');
      }
      delete gameState.activeGames[Object.keys(gameState.activeGames)
        .find(key => gameState.activeGames[key] === game)];
    }
  });
});

// Игровой цикл
setInterval(() => {
  Object.entries(gameState.activeGames).forEach(([gameId, game]) => {
    // Проверка времени игры
    const elapsed = (Date.now() - game.startTime) / 1000;
    if (elapsed >= gameState.settings.gameDuration) {
      io.to(Object.keys(game.players)).emit('gameOver', { 
        winner: null, 
        reason: 'Время вышло!' 
      });
      delete gameState.activeGames[gameId];
      return;
    }

    // Обновление позиций
    Object.values(game.players).forEach(player => {
      player.velocity.y += gameState.settings.gravity;
      player.position.x += player.velocity.x * gameState.settings.playerSpeed;
      player.position.y += player.velocity.y;

      if (player.position.y > gameState.settings.floorLevel) {
        player.position.y = gameState.settings.floorLevel;
        player.velocity.y = 0;
      }
    });

    // Синхронизация состояния
    io.to(Object.keys(game.players)).emit('gameStateUpdate', {
      players: game.players,
      timeLeft: Math.max(0, gameState.settings.gameDuration - elapsed)
    });
  });
}, 1000 / 60);

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});