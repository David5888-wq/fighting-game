const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

// Состояние сервера
const gameState = {
  waitingPlayers: [],
  activeGames: {},
  characters: ['samuraiMack', 'kenji'],
  maxHealth: 100,
  attackDamage: 20,
  gameDuration: 60,
  maxInactiveTime: 30000, // 30 секунд
  gameInactiveTime: 15000 // 15 секунд
};

// Middleware
app.use(express.static('public'));

// Проверка активности игроков
const checkInactivePlayers = () => {
  const now = Date.now();
  
  // Проверяем игроков в лобби
  gameState.waitingPlayers = gameState.waitingPlayers.filter(player => {
    if (now - player.lastActive > gameState.maxInactiveTime) {
      console.log(`Удалён неактивный игрок: ${player.username}`);
      if (player.socket) {
        player.socket.emit('inactiveDisconnect');
        player.socket.disconnect();
      }
      return false;
    }
    return true;
  });
  
  // Проверяем активные игры
  for (const gameId in gameState.activeGames) {
    const game = gameState.activeGames[gameId];
    const players = Object.values(game.players);
    
    players.forEach(player => {
      if (now - player.lastActive > gameState.gameInactiveTime) {
        console.log(`Игрок ${player.username} неактивен в игре ${gameId}`);
        const opponentId = getOpponentId(game, player.id);
        if (opponentId && game.players[opponentId].socket) {
          game.players[opponentId].socket.emit('opponentInactive');
        }
      }
    });
  }
};

// Вспомогательные функции
const isUsernameTaken = (username) => {
  return gameState.waitingPlayers.some(p => p.username === username) ||
         Object.values(gameState.activeGames).some(game => 
           Object.values(game.players).some(p => p.username === username));
};

const generateGameId = (player1Id, player2Id) => {
  return `${player1Id}-${player2Id}-${Date.now()}`;
};

const getOpponentId = (game, playerId) => {
  return Object.keys(game.players).find(id => id !== playerId);
};

const checkAttackCollision = (game, attackerId, opponentId) => {
  const attacker = game.players[attackerId];
  const opponent = game.players[opponentId];
  
  return (
    attacker.isAttacking &&
    attacker.position.x + attacker.attackBox.offset.x + attacker.attackBox.width >= opponent.position.x &&
    attacker.position.x + attacker.attackBox.offset.x <= opponent.position.x + opponent.width &&
    attacker.position.y + attacker.attackBox.offset.y + attacker.attackBox.height >= opponent.position.y &&
    attacker.position.y + attacker.attackBox.offset.y <= opponent.position.y + opponent.height
  );
};

const calculateHealthPercentage = (health) => {
  return Math.max(0, (health / gameState.maxHealth) * 100);
};

const updateWaitingList = () => {
  const waitingPlayers = gameState.waitingPlayers.map(p => ({
    username: p.username,
    id: p.id
  }));
  io.emit('updateWaitingList', waitingPlayers);
};

const startGameTimer = (gameId) => {
  const game = gameState.activeGames[gameId];
  if (!game) return;

  game.timerInterval = setInterval(() => {
    game.timer--;
    io.to(gameId).emit('updateTimer', game.timer);
    
    if (game.timer <= 0) {
      endGame(gameId, 'Время вышло!');
    }
  }, 1000);
};

const sendGameStartData = (gameId, player1, player2) => {
  player1.socket.join(gameId);
  player2.socket.join(gameId);

  player1.socket.emit('gameStart', { 
    gameId,
    yourCharacter: player1.character,
    opponentCharacter: player2.character,
    opponent: player2.username
  });

  player2.socket.emit('gameStart', { 
    gameId,
    yourCharacter: player2.character,
    opponentCharacter: player1.character,
    opponent: player1.username
  });
};

const determineWinner = (game, reason) => {
  const players = Object.values(game.players);
  const now = Date.now();
  
  if (reason && reason.includes('отключился')) {
    return players.find(p => !p.socket.disconnected);
  } else if (reason && reason.includes('неактивен')) {
    return players.find(p => now - p.lastActive <= gameState.gameInactiveTime);
  } else if (players[0].health > players[1].health) {
    return players[0];
  } else if (players[0].health < players[1].health) {
    return players[1];
  }
  return null;
};

const endGame = (gameId, reason) => {
  const game = gameState.activeGames[gameId];
  if (!game) return;

  // Очищаем таймер
  if (game.timerInterval) {
    clearInterval(game.timerInterval);
  }

  const players = Object.values(game.players);
  const winner = determineWinner(game, reason);

  // Отправляем результат
  players.forEach(player => {
    if (player.socket) {
      const opponent = players.find(p => p.id !== player.id);
      
      player.socket.emit('gameOver', { 
        winner: winner?.username,
        reason,
        yourHealth: calculateHealthPercentage(player.health),
        opponentHealth: opponent ? calculateHealthPercentage(opponent.health) : 0,
        yourScore: player.score,
        opponentScore: opponent?.score || 0
      });
      
      // Возвращаем игроков в лобби
      if (!player.socket.disconnected) {
        gameState.waitingPlayers.push({
          id: player.id,
          username: player.username,
          socket: player.socket,
          character: null,
          health: gameState.maxHealth,
          score: player.score,
          lastActive: Date.now()
        });
      }
    }
  });

  // Удаляем игру
  delete gameState.activeGames[gameId];
  updateWaitingList();
  console.log(`Игра ${gameId} завершена. Причина: ${reason}`);
};

