'use strict';

/**
 * Функция проверки столкновений между прямоугольниками
 * @param {Object} rectangle1 - Первый прямоугольник с attackBox
 * @param {Object} rectangle2 - Второй прямоугольник с position и размерами
 * @returns {boolean} - Есть ли столкновение
 */
export function rectangularCollision({ rectangle1, rectangle2 }) {
    if (!rectangle1 || !rectangle2 || !rectangle1.attackBox || !rectangle2.position) {
        console.error('Invalid rectangle objects in collision check');
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
 * @param {Object} param0 - Параметры игроков и таймера
 */
export function determineWinner({ player, enemy, timerId }) {
    clearTimeout(timerId);
    
    const displayText = document.querySelector('#displayText');
    if (!displayText) {
        console.error('Display text element not found');
        return;
    }
    
    displayText.style.display = 'flex';
    
    if (player.health === enemy.health) {
        displayText.textContent = 'Ничья';
    } else if (player.health > enemy.health) {
        displayText.textContent = 'Игрок 1 Победил';
    } else {
        displayText.textContent = 'Игрок 2 Победил';
    }
    
    setTimeout(() => {
        window.location.reload();
    }, 5000);
}

/**
 * Обновление таймера игры
 * @param {number} time - Оставшееся время
 */
export function updateTimer(time) {
    const timerElement = document.querySelector('#timer');
    if (!timerElement) {
        console.error('Timer element not found');
        return;
    }
    
    timerElement.textContent = Math.max(0, Math.floor(time));
}

/**
 * Загрузка изображения с Promise
 * @param {string} url - Путь к изображению
 * @returns {Promise<HTMLImageElement>} - Загруженное изображение
 */
export function loadImage(url) {
    if (!url || typeof url !== 'string') {
        return Promise.reject(new Error('Invalid image URL'));
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        
        img.onload = () => {
            if (img.complete && img.naturalWidth > 0) {
                resolve(img);
            } else {
                reject(new Error('Image failed to load'));
            }
        };
        
        img.onerror = () => {
            reject(new Error(`Failed to load image from ${url}`));
        };
    });
}

/**
 * Загрузка всех изображений для спрайтов
 * @param {Object} sprites - Объект с данными спрайтов
 * @returns {Promise<boolean>} - Все изображения загружены
 */
export async function loadAllImages(sprites) {
    if (!sprites || typeof sprites !== 'object') {
        throw new Error('Invalid sprites object');
    }

    try {
        const loadPromises = [];
        
        for (const sprite in sprites) {
            if (sprites[sprite]?.imageSrc) {
                loadPromises.push(loadImage(sprites[sprite].imageSrc));
            }
        }
        
        await Promise.all(loadPromises);
        return true;
    } catch (error) {
        console.error('Error loading sprites:', error);
        throw error;
    }
}

/**
 * Создание анимационного цикла с deltaTime
 * @param {Function} callback - Функция для вызова в каждом кадре
 * @returns {Function} - Функция запуска анимации
 */
export function createAnimationLoop(callback) {
    let lastTime = 0;
    let animationFrameId = null;
    
    const frame = (currentTime) => {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        if (callback(deltaTime) {
            animationFrameId = requestAnimationFrame(frame);
        }
    };
    
    return {
        start: () => {
            if (!animationFrameId) {
                lastTime = performance.now();
                animationFrameId = requestAnimationFrame(frame);
            }
        },
        stop: () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }
    };
}

/**
 * Плавное изменение значения с течением времени
 * @param {number} start - Начальное значение
 * @param {number} end - Конечное значение
 * @param {number} duration - Длительность анимации (мс)
 * @param {Function} updateCallback - Колбек обновления значения
 * @param {Function} [completeCallback] - Колбек завершения анимации
 * @returns {Object} - Объект с методами управления анимацией
 */
export function animateValue(start, end, duration, updateCallback, completeCallback) {
    let startTime = null;
    let animationFrameId = null;
    
    const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const value = start + (end - start) * progress;
        
        updateCallback(value);
        
        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else if (completeCallback) {
            completeCallback();
        }
    };
    
    return {
        start: () => {
            if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(animate);
            }
        },
        stop: () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        }
    };
}

/**
 * Генерация случайного числа в диапазоне
 * @param {number} min - Минимальное значение
 * @param {number} max - Максимальное значение
 * @returns {number} - Случайное число
 */
export function randomInRange(min, max) {
    if (typeof min !== 'number' || typeof max !== 'number') {
        throw new Error('Invalid arguments for randomInRange');
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Ограничение значения в заданном диапазоне
 * @param {number} value - Исходное значение
 * @param {number} min - Минимальное значение
 * @param {number} max - Максимальное значение
 * @returns {number} - Ограниченное значение
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Полифиллы для старых браузеров
(function() {
    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = window.webkitRequestAnimationFrame || 
                                     window.mozRequestAnimationFrame || 
                                     window.msRequestAnimationFrame || 
                                     function(callback) {
                                        return window.setTimeout(callback, 1000/60);
                                     };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = window.webkitCancelAnimationFrame || 
                                     window.mozCancelAnimationFrame || 
                                     window.msCancelAnimationFrame || 
                                     function(id) {
                                        clearTimeout(id);
                                     };
    }
})();
