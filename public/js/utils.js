// Глобальные настройки
const debug = false; // Режим отладки (отображение хитбоксов)

/**
 * Проверка столкновений между двумя прямоугольниками
 * @param {Object} rectangle1 - Первый объект с параметрами атаки
 * @param {Object} rectangle2 - Второй объект
 * @returns {boolean} - Результат проверки столкновения
 */
function rectangularCollision({ rectangle1, rectangle2 }) {
    return (
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x &&
        rectangle1.attackBox.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >= rectangle2.position.y &&
        rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
    );
}

/**
 * Определение победителя и завершение игры
 * @param {Object} player - Объект игрока
 * @param {Object} enemy - Объект противника
 * @param {number} timerId - ID таймера
 * @param {string} [reason] - Причина окончания игры (опционально)
 */
function determineWinner({ player, enemy, timerId, reason }) {
    clearTimeout(timerId);
    const displayText = document.querySelector('#displayText');
    displayText.style.display = 'flex';
    
    if (reason) {
        displayText.innerHTML = reason;
    } else if (player.health === enemy.health) {
        displayText.innerHTML = 'Ничья!';
    } else if (player.health > enemy.health) {
        displayText.innerHTML = 'Игрок 1 Победил!';
    } else {
        displayText.innerHTML = 'Игрок 2 Победил!';
    }
    
    setTimeout(() => {
        window.location.reload();
    }, 5000);
}

/**
 * Обновление отображения таймера
 * @param {number} time - Оставшееся время в секундах
 */
function updateTimer(time) {
    const timerElement = document.querySelector('#timer');
    const seconds = Math.floor(time);
    timerElement.innerHTML = seconds < 10 ? `0${seconds}` : seconds;
    
    // Изменение цвета при малом времени
    if (seconds <= 10) {
        timerElement.style.color = 'red';
        timerElement.style.animation = seconds <= 5 ? 'pulse 0.5s infinite' : 'none';
    } else {
        timerElement.style.color = 'white';
        timerElement.style.animation = 'none';
    }
}

/**
 * Загрузка изображения
 * @param {string} url - URL изображения
 * @returns {Promise<HTMLImageElement>} - Промис с загруженным изображением
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Ошибка загрузки изображения ${url}: ${err}`));
    });
}

/**
 * Загрузка всех изображений для спрайтов
 * @param {Object} sprites - Объект с данными спрайтов
 * @returns {Promise<boolean>} - Промис, разрешающийся при загрузке всех изображений
 */
async function loadAllImages(sprites) {
    try {
        const loadPromises = [];
        
        for (const sprite in sprites) {
            if (sprites[sprite].imageSrc) {
                loadPromises.push(
                    loadImage(sprites[sprite].imageSrc)
                        .then(img => {
                            sprites[sprite].image = img; // Сохраняем загруженное изображение
                            return img;
                        })
                );
            }
        }
        
        await Promise.all(loadPromises);
        return true;
    } catch (error) {
        console.error('Ошибка загрузки изображений:', error);
        return false;
    }
}

/**
 * Создание анимации пульсации (для таймера)
 */
function createPulseAnimation() {
    if (document.querySelector('style#pulse-animation')) return;
    
    const style = document.createElement('style');
    style.id = 'pulse-animation';
    style.innerHTML = `
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
}

// Инициализация анимации при загрузке
createPulseAnimation();

// Экспорт функций и переменных
export {
    rectangularCollision,
    determineWinner,
    updateTimer,
    loadImage,
    loadAllImages,
    debug
};