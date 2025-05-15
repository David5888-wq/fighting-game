// game.js
class YahtzeeGame {
    constructor() {
        this.ws = new WebSocket('ws://localhost:8080');
        this.playerId = null;
        this.gameId = null;
        this.currentPlayer = null;
        this.players = [];
        this.dice = [1, 1, 1, 1, 1];
        this.locked = [false, false, false, false, false];
        this.rollsLeft = 3;
        this.scores = {
            player: {},
            opponent: {}
        };
        
        this.init();
    }

    init() {
        this.setupDice();
        this.setupControls();
        this.setupWebSocket();
        this.renderScoreTable();
    }

    setupDice() {
        const container = document.getElementById('dice-container');
        this.dice.forEach((_, i) => {
            const die = document.createElement('div');
            die.className = 'dice';
            die.textContent = '⚀';
            die.addEventListener('click', () => this.toggleLock(i));
            container.appendChild(die);
        });
    }

    setupControls() {
        document.getElementById('roll-btn').addEventListener('click', () => this.rollDice());
        document.getElementById('end-turn-btn').addEventListener('click', () => this.endTurn());
    }

    setupWebSocket() {
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch(data.type) {
                case 'gameState':
                    this.updateGameState(data.state);
                    break;
                case 'playerId':
                    this.playerId = data.playerId;
                    break;
                case 'gameStart':
                    this.gameId = data.gameId;
                    this.players = data.players;
                    break;
            }
        };
    }

    rollDice() {
        if (this.rollsLeft === 0 || this.currentPlayer !== this.playerId) return;
        
        this.dice = this.dice.map((val, i) => 
            this.locked[i] ? val : Math.floor(Math.random() * 6) + 1
        );
        
        this.rollsLeft--;
        this.sendGameState();
        this.updateUI();
    }

    toggleLock(index) {
        if (this.rollsLeft === 3 || this.currentPlayer !== this.playerId) return;
        this.locked[index] = !this.locked[index];
        this.updateUI();
    }

    endTurn() {
        if (this.currentPlayer !== this.playerId) return;
        this.currentPlayer = this.players.find(p => p !== this.playerId);
        this.rollsLeft = 3;
        this.locked = [false, false, false, false, false];
        this.sendGameState();
    }

    sendGameState() {
        this.ws.send(JSON.stringify({
            type: 'gameState',
            gameId: this.gameId,
            state: {
                dice: this.dice,
                locked: this.locked,
                rollsLeft: this.rollsLeft,
                currentPlayer: this.currentPlayer,
                scores: this.scores
            }
        }));
    }

    updateGameState(state) {
        this.dice = state.dice;
        this.locked = state.locked;
        this.rollsLeft = state.rollsLeft;
        this.currentPlayer = state.currentPlayer;
        this.scores = state.scores;
        this.updateUI();
    }

    updateUI() {
        // Update dice
        document.querySelectorAll('.dice').forEach((die, i) => {
            die.textContent = this.getDiceSymbol(this.dice[i]);
            die.classList.toggle('locked', this.locked[i]);
        });

        // Update controls
        document.getElementById('roll-btn').textContent = 
            Бросить кубики (${this.rollsLeft});
        document.getElementById('roll-btn').disabled = 
            this.rollsLeft === 0 || this.currentPlayer !== this.playerId;
        document.getElementById('end-turn-btn').disabled = 
            this.currentPlayer !== this.playerId;

        // Update scores
        this.renderScoreTable();
    }

    getDiceSymbol(value) {
        return ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][value - 1];
    }
renderScoreTable() {
        const combinations = [
            'Единицы', 'Двойки', 'Тройки', 'Четверки', 'Пятерки', 'Шестерки',
            'Сет', 'Фулл хаус', 'Малый стрит', 'Большой стрит', 'Ятцзи', 'Шанс'
        ];

        const tbody = document.getElementById('score-body');
        tbody.innerHTML = '';

        combinations.forEach(combo => {
            const row = document.createElement('tr');
            row.innerHTML = 
                <td>${combo}</td>
                <td class="${!this.scores.player[combo] ? 'available' : ''}">
                    ${this.scores.player[combo] || ''}
                </td>
                <td>${this.scores.opponent[combo] || ''}</td>
            ;
            
            if (!this.scores.player[combo]) {
                row.querySelector('td').addEventListener('click', () => 
                    this.selectCombination(combo));
            }
            
            tbody.appendChild(row);
        });
    }

    selectCombination(combo) {
        if (this.currentPlayer !== this.playerId) return;
        
        const score = this.calculateScore(combo);
        this.scores.player[combo] = score;
        this.sendGameState();
        this.updateUI();
    }

    calculateScore(combo) {
        // Реализация подсчета очков для каждой комбинации
        const counts = this.getCounts();
        
        switch(combo) {
            case 'Единицы': return counts[1] * 1;
            case 'Двойки': return counts[2] * 2;
            case 'Тройки': return counts[3] * 3;
            case 'Четверки': return counts[4] * 4;
            case 'Пятерки': return counts[5] * 5;
            case 'Шестерки': return counts[6] * 6;
            case 'Сет': return this.hasThreeOfAKind() ? this.sumDice() : 0;
            case 'Фулл хаус': return this.hasFullHouse() ? 25 : 0;
            case 'Малый стрит': return this.hasSmallStraight() ? 30 : 0;
            case 'Большой стрит': return this.hasLargeStraight() ? 40 : 0;
            case 'Ятцзи': return this.hasYahtzee() ? 50 : 0;
            case 'Шанс': return this.sumDice();
            default: return 0;
        }
    }

    // Вспомогательные методы для проверки комбинаций
    getCounts() {
        return this.dice.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});
    }

    hasThreeOfAKind() {
        const counts = Object.values(this.getCounts());
        return counts.some(c => c >= 3);
    }

    hasFullHouse() {
        const counts = Object.values(this.getCounts());
        return counts.includes(3) && counts.includes(2);
    }

    hasSmallStraight() {
        const sorted = [...new Set(this.dice)].sort();
        return this.checkConsecutive(4, sorted);
    }

    hasLargeStraight() {
        const sorted = [...new Set(this.dice)].sort();
        return this.checkConsecutive(5, sorted);
    }

    hasYahtzee() {
        return new Set(this.dice).size === 1;
    }

    sumDice() {
        return this.dice.reduce((a, b) => a + b, 0);
    }

    checkConsecutive(length, sorted) {
        let count = 1;
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === sorted[i-1] + 1) count++;
            else count = 1;
            if (count >= length) return true;
        }
        return false;
    }
}

// Запуск игры
new YahtzeeGame();