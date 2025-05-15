// game.js
document.addEventListener('DOMContentLoaded', () => {
    const gameStatus = document.getElementById('game-status');
    const currentPlayerDisplay = document.getElementById('current-player');
    const diceContainer = document.getElementById('dice-container');
    const rollBtn = document.getElementById('roll-btn');
    const endTurnBtn = document.getElementById('end-turn-btn');
    const scoreBody = document.getElementById('score-body');
    const playerTotal = document.getElementById('player-total');
    const opponentTotal = document.getElementById('opponent-total');
    const createGameBtn = document.getElementById('create-game-btn');
    const joinGameBtn = document.getElementById('join-game-btn');
    const gameIdInput = document.getElementById('game-id-input');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');

    let playerId = null;
    let gameId = null;
    let ws = null;
    let isYourTurn = false;
    let currentDice = [];
    let rollsLeft = 0;
    let scores = {};
    let opponentId = null;
    let playerName = `Игрок_${Math.floor(Math.random() * 1000)}`;

    // Инициализация WebSocket
    function initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
            console.log('Connected to WebSocket server');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);

            switch (data.type) {
                case 'playerId':
                    playerId = data.playerId;
                    break;
                    
                case 'gameStart':
                    gameId = data.gameId;
                    opponentId = data.players.find(id => id !== playerId);
                    
                    if (data.isCreator) {
                        gameStatus.textContent = 'Ожидание соперника...';
                        addChatMessage('system', `Вы создали игру. ID игры: ${gameId}`);
                    } else {
                        gameStatus.textContent = 'Игра началась!';
                        addChatMessage('system', 'Вы присоединились к игре');
                        
                        if (data.state) {
                            updateGameState(data.state);
                        }
                    }
                    
                    if (opponentId) {
                        addChatMessage('system', 'Соперник присоединился к игре');
                    }
                    break;
                    
                case 'gameState':
                    updateGameState(data.state);
                    break;
                    
                case 'playerLeft':
                    gameStatus.textContent = 'Соперник покинул игру';
                    addChatMessage('system', 'Соперник покинул игру');
                    resetGame();
                    break;
                    
                case 'chatMessage':
                    const sender = data.playerId === playerId ? 'you' : 'opponent';
                    addChatMessage(sender, data.message);
                    break;
                    
                case 'error':
                    gameStatus.textContent = data.message;
                    addChatMessage('system', data.message);
                    break;
            }
        };

        ws.onclose = () => {
            gameStatus.textContent = 'Соединение потеряно. Попробуйте перезагрузить страницу.';
            console.log('WebSocket connection closed');
        };
    }

    // Обновление состояния игры
    function updateGameState(state) {
        currentDice = state.dice || [];
        rollsLeft = state.rollsLeft || 0;
        scores = state.scores || {};
        isYourTurn = state.currentPlayer === playerId;
        
        updateDiceDisplay();
        updateScoreTable();
        updateControls();
        
        if (isYourTurn) {
            gameStatus.textContent = 'Ваш ход!';
            currentPlayerDisplay.textContent = 'Сейчас ваш ход';
        } else {
            gameStatus.textContent = 'Ход соперника';
            currentPlayerDisplay.textContent = 'Ожидание хода соперника';
        }
    }

    // Обновление отображения кубиков
    function updateDiceDisplay() {
        diceContainer.innerHTML = '';
        
        currentDice.forEach((value, index) => {
            const diceElement = document.createElement('div');
            diceElement.className = 'dice';
            diceElement.textContent = value;
            diceElement.dataset.index = index;
            
            if (isYourTurn && rollsLeft < 3) {
                diceElement.addEventListener('click', toggleDiceSelection);
            }
            
            diceContainer.appendChild(diceElement);
        });
    }

    // Переключение выбора кубика
    function toggleDiceSelection(event) {
        const diceElement = event.target;
        diceElement.classList.toggle('selected');
    }

    // Обновление таблицы результатов
    function updateScoreTable() {
        scoreBody.innerHTML = '';
        
        const combinations = [
            'Единицы', 'Двойки', 'Тройки', 'Четвёрки', 'Пятёрки', 'Шестёрки',
            'Пара', 'Две пары', 'Тройка', 'Четверка', 'Малый стрит', 'Большой стрит',
            'Фулл хаус', 'Шанс', 'Ятцзи'
        ];
        
        let playerTotalScore = 0;
        let opponentTotalScore = 0;
        
        combinations.forEach(comb => {
            const row = document.createElement('tr');
            
            const nameCell = document.createElement('td');
            nameCell.textContent = comb;
            row.appendChild(nameCell);
            
            const playerCell = document.createElement('td');
            playerCell.textContent = scores[playerId]?.[comb] || '';
            row.appendChild(playerCell);
            
            const opponentCell = document.createElement('td');
            opponentCell.textContent = scores[opponentId]?.[comb] || '';
            row.appendChild(opponentCell);
            
            if (isYourTurn && !scores[playerId]?.[comb]) {
                row.addEventListener('click', () => selectCombination(comb));
                row.style.cursor = 'pointer';
            }
            
            scoreBody.appendChild(row);
            
            // Подсчет итогов
            playerTotalScore += parseInt(scores[playerId]?.[comb]) || 0;
            opponentTotalScore += parseInt(scores[opponentId]?.[comb]) || 0;
        });
        
        playerTotal.textContent = playerTotalScore;
        opponentTotal.textContent = opponentTotalScore;
    }

    // Выбор комбинации
    function selectCombination(combination) {
        if (!isYourTurn) return;
        
        // Вычисляем очки для выбранной комбинации
        const score = calculateScore(combination, currentDice);
        
        // Обновляем результаты
        if (!scores[playerId]) scores[playerId] = {};
        scores[playerId][combination] = score;
        
        // Передаем ход сопернику
        const newState = {
            dice: [],
            rollsLeft: 3,
            currentPlayer: opponentId,
            scores: scores
        };
        
        ws.send(JSON.stringify({
            type: 'gameState',
            gameId: gameId,
            state: newState
        }));
        
        addChatMessage('you', `Выбрал комбинацию "${combination}" (${score} очков)`);
    }

    // Расчет очков для комбинации
    function calculateScore(combination, dice) {
        // Простая реализация - можно улучшить
        const counts = [0, 0, 0, 0, 0, 0];
        dice.forEach(d => counts[d - 1]++);
        
        switch (combination) {
            case 'Единицы': return sumDice(dice, 1);
            case 'Двойки': return sumDice(dice, 2);
            case 'Тройки': return sumDice(dice, 3);
            case 'Четвёрки': return sumDice(dice, 4);
            case 'Пятёрки': return sumDice(dice, 5);
            case 'Шестёрки': return sumDice(dice, 6);
            case 'Пара': return findNOfAKind(2, counts);
            case 'Две пары': return findTwoPairs(counts);
            case 'Тройка': return findNOfAKind(3, counts);
            case 'Четверка': return findNOfAKind(4, counts);
            case 'Малый стрит': return isStraight(dice, true) ? 30 : 0;
            case 'Большой стрит': return isStraight(dice, false) ? 40 : 0;
            case 'Фулл хаус': return isFullHouse(counts) ? 25 : 0;
            case 'Шанс': return dice.reduce((a, b) => a + b, 0);
            case 'Ятцзи': return isYahtzee(counts) ? 50 : 0;
            default: return 0;
        }
    }

    // Вспомогательные функции для расчета очков
    function sumDice(dice, value) {
        return dice.filter(d => d === value).reduce((a, b) => a + b, 0);
    }

    function findNOfAKind(n, counts) {
        for (let i = 5; i >= 0; i--) {
            if (counts[i] >= n) return (i + 1) * n;
        }
        return 0;
    }

    function findTwoPairs(counts) {
        const pairs = counts.map((count, i) => count >= 2 ? i + 1 : 0).filter(val => val > 0);
        return pairs.length >= 2 ? pairs.sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0) * 2 : 0;
    }

    function isStraight(dice, isSmall) {
        const unique = [...new Set(dice)].sort();
        if (isSmall) {
            return (
                (unique.includes(1) && unique.includes(2) && unique.includes(3) && unique.includes(4)) ||
                (unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) ||
                (unique.includes(3) && unique.includes(4) && unique.includes(5) && unique.includes(6))
            );
        } else {
            return (
                (unique.includes(1) && unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) ||
                (unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5) && unique.includes(6))
            );
        }
    }

    function isFullHouse(counts) {
        return counts.includes(3) && counts.includes(2);
    }

    function isYahtzee(counts) {
        return counts.includes(5);
    }

    // Обновление элементов управления
    function updateControls() {
        rollBtn.disabled = !isYourTurn || rollsLeft === 0;
        rollBtn.textContent = `Бросить кубики (${rollsLeft})`;
        endTurnBtn.disabled = !isYourTurn || rollsLeft === 3;
    }

    // Сброс игры
    function resetGame() {
        currentDice = [];
        rollsLeft = 0;
        scores = {};
        isYourTurn = false;
        opponentId = null;
        
        updateDiceDisplay();
        updateScoreTable();
        updateControls();
    }

    // Добавление сообщения в чат
    function addChatMessage(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}`;
        
        let displayName;
        switch (sender) {
            case 'you': displayName = 'Вы'; break;
            case 'opponent': displayName = 'Соперник'; break;
            case 'system': displayName = 'Система'; break;
        }
        
        messageElement.innerHTML = `<strong>${displayName}:</strong> ${message}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Обработчики событий
    createGameBtn.addEventListener('click', () => {
        ws.send(JSON.stringify({ type: 'createGame' }));
    });

    joinGameBtn.addEventListener('click', () => {
        const id = gameIdInput.value.trim();
        if (id) {
            ws.send(JSON.stringify({ 
                type: 'joinGame', 
                gameId: id 
            }));
        } else {
            gameStatus.textContent = 'Введите ID игры';
        }
    });

    rollBtn.addEventListener('click', () => {
        if (!isYourTurn || rollsLeft === 0) return;
        
        // Получаем выбранные кубики (которые не нужно перебрасывать)
        const selectedIndices = Array.from(diceContainer.querySelectorAll('.dice.selected'))
            .map(el => parseInt(el.dataset.index));
        
        // Генерируем новые значения для невыбранных кубиков
        const newDice = [...currentDice];
        for (let i = 0; i < 5; i++) {
            if (currentDice.length <= i || !selectedIndices.includes(i)) {
                newDice[i] = Math.floor(Math.random() * 6) + 1;
            }
        }
        
        // Обновляем состояние
        const newState = {
            dice: newDice,
            rollsLeft: rollsLeft - 1,
            currentPlayer: playerId,
            scores: scores
        };
        
        ws.send(JSON.stringify({
            type: 'gameState',
            gameId: gameId,
            state: newState
        }));
        
        addChatMessage('you', `Бросил кубики (осталось попыток: ${rollsLeft - 1})`);
    });

    endTurnBtn.addEventListener('click', () => {
        if (!isYourTurn || rollsLeft === 3) return;
        
        gameStatus.textContent = 'Выберите комбинацию для записи очков';
    });

    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    function sendChatMessage() {
        const message = chatInput.value.trim();
        if (message && gameId) {
            ws.send(JSON.stringify({
                type: 'chatMessage',
                gameId: gameId,
                message: message
            }));
            chatInput.value = '';
        }
    }

    // Инициализация
    initWebSocket();
});