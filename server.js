const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Конфигурация для Timeweb
const PORT = process.env.PORT || 3000; // Timeweb использует переменную окружения PORT
const HOST = '0.0.0.0'; // Слушаем все интерфейсы

// Создаем HTTP-сервер
const server = http.createServer((req, res) => {
  const filePath = req.url === '/' ? 'index.html' : req.url.slice(1);
  const fullPath = path.join(__dirname, filePath);
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('File not found');
    }
    
    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
    }[ext] || 'text/plain';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// WebSocket сервер
const wss = new WebSocket.Server({ server });

// Состояние игры
const games = new Map(); // Map для хранения состояний игр
const waitingPlayers = new Set(); // Множество ожидающих игроков

// Константы игры
const TANK_SPEED = 5;
const BULLET_SPEED = 10;
const RELOAD_TIME = 1000; // 1 секунда
const MAX_HEALTH = 100;
const DAMAGE = 20;
const TANK_WIDTH = 50;
const TANK_HEIGHT = 50;
const BULLET_SIZE = 5;

class Game {
  constructor(player1, player2) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.players = new Map([
      [player1, {
        ws: player1,
        tank: {
          x: 100,
          y: 100,
          angle: 0,
          health: MAX_HEALTH,
          lastShot: 0
        }
      }],
      [player2, {
        ws: player2,
        tank: {
          x: 700,
          y: 500,
          angle: Math.PI,
          health: MAX_HEALTH,
          lastShot: 0
        }
      }]
    ]);
    this.bullets = [];
    this.obstacles = [
      { x: 400, y: 300, width: 50, height: 50 },
      { x: 200, y: 200, width: 50, height: 50 },
      { x: 600, y: 400, width: 50, height: 50 }
    ];
  }

  broadcast(message) {
    for (const [ws] of this.players) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  }
}

wss.on('connection', (ws) => {
  // Добавляем уникальный ID для каждого подключения
  ws.id = Math.random().toString(36).substr(2, 9);
  console.log('Новый игрок подключился, ID:', ws.id);

  if (waitingPlayers.size === 0) {
    waitingPlayers.add(ws);
    ws.send(JSON.stringify({ type: 'waiting', message: 'Ожидание второго игрока...' }));
  } else {
    const opponent = waitingPlayers.values().next().value;
    waitingPlayers.delete(opponent);
    
    const game = new Game(ws, opponent);
    games.set(ws, game);
    games.set(opponent, game);

    // Отправляем начальное состояние с ID игроков
    game.broadcast({
      type: 'gameStart',
      gameState: {
        players: Array.from(game.players.entries()).map(([playerWs, p]) => ({
          id: playerWs.id,
          tank: {
            ...p.tank,
            width: TANK_WIDTH,
            height: TANK_HEIGHT
          }
        })),
        obstacles: game.obstacles
      }
    });
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const game = games.get(ws);
      
      if (!game) return;
      
      const player = game.players.get(ws);
      
      switch (data.type) {
        case 'move':
          // Проверяем валидность координат
          const newX = Math.max(0, Math.min(800 - TANK_WIDTH, data.x));
          const newY = Math.max(0, Math.min(600 - TANK_HEIGHT, data.y));
          
          // Проверяем столкновения с препятствиями
          let canMove = true;
          for (const obstacle of game.obstacles) {
            if (checkCollision(
              { x: newX, y: newY, width: TANK_WIDTH, height: TANK_HEIGHT },
              obstacle
            )) {
              canMove = false;
              break;
            }
          }
          
          if (canMove) {
            player.tank.x = newX;
            player.tank.y = newY;
            player.tank.angle = data.angle;
            
            game.broadcast({
              type: 'updatePosition',
              playerId: ws.id,
              x: newX,
              y: newY,
              angle: data.angle
            });
          }
          break;
          
        case 'shoot':
          const now = Date.now();
          if (now - player.tank.lastShot >= RELOAD_TIME) {
            player.tank.lastShot = now;
            const bullet = {
              x: player.tank.x + (TANK_WIDTH / 2),
              y: player.tank.y + (TANK_HEIGHT / 2),
              angle: data.angle,
              playerId: ws.id
            };
            game.bullets.push(bullet);
            game.broadcast({
              type: 'newBullet',
              bullet
            });
          }
          break;
      }
    } catch (e) {
      console.error('Ошибка обработки сообщения:', e);
    }
  });

  ws.on('close', () => {
    console.log('Игрок отключился');
    waitingPlayers.delete(ws);
    const game = games.get(ws);
    
    if (game) {
      for (const [player] of game.players) {
        games.delete(player);
        if (player !== ws && player.readyState === WebSocket.OPEN) {
          player.send(JSON.stringify({
            type: 'gameOver',
            message: 'Противник отключился'
          }));
        }
      }
    }
  });
});

// Игровой цикл для обработки физики
setInterval(() => {
  for (const [, game] of games) {
    // Обновление позиций пуль
    game.bullets = game.bullets.filter(bullet => {
      bullet.x += Math.cos(bullet.angle) * BULLET_SPEED;
      bullet.y += Math.sin(bullet.angle) * BULLET_SPEED;

      // Проверка столкновений с препятствиями
      for (const obstacle of game.obstacles) {
        if (checkCollision(bullet, obstacle)) {
          return false;
        }
      }

      // Проверка столкновений с танками
      for (const [ws, player] of game.players) {
        if (ws.id !== bullet.playerId) {
          const tank = player.tank;
          if (checkCollision(bullet, tank)) {
            tank.health -= DAMAGE;
            game.broadcast({
              type: 'hit',
              targetId: ws.id,
              health: tank.health
            });

            if (tank.health <= 0) {
              game.broadcast({
                type: 'gameOver',
                winnerId: bullet.playerId
              });
            }
            return false;
          }
        }
      }

      // Удаление пуль, вышедших за пределы поля
      return bullet.x >= 0 && bullet.x <= 800 && bullet.y >= 0 && bullet.y <= 600;
    });
  }
}, 1000 / 60); // 60 FPS

function checkCollision(obj1, obj2) {
  const obj1Width = obj1.width || BULLET_SIZE;
  const obj1Height = obj1.height || BULLET_SIZE;
  const obj2Width = obj2.width || TANK_WIDTH;
  const obj2Height = obj2.height || TANK_HEIGHT;

  return obj1.x < obj2.x + obj2Width &&
         obj1.x + obj1Width > obj2.x &&
         obj1.y < obj2.y + obj2Height &&
         obj1.y + obj1Height > obj2.y;
}

server.listen(PORT, HOST, () => {
  console.log(`Сервер запущен на http://${HOST}:${PORT}`);
});