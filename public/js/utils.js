// Функция проверки столкновения прямоугольников (для атак)
function rectangularCollision({ rectangle1, rectangle2 }) {
    return (
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x &&
        rectangle1.attackBox.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >= rectangle2.position.y &&
        rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
    );
}

// Функция определения победителя (используется на клиенте)
function determineWinner({ player, enemy, timerId }) {
    clearTimeout(timerId);
    const displayText = document.querySelector('#displayText');
    displayText.style.display = 'flex';
    
    if (player.health === enemy.health) {
        displayText.innerHTML = 'Draw Game';
    } else if (player.health > enemy.health) {
        displayText.innerHTML = 'Player 1 Wins';
    } else {
        displayText.innerHTML = 'Player 2 Wins';
    }
}

// Таймер игры (перенесено в server.js, оставлено для совместимости)
let timer = 60;
let timerId;

function decreaseTimer() {
    if (timer > 0) {
        timerId = setTimeout(decreaseTimer, 1000);
        timer--;
        document.querySelector('#timer').innerHTML = timer;
    }

    if (timer === 0) {
        determineWinner({ player, enemy, timerId });
    }
}

// Вспомогательные функции для работы с клавиатурой
const keys = {
    a: { pressed: false },
    d: { pressed: false },
    w: { pressed: false },
    ArrowRight: { pressed: false },
    ArrowLeft: { pressed: false },
    ArrowUp: { pressed: false }
};

// Функция для обработки нажатий клавиш
function handleKeyDown(event) {
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
}

// Функция для обработки отпускания клавиш
function handleKeyUp(event) {
    switch (event.key) {
        case 'd':
            keys.d.pressed = false;
            break;
        case 'a':
            keys.a.pressed = false;
            break;
    }
}

// Функция для создания спрайтов персонажа
function createCharacterSprites(character) {
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

// Функция для создания атакующего бокса в зависимости от персонажа
function createAttackBox(character) {
    const isSamurai = character === 'samuraiMack';
    
    return {
        offset: {
            x: isSamurai ? 100 : -170,
            y: 50
        },
        width: isSamurai ? 160 : 170,
        height: 50
    };
}

// Функция для плавного перехода значений (интерполяция)
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

// Функция для расчета дистанции между точками
function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// Функция для проверки выхода за границы холста
function checkCanvasBounds(sprite, canvas) {
    if (sprite.position.x < 0) sprite.position.x = 0;
    if (sprite.position.x + sprite.width > canvas.width) {
        sprite.position.x = canvas.width - sprite.width;
    }
    if (sprite.position.y < 0) sprite.position.y = 0;
    if (sprite.position.y + sprite.height > canvas.height) {
        sprite.position.y = canvas.height - sprite.height;
    }
}

// Экспорт всех функций
export {
    rectangularCollision,
    determineWinner,
    decreaseTimer,
    timer,
    timerId,
    keys,
    handleKeyDown,
    handleKeyUp,
    createCharacterSprites,
    createAttackBox,
    lerp,
    distance,
    checkCanvasBounds
};