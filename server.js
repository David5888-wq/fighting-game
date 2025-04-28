const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
  cors: { 
    origin: '*' 
  } 
});

const PORT = process.env.PORT || 3000;

// Состояние сервера
const gameState = {
  waitingPlayers: [],
  activeGames: {},
  characters: ['samuraiMack', 'kenji'],
  maxHealth: 100,
  attackDamage: 20,
  gameDuration: 60
};

// Middleware
app.use(express.static('public'));

// Обработчики Socket.io
io.on('connection', (socket) => {
  console.log('Новый игрок подключён:', socket.id);

  // Обработка входа игрока
  socket.on('playerLogin', (username) => {
    // Валидация имени
    if (!username || username.trim().length === 0 || username.length > 12) {
      socket.emit('loginError', 'Некорректное имя игрока');
      return;
    }

    // Проверка на занятость имени
    if (isUsernameTaken(username)) {
      socket.emit('usernameTaken');
      return;
    }

    const player = {
      id: socket.id,
      username: username.trim(),
      socket: socket,
      character: null,
      health: gameState.maxHealth,
      position: { x: 0, y: 0 },
      score: 0
    };

    gameState.waitingPlayers.push(player);
    updateWaitingList();
    socket.emit('loginSuccess', { username: player.username });
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
          position: { x: 0, y: 0 }
        },
        [opponent.id]: { 
          ...opponent, 
          health: gameState.maxHealth,
          position: { x: 400, y: 0 }
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
    
    // Пересылаем данные второму игроку
    const opponentId = getOpponentId(game, socket.id);
    if (opponentId) {
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
        playerHealth: game.players[attackerId].health,
        opponentHealth: game.players[opponentId].health,
        attackerId,
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
    updateWaitingList();

    // Завершаем активные игры
    for (const gameId in gameState.activeGames) {
      if (gameState.activeGames[gameId].players[socket.id]) {
        endGame(gameId, 'Противник отключился');
      }
    }
  });

  // Вспомогательные функции
  function isUsernameTaken(username) {
    return gameState.waitingPlayers.some(p => p.username === username) ||
           Object.values(gameState.activeGames).some(game => 
             Object.values(game.players).some(p => p.username === username));
  }

  function generateGameId(player1Id, player2Id) {
    return `${player1Id}-${player2Id}-${Date.now()}`;
  }

  function getOpponentId(game, playerId) {
    return Object.keys(game.players).find(id => id !== playerId);
  }

  function checkAttackCollision(game, attackerId, opponentId) {
    const attacker = game.players[attackerId];
    const opponent = game.players[opponentId];
    
    return (
      attacker.isAttacking &&
      attacker.position.x + attacker.attackBox.offset.x + attacker.attackBox.width >= opponent.position.x &&
      attacker.position.x + attacker.attackBox.offset.x <= opponent.position.x + opponent.width &&
      attacker.position.y + attacker.attackBox.offset.y + attacker.attackBox.height >= opponent.position.y &&
      attacker.position.y + attacker.attackBox.offset.y <= opponent.position.y + opponent.height
    );
  }

  function updateWaitingList() {
    const waitingPlayers = gameState.waitingPlayers.map(p => ({
      username: p.username,
      id: p.id
    }));
    io.emit('updateWaitingList', waitingPlayers);
  }

  function startGameTimer(gameId) {
    const game = gameState.activeGames[gameId];
    if (!game) return;

    game.timerInterval = setInterval(() => {
      game.timer--;
      io.to(gameId).emit('updateTimer', game.timer);
      
      if (game.timer <= 0) {
        endGame(gameId, 'Время вышло!');
      }
    }, 1000);
  }

  function sendGameStartData(gameId, player1, player2) {
    player1.socket.emit('gameStart', { 
      opponent: player2.username,
      yourCharacter: player1.character,
      opponentCharacter: player2.character,
      gameId
    });

    player2.socket.emit('gameStart', { 
      opponent: player1.username,
      yourCharacter: player2.character,
      opponentCharacter: player1.character,
      gameId
    });
  }

  function endGame(gameId, reason) {
    const game = gameState.activeGames[gameId];
    if (!game) return;

    // Очищаем таймер
    if (game.timerInterval) {
      clearInterval(game.timerInterval);
    }

    const players = Object.values(game.players);
    let winner = determineWinner(game, reason);

    // Отправляем результат
    players.forEach(player => {
      if (player.socket) {
        const opponent = players.find(p => p.id !== player.id);
        
        player.socket.emit('gameOver', { 
          winner: winner?.username,
          reason,
          yourHealth: player.health,
          opponentHealth: opponent?.health || 0,
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
            score: player.score
          });
        }
      }
    });

    // Удаляем игру
    delete gameState.activeGames[gameId];
    updateWaitingList();
  }

  function determineWinner(game, reason) {
    const players = Object.values(game.players);
    
    if (reason) {
      // Если игра завершена по причине (отключение, время)
      return players.find(p => !p.socket.disconnected);
    } else {
      // Если игра завершена по здоровью
      if (players[0].health > players[1].health) {
        return players[0];
      } else if (players[0].health < players[1].health) {
        return players[1];
      }
    }
    return null; // Ничья
  }
});

// Запуск сервера
http.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});