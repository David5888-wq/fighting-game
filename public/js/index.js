const socket = io();

// DOM элементы
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const nicknameInput = document.getElementById('nicknameInput');
const loginButton = document.getElementById('loginButton');
const lobbyScreen = document.getElementById('lobbyScreen');
const waitingPlayers = document.getElementById('waitingPlayers');
const gameContainer = document.querySelector('.game-container');

// Игровые переменные
let canvas;
let ctx;
let player;
let enemy;
let background;
let shop;
let timer = 60;
let timerId;
let matchId = null;
let myCharacter = null;
let opponentId = null;

// Обработка входа
loginButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    if (nickname) {
        socket.emit('playerLogin', nickname);
        loginScreen.style.display = 'none';
        lobbyScreen.style.display = 'flex';
    }
});

// Обработка обновления списка ожидающих игроков
socket.on('waitingPlayersUpdate', (players) => {
    waitingPlayers.innerHTML = '';
    players.forEach(player => {
        if (player.id !== socket.id) {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            playerElement.textContent = player.nickname;
            playerElement.addEventListener('click', () => {
                socket.emit('challengePlayer', player.id);
            });
            waitingPlayers.appendChild(playerElement);
        }
    });
});

// Обработка начала матча
socket.on('matchStart', (data) => {
    matchId = data.matchId;
    myCharacter = data.character;
    opponentId = data.opponent.id;
    
    lobbyScreen.style.display = 'none';
    gameContainer.style.display = 'inline-block';
    
    initGame();
});

// Обработка движения противника
socket.on('opponentMoved', (data) => {
    if (enemy) {
        enemy.position = data.position;
        enemy.velocity = data.velocity;
        enemy.lastKey = data.lastKey;
    }
});

// Обработка атаки противника
socket.on('opponentAttack', (attackData) => {
    if (enemy) {
        enemy.attack();
    }
});

// Обработка отключения противника
socket.on('opponentDisconnected', () => {
    endMatch('Противник отключился');
});

// Обработка результата матча
socket.on('matchResult', (data) => {
    endMatch(data.winner);
});

function initGame() {
    canvas = document.querySelector('canvas');
    ctx = canvas.getContext('2d');
    
    canvas.width = 1024;
    canvas.height = 576;
    
    background = new Sprite({
        position: {
            x: 0,
            y: 0
        },
        imageSrc: './img/background.png',
        ctx
    });
    
    shop = new Sprite({
        position: {
            x: 600,
            y: 128
        },
        imageSrc: './img/shop.png',
        scale: 2.75,
        framesMax: 6,
        ctx
    });
    
    player = new Fighter({
        position: {
            x: 0,
            y: 0
        },
        velocity: {
            x: 0,
            y: 0
        },
        offset: {
            x: 215,
            y: 157
        },
        imageSrc: `./img/${myCharacter}/Idle.png`,
        framesMax: 8,
        scale: 2.5,
        offset: {
            x: 215,
            y: 157
        },
        ctx,
        sprites: {
            idle: {
                imageSrc: `./img/${myCharacter}/Idle.png`,
                framesMax: 8
            },
            run: {
                imageSrc: `./img/${myCharacter}/Run.png`,
                framesMax: 8
            },
            jump: {
                imageSrc: `./img/${myCharacter}/Jump.png`,
                framesMax: 2
            },
            fall: {
                imageSrc: `./img/${myCharacter}/Fall.png`,
                framesMax: 2
            },
            attack1: {
                imageSrc: `./img/${myCharacter}/Attack1.png`,
                framesMax: 6
            },
            attack2: {
                imageSrc: `./img/${myCharacter}/Attack2.png`,
                framesMax: 6
            },
            takeHit: {
                imageSrc: `./img/${myCharacter}/Take Hit - white silhouette.png`,
                framesMax: 4
            },
            death: {
                imageSrc: `./img/${myCharacter}/Death.png`,
                framesMax: 6
            }
        },
        attackBox: {
            offset: {
                x: 100,
                y: 50
            },
            width: 160,
            height: 50
        }
    });
    
    // Инициализация клавиш для игрока
    player.keys = {
        a: { pressed: false },
        d: { pressed: false }
    };
    
    enemy = new Fighter({
        position: {
            x: 400,
            y: 100
        },
        velocity: {
            x: 0,
            y: 0
        },
        color: 'red',
        offset: {
            x: 215,
            y: 167
        },
        imageSrc: `./img/${myCharacter === 'samuraiMack' ? 'kenji' : 'samuraiMack'}/Idle.png`,
        framesMax: 4,
        scale: 2.5,
        offset: {
            x: 215,
            y: 167
        },
        ctx,
        sprites: {
            idle: {
                imageSrc: `./img/${myCharacter === 'samuraiMack' ? 'kenji' : 'samuraiMack'}/Idle.png`,
                framesMax: 4
            },
            run: {
                imageSrc: `./img/${myCharacter === 'samuraiMack' ? 'kenji' : 'samuraiMack'}/Run.png`,
                framesMax: 8
            },
            jump: {
                imageSrc: `./img/${myCharacter === 'samuraiMack' ? 'kenji' : 'samuraiMack'}/Jump.png`,
                framesMax: 2
            },
            fall: {
                imageSrc: `./img/${myCharacter === 'samuraiMack' ? 'kenji' : 'samuraiMack'}/Fall.png`,
                framesMax: 2
            },
            attack1: {
                imageSrc: `./img/${myCharacter === 'samuraiMack' ? 'kenji' : 'samuraiMack'}/Attack1.png`,
                framesMax: 4
            },
            attack2: {
                imageSrc: `./img/${myCharacter === 'samuraiMack' ? 'kenji' : 'samuraiMack'}/Attack2.png`,
                framesMax: 4
            },
            takeHit: {
                imageSrc: `./img/${myCharacter === 'samuraiMack' ? 'kenji' : 'samuraiMack'}/Take hit.png`,
                framesMax: 3
            },
            death: {
                imageSrc: `./img/${myCharacter === 'samuraiMack' ? 'kenji' : 'samuraiMack'}/Death.png`,
                framesMax: 7
            }
        },
        attackBox: {
            offset: {
                x: -170,
                y: 50
            },
            width: 170,
            height: 50
        }
    });
    
    decreaseTimer(timer, timerId, player, enemy);
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    background.update();
    shop.update();
    player.update();
    enemy.update();
    
    // Отправка данных о движении на сервер
    if (matchId) {
        socket.emit('playerMovement', {
            matchId,
            position: player.position,
            velocity: player.velocity,
            lastKey: player.lastKey
        });
    }
    
    // Отправка данных об атаке на сервер
    if (player.isAttacking) {
        socket.emit('playerAttack', {
            matchId,
            attackData: {
                attackBox: player.attackBox,
                isAttacking: true
            }
        });
    }
    
    // Проверка столкновений
    if (
        rectangularCollision({
            rectangle1: player,
            rectangle2: enemy
        }) &&
        player.isAttacking &&
        player.framesCurrent === 4
    ) {
        enemy.takeHit();
        player.isAttacking = false;
        
        gsap.to('#enemyHealth', {
            width: enemy.health + '%'
        });
    }
    
    if (
        rectangularCollision({
            rectangle1: enemy,
            rectangle2: player
        }) &&
        enemy.isAttacking &&
        enemy.framesCurrent === 2
    ) {
        player.takeHit();
        enemy.isAttacking = false;
        
        gsap.to('#playerHealth', {
            width: player.health + '%'
        });
    }
    
    // Проверка окончания матча
    if (enemy.health <= 0 || player.health <= 0) {
        determineWinner({ player, enemy, timerId });
    }
}

