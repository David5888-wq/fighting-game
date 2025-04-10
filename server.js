const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
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

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Создаем нового игрока
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

  // Отправляем текущее состояние игры новому игроку
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

  // Сообщаем другим игрокам о новом подключении
  socket.broadcast.emit('newPlayer', gameState.players[playerId]);

  // Обработка движения игрока
  socket.on('playerMovement', (movementData) => {
    if (gameState.players[playerId]) {
      gameState.players[playerId].position = movementData.position;
      gameState.players[playerId].velocity = movementData.velocity;
      gameState.players[playerId].lastKey = movementData.lastKey;
      gameState.players[playerId].isAttacking = movementData.isAttacking;
      
      // Рассчитываем позицию атакующего бокса
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

  // Обработка атаки
  socket.on('playerAttack', (attackData) => {
    if (gameState.players[playerId]) {
      gameState.players[playerId].isAttacking = true;
      io.emit('playerAttacked', {
        id: playerId,
        ...attackData
      });
    }
  });

  // Обработка получения удара
  socket.on('playerHit', (hitData) => {
    if (gameState.players[hitData.targetId]) {
      gameState.players[hitData.targetId].health -= 20;
      io.emit('playerHealthUpdate', {
        id: hitData.targetId,
        health: gameState.players[hitData.targetId].health
      });
    }
  });

  // Отключение игрока
  socket.on('disconnect', () => {
    console.log('Client disconnected:', playerId);
    delete gameState.players[playerId];
    io.emit('playerDisconnected', playerId);
  });
});

// Игровой цикл на сервере
setInterval(() => {
  const now = Date.now();
  const dt = (now - gameState.lastUpdateTime) / 1000;
  gameState.lastUpdateTime = now;

  // Обновление позиций игроков
  Object.keys(gameState.players).forEach(id => {
    const player = gameState.players[id];
    
    // Гравитация
    player.velocity.y += 0.5;
    
    // Обновление позиции
    player.position.x += player.velocity.x;
    player.position.y += player.velocity.y;
    
    // Ограничение по земле
    if (player.position.y > 330) {
      player.position.y = 330;
      player.velocity.y = 0;
    }
  });

  // Проверка столкновений
  Object.keys(gameState.players).forEach(id1 => {
    Object.keys(gameState.players).forEach(id2 => {
      if (id1 !== id2) {
        const p1 = gameState.players[id1];
        const p2 = gameState.players[id2];
        
        if (p1.isAttacking && checkCollision(p1.attackBox, p2.position)) {
          io.emit('playerHit', {
            attackerId: id1,
            targetId: id2
          });
        }
      }
    });
  });

}, 1000 / 60);

function checkCollision(attackBox, position) {
  return (
    attackBox.position.x + attackBox.width >= position.x &&
    attackBox.position.x <= position.x + 50 &&
    attackBox.position.y + attackBox.height >= position.y &&
    attackBox.position.y <= position.y + 150
  );
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});