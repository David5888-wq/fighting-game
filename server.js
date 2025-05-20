const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Состояние сервера
const waitingPlayers = [];
const activeGames = {};

// Middleware
app.use(express.static(path.join(__dirname, 'public')));

// Функции для подсчета очков
const calculateScore = (dice, combination) => {
    const counts = new Array(7).fill(0);
    dice.forEach(die => counts[die]++);

    switch (combination) {
        case 'ones': return counts[1] * 1;
        case 'twos': return counts[2] * 2;
        case 'threes': return counts[3] * 3;
        case 'fours': return counts[4] * 4;
        case 'fives': return counts[5] * 5;
        case 'sixes': return counts[6] * 6;
        case 'three-of-a-kind':
            return counts.some(count => count >= 3) ? dice.reduce((a, b) => a + b, 0) : 0;
        case 'four-of-a-kind':
            return counts.some(count => count >= 4) ? dice.reduce((a, b) => a + b, 0) : 0;
        case 'full-house':
            return counts.some(count => count === 3) && counts.some(count => count === 2) ? 25 : 0;
        case 'small-straight':
            return (counts.slice(1, 5).every(count => count >= 1) || 
                   counts.slice(2, 6).every(count => count >= 1) || 
                   counts.slice(3, 7).every(count => count >= 1)) ? 30 : 0;
        case 'large-straight':
            return (counts.slice(1, 6).every(count => count === 1) || 
                   counts.slice(2, 7).every(count => count === 1)) ? 40 : 0;
        case 'yatzy':
            return counts.some(count => count === 5) ? 50 : 0;
        case 'chance':
            return dice.reduce((a, b) => a + b, 0);
        default:
            return 0;
    }
};

// Обработка WebSocket соединений
wss.on('connection', (ws) => {
    console.log('Новое подключение');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Ошибка парсинга сообщения:', error);
        }
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket ошибка:', error);
    });
});

// Обработчик сообщений
function handleMessage(ws, data) {
    switch (data.type) {
        case 'join':
            handleJoin(ws, data);
            break;
        case 'invite':
            handleInvite(ws, data);
            break;
        case 'game':
            handleGameAction(ws, data);
            break;
        default:
            console.warn('Неизвестный тип сообщения:', data.type);
    }
}

// Обработчик подключения игрока
function handleJoin(ws, data) {
    if (!data.username || waitingPlayers.some(p => p.username === data.username)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Неверный ник или ник уже занят'
        }));
        return;
    }

    ws.username = data.username;
    ws.isPlaying = false;
    waitingPlayers.push(ws);
    broadcastLobby();
}

// Обработчик приглашения в игру
function handleInvite(ws, data) {
    const opponent = waitingPlayers.find(p => p.username === data.opponent && p !== ws);
    
    if (!opponent) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Игрок не найден или уже в игре'
        }));
        return;
    }

    const gameId = generateGameId();
    activeGames[gameId] = createNewGame(ws, opponent);
    
    // Обновляем статусы игроков
    ws.isPlaying = true;
    opponent.isPlaying = true;
    ws.gameId = gameId;
    opponent.gameId = gameId;
    
    // Удаляем игроков из лобби
    waitingPlayers = waitingPlayers.filter(p => p !== ws && p !== opponent);
    
    // Отправляем подтверждение игрокам
    ws.send(JSON.stringify({
        type: 'start',
        opponent: opponent.username,
        first: true,
        gameId
    }));
    
    opponent.send(JSON.stringify({
        type: 'start',
        opponent: ws.username,
        first: false,
        gameId
    }));
    
    broadcastLobby();
}

// Обработчик игровых действий
function handleGameAction(ws, data) {
    const game = activeGames[data.gameId];
    if (!game) return;

    const payload = data.payload;
    
    switch (payload.type) {
        case 'roll':
            handleRoll(game, payload);
            break;
        case 'end_turn':
            handleEndTurn(game);
            break;
        case 'select_combination':
            handleSelectCombination(game, ws, payload);
            break;
        default:
            console.warn('Неизвестный тип игрового действия:', payload.type);
    }
}

// Обработчик броска кубиков
function handleRoll(game, payload) {
    if (game.rollsLeft <= 0) return;
    
    // Бросаем только незаблокированные кубики
    game.dice = game.dice.map((die, index) => 
        payload.lockedDice[index] ? die : Math.floor(Math.random() * 6) + 1
    );
    
    game.rollsLeft--;
    
    // Отправляем обновление обоим игрокам
    broadcastGameUpdate(game, {
        type: 'dice',
        dice: game.dice,
        rollsLeft: game.rollsLeft
    });
}

