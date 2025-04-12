const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Настройки CORS для Express
app.use(cors({
  origin: ['https://myfighting-game.ru', 'https://www.myfighting-game.ru'],
  methods: ['GET', 'POST']
}));

// Middleware для статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Роут для главной страницы
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
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// Игровое состояние
const gameState = {
  players: {},
  lastUpdateTime: Date.now(),
  settings: {
    gravity: 0.5,
    floorLevel: 330,
    playerSpeed: 5,
    jumpForce: -10,
    attackDamage: 20
  }
};

// Генерация ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Проверка столкновений
const checkCollision = (attacker, target) => {
  return (
    attacker.attackBox.x + attacker.attackBox.width >= target.position.x &&
    attacker.attackBox.x <= target.position.x + 50 &&
    attacker.attackBox.y + attacker.attackBox.height >= target.position.y &&
    attacker.attackBox.y <= target.position.y + 150
  );
};

// Инициализация нового игрока
const initPlayer = (playerId) => {
  return {
    id: playerId,
    position: { x: Math.random() * 400, y: 0 },
    velocity: { x: 0, y: 0 },
    health: 100,
    lastKey: '',
    isAttacking: false,
    attackBox: {
      x: 0,
      y: 0,
      width: 100,
      height: 50
    },
    facingRight: true
  };
};

// Обработка подключений
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  const playerId = socket.id;
  gameState.players[playerId] = initPlayer(playerId);

  // Отправка начальных данных игроку
  socket.emit('init', { 
    playerId,
    gameState,
    controls: {
      left: 'a',
      right: 'd',
      jump: 'w',
      attack: ' '
    }
  });

  // Уведомление других игроков
  socket.broadcast.emit('playerJoined', gameState.players[playerId]);

  // Обработка движения
  socket.on('movement', (movementData) => {
    const player = gameState.players[playerId];
    if (!player) return;

    player.velocity.x = movementData.velocity.x;
    player.lastKey = movementData.lastKey;
    player.facingRight = movementData.facingRight;
    
    if (movementData.isJumping && player.position.y >= gameState.settings.floorLevel - 1) {
      player.velocity.y = gameState.settings.jumpForce;
    }

    if (movementData.isAttacking) {
      player.isAttacking = true;
      player.attackBox = {
        x: player.position.x + (player.facingRight ? 50 : -100),
        y: player.position.y + 30,
        width: 100,
        height: 50
      };
    } else {
      player.isAttacking = false;
    }
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    console.log('Disconnected:', playerId);
    delete gameState.players[playerId];
    io.emit('playerLeft', playerId);
  });
});

// Игровой цикл (60 FPS)
const gameLoop = setInterval(() => {
  const now = Date.now();
  const deltaTime = (now - gameState.lastUpdateTime) / 1000;
  gameState.lastUpdateTime = now;

  // Обновление позиций игроков
  Object.values(gameState.players).forEach(player => {
    // Гравитация
    player.velocity.y += gameState.settings.gravity;
    
    // Движение
    player.position.x += player.velocity.x * gameState.settings.playerSpeed;
    player.position.y += player.velocity.y;
    
    // Ограничение по земле
    if (player.position.y > gameState.settings.floorLevel) {
      player.position.y = gameState.settings.floorLevel;
      player.velocity.y = 0;
    }
  });

  // Проверка столкновений
  const players = Object.entries(gameState.players);
  for (let i = 0; i < players.length; i++) {
    const [id1, p1] = players[i];
    
    for (let j = i + 1; j < players.length; j++) {
      const [id2, p2] = players[j];
      
      if (p1.isAttacking && checkCollision(p1, p2)) {
        p2.health -= gameState.settings.attackDamage;
        io.to(id2).emit('hit', { 
          health: p2.health,
          attacker: id1 
        });
      }
      
      if (p2.isAttacking && checkCollision(p2, p1)) {
        p1.health -= gameState.settings.attackDamage;
        io.to(id1).emit('hit', { 
          health: p1.health,
          attacker: id2 
        });
      }
    }
  }

  // Синхронизация состояния
  io.emit('gameUpdate', gameState);
}, 1000 / 60);

// Запуск сервера
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Обработка завершения работы
process.on('SIGTERM', () => {
  clearInterval(gameLoop);
  server.close(() => {
    console.log('Server gracefully stopped');
  });
});