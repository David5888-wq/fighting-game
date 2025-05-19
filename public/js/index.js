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

// Обработка подключения к серверу
ws.onopen = () => {
    console.log('Подключено к серверу');
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
    }
};

// Обновление списка игроков в лобби
function updateLobby(players) {
    playersList.innerHTML = '';
    players.forEach(player => {
        if (player !== gameState.username) {
            const li = document.createElement('li');
            li.textContent = player;
            li.style.cursor = 'pointer';
            li.onclick = () => invitePlayer(player);
            playersList.appendChild(li);
        }
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
    
    lobbyDiv.style.display = 'none';
    gameDiv.style.display = 'block';
    
    // Обновляем имена игроков
    document.getElementById('player1').textContent = gameState.username;
    document.getElementById('player2').textContent = gameState.opponent;
    
    // Инициализируем таблицу комбинаций
    initializeScoreTable();
    
    // Обновляем информацию о ходе
    updateTurnInfo();
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
    turnInfo.textContent = gameState.isMyTurn ? 'Ваш ход' : 'Ход соперника';
    rollBtn.disabled = !gameState.isMyTurn || gameState.rollsLeft === 0;
    endTurnBtn.disabled = !gameState.isMyTurn;
    rollsLeft.textContent = `Осталось бросков: ${gameState.rollsLeft}`;
}

// Обработка обновлений игры
function handleGameUpdate(payload) {
    if (payload.type === 'dice') {
        gameState.dice = payload.dice;
        gameState.rollsLeft = payload.rollsLeft;
        updateDice();
        updateTurnInfo();
    } else if (payload.type === 'score') {
        gameState.scores = payload.scores;
        updateScoreTable();
    } else if (payload.type === 'turn') {
        gameState.isMyTurn = payload.isMyTurn;
        gameState.rollsLeft = 3;
        gameState.lockedDice = [false, false, false, false, false];
        updateTurnInfo();
        updateDice();
    }
}

// Обработка отключения соперника
function handleOpponentLeft() {
    alert('Соперник покинул игру');
    location.reload();
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

// Обновление отображения кубиков
function updateDice() {
    const diceArea = document.getElementById('dice');
    diceArea.innerHTML = '';
    gameState.dice.forEach((value, index) => {
        const die = document.createElement('div');
        die.className = `die ${gameState.lockedDice[index] ? 'locked' : ''}`;
        die.textContent = value;
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

// Обновление таблицы очков
function updateScoreTable() {
    const cells = document.querySelectorAll('.score-cell');
    cells.forEach(cell => {
        const combination = cell.dataset.combination;
        const player = cell.dataset.player;
        const score = gameState.scores[`player${player}`][combination];
        cell.textContent = score !== undefined ? score : '';
        cell.className = `score-cell ${score !== undefined ? 'filled' : ''}`;
    });
}