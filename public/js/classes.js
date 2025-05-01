// Базовый класс Sprite для работы с изображениями и анимацией
export class Sprite {
    constructor({
        position = { x: 0, y: 0 },
        imageSrc,
        scale = 1,
        framesMax = 1,
        offset = { x: 0, y: 0 },
        sprites
    }) {
        this.position = position;
        this.image = new Image();
        this.image.onerror = () => console.error('Не удалось загрузить изображение:', imageSrc);
        this.image.src = imageSrc;
        this.scale = scale;
        this.framesMax = framesMax;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 5;
        this.offset = offset;
        this.sprites = sprites;
        this.width = 0;
        this.height = 0;
        this.loaded = false;

        this.image.onload = () => {
            this.width = (this.image.width / this.framesMax) * this.scale;
            this.height = this.image.height * this.scale;
            this.loaded = true;
        };
    }

    // Отрисовка спрайта
    draw(ctx) {
        if (!this.loaded) return;

        ctx.drawImage(
            this.image,
            this.framesCurrent * (this.image.width / this.framesMax),
            0,
            this.image.width / this.framesMax,
            this.image.height,
            this.position.x - this.offset.x,
            this.position.y - this.offset.y,
            (this.image.width / this.framesMax) * this.scale,
            this.image.height * this.scale
        );
    }

    // Анимация кадров
    animateFrames() {
        this.framesElapsed++;

        if (this.framesElapsed % this.framesHold === 0) {
            if (this.framesCurrent < this.framesMax - 1) {
                this.framesCurrent++;
            } else {
                this.framesCurrent = 0;
            }
        }
    }

    // Обновление состояния
    update(ctx) {
        if (!this.loaded) return;
        this.draw(ctx);
        this.animateFrames();
    }
}

// Класс Fighter (наследуется от Sprite)
export class Fighter extends Sprite {
    constructor({
        position,
        velocity = { x: 0, y: 0 },
        color = 'red',
        imageSrc,
        scale = 1,
        framesMax = 1,
        offset = { x: 0, y: 0 },
        sprites,
        attackBox = { offset: {}, width: undefined, height: undefined }
    }) {
        super({
            position,
            imageSrc,
            scale,
            framesMax,
            offset,
            sprites
        });

        this.velocity = velocity;
        this.lastKey = null;
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
        this.dead = false;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 5;
        this.spritesLoaded = false;

        // Предзагрузка всех спрайтов персонажа с обработкой ошибок
        if (this.sprites) {
            let loadedCount = 0;
            const totalSprites = Object.keys(this.sprites).length;

            for (const sprite in this.sprites) {
                this.sprites[sprite].image = new Image();
                this.sprites[sprite].image.onerror = () => {
                    console.error('Не удалось загрузить спрайт:', this.sprites[sprite].imageSrc);
                };
                this.sprites[sprite].image.src = this.sprites[sprite].imageSrc;
                
                this.sprites[sprite].image.onload = () => {
                    loadedCount++;
                    if (loadedCount === totalSprites) {
                        this.spritesLoaded = true;
                    }
                };
            }
        }
    }

    // Обновление состояния бойца
    update(ctx, gravity, canvas) {
        if (!this.loaded || !this.spritesLoaded) return;
        
        this.draw(ctx);
        if (!this.dead) this.animateFrames();

        // Обновление позиции атакующего бокса
        this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
        this.attackBox.position.y = this.position.y + this.attackBox.offset.y;

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Гравитация и проверка нахождения на земле
        if (this.position.y + this.height + this.velocity.y >= canvas.height - 96) {
            this.velocity.y = 0;
            this.position.y = canvas.height - this.height - 96;
        } else {
            this.velocity.y += gravity;
        }
    }

    // Атака
    attack() {
        if (this.dead || !this.spritesLoaded) return;
        this.switchSprite('attack1');
        this.isAttacking = true;
    }

    // Получение урона
    takeHit() {
        if (this.dead || !this.spritesLoaded) return;
        
        this.health -= 20;

        if (this.health <= 0) {
            this.switchSprite('death');
            this.dead = true;
        } else {
            this.switchSprite('takeHit');
        }
    }

    // Переключение спрайтов
    switchSprite(sprite) {
        if (!this.spritesLoaded) return;

        // Если умер и анимация смерти завершена - не переключать
        if (this.image === this.sprites?.death?.image) {
            if (this.framesCurrent === this.sprites.death.framesMax - 1) {
                this.dead = true;
            }
            return;
        }

        // Перекрытие других анимаций
        if (
            this.image === this.sprites?.attack1?.image &&
            this.framesCurrent < this.sprites.attack1.framesMax - 1
        ) return;

        if (
            this.image === this.sprites?.takeHit?.image &&
            this.framesCurrent < this.sprites.takeHit.framesMax - 1
        ) return;

        // Защита от ошибок при отсутствии спрайта
        if (!this.sprites?.[sprite]?.image) {
            console.warn(`Спрайт не найден: ${sprite}`);
            return;
        }

        // Переключение на новый спрайт
        if (this.image !== this.sprites[sprite].image) {
            const prevImage = this.image;
            this.image = this.sprites[sprite].image;
            this.framesMax = this.sprites[sprite].framesMax;
            this.framesCurrent = 0;

            // Если изображение еще не загружено, возвращаем предыдущее
            if (!this.image.complete || this.image.naturalWidth === 0) {
                this.image = prevImage;
                return;
            }
        }
    }
}

// Класс для фона
export class Background extends Sprite {
    constructor({ position, imageSrc }) {
        super({
            position,
            imageSrc,
            scale: 1,
            framesMax: 1
        });
        this.width = 1024;
        this.height = 576;
    }

    draw(ctx) {
        if (!this.loaded) return;
        
        ctx.drawImage(
            this.image,
            this.position.x,
            this.position.y,
            this.width,
            this.height
        );
    }
}

// Класс для декораций (магазина)
export class Decoration extends Sprite {
    constructor({ position, imageSrc, scale = 1, framesMax = 1 }) {
        super({
            position,
            imageSrc,
            scale,
            framesMax
        });
    }
}
