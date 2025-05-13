const socket = io();

const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

const waitingScreen = document.getElementById('waitingScreen');
const gameContainer = document.querySelector('.game-container');
const findMatchButton = document.getElementById('findMatchButton');
const queueStatus = document.getElementById('queueStatus');

let player;
let enemy;
let gameStarted = false;

// Обработка поиска матча
findMatchButton.addEventListener('click', () => {
    findMatchButton.disabled = true;
    findMatchButton.textContent = 'Поиск матча...';
    socket.emit('joinQueue');
});

// Обработка статуса очереди
socket.on('queueStatus', (data) => {
    queueStatus.textContent = `Позиция в очереди: ${data.position}`;
});

// Обработка найденного матча
socket.on('matchFound', (data) => {
    waitingScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    gameStarted = true;

    // Создаем игроков
    player = new Fighter({
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        color: data.colors[socket.id],
        imageSrc: data.colors[socket.id] === 'red' ? 'img/samuraiMack/Idle.png' : 'img/kenji/Idle.png',
        framesMax: 8,
        scale: 2.5,
        offset: { x: 215, y: 157 },
        sprites: {
            idle: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/samuraiMack/Idle.png' : 'img/kenji/Idle.png',
                framesMax: 8
            },
            run: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/samuraiMack/Run.png' : 'img/kenji/Run.png',
                framesMax: 8
            },
            jump: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/samuraiMack/Jump.png' : 'img/kenji/Jump.png',
                framesMax: 2
            },
            fall: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/samuraiMack/Fall.png' : 'img/kenji/Fall.png',
                framesMax: 2
            },
            attack1: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/samuraiMack/Attack1.png' : 'img/kenji/Attack1.png',
                framesMax: 6
            },
            takeHit: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/samuraiMack/Take Hit - white silhouette.png' : 'img/kenji/Take hit.png',
                framesMax: 4
            },
            death: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/samuraiMack/Death.png' : 'img/kenji/Death.png',
                framesMax: 6
            }
        },
        attackBox: {
            offset: { x: 100, y: 50 },
            width: 160,
            height: 50
        }
    });

    enemy = new Fighter({
        position: { x: 400, y: 100 },
        velocity: { x: 0, y: 0 },
        color: data.colors[socket.id] === 'red' ? 'blue' : 'red',
        imageSrc: data.colors[socket.id] === 'red' ? 'img/kenji/Idle.png' : 'img/samuraiMack/Idle.png',
        framesMax: 4,
        scale: 2.5,
        offset: { x: 215, y: 167 },
        sprites: {
            idle: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/kenji/Idle.png' : 'img/samuraiMack/Idle.png',
                framesMax: 4
            },
            run: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/kenji/Run.png' : 'img/samuraiMack/Run.png',
                framesMax: 8
            },
            jump: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/kenji/Jump.png' : 'img/samuraiMack/Jump.png',
                framesMax: 2
            },
            fall: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/kenji/Fall.png' : 'img/samuraiMack/Fall.png',
                framesMax: 2
            },
            attack1: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/kenji/Attack1.png' : 'img/samuraiMack/Attack1.png',
                framesMax: 4
            },
            takeHit: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/kenji/Take hit.png' : 'img/samuraiMack/Take Hit - white silhouette.png',
                framesMax: 3
            },
            death: {
                imageSrc: data.colors[socket.id] === 'red' ? 'img/kenji/Death.png' : 'img/samuraiMack/Death.png',
                framesMax: 7
            }
        },
        attackBox: {
            offset: { x: -170, y: 50 },
            width: 170,
            height: 50
        }
    });

    animate();
});

// Обработка движения противника
socket.on('playerMoved', (data) => {
    if (enemy) {
        enemy.position = data.position;
        enemy.velocity = data.velocity;
        enemy.lastKey = data.lastKey;
    }
});

// Обработка атаки противника
socket.on('enemyAttack', (data) => {
    if (enemy) {
        enemy.attack();
    }
});

// Обработка отключения противника
socket.on('opponentDisconnected', () => {
    gameStarted = false;
    waitingScreen.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    findMatchButton.disabled = false;
    findMatchButton.textContent = 'Найти матч';
    queueStatus.textContent = 'Противник отключился';
});

// Обработка клавиш
const keys = {
    a: {
        pressed: false
    },
    d: {
        pressed: false
    },
    w: {
        pressed: false
    },
    ArrowRight: {
        pressed: false
    },
    ArrowLeft: {
        pressed: false
    },
    ArrowUp: {
        pressed: false
    }
};

window.addEventListener('keydown', (event) => {
    if (!gameStarted) return;

    switch (event.key) {
        case 'd':
            keys.d.pressed = true;
            break;
        case 'a':
            keys.a.pressed = true;
            break;
        case 'w':
            player.velocity.y = -20;
            break;
        case ' ':
            player.attack();
            socket.emit('playerAttack');
            break;
    }
});

window.addEventListener('keyup', (event) => {
    if (!gameStarted) return;

    switch (event.key) {
        case 'd':
            keys.d.pressed = false;
            break;
        case 'a':
            keys.a.pressed = false;
            break;
    }
});

function animate() {
    if (!gameStarted) return;
    requestAnimationFrame(animate);
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    // Обновление позиции игрока
    if (keys.d.pressed) {
        player.velocity.x = 5;
        player.switchSprite('run');
    } else if (keys.a.pressed) {
        player.velocity.x = -5;
        player.switchSprite('run');
    } else {
        player.velocity.x = 0;
        player.switchSprite('idle');
    }

    // Отправка данных о движении на сервер
    socket.emit('playerMovement', {
        position: player.position,
        velocity: player.velocity,
        lastKey: keys.d.pressed ? 'd' : keys.a.pressed ? 'a' : null
    });

    // Отрисовка и обновление
    player.update();
    enemy.update();

    // Проверка столкновений
    if (detectCollision({ rectangle1: player, rectangle2: enemy }) &&
        player.isAttacking && player.framesCurrent === 4) {
        player.isAttacking = false;
        enemy.takeHit();
    }

    if (detectCollision({ rectangle1: enemy, rectangle2: player }) &&
        enemy.isAttacking && enemy.framesCurrent === 2) {
        enemy.isAttacking = false;
        player.takeHit();
    }

    // Обновление полос здоровья
    document.querySelector('#playerHealth').style.width = player.health + '%';
    document.querySelector('#enemyHealth').style.width = enemy.health + '%';

    // Проверка окончания игры
    if (enemy.health <= 0 || player.health <= 0) {
        determineWinner({ player, enemy });
    }
}