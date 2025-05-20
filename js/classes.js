class Game {
    constructor(player1, player2) {
        this.players = [player1, player2];
        this.currentPlayer = player1;
        this.dice = [1, 1, 1, 1, 1];
        this.rollsLeft = 3;
        this.scores = {
            player1: {},
            player2: {}
        };
    }
    
    getPlayerIndex(player) {
        return this.players.indexOf(player);
    }
    
    getPlayerKey(player) {
        return this.getPlayerIndex(player) === 0 ? 'player1' : 'player2';
    }
    
    isGameOver() {
        const allCombinations = [
            'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
            'three-of-a-kind', 'four-of-a-kind', 'full-house',
            'small-straight', 'large-straight', 'yatzy', 'chance'
        ];
        
        return allCombinations.every(combination =>
            this.scores.player1[combination] !== undefined &&
            this.scores.player2[combination] !== undefined
        );
    }
    
    getWinner() {
        if (!this.isGameOver()) return null;
        
        const player1Score = this.calculateTotalScore(this.scores.player1);
        const player2Score = this.calculateTotalScore(this.scores.player2);
        
        if (player1Score > player2Score) return this.players[0].username;
        if (player2Score > player1Score) return this.players[1].username;
        return null; // Ничья
    }
    
    calculateTotalScore(scores) {
        return Object.values(scores).reduce((a, b) => a + (b || 0), 0);
    }
}

class Player {
    constructor(username, ws) {
        this.username = username;
        this.ws = ws;
        this.isPlaying = false;
        this.gameId = null;
    }
    
    send(data) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
} 