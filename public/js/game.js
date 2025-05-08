class Game {
    constructor() {
        this.socket = io();
        this.gameId = new URLSearchParams(window.location.search).get('gameId');
        this.players = {};
        this.settings = {};
        this.characters = [];
        this.keys = {};
        this.setupSocketListeners();
        this.setupControls();
        this.setupCanvas();
        this.gameLoop();
    }

    setupSocketListeners() {
        this.socket.on('gameStart', (data) => {
            this.players = data.players;
            this.settings = data.settings;
            this.characters = data.characters;
            this.initializeGame();
        });

        this.socket.on('playerUpdate', (data) => {
            if (this.players[data.playerId]) {
                Object.assign(this.players[data.playerId], data);
            }
        });

        this.socket.on('hit', (data) => {
            if (this.players[data.targetId]) {
                this.players[data.targetId].health = data.health;
                this.updateHealthBars();
            }
        });

        this.socket.on('gameOver', (data) => {
            alert(data.winner ? `Победитель: ${data.winner}` : 'Ничья!');
            window.location.href = '/';
        });
    }

    setupControls() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            this.handleMovement();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    setupCanvas() {
        this.canvas = document.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 1024;
        this.canvas.height = 576;
    }

    initializeGame() {
        this.updateHealthBars();
        this.loadCharacterSprites();
    }

    loadCharacterSprites() {
        this.characters.forEach(char => {
            const img = new Image();
            img.src = char.imageSrc;
            char.sprite = img;
        });
    }

    handleMovement() {
        const player = this.players[this.socket.id];
        if (!player) return;

        const movement = {
            position: { ...player.position },
            facingRight: player.facingRight,
            isAttacking: false
        };

        if (this.keys['ArrowLeft']) {
            movement.position.x -= this.settings.playerSpeed;
            movement.facingRight = false;
        }
        if (this.keys['ArrowRight']) {
            movement.position.x += this.settings.playerSpeed;
            movement.facingRight = true;
        }
        if (this.keys['ArrowUp'] && player.position.y === this.settings.floorLevel) {
            player.velocity.y = this.settings.jumpForce;
        }
        if (this.keys[' ']) {
            movement.isAttacking = true;
            this.socket.emit('attack');
        }

        this.socket.emit('movement', movement);
    }

    updateHealthBars() {
        Object.entries(this.players).forEach(([id, player]) => {
            const healthBar = document.getElementById(`${id}-health`);
            if (healthBar) {
                healthBar.style.width = `${player.health}%`;
            }
        });
    }

    gameLoop() {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        Object.entries(this.players).forEach(([id, player]) => {
            const character = this.characters.find(c => c.name === player.character.name);
            if (character && character.sprite) {
                this.ctx.drawImage(
                    character.sprite,
                    player.position.x - character.offset.x,
                    player.position.y - character.offset.y
                );
            }
        });

        requestAnimationFrame(() => this.gameLoop());
    }
}

const game = new Game(); 