class Lobby {
    constructor() {
        this.socket = io();
        this.username = '';
        this.players = [];
        this.setupSocketListeners();
        this.setupUI();
    }

    setupSocketListeners() {
        this.socket.on('registrationSuccess', (data) => {
            this.username = data.username;
            this.players = data.players;
            this.updatePlayersList();
        });

        this.socket.on('playerJoined', (player) => {
            this.players.push(player);
            this.updatePlayersList();
        });

        this.socket.on('playerLeft', (playerId) => {
            this.players = this.players.filter(p => p.id !== playerId);
            this.updatePlayersList();
        });

        this.socket.on('playerStatusChanged', (data) => {
            const player = this.players.find(p => p.id === data.id);
            if (player) {
                player.status = data.status;
                this.updatePlayersList();
            }
        });

        this.socket.on('gameStart', (gameData) => {
            window.location.href = `/game.html?gameId=${gameData.gameId}`;
        });
    }

    setupUI() {
        const loginForm = document.getElementById('loginForm');
        const playersList = document.getElementById('playersList');

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('username');
            const username = usernameInput.value.trim();
            
            if (username) {
                this.socket.emit('registerPlayer', username);
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('lobbyScreen').style.display = 'block';
            }
        });
    }

    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';

        this.players.forEach(player => {
            if (player.status === 'waiting') {
                const playerElement = document.createElement('div');
                playerElement.className = 'player-item';
                playerElement.innerHTML = `
                    <span>${player.username}</span>
                    <button onclick="lobby.challengePlayer('${player.id}')">Вызвать на бой</button>
                `;
                playersList.appendChild(playerElement);
            }
        });
    }

    challengePlayer(targetId) {
        this.socket.emit('challengePlayer', targetId);
    }
}

const lobby = new Lobby(); 