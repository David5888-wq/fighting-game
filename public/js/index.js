const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
const waitingScreen = document.getElementById('waiting-screen');

// Подключение к серверу
const socket = io();
let playerId;
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
socket.on('init', ({ playerId: id, gameState, controls }) => {
    playerId = id;
    console.log('Player ID:', playerId);
    
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
        position: gameState.players[playerId].position,
        velocity: gameState.players[playerId].velocity,
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

    // Начинаем игровой цикл
    if (!gameStarted) {
        animate();
        gameStarted = true;
    }
});

// Новый игрок подключился
socket.on('newPlayer', (newPlayer) => {
    if (newPlayer.id !== playerId && !enemy) {
        enemyId = newPlayer.id;
        createEnemy(newPlayer);
        waitingScreen.style.display = 'none';
    }
});

// Игрок переместился
socket.on('playerMoved', (playerData) => {
    if (playerData.id === enemyId && enemy) {
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

// Игрок атаковал
socket.on('playerAttacked', (attackData) => {
    if (attackData.id === enemyId && enemy) {
        enemy.switchSprite('attack1');
    }
});

// Игрок получил урон
socket.on('playerHealthUpdate', (healthData) => {
    if (healthData.id === playerId) {
        player.health = healthData.health;
        document.querySelector('#playerHealth').style.width = player.health + '%';
        if (player.health > 0) {
            player.takeHit();
        }
    } else if (healthData.id === enemyId) {
        enemy.health = healthData.health;
        document.querySelector('#enemyHealth').style.width = enemy.health + '%';
        if (enemy.health > 0) {
            enemy.takeHit();
        }
    }
});

// Игрок отключился
socket.on('playerDisconnected', (disconnectedId) => {
    if (disconnectedId === enemyId) {
        enemy = null;
        enemyId = null;
        waitingScreen.style.display = 'flex';
        waitingScreen.innerHTML = '<div>Opponent disconnected. Waiting for another player...</div>';
    }
});

function createEnemy(enemyData) {
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
        }
    });
    
    enemy.id = enemyId;
    enemy.health = 100;
}

function rectangularCollision({ rectangle1, rectangle2 }) {
    return (
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x &&
        rectangle1.attackBox.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >= rectangle2.position.y &&
        rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
    );
}

function determineWinner({ player, enemy }) {
    document.querySelector('#displayText').style.display = 'flex';
    if (player.health === enemy.health) {
        document.querySelector('#displayText').innerHTML = 'Tie';
    } else if (player.health > enemy.health) {
        document.querySelector('#displayText').innerHTML = 'Player 1 Wins';
    } else {
        document.querySelector('#displayText').innerHTML = 'Player 2 Wins';
    }
}

let timer = 60;
let timerId;

function decreaseTimer() {
    if (timer > 0) {
        timerId = setTimeout(decreaseTimer, 1000);
        timer--;
        document.querySelector('#timer').innerHTML = timer;
    }

    if (timer === 0) {
        determineWinner({ player, enemy });
    }
}

decreaseTimer();

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
        socket.emit('playerMovement', {
            position: player.position,
            velocity: player.velocity,
            lastKey: player.lastKey,
            isAttacking: player.isAttacking
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
        } else if (keys.d.pressed && player.lastKey === 'd') {
            player.velocity.x = 4;
            player.switchSprite('run');
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
            socket.emit('playerHit', { targetId: enemyId });
            player.isAttacking = false;
        }

        if (enemy.isAttacking && rectangularCollision({ rectangle1: enemy, rectangle2: player }) && enemy.framesCurrent === 2) {
            socket.emit('playerHit', { targetId: playerId });
            enemy.isAttacking = false;
        }

        // Конец игры
        if (enemy.health <= 0 || player.health <= 0) {
            determineWinner({ player, enemy });
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
            socket.emit('playerAttack', { isAttacking: true });
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