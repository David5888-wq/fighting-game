// Game constants
const TANK_SPEED = 5;
const BULLET_SPEED = 10;
const RELOAD_TIME = 1000;
const MAX_HEALTH = 100;
const TANK_SIZE = 30;

// Game state
let gameState = {
    players: [],
    obstacles: [],
    bullets: [],
    localPlayer: null,
    enemyPlayer: null
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game assets
const tankImage = new Image();
tankImage.src = 'data:image/svg+xml,' + encodeURIComponent(`
    <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="8" width="20" height="14" fill="#3498db"/>
        <rect x="12" y="4" width="6" height="22" fill="#2980b9"/>
        <rect x="13" y="0" width="4" height="30" fill="#2980b9"/>
    </svg>
`);

// WebSocket connection
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

// Input state
const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    space: false
};

// Event listeners
window.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 's': keys.s = true; break;
        case 'a': keys.a = true; break;
        case 'd': keys.d = true; break;
        case ' ': keys.space = true; break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 's': keys.s = false; break;
        case 'a': keys.a = false; break;
        case 'd': keys.d = false; break;
        case ' ': keys.space = false; break;
    }
});

// WebSocket message handling
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch(message.type) {
        case 'waiting':
            updateStatus(message.message);
            break;
            
        case 'gameStart':
            gameState.players = message.gameState.players;
            gameState.obstacles = message.gameState.obstacles;
            gameState.localPlayer = gameState.players[0];
            gameState.enemyPlayer = gameState.players[1];
            updateStatus('Игра началась!');
            break;
            
        case 'updatePosition':
            const player = gameState.players.find(p => p.id === message.playerId);
            if (player) {
                player.tank.x = message.x;
                player.tank.y = message.y;
                player.tank.angle = message.angle;
            }
            break;
            
        case 'newBullet':
            gameState.bullets.push(message.bullet);
            break;
            
        case 'hit':
            if (message.targetId === ws.id) {
                gameState.localPlayer.tank.health = message.health;
                updateHealthBars();
            } else {
                gameState.enemyPlayer.tank.health = message.health;
                updateHealthBars();
            }
            break;
            
        case 'gameOver':
            const winner = message.winnerId === ws.id ? 'Вы победили!' : 'Вы проиграли!';
            updateStatus(winner);
            break;
    }
};

// Game rendering
function render() {
    // Clear canvas
    ctx.fillStyle = '#1a2634';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw obstacles
    ctx.fillStyle = '#34495e';
    gameState.obstacles.forEach(obstacle => {
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });
    
    // Draw tanks
    gameState.players.forEach(player => {
        const tank = player.tank;
        ctx.save();
        ctx.translate(tank.x, tank.y);
        ctx.rotate(tank.angle);
        ctx.drawImage(tankImage, -TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);
        ctx.restore();
    });
    
    // Draw bullets
    ctx.fillStyle = '#e74c3c';
    gameState.bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Game update
function update() {
    if (!gameState.localPlayer) return;
    
    const tank = gameState.localPlayer.tank;
    let moved = false;
    
    // Tank movement
    if (keys.w) {
        tank.x += Math.cos(tank.angle) * TANK_SPEED;
        tank.y += Math.sin(tank.angle) * TANK_SPEED;
        moved = true;
    }
    if (keys.s) {
        tank.x -= Math.cos(tank.angle) * TANK_SPEED;
        tank.y -= Math.sin(tank.angle) * TANK_SPEED;
        moved = true;
    }
    if (keys.a) {
        tank.angle -= 0.05;
        moved = true;
    }
    if (keys.d) {
        tank.angle += 0.05;
        moved = true;
    }
    
    // Keep tank in bounds
    tank.x = Math.max(TANK_SIZE/2, Math.min(canvas.width - TANK_SIZE/2, tank.x));
    tank.y = Math.max(TANK_SIZE/2, Math.min(canvas.height - TANK_SIZE/2, tank.y));
    
    // Send position update if moved
    if (moved) {
        ws.send(JSON.stringify({
            type: 'move',
            x: tank.x,
            y: tank.y,
            angle: tank.angle
        }));
    }
    
    // Shooting
    if (keys.space && Date.now() - tank.lastShot >= RELOAD_TIME) {
        tank.lastShot = Date.now();
        ws.send(JSON.stringify({
            type: 'shoot',
            x: tank.x + Math.cos(tank.angle) * TANK_SIZE,
            y: tank.y + Math.sin(tank.angle) * TANK_SIZE,
            angle: tank.angle
        }));
    }
}

// UI updates
function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

function updateHealthBars() {
    if (!gameState.localPlayer || !gameState.enemyPlayer) return;
    
    const playerHealthBar = document.querySelector('#playerHealth > div');
    const enemyHealthBar = document.querySelector('#enemyHealth > div');
    const playerHealthText = document.querySelector('#playerHealth > span');
    const enemyHealthText = document.querySelector('#enemyHealth > span');
    
    const playerHealth = (gameState.localPlayer.tank.health / MAX_HEALTH) * 100;
    const enemyHealth = (gameState.enemyPlayer.tank.health / MAX_HEALTH) * 100;
    
    playerHealthBar.style.width = `${playerHealth}%`;
    enemyHealthBar.style.width = `${enemyHealth}%`;
    playerHealthText.textContent = `${Math.round(playerHealth)}%`;
    enemyHealthText.textContent = `${Math.round(enemyHealth)}%`;
}

// Game loop
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop();

// WebSocket connection status
ws.onopen = () => {
    updateStatus('Подключено к серверу');
};

ws.onclose = () => {
    updateStatus('Соединение потеряно');
};

ws.onerror = () => {
    updateStatus('Ошибка соединения');
};