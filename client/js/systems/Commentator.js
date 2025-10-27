/**
 * Commentator - Displays trippy encouraging text after killing enemies
 */
export default class Commentator {
    constructor(scene) {
        this.scene = scene;
        this.killCount = 0;
        this.lastCommentKillCount = 0;
        this.killThreshold = 5; // Comment every 5 kills

        // Trippy phrases
        this.phrases = [
            "EXCELLENT!",
            "YOU ROCK!",
            "KEEP GOING!",
            "YOU'RE A BEAST!",
            "UNSTOPPABLE!",
            "LEGENDARY!",
            "ON FIRE!",
            "CRUSHING IT!",
            "INSANE!",
            "GODLIKE!",
            "DOMINATING!",
            "SPECTACULAR!",
            "AMAZING!",
            "PHENOMENAL!",
            "INCREDIBLE!",
            "SICK MOVES!",
            "TOO GOOD!",
            "UNREAL!",
            "PERFECTION!",
            "FLAWLESS!"
        ];

        // Trippy colors
        this.colors = [
            '#ff00ff', // Magenta
            '#00ffff', // Cyan
            '#ffff00', // Yellow
            '#ff0099', // Hot pink
            '#00ff99', // Mint
            '#9900ff', // Purple
            '#ff9900', // Orange
            '#00ff00', // Green
            '#ff0066', // Red-pink
            '#66ff00'  // Lime
        ];

        // Animation effects - weighted toward sizzle for more trippiness
        this.effects = [
            'sizzle',
            'sizzle',  // More likely
            'sizzle',  // Even more likely
            'explode',
            'fadeOut',
            'shrink',
            'spin',
            'chromatic',
            'pulse',
            'bounce',
            'wobble'
        ];

        // Active letter containers for cleanup
        this.activeLetterContainers = [];
    }

    /**
     * Register a kill (not from energy weapon)
     */
    registerKill() {
        this.killCount++;

        // Check if we should show a comment
        if (this.killCount - this.lastCommentKillCount >= this.killThreshold) {
            this.showComment();
            this.lastCommentKillCount = this.killCount;
        }
    }

    /**
     * Reset kill counter (called when player dies or song ends)
     */
    reset() {
        this.killCount = 0;
        this.lastCommentKillCount = 0;
    }

