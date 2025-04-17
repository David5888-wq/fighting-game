const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.querySelector('.game-container');
const usernameInput = document.getElementById('username-input');
const registerBtn = document.getElementById('register-btn');
const playersContainer = document.getElementById('players-container');

// Подключение к серверу с обработкой ошибок
const socket = io({
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000
});

let playerId;
let playerUsername;
let enemyId;
let gameStarted = false;
const gravity = 0.3;
let player, enemy, background, shop;

// Состояние клавиш управления
const keys = {
  a: { pressed: false },
  d: { pressed: false },
  w: { pressed: false },
  ' ': { pressed: false }
};

// Обработчики соединения
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  showError('Connection lost. Reconnecting...');
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
  showError(`Connection failed: ${err.message}`);
});

// Регистрация игрока
registerBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (!username) {
    showError('Please enter a username');
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
});

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
  
  if (players.length === 0) {
    playersContainer.innerHTML += '<p>No players available</p>';
    return;
  }

  players.forEach(player => {
    addPlayerToList(player);
  });
}

function addPlayerToList(playerData) {
  if (playerData.id === playerId) return;
  
  const playerElement = document.createElement('div');
  playerElement.className = 'player-item';
  playerElement.dataset.id = playerData.id;
  playerElement.innerHTML = `
    <span>${playerData.username}</span>
    <span class="player-status ${playerData.status === 'inGame' ? 'in-game' : ''}">
      ${playerData.status === 'waiting' ? 'Waiting' : 'In Game'}
    </span>
  `;
  
  if (playerData.status === 'waiting') {
    playerElement.addEventListener('click', () => {
      socket.emit('challengePlayer', playerData.id, (response) => {
        if (response.error) {
          showError(response.error);
        }
      });
    });
  }
  
  playersContainer.appendChild(playerElement);
}

// Обработчики игровых событий
socket.on('gameStart', (gameData) => {
  lobbyContainer.style.display = 'none';
  gameContainer.style.display = 'inline-block';
  
  initGame(gameData);
  
  if (!gameStarted) {
    animate();
    gameStarted = true;
  }
});

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
}

// Игровой цикл
function animate() {
  window.requestAnimationFrame(animate);
  c.fillStyle = 'black';
  c.fillRect(0, 0, canvas.width, canvas.height);
  
  background.update();
  shop.update();
  
  c.fillStyle = 'rgba(255, 255, 255, 0.15)';
  c.fillRect(0, 0, canvas.width, canvas.height);
  
  if (player) {
    player.update();
    
    // Отправка данных о движении
    socket.emit('playerUpdate', {
      position: player.position,
      velocity: player.velocity,
      isAttacking: player.isAttacking,
      facingRight: player.facingRight
    });
  }
  
  if (enemy) {
    enemy.update();
  }

  // Локальное управление
  if (player) {
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
}

// Обработчики клавиш
window.addEventListener('keydown', (event) => {
  if (!player || player.dead) return;

  switch (event.key) {
    case 'a':
      keys.a.pressed = true;
      player.lastKey = 'a';
      break;
    case 'd':
      keys.d.pressed = true;
      player.lastKey = 'd';
      break;
    case 'w':
      if (player.position.y === 330) {
        player.velocity.y = -15;
      }
      break;
    case ' ':
      player.attack();
      player.isAttacking = true;
      break;
  }
});

window.addEventListener('keyup', (event) => {
  switch (event.key) {
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
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  lobbyContainer.appendChild(errorElement);
  
  setTimeout(() => {
    errorElement.remove();
  }, 3000);
}

// Инициализация
console.log('Game client initialized');