// Обработчики Socket.io
io.on('connection', (socket) => {
  console.log('Новый игрок подключён:', socket.id);

  // Обработка входа игрока
  socket.on('playerLogin', (username) => {
    // Валидация имени
    if (!username || username.trim().length === 0 || username.length > 12) {
      socket.emit('loginError', 'Имя должно быть от 1 до 12 символов');
      return;
    }

    username = username.trim();

    // Проверка на занятость имени
    if (isUsernameTaken(username)) {
      socket.emit('usernameTaken');
      return;
    }

    const player = {
      id: socket.id,
      username: username,
      socket: socket,
      character: null,
      health: gameState.maxHealth,
      position: { x: 0, y: 0 },
      score: 0,
      lastActive: Date.now()
    };

    gameState.waitingPlayers.push(player);
    updateWaitingList();
    socket.emit('loginSuccess');
    console.log(`Игрок ${username} вошёл в игру`);
  });

  // Обработка выбора соперника
  socket.on('challengePlayer', (opponentUsername) => {
    const challenger = gameState.waitingPlayers.find(p => p.id === socket.id);
    const opponent = gameState.waitingPlayers.find(p => p.username === opponentUsername);

    if (!challenger || !opponent) {
      socket.emit('challengeFailed', 'Игрок не найден');
      return;
    }

    // Удаляем игроков из списка ожидания
    gameState.waitingPlayers = gameState.waitingPlayers.filter(p => 
      p.id !== challenger.id && p.id !== opponent.id
    );

    // Выбираем случайных персонажей
    const shuffledChars = [...gameState.characters].sort(() => 0.5 - Math.random());
    challenger.character = shuffledChars[0];
    opponent.character = shuffledChars[1];

    // Создаем игру
    const gameId = generateGameId(challenger.id, opponent.id);
    gameState.activeGames[gameId] = {
      id: gameId,
      players: {
        [challenger.id]: { 
          ...challenger, 
          health: gameState.maxHealth,
          position: { x: 100, y: 0 }
        },
        [opponent.id]: { 
          ...opponent, 
          health: gameState.maxHealth,
          position: { x: 800, y: 0 }
        }
      },
      timer: gameState.gameDuration,
      timerInterval: null,
      createdAt: Date.now()
    };

    // Запускаем таймер игры
    startGameTimer(gameId);

    // Отправляем данные игрокам
    sendGameStartData(gameId, challenger, opponent);
    updateWaitingList();
    console.log(`Начата игра ${gameId} между ${challenger.username} и ${opponent.username}`);
  });

  // Обработка движения игрока
  socket.on('playerMovement', (data) => {
    const { gameId, position, velocity, lastKey, isAttacking } = data;
    const game = gameState.activeGames[gameId];
    
    if (!game || !game.players[socket.id]) return;

    // Обновляем состояние игрока
    game.players[socket.id].position = position;
    game.players[socket.id].velocity = velocity;
    game.players[socket.id].lastKey = lastKey;
    game.players[socket.id].isAttacking = isAttacking;
    game.players[socket.id].lastActive = Date.now();
    
    // Пересылаем данные второму игроку
    const opponentId = getOpponentId(game, socket.id);
    if (opponentId && game.players[opponentId].socket) {
      game.players[opponentId].socket.emit('opponentMoved', {
        position,
        velocity,
        lastKey,
        isAttacking
      });
    }
  });

  // Обработка атаки
  socket.on('playerAttack', ({ gameId }) => {
    const game = gameState.activeGames[gameId];
    if (!game) return;

    const attackerId = socket.id;
    const opponentId = getOpponentId(game, attackerId);
    
    if (!opponentId || !game.players[opponentId]) return;

    // Проверяем столкновение атакующего бокса
    if (checkAttackCollision(game, attackerId, opponentId)) {
      game.players[opponentId].health -= gameState.attackDamage;
      
      // Отправляем обновление здоровья
      io.to(gameId).emit('updateHealth', {
        playerHealth: calculateHealthPercentage(game.players[attackerId].health),
        opponentHealth: calculateHealthPercentage(game.players[opponentId].health),
        receiverId: opponentId
      });

      // Проверяем условие победы
      if (game.players[opponentId].health <= 0) {
        game.players[attackerId].score++;
        endGame(gameId, `${game.players[attackerId].username} победил!`);
      }
    }
  });

  // Обработка отключения игрока
  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    
    // Удаляем из списка ожидания
    gameState.waitingPlayers = gameState.waitingPlayers.filter(p => p.id !== socket.id);
    
    // Завершаем активные игры
    for (const gameId in gameState.activeGames) {
      const game = gameState.activeGames[gameId];
      if (game.players[socket.id]) {
        const opponentId = getOpponentId(game, socket.id);
        if (opponentId && game.players[opponentId].socket) {
          game.players[opponentId].socket.emit('opponentDisconnected');
        }
        endGame(gameId, 'Противник отключился');
      }
    }
    
    updateWaitingList();
  });

  // Обработка пинга от клиента
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Запуск проверки неактивных игроков
setInterval(checkInactivePlayers, 5000);

// Запуск сервера
http.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

// Обработка ошибок сервера
process.on('uncaughtException', (err) => {
  console.error('Необработанное исключение:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Необработанный промис:', err);
});
