// Глобальные настройки
const debug = true; // Включено для отладки (можно изменить на false после тестирования)

/**
 * Проверка столкновений между двумя прямоугольниками
 * @param {Object} rectangle1 - Первый объект с параметрами атаки
 * @param {Object} rectangle2 - Второй объект
 * @returns {boolean} - Результат проверки столкновения
 */
function rectangularCollision({ rectangle1, rectangle2 }) {
    if (!rectangle1 || !rectangle2 || !rectangle1.attackBox || !rectangle2.position) {
        console.error('Invalid objects for collision detection:', rectangle1, rectangle2);
        return false;
    }
    return (
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x &&
        rectangle1.attackBox.position.x <= rectangle2.position.x + (rectangle2.width || 50) &&
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >= rectangle2.position.y &&
        rectangle1.attackBox.position.y <= rectangle2.position.y + (rectangle2.height || 150)
    );
}

/**
 * Определение победителя и завершение игры
 * @param {Object} player - Объект игрока
 * @param {Object} enemy - Объект противника
 * @param {number} timerId - ID таймера
 * @param {string} [reason] - Причина окончания игры
 */
function determineWinner({ player, enemy, timerId, reason }) {
    clearTimeout(timerId);
    const displayText = document.querySelector('#displayText');
    if (!displayText) {
        console.error('Display text element not found');
        return;
    }
    
    displayText.style.display = 'flex';
    displayText.innerHTML = reason || 
        (player.health === enemy.health ? 'Ничья!' :
        (player.health > enemy.health ? 'Игрок 1 Победил!' : 'Игрок 2 Победил!'));
    
    setTimeout(() => window.location.reload(), 5000);
}

/**
 * Обновление таймера с визуальными эффектами
 * @param {number} time - Оставшееся время в секундах
 */
function updateTimer(time) {
    const timerElement = document.querySelector('#timer');
    if (!timerElement) return;

    const seconds = Math.max(0, Math.floor(time));
    timerElement.innerHTML = seconds < 10 ? `0${seconds}` : seconds;
    
    // Визуальные эффекты
    timerElement.style.color = seconds <= 10 ? 'red' : 'white';
    timerElement.style.animation = seconds <= 5 ? 'pulse 0.5s infinite' : 'none';
}

/**
 * Загрузка изображения с обработкой ошибок
 * @param {string} url - Путь к изображению
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            console.log(`Image loaded: ${url}`);
            resolve(img);
        };
        img.onerror = (e) => {
            console.error(`Error loading image: ${url}`, e);
            reject(new Error(`Failed to load image: ${url}`));
        };
        img.src = url;
    });
}

/**
 * Загрузка всех спрайтов персонажа
 * @param {Object} sprites - Объект с данными спрайтов
 * @returns {Promise<boolean>}
 */
async function loadAllImages(sprites) {
    try {
        const loadPromises = Object.entries(sprites)
            .filter(([_, data]) => data.imageSrc)
            .map(([key, data]) => 
                loadImage(data.imageSrc)
                    .then(img => {
                        sprites[key].image = img; // Сохраняем загруженное изображение
                        return true;
                    })
            );

        await Promise.all(loadPromises);
        return true;
    } catch (error) {
        console.error('Image loading failed:', error);
        return false;
    }
}

/**
 * Инициализация анимации пульсации
 */
function initPulseAnimation() {
    if (document.getElementById('pulse-animation')) return;
    
    const style = document.createElement('style');
    style.id = 'pulse-animation';
    style.innerHTML = `
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
    `;
    document.head.appendChild(style);
}

// Инициализация при загрузке
initPulseAnimation();

// Экспорт
export {
    debug,
    rectangularCollision,
    determineWinner,
    updateTimer,
    loadImage,
    loadAllImages
};