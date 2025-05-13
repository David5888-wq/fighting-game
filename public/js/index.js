const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

// Заливаем Canvas (для проверки)
c.fillStyle = 'black'; // Можно поменять цвет
c.fillRect(0, 0, canvas.width, canvas.height);

const gravity = 0.3


const background = new Sprite({
    position: {
        x: 0,
        y: 0
    },
    imageSrc: './img/background.png'

})

const shop = new Sprite({
    position: {
        x: 600,
        y: 128
    },
    imageSrc: './img/shop.png',
    scale: 2.75,
    framesMax: 6

})


 const player = new Fighter({
    position: {
        x: 0,
        y: 0
    }, 
    velocity: {
        x: 0,
        y: 0
    },
    offset: {
        x: 0,
        y: 0
    },
    imageSrc: './img/samuraiMack/Idle.png',
    framesMax: 8,
    scale: 2.5,
    offset: {
        x: 215,
        y: 157
    },
    sprites: {
        idle: {
            imageSrc: './img/samuraiMack/Idle.png',
            framesMax: 8
        },
        run: {
            imageSrc: './img/samuraiMack/Run.png',
            framesMax: 8
        },
        jump: {
            imageSrc: './img/samuraiMack/Jump.png',
            framesMax: 2
        },
        fall: {
            imageSrc: './img/samuraiMack/Fall.png',
            framesMax: 2
        },
        attack1: {
            imageSrc: './img/samuraiMack/Attack1.png',
            framesMax: 6
        },
        takeHit: {
            imageSrc: './img/samuraiMack/Take Hit - white silhouette.png',
            framesMax: 4
        },
        death: {
            imageSrc: './img/samuraiMack/Death.png',
            framesMax: 6
        } 
    },
    attackBox: {
        offset: {
            x: 100,
            y: 50
        },
        width: 160,
        height: 50
    }
})



 const enemy = new Fighter({
    position: {
        x: 400,
        y: 100
    }, 
    velocity: {
        x: 0,
        y: 0
    }, 
    color: 'blue',
    offset: {
        x: -50,
        y: 0
    },
    imageSrc: './img/kenji/Idle.png',
    framesMax: 4,
    scale: 2.5,
    offset: {
        x: 215,
        y: 167
    },
    sprites: {
        idle: {
            imageSrc: './img/kenji/Idle.png',
            framesMax: 4
        },
        run: {
            imageSrc: './img/kenji/Run.png',
            framesMax: 8
        },
        jump: {
            imageSrc: './img/kenji/Jump.png',
            framesMax: 2
        },
        fall: {
            imageSrc: './img/kenji/Fall.png',
            framesMax: 2
        },
        attack1: {
            imageSrc: './img/kenji/Attack1.png',
            framesMax: 4
        },
        takeHit: {
            imageSrc: './img/kenji/Take hit.png',
            framesMax: 3
        },
        death: {
            imageSrc: './img/kenji/Death.png',
            framesMax: 7
        }
    },
    attackBox: {
        offset: {
            x: -170,
            y: 50
        },
        width: 170,
        height: 50
    }
})



 console.log(player);

const keys = {
    a: {
        pressed: false
    },
    d: {
        pressed: false
    },
    ArrowRight: {
        pressed: false
    },
    ArrowLeft: {
        pressed: false
    }
}


