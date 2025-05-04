import { debug } from './utils.js';

const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.querySelector('.game-container');
const usernameInput = document.getElementById('username-input');
const registerBtn = document.getElementById('register-btn');
const playersContainer = document.getElementById('players-container');

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

// Инициализация игры
registerBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        socket.emit('registerPlayer', username);
    } else {
        alert('Please enter a username');
    }
});

// Обработчики сокетов
socket.on('registrationSuccess', (data) => {
    playerId = data.id;
    playerUsername = data.username;
    
    usernameInput.disabled = true;
    registerBtn.disabled = true;
    registerBtn.textContent = 'Waiting for opponent...';
    
    updatePlayersList(data.players);
});

socket.on('playerJoined', (playerData) => {
    addPlayerToList(playerData);
});

socket.on('playerStatusChanged', (data) => {
    updatePlayerStatus(data.id, data.status);
});

socket.on('playerLeft', (playerId) => {
    removePlayerFromList(playerId);
});

socket.on('challengeFailed', (message) => {
    alert(message);
});

socket.on('gameStart', (gameData) => {
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'inline-block';

    // Сброс состояния игры
    document.querySelector('#playerHealth').style.width = '100%';
    document.querySelector('#enemyHealth').style.width = '100%';
    document.querySelector('#displayText').style.display = 'none';

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

    // Получаем ID противника
    enemyId = Object.keys(gameData.players).find(id => id !== playerId);
    
    // Создаем игроков
    player = createFighter(playerId, gameData.players[playerId], false);
    enemy = createFighter(enemyId, gameData.players[enemyId], true);

    if (!gameStarted) {
        animate();
        gameStarted = true;
    }
});

socket.on('gameStateUpdate', (gameData) => {
    document.querySelector('#timer').innerHTML = Math.floor(gameData.timeLeft);
    
    if (enemy) {
        enemy.position = gameData.players[enemyId].position;
        enemy.velocity = gameData.players[enemyId].velocity;
        enemy.isAttacking = gameData.players[enemyId].isAttacking;
        enemy.facingRight = gameData.players[enemyId].facingRight;
    }
});

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
    
    setTimeout(() => {
        gameContainer.style.display = 'none';
        lobbyContainer.style.display = 'block';
        player = null;
        enemy = null;
        enemyId = null;
        displayText.style.display = 'none';
    }, 5000);
});

// Функции для работы с лобби
function updatePlayersList(players) {
    playersContainer.innerHTML = '';
    players.forEach(player => {
        if (player.id !== playerId) {
            addPlayerToList(player);
        }
    });
}

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

function updatePlayerStatus(playerId, status) {
    const playerElement = document.querySelector(`[data-player-id="${playerId}"]`);
    if (playerElement) {
        playerElement.querySelector('.player-status').textContent = status === 'inGame' ? 'In Game' : 'Waiting';
        playerElement.querySelector('.player-status').className = `player-status ${status === 'inGame' ? 'in-game' : ''}`;
        playerElement.className = `player-item ${status === 'inGame' ? 'in-game' : ''}`;
        
        if (status === 'inGame') {
            playerElement.onclick = null;
        } else {
            playerElement.addEventListener('click', () => {
                socket.emit('challengePlayer', playerId);
            });
        }
    }
}

function removePlayerFromList(playerId) {
    const playerElement = document.querySelector(`[data-player-id="${playerId}"]`);
    if (playerElement) {
        playerElement.remove();
    }
}

// Создание бойца
function createFighter(id, data, isEnemy) {
    return new Fighter({
        position: data.position,
        velocity: data.velocity,
        offset: data.character.offset,
        imageSrc: data.character.imageSrc,
        framesMax: 8,
        scale: 2.5,
        sprites: getCharacterSprites(data.character.name),
        attackBox: data.character.attackBox,
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
let lastTime = 0;
function animate(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    window.requestAnimationFrame(animate);
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);
    
    background.update(deltaTime);
    shop.update(deltaTime);
    
    c.fillStyle = 'rgba(255, 255, 255, 0.15)';
    c.fillRect(0, 0, canvas.width, canvas.height);
    
    if (player) {
        player.update(deltaTime);
        
        // Отправка данных о движении на сервер
        socket.emit('movement', {
            position: player.position,
            velocity: player.velocity,
            lastKey: player.lastKey,
            isAttacking: player.isAttacking,
            facingRight: player.facingRight
        });
    }
    
    if (enemy) {
        enemy.update(deltaTime);
    }

    // Обработка управления
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

        if (player.velocity.y < 0) {
            player.switchSprite('jump');
        } else if (player.velocity.y > 0) {
            player.switchSprite('fall');
        }
    }

    // Проверка атаки
    if (player && enemy) {
        if (player.isAttacking && rectangularCollision({ rectangle1: player, rectangle2: enemy }) && player.framesCurrent === 4) {
            socket.emit('attack');
            player.isAttacking = false;
        }
    }
}

// Обработчики клавиатуры
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
