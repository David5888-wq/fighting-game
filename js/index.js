let ws;
let username;
let gameId;
let isMyTurn = false;
let lockedDice = [false, false, false, false, false];

// Инициализация WebSocket соединения
function initWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };
    
    ws.onclose = () => {
        showError('Соединение с сервером потеряно');
        setTimeout(initWebSocket, 1000);
    };
}

// Обработка сообщений от сервера
function handleServerMessage(data) {
    switch (data.type) {
        case 'error':
            showError(data.message);
            break;
        case 'lobby':
            updatePlayersList(data.players);
            break;
        case 'start':
            startGame(data);
            break;
        case 'dice':
            updateDiceDisplay(data.dice, lockedDice);
            updateRollsLeft(data.rollsLeft);
            break;
        case 'turn':
            isMyTurn = data.isMyTurn;
            showMessage(isMyTurn ? 'Ваш ход' : 'Ход соперника');
            updateControls();
            break;
        case 'score':
            updateScoreTable(data.scores, username, data.opponent);
            break;
        case 'gameOver':
            showGameOver(data.winner, data.scores);
            break;
    }
}

// Начало игры
function startGame(data) {
    gameId = data.gameId;
    showGame();
    updatePlayerNames(username, data.opponent);
    isMyTurn = data.first;
    showMessage(isMyTurn ? 'Ваш ход' : 'Ход соперника');
    updateControls();
}

// Обновление состояния элементов управления
function updateControls() {
    const rollBtn = document.getElementById('rollBtn');
    const endTurnBtn = document.getElementById('endTurnBtn');
    
    rollBtn.disabled = !isMyTurn;
    endTurnBtn.disabled = !isMyTurn;
}

// Приглашение игрока
function invitePlayer(opponent) {
    ws.send(JSON.stringify({
        type: 'invite',
        opponent: opponent
    }));
}

// Бросок кубиков
function rollDice() {
    ws.send(JSON.stringify({
        type: 'game',
        gameId: gameId,
        payload: {
            type: 'roll',
            lockedDice: lockedDice
        }
    }));
}

// Завершение хода
function endTurn() {
    ws.send(JSON.stringify({
        type: 'game',
        gameId: gameId,
        payload: {
            type: 'end_turn'
        }
    }));
    lockedDice = [false, false, false, false, false];
}

// Выбор комбинации
function selectCombination(combination) {
    ws.send(JSON.stringify({
        type: 'game',
        gameId: gameId,
        payload: {
            type: 'select_combination',
            combination: combination
        }
    }));
    lockedDice = [false, false, false, false, false];
}

// Блокировка/разблокировка кубика
function toggleDie(index) {
    if (!isMyTurn) return;
    lockedDice[index] = !lockedDice[index];
    const dice = Array.from(document.getElementById('dice').children);
    dice[index].classList.toggle('locked');
}

// Играть снова
function playAgain() {
    hideGameOver();
    showLobby();
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    
    // Обработчик входа
    document.getElementById('joinBtn').addEventListener('click', () => {
        username = document.getElementById('username').value.trim();
        if (username) {
            ws.send(JSON.stringify({
                type: 'join',
                username: username
            }));
            showLobby();
        }
    });
    
    // Обработчики игровых кнопок
    document.getElementById('rollBtn').addEventListener('click', rollDice);
    document.getElementById('endTurnBtn').addEventListener('click', endTurn);
    document.getElementById('playAgainBtn').addEventListener('click', playAgain);
    
    // Обработчик клика по кубикам
    document.getElementById('dice').addEventListener('click', (e) => {
        const die = e.target.closest('.die');
        if (die) {
            toggleDie(parseInt(die.dataset.index));
        }
    });
    
    // Обработчик клика по таблице комбинаций
    document.getElementById('tableBody').addEventListener('click', (e) => {
        const cell = e.target.closest('td');
        if (cell && cell.parentElement) {
            const row = cell.parentElement;
            const combination = Object.keys(COMBINATIONS)[row.rowIndex];
            if (combination && isMyTurn) {
                selectCombination(combination);
            }
        }
    });
}); 