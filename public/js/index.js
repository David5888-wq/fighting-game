// Инициализация WebSocket соединения
const ws = new WebSocket(`ws://${window.location.host}`);

// DOM элементы
const loginDiv = document.getElementById('login');
const lobbyDiv = document.getElementById('lobby');
const gameDiv = document.getElementById('game');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('joinBtn');
const playersList = document.getElementById('players');
const turnInfo = document.getElementById('turnInfo');
const rollBtn = document.getElementById('rollBtn');
const endTurnBtn = document.getElementById('endTurnBtn');
const rollsLeft = document.getElementById('rollsLeft');
const scoreTable = document.getElementById('scoreTable');
const tableBody = document.getElementById('tableBody');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverText = document.getElementById('gameOverText');
const playAgainBtn = document.getElementById('playAgainBtn');
const finalScores = document.getElementById('finalScores');

// Состояние игры
let gameState = {
    username: '',
    opponent: '',
    isMyTurn: false,
    gameId: null,
    dice: [1, 1, 1, 1, 1],
    lockedDice: [false, false, false, false, false],
    rollsLeft: 3,
    scores: {
        player1: {},
        player2: {}
    }
};

// Идентификатор текущего игрока (player1 или player2)
let myPlayerKey = null;

// Обработка подключения к серверу
ws.onopen = () => {
    console.log('Подключено к серверу');
};

// Обработка ошибок соединения
ws.onerror = (error) => {
    console.error('Ошибка WebSocket:', error);
    alert('Ошибка соединения с сервером');
};

// Обработка входа в игру
joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        gameState.username = username;
        ws.send(JSON.stringify({
            type: 'join',
            username: username
        }));
        loginDiv.style.display = 'none';
        lobbyDiv.style.display = 'block';
    } else {
        alert('Пожалуйста, введите никнейм');
    }
});

// Обработка сообщений от сервера
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
        case 'lobby':
            updateLobby(data.lobby);
            break;
        case 'start':
            startGame(data);
            break;
        case 'game':
            handleGameUpdate(data.payload);
            break;
        case 'opponent_left':
            handleOpponentLeft();
            break;
        case 'game_over':
            handleGameOver(data);
            break;
        default:
            console.warn('Неизвестный тип сообщения:', data.type);
    }
};

// Обновление списка игроков в лобби
function updateLobby(players) {
    playersList.innerHTML = '';
    const otherPlayers = players.filter(player => player !== gameState.username);

    // Безопасно ищем элемент
    const waitingMsg = document.querySelector('.waiting-message');
    if (otherPlayers.length === 0) {
        if (waitingMsg) waitingMsg.textContent = 'Ожидание игроков...';
        return;
    }

    if (waitingMsg) waitingMsg.textContent = 'Выберите соперника:';

    otherPlayers.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player;
        li.classList.add('player-item');
        li.onclick = () => invitePlayer(player);
        playersList.appendChild(li);
    });
}

// Приглашение игрока
function invitePlayer(opponent) {
    ws.send(JSON.stringify({
        type: 'invite',
        opponent: opponent
    }));
}

// Начало игры
function startGame(data) {
    gameState.opponent = data.opponent;
    gameState.gameId = data.gameId;
    gameState.isMyTurn = data.first;
    myPlayerKey = data.first ? 'player1' : 'player2';
    
    lobbyDiv.style.display = 'none';
    gameDiv.style.display = 'block';
    
    // Обновляем имена игроков
    document.getElementById('player1').textContent = gameState.username;
    document.getElementById('player2').textContent = gameState.opponent;
    document.getElementById('th1').textContent = gameState.username;
    document.getElementById('th2').textContent = gameState.opponent;
    
    // Инициализируем игру
    initializeScoreTable();
    updateTurnInfo();
    updateDice();
}

