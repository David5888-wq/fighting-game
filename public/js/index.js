// Инициализация canvas и контекста
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
if (!c) throw new Error('Could not get canvas context');

// Глобальные переменные
let player;
let enemy;
let gameStarted = false;
let playerId;
let enemyId;
let animationId;
let lastTime = 0;
const gravity = 0.5;
const debug = false;

// Элементы интерфейса
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.querySelector('.game-container');
const registerBtn = document.getElementById('register-btn');
const usernameInput = document.getElementById('username-input');
const playersContainer = document.getElementById('players-container');

// Подключение к серверу
const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Инициализация игры
function initGame() {
    canvas.width = 1024;
    canvas.height = 576;
    
    // Очистка перед инициализацией
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    gameStarted = false;
    lastTime = 0;
}

// Создание бойца
function createFighter(id, data, isEnemy) {
    if (!data || !data.character) {
        console.error('Invalid fighter data:', data);
        return null;
    }

    console.log('Creating fighter with character:', data.character.name);
    
    return new Fighter({
        position: data.position,
        velocity: data.velocity,
        imageSrc: data.character.imageSrc,
        scale: 2.5,
        framesMax: 8,
        offset: data.character.offset,
        sprites: getCharacterSprites(data.character.name),
        attackBox: {
            offset: data.character.attackBox.offset,
            width: data.character.attackBox.width,
            height: data.character.attackBox.height
        },
        isEnemy: isEnemy
    });
}

// Получение спрайтов персонажа
function getCharacterSprites(name) {
    const basePath = `./img/${name}/`;
    return {
        idle: { imageSrc: basePath + 'Idle.png', framesMax: 8 },
        run: { imageSrc: basePath + 'Run.png', framesMax: 8 },
        jump: { imageSrc: basePath + 'Jump.png', framesMax: 2 },
        fall: { imageSrc: basePath + 'Fall.png', framesMax: 2 },
        attack1: { imageSrc: basePath + 'Attack1.png', framesMax: 6 },
        takeHit: { imageSrc: basePath + 'Take Hit.png', framesMax: 4 },
        death: { imageSrc: basePath + 'Death.png', framesMax: 6 }
    };
}

// Игровой цикл
function animate(timestamp = 0) {
    animationId = requestAnimationFrame(animate);
    
    // Расчет deltaTime для плавной анимации
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);
    
    if (player && player.loaded) {
        player.update(deltaTime);
    } else {
        console.warn('Player not ready');
    }
    
    if (enemy && enemy.loaded) {
        enemy.update(deltaTime);
    } else {
        console.warn('Enemy not ready');
    }
}

// Обработчики событий
registerBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim() || `Player${Math.floor(Math.random() * 1000)}`;
    socket.emit('registerPlayer', username);
});

// Socket.io обработчики
socket.on('registrationSuccess', (data) => {
    playerId = data.id;
    updatePlayerList(data.players);
    lobbyContainer.style.display = 'block';
    gameContainer.style.display = 'none';
});

socket.on('playerJoined', (playerData) => {
    addPlayerToList(playerData);
});

socket.on('playerLeft', (playerId) => {
    removePlayerFromList(playerId);
});

socket.on('playerStatusChanged', ({ id, status }) => {
    updatePlayerStatus(id, status);
});

socket.on('gameStart', (gameData) => {
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'inline-block';
    
    // Сброс состояния игры
    document.querySelector('#playerHealth').style.width = '100%';
    document.querySelector('#enemyHealth').style.width = '100%';
    document.querySelector('#displayText').style.display = 'none';
    
    // Определение ID игроков
    enemyId = Object.keys(gameData.players).find(id => id !== playerId);
    
    // Инициализация персонажей
    player = createFighter(playerId, gameData.players[playerId], false);
    enemy = createFighter(enemyId, gameData.players[enemyId], true);
    
    console.log('Player initialized:', player);
    console.log('Enemy initialized:', enemy);
    
    // Запуск анимации
    if (!gameStarted) {
        initGame();
        animate();
        gameStarted = true;
    }
});

socket.on('playerUpdate', ({ playerId: id, ...data }) => {
    if (id === enemyId && enemy) {
        enemy.position = data.position;
        enemy.facingRight = data.facingRight;
        enemy.isAttacking = data.isAttacking;
    }
});

socket.on('hit', ({ targetId, health, attackerId }) => {
    if (targetId === playerId && player) {
        player.health = health;
        player.takeHit();
        document.querySelector('#playerHealth').style.width = `${health}%`;
    } else if (targetId === enemyId && enemy) {
        enemy.health = health;
        enemy.takeHit();
        document.querySelector('#enemyHealth').style.width = `${health}%`;
    }
});

socket.on('gameOver', ({ reason, winner }) => {
    const displayText = document.querySelector('#displayText');
    displayText.style.display = 'flex';
    
    if (winner === playerId) {
        displayText.innerHTML = 'Вы победили!';
    } else if (winner === enemyId) {
        displayText.innerHTML = 'Вы проиграли!';
    } else {
        displayText.innerHTML = reason || 'Игра окончена!';
    }
    
    setTimeout(() => {
        window.location.reload();
    }, 5000);
});

// Функции для работы с игроками
function addPlayerToList(playerData) {
    const playerElement = document.createElement('div');
    playerElement.className = `player-item ${playerData.status === 'inGame' ? 'in-game' : ''}`;
    playerElement.innerHTML = `
        <span>${playerData.username}</span>
        <span class="player-status ${playerData.status === 'inGame' ? 'in-game' : ''}">
            ${playerData.status === 'inGame' ? 'In Game' : 'Waiting'}
        </span>
    `;
    
    if (playerData.status === 'waiting') {
        playerElement.addEventListener('click', () => {
            socket.emit('challengePlayer', playerData.id);
        });
    }
    
    playerElement.dataset.playerId = playerData.id;
    playersContainer.appendChild(playerElement);
}

function updatePlayerList(players) {
    playersContainer.innerHTML = '';
    players.forEach(player => {
        if (player.id !== playerId) {
            addPlayerToList(player);
        }
    });
}

function removePlayerFromList(playerId) {
    const playerElement = document.querySelector(`[data-player-id="${playerId}"]`);
    if (playerElement) {
        playerElement.remove();
    }
}

function updatePlayerStatus(playerId, status) {
    const playerElement = document.querySelector(`[data-player-id="${playerId}"]`);
    if (playerElement) {
        const statusElement = playerElement.querySelector('.player-status');
        statusElement.textContent = status === 'inGame' ? 'In Game' : 'Waiting';
        statusElement.className = `player-status ${status === 'inGame' ? 'in-game' : ''}`;
        playerElement.className = `player-item ${status === 'inGame' ? 'in-game' : ''}`;
    }
}

// Управление с клавиатуры
window.addEventListener('keydown', (event) => {
    if (!gameStarted || !player) return;
    
    switch (event.key) {
        case 'ArrowRight':
            player.velocity.x = 5;
            player.lastKey = 'ArrowRight';
            player.facingRight = true;
            break;
        case 'ArrowLeft':
            player.velocity.x = -5;
            player.lastKey = 'ArrowLeft';
            player.facingRight = false;
            break;
        case 'ArrowUp':
            if (player.position.y >= 330) {
                player.velocity.y = -15;
            }
            break;
        case ' ':
            player.attack();
            socket.emit('attack');
            break;
    }
});

window.addEventListener('keyup', (event) => {
    if (!gameStarted || !player) return;
    
    switch (event.key) {
        case 'ArrowRight':
        case 'ArrowLeft':
            player.velocity.x = 0;
            break;
    }
});

// Инициализация при загрузке
initGame();