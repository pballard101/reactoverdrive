// PowerupManager.js - Handles power-up spawning, interactions, and effects

export default class PowerupManager {
    constructor(scene) {
        this.scene = scene;

        // Power-up state
        this.powerupHex = null;
        this.powerupHexColorIndex = 0;
        this.powerupHexColors = [0x0088ff, 0x00ff88, 0xff8800]; // Blue, Green, Orange
        this.powerupHexColorNames = ['blue', 'green', 'orange'];
        this.powerupHexColorTimer = null;
        this.powerupParticleEmitter = null; // For magical trail effect
    }

    spawnPowerupHex() {
        // Only spawn if there isn't already one active
        if (this.powerupHex && this.powerupHex.active) return;

        console.log('🔷 Spawning powerup hex...');

        try {
            // Get game dimensions
            const gameWidth = this.scene.gameWidth || 1280;
            const gameHeight = this.scene.gameHeight || 720;

            // Create a canvas for the powerup hex
            const hexSize = 30;
            const colorName = this.powerupHexColorNames[this.powerupHexColorIndex];
            const color = this.powerupHexColors[this.powerupHexColorIndex];

            // Create a canvas with willReadFrequently=true to optimize
            const canvas = document.createElement('canvas');
            canvas.width = hexSize * 2;
            canvas.height = hexSize * 2;
            canvas.willReadFrequently = true;

            const ctx = canvas.getContext('2d');

            // Clear canvas
            ctx.clearRect(0, 0, hexSize * 2, hexSize * 2);

            // Create the circle fill
            ctx.fillStyle = Phaser.Display.Color.HexStringToColor('#' + color.toString(16).padStart(6, '0')).rgba;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;

            // Draw circle
            const circleRadius = hexSize;
            ctx.beginPath();
            ctx.arc(hexSize, hexSize, circleRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Add "P" letter to the center
            ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeText('P', hexSize, hexSize);
            ctx.fillText('P', hexSize, hexSize);

            // Create unique texture name
            const textureName = `powerup-hex-${colorName}-${Math.floor(Math.random() * 10000)}`;

            // Add the canvas as a texture
            this.scene.textures.addCanvas(textureName, canvas);

            // Create the powerup hexagon at the right side of the screen with random y position
            this.powerupHex = this.scene.physics.add.sprite(
                gameWidth + 50, // Start right of the visible screen
                Phaser.Math.Between(100, gameHeight - 100),
                textureName
            );

            // Set leftward velocity
            this.powerupHex.setVelocityX(-100);

            // Set properties
            this.powerupHex.setDepth(100); // Higher depth so it's in front of the particle trail (depth 50)
            this.powerupHex.enemyType = 'powerupHex';
            this.powerupHex.setScale(0.75); // Make it smaller (75% of original size)

            // Add glow effect (WebGL only) - using the safe helper from ParticleSystem
            if (this.scene.particleSystem) {
                this.scene.particleSystem.addGlowEffect(
                    this.powerupHex,
                    this.powerupHexColors[this.powerupHexColorIndex]
                );
            }

            // Create magical particle trail
            this.createMagicalTrail();

            // Add pulsing effect (reduced scale range)
            this.scene.tweens.add({
                targets: this.powerupHex,
                scale: 0.9, // Pulse between 0.75 and 0.9 instead of 1.0 and 1.2
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Setup color cycling timer
            if (this.powerupHexColorTimer) {
                this.powerupHexColorTimer.remove();
            }

            this.powerupHexColorTimer = this.scene.time.addEvent({
                delay: 2000, // Change color every 2 seconds
                callback: () => {
                    if (this.powerupHex && this.powerupHex.active) {
                        // Cycle to next color
                        this.powerupHexColorIndex = (this.powerupHexColorIndex + 1) % this.powerupHexColors.length;

                        // Create new texture for the updated color
                        const newColorName = this.powerupHexColorNames[this.powerupHexColorIndex];
                        const newColor = this.powerupHexColors[this.powerupHexColorIndex];

                        // Create a new canvas
                        const hexSize = 30;
                        const canvas = document.createElement('canvas');
                        canvas.width = hexSize * 2;
                        canvas.height = hexSize * 2;
                        canvas.willReadFrequently = true;

                        const ctx = canvas.getContext('2d');

                        // Clear canvas
                        ctx.clearRect(0, 0, hexSize * 2, hexSize * 2);

                        // Create the circle fill
                        ctx.fillStyle = Phaser.Display.Color.HexStringToColor('#' + newColor.toString(16).padStart(6, '0')).rgba;
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.lineWidth = 2;

                        // Draw circle
                        const circleRadius = hexSize;
                        ctx.beginPath();
                        ctx.arc(hexSize, hexSize, circleRadius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();

                        // Add "P" letter to the center
                        ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                        ctx.lineWidth = 3;
                        ctx.font = 'bold 32px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.strokeText('P', hexSize, hexSize);
                        ctx.fillText('P', hexSize, hexSize);

                        // Create unique texture name
                        const newTextureName = `powerup-hex-${newColorName}-${Math.floor(Math.random() * 10000)}`;

                        // Add the canvas as a texture
                        this.scene.textures.addCanvas(newTextureName, canvas);

                        // Update texture
                        this.powerupHex.setTexture(newTextureName);

                        // Ensure scale remains at the smaller size (in case it resets)
                        this.powerupHex.setScale(0.75);

                        // Update glow effect - with safe helper
                        if (this.scene.particleSystem) {
                            // Clear existing effects first
                            this.scene.particleSystem.clearEffects(this.powerupHex);

                            // Add new glow with current color
                            this.scene.particleSystem.addGlowEffect(
                                this.powerupHex,
                                this.powerupHexColors[this.powerupHexColorIndex]
                            );
                        }

                        // Update particle trail color
                        this.updateTrailColor();

                        // Show color change effect
                        if (this.scene.particleSystem) {
                            this.scene.particleSystem.createColorChangeEffect(
                                this.powerupHex.x,
                                this.powerupHex.y,
                                this.powerupHexColors[this.powerupHexColorIndex]
                            );
                        }
                    }
                },
                loop: true
            });

            // Add collision with player
            this.scene.physics.add.overlap(this.scene.player.sprite, this.powerupHex, (p, h) => {
                // Store position before destroying the powerup
                const powerupX = h.x;
                const powerupY = h.y;
                const colorIndex = this.powerupHexColorIndex;
                const colorName = this.powerupHexColorNames[colorIndex];

                // Apply effect based on current color
                this.applyPowerupEffect(colorIndex);

                // Use particle absorption effect instead of explosion
                if (this.scene.uiManager && typeof this.scene.uiManager.createPowerupAbsorptionEffect === 'function') {
                    this.scene.uiManager.createPowerupAbsorptionEffect(colorName, powerupX, powerupY);
                } else if (this.scene.particleSystem) {
                    // Fallback to regular explosion if the absorption effect method doesn't exist
                    this.scene.particleSystem.createExplosion(
                        powerupX,
                        powerupY,
                        h.width,
                        this.powerupHexColors[colorIndex]
                    );
                }

                // Destroy the particle emitter manager
                if (this.powerupParticleManager) {
                    this.powerupParticleManager.destroy();
                    this.powerupParticleManager = null;
                    this.powerupParticleEmitter = null;
                }

                // Destroy the powerup
                h.destroy();

                // Schedule next powerup spawn
                this.scene.time.delayedCall(Phaser.Math.Between(5000, 10000), () => {
                    this.spawnPowerupHex();
                });
            });

            // Add check for powerup going off screen
            this.scene.time.addEvent({
                delay: 100,
                callback: () => {
                    if (this.powerupHex && this.powerupHex.active && this.powerupHex.x < -50) {
                        // Destroy the particle emitter manager
                        if (this.powerupParticleManager) {
                            this.powerupParticleManager.destroy();
                            this.powerupParticleManager = null;
                            this.powerupParticleEmitter = null;
                        }

                        this.powerupHex.destroy();

                        // Schedule next powerup spawn
                        this.scene.time.delayedCall(Phaser.Math.Between(3000, 6000), () => {
                            this.spawnPowerupHex();
                        });
                    }
                },
                loop: true
            });

            return this.powerupHex;
        } catch (error) {
            console.warn("Error spawning powerup hex:", error);
            return null;
        }
    }

    createMagicalTrail() {
        try {
            // Create a STAR particle texture for the magical trail
            const particleSize = 16;
            const particleCanvas = document.createElement('canvas');
            particleCanvas.width = particleSize;
            particleCanvas.height = particleSize;
            const particleCtx = particleCanvas.getContext('2d');

            // Draw a 5-pointed star
            const centerX = particleSize / 2;
            const centerY = particleSize / 2;
            const outerRadius = particleSize / 2 - 1;
            const innerRadius = outerRadius / 2.5;
            const points = 5;

            particleCtx.beginPath();
            for (let i = 0; i < points * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (Math.PI / points) * i - Math.PI / 2;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                if (i === 0) {
                    particleCtx.moveTo(x, y);
                } else {
                    particleCtx.lineTo(x, y);
                }
            }
            particleCtx.closePath();

            // Fill with white (will be tinted by the emitter)
            particleCtx.fillStyle = 'rgba(255, 255, 255, 1.0)';
            particleCtx.fill();

            // Add glow outline
            particleCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            particleCtx.lineWidth = 1;
            particleCtx.stroke();

            // Add texture to scene
            const particleTextureName = `powerup-trail-particle-${Date.now()}`;
            this.scene.textures.addCanvas(particleTextureName, particleCanvas);
            this.particleTextureName = particleTextureName; // Store for later use

            console.log('✨ Creating magical trail for powerup');
            console.log('Particle texture name:', particleTextureName);
            console.log('Powerup hex exists:', !!this.powerupHex);

            // Get current color
            const currentColor = this.powerupHexColors[this.powerupHexColorIndex];
            console.log('Particle color:', currentColor.toString(16));

            // Create particle emitter manager and emitter for the trail
            const particleManager = this.scene.add.particles(particleTextureName);

            this.powerupParticleEmitter = particleManager.createEmitter({
                follow: this.powerupHex,
                x: 30, // Offset to the right (behind as it moves left)
                y: 0,
                lifespan: 1500,
                speed: 0, // No movement - stars just appear and twinkle
                scale: {
                    start: 1.2, // Smaller stars
                    end: 0.2    // Fade to very small
                },
                alpha: {
                    start: 1.0,
                    end: 0,
                    ease: 'Sine.easeInOut' // Smooth twinkling fade
                },
                blendMode: 'ADD',
                frequency: 30, // Slightly more dense (was 40)
                tint: currentColor,
                gravityY: 0,
                rotate: {
                    start: 0,
                    end: 360,
                    ease: 'Linear' // Slow spinning stars
                },
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Rectangle(-5, -27.5, 10, 55) // 55px tall, centered
                }
            });

            console.log('✅ Particle emitter created successfully');
            console.log('Emitter on:', this.powerupParticleEmitter.on);

            // Set depth BEHIND the powerup circle so circle is in front
            particleManager.setDepth(50);

            // Store the manager so we can destroy it later
            this.powerupParticleManager = particleManager;

            console.log('Particle manager depth:', particleManager.depth);
            console.log('Particle manager visible:', particleManager.visible);
        } catch (error) {
            console.error('Error creating magical trail:', error);
        }
    }

    updateTrailColor() {
        // Update the particle emitter color to match current powerup color
        if (this.powerupParticleEmitter && this.powerupHex && this.powerupHex.active) {
            const currentColor = this.powerupHexColors[this.powerupHexColorIndex];

            // Just update the tint, don't recreate the entire emitter!
            this.powerupParticleEmitter.setTint(currentColor);

            console.log('🎨 Updated particle trail color to:', currentColor.toString(16));
        }
    }

    applyPowerupEffect(colorIndex) {
        try {
            // Get current color name
            const colorName = this.powerupHexColorNames[colorIndex];


            // Apply effect based on color
            switch (colorName) {
                case 'blue':
                    // Blue - Add energy
                    this.scene.player.addEnergy(25);

                    // Play powerup energy sound
                    if (this.scene.soundManager) {
                        this.scene.soundManager.playPowerupEnergy();
                    }

                    // Show effect text
                    this.scene.uiManager.showPowerupEffect('energy', 25);
                    break;

                case 'green':
                    // Green - Add health (increased from 10 to 25)
                    const healthBefore = this.scene.player.health;
                    this.scene.player.health = Math.min(100, this.scene.player.health + 25);
                    const healthAdded = this.scene.player.health - healthBefore;

                    // Play powerup health sound
                    if (this.scene.soundManager) {
                        this.scene.soundManager.playPowerupHealth();
                    }


                    // Update health bar
                    this.scene.uiManager.updateHealthBar();

                    // Show effect text
                    this.scene.uiManager.showPowerupEffect('health', healthAdded);
                    break;

                case 'orange':
                    // Orange - Add gun power and increase fire rate
                    if (this.scene.player.increaseGunPower()) {
                        // Play powerup gun sound
                        if (this.scene.soundManager) {
                            this.scene.soundManager.playPowerupGun();
                        }

                        // Calculate new fire rate description based on gun power level
                        const gunPowerLevel = this.scene.player.gunPowerLevel;
                        const baseDelay = 250;
                        let newDelay;
                        let powerDescription;

                        if (gunPowerLevel === 1) {
                            newDelay = Math.round(baseDelay / 1.25);
                            powerDescription = `25% FASTER!`;
                        } else if (gunPowerLevel === 2) {
                            newDelay = Math.round(baseDelay / 1.4);
                            powerDescription = `40% FASTER!`;
                        } else {
                            newDelay = Math.round(baseDelay / 1.5);
                            powerDescription = `50% FASTER + DOUBLE SHOT!`;
                        }

                        // Show effect text
                        this.scene.uiManager.showPowerupEffect('gunpower', powerDescription);
                    } else {
                        // Already at max gun power, give score instead
                        this.scene.addScore(500);

                        // Still play the sound for feedback
                        if (this.scene.soundManager) {
                            this.scene.soundManager.playPowerupGun();
                        }

                        // Show effect text
                        this.scene.uiManager.showPowerupEffect('score', 500);
                    }
                    break;
            }

            // No screen flash effect to prevent issues
        } catch (error) {
            console.warn("Error applying powerup effect:", error);
        }
    }

    update() {
        // Update particle trail position if needed
        // (Phaser's follow system handles this automatically)
    }

    cleanup() {
        // Clean up timers and emitters
        if (this.powerupHexColorTimer) {
            this.powerupHexColorTimer.remove();
            this.powerupHexColorTimer = null;
        }

        if (this.powerupParticleManager) {
            this.powerupParticleManager.destroy();
            this.powerupParticleManager = null;
            this.powerupParticleEmitter = null;
        }

        if (this.powerupHex) {
            this.powerupHex.destroy();
            this.powerupHex = null;
        }
    }
}
