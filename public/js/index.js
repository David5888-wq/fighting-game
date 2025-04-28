import { Sprite, Fighter, Background, Decoration } from './classes.js';

// Инициализация игры
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
const socket = io();

// Элементы интерфейса
const loginScreen = document.getElementById('loginScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const usernameInput = document.getElementById('usernameInput');
const loginButton = document.getElementById('loginButton');
const waitingList = document.getElementById('waitingList');
const errorText = document.getElementById('errorText');
const playerHealthBar = document.getElementById('playerHealth');
const opponentHealthBar = document.getElementById('opponentHealth');
const timerElement = document.getElementById('timer');
const displayText = document.getElementById('displayText');

// Игровые переменные
let player;
let opponent;
let gameId;
let username;
let myCharacter;
let opponentCharacter;
let background;
let shop;
const gravity = 0.3;
let timer = 60;

// Управление клавишами
const keys = {
    a: { pressed: false },
    d: { pressed: false },
    w: { pressed: false },
    ArrowRight: { pressed: false },
    ArrowLeft: { pressed: false },
    ArrowUp: { pressed: false }
};

// Обработчики событий
loginButton.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name.length > 0) {
        username = name;
        socket.emit('playerLogin', name);
    }
});

// Socket.io события
socket.on('usernameTaken', () => {
    errorText.style.display = 'block';
});

socket.on('loginSuccess', () => {
    loginScreen.style.display = 'none';
    lobbyScreen.style.display = 'flex';
    errorText.style.display = 'none';
});

socket.on('updateWaitingList', (players) => {
    waitingList.innerHTML = '';
    players.forEach(player => {
        if (player !== username) {
            const playerElement = document.createElement('div');
            playerElement.className = 'playerItem';
            playerElement.textContent = player;
            playerElement.addEventListener('click', () => {
                socket.emit('challengePlayer', player);
            });
            waitingList.appendChild(playerElement);
        }
    });
});

socket.on('gameStart', (data) => {
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    
    gameId = data.gameId;
    myCharacter = data.yourCharacter;
    opponentCharacter = data.opponentCharacter;
    
    // Инициализация игроков
    player = new Fighter({
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        offset: { x: 215, y: myCharacter === 'samuraiMack' ? 157 : 167 },
        imageSrc: `./img/${myCharacter}/Idle.png`,
        framesMax: myCharacter === 'samuraiMack' ? 8 : 4,
        scale: 2.5,
        sprites: createSprites(myCharacter),
        attackBox: {
            offset: { x: myCharacter === 'samuraiMack' ? 100 : -170, y: 50 },
            width: myCharacter === 'samuraiMack' ? 160 : 170,
            height: 50
        }
    });
    
    opponent = new Fighter({
        position: { x: 400, y: 100 },
        velocity: { x: 0, y: 0 },
        offset: { x: 215, y: opponentCharacter === 'samuraiMack' ? 157 : 167 },
        imageSrc: `./img/${opponentCharacter}/Idle.png`,
        framesMax: opponentCharacter === 'samuraiMack' ? 8 : 4,
        scale: 2.5,
        sprites: createSprites(opponentCharacter),
        attackBox: {
            offset: { x: opponentCharacter === 'samuraiMack' ? 100 : -170, y: 50 },
            width: opponentCharacter === 'samuraiMack' ? 160 : 170,
            height: 50
        }
    });
    
    // Загрузка фона
    background = new Background({
        position: { x: 0, y: 0 },
        imageSrc: './img/background.png'
    });
    
    shop = new Sprite({
        position: { x: 600, y: 128 },
        imageSrc: './img/shop.png',
        scale: 2.75,
        framesMax: 6
    });
    
    // Запуск игры
    animate();
});

socket.on('opponentMoved', (data) => {
    if (opponent) {
        opponent.position = data.position;
        opponent.velocity = data.velocity;
        opponent.lastKey = data.lastKey;
        
        // Обработка анимаций
        if (data.isAttacking && opponent.framesCurrent === 0) {
            opponent.attack();
        }
        
        // Анимация движения
        if (data.velocity.x !== 0) {
            opponent.switchSprite('run');
        } else {
            opponent.switchSprite('idle');
        }
        
        // Анимация прыжка/падения
        if (data.velocity.y < 0) {
            opponent.switchSprite('jump');
        } else if (data.velocity.y > 0) {
            opponent.switchSprite('fall');
        }
    }
});

