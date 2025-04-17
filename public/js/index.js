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

// ⚡ Удалены глобальные переменные timer и timerId

registerBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        socket.emit('registerPlayer', username);
    } else {
        alert('Please enter a username');
    }
});

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

// ⚡ Полностью переработан обработчик gameStart
socket.on('gameStart', (gameData) => {
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'inline-block';

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

    // Создание локального игрока
    const playerData = gameData.players[playerId];
    player = new Fighter({
        position: playerData.position,
        velocity: playerData.velocity,
        offset: playerData.character.offset,
        imageSrc: playerData.character.imageSrc,
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
        attackBox: enemyData.character.attackBox,
        isEnemy: true
    });
    
    enemy.id = enemyId;
    enemy.health = 100;

    if (!gameStarted) {
        animate();
        gameStarted = true;
    }
});

// ⚡ Новый обработчик обновления состояния игры
socket.on('gameStateUpdate', (gameData) => {
    // Обновление таймера
    document.querySelector('#timer').innerHTML = Math.floor(gameData.timeLeft);
    
    // Синхронизация позиций противника
    if (enemy) {
        enemy.position = gameData.players[enemyId].position;
        enemy.velocity = gameData.players[enemyId].velocity;
        enemy.isAttacking = gameData.players[enemyId].isAttacking;
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
        gameStarted = false;
        displayText.style.display = 'none';
    }, 5000);
});

// Остальные функции UI остаются без изменений
function updatePlayersList(players) { /* ... */ }
function addPlayerToList(playerData) { /* ... */ }
function updatePlayerStatus(playerId, status) { /* ... */ }
function removePlayerFromList(playerId) { /* ... */ }

// ⚡ Обновленная функция анимации с deltaTime
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

    if (player && enemy) {
        if (player.isAttacking && rectangularCollision({ rectangle1: player, rectangle2: enemy }) && player.framesCurrent === 4) {
            socket.emit('attack');
            player.isAttacking = false;
        }
    }
}

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
