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
let gameState = Array(9).fill(null);
let currentPlayer = 'X';

wss.on('connection', (ws) => {
  if (clients.length >= 2) {
    ws.send(JSON.stringify({ type: 'full', message: 'Сервер переполнен. Максимум 2 игрока.' }));
    ws.close();
    return;
  }

  clients.push(ws);
  console.log('Новый игрок подключен. Всего:', clients.length);

  const symbol = clients.length === 1 ? 'X' : 'O';
  ws.send(JSON.stringify({ 
    type: 'start',
    symbol: symbol,
    message: `Вы играете за ${symbol} (${symbol === 'X' ? 'ходите первым' : 'ожидайте хода'})`
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
  const { index, symbol } = msg;
  
  if (gameState[index] === null && symbol === currentPlayer) {
    gameState[index] = symbol;
    currentPlayer = symbol === 'X' ? 'O' : 'X';
    
    broadcast({ 
      type: 'move', 
      index, 
      symbol,
      currentPlayer 
    });

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
  const winner = checkWin(gameState);
  if (winner) {
    broadcast({ 
      type: 'gameover', 
      winner,
      message: `Игрок ${winner} победил!` 
    });
  } else if (gameState.every(cell => cell !== null)) {
    broadcast({ 
      type: 'gameover', 
      winner: null,
      message: 'Ничья!' 
    });
  }
  
  if (winner || gameState.every(cell => cell !== null)) {
    setTimeout(resetGame, 3000);
  }
}

function checkWin(board) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function resetGame() {
  gameState = Array(9).fill(null);
  currentPlayer = 'X';
  broadcast({ type: 'reset' });
  console.log('Игра сброшена');
}

server.listen(PORT, HOST, () => {
  console.log(`Сервер запущен на http://${HOST}:${PORT}`);
});