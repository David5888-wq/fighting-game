const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.querySelector('.game-container');
const usernameInput = document.getElementById('username-input');
const registerBtn = document.getElementById('register-btn');
const playersContainer = document.getElementById('players-container');

// Подключение к серверу
const socket = io();
let playerId;
let playerUsername;
let enemyId;
let gameStarted = false;

const gravity = 0.3;
let player;
let enemy;
let background;
let shop;

const keys = {
    a: { pressed: false },
    d: { pressed: false },
    w: { pressed: false },
    ' ': { pressed: false }
};

// Регистрация игрока
registerBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        socket.emit('registerPlayer', username);
    } else {
        alert('Please enter a username');
    }
});

// Успешная регистрация
socket.on('registrationSuccess', (data) => {
    playerId = data.id;
    playerUsername = data.username;
    
    // Обновляем UI
    usernameInput.disabled = true;
    registerBtn.disabled = true;
    registerBtn.textContent = 'Waiting for opponent...';
    
    // Отображаем список игроков
    updatePlayersList(data.players);
});

// Новый игрок подключился
socket.on('playerJoined', (playerData) => {
    addPlayerToList(playerData);
});

// Игрок изменил статус
socket.on('playerStatusChanged', (data) => {
    updatePlayerStatus(data.id, data.status);
});

// Игрок отключился
socket.on('playerLeft', (playerId) => {
    removePlayerFromList(playerId);
});

// Вызов на бой
socket.on('challengeFailed', (message) => {
    alert(message);
});

// Начало игры
socket.on('gameStart', (gameData) => {
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'inline-block';
    
    // Инициализация игровых объектов
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

    // Создаем локального игрока
    player = new Fighter({
        position: gameData.players[playerId].position,
        velocity: gameData.players[playerId].velocity,
        offset: { x: 215, y: 157 },
        imageSrc: './img/samuraiMack/Idle.png',
        framesMax: 8,
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
        attackBox: {
            offset: { x: 100, y: 50 },
            width: 160,
            height: 50
        }
    });

    player.id = playerId;
    player.health = 100;

    // Создаем противника
    enemyId = Object.keys(gameData.players).find(id => id !== playerId);
    const enemyData = gameData.players[enemyId];
    
    enemy = new Fighter({
        position: enemyData.position,
        velocity: enemyData.velocity,
        offset: { x: 215, y: 167 },
        imageSrc: './img/kenji/Idle.png',
        framesMax: 4,
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
        attackBox: {
            offset: { x: -170, y: 50 },
            width: 170,
            height: 50
        },
        isEnemy: true
    });
    
    enemy.id = enemyId;
    enemy.health = 100;

    // Начинаем игровой цикл
    if (!gameStarted) {
        animate();
        gameStarted = true;
    }
});

// Игрок переместился
socket.on('playerUpdate', (playerData) => {
    if (playerData.playerId === enemyId && enemy) {
        enemy.position = playerData.position;
        enemy.velocity = playerData.velocity;
        enemy.lastKey = playerData.lastKey;
        enemy.isAttacking = playerData.isAttacking;
        
        if (enemy.isAttacking) {
            enemy.switchSprite('attack1');
        } else if (enemy.velocity.x !== 0) {
            enemy.switchSprite('run');
        } else {
            enemy.switchSprite('idle');
        }
    }
});

// Игрок получил урон
socket.on('hit', (healthData) => {
    if (healthData.targetId === playerId) {
        player.health = healthData.health;
        document.querySelector('#playerHealth').style.width = player.health + '%';
        if (player.health > 0) {
            player.takeHit();
        }
    } else if (healthData.targetId === enemyId) {
        enemy.health = healthData.health;
        document.querySelector('#enemyHealth').style.width = enemy.health + '%';
        if (enemy.health > 0) {
            enemy.takeHit();
        }
    }
});

// Конец игры
socket.on('gameOver', (result) => {
    const displayText = document.querySelector('#displayText');
    displayText.style.display = 'flex';
    
    if (result.winner === playerId) {
        displayText.textContent = 'You Win!';
    } else if (result.winner === enemyId) {
        displayText.textContent = 'You Lose!';
    } else {
        displayText.textContent = result.reason;
    }
    
    // Возвращаем в лобби через 5 секунд
    setTimeout(() => {
        gameContainer.style.display = 'none';
        lobbyContainer.style.display = 'block';
        player = null;
        enemy = null;
        enemyId = null;
        gameStarted = false;
        displayText.style.display = 'none';
    }, 5000);
});

// Функции для работы с UI лобби
function updatePlayersList(players) {
    playersContainer.innerHTML = '';
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
            socket.emit('challengePlayer', playerData.id);
        });
    }
    
    playersContainer.appendChild(playerElement);
}

function updatePlayerStatus(playerId, status) {
    const playerElement = playersContainer.querySelector(`[data-id="${playerId}"]`);
    if (playerElement) {
        const statusElement = playerElement.querySelector('.player-status');
        statusElement.className = `player-status ${status === 'inGame' ? 'in-game' : ''}`;
        statusElement.textContent = status === 'waiting' ? 'Waiting' : 'In Game';
        
        if (status === 'waiting') {
            playerElement.addEventListener('click', () => {
                socket.emit('challengePlayer', playerId);
            });
        } else {
            playerElement.removeEventListener('click', () => {});
        }
    }
}

function removePlayerFromList(playerId) {
    const playerElement = playersContainer.querySelector(`[data-id="${playerId}"]`);
    if (playerElement) {
        playerElement.remove();
    }
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
        
        // Отправляем данные о движении на сервер
        socket.emit('movement', {
            position: player.position,
            velocity: player.velocity,
            lastKey: player.lastKey,
            isAttacking: player.isAttacking,
            facingRight: player.facingRight
        });
    }
    
    if (enemy) {
        enemy.update();
    }

    // Локальное управление игроком
    if (player) {
        player.velocity.x = 0;
        
        if (keys.a.pressed && player.lastKey === 'a') {
            player.velocity.x = -4;
            player.switchSprite('run');
            player.facingRight = false;
        } else if (keys.d.pressed && player.lastKey === 'd') {
            player.velocity.x = 4;
            player.switchSprite('run');
            player.facingRight = true;
        } else {
            player.switchSprite('idle');
        }

        // Прыжок
        if (player.velocity.y < 0) {
            player.switchSprite('jump');
        } else if (player.velocity.y > 0) {
            player.switchSprite('fall');
        }
    }

    // Проверка столкновений (локальная)
    if (player && enemy) {
        if (player.isAttacking && rectangularCollision({ rectangle1: player, rectangle2: enemy }) && player.framesCurrent === 4) {
            socket.emit('attack');
            player.isAttacking = false;
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
                player.velocity.y = -12;
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