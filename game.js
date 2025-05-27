const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const playersCountElement = document.getElementById('players-count');

// Настройка размера canvas
const CELL_SIZE = 20;
const GRID_SIZE = 20;
canvas.width = CELL_SIZE * GRID_SIZE;
canvas.height = CELL_SIZE * GRID_SIZE;

// Подключение к WebSocket серверу
const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const wsUrl = wsProtocol + window.location.host;
const ws = new WebSocket(wsUrl);

let gameState = {
    players: [],
    food: []
};

// Цвета для разных игроков
const colors = [
    '#4CAF50', // Зеленый
    '#2196F3', // Синий
    '#FFC107', // Желтый
    '#F44336', // Красный
    '#9C27B0', // Фиолетовый
    '#00BCD4'  // Голубой
];

// Обработка клавиш
const keys = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right'
};

document.addEventListener('keydown', (e) => {
    const direction = keys[e.key.toLowerCase()];
    if (direction) {
        ws.send(JSON.stringify({
            type: 'direction',
            direction
        }));
    }
});

// Отрисовка игры
function draw() {
    // Очистка canvas
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Отрисовка еды
    ctx.fillStyle = '#FF0000';
    gameState.food.forEach(food => {
        ctx.beginPath();
        ctx.arc(
            food.x * CELL_SIZE + CELL_SIZE / 2,
            food.y * CELL_SIZE + CELL_SIZE / 2,
            CELL_SIZE / 2 - 2,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });

    // Отрисовка змей
    gameState.players.forEach((player, index) => {
        const color = colors[index % colors.length];
        
        // Отрисовка тела змейки
        ctx.fillStyle = color;
        player.snake.forEach((segment, i) => {
            if (i === 0) {
                // Голова змейки
                ctx.fillStyle = color;
                ctx.fillRect(
                    segment.x * CELL_SIZE,
                    segment.y * CELL_SIZE,
                    CELL_SIZE,
                    CELL_SIZE
                );
            } else {
                // Тело змейки
                ctx.fillStyle = color + '80'; // Добавляем прозрачность
                ctx.fillRect(
                    segment.x * CELL_SIZE + 1,
                    segment.y * CELL_SIZE + 1,
                    CELL_SIZE - 2,
                    CELL_SIZE - 2
                );
            }
        });
    });
}

// Обновление состояния игры
function updateGameState(newState) {
    gameState = newState;
    playersCountElement.textContent = `Игроков онлайн: ${gameState.players.length}`;
    
    // Обновление счета текущего игрока
    const myPlayer = gameState.players.find(p => p.id === myId);
    if (myPlayer) {
        scoreElement.textContent = `Счёт: ${myPlayer.score}`;
    }
}

let myId = null;

// Обработка сообщений от сервера
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (!myId && data.players) {
        myId = data.players[0]?.id;
    }
    updateGameState(data);
};

// Анимация
function gameLoop() {
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

// Обработка ошибок подключения
ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('WebSocket connection closed');
}; 