let ws;
let myName = "";
let opponentName = "";
let gameId = "";
let gameState = null;

const loginDiv = document.getElementById('login');
const lobbyDiv = document.getElementById('lobby');
const gameDiv = document.getElementById('game');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('username');
const playersList = document.getElementById('players');
const player1Span = document.getElementById('player1');
const player2Span = document.getElementById('player2');
const score1Span = document.getElementById('score1');
const score2Span = document.getElementById('score2');
const th1 = document.getElementById('th1');
const th2 = document.getElementById('th2');
const tableBody = document.getElementById('tableBody');
const diceDiv = document.getElementById('dice');
const locksDiv = document.getElementById('locks');
const rollBtn = document.getElementById('rollBtn');
const endTurnBtn = document.getElementById('endTurnBtn');
const rollsLeftSpan = document.getElementById('rollsLeft');
const turnInfo = document.getElementById('turnInfo');

joinBtn.onclick = () => {
    myName = usernameInput.value.trim();
    if (!myName) return;
    ws = new WebSocket(`ws://${location.host}`);
    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', username: myName }));
        loginDiv.style.display = 'none';
        lobbyDiv.style.display = '';
    };
    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.type === 'lobby') {
            updateLobby(data.lobby);
        }
        if (data.type === 'start') {
            opponentName = data.opponent;
            gameId = data.gameId;
            startGame(data.first);
        }
        if (data.type === 'game') {
            handleGameMessage(data.payload);
        }
        if (data.type === 'opponent_left') {
            alert('Соперник покинул игру!');
            location.reload();
        }
    };
};

function updateLobby(lobby) {
    playersList.innerHTML = '';
    lobby.filter(name => name !== myName).forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        li.onclick = () => {
            ws.send(JSON.stringify({ type: 'invite', opponent: name }));
        };
        playersList.appendChild(li);
    });
}

function startGame(isFirst) {
    lobbyDiv.style.display = 'none';
    gameDiv.style.display = '';
    gameState = new GameState(myName, opponentName, myName);
    if (!isFirst) gameState.turn = 1;
    render();
}

function handleGameMessage(payload) {
    Object.assign(gameState, payload);
    render();
}

function sendGameState() {
    ws.send(JSON.stringify({ type: 'game', gameId, payload: gameState }));
}

function render() {
    player1Span.textContent = gameState.players[0].name;
    player2Span.textContent = gameState.players[1].name;
    th1.textContent = gameState.players[0].name;
    th2.textContent = gameState.players[1].name;
    score1Span.textContent = gameState.players[0].total;
    score2Span.textContent = gameState.players[1].total;
    rollsLeftSpan.textContent = `Осталось бросков: ${gameState.rollsLeft}`;
    turnInfo.textContent = `Ходит: ${gameState.players[gameState.turn].name}`;
    renderDice();
    renderTable();
    rollBtn.disabled = gameState.turn !== gameState.myIndex || gameState.rollsLeft === 0;
    endTurnBtn.disabled = gameState.turn !== gameState.myIndex || gameState.rollsLeft === 3;
}

function renderDice() {
    diceDiv.innerHTML = '';
    locksDiv.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const die = document.createElement('span');
        die.className = 'die';
        die.textContent = gameState.dice[i];
        diceDiv.appendChild(die);

        const lockBtn = document.createElement('button');
        lockBtn.textContent = gameState.locks[i] ? '🔒' : '🔓';
        lockBtn.disabled = gameState.turn !== gameState.myIndex || gameState.rollsLeft === 3;
        lockBtn.onclick = () => {
            if (gameState.turn === gameState.myIndex && gameState.rollsLeft < 3) {
                gameState.locks[i] = !gameState.locks[i];
                renderDice();
            }
        };
        locksDiv.appendChild(lockBtn);
    }
}

function renderTable() {
    tableBody.innerHTML = '';
    COMBINATIONS.forEach(combo => {
        const tr = document.createElement('tr');
        const tdName = document.createElement('td');
        tdName.textContent = combo.name;
        tr.appendChild(tdName);

        for (let p = 0; p < 2; p++) {
            const td = document.createElement('td');
            if (gameState.players[p].scores[combo.key] !== undefined) {
                td.textContent = gameState.players[p].scores[combo.key];
            } else if (gameState.turn === p && gameState.myIndex === p && gameState.rollsLeft < 3) {
                td.className = 'selectable';
                td.textContent = getScore(combo.key, gameState.dice);
                td.onclick = () => {
                    gameState.players[p].setScore(combo.key, getScore(combo.key, gameState.dice));
                    gameState.rollsLeft = 3;
                    gameState.locks = [false,false,false,false,false];
                    gameState.turn = 1 - gameState.turn;
                    sendGameState();
                };
            }
            tr.appendChild(td);
        }
        tableBody.appendChild(tr);
    });
}

rollBtn.onclick = () => {
    if (gameState.turn !== gameState.myIndex || gameState.rollsLeft === 0) return;
    for (let i = 0; i < 5; i++) {
        if (!gameState.locks[i]) {
            gameState.dice[i] = Math.floor(Math.random() * 6) + 1;
        }
    }
    gameState.rollsLeft--;
    render();
    sendGameState();
};

endTurnBtn.onclick = () => {
    if (gameState.turn !== gameState.myIndex || gameState.rollsLeft === 3) return;
    gameState.turn = 1 - gameState.turn;
    gameState.rollsLeft = 3;
    gameState.locks = [false,false,false,false,false];
    sendGameState();
};