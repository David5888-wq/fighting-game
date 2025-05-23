const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Конфигурация для Timeweb
const PORT = process.env.PORT || 3000; // Timeweb использует переменную окружения PORT
const HOST = '0.0.0.0'; // Слушаем все интерфейсы

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
  } else {
    res.writeHead(404);
    res.end();
  }
});

// WebSocket сервер
const wss = new WebSocket.Server({ server });

let clients = [];
let gameState = {
  player1: null,
  player2: null,
  round: 1
};

wss.on('connection', (ws) => {
  if (clients.length >= 2) {
    ws.send(JSON.stringify({ type: 'full', message: 'Сервер переполнен. Максимум 2 игрока.' }));
    ws.close();
    return;
  }

  clients.push(ws);
  console.log('Новый игрок подключен. Всего:', clients.length);

  const playerNumber = clients.length;
  ws.send(JSON.stringify({ 
    type: 'start',
    playerNumber: playerNumber,
    message: `Вы игрок ${playerNumber}`
  }));

  if (clients.length === 2) {
    broadcast({ 
      type: 'message', 
      message: 'Оба игрока подключены! Игра начинается.' 
    });
  }

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'move') {
        handleMove(msg, ws);
      }
    } catch (e) {
      console.error('Ошибка обработки сообщения:', e);
    }
  });

  ws.on('close', () => {
    console.log('Игрок отключился');
    clients = clients.filter(client => client !== ws);
    if (clients.length > 0) {
      broadcast({ type: 'reset', message: 'Соперник отключился.' });
    }
    resetGame();
  });
});

function handleMove(msg, ws) {
  const { choice, playerNumber } = msg;
  
  if (playerNumber === 1) {
    gameState.player1 = choice;
  } else if (playerNumber === 2) {
    gameState.player2 = choice;
  }

  broadcast({ 
    type: 'move', 
    playerNumber,
    choice
  });

  if (gameState.player1 && gameState.player2) {
    checkGameStatus();
  }
}

function broadcast(message) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function checkGameStatus() {
  const result = determineWinner(gameState.player1, gameState.player2);
  broadcast({ 
    type: 'gameover', 
    result,
    player1Choice: gameState.player1,
    player2Choice: gameState.player2,
    message: getResultMessage(result)
  });
  
  setTimeout(resetGame, 3000);
}

function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  
  const winningCombinations = {
    'rock': 'scissors',
    'scissors': 'paper',
    'paper': 'rock'
  };
  
  return winningCombinations[choice1] === choice2 ? 'player1' : 'player2';
}

function getResultMessage(result) {
  if (result === 'draw') return 'Ничья!';
  return `Игрок ${result === 'player1' ? '1' : '2'} победил!`;
}

function resetGame() {
  gameState = {
    player1: null,
    player2: null,
    round: gameState.round + 1
  };
  broadcast({ type: 'reset' });
  console.log('Игра сброшена');
}

server.listen(PORT, HOST, () => {
  console.log(`Сервер запущен на http://${HOST}:${PORT}`);
});