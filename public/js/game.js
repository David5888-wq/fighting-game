const socket = io();

let currentGame = null;
let isMyTurn = false;
let selectedChecker = null;

// Инициализация игры
document.getElementById('start-game').addEventListener('click', () => {
    const username = document.getElementById('username').value.trim();
    if (username) {
        socket.emit('register', username);
        showScreen('waiting-screen');
    }
});

// Обработка списка ожидающих игроков
socket.on('updateWaitingList', (players) => {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    players.forEach(player => {
        if (player !== socket.username) {
            const li = document.createElement('li');
            li.textContent = player;
            li.addEventListener('click', () => challengePlayer(player));
            playersList.appendChild(li);
        }
    });
});

// Вызов игрока на игру
function challengePlayer(opponentUsername) {
    socket.emit('challenge', opponentUsername);
}

// Начало игры
socket.on('gameStart', (data) => {
    currentGame = data.gameId;
    isMyTurn = data.isFirst;
    document.getElementById('opponent-name').textContent = data.opponent;
    showScreen('game-screen');
    initializeBoard();
    updateTurnIndicator();
});

// Инициализация доски
function initializeBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.className = `cell ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            if ((row + col) % 2 === 1) {
                if (row < 3) {
                    cell.appendChild(createChecker('black'));
                } else if (row > 4) {
                    cell.appendChild(createChecker('white'));
                }
            }
            
            cell.addEventListener('click', () => handleCellClick(cell));
            board.appendChild(cell);
        }
    }
}

// Создание шашки
function createChecker(color) {
    const checker = document.createElement('div');
    checker.className = `checker ${color}`;
    return checker;
}

// Обработка клика по ячейке
function handleCellClick(cell) {
    if (!isMyTurn) return;
    
    const checker = cell.querySelector('.checker');
    
    if (selectedChecker) {
        if (isValidMove(selectedChecker, cell)) {
            makeMove(selectedChecker, cell);
            selectedChecker = null;
        } else {
            selectedChecker.classList.remove('selected');
            selectedChecker = null;
        }
    } else if (checker && checker.classList.contains('white')) {
        selectedChecker = checker;
        checker.classList.add('selected');
    }
}

// Проверка валидности хода
function isValidMove(checker, targetCell) {
    // Здесь должна быть логика проверки правильности хода
    // Для простоты примера разрешаем любой ход
    return true;
}

// Выполнение хода
function makeMove(checker, targetCell) {
    const move = {
        from: {
            row: parseInt(checker.parentElement.dataset.row),
            col: parseInt(checker.parentElement.dataset.col)
        },
        to: {
            row: parseInt(targetCell.dataset.row),
            col: parseInt(targetCell.dataset.col)
        }
    };
    
    socket.emit('makeMove', {
        gameId: currentGame,
        move: move
    });
    
    targetCell.appendChild(checker);
    isMyTurn = false;
    updateTurnIndicator();
}

// Обновление индикатора хода
function updateTurnIndicator() {
    document.getElementById('current-turn').textContent = isMyTurn ? 'Ваш ход' : 'Ход соперника';
}

// Обработка хода соперника
socket.on('opponentMove', (move) => {
    const fromCell = document.querySelector(`[data-row="${move.from.row}"][data-col="${move.from.col}"]`);
    const toCell = document.querySelector(`[data-row="${move.to.row}"][data-col="${move.to.col}"]`);
    const checker = fromCell.querySelector('.checker');
    
    if (checker) {
        toCell.appendChild(checker);
    }
    
    isMyTurn = true;
    updateTurnIndicator();
});

// Обработка отключения соперника
socket.on('opponentDisconnected', () => {
    alert('Соперник отключился');
    showScreen('waiting-screen');
});

// Переключение экранов
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
} 