socket.on('updateHealth', (data) => {
    playerHealthBar.style.width = data.playerHealth + '%';
    opponentHealthBar.style.width = data.opponentHealth + '%';
    
    // Если текущий игрок получил удар
    if (data.receiverId === socket.id) {
        player.takeHit();
    }
});

socket.on('updateTimer', (time) => {
    timer = time;
    timerElement.innerHTML = timer;
});

socket.on('gameOver', (data) => {
    displayText.style.display = 'flex';
    
    if (data.reason) {
        displayText.innerHTML = data.reason;
    } else if (data.winner === username) {
        displayText.innerHTML = 'You Win!';
    } else if (data.winner) {
        displayText.innerHTML = 'You Lose!';
    } else {
        displayText.innerHTML = 'Draw Game';
    }
    
    setTimeout(() => {
        gameScreen.style.display = 'none';
        lobbyScreen.style.display = 'flex';
        displayText.style.display = 'none';
        
        // Сброс игрового состояния
        player = null;
        opponent = null;
        gameId = null;
        timer = 60;
    }, 3000);
});

// Функции игры
function createSprites(character) {
    const basePath = `./img/${character}/`;
    const isSamurai = character === 'samuraiMack';
    
    return {
        idle: {
            imageSrc: basePath + 'Idle.png',
            framesMax: isSamurai ? 8 : 4
        },
        run: {
            imageSrc: basePath + 'Run.png',
            framesMax: 8
        },
        jump: {
            imageSrc: basePath + 'Jump.png',
            framesMax: 2
        },
        fall: {
            imageSrc: basePath + 'Fall.png',
            framesMax: 2
        },
        attack1: {
            imageSrc: basePath + 'Attack1.png',
            framesMax: isSamurai ? 6 : 4
        },
        takeHit: {
            imageSrc: basePath + (isSamurai ? 'Take Hit - white silhouette.png' : 'Take hit.png'),
            framesMax: isSamurai ? 4 : 3
        },
        death: {
            imageSrc: basePath + 'Death.png',
            framesMax: isSamurai ? 6 : 7
        }
    };
}

function animate() {
    if (!player || !opponent) return;
    
    window.requestAnimationFrame(animate);
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);
    
    background.update(c);
    if (shop) shop.update(c);
    
    c.fillStyle = 'rgba(255, 255, 255, 0.15)';
    c.fillRect(0, 0, canvas.width, canvas.height);
    
    player.update(c, gravity, canvas);
    opponent.update(c, gravity, canvas);
    
    player.velocity.x = 0;
    
    // Движение игрока
    if (keys.a.pressed && player.lastKey === 'a') {
        player.velocity.x = -4;
        player.switchSprite('run');
    } else if (keys.d.pressed && player.lastKey === 'd') {
        player.velocity.x = 4;
        player.switchSprite('run');
    } else {
        player.switchSprite('idle');
    }
    
    // Прыжки
    if (player.velocity.y < 0) {
        player.switchSprite('jump');
    } else if (player.velocity.y > 0) {
        player.switchSprite('fall');
    }
    
    // Отправка данных о движении на сервер
    socket.emit('playerMovement', {
        gameId,
        position: player.position,
        velocity: player.velocity,
        lastKey: player.lastKey,
        isAttacking: player.isAttacking
    });
    
    // Проверка столкновений
    if (
        player.isAttacking && 
        player.framesCurrent === 4 && 
        rectangularCollision({ rectangle1: player, rectangle2: opponent })
    ) {
        socket.emit('playerAttack', { 
            gameId, 
            damage: 20 
        });
        player.isAttacking = false;
    }
    
    // Проверка на выход за границы экрана
    if (player.position.x < 0) player.position.x = 0;
    if (player.position.x + player.width > canvas.width) {
        player.position.x = canvas.width - player.width;
    }
}

// Обработчики клавиатуры
window.addEventListener('keydown', (event) => {
    if (!player || player.dead) return;
    
    switch (event.key) {
        case 'd':
            keys.d.pressed = true;
            player.lastKey = 'd';
            break;
        case 'a':
            keys.a.pressed = true;
            player.lastKey = 'a';
            break;
        case 'w':
            if (player.position.y + player.height >= canvas.height - 96) {
                player.velocity.y = -12;
            }
            break;
        case ' ':
            player.attack();
            break;
    }
});

window.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'd':
            keys.d.pressed = false;
            break;
        case 'a':
            keys.a.pressed = false;
            break;
    }
});

// Функция проверки столкновений
function rectangularCollision({ rectangle1, rectangle2 }) {
    return (
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x &&
        rectangle1.attackBox.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >= rectangle2.position.y &&
        rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
    );
}
