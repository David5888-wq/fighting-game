class Player {
    constructor(name) {
        this.name = name;
        this.scores = {};
        this.total = 0;
    }
    setScore(key, value) {
        this.scores[key] = value;
        this.total = Object.values(this.scores).reduce((a,b)=>a+b,0);
    }
}

class GameState {
    constructor(player1, player2, myName) {
        this.players = [new Player(player1), new Player(player2)];
        this.myIndex = player1 === myName ? 0 : 1;
        this.turn = 0; // 0 или 1
        this.dice = [1,1,1,1,1];
        this.locks = [false,false,false,false,false];
        this.rollsLeft = 3;
        this.finished = false;
        this.selectedCombo = null;
    }
}