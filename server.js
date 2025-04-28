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
  characters: ['samuraiMack', 'kenji']
};

// Middleware
app.use(express.static('public'));

// Обработчики Socket.io
io.on('connection', (socket) => {
  console.log('Новый игрок подключён:', socket.id);

  // Обработка входа игрока
  socket.on('playerLogin', (username) => {
    // Проверка на занятость имени
    if (gameState.waitingPlayers.some(p => p.username === username) ||
        Object.values(gameState.activeGames).some(game => 
          Object.values(game.players).some(p => p.username === username))) {
      socket.emit('usernameTaken');
      return;
    }

    const player = {
      id: socket.id,
      username,
      socket: socket,
      character: null
    };

    gameState.waitingPlayers.push(player);
    updateWaitingList();
    socket.emit('loginSuccess');
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
    const gameId = `${challenger.id}-${opponent.id}-${Date.now()}`;
    gameState.activeGames[gameId] = {
      id: gameId,
      players: {
        [challenger.id]: { 
          ...challenger, 
          health: 100,
          position: { x: 0, y: 0 }
        },
        [opponent.id]: { 
          ...opponent, 
          health: 100,
          position: { x: 400, y: 100 }
        }
      },
      timer: 60,
      timerInterval: null
    };

    // Запускаем таймер игры
    startGameTimer(gameId);

    // Отправляем данные игрокам
    challenger.socket.emit('gameStart', { 
      opponent: opponent.username,
      yourCharacter: challenger.character,
      opponentCharacter: opponent.character,
      gameId
    });

    opponent.socket.emit('gameStart', { 
      opponent: challenger.username,
      yourCharacter: opponent.character,
      opponentCharacter: challenger.character,
      gameId
    });

    updateWaitingList();
  });

  // Обработка движения игрока
  socket.on('playerMovement', (data) => {
    const { gameId, position, velocity, lastKey, isAttacking } = data;
    const game = gameState.activeGames[gameId];
    
    if (game && game.players[socket.id]) {
      // Обновляем состояние игрока
      game.players[socket.id].position = position;
      game.players[socket.id].velocity = velocity;
      game.players[socket.id].lastKey = lastKey;
      game.players[socket.id].isAttacking = isAttacking;
      
      // Пересылаем данные второму игроку
      const opponentId = Object.keys(game.players).find(id => id !== socket.id);
      if (opponentId) {
        game.players[opponentId].socket.emit('opponentMoved', {
          position,
          velocity,
          lastKey,
          isAttacking
        });
      }
    }
  });

  // Обработка атаки
  socket.on('playerAttack', ({ gameId, damage }) => {
    const game = gameState.activeGames[gameId];
    if (!game) return;

    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    if (opponentId && game.players[opponentId]) {
      game.players[opponentId].health -= damage;
      
      // Отправляем обновление здоровья
      io.to(gameId).emit('updateHealth', {
        playerHealth: game.players[socket.id].health,
        opponentHealth: game.players[opponentId].health,
        attackerId: socket.id,
        receiverId: opponentId
      });

      // Проверяем условие победы
      if (game.players[opponentId].health <= 0) {
        endGame(gameId, `${game.players[socket.id].username} победил!`);
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

  // Функция обновления списка ожидания
  function updateWaitingList() {
    const waitingPlayers = gameState.waitingPlayers.map(p => p.username);
    io.emit('updateWaitingList', waitingPlayers);
  }

  // Функция запуска таймера игры
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

  // Функция завершения игры
  function endGame(gameId, reason) {
    const game = gameState.activeGames[gameId];
    if (!game) return;

    // Очищаем таймер
    if (game.timerInterval) {
      clearInterval(game.timerInterval);
    }

    const players = Object.values(game.players);
    
    // Определяем победителя
    let winner = null;
    if (reason) {
      // Если игра завершена по причине (отключение, время)
      winner = players.find(p => p.id !== socket.id)?.username;
    } else {
      // Если игра завершена по здоровью
      if (players[0].health > players[1].health) {
        winner = players[0].username;
      } else if (players[0].health < players[1].health) {
        winner = players[1].username;
      }
    }

    // Отправляем результат
    players.forEach(player => {
      if (player.socket) {
        player.socket.emit('gameOver', { 
          winner, 
          reason,
          yourHealth: player.health,
          opponentHealth: players.find(p => p.id !== player.id)?.health || 0
        });
        
        // Возвращаем игроков в лобби
        gameState.waitingPlayers.push({
          id: player.id,
          username: player.username,
          socket: player.socket,
          character: null
        });
      }
    });

    // Удаляем игру
    delete gameState.activeGames[gameId];
    updateWaitingList();
  }
});

// Запуск сервера
http.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});