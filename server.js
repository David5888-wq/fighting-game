const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;

let waitingPlayers = [];
let games = {};

app.use(express.static(path.join(__dirname, 'public')));

// Функции для подсчета очков
function calculateScore(dice, combination) {
    const counts = new Array(7).fill(0);
    dice.forEach(die => counts[die]++);

    switch (combination) {
        case 'ones':
            return counts[1] * 1;
        case 'twos':
            return counts[2] * 2;
        case 'threes':
            return counts[3] * 3;
        case 'fours':
            return counts[4] * 4;
        case 'fives':
            return counts[5] * 5;
        case 'sixes':
            return counts[6] * 6;
        case 'three-of-a-kind':
            return counts.some(count => count >= 3) ? dice.reduce((a, b) => a + b, 0) : 0;
        case 'four-of-a-kind':
            return counts.some(count => count >= 4) ? dice.reduce((a, b) => a + b, 0) : 0;
        case 'full-house':
            return counts.some(count => count === 3) && counts.some(count => count === 2) ? 25 : 0;
        case 'small-straight':
            return (counts.slice(1, 5).every(count => count >= 1) || 
                   counts.slice(2, 6).every(count => count >= 1) || 
                   counts.slice(3, 7).every(count => count >= 1)) ? 30 : 0;
        case 'large-straight':
            return (counts.slice(1, 6).every(count => count === 1) || 
                   counts.slice(2, 7).every(count => count === 1)) ? 40 : 0;
        case 'yatzy':
            return counts.some(count => count === 5) ? 50 : 0;
        case 'chance':
            return dice.reduce((a, b) => a + b, 0);
        default:
            return 0;
    }
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            return;
        }

        if (data.type === 'join') {
            ws.username = data.username;
            ws.isPlaying = false;
            waitingPlayers.push(ws);
            broadcastLobby();
        }

        if (data.type === 'invite') {
            const opponent = waitingPlayers.find(p => p.username === data.opponent);
            if (opponent && opponent.readyState === WebSocket.OPEN) {
                const gameId = Math.random().toString(36).substr(2, 9);
                games[gameId] = {
                    players: [ws, opponent],
                    currentPlayer: ws,
                    dice: [1, 1, 1, 1, 1],
                    rollsLeft: 3,
                    scores: {
                        player1: {},
                        player2: {}
                    }
                };
                ws.isPlaying = true;
                opponent.isPlaying = true;
                ws.gameId = gameId;
                opponent.gameId = gameId;
                waitingPlayers = waitingPlayers.filter(p => p !== ws && p !== opponent);
                ws.send(JSON.stringify({ type: 'start', opponent: opponent.username, first: true, gameId }));
                opponent.send(JSON.stringify({ type: 'start', opponent: ws.username, first: false, gameId }));
                broadcastLobby();
            }
        }

        if (data.type === 'game') {
            const game = games[data.gameId];
            if (game) {
                const payload = data.payload;
                
                if (payload.type === 'roll') {
                    // Бросаем только незаблокированные кубики
                    game.dice = game.dice.map((die, index) => 
                        payload.lockedDice[index] ? die : Math.floor(Math.random() * 6) + 1
                    );
                    game.rollsLeft--;
                    
                    // Отправляем обновление обоим игрокам
                    game.players.forEach(player => {
                        if (player.readyState === WebSocket.OPEN) {
                            player.send(JSON.stringify({
                                type: 'game',
                                payload: {
                                    type: 'dice',
                                    dice: game.dice,
                                    rollsLeft: game.rollsLeft
                                }
                            }));
                        }
                    });
                }
                
                if (payload.type === 'end_turn') {
                    // Меняем текущего игрока
                    game.currentPlayer = game.players.find(p => p !== game.currentPlayer);
                    game.rollsLeft = 3;
                    
                    // Отправляем обновление обоим игрокам
                    game.players.forEach(player => {
                        if (player.readyState === WebSocket.OPEN) {
                            player.send(JSON.stringify({
                                type: 'game',
                                payload: {
                                    type: 'turn',
                                    isMyTurn: player === game.currentPlayer
                                }
                            }));
                        }
                    });
                }
                
                if (payload.type === 'select_combination') {
                    const playerIndex = game.players.indexOf(ws);
                    const playerKey = playerIndex === 0 ? 'player1' : 'player2';
                    const score = calculateScore(game.dice, payload.combination);

                    // Не даём выбрать одну и ту же комбинацию дважды
                    if (game.scores[playerKey][payload.combination] !== undefined) return;

                    game.scores[playerKey][payload.combination] = score;

                    // Отправляем обновление обоим игрокам
                    game.players.forEach(player => {
                        if (player.readyState === WebSocket.OPEN) {
                            player.send(JSON.stringify({
                                type: 'game',
                                payload: {
                                    type: 'score',
                                    scores: game.scores
                                }
                            }));
                        }
                    });

                    // Передаём ход другому игроку
                    game.currentPlayer = game.players.find(p => p !== ws);
                    game.rollsLeft = 3;
                    game.dice = [1, 1, 1, 1, 1];

                    game.players.forEach(player => {
                        if (player.readyState === WebSocket.OPEN) {
                            player.send(JSON.stringify({
                                type: 'game',
                                payload: {
                                    type: 'turn',
                                    isMyTurn: player === game.currentPlayer
                                }
                            }));
                        }
                    });

                    // Проверяем конец игры
                    const allCombinations = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
                        'three-of-a-kind', 'four-of-a-kind', 'full-house',
                        'small-straight', 'large-straight', 'yatzy', 'chance'];

                    const gameOver = allCombinations.every(combination =>
                        game.scores.player1[combination] !== undefined &&
                        game.scores.player2[combination] !== undefined
                    );

                    if (gameOver) {
                        const player1Score = Object.values(game.scores.player1).reduce((a, b) => a + b, 0);
                        const player2Score = Object.values(game.scores.player2).reduce((a, b) => a + b, 0);
                        const winner = player1Score > player2Score ? game.players[0].username :
                            player1Score < player2Score ? game.players[1].username : 'Ничья';

                        game.players.forEach(player => {
                            if (player.readyState === WebSocket.OPEN) {
                                player.send(JSON.stringify({
                                    type: 'game_over',
                                    winner: winner
                                }));
                            }
                        });

                        delete games[data.gameId];
                    }
                }
            }
        }
    });

    ws.on('close', () => {
        waitingPlayers = waitingPlayers.filter(p => p !== ws);
        if (ws.gameId && games[ws.gameId]) {
            games[ws.gameId].players.forEach(player => {
                if (player !== ws && player.readyState === WebSocket.OPEN) {
                    player.send(JSON.stringify({ type: 'opponent_left' }));
                }
            });
            delete games[ws.gameId];
        }
        broadcastLobby();
    });
});

function broadcastLobby() {
    const lobby = waitingPlayers.filter(p => !p.isPlaying).map(p => p.username);
    waitingPlayers.forEach(p => {
        if (p.readyState === WebSocket.OPEN) {
            p.send(JSON.stringify({ type: 'lobby', lobby }));
        }
    });
}

server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});