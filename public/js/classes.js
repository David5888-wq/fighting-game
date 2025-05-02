class Sprite {
    constructor({
        position,
        imageSrc,
        scale = 1,
        framesMax = 1,
        offset = { x: 0, y: 0 },
        animationSpeed = 100
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
        this.animationSpeed = animationSpeed;
        this.lastFrameUpdate = Date.now();
        this.lastUpdate = Date.now();
        this.loaded = false;

        // Добавляем обработчики загрузки изображения
        this.image.onload = () => {
            console.log(`Image loaded: ${imageSrc}`);
            this.loaded = true;
            this.width = (this.image.width / this.framesMax) * this.scale;
            this.height = this.image.height * this.scale;
        };

        this.image.onerror = () => {
            console.error(`Failed to load image: ${imageSrc}`);
        };
    }

    draw() {
        if (!this.loaded) {
            // Временная замена при отсутствии изображения
            c.fillStyle = 'rgba(255, 0, 0, 0.5)';
            c.fillRect(
                this.position.x - this.offset.x,
                this.position.y - this.offset.y,
                50 * this.scale,
                150 * this.scale
            );
            return;
        }

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

        // Отладочная отрисовка границ
        if (debug) {
            c.strokeStyle = 'green';
            c.lineWidth = 2;
            c.strokeRect(
                this.position.x - this.offset.x,
                this.position.y - this.offset.y,
                frameWidth * this.scale,
                this.image.height * this.scale
            );
        }
    }

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
        this.currentSprite = 'idle';

        // Улучшенная предзагрузка всех анимаций
        this.preloadSprites().then(() => {
            console.log('All sprites loaded for fighter');
        }).catch(err => {
            console.error('Error loading sprites:', err);
        });
    }

    async preloadSprites() {
        const loadPromises = [];
        
        for (const sprite in this.sprites) {
            const spriteData = this.sprites[sprite];
            spriteData.image = new Image();
            
            const loadPromise = new Promise((resolve, reject) => {
                spriteData.image.onload = () => {
                    console.log(`Sprite loaded: ${spriteData.imageSrc}`);
                    resolve();
                };
                spriteData.image.onerror = () => {
                    console.error(`Failed to load sprite: ${spriteData.imageSrc}`);
                    reject(`Failed to load ${spriteData.imageSrc}`);
                };
                spriteData.image.src = spriteData.imageSrc;
            });
            
            loadPromises.push(loadPromise);
        }
        
        await Promise.all(loadPromises);
    }

    update(deltaTime) {
        if (!this.loaded) return;

        super.update(deltaTime);
        if (this.dead) return;

        const timeFactor = deltaTime / 16.67;
        this.position.x += this.velocity.x * timeFactor;
        this.position.y += this.velocity.y * timeFactor;

        this.velocity.y += gravity * timeFactor;

        if (this.position.y + this.height >= canvas.height - 96) {
            this.velocity.y = 0;
            this.position.y = 330;
        }

        this.attackBox.position.x = this.position.x + 
            (this.isEnemy ? -this.attackBox.offset.x : this.attackBox.offset.x);
        this.attackBox.position.y = this.position.y + this.attackBox.offset.y;

        // Отладочная отрисовка атак бокса
        if (debug && this.attackBox.width) {
            c.fillStyle = 'rgba(255, 0, 0, 0.3)';
            c.fillRect(
                this.attackBox.position.x,
                this.attackBox.position.y,
                this.attackBox.width,
                this.attackBox.height
            );
        }
    }

    attack() {
        if (this.dead || !this.loaded) return;
        this.switchSprite('attack1');
        this.isAttacking = true;
    }

    takeHit() {
        if (this.dead || !this.loaded) return;
        
        this.health -= 20;
        this.switchSprite('takeHit');

        if (this.health <= 0) {
            this.switchSprite('death');
            this.dead = true;
        }
    }

    switchSprite(sprite) {
        if (!this.sprites[sprite] || !this.sprites[sprite].image) {
            console.error(`Sprite not found: ${sprite}`);
            return;
        }

        if (this.image === this.sprites.death.image) {
            if (this.framesCurrent === this.sprites.death.framesMax - 1) {
                this.dead = true;
            }
            return;
        }

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
        this.currentSprite = sprite;
    }
}