const COMBINATIONS = {
    'ones': 'Единицы',
    'twos': 'Двойки',
    'threes': 'Тройки',
    'fours': 'Четверки',
    'fives': 'Пятерки',
    'sixes': 'Шестерки',
    'three-of-a-kind': 'Тройка',
    'four-of-a-kind': 'Каре',
    'full-house': 'Фулл-хаус',
    'small-straight': 'Малый стрит',
    'large-straight': 'Большой стрит',
    'yatzy': 'Ятцы',
    'chance': 'Шанс'
};

function createDieElement(value, index) {
    const die = document.createElement('div');
    die.className = 'die';
    die.dataset.index = index;
    die.textContent = value;
    return die;
}

function updateDiceDisplay(dice, lockedDice) {
    const diceContainer = document.getElementById('dice');
    diceContainer.innerHTML = '';
    
    dice.forEach((value, index) => {
        const die = createDieElement(value, index);
        if (lockedDice[index]) {
            die.classList.add('locked');
        }
        diceContainer.appendChild(die);
    });
}

function updateScoreTable(scores, player1Name, player2Name) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    
    document.getElementById('th1').textContent = player1Name;
    document.getElementById('th2').textContent = player2Name;
    
    Object.entries(COMBINATIONS).forEach(([key, name]) => {
        const row = document.createElement('tr');
        
        const nameCell = document.createElement('td');
        nameCell.textContent = name;
        row.appendChild(nameCell);
        
        const score1Cell = document.createElement('td');
        score1Cell.textContent = scores.player1[key] !== undefined ? scores.player1[key] : '';
        row.appendChild(score1Cell);
        
        const score2Cell = document.createElement('td');
        score2Cell.textContent = scores.player2[key] !== undefined ? scores.player2[key] : '';
        row.appendChild(score2Cell);
        
        tableBody.appendChild(row);
    });
}

function showGameOver(winner, scores) {
    const modal = document.getElementById('gameOverModal');
    const gameOverText = document.getElementById('gameOverText');
    const finalScores = document.getElementById('finalScores');
    
    gameOverText.textContent = winner ? `Победитель: ${winner}!` : 'Ничья!';
    
    const player1Score = Object.values(scores.player1).reduce((a, b) => a + (b || 0), 0);
    const player2Score = Object.values(scores.player2).reduce((a, b) => a + (b || 0), 0);
    
    finalScores.innerHTML = `
        <p>Итоговый счет:</p>
        <p>${document.getElementById('player1').textContent}: ${player1Score}</p>
        <p>${document.getElementById('player2').textContent}: ${player2Score}</p>
    `;
    
    modal.style.display = 'flex';
}

function hideGameOver() {
    document.getElementById('gameOverModal').style.display = 'none';
}

function showError(message) {
    alert(message);
}

function showMessage(message) {
    const turnInfo = document.getElementById('turnInfo');
    turnInfo.textContent = message;
}

function updateRollsLeft(rolls) {
    document.getElementById('rollsLeft').textContent = `Осталось бросков: ${rolls}`;
}

function updatePlayerNames(player1, player2) {
    document.getElementById('player1').textContent = player1;
    document.getElementById('player2').textContent = player2;
}

function updateScores(score1, score2) {
    document.getElementById('score1').textContent = score1;
    document.getElementById('score2').textContent = score2;
}

function showLobby() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('lobby').style.display = 'block';
    document.getElementById('game').style.display = 'none';
}

function showGame() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game').style.display = 'block';
}

function updatePlayersList(players) {
    const playersList = document.getElementById('players');
    playersList.innerHTML = '';
    
    if (players.length === 0) {
        document.querySelector('.waiting-message').style.display = 'block';
        return;
    }
    
    document.querySelector('.waiting-message').style.display = 'none';
    
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player;
        li.onclick = () => invitePlayer(player);
        playersList.appendChild(li);
    });
} 