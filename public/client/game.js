class YahtzeeGame {
    constructor() {
        this.socket = io('http://localhost:3000');
        this.playerName = '';
        this.playerId = null;
        this.opponentId = null;
        this.isMyTurn = false;
        this.dice = [0, 0, 0, 0, 0];
        this.lockedDice = [false, false, false, false, false];
        this.rollsLeft = 3;
        this.scores = {
            player1: {},
            player2: {}
        };
        this.currentPlayer = 1;
        this.gameStarted = false;

        this.initializeEventListeners();
        this.initializeSocketListeners();
    }

    initializeEventListeners() {
        // Обработчики для экрана ожидания
        document.getElementById('findMatchButton').addEventListener('click', () => {
            const nameInput = document.getElementById('playerName');
            if (nameInput.value.trim()) {
                this.playerName = nameInput.value.trim();
                this.socket.emit('joinQueue', { name: this.playerName });
            }
        });

        // Обработчики для игрового экрана
        document.getElementById('rollButton').addEventListener('click', () => this.rollDice());
        document.getElementById('endTurnButton').addEventListener('click', () => this.endTurn());

        // Обработчики для блокировки кубиков
        document.querySelectorAll('.lock-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const diceIndex = parseInt(e.target.dataset.dice) - 1;
                this.toggleDiceLock(diceIndex);
            });
        });

        // Обработчики для ячеек таблицы
        document.querySelectorAll('.score-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                if (this.isMyTurn && cell.classList.contains('available')) {
                    const combination = e.target.parentElement.dataset.combination;
                    const player = e.target.dataset.player;
                    this.selectCombination(combination, player);
                }
            });
        });
    }

    initializeSocketListeners() {
        this.socket.on('queueStatus', (data) => {
            document.getElementById('queueStatus').textContent = `Позиция в очереди: ${data.position}`;
        });

        this.socket.on('matchFound', (data) => {
            this.playerId = this.socket.id;
            this.opponentId = data.players.find(id => id !== this.playerId);
            this.gameStarted = true;
            this.showGameScreen();
            this.updatePlayerNames(data.players);
        });

        this.socket.on('gameState', (data) => {
            this.updateGameState(data);
        });

        this.socket.on('opponentDisconnected', () => {
            alert('Соперник отключился от игры');
            location.reload();
        });
    }

    showGameScreen() {
        document.getElementById('waitingScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
    }

    updatePlayerNames(players) {
        const player1Name = document.getElementById('player1Name');
        const player2Name = document.getElementById('player2Name');
        
        if (players[0] === this.playerId) {
            player1Name.textContent = this.playerName;
            player2Name.textContent = 'Ожидание...';
        } else {
            player1Name.textContent = 'Ожидание...';
            player2Name.textContent = this.playerName;
        }
    }

    rollDice() {
        if (!this.isMyTurn || this.rollsLeft <= 0) return;

        this.rollsLeft--;
        document.getElementById('rollsLeft').textContent = `Осталось бросков: ${this.rollsLeft}`;

        // Анимация броска
        document.querySelectorAll('.dice').forEach(dice => {
            dice.classList.add('rolling');
            setTimeout(() => dice.classList.remove('rolling'), 500);
        });

        // Генерация новых значений для незаблокированных кубиков
        for (let i = 0; i < 5; i++) {
            if (!this.lockedDice[i]) {
                this.dice[i] = Math.floor(Math.random() * 6) + 1;
            }
        }

        this.updateDiceDisplay();
        this.updateAvailableCombinations();
        this.socket.emit('diceRolled', { dice: this.dice, rollsLeft: this.rollsLeft });

        if (this.rollsLeft === 0) {
            document.getElementById('rollButton').disabled = true;
            document.getElementById('endTurnButton').disabled = false;
        }
    }

    toggleDiceLock(index) {
        if (!this.isMyTurn) return;
        this.lockedDice[index] = !this.lockedDice[index];
        const button = document.querySelector(`.lock-button[data-dice="${index + 1}"]`);
        button.classList.toggle('locked');
    }

    updateDiceDisplay() {
        for (let i = 0; i < 5; i++) {
            const diceElement = document.getElementById(`dice${i + 1}`);
            diceElement.querySelector('.dice-face').textContent = this.dice[i];
        }
    }

    updateAvailableCombinations() {
        const combinations = this.calculateCombinations();
        document.querySelectorAll('.score-cell').forEach(cell => {
            const combination = cell.parentElement.dataset.combination;
            const player = cell.dataset.player;
            
            if (!this.scores[`player${player}`][combination] && this.isMyTurn) {
                cell.classList.add('available');
            } else {
                cell.classList.remove('available');
            }
        });
    }

    calculateCombinations() {
        const counts = new Array(7).fill(0);
        this.dice.forEach(value => counts[value]++);

        return {
            ones: counts[1] * 1,
            twos: counts[2] * 2,
            threes: counts[3] * 3,
            fours: counts[4] * 4,
            fives: counts[5] * 5,
            sixes: counts[6] * 6,
            threeOfAKind: this.hasThreeOfAKind(counts) ? this.dice.reduce((a, b) => a + b, 0) : 0,
            fourOfAKind: this.hasFourOfAKind(counts) ? this.dice.reduce((a, b) => a + b, 0) : 0,
            fullHouse: this.hasFullHouse(counts) ? 25 : 0,
            smallStraight: this.hasSmallStraight(counts) ? 30 : 0,
            largeStraight: this.hasLargeStraight(counts) ? 40 : 0,
            yahtzee: this.hasYahtzee(counts) ? 50 : 0,
            chance: this.dice.reduce((a, b) => a + b, 0)
        };
    }

    hasThreeOfAKind(counts) {
        return counts.some(count => count >= 3);
    }

    hasFourOfAKind(counts) {
        return counts.some(count => count >= 4);
    }

    hasFullHouse(counts) {
        return counts.includes(3) && counts.includes(2);
    }

    hasSmallStraight(counts) {
        return (counts.slice(1, 5).every(count => count >= 1)) ||
               (counts.slice(2, 6).every(count => count >= 1)) ||
               (counts.slice(3, 7).every(count => count >= 1));
    }

    hasLargeStraight(counts) {
        return (counts.slice(1, 6).every(count => count >= 1)) ||
               (counts.slice(2, 7).every(count => count >= 1));
    }

    hasYahtzee(counts) {
        return counts.some(count => count === 5);
    }

    selectCombination(combination, player) {
        if (!this.isMyTurn) return;

        const combinations = this.calculateCombinations();
        const score = combinations[combination];
        
        this.scores[`player${player}`][combination] = score;
        const cell = document.querySelector(`.score-cell[data-player="${player}"][data-combination="${combination}"]`);
        cell.textContent = score;
        cell.classList.remove('available');
        cell.classList.add('filled');

        this.updateTotalScore();
        this.socket.emit('combinationSelected', { combination, score, player });
    }

    updateTotalScore() {
        const player1Score = Object.values(this.scores.player1).reduce((a, b) => a + b, 0);
        const player2Score = Object.values(this.scores.player2).reduce((a, b) => a + b, 0);
        
        document.getElementById('player1Score').textContent = player1Score;
        document.getElementById('player2Score').textContent = player2Score;
    }

    endTurn() {
        if (!this.isMyTurn) return;

        this.isMyTurn = false;
        this.rollsLeft = 3;
        this.lockedDice = [false, false, false, false, false];
        
        document.getElementById('rollButton').disabled = false;
        document.getElementById('endTurnButton').disabled = true;
        document.getElementById('rollsLeft').textContent = `Осталось бросков: ${this.rollsLeft}`;
        
        document.querySelectorAll('.lock-button').forEach(button => {
            button.classList.remove('locked');
        });

        this.socket.emit('turnEnded');
    }

    updateGameState(data) {
        this.dice = data.dice;
        this.rollsLeft = data.rollsLeft;
        this.isMyTurn = data.currentPlayer === this.playerId;
        this.scores = data.scores;

        this.updateDiceDisplay();
        this.updateAvailableCombinations();
        this.updateTotalScore();

        document.getElementById('rollButton').disabled = !this.isMyTurn || this.rollsLeft <= 0;
        document.getElementById('endTurnButton').disabled = !this.isMyTurn || this.rollsLeft > 0;
    }
}

// Инициализация игры при загрузке страницы
window.addEventListener('load', () => {
    new YahtzeeGame();
}); 