    /**
     * Show a trippy comment
     */
    showComment() {
        // Random phrase
        const phrase = this.phrases[Math.floor(Math.random() * this.phrases.length)];

        // Random position (avoid edges)
        const x = Phaser.Math.Between(
            this.scene.gameWidth * 0.2,
            this.scene.gameWidth * 0.8
        );
        const y = Phaser.Math.Between(
            this.scene.gameHeight * 0.2,
            this.scene.gameHeight * 0.6
        );

        // Random size
        const fontSize = Phaser.Math.Between(32, 72);

        // Random effect
        const effect = this.effects[Math.floor(Math.random() * this.effects.length)];

        // For sizzle and chromatic effects, create individual letters
        if (effect === 'sizzle' || effect === 'chromatic') {
            this.createLetterEffect(phrase, x, y, fontSize, effect);
        } else {
            // For other effects, use regular text with reduced opacity
            const color = this.colors[Math.floor(Math.random() * this.colors.length)];
            const text = this.scene.add.text(x, y, phrase, {
                fontSize: `${fontSize}px`,
                fontFamily: 'Arial Black, sans-serif',
                color: color,
                stroke: '#000000',
                strokeThickness: 4,
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(1000).setAlpha(0.75);

            // Apply the random effect
            this.applyEffect(text, effect);
        }
    }

    /**
     * Create individual letter effects (sizzle or chromatic)
     */
    createLetterEffect(phrase, centerX, centerY, fontSize, effect) {
        // Create a container for all letters
        const container = this.scene.add.container(centerX, centerY);
        container.setDepth(1000);
        this.activeLetterContainers.push(container);

        // Calculate total width to center the letters
        const letterSpacing = fontSize * 0.6;
        const totalWidth = (phrase.length - 1) * letterSpacing;
        const startX = -totalWidth / 2;

        // Create each letter
        const letters = [];
        for (let i = 0; i < phrase.length; i++) {
            const letter = phrase[i];
            const letterX = startX + (i * letterSpacing);

            // Random initial color
            const color = this.colors[Math.floor(Math.random() * this.colors.length)];

            const letterText = this.scene.add.text(letterX, 0, letter, {
                fontSize: `${fontSize}px`,
                fontFamily: 'Arial Black, sans-serif',
                color: color,
                stroke: '#000000',
                strokeThickness: 4,
                fontStyle: 'bold'
            }).setOrigin(0.5).setAlpha(0.7);

            container.add(letterText);
            letters.push({
                text: letterText,
                colorIndex: Math.floor(Math.random() * this.colors.length),
                originalX: letterX,
                originalY: 0
            });
        }

        // Apply the appropriate effect
        if (effect === 'sizzle') {
            this.sizzleEffect(container, letters);
        } else if (effect === 'chromatic') {
            this.chromaticEffect(container, letters);
        }
    }

    /**
     * Apply a trippy effect to the text
     */
    applyEffect(text, effect) {
        switch (effect) {
            case 'explode':
                this.explodeEffect(text);
                break;
            case 'fadeOut':
                this.fadeOutEffect(text);
                break;
            case 'shrink':
                this.shrinkEffect(text);
                break;
            case 'spin':
                this.spinEffect(text);
                break;
            case 'pulse':
                this.pulseEffect(text);
                break;
            case 'bounce':
                this.bounceEffect(text);
                break;
            case 'wobble':
                this.wobbleEffect(text);
                break;
            // Note: sizzle and chromatic are handled separately in createLetterEffect
        }
    }

    /**
     * Explode effect - scale up rapidly then destroy
     */
    explodeEffect(text) {
        this.scene.tweens.add({
            targets: text,
            scaleX: 3,
            scaleY: 3,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }

    /**
     * Fade out effect
     */
    fadeOutEffect(text) {
        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            duration: 1500,
            ease: 'Linear',
            onComplete: () => text.destroy()
        });
    }

    /**
     * Shrink effect
     */
    shrinkEffect(text) {
        this.scene.tweens.add({
            targets: text,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 800,
            ease: 'Back.easeIn',
            onComplete: () => text.destroy()
        });
    }

    /**
     * Spin effect
     */
    spinEffect(text) {
        this.scene.tweens.add({
            targets: text,
            angle: 720,
            alpha: 0,
            duration: 1000,
            ease: 'Linear',
            onComplete: () => text.destroy()
        });
    }


    /**
     * Pulse effect - scale up and down
     */
    pulseEffect(text) {
        this.scene.tweens.add({
            targets: text,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 300,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut'
        });

        // Fade out at the end
        this.scene.time.delayedCall(1200, () => {
            this.scene.tweens.add({
                targets: text,
                alpha: 0,
                duration: 300,
                onComplete: () => text.destroy()
            });
        });
    }

    /**
     * Bounce effect - move up then fall down
     */
    bounceEffect(text) {
        this.scene.tweens.add({
            targets: text,
            y: text.y - 100,
            duration: 400,
            ease: 'Quad.easeOut',
            yoyo: true,
            onComplete: () => {
                // Fade out
                this.scene.tweens.add({
                    targets: text,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => text.destroy()
                });
            }
        });
    }

    /**
     * Wobble effect - shake and rotate randomly
     */
    wobbleEffect(text) {
        const wobbleTimer = this.scene.time.addEvent({
            delay: 50,
            repeat: 20,
            callback: () => {
                text.setRotation(Phaser.Math.FloatBetween(-0.3, 0.3));
                text.x += Phaser.Math.Between(-5, 5);
                text.y += Phaser.Math.Between(-5, 5);
            }
        });

        // Fade out at the end
        this.scene.time.delayedCall(1000, () => {
            this.scene.tweens.add({
                targets: text,
                alpha: 0,
                duration: 300,
                onComplete: () => text.destroy()
            });
        });
    }

    /**
     * Sizzle effect - each letter cycles through rainbow colors independently
     */
    sizzleEffect(container, letters) {
        // Each letter gets its own color cycling timer with random offset
        letters.forEach((letter, index) => {
            const delay = index * 30; // Stagger the start of each letter's cycling

            this.scene.time.delayedCall(delay, () => {
                // Create a timer that cycles the color for this letter
                const colorTimer = this.scene.time.addEvent({
                    delay: 80, // Fast color cycling
                    repeat: 25, // About 2 seconds of cycling
                    callback: () => {
                        letter.colorIndex = (letter.colorIndex + 1) % this.colors.length;
                        letter.text.setColor(this.colors[letter.colorIndex]);
                    }
                });
            });
        });

        // Fade out the entire container at the end
        this.scene.time.delayedCall(2000, () => {
            this.scene.tweens.add({
                targets: container,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    container.destroy();
                    // Remove from active containers
                    const index = this.activeLetterContainers.indexOf(container);
                    if (index > -1) {
                        this.activeLetterContainers.splice(index, 1);
                    }
                }
            });
        });
    }

    /**
     * Chromatic effect - letters separate with RGB color shift
     */
    chromaticEffect(container, letters) {
        // Create RGB layers for each letter
        letters.forEach((letter, index) => {
            const delay = index * 20;

            this.scene.time.delayedCall(delay, () => {
                // Animate letter with chromatic aberration
                // Red shift
                this.scene.tweens.add({
                    targets: letter.text,
                    x: letter.originalX + 3,
                    duration: 150,
                    yoyo: true,
                    repeat: 5,
                    ease: 'Sine.easeInOut'
                });

                // Cycle through colors rapidly for chromatic effect
                const colorTimer = this.scene.time.addEvent({
                    delay: 100,
                    repeat: 15,
                    callback: () => {
                        letter.colorIndex = (letter.colorIndex + 1) % this.colors.length;
                        letter.text.setColor(this.colors[letter.colorIndex]);
                    }
                });
            });
        });

        // Wobble the whole container slightly
        this.scene.tweens.add({
            targets: container,
            angle: -5,
            duration: 200,
            yoyo: true,
            repeat: 4,
            ease: 'Sine.easeInOut'
        });

        // Fade out at the end
        this.scene.time.delayedCall(1800, () => {
            this.scene.tweens.add({
                targets: container,
                alpha: 0,
                duration: 400,
                onComplete: () => {
                    container.destroy();
                    // Remove from active containers
                    const index = this.activeLetterContainers.indexOf(container);
                    if (index > -1) {
                        this.activeLetterContainers.splice(index, 1);
                    }
                }
            });
        });
    }

    /**
     * Cleanup when scene ends
     */
    destroy() {
        // Clean up any active letter containers
        this.activeLetterContainers.forEach(container => {
            if (container && container.active) {
                container.destroy();
            }
        });
        this.activeLetterContainers = [];
    }
}
