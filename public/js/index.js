'use strict';

// DOM элементы
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.querySelector('.game-container');
const usernameInput = document.getElementById('username-input');
const registerBtn = document.getElementById('register-btn');
const playersContainer = document.getElementById('players-container');
const playerHealthElement = document.getElementById('playerHealth');
const enemyHealthElement = document.getElementById('enemyHealth');
const timerElement = document.getElementById('timer');
const displayTextElement = document.getElementById('displayText');

// Игровые переменные
let playerId = null;
let playerUsername = '';
let enemyId = null;
let gameStarted = false;
let gameId = null;
const gravity = 0.3;
let player, enemy, background, shop;
let lastTimestamp = 0;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Состояние клавиш управления
const keys = {
  a: { pressed: false },
  d: { pressed: false },
  w: { pressed: false },
  ' ': { pressed: false }
};

// Подключение к серверу с обработкой ошибок
const socket = io({
  reconnectionAttempts: MAX_CONNECTION_ATTEMPTS,
  reconnectionDelay: RECONNECT_DELAY,
  timeout: 20000,
  transports: ['websocket']
});

// Обработчики соединения
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  connectionAttempts = 0;
  hideError();
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server:', reason);
  
  if (reason === 'io server disconnect') {
    showError('You were disconnected by the server. Please refresh the page.');
  } else if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
    showError('Connection lost. Reconnecting...');
  }
});

socket.on('connect_error', (err) => {
  connectionAttempts++;
  console.error('Connection error:', err.message);
  
  if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    showError('Failed to connect to server. Please check your connection and refresh the page.');
    registerBtn.disabled = false;
    registerBtn.textContent = 'Join Game';
  } else {
    showError(`Connection failed (attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}). Retrying...`);
  }
});

socket.on('reconnect_failed', () => {
  showError('Could not reconnect to server. Please refresh the page.');
  registerBtn.disabled = false;
  registerBtn.textContent = 'Join Game';
});

// Регистрация игрока
registerBtn.addEventListener('click', registerPlayer);

