const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1024;
canvas.height = 576;

// Гравитация
const gravity = 0.7;

// Загрузка изображений
const backgroundImg = new Image();
backgroundImg.src = 'img/background.png';
const shopImg = new Image();
shopImg.src = 'img/shop.png';

// Классы (упрощённо, как в classes.js)
class Sprite {
    constructor({ position, image, scale = 1, framesMax = 1, offset = { x: 0, y: 0 } }) {
        this.position = position;
        this.image = image;
        this.scale = scale;
        this.framesMax = framesMax;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 10;
        this.offset = offset;
    }
    draw() {
        ctx.drawImage(
            this.image,
            this.framesCurrent * (this.image.width / this.framesMax),
            0,
            this.image.width / this.framesMax,
            this.image.height,
            this.position.x - this.offset.x,
            this.position.y - this.offset.y,
            (this.image.width / this.framesMax) * this.scale,
            this.image.height * this.scale
        );
    }
    animateFrames() {
        this.framesElapsed++;
        if (this.framesElapsed % this.framesHold === 0) {
            if (this.framesCurrent < this.framesMax - 1) {
                this.framesCurrent++;
            } else {
                this.framesCurrent = 0;
            }
        }
    }
    update() {
        this.draw();
        this.animateFrames();
    }
}

// Магазин
const shop = new Sprite({
    position: { x: 600, y: 128 },
    image: shopImg,
    scale: 2.75,
    framesMax: 6,
    offset: { x: 0, y: 0 }
});

// Фон
const background = new Sprite({
    position: { x: 0, y: 0 },
    image: backgroundImg,
    scale: 1,
    framesMax: 1,
    offset: { x: 0, y: 0 }
});

// Персонажи (пример для двух)
let player, enemy;

function createFighters(playerCharacter, opponentCharacter) {
    // Пример: используем samuraiMack и kenji
    player = new Fighter({
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        color: 'red',
        imageSrc: 'img/samuraiMack/Idle.png',
        framesMax: 8,
        scale: 2.5,
        offset: { x: 215, y: 157 },
        sprites: {
            idle: { imageSrc: 'img/samuraiMack/Idle.png', framesMax: 8 },
            run: { imageSrc: 'img/samuraiMack/Run.png', framesMax: 8 },
            jump: { imageSrc: 'img/samuraiMack/Jump.png', framesMax: 2 },
            fall: { imageSrc: 'img/samuraiMack/Fall.png', framesMax: 2 },
            attack1: { imageSrc: 'img/samuraiMack/Attack1.png', framesMax: 6 },
            takeHit: { imageSrc: 'img/samuraiMack/Take Hit - white silhouette.png', framesMax: 4 },
            death: { imageSrc: 'img/samuraiMack/Death.png', framesMax: 6 }
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
        color: 'blue',
        imageSrc: 'img/kenji/Idle.png',
        framesMax: 4,
        scale: 2.5,
        offset: { x: 215, y: 167 },
        sprites: {
            idle: { imageSrc: 'img/kenji/Idle.png', framesMax: 4 },
            run: { imageSrc: 'img/kenji/Run.png', framesMax: 8 },
            jump: { imageSrc: 'img/kenji/Jump.png', framesMax: 2 },
            fall: { imageSrc: 'img/kenji/Fall.png', framesMax: 2 },
            attack1: { imageSrc: 'img/kenji/Attack1.png', framesMax: 4 },
            takeHit: { imageSrc: 'img/kenji/Take hit.png', framesMax: 3 },
            death: { imageSrc: 'img/kenji/Death.png', framesMax: 7 }
        },
        attackBox: {
            offset: { x: -170, y: 50 },
            width: 170,
            height: 50
        }
    });
}

// Инициализация игры
function initGame(playerCharacter, opponentCharacter) {
    createFighters(playerCharacter, opponentCharacter);
    document.getElementById('shop').style.display = 'block';
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    gameLoop();
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    background.update();
    shop.update();
    if (player) player.update();
    if (enemy) enemy.update();
    requestAnimationFrame(gameLoop);
}

function cleanupGame() {
    player = null;
    enemy = null;
    document.getElementById('shop').style.display = 'none';
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
}

function handleKeyDown(e) {
    // управление игроком и врагом (пример)
}
function handleKeyUp(e) {}

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

// Загрузка всех ресурсов перед началом
loadImages().then(() => {
    console.log('Все ресурсы загружены');
}); 