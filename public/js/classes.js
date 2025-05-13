class Sprite {
    constructor({
        position,
        imageSrc,
        scale = 1,
        framesMax = 1,
        offset = { x: 0, y: 0 },
        animationSpeed = 100 // Время в ms на кадр
    }) {
        this.position = position;
        this.image = new Image();
        this.image.src = imageSrc;
        this.scale = scale;
        this.framesMax = framesMax;
        this.framesCurrent = 0;
        this.offset = offset;
        this.width = 50;
        this.height = 150;
        
        // Параметры анимации
        this.animationSpeed = animationSpeed;
        this.lastFrameUpdate = Date.now();
        this.lastUpdate = Date.now();
    }

    draw() {
        if (!this.image.complete) return;
        
        const frameWidth = this.image.width / this.framesMax;
        c.drawImage(
            this.image,
            this.framesCurrent * frameWidth,
            0,
            frameWidth,
            this.image.height,
            this.position.x - this.offset.x,
            this.position.y - this.offset.y,
            frameWidth * this.scale,
            this.image.height * this.scale
        );
    }

    // Анимация на основе времени
    animateFrames() {
        const now = Date.now();
        if (now - this.lastFrameUpdate > this.animationSpeed) {
            this.framesCurrent = (this.framesCurrent + 1) % this.framesMax;
            this.lastFrameUpdate = now;
        }
    }

    update(deltaTime) {
        this.draw();
        this.animateFrames();
    }
}

class Fighter extends Sprite {
    constructor({
        position,
        velocity = { x: 0, y: 0 },
        color = 'red',
        imageSrc,
        scale = 1,
        framesMax = 1,
        offset = { x: 0, y: 0 },
        sprites,
        attackBox = { offset: {}, width: undefined, height: undefined },
        isEnemy = false,
        animationSpeed = 100
    }) {
        super({
            position,
            imageSrc,
            scale,
            framesMax,
            offset,
            animationSpeed
        });

        this.velocity = velocity;
        this.lastKey = '';
        this.attackBox = {
            position: {
                x: this.position.x,
                y: this.position.y
            },
            offset: attackBox.offset,
            width: attackBox.width,
            height: attackBox.height
        };
        this.color = color;
        this.isAttacking = false;
        this.health = 100;
        this.sprites = sprites;
        this.dead = false;
        this.isEnemy = isEnemy;
        this.lastAttackTime = 0;
        this.attackCooldown = 500; // Задержка между атаками в мс

        // Предзагрузка всех анимаций
        for (const sprite in this.sprites) {
            this.sprites[sprite].image = new Image();
            this.sprites[sprite].image.src = this.sprites[sprite].imageSrc;
        }
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (this.dead) return;

        // Физика с deltaTime
        const timeFactor = deltaTime / 16.67; // Нормализация для 60 FPS
        this.position.x += this.velocity.x * timeFactor;
        this.position.y += this.velocity.y * timeFactor;

        // Гравитация
        this.velocity.y += gravity * timeFactor;

        // Ограничение по земле
        if (this.position.y + this.height >= canvas.height - 96) {
            this.velocity.y = 0;
            this.position.y = 330;
        }

        // Ограничение по стенам
        if (this.position.x <= 0) {
            this.position.x = 0;
        } else if (this.position.x + this.width >= canvas.width) {
            this.position.x = canvas.width - this.width;
        }

        // Обновление атак бокса
        this.attackBox.position.x = this.position.x + 
            (this.isEnemy ? -this.attackBox.offset.x : this.attackBox.offset.x);
        this.attackBox.position.y = this.position.y + this.attackBox.offset.y;

        // Автоматическое возвращение в idle после атаки
        if (this.isAttacking && Date.now() - this.lastAttackTime > this.attackCooldown) {
            this.isAttacking = false;
            this.switchSprite('idle');
        }

        // Рисование атак бокса (для отладки)
        if (debug && this.attackBox.width) {
            c.fillStyle = 'rgba(255, 0, 0, 0.5)';
            c.fillRect(
                this.attackBox.position.x,
                this.attackBox.position.y,
                this.attackBox.width,
                this.attackBox.height
            );
        }
    }

    attack() {
        if (this.dead || Date.now() - this.lastAttackTime < this.attackCooldown) return;
        
        this.switchSprite('attack1');
        this.isAttacking = true;
        this.lastAttackTime = Date.now();
    }

    takeHit() {
        if (this.dead) return;
        
        this.health = Math.max(0, this.health - 20);
        this.switchSprite('takeHit');

        if (this.health <= 0) {
            this.switchSprite('death');
            this.dead = true;
        }
    }

    // Улучшенная смена анимаций
    switchSprite(sprite) {
        if (this.image === this.sprites.death.image) {
            if (this.framesCurrent === this.sprites.death.framesMax - 1) {
                this.dead = true;
            }
            return;
        }

        // Приоритет анимаций
        const priority = ['death', 'takeHit', 'attack1'];
        if (priority.includes(sprite) && this.image !== this.sprites[sprite].image) {
            this.overrideAnimation(sprite);
            return;
        }

        if (
            (this.image === this.sprites.attack1.image && 
             this.framesCurrent < this.sprites.attack1.framesMax - 1) ||
            (this.image === this.sprites.takeHit.image && 
             this.framesCurrent < this.sprites.takeHit.framesMax - 1)
        ) return;

        this.overrideAnimation(sprite);
    }

    overrideAnimation(sprite) {
        this.image = this.sprites[sprite].image;
        this.framesMax = this.sprites[sprite].framesMax;
        this.framesCurrent = 0;
        this.animationSpeed = this.sprites[sprite].animationSpeed || 100;
    }
}