function decreaseTimer(timer, timerId, player, enemy) {
    if (timer > 0) {
        timerId = setTimeout(decreaseTimer, 1000, timer - 1, timerId, player, enemy);
        document.querySelector('#timer').innerHTML = timer;
    }
    
    if (timer === 0) {
        determineWinner({ player, enemy, timerId });
    }
}

function determineWinner({ player, enemy, timerId }) {
    clearTimeout(timerId);
    document.querySelector('#displayText').style.display = 'flex';
    
    let result;
    if (player.health === enemy.health) {
        result = 'Tie';
    } else if (player.health > enemy.health) {
        result = 'Player 1 Wins';
    } else {
        result = 'Player 2 Wins';
    }
    
    document.querySelector('#displayText').innerHTML = result;
    
    // Отправка результата на сервер
    if (matchId) {
        socket.emit('matchEnd', {
            matchId,
            winner: result
        });
    }
}

function endMatch(result) {
    gameContainer.style.display = 'none';
    lobbyScreen.style.display = 'flex';
    
    // Сброс игровых переменных
    matchId = null;
    myCharacter = null;
    opponentId = null;
    timer = 60;
    document.querySelector('#timer').innerHTML = timer;
    document.querySelector('#displayText').style.display = 'none';
    document.querySelector('#playerHealth').style.width = '100%';
    document.querySelector('#enemyHealth').style.width = '100%';
    
    // Очистка таймера
    if (timerId) {
        clearTimeout(timerId);
    }
}

// Обработка клавиш
window.addEventListener('keydown', (event) => {
    if (!player) return;
    
    switch (event.key) {
        case 'd':
            player.keys.d.pressed = true;
            player.lastKey = 'd';
            break;
        case 'a':
            player.keys.a.pressed = true;
            player.lastKey = 'a';
            break;
        case 'w':
            player.velocity.y = -20;
            break;
        case ' ':
            player.attack();
            break;
    }
});

window.addEventListener('keyup', (event) => {
    if (!player) return;
    
    switch (event.key) {
        case 'd':
            player.keys.d.pressed = false;
            break;
        case 'a':
            player.keys.a.pressed = false;
            break;
    }
});