decreaseTimer()

 function animate() {
    window.requestAnimationFrame(animate)
    c.fillStyle = 'black'
    c.fillRect(0, 0, canvas.width, canvas.height)
    background.update()
    shop.update()
    c.fillStyle = 'rgba(255, 255, 255, 0.15)'
    c.fillRect(0, 0, canvas.width, canvas.height)
    player.update()
    enemy.update()

    player.velocity.x = 0
    enemy.velocity.x = 0

    // player movement
    
    if (keys.a.pressed && player.lastKey == 'a') {
        player.velocity.x = -4
        player.switchSprite('run')
    } else if (keys.d.pressed && player.lastKey === 'd') {
        player.velocity.x = 4
        player.switchSprite('run')
    } else {
        player.switchSprite('idle')
    }

    //jumping
    if (player.velocity.y < 0) {
        player.switchSprite('jump')
    } else if (player.velocity.y > 0) {
        player.switchSprite('fall')
    }


    // enemy movement
    if (keys.ArrowLeft.pressed && enemy.lastKey === 'ArrowLeft') {
        enemy.velocity.x = -4
        enemy.switchSprite('run')
    } else if (keys.ArrowRight.pressed && enemy.lastKey === 'ArrowRight') {
        enemy.velocity.x = 4
        enemy.switchSprite('run')
    } else{
        enemy.switchSprite('idle')
    }

    //jumping
    if (enemy.velocity.y < 0) {
        enemy.switchSprite('jump')
    } else if (enemy.velocity.y > 0) {
        enemy.switchSprite('fall')
    }



   // detect for collision enemy gets hit
    if (
        rectangularCollision({
            rectangle1: player,
            rectangle2: enemy
        }) &&
        player.isAttacking && player.framesCurrent === 4
    ){
        enemy.takeHit()
        player.isAttacking = false
        
        document.querySelector('#enemyHealth').style.width = enemy.health + '%'
    }

    //if player misses
    if (player.isAttacking && player.framesCurrent === 4) {
        player.isAttacking = false
    }


    if (
        rectangularCollision({
            rectangle1: enemy,
            rectangle2: player
        }) &&
        enemy.isAttacking && enemy.framesCurrent === 2
    ){
        player.takeHit()
        enemy.isAttacking = false
        document.querySelector('#playerHealth').style.width = player.health + '%'
    }

    //if enemy misses
    if (enemy.isAttacking && enemy.framesCurrent === 4) {
        enemy.isAttacking = false
    }

    // end game based on health
    if (enemy.health <= 0 || player.health <= 0) {
        determineWinner({player, enemy, timerId})
    }
}


 animate()

 window.addEventListener('keydown', (event) => {
    if (!player.dead) {
        switch (event.key) {
            case 'd':
                keys.d.pressed = true
                player.lastKey = 'd'
                break
            case 'a':
                keys.a.pressed = true
                player.lastKey = 'a'
                break
            case 'w':
                player.velocity.y = -12
                break
            case ' ':
                player.attack() 
                break

        }  
    }

    if (!enemy.dead){
        switch (event.key){
            case 'ArrowRight':
                keys.ArrowRight.pressed = true
                enemy.lastKey = 'ArrowRight'
                break
            case 'ArrowLeft':
                keys.ArrowLeft.pressed = true
                enemy.lastKey = 'ArrowLeft'
                break
            case 'ArrowUp':
                enemy.velocity.y = -12
                break
            case 'ArrowDown':
                enemy.attack()
                break
        }
    }
 })

  window.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'd':
            keys.d.pressed = false
            break
        case 'a':
            keys.a.pressed = false
            break
    }


    //enemy keys
    switch (event.key) {
        case 'ArrowRight':
            keys.ArrowRight.pressed = false
            break
        case 'ArrowLeft':
            keys.ArrowLeft.pressed = false
            break
    }
})









