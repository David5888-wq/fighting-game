// Функция проверки столкновений
function rectangularCollision({ rectangle1, rectangle2 }) {
    return (
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x &&
        rectangle1.attackBox.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >= rectangle2.position.y &&
        rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
    );
}

// Определение победителя
function determineWinner({ player, enemy, timerId }) {
    clearTimeout(timerId);
    const displayText = document.querySelector('#displayText');
    displayText.style.display = 'flex';
    
    if (player.health === enemy.health) {
        displayText.innerHTML = 'Ничья';
    } else if (player.health > enemy.health) {
        displayText.innerHTML = 'Игрок 1 Победил';
    } else {
        displayText.innerHTML = 'Игрок 2 Победил';
    }
    
    // Автоматический рестарт через 5 секунд
    setTimeout(() => {
        window.location.reload();
    }, 5000);
}

// Таймер игры
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

// Вспомогательная функция для загрузки изображений
function loadImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
    });
}

// Функция для ожидания загрузки всех изображений
async function loadAllImages(sprites) {
    const loadPromises = [];
    
    for (const sprite in sprites) {
        loadPromises.push(loadImage(sprites[sprite].imageSrc));
    }
    
    await Promise.all(loadPromises);
    return true;
}