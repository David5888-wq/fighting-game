const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const wsUrl = wsProtocol + window.location.host;
const ws = new WebSocket(wsUrl);

const statusEl = document.getElementById('status');
const playerBoard = document.getElementById('playerBoard');
const opponentBoard = document.getElementById('opponentBoard');

let myPlayerNumber = null;
let gameActive = false;
let myBoard = [];
let opponentBoardState = [];

// Инициализация игровых полей
function initializeBoards() {
    // Создаем клетки для обоих полей
    for (let i = 0; i < 100; i++) {
        const playerCell = document.createElement('div');
        playerCell.className = 'cell';
        playerCell.dataset.index = i;
        playerBoard.appendChild(playerCell);

        const opponentCell = document.createElement('div');
        opponentCell.className = 'cell';
        opponentCell.dataset.index = i;
        opponentCell.addEventListener('click', () => makeMove(i));
        opponentBoard.appendChild(opponentCell);
    }
}

// Генерация случайного расположения кораблей
function generateShips() {
    const ships = [
        { size: 4, count: 1 }, // 1 четырехпалубный
        { size: 3, count: 2 }, // 2 трехпалубных
        { size: 2, count: 3 }, // 3 двухпалубных
        { size: 1, count: 4 }  // 4 однопалубных
    ];

    const board = Array(100).fill(0);
    
    ships.forEach(shipType => {
        for (let i = 0; i < shipType.count; i++) {
            placeShip(board, shipType.size);
        }
    });

    return board;
}

function placeShip(board, size) {
    while (true) {
        const isHorizontal = Math.random() < 0.5;
        const startPos = Math.floor(Math.random() * 100);
        
        if (canPlaceShip(board, startPos, size, isHorizontal)) {
            for (let i = 0; i < size; i++) {
                const pos = isHorizontal ? startPos + i : startPos + (i * 10);
                board[pos] = 1;
            }
            break;
        }
    }
}

function canPlaceShip(board, startPos, size, isHorizontal) {
    const row = Math.floor(startPos / 10);
    const col = startPos % 10;

    if (isHorizontal) {
        if (col + size > 10) return false;
        for (let i = 0; i < size; i++) {
            if (board[startPos + i] === 1) return false;
        }
    } else {
        if (row + size > 10) return false;
        for (let i = 0; i < size; i++) {
            if (board[startPos + (i * 10)] === 1) return false;
        }
    }
    return true;
}

function updateBoard(board, boardElement, showShips = false) {
    const cells = boardElement.children;
    for (let i = 0; i < 100; i++) {
        cells[i].className = 'cell';
        if (board[i] === 1 && showShips) {
            cells[i].classList.add('ship');
        } else if (board[i] === 2) {
            cells[i].classList.add('hit');
        } else if (board[i] === 3) {
            cells[i].classList.add('miss');
        }
    }
}

function makeMove(index) {
    if (!gameActive || myPlayerNumber === null) return;
    
    ws.send(JSON.stringify({
        type: 'move',
        position: index,
        playerNumber: myPlayerNumber
    }));
}

ws.onopen = () => {
    statusEl.textContent = 'Подключено. Ожидаем другого игрока...';
    initializeBoards();
};

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    
    switch (msg.type) {
        case 'start':
            myPlayerNumber = msg.playerNumber;
            myBoard = generateShips();
            opponentBoardState = Array(100).fill(0);
            updateBoard(myBoard, playerBoard, true);
            updateBoard(opponentBoardState, opponentBoard);
            gameActive = true;
            statusEl.textContent = `Вы игрок ${myPlayerNumber}. ${msg.message}`;
            break;

        case 'move':
            if (msg.playerNumber !== myPlayerNumber) {
                const hit = myBoard[msg.position] === 1;
                myBoard[msg.position] = hit ? 2 : 3;
                updateBoard(myBoard, playerBoard, true);
            }
            break;

        case 'result':
            opponentBoardState[msg.position] = msg.hit ? 2 : 3;
            updateBoard(opponentBoardState, opponentBoard);
            statusEl.textContent = msg.message;
            break;

        case 'gameover':
            gameActive = false;
            statusEl.textContent = msg.message;
            break;

        case 'reset':
            myBoard = generateShips();
            opponentBoardState = Array(100).fill(0);
            updateBoard(myBoard, playerBoard, true);
            updateBoard(opponentBoardState, opponentBoard);
            gameActive = true;
            statusEl.textContent = `Новая игра! Вы игрок ${myPlayerNumber}`;
            break;

        case 'message':
            statusEl.textContent = msg.message;
            break;
    }
};

ws.onclose = () => {
    statusEl.textContent = 'Соединение с сервером потеряно.';
    gameActive = false;
}; 