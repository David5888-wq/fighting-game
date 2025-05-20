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
  player1: {
    dice: Array(5).fill(1),
    rollsLeft: 3,
    scores: {},
    currentTurn: false
  },
  player2: {
    dice: Array(5).fill(1),
    rollsLeft: 3,
    scores: {},
    currentTurn: false
  },
  currentPlayer: 1,
  round: 1
};

const categories = {
  ones: { name: 'Единицы', calculate: dice => dice.filter(d => d === 1).reduce((a, b) => a + b, 0) },
  twos: { name: 'Двойки', calculate: dice => dice.filter(d => d === 2).reduce((a, b) => a + b, 0) },
  threes: { name: 'Тройки', calculate: dice => dice.filter(d => d === 3).reduce((a, b) => a + b, 0) },
  fours: { name: 'Четверки', calculate: dice => dice.filter(d => d === 4).reduce((a, b) => a + b, 0) },
  fives: { name: 'Пятерки', calculate: dice => dice.filter(d => d === 5).reduce((a, b) => a + b, 0) },
  sixes: { name: 'Шестерки', calculate: dice => dice.filter(d => d === 6).reduce((a, b) => a + b, 0) },
  threeOfAKind: { name: 'Три одинаковых', calculate: dice => {
    const counts = Array(7).fill(0);
    dice.forEach(d => counts[d]++);
    return counts.some(c => c >= 3) ? dice.reduce((a, b) => a + b, 0) : 0;
  }},
  fourOfAKind: { name: 'Четыре одинаковых', calculate: dice => {
    const counts = Array(7).fill(0);
    dice.forEach(d => counts[d]++);
    return counts.some(c => c >= 4) ? dice.reduce((a, b) => a + b, 0) : 0;
  }},
  fullHouse: { name: 'Фулл-хаус', calculate: dice => {
    const counts = Array(7).fill(0);
    dice.forEach(d => counts[d]++);
    return counts.includes(3) && counts.includes(2) ? 25 : 0;
  }},
  smallStraight: { name: 'Малый стрит', calculate: dice => {
    const unique = [...new Set(dice)].sort();
    return (unique.includes(1) && unique.includes(2) && unique.includes(3) && unique.includes(4)) ||
           (unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) ||
           (unique.includes(3) && unique.includes(4) && unique.includes(5) && unique.includes(6)) ? 30 : 0;
  }},
  largeStraight: { name: 'Большой стрит', calculate: dice => {
    const unique = [...new Set(dice)].sort();
    return (unique.includes(1) && unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) ||
           (unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5) && unique.includes(6)) ? 40 : 0;
  }},
  yahtzee: { name: 'Яцзы', calculate: dice => {
    return dice.every(d => d === dice[0]) ? 50 : 0;
  }},
  chance: { name: 'Шанс', calculate: dice => dice.reduce((a, b) => a + b, 0) }
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
    gameState.player1.currentTurn = true;
    broadcast({ 
      type: 'message', 
      message: 'Оба игрока подключены! Игра начинается.' 
    });
    broadcastGameState();
  }

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'roll') {
        handleRoll(msg, ws);
      } else if (msg.type === 'select') {
        handleCategorySelection(msg, ws);
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

function handleRoll(msg, ws) {
  const { playerNumber, keepDice } = msg;
  const player = gameState[`player${playerNumber}`];
  
  if (player.rollsLeft > 0 && player.currentTurn) {
    // Бросаем только неотмеченные кости
    player.dice = player.dice.map((d, i) => keepDice[i] ? d : Math.floor(Math.random() * 6) + 1);
    player.rollsLeft--;
    
    broadcastGameState();
    
    if (player.rollsLeft === 0) {
      broadcast({ 
        type: 'message', 
        message: `Игрок ${playerNumber} должен выбрать категорию для подсчета очков.` 
      });
    }
  }
}

function handleCategorySelection(msg, ws) {
  const { playerNumber, category } = msg;
  const player = gameState[`player${playerNumber}`];
  
  if (player.currentTurn && !player.scores[category]) {
    const score = categories[category].calculate(player.dice);
    player.scores[category] = score;
    player.currentTurn = false;
    
    // Передаем ход другому игроку
    const nextPlayer = playerNumber === 1 ? 2 : 1;
    gameState[`player${nextPlayer}`].currentTurn = true;
    gameState[`player${nextPlayer}`].rollsLeft = 3;
    gameState[`player${nextPlayer}`].dice = Array(5).fill(1);
    
    broadcastGameState();
    
    // Проверяем, закончилась ли игра
    if (Object.keys(player.scores).length === Object.keys(categories).length) {
      const total1 = calculateTotal(gameState.player1.scores);
      const total2 = calculateTotal(gameState.player2.scores);
      const winner = total1 > total2 ? 1 : total1 < total2 ? 2 : 0;
      
      broadcast({ 
        type: 'gameover', 
        message: winner === 0 ? 'Ничья!' : `Игрок ${winner} победил!`,
        scores: {
          player1: total1,
          player2: total2
        }
      });
      
      setTimeout(resetGame, 5000);
    }
  }
}

function calculateTotal(scores) {
  return Object.values(scores).reduce((a, b) => a + b, 0);
}

function broadcastGameState() {
  broadcast({
    type: 'state',
    gameState: {
      player1: {
        dice: gameState.player1.dice,
        rollsLeft: gameState.player1.rollsLeft,
        scores: gameState.player1.scores,
        currentTurn: gameState.player1.currentTurn
      },
      player2: {
        dice: gameState.player2.dice,
        rollsLeft: gameState.player2.rollsLeft,
        scores: gameState.player2.scores,
        currentTurn: gameState.player2.currentTurn
      }
    }
  });
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
    player1: {
      dice: Array(5).fill(1),
      rollsLeft: 3,
      scores: {},
      currentTurn: true
    },
    player2: {
      dice: Array(5).fill(1),
      rollsLeft: 3,
      scores: {},
      currentTurn: false
    },
    currentPlayer: 1,
    round: gameState.round + 1
  };
  broadcast({ type: 'reset' });
  broadcastGameState();
  console.log('Игра сброшена');
}

server.listen(PORT, HOST, () => {
  console.log(`Сервер запущен на http://${HOST}:${PORT}`);
});