function registerPlayer() {
  const username = usernameInput.value.trim();
  
  if (!username) {
    showError('Please enter a username');
    return;
  }

  if (username.length < 2 || username.length > 20) {
    showError('Username must be between 2 and 20 characters');
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = 'Connecting...';
  
  socket.emit('registerPlayer', username, (response) => {
    if (response.error) {
      showError(response.error);
      registerBtn.disabled = false;
      registerBtn.textContent = 'Join Game';
      return;
    }
  });
}

// Успешная регистрация
socket.on('registrationSuccess', (data) => {
  playerId = data.id;
  playerUsername = data.username;
  
  usernameInput.disabled = true;
  registerBtn.disabled = true;
  registerBtn.textContent = 'Waiting for opponent...';
  
  updatePlayersList(data.players);
});

// Обновление списка игроков
function updatePlayersList(players) {
  playersContainer.innerHTML = '<h2>Available Players:</h2>';
  
  if (!players || players.length === 0) {
    playersContainer.innerHTML += '<p>No players available</p>';
    return;
  }

  players.forEach(player => {
    addPlayerToList(player);
  });
}

function addPlayerToList(playerData) {
  if (!playerData || playerData.id === playerId) return;
  
  const playerElement = document.createElement('div');
  playerElement.className = 'player-item';
  playerElement.dataset.id = playerData.id;
  playerElement.innerHTML = `
    <span>${playerData.username || 'Unknown'}</span>
    <span class="player-status ${playerData.status === 'inGame' ? 'in-game' : ''}">
      ${playerData.status === 'waiting' ? 'Waiting' : 'In Game'}
    </span>
  `;
  
  if (playerData.status === 'waiting') {
    playerElement.addEventListener('click', () => {
      if (playerData.id !== playerId) {
        challengePlayer(playerData.id);
      }
    });
  }
  
  playersContainer.appendChild(playerElement);
}

function challengePlayer(targetId) {
  if (!targetId || typeof targetId !== 'string') return;
  
  socket.emit('challengePlayer', targetId, (response) => {
    if (response.error) {
      showError(response.error);
    }
  });
}

// Обработчики игровых событий
socket.on('gameStart', (gameData) => {
  if (!gameData || !gameData.players || !gameData.players[playerId]) {
    showError('Invalid game data received');
    return;
  }

  lobbyContainer.style.display = 'none';
  gameContainer.style.display = 'inline-block';
  gameId = gameData.gameId;
  
  initGame(gameData);
  
  if (!gameStarted) {
    lastTimestamp = performance.now();
    requestAnimationFrame(animate);
    gameStarted = true;
  }
});

socket.on('enemyUpdate', (data) => {
  if (!enemy || !data) return;
  
  enemy.position = data.position || enemy.position;
  enemy.velocity = data.velocity || enemy.velocity;
  enemy.isAttacking = data.isAttacking || false;
  enemy.facingRight = data.facingRight !== undefined ? data.facingRight : enemy.facingRight;
  
  if (data.isAttacking) {
    checkAttack(enemy, player);
  }
});

socket.on('playerHit', (data) => {
  if (!data || !player || !enemy) return;
  
  if (data.targetId === playerId) {
    player.takeHit();
    updateHealthBars();
  }
});

socket.on('gameOver', (data) => {
  if (!data) return;
  
  const winner = data.winner === playerId ? 'You' : 
                data.winner === enemyId ? enemyId : 'No one';
  
  displayTextElement.textContent = data.winner === playerId ? 
    'You Win!' : data.winner === enemyId ? 
    'You Lose!' : 'Draw!';
  
  displayTextElement.style.display = 'flex';
  
  setTimeout(() => {
    window.location.reload();
  }, 5000);
});

socket.on('playerListUpdate', updatePlayersList);

// Инициализация игры
function initGame(gameData) {
  // Инициализация фона
  background = new Sprite({
    position: { x: 0, y: 0 },
    imageSrc: './img/background.png'
  });

  shop = new Sprite({
    position: { x: 600, y: 128 },
    imageSrc: './img/shop.png',
    scale: 2.75,
    framesMax: 6
  });

  // Создание игрока
  const playerData = gameData.players[playerId];
  player = new Fighter({
    position: playerData.position,
    velocity: playerData.velocity,
    offset: playerData.character.offset,
    imageSrc: playerData.character.imageSrc,
    scale: 2.5,
    sprites: {
      idle: { imageSrc: './img/samuraiMack/Idle.png', framesMax: 8 },
      run: { imageSrc: './img/samuraiMack/Run.png', framesMax: 8 },
      jump: { imageSrc: './img/samuraiMack/Jump.png', framesMax: 2 },
      fall: { imageSrc: './img/samuraiMack/Fall.png', framesMax: 2 },
      attack1: { imageSrc: './img/samuraiMack/Attack1.png', framesMax: 6 },
      takeHit: { imageSrc: './img/samuraiMack/Take Hit - white silhouette.png', framesMax: 4 },
      death: { imageSrc: './img/samuraiMack/Death.png', framesMax: 6 }
    },
    attackBox: playerData.character.attackBox
  });
  player.id = playerId;
  player.health = 100;

  // Создание противника
  enemyId = Object.keys(gameData.players).find(id => id !== playerId);
  const enemyData = gameData.players[enemyId];
  enemy = new Fighter({
    position: enemyData.position,
    velocity: enemyData.velocity,
    offset: enemyData.character.offset,
    imageSrc: enemyData.character.imageSrc,
    scale: 2.5,
    sprites: {
      idle: { imageSrc: './img/kenji/Idle.png', framesMax: 4 },
      run: { imageSrc: './img/kenji/Run.png', framesMax: 8 },
      jump: { imageSrc: './img/kenji/Jump.png', framesMax: 2 },
      fall: { imageSrc: './img/kenji/Fall.png', framesMax: 2 },
      attack1: { imageSrc: './img/kenji/Attack1.png', framesMax: 4 },
      takeHit: { imageSrc: './img/kenji/Take hit.png', framesMax: 3 },
      death: { imageSrc: './img/kenji/Death.png', framesMax: 7 }
    },
    attackBox: enemyData.character.attackBox,
    isEnemy: true
  });
  enemy.id = enemyId;
  enemy.health = 100;

  // Инициализация UI
  updateHealthBars();
  timerElement.textContent = gameData.settings.gameDuration || 60;
}

// Игровой цикл
function animate(timestamp) {
  if (!gameStarted) return;
  
  const deltaTime = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  
  window.requestAnimationFrame(animate);
  c.fillStyle = 'black';
  c.fillRect(0, 0, canvas.width, canvas.height);
  
  background.update(deltaTime);
  shop.update(deltaTime);
  
  c.fillStyle = 'rgba(255, 255, 255, 0.15)';
  c.fillRect(0, 0, canvas.width, canvas.height);
  
  if (player) {
    player.update(deltaTime);
    
    // Отправка данных о движении
    socket.emit('playerUpdate', {
      position: player.position,
      velocity: player.velocity,
      isAttacking: player.isAttacking,
      facingRight: player.facingRight
    });
    
    // Проверка атаки игрока
    if (player.isAttacking) {
      checkAttack(player, enemy);
    }
  }
  
  if (enemy) {
    enemy.update(deltaTime);
  }

  // Локальное управление
  handlePlayerMovement();
}

function handlePlayerMovement() {
  if (!player || player.dead) return;
  
  player.velocity.x = 0;
  
  if (keys.a.pressed && player.lastKey === 'a') {
    player.velocity.x = -5;
    player.switchSprite('run');
    player.facingRight = false;
  } else if (keys.d.pressed && player.lastKey === 'd') {
    player.velocity.x = 5;
    player.switchSprite('run');
    player.facingRight = true;
  } else {
    player.switchSprite('idle');
  }

  if (player.velocity.y < 0) {
    player.switchSprite('jump');
  } else if (player.velocity.y > 0) {
    player.switchSprite('fall');
  }
}

function checkAttack(attacker, target) {
  if (!attacker || !target || target.dead) return;
  
  if (
    attacker.attackBox.position.x + attacker.attackBox.width >= target.position.x &&
    attacker.attackBox.position.x <= target.position.x + target.width &&
    attacker.attackBox.position.y + attacker.attackBox.height >= target.position.y &&
    attacker.attackBox.position.y <= target.position.y + target.height
  ) {
    socket.emit('attack');
    attacker.isAttacking = false;
  }
}

function updateHealthBars() {
  if (!player || !enemy) return;
  
  playerHealthElement.style.width = `${player.health}%`;
  enemyHealthElement.style.width = `${enemy.health}%`;
}

// Обработчики клавиш
window.addEventListener('keydown', (event) => {
  if (!player || player.dead) return;

  switch (event.key.toLowerCase()) {
    case 'a':
      keys.a.pressed = true;
      player.lastKey = 'a';
      break;
    case 'd':
      keys.d.pressed = true;
      player.lastKey = 'd';
      break;
    case 'w':
      if (player.position.y + player.height >= canvas.height - 96) {
        player.velocity.y = -15;
      }
      break;
    case ' ':
      if (!player.isAttacking) {
        player.attack();
        socket.emit('attack');
      }
      break;
  }
});

window.addEventListener('keyup', (event) => {
  switch (event.key.toLowerCase()) {
    case 'a':
      keys.a.pressed = false;
      break;
    case 'd':
      keys.d.pressed = false;
      break;
  }
});

// Вспомогательные функции
function showError(message) {
  let errorElement = document.querySelector('.error-message');
  
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    lobbyContainer.appendChild(errorElement);
  }
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

function hideError() {
  const errorElement = document.querySelector('.error-message');
  if (errorElement) {
    errorElement.style.display = 'none';
  }
}

// Инициализация
console.log('Game client initialized');

// Обработчик изменения размера окна
window.addEventListener('resize', () => {
  if (gameStarted) {
    canvas.width = Math.min(1024, window.innerWidth - 40);
    canvas.height = Math.min(576, window.innerHeight - 200);
  }
});