/*
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
const socket = io('http://192.168.0.131:3000');

let currentPlayer; // Локальный игрок
let remotePlayer;  // Удаленный игрок

// Получение цвета от сервера
socket.on('init', (data) => {
    currentPlayer = new Sprite({
        position: data.color === 'red' ? { x: 0, y: 0 } : { x: 400, y: 0 },
        velocity: { x: 0, y: 0 },
        color: data.color
    });
    currentPlayer.id = socket.id;
});

// Обработка новых игроков
socket.on('newPlayer', (playerData) => {
    if (playerData.id !== socket.id) {
        remotePlayer = new Sprite(playerData);
        remotePlayer.id = playerData.id;
    }
});

// Обработка движения удаленного игрока
socket.on('playerMoved', (playerData) => {
    if (remotePlayer && remotePlayer.id === playerData.id) {
        remotePlayer.position = playerData.position;
        remotePlayer.velocity = playerData.velocity;
        remotePlayer.lastKey = playerData.lastKey;
    }
});


// Класс Sprite (остаётся без изменений)
class Sprite {
    constructor({ position, velocity, color = 'red' }) {
        this.position = position;
        this.velocity = velocity;
        this.width = 50;
        this.height = 150;
        this.lastKey = null;
        this.color = color;

        // Исправленная атакующая зона
        this.direction = color === 'red' ? 1 : -1; // 1 - вправо, -1 - влево
        this.attackBox = {
            position: {
                x: this.position.x + (this.direction === 1 ? this.width : -100),
                y: this.position.y
            },
            width: 100,
            height: 50
        };
    }

    draw() {
        c.fillStyle = this.color;
        c.fillRect(this.position.x, this.position.y, this.width, this.height);

        // Обновляем позицию атакующей зоны
        this.attackBox.position.x = this.position.x + (this.color === 'red' ? this.width : -this.attackBox.width);
        this.attackBox.position.y = this.position.y;

        // Отрисовка атакующей зоны
        c.fillStyle = 'green';
        c.fillRect(
            this.attackBox.position.x,
            this.attackBox.position.y,
            this.attackBox.width,
            this.attackBox.height
        );
    }

    update() {
        this.draw();
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Обновляем атакующую зону при движении
        this.attackBox.position.x = this.position.x + (this.direction === 1 ? this.width : -this.attackBox.width);
        this.attackBox.position.y = this.position.y;

        // Гравитация
        if (this.position.y + this.height + this.velocity.y >= canvas.height) {
            this.velocity.y = 0;
        } else {
            this.velocity.y += gravity;
        }
    }
}

// Игрок (управляется клавиатурой)
const player = new Sprite({
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    color: 'red'
});

player.id = socket.id; // Уникальный ID игрока

const gravity = 0.7; 

// Враг (управляется другим игроком)
let enemy = null;

if (enemy) enemy.id = playerData.id;


// Обработчики сетевых событий (исправленные)
// В обработчике события playerMoved
socket.on('playerMoved', (playerData) => {
    if (remotePlayer && remotePlayer.id === playerData.id) {
        // Явно задаем скорость и позицию
        remotePlayer.position.x = playerData.position.x;
        remotePlayer.position.y = playerData.position.y;
        remotePlayer.velocity.x = playerData.velocity.x; // Добавлено
        remotePlayer.velocity.y = playerData.velocity.y; // Добавлено
        remotePlayer.lastKey = playerData.lastKey;
    }
});

socket.on('newPlayer', (playerData) => {
    enemy = new Sprite(playerData);
    enemy.id = playerData.id; // Добавляем ID врага
});

socket.on('playerMoved', (playerData) => {
    if (enemy && enemy.id === playerData.id) {
        enemy.position = playerData.position;
        enemy.velocity = playerData.velocity;
        enemy.lastKey = playerData.lastKey;
    } else if (!enemy) {
        enemy = new Sprite(playerData);
        enemy.id = playerData.id;
    }
});



socket.on('playerDisconnected', (playerId) => {
    if (enemy && enemy.id === playerId) {
        enemy = null;
    }
});

// Управление игроком (остаётся без изменений)
const keys = {
    a: { pressed: false },
    d: { pressed: false },
    w: { pressed: false },
    ArrowRight: { pressed: false },
    ArrowLeft: { pressed: false },
    ArrowUp: { pressed: false }
};

window.addEventListener('keydown', (event) => {
    console.log('Key pressed:', event.key)
    switch (event.key) {
        case 'd':
            keys.d.pressed = true;
            player.lastKey = 'd';
            break;
        case 'a':
            keys.a.pressed = true;
            player.lastKey = 'a';
            break;
        case 'w':
            player.velocity.y = -20;
            break;
    }
});

window.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'd':
            keys.d.pressed = false;
            break;
        case 'a':
            keys.a.pressed = false;
            break;
    }
});

// Анимация и отправка данных на сервер
function animate() {
    window.requestAnimationFrame(animate);
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    // Обновляем игрока
    player.update();

    // Обновляем врага (если он есть)
    if (enemy) enemy.update();

    // Движение игрока
    player.velocity.x = 0;
    if (keys.a.pressed && player.lastKey === 'a') {
        player.velocity.x = -5;
    } else if (keys.d.pressed && player.lastKey === 'd') {
        player.velocity.x = 5;
    }

    // Отправляем данные о движении на сервер
    socket.emit('playerMovement', {
        id: player.id, // Добавляем ID игрока
        position: player.position,
        velocity: player.velocity,
        lastKey: player.lastKey
    });
}

animate();*/