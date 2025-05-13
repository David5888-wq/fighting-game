const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Игровые объекты
let player = null;
let opponent = null;
let background = null;

// Загрузка изображений
const images = {};
const imageFiles = {
    background: 'img/background.png',
    ryu: {
        idle: 'img/ryu/idle.png',
        walk: 'img/ryu/walk.png',
        jump: 'img/ryu/jump.png',
        attack: 'img/ryu/attack.png'
    },
    ken: {
        idle: 'img/ken/idle.png',
        walk: 'img/ken/walk.png',
        jump: 'img/ken/jump.png',
        attack: 'img/ken/attack.png'
    },
    // Добавьте остальных персонажей по аналогии
};

// Загрузка всех изображений
function loadImages() {
    return new Promise((resolve) => {
        let loadedImages = 0;
        const totalImages = Object.keys(imageFiles).length + 
            Object.keys(imageFiles).filter(key => typeof imageFiles[key] === 'object').length * 3;

        function imageLoaded() {
            loadedImages++;
            if (loadedImages === totalImages) {
                resolve();
            }
        }

        // Загрузка фона
        images.background = new Image();
        images.background.src = imageFiles.background;
        images.background.onload = imageLoaded;

        // Загрузка спрайтов персонажей
        for (const character in imageFiles) {
            if (typeof imageFiles[character] === 'object') {
                images[character] = {};
                for (const state in imageFiles[character]) {
                    images[character][state] = new Image();
                    images[character][state].src = imageFiles[character][state];
                    images[character][state].onload = imageLoaded;
                }
            }
        }
    });
}

// Класс игрока
class Fighter {
    constructor(x, y, character, isPlayer = true) {
        this.x = x;
        this.y = y;
        this.character = character;
        this.isPlayer = isPlayer;
        this.state = 'idle';
        this.frame = 0;
        this.frameCount = 0;
        this.health = 100;
        this.velocity = { x: 0, y: 0 };
        this.isJumping = false;
        this.isAttacking = false;
    }

    update() {
        // Обновление позиции
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // Гравитация
        if (this.isJumping) {
            this.velocity.y += 0.8;
            if (this.y >= 400) { // Уровень земли
                this.y = 400;
                this.velocity.y = 0;
                this.isJumping = false;
            }
        }

        // Анимация
        this.frameCount++;
        if (this.frameCount >= 5) {
            this.frame = (this.frame + 1) % 4;
            this.frameCount = 0;
        }
    }

    draw() {
        const sprite = images[this.character][this.state];
        const frameWidth = sprite.width / 4;
        const frameHeight = sprite.height;

        ctx.save();
        if (!this.isPlayer) {
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
        }

        ctx.drawImage(
            sprite,
            this.frame * frameWidth, 0, frameWidth, frameHeight,
            this.isPlayer ? this.x : canvas.width - this.x - frameWidth,
            this.y,
            frameWidth,
            frameHeight
        );

        ctx.restore();
    }

    move(direction) {
        if (direction === 'left') {
            this.velocity.x = -5;
            this.state = 'walk';
        } else if (direction === 'right') {
            this.velocity.x = 5;
            this.state = 'walk';
        } else {
            this.velocity.x = 0;
            this.state = 'idle';
        }
    }

    jump() {
        if (!this.isJumping) {
            this.velocity.y = -15;
            this.isJumping = true;
            this.state = 'jump';
        }
    }

    attack() {
        if (!this.isAttacking) {
            this.isAttacking = true;
            this.state = 'attack';
            setTimeout(() => {
                this.isAttacking = false;
                this.state = 'idle';
            }, 500);
        }
    }
}

// Инициализация игры
function initGame(playerCharacter, opponentCharacter) {
    // Создание игроков
    player = new Fighter(100, 400, playerCharacter, true);
    opponent = new Fighter(600, 400, opponentCharacter, false);

    // Загрузка фона
    background = new Image();
    background.src = 'img/background.png';

    // Обработка клавиш
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Запуск игрового цикла
    gameLoop();
}

// Обработка нажатий клавиш
function handleKeyDown(e) {
    if (!player) return;

    switch(e.key) {
        case 'ArrowLeft':
            player.move('left');
            break;
        case 'ArrowRight':
            player.move('right');
            break;
        case 'ArrowUp':
            player.jump();
            break;
        case ' ':
            player.attack();
            break;
    }
}

function handleKeyUp(e) {
    if (!player) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        player.move('stop');
    }
}

// Обновление позиции противника
function updateOpponentPosition(data) {
    if (opponent) {
        opponent.x = data.x;
        opponent.y = data.y;
        opponent.state = data.state;
        opponent.frame = data.frame;
    }
}

// Игровой цикл
function gameLoop() {
    // Очистка канваса
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Отрисовка фона
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    // Обновление и отрисовка игроков
    if (player) {
        player.update();
        player.draw();
    }
    if (opponent) {
        opponent.update();
        opponent.draw();
    }

    // Отправка данных о движении
    if (player) {
        socket.emit('playerMovement', {
            x: player.x,
            y: player.y,
            state: player.state,
            frame: player.frame
        });
    }

    // Проверка столкновений
    checkCollisions();

    // Следующий кадр
    requestAnimationFrame(gameLoop);
}

// Проверка столкновений
function checkCollisions() {
    if (!player || !opponent) return;

    // Проверка атаки
    if (player.isAttacking) {
        const hitDistance = 50;
        if (Math.abs(player.x - opponent.x) < hitDistance) {
            opponent.health -= 10;
            if (opponent.health <= 0) {
                endMatch();
            }
        }
    }
}

// Очистка игрового состояния
function cleanupGame() {
    player = null;
    opponent = null;
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
}

// Загрузка всех ресурсов перед началом
loadImages().then(() => {
    console.log('Все ресурсы загружены');
}); 