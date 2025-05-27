const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Конфигурация для Timeweb
const PORT = process.env.PORT || 3000; // Timeweb использует переменную окружения PORT
const HOST = '0.0.0.0'; // Слушаем все интерфейсы

// Конфигурация игры
const GRID_SIZE = 20;
const GAME_SPEED = 100;
const FOOD_COUNT = 5;

// Создаем HTTP-сервер
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/style.css') {
    const filePath = path.join(__dirname, 'style.css');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading style.css');
      }
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(data);
    });
  } else if (req.url === '/game.js') {
    const filePath = path.join(__dirname, 'game.js');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading game.js');
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

// WebSocket сервер
const wss = new WebSocket.Server({ server });

let players = new Map();
let food = [];
let gameInterval;

function generateFood() {
  food = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    food.push({
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    });
  }
}

function checkCollision(snake) {
  // Проверка столкновения со стенами
  if (snake[0].x < 0 || snake[0].x >= GRID_SIZE || 
      snake[0].y < 0 || snake[0].y >= GRID_SIZE) {
    return true;
  }

  // Проверка столкновения с собой
  for (let i = 1; i < snake.length; i++) {
    if (snake[0].x === snake[i].x && snake[0].y === snake[i].y) {
      return true;
    }
  }

  // Проверка столкновения с другими змейками
  for (let [id, player] of players) {
    if (id !== snake.id) {
      for (let segment of player.snake) {
        if (snake[0].x === segment.x && snake[0].y === segment.y) {
          return true;
        }
      }
    }
  }

  return false;
}

function updateGame() {
  for (let [id, player] of players) {
    const head = { ...player.snake[0] };
    
    // Обновление позиции головы
    switch (player.direction) {
      case 'up': head.y--; break;
      case 'down': head.y++; break;
      case 'left': head.x--; break;
      case 'right': head.x++; break;
    }

    // Проверка столкновений
    if (checkCollision(player.snake)) {
      players.delete(id);
      broadcastGameState();
      continue;
    }

    // Добавление новой головы
    player.snake.unshift(head);

    // Проверка сбора еды
    const foodIndex = food.findIndex(f => f.x === head.x && f.y === head.y);
    if (foodIndex !== -1) {
      food.splice(foodIndex, 1);
      player.score++;
      if (food.length === 0) {
        generateFood();
      }
    } else {
      player.snake.pop();
    }
  }

  broadcastGameState();
}

function broadcastGameState() {
  const gameState = {
    players: Array.from(players.entries()).map(([id, player]) => ({
      id,
      snake: player.snake,
      score: player.score
    })),
    food
  };

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(gameState));
    }
  });
}

wss.on('connection', (ws) => {
  const id = Date.now().toString();
  
  players.set(id, {
    snake: [{ x: 10, y: 10 }],
    direction: 'right',
    score: 0
  });

  if (food.length === 0) {
    generateFood();
  }

  if (!gameInterval) {
    gameInterval = setInterval(updateGame, GAME_SPEED);
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'direction' && players.has(id)) {
        const player = players.get(id);
        // Предотвращаем движение в противоположном направлении
        if (
          (data.direction === 'up' && player.direction !== 'down') ||
          (data.direction === 'down' && player.direction !== 'up') ||
          (data.direction === 'left' && player.direction !== 'right') ||
          (data.direction === 'right' && player.direction !== 'left')
        ) {
          player.direction = data.direction;
        }
      }
    } catch (e) {
      console.error('Ошибка обработки сообщения:', e);
    }
  });

  ws.on('close', () => {
    players.delete(id);
    if (players.size === 0) {
      clearInterval(gameInterval);
      gameInterval = null;
    }
    broadcastGameState();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Сервер запущен на http://${HOST}:${PORT}`);
});