// Обработчик завершения хода
function handleEndTurn(game) {
    // Меняем текущего игрока
    game.currentPlayer = game.players.find(p => p !== game.currentPlayer);
    game.rollsLeft = 3;
    game.dice = [1, 1, 1, 1, 1];
    
    broadcastGameUpdate(game, {
        type: 'turn',
        isMyTurn: (player) => player === game.currentPlayer
    });
}

// Обработчик выбора комбинации
function handleSelectCombination(game, ws, payload) {
    const playerIndex = game.players.indexOf(ws);
    const playerKey = playerIndex === 0 ? 'player1' : 'player2';
    
    // Проверяем, что комбинация еще не выбрана
    if (game.scores[playerKey][payload.combination] !== undefined) return;
    
    const score = calculateScore(game.dice, payload.combination);
    game.scores[playerKey][payload.combination] = score;
    
    // Отправляем обновление очков
    broadcastGameUpdate(game, {
        type: 'score',
        scores: game.scores
    });
    
    // Передаем ход другому игроку
    game.currentPlayer = game.players.find(p => p !== ws);
    game.rollsLeft = 3;
    game.dice = [1, 1, 1, 1, 1];
    
    broadcastGameUpdate(game, {
        type: 'turn',
        isMyTurn: (player) => player === game.currentPlayer
    });
    
    // Проверяем конец игры
    checkGameOver(game);
}

// Проверка окончания игры
function checkGameOver(game) {
    const allCombinations = [
        'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
        'three-of-a-kind', 'four-of-a-kind', 'full-house',
        'small-straight', 'large-straight', 'yatzy', 'chance'
    ];
    
    const gameOver = allCombinations.every(combination =>
        game.scores.player1[combination] !== undefined &&
        game.scores.player2[combination] !== undefined
    );
    
    if (gameOver) {
        const player1Score = calculateTotalScore(game.scores.player1);
        const player2Score = calculateTotalScore(game.scores.player2);
        
        const winner = player1Score > player2Score ? game.players[0].username :
                     player1Score < player2Score ? game.players[1].username : 'Ничья';
        
        // Отправляем результаты игры
        game.players.forEach(player => {
            if (player.readyState === WebSocket.OPEN) {
                player.send(JSON.stringify({
                    type: 'game_over',
                    winner,
                    player1Score,
                    player2Score
                }));
            }
        });
        
        // Удаляем игру
        delete activeGames[game.gameId];
    }
}

// Обработчик отключения игрока
function handleDisconnect(ws) {
    // Удаляем из лобби
    waitingPlayers = waitingPlayers.filter(p => p !== ws);
    
    // Обрабатываем отключение из активной игры
    if (ws.gameId && activeGames[ws.gameId]) {
        const game = activeGames[ws.gameId];
        
        // Уведомляем соперника
        game.players.forEach(player => {
            if (player !== ws && player.readyState === WebSocket.OPEN) {
                player.send(JSON.stringify({ 
                    type: 'opponent_left' 
                }));
            }
        });
        
        // Удаляем игру
        delete activeGames[ws.gameId];
    }
    
    broadcastLobby();
}

// Вспомогательные функции
function broadcastLobby() {
    const lobby = waitingPlayers
        .filter(p => !p.isPlaying && p.readyState === WebSocket.OPEN)
        .map(p => p.username);
    
    waitingPlayers.forEach(player => {
        if (player.readyState === WebSocket.OPEN) {
            player.send(JSON.stringify({ 
                type: 'lobby', 
                lobby 
            }));
        }
    });
}

function broadcastGameUpdate(game, payload) {
    game.players.forEach(player => {
        if (player.readyState === WebSocket.OPEN) {
            const customPayload = typeof payload.isMyTurn === 'function' 
                ? { ...payload, isMyTurn: payload.isMyTurn(player) }
                : payload;
                
            player.send(JSON.stringify({
                type: 'game',
                payload: customPayload
            }));
        }
    });
}

function createNewGame(player1, player2) {
    return {
        players: [player1, player2],
        currentPlayer: player1,
        dice: [1, 1, 1, 1, 1],
        rollsLeft: 3,
        scores: {
            player1: {},
            player2: {}
        },
        gameId: generateGameId()
    };
}

function generateGameId() {
    return Math.random().toString(36).substr(2, 9);
}

function calculateTotalScore(scores) {
    return Object.values(scores).reduce((total, score) => total + (score || 0), 0);
}

// Запуск сервера
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});