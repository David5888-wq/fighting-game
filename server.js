const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

// Middleware для статических файлов (должен быть в начале)
app.use(express.static(path.join(__dirname, 'public')));

// Явный роут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Настройка Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Хранилище игровых данных
const gameState = {
  players: {},
  projectiles: {},
  lastUpdateTime: Date.now()
};

// Генератор ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Функция проверки столкновений
function checkCollision(attackBox, position) {
  return (
    attackBox.position.x + attackBox.width >= position.x &&
    attackBox.position.x <= position.x + 50 &&
    attackBox.position.y + attackBox.height >= position.y &&
    attackBox.position.y <= position.y + 150
  );
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  const playerId = socket.id;
  gameState.players[playerId] = {
    id: playerId,
    position: { x: Math.random() * 400, y: 0 },
    velocity: { x: 0, y: 0 },
    health: 100,
    lastKey: '',
    isAttacking: false,
    attackBox: {
      position: { x: 0, y: 0 },
      width: 100,
      height: 50
    }
  };

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

  socket.broadcast.emit('newPlayer', gameState.players[playerId]);

  socket.on('playerMovement', (movementData) => {
    if (gameState.players[playerId]) {
      gameState.players[playerId] = {
        ...gameState.players[playerId],
        ...movementData
      };
      
      if (movementData.isAttacking) {
        gameState.players[playerId].attackBox.position = {
          x: movementData.position.x + (movementData.lastKey === 'd' ? 100 : -100),
          y: movementData.position.y + 50
        };
      }
      
      io.emit('playerMoved', {
        id: playerId,
        ...movementData
      });
    }
  });

  socket.on('playerAttack', (attackData) => {
    if (gameState.players[playerId]) {
      gameState.players[playerId].isAttacking = true;
      io.emit('playerAttacked', {
        id: playerId,
        ...attackData
      });
    }
  });

  socket.on('playerHit', (hitData) => {
    if (gameState.players[hitData.targetId]) {
      gameState.players[hitData.targetId].health -= 20;
      io.emit('playerHealthUpdate', {
        id: hitData.targetId,
        health: gameState.players[hitData.targetId].health
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', playerId);
    delete gameState.players[playerId];
    io.emit('playerDisconnected', playerId);
  });
});

// Игровой цикл
const gameLoop = setInterval(() => {
  const now = Date.now();
  const dt = (now - gameState.lastUpdateTime) / 1000;
  gameState.lastUpdateTime = now;

  Object.values(gameState.players).forEach(player => {
    player.velocity.y += 0.5;
    player.position.x += player.velocity.x;
    player.position.y += player.velocity.y;
    
    if (player.position.y > 330) {
      player.position.y = 330;
      player.velocity.y = 0;
    }
  });

  // Проверка столкновений
  const players = Object.entries(gameState.players);
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const [id1, p1] = players[i];
      const [id2, p2] = players[j];
      
      if (p1.isAttacking && checkCollision(p1.attackBox, p2.position)) {
        io.emit('playerHit', {
          attackerId: id1,
          targetId: id2
        });
      }
      
      if (p2.isAttacking && checkCollision(p2.attackBox, p1.position)) {
        io.emit('playerHit', {
          attackerId: id2,
          targetId: id1
        });
      }
    }
  }
}, 1000 / 60);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Обработка завершения работы
process.on('SIGTERM', () => {
  clearInterval(gameLoop);
  server.close();
});