// Инициализация таблицы комбинаций
function initializeScoreTable() {
    const combinations = [
        { id: 'ones', name: 'Единицы' },
        { id: 'twos', name: 'Двойки' },
        { id: 'threes', name: 'Тройки' },
        { id: 'fours', name: 'Четверки' },
        { id: 'fives', name: 'Пятерки' },
        { id: 'sixes', name: 'Шестерки' },
        { id: 'three-of-a-kind', name: 'Тройка' },
        { id: 'four-of-a-kind', name: 'Каре' },
        { id: 'full-house', name: 'Фулл-хаус' },
        { id: 'small-straight', name: 'Малый стрит' },
        { id: 'large-straight', name: 'Большой стрит' },
        { id: 'yatzy', name: 'Ятцы' },
        { id: 'chance', name: 'Шанс' }
    ];

    tableBody.innerHTML = '';
    combinations.forEach(combo => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${combo.name}</td>
            <td class="score-cell" data-combination="${combo.id}" data-player="1"></td>
            <td class="score-cell" data-combination="${combo.id}" data-player="2"></td>
        `;
        tableBody.appendChild(row);
    });
}

// Обновление информации о ходе
function updateTurnInfo() {
    turnInfo.textContent = gameState.isMyTurn ? 'Ваш ход' : `Ход соперника (${gameState.opponent})`;
    rollBtn.disabled = !gameState.isMyTurn || gameState.rollsLeft === 0;
    endTurnBtn.disabled = !gameState.isMyTurn;
    rollsLeft.textContent = `Осталось бросков: ${gameState.rollsLeft}`;
}

// Обновление отображения кубиков
function updateDice() {
    const diceArea = document.getElementById('dice');
    diceArea.innerHTML = '';
    
    gameState.dice.forEach((value, index) => {
        const die = document.createElement('div');
        die.className = `die ${gameState.lockedDice[index] ? 'locked' : ''}`;
        die.textContent = value;
        die.dataset.index = index;
        die.onclick = () => toggleDiceLock(index);
        diceArea.appendChild(die);
    });
}

// Блокировка/разблокировка кубика
function toggleDiceLock(index) {
    if (gameState.isMyTurn && gameState.rollsLeft < 3) {
        gameState.lockedDice[index] = !gameState.lockedDice[index];
        updateDice();
    }
}

// Обработка обновлений игры
function handleGameUpdate(payload) {
    switch (payload.type) {
        case 'dice':
            gameState.dice = payload.dice;
            gameState.rollsLeft = payload.rollsLeft;
            updateDice();
            updateTurnInfo();
            break;
            
        case 'score':
            gameState.scores = payload.scores;
            updateScoreTable();
            updateTotalScores();
            break;
            
        case 'turn':
            gameState.isMyTurn = payload.isMyTurn;
            gameState.rollsLeft = 3;
            gameState.lockedDice = [false, false, false, false, false];
            updateTurnInfo();
            updateDice();
            break;
            
        default:
            console.warn('Неизвестный тип обновления игры:', payload.type);
    }
}

// Обновление таблицы очков
function updateScoreTable() {
    const cells = document.querySelectorAll('.score-cell');
    
    cells.forEach(cell => {
        const combination = cell.dataset.combination;
        const player = cell.dataset.player;
        const playerKey = player === '1' ? 'player1' : 'player2';
        const score = gameState.scores[playerKey][combination];
        
        cell.textContent = score !== undefined ? score : '';
        cell.classList.toggle('filled', score !== undefined);
        cell.classList.toggle('selectable', 
            gameState.isMyTurn && 
            score === undefined && 
            player === (myPlayerKey === 'player1' ? '1' : '2')
        );
    });
}

// Обновление общих очков
function updateTotalScores() {
    const player1Score = calculateTotalScore(gameState.scores.player1);
    const player2Score = calculateTotalScore(gameState.scores.player2);
    
    document.getElementById('score1').textContent = player1Score;
    document.getElementById('score2').textContent = player2Score;
}

// Подсчет общего количества очков
function calculateTotalScore(scores) {
    return Object.values(scores).reduce((total, score) => total + (score || 0), 0);
}

// Обработка отключения соперника
function handleOpponentLeft() {
    alert('Соперник покинул игру');
    location.reload();
}

// Обработка окончания игры
function handleGameOver(data) {
    gameOverText.textContent = data.winner === 'Ничья' ? 
        'Игра окончена! Ничья!' : 
        `Победитель: ${data.winner}!`;
    
    finalScores.innerHTML = `
        <p>${gameState.username}: ${data.player1Score} очков</p>
        <p>${gameState.opponent}: ${data.player2Score} очков</p>
    `;
    
    gameOverModal.style.display = 'flex';
}

// Обработка броска кубиков
rollBtn.addEventListener('click', () => {
    if (gameState.isMyTurn && gameState.rollsLeft > 0) {
        ws.send(JSON.stringify({
            type: 'game',
            gameId: gameState.gameId,
            payload: {
                type: 'roll',
                lockedDice: gameState.lockedDice
            }
        }));
    }
});

// Обработка завершения хода
endTurnBtn.addEventListener('click', () => {
    if (gameState.isMyTurn) {
        ws.send(JSON.stringify({
            type: 'game',
            gameId: gameState.gameId,
            payload: {
                type: 'end_turn'
            }
        }));
    }
});

// Обработка выбора комбинации
tableBody.addEventListener('click', (e) => {
    const cell = e.target.closest('.score-cell.selectable');
    if (cell && gameState.isMyTurn) {
        const combination = cell.dataset.combination;
        ws.send(JSON.stringify({
            type: 'game',
            gameId: gameState.gameId,
            payload: {
                type: 'select_combination',
                combination: combination
            }
        }));
    }
});

// Кнопка "Играть снова"
playAgainBtn.addEventListener('click', () => {
    gameOverModal.style.display = 'none';
    location.reload();
});

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    usernameInput.focus();
});