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
  } else if (req.url === '/client.js') {
    const filePath = path.join(__dirname, 'client.js');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading client.js');
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

let clients = [];
let gameState = {
  player1: null,
  player2: null,
  currentTurn: 1,
  player1Board: null,
  player2Board: null
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
    message: `Вы игрок ${playerNumber}. Ожидайте подключения второго игрока.`
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
      } else if (msg.type === 'board') {
        handleBoard(msg, ws);
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

function handleBoard(msg, ws) {
  const { playerNumber, board } = msg;
  if (playerNumber === 1) {
    gameState.player1Board = board;
  } else if (playerNumber === 2) {
    gameState.player2Board = board;
  }
  console.log(`Поле игрока ${playerNumber} получено`);
  
  if (gameState.player1Board && gameState.player2Board) {
    broadcast({ 
      type: 'message', 
      message: `Оба игрока готовы. Ход игрока ${gameState.currentTurn}` 
    });
  }
}

function handleMove(msg, ws) {
  const { position, playerNumber } = msg;
  
  if (playerNumber !== gameState.currentTurn) {
    ws.send(JSON.stringify({ 
      type: 'message', 
      message: 'Сейчас не ваш ход!' 
    }));
    return;
  }

  const targetBoard = playerNumber === 1 ? gameState.player2Board : gameState.player1Board;
  const hit = targetBoard[position] === 1;
  
  // Обновляем состояние поля на сервере
  targetBoard[position] = hit ? 2 : 3;

  // Отправляем результат хода атакующему игроку (его поле противника)
  ws.send(JSON.stringify({
    type: 'result',
    position,
    hit,
    message: hit ? 'Попадание!' : 'Промах!'
  }));
  
  // Отправляем результат хода другому игроку (его собственное поле)
  const opponentWs = clients.find(client => {
      // Проверяем, что клиент подключен и является другим игроком
      // Нужно убедиться, что у нас есть способ идентифицировать клиентов по номеру игрока
      // В текущей реализации clients - это просто массив WebSocket объектов
      // Давайте добавим свойство playerNumber к WebSocket объекту при подключении
      return client !== ws && client.readyState === WebSocket.OPEN;
  });

  if (opponentWs) {
      opponentWs.send(JSON.stringify({
          type: 'move', // Используем тип move, чтобы обновить их поле
          playerNumber,
          position,
          hit // Отправляем информацию о попадании, чтобы они знали, как обновить свою доску
      }));
  }

  // Проверяем, не закончилась ли игра
  if (checkGameOver(targetBoard)) {
    broadcast({
      type: 'gameover',
      winner: playerNumber,
      message: `Игрок ${playerNumber} победил!`
    });
    setTimeout(resetGame, 3000);
    return;
  }

  // Передаем ход другому игроку
  gameState.currentTurn = playerNumber === 1 ? 2 : 1;
  broadcast({
    type: 'message',
    message: `Ход игрока ${gameState.currentTurn}`
  });
}

function checkGameOver(board) {
  return !board.includes(1); // Если на поле не осталось кораблей
}

function broadcast(message) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function resetGame() {
  gameState = {
    player1: null,
    player2: null,
    currentTurn: 1,
    player1Board: null,
    player2Board: null
  };
  broadcast({ type: 'reset' });
  console.log('Игра сброшена');
}

server.listen(PORT, HOST, () => {
  console.log(`Сервер запущен на http://${HOST}:${PORT}`);
});