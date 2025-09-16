// Player.js - Player ship and related functionality

export default class Player {
    constructor(scene, x, y, existingSprite = null) {
        this.scene = scene;
        
        // Use existing sprite if provided, otherwise create new one
        if (existingSprite) {
            this.sprite = existingSprite;
        } else {
            // Create the player sprite
            this.sprite = scene.physics.add.sprite(x, y, 'player-ship');
            
            // Ensure physics is enabled
            if (this.sprite.body) {
                this.sprite.body.setCollideWorldBounds(true);
                this.sprite.body.enable = true;
            } else {
                console.error("No physics body on created player sprite!");
            }
        }
        
        // Player attributes
        this.health = 100;
        this.energy = 75; // Start with 75% energy - need one powerup to activate special
        this.gunPowerLevel = 0;
        this.energyFull = false; // Energy not full at start
        this.energyWeaponActive = false;
        this.energyWeaponTimer = 0;
        this.bulletTime = 0;
        
        // Keep track of active bullets for cleanup
        this.activeBullets = [];
        
        // Track rotation timers for damage effect
        this.rotationTimers = [];
        
        // Add visual effects to player
        this.addVisualEffects();
        
    }
    
    get x() {
        return this.sprite.x;
    }
    
    get y() {
        return this.sprite.y;
    }
    
    addVisualEffects() {
        // Add FX to the player ship (WebGL only)
        if (this.scene.renderer.type === Phaser.WEBGL) {
            try {
                // Use a safer approach to add effects
                if (this.sprite && this.scene.particleSystem) {
                    // Use the safe helper method from ParticleSystem if available
                    this.scene.particleSystem.addGlowEffect(this.sprite, 0x00ff00, 4);
                } else if (this.sprite && this.sprite.preFX) {
                    // Fallback to direct preFX if available
                    this.sprite.preFX.addGlow(0x00ff00, 4, 0, false);
                    this.sprite.preFX.addShine(0.5, 0.5, 3, false);
                }
            } catch (error) {
                console.warn("Error applying player FX:", error);
            }
        }
        
        // Add a glow effect around the player (for Canvas fallback)
        this.glow = this.scene.add.circle(this.x, this.y, 20, 0x00ff00, 0.3);
        this.glow.setDepth(-1);
        
        // Make the glow follow the player
        this.glowFollower = this.scene.time.addEvent({
            delay: 30,
            callback: () => {
                if (this.glow && this.glow.active) {
                    this.glow.x = this.sprite.x;
                    this.glow.y = this.sprite.y;
                }
            },
            loop: true
        });
        
        // Add a pulsing effect to the glow
        this.scene.tweens.add({
            targets: this.glow,
            scale: 1.3,
            alpha: 0.2,
            duration: 800,
            yoyo: true,
            repeat: -1
        });
    }
    
    setupAutoFire() {
        // Calculate fire rate based on gun power level
        const baseDelay = 250;
        let fireDelay;
        
        switch(this.gunPowerLevel) {
            case 1:
                // Level 1: 25% faster
                fireDelay = Math.round(baseDelay / 1.25);
                break;
            case 2:
                // Level 2: 40% faster
                fireDelay = Math.round(baseDelay / 1.4);
                break;
            case 3:
                // Level 3: 50% faster
                fireDelay = Math.round(baseDelay / 1.5);
                break;
            default:
                fireDelay = baseDelay;
        }
        
        // Remove existing timer if it exists
        if (this.autoFireTimer) {
            this.autoFireTimer.remove();
        }
        
        // Create new auto-fire timer
        this.autoFireTimer = this.scene.time.addEvent({
            delay: fireDelay,
            callback: () => {
                this.fireBullet();
            },
            loop: true
        });
        
    }
    
    update() {
        // Make sure scene exists
        if (!this.scene || !this.sprite) {
            console.error("Scene or player sprite not available in update");
            return;
        }
        
        // Handle movement based on input keys
        this.handleMovement();
        
        // Check for energy weapon activation
        if (this.scene.eKey && this.scene.eKey.isDown && this.energyFull && !this.energyWeaponActive) {
            this.activateEnergyWeapon();
        }
        
        // Check if energy weapon is active
        if (this.energyWeaponActive) {
            if (this.scene.time.now > this.energyWeaponTimer) {
                this.energyWeaponActive = false;
            } else {
                this.handleEnergyWeaponEffects();
            }
        }
        
        // Safety check: if camera is still rotated after all rotation timers are done
        // This prevents the screen from getting stuck in a tilted position
        if (this.rotationTimers.length === 0 && this.scene.cameras.main.rotation !== 0) {
            this.scene.cameras.main.rotation = 0;
        }
        
        // Clean up bullets that have gone off-screen
        this.cleanupBullets();
    }
    
    // Movement handler with gamepad support
    handleMovement() {
        // Ensure we have a physics body
        if (!this.sprite.body || !this.sprite.body.enable) {
            console.warn("Player physics body not available for movement");
            return;
        }
        
        // Set base movement speed
        const speed = 300;
        let vx = 0;
        let vy = 0;
        
        // Check for gamepad input first
        if (this.scene.gamepadConnected && this.scene.activeGamepad) {
            const pad = this.scene.activeGamepad;
            
            // Get left stick values with dead zone applied
            const deadZone = 0.1;
            let leftStickX = Math.abs(pad.leftStick.x) > deadZone ? pad.leftStick.x : 0;
            let leftStickY = Math.abs(pad.leftStick.y) > deadZone ? pad.leftStick.y : 0;
            
            // Also check for D-pad input
            if (pad.left) {
                leftStickX = -1;
            } else if (pad.right) {
                leftStickX = 1;
            }
            
            if (pad.up) {
                leftStickY = -1;
            } else if (pad.down) {
                leftStickY = 1;
            }
            
            // Apply analog stick values to velocity
            if (leftStickX !== 0 || leftStickY !== 0) {
                vx = speed * leftStickX;
                vy = speed * leftStickY;
            }
        }
        
        // If no gamepad movement detected, check keyboard input
        if (vx === 0 && vy === 0) {
            // Get input keys
            const cursors = this.scene.cursors;
            const wasd = {
                left: this.scene.aKey,
                right: this.scene.dKey,
                up: this.scene.wKey, 
                down: this.scene.sKey
            };
            
            // Handle horizontal movement
            if (cursors.left.isDown || wasd.left.isDown) {
                vx = -speed;
            } else if (cursors.right.isDown || wasd.right.isDown) {
                vx = speed;
            }
            
            // Handle vertical movement
            if (cursors.up.isDown || wasd.up.isDown) {
                vy = -speed;
            } else if (cursors.down.isDown || wasd.down.isDown) {
                vy = speed;
            }
        }
        
        // Apply velocity
        this.sprite.setVelocity(vx, vy);

        // Make sure player stays within game bounds
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Apply bounds manually as a fallback
        if (this.sprite.x < 0) this.sprite.x = 0;
        if (this.sprite.y < 0) this.sprite.y = 0;
        if (this.sprite.x > gameWidth) this.sprite.x = gameWidth;
        if (this.sprite.y > gameHeight) this.sprite.y = gameHeight;
    }
    
    cleanupBullets() {
        // Remove references to bullets that are no longer active
        const now = this.scene.time.now;
        
        // Check for bullets that have gone off-screen (been alive more than 2 seconds)
        this.activeBullets = this.activeBullets.filter(bullet => {
            if (!bullet.active || now - bullet.creationTime > 2000) {
                // Clean up associated resources if they exist
                if (bullet.trailEmitter) {
                    bullet.trailEmitter.stop();
                    bullet.trailEmitter.destroy();
                }
                
                if (bullet.followEvent) {
                    bullet.followEvent.remove();
                }
                
                // Deactivate the bullet if it's still active
                if (bullet.active) {
                    bullet.setActive(false);
                    bullet.setVisible(false);
                }
                
                return false; // Remove from the active bullets array
            }
            return true; // Keep in the active bullets array
        });
    }
    
    fireBullet() {
        // Get current time
        const time = this.scene.time.now;
        
        // Make sure scene and bullets exist
        if (!this.scene || !this.scene.bullets) {
            console.error("Scene or bullets group not available for firing");
            return;
        }
        
        // Check if enough time has passed since last bullet
        if (time > this.bulletTime) {
            
            // Play bullet fire sound
            if (this.scene.soundManager) {
                this.scene.soundManager.playBulletFire();
            }
            
            // Fire main bullet - now firing from right side of ship
            this.fireSingleBullet(this.sprite.x + 20, this.sprite.y);
            
            // If at max gun power level, fire a second bullet with a slight delay
            if (this.gunPowerLevel === 3) {
                this.scene.time.delayedCall(75, () => {
                    this.fireSingleBullet(this.sprite.x + 20, this.sprite.y);
                    // Play bullet fire sound for second bullet too
                    if (this.scene.soundManager) {
                        this.scene.soundManager.playBulletFire();
                    }
                });
            }
            
            // Set cooldown for next bullet
            this.bulletTime = time + 250;
        }
    }
    
    fireSingleBullet(x, y) {
        try {
            // Get a bullet from the pool
            const bullet = this.scene.bullets.get(x, y);
            
            if (bullet) {
                
                // Check if the bullet texture exists
                if (!this.scene.textures.exists('bullet')) {
                    console.warn("Bullet texture not found, creating fallback");
                    
                    // Create a fallback texture
                    const graphics = this.scene.make.graphics({});
                    graphics.fillStyle(0x00ff00, 1);
                    graphics.fillCircle(4, 4, 4);
                    graphics.generateTexture('bullet', 8, 8);
                }
                
                // Explicitly set the texture to ensure it's correct
                bullet.setTexture('bullet');
                
                // Set bullet properties - now moving right
                bullet.setActive(true);
                bullet.setVisible(true);
                bullet.setVelocityX(400);
                
                // Add power property for damage calculation
                bullet.power = 10 + (this.gunPowerLevel * 5);
                
                // Store creation time on the bullet for cleanup
                bullet.creationTime = this.scene.time.now;
                
                // Add to active bullets array for cleanup
                this.activeBullets.push(bullet);
                
                // Limit the number of active bullets to prevent memory issues
                if (this.activeBullets.length > 30) {
                    const oldestBullet = this.activeBullets.shift();
                    if (oldestBullet && oldestBullet.active) {
                        oldestBullet.setActive(false);
                        oldestBullet.setVisible(false);
                    }
                }
                
                try {
                    // Use a simpler approach for bullet trails to avoid errors
                    // Create a simple trail effect using a circle
                    const trailGraphics = this.scene.add.graphics();
                    trailGraphics.fillStyle(0x00ff00, 0.5);
                    trailGraphics.fillCircle(0, 0, 5);
                    
                    // Create a custom trail object with stop and destroy methods
                    const trailEmitter = {
                        graphics: trailGraphics,
                        stop: function() {
                            // Fade out the graphics
                            if (this.graphics && this.graphics.active) {
                                this.scene.tweens.add({
                                    targets: this.graphics,
                                    alpha: 0,
                                    duration: 200,
                                    onComplete: () => {
                                        if (this.graphics && this.graphics.active) {
                                            this.graphics.clear();
                                        }
                                    }
                                });
                            }
                        },
                        destroy: function() {
                            // Destroy the graphics object
                            if (this.graphics && this.graphics.active) {
                                this.graphics.destroy();
                            }
                        },
                        setPosition: function(x, y) {
                            // Update the position of the graphics
                            if (this.graphics && this.graphics.active) {
                                this.graphics.x = x;
                                this.graphics.y = y;
                            }
                        },
                        scene: this.scene
                    };
                    
                    // Set initial position
                    trailEmitter.setPosition(bullet.x, bullet.y);
                    
                    // Store the emitter reference on the bullet for cleanup
                    bullet.trailEmitter = trailEmitter;
                    
                    // Make the trail follow the bullet
                    const followEvent = this.scene.time.addEvent({
                        delay: 16, // Align with frame rate
                        callback: () => {
                            if (bullet.active && bullet.trailEmitter) {
                                bullet.trailEmitter.setPosition(bullet.x, bullet.y);
                            } else {
                                // Stop the timer and cleanup
                                followEvent.remove();
                                if (bullet.trailEmitter && typeof bullet.trailEmitter.stop === 'function') {
                                    bullet.trailEmitter.stop();
                                }
                            }
                        },
                        repeat: 30 // Enough for ~0.5s of bullet flight
                    });
                    
                    // Store the event reference on the bullet for cleanup
                    bullet.followEvent = followEvent;
                } catch (error) {
                    console.error("Error creating bullet trail:", error);
                    // Ensure bullet has null trail properties to avoid cleanup errors
                    bullet.trailEmitter = null;
                    bullet.followEvent = null;
                }
                
            } else {
                console.warn("Could not get bullet from pool");
            }
        } catch (error) {
            console.error("Error firing bullet:", error);
        }
    }
    
    activateEnergyWeapon() {
        // Only activate if energy is full and game is fully initialized
        if (!this.energyFull) return;
        
        // Check if the game scene is fully started and music is loaded
        if (this.scene && !this.scene.isGameStarted) {
            this.energyWeaponActive = false;
            this.forceCleanupEnergyWeapon();
            return;
        }
        
        // Additional safety check for audio system
        if (this.scene.audioAnalyzer && (!this.scene.audioAnalyzer.music || !this.scene.audioAnalyzer.music.isPlaying)) {
            this.energyWeaponActive = false;
            this.forceCleanupEnergyWeapon();
            return;
        }
        
        
        // IMPORTANT: Retrofit all existing worms with energy weapon collision detection
        if (this.scene.enemyManager && typeof this.scene.enemyManager.retrofitAllWormsForEnergyWeapon === 'function') {
            this.scene.enemyManager.retrofitAllWormsForEnergyWeapon();
        } else {
            console.warn("🔧 ❌ Could not retrofit worms - EnemyManager or method not found");
        }
        
        // Set energy weapon active
        this.energyWeaponActive = true;
        this.energyWeaponTimer = this.scene.time.now + 3000; // Active for 3 seconds
        
        // Create visual effect - screen flash
        this.scene.cameras.main.flash(500, 0, 100, 255, 0.5);
        
        // Create visual effect - camera shake
        this.scene.cameras.main.shake(500, 0.01);
        
        // Create the sidekick ship if it doesn't exist
        if (!this.scene.uiManager.energyIndicator) {
            this.scene.uiManager.createEnergyIndicator();
        }
        
        // Start the energy bar drain animation
        this.scene.tweens.killTweensOf(this.scene.uiManager.energyBar);
        this.scene.tweens.add({
            targets: this.scene.uiManager.energyBar,
            width: 0,
            duration: 3000,
            ease: 'Linear',
            onUpdate: () => {
                try {
                    // Only proceed if UI elements exist
                    if (this.scene && this.scene.uiManager && this.scene.uiManager.energyBar) {
                        // Update energy text based on current bar width
                        const currentEnergy = Math.round((this.scene.uiManager.energyBar.width / 200) * 100);
                        
                        // Update energy value
                        this.energy = currentEnergy;
                        
                        // Only update text if it exists
                        if (this.scene.uiManager.energyText) {
                            this.scene.uiManager.energyText.setText(`Energy: ${currentEnergy}%`);
                        }
                    }
                } catch (error) {
                    console.error("Error updating energy UI:", error);
                }
            },
            onComplete: () => {
                // Reset energy when animation completes
                this.energy = 0;
                this.energyFull = false;
                
                // Add safety checks for UI elements
                if (this.scene && this.scene.uiManager) {
                    // Only update text if it exists
                    if (this.scene.uiManager.energyText) {
                        this.scene.uiManager.energyText.setText(`Energy: 0%`);
                    }
                    
                    // Only update alpha if bar exists
                    if (this.scene.uiManager.energyBar) {
                        this.scene.uiManager.energyBar.alpha = 1;
                    }
                }
            }
        });
        
        // Create laser beams from the sidekick
        const fireInterval = this.scene.time.addEvent({
            delay: 300, // Fire lasers every 300ms
            callback: () => {
                if (this.scene.uiManager.energyIndicator && this.scene.uiManager.energyIndicator.active) {
                    this.createLaserBeams(this.scene.uiManager.energyIndicator.x, this.scene.uiManager.energyIndicator.y, 4);
                    
                    // Destroy all enemies on screen
                    const enemiesToDestroy = [];
                    
                    // First collect all enemies to avoid modifying the list while iterating
                    this.scene.children.list.forEach(obj => {
                        if (obj.enemyType && obj.enemyType !== 'powerupHex') {
                            enemiesToDestroy.push(obj);
                        }
                    });
                    
                    // Then destroy them
                    enemiesToDestroy.forEach(enemy => {
                        // Create explosion effect
                        this.scene.particleSystem.createExplosion(enemy.x, enemy.y, enemy.width || 30, enemy.tint || 0xff0000);
                        
                        // Add score
                        this.scene.enemyManager.addScoreForEnemy(enemy.enemyType);
                        
                        // Destroy the enemy
                        enemy.destroy();
                    });
                }
            },
            repeat: 9 // Fire 10 times over 3 seconds
        });
        
        // Create "ENERGY WEAPON!" text
        const energyWeaponText = this.scene.add.text(400, 300, 'ENERGY WEAPON!', {
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#00aaff',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5);
        
        // Animate text
        this.scene.tweens.add({
            targets: energyWeaponText,
            scale: 1.5,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                energyWeaponText.destroy();
            }
        });
        
        // Schedule cleanup after 3 seconds
        this.scene.time.delayedCall(3000, () => {
            // Remove the sidekick
            this.scene.uiManager.cleanupEnergyIndicator();
            
            // Stop the firing interval if it's still running
            if (fireInterval) {
                fireInterval.remove();
            }
            
            // Deactivate energy weapon
            this.energyWeaponActive = false;
        });
    }
    
    handleEnergyWeaponEffects() {
        // Find newly spawned enemies to shoot at with laser beams
        const newEnemies = [];
        
        // Collect all new enemies - specifically those on the right side of the screen
        this.scene.children.list.forEach(obj => {
            if (obj.enemyType && obj.enemyType !== 'powerupHex' && obj.x > this.scene.gameWidth - 100) {
                newEnemies.push(obj);
            }
        });
        
        // If there are any new enemies, shoot laser beams at them
        if (newEnemies.length > 0 && this.scene.uiManager.energyIndicator) {
            // Get the position of the sidekick ship
            const sideKickX = this.scene.uiManager.energyIndicator.x;
            const sideKickY = this.scene.uiManager.energyIndicator.y;
            
            // Shoot laser beams at the new enemies - this will create laser beams with a delay
            // before destroying each enemy (as implemented in createLaserBeams)
            if (newEnemies.length > 0) {
                // Play energy weapon used sound
                if (this.scene.soundManager) {
                    this.scene.soundManager.playEnergyWeaponUsed();
                }
                
                // Create laser beams for each enemy
                newEnemies.forEach(enemy => {
                    // Create a simple line from sidekick to enemy
                    const line = this.scene.add.graphics();
                    line.lineStyle(6, 0x00ffff, 1);
                    line.beginPath();
                    line.moveTo(sideKickX, sideKickY);
                    line.lineTo(enemy.x, enemy.y);
                    line.strokePath();
                    line.setDepth(12);
                    
                    // Add a delay before destroying the enemy
                    this.scene.time.delayedCall(300, () => {
                        if (enemy && enemy.active) {
                            // Add score
                            this.scene.enemyManager.addScoreForEnemy(enemy.enemyType);
                            
                            // Create explosion effect
                            this.scene.particleSystem.createExplosion(enemy.x, enemy.y, enemy.width || 30, enemy.tint || 0xff0000);
                            
                            // Destroy the enemy
                            enemy.destroy();
                        }
                    });
                    
                    // Animate the laser line
                    this.scene.tweens.add({
                        targets: line,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => {
                            line.destroy();
                        }
                    });
                });
            }
        }
    }
    
    createLaserBeams(x, y, numBeams) {
        // Play energy weapon used sound
        if (this.scene.soundManager) {
            this.scene.soundManager.playEnergyWeaponUsed();
        }
        
        try {
            // Find all regular enemies on screen
            const enemies = [];
            this.scene.children.list.forEach(obj => {
                if (obj.enemyType && obj.enemyType !== 'powerupHex' && obj.active) {
                    enemies.push(obj);
                }
            });
            
            // Find all MusicWorms on screen
            const musicWorms = [];
            if (this.scene.enemyManager && this.scene.enemyManager.activeWorms) {
                this.scene.enemyManager.activeWorms.forEach(worm => {
                    if (worm && worm.isActive && !worm.isDestroyed && worm.segments && worm.segments.length > 0) {
                        musicWorms.push(worm);
                    }
                });
            }
            
            
            // SIMPLIFIED VERSION: Just add a simple flash at the origin point
            const flash = this.scene.add.circle(x, y, 20, 0x00ffff, 1);
            flash.setDepth(15);
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                scale: 2,
                duration: 300,
                onComplete: () => {
                    flash.destroy();
                }
            });
            
            // Target MusicWorms first (priority targets)
            musicWorms.forEach(worm => {
                
                // Find the head segment for laser targeting
                const headSegment = worm.segments.find(seg => seg.isHead);
                if (headSegment) {
                    // Create a simple line from sidekick to worm head
                    const line = this.scene.add.graphics();
                    line.lineStyle(8, 0x00ffff, 1); // Slightly thicker for worms
                    line.beginPath();
                    line.moveTo(x, y);
                    line.lineTo(headSegment.x, headSegment.y);
                    line.strokePath();
                    line.setDepth(12);
                    
                    // Add a brief delay before starting chain destruction
                    this.scene.time.delayedCall(200, () => {
                        if (worm && worm.isActive && !worm.isDestroyed) {
                            // Start the energy chain destruction
                            worm.startEnergyChainDestruction(headSegment.x, headSegment.y);
                        }
                    });
                    
                    // Animate the laser line
                    this.scene.tweens.add({
                        targets: line,
                        alpha: 0,
                        duration: 400, // Slightly longer for dramatic effect
                        onComplete: () => {
                            line.destroy();
                        }
                    });
                }
            });
            
            // If no targets at all, just return after the flash effect
            if (enemies.length === 0 && musicWorms.length === 0) {
                return;
            }
            
            // Target regular enemies (fewer targets for performance)
            const targetCount = Math.min(enemies.length, numBeams);
            
            // Create a simple laser to each regular enemy target
            for (let i = 0; i < targetCount; i++) {
                const enemy = enemies[i];
                
                // Create a simple line from sidekick to enemy
                const line = this.scene.add.graphics();
                line.lineStyle(6, 0x00ffff, 1);
                line.beginPath();
                line.moveTo(x, y);
                line.lineTo(enemy.x, enemy.y);
                line.strokePath();
                line.setDepth(12);
                
                // Add a brief delay before destroying the enemy to see the laser effect
                this.scene.time.delayedCall(300, () => {
                    // Destroy the enemy after delay if it still exists
                    if (enemy && enemy.active) {
                        // Add score
                        this.scene.enemyManager.addScoreForEnemy(enemy.enemyType);
                        
                        // Create explosion effect
                        this.scene.particleSystem.createExplosion(enemy.x, enemy.y, enemy.width || 30, enemy.tint || 0xff0000);
                        
                        // Destroy the enemy
                        enemy.destroy();
                    }
                });
                
                // Animate the laser line
                this.scene.tweens.add({
                    targets: line,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        line.destroy();
                    }
                });
            }
        } catch (error) {
            console.error("Error in createLaserBeams:", error);
        }
    }
    
    createLaserPathParticles(startX, startY, endX, endY, distance) {
        // Calculate fewer particles for performance
        const particleCount = Math.min(5, Math.max(2, Math.floor(distance / 60)));
        
        // Check if the star-particle texture exists
        if (!this.scene.textures.exists('star-particle')) {
            console.warn("Star particle texture not found, creating fallback");
            
            // Create a fallback texture
            const graphics = this.scene.make.graphics({});
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(8, 8, 8);
            graphics.generateTexture('star-particle', 16, 16);
        }
        
        for (let j = 0; j < particleCount; j++) {
            const t = j / particleCount;
            const particleX = startX + (endX - startX) * t;
            const particleY = startY + (endY - startY) * t;
            
            try {
                // Create particle with reduced properties
                const particle = this.scene.add.particles(particleX, particleY, 'star-particle', {
                    lifespan: 300, // Reduced from 400
                    scale: { start: 0.5, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 20,
                    frequency: -1,
                    blendMode: Phaser.BlendModes.ADD,
                    tint: 0x00ffff,
                    quantity: 2, // Reduced from 3
                    emitting: false
                });
                
                // Emit particles manually instead of using explode
                for (let i = 0; i < 2; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = Math.random() * 5;
                    const px = particleX + Math.cos(angle) * distance;
                    const py = particleY + Math.sin(angle) * distance;
                    particle.emitParticleAt(px, py);
                }
                
                // Destroy particle emitter after particles fade
                this.scene.time.delayedCall(300, () => {
                    if (particle && particle.active) {
                        particle.destroy();
                    }
                });
            } catch (error) {
                console.warn("Error creating laser path particles:", error);
            }
        }
    }
    
    takeDamage(amount) {
        // Flash player on damage
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0.5,
            duration: 100,
            yoyo: true
        });
        
        // Hide Grub Terminator companion when player takes damage
        if (this.scene.grubTerminator && typeof this.scene.grubTerminator.hideForDamage === 'function') {
            this.scene.grubTerminator.hideForDamage();
        }
        
        // Call EQVisualizer's handlePlayerHit method to reset any visualizations
        if (this.scene.audioAnalyzer && this.scene.audioAnalyzer.eqVisualizer) {
            this.scene.audioAnalyzer.eqVisualizer.handlePlayerHit();
        }
        
        // Create a dramatic red overlay flash effect
        const redOverlay = this.scene.add.rectangle(
            this.scene.gameWidth / 2, 
            this.scene.gameHeight / 2,
            this.scene.gameWidth,
            this.scene.gameHeight,
            0xff0000, 
            0.6
        );
        redOverlay.setDepth(100); // Make sure it's on top of everything
        
        // Fade out the red overlay
        this.scene.tweens.add({
            targets: redOverlay,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                redOverlay.destroy();
            }
        });
        
        // Extreme camera shake effect
        this.scene.cameras.main.shake(1200, 0.1);
        
        // Use camera flash for additional impact
        this.scene.cameras.main.flash(300, 255, 0, 0, true);
        
        // Clear any existing rotation timers
        this.rotationTimers.forEach(timer => {
            if (timer) {
                this.scene.time.removeEvent(timer);
            }
        });
        this.rotationTimers = [];
        
        // Reset camera rotation immediately to ensure a clean start
        this.scene.cameras.main.rotation = 0;
        
        // Create distortion effect using camera rotation with proper timer tracking
        this.scene.cameras.main.rotateTo(0.05, true);
        
        const timer1 = this.scene.time.delayedCall(100, () => {
            this.scene.cameras.main.rotateTo(-0.05, true);
            
            const timer2 = this.scene.time.delayedCall(100, () => {
                this.scene.cameras.main.rotateTo(0.03, true);
                
                const timer3 = this.scene.time.delayedCall(100, () => {
                    this.scene.cameras.main.rotateTo(-0.02, true);
                    
                    const timer4 = this.scene.time.delayedCall(100, () => {
                        this.scene.cameras.main.rotateTo(0, true);
                        
                        // Remove completed timers from array
                        const index = this.rotationTimers.indexOf(timer4);
                        if (index > -1) {
                            this.rotationTimers.splice(index, 1);
                        }
                    });
                    
                    this.rotationTimers.push(timer4);
                    
                    // Remove completed timers from array
                    const index = this.rotationTimers.indexOf(timer3);
                    if (index > -1) {
                        this.rotationTimers.splice(index, 1);
                    }
                });
                
                this.rotationTimers.push(timer3);
                
                // Remove completed timers from array
                const index = this.rotationTimers.indexOf(timer2);
                if (index > -1) {
                    this.rotationTimers.splice(index, 1);
                }
            });
            
            this.rotationTimers.push(timer2);
            
            // Remove completed timers from array
            const index = this.rotationTimers.indexOf(timer1);
            if (index > -1) {
                this.rotationTimers.splice(index, 1);
            }
        });
        
        this.rotationTimers.push(timer1);
        
        // Use blur if WebGL is available and postFX exists
        if (this.scene.renderer.type === Phaser.WEBGL && 
            this.scene.cameras.main.postFX && 
            typeof this.scene.cameras.main.postFX.addBlur === 'function') {
            try {
                // Try a more extreme blur
                const blurEffect = this.scene.cameras.main.postFX.addBlur(2, 10, 10, 30); // Maximum blur
                
                this.scene.time.delayedCall(1000, () => {
                    if (blurEffect && this.scene.cameras.main.postFX) {
                        this.scene.cameras.main.postFX.remove(blurEffect);
                    }
                });
            } catch (error) {
                console.warn("Could not apply blur effect:", error);
            }
        }
        
        // Reduce player health
        this.health = Math.max(0, this.health - amount);
        
        // Update health bar
        this.scene.uiManager.updateHealthBar();
        
        // Check if player is dead
        if (this.health <= 0) {
            this.scene.gameOver();
        }
    }
    
    disable() {
        // Disable player movement
        if (this.sprite.body) {
            this.sprite.body.enable = false;
        }
        this.sprite.setVelocity(0, 0);
        this.sprite.setImmovable(true);
        
        // Hide the player
        this.sprite.setVisible(false);
        
        // Hide the glow
        if (this.glow) {
            this.glow.setVisible(false);
        }
        
        // Clean up active bullets
        this.activeBullets.forEach(bullet => {
            if (bullet.active) {
                bullet.setActive(false);
                bullet.setVisible(false);
                
                if (bullet.trailEmitter) {
                    bullet.trailEmitter.stop();
                    bullet.trailEmitter.destroy();
                }
                
                if (bullet.followEvent) {
                    bullet.followEvent.remove();
                }
            }
        });
        
        // Clear the bullets array
        this.activeBullets = [];
        
        // Clean up any timers
        if (this.autoFireTimer) {
            this.autoFireTimer.remove();
            this.autoFireTimer = null;
        }
        
        if (this.glowFollower) {
            this.glowFollower.remove();
            this.glowFollower = null;
        }
        
        // Clean up rotation timers and ensure camera is properly reset
        this.rotationTimers.forEach(timer => {
            if (timer) {
                this.scene.time.removeEvent(timer);
            }
        });
        this.rotationTimers = [];
        
        // Force reset camera rotation to avoid stuck tilt
        if (this.scene && this.scene.cameras && this.scene.cameras.main) {
            this.scene.cameras.main.rotation = 0;
        }
    }
    
    addEnergy(amount) {
        this.energy = Math.min(100, this.energy + amount);
        
        // Update energy bar
        this.scene.uiManager.updateEnergyBar();
        
        // Check if energy is full
        if (this.energy >= 100 && !this.energyFull) {
            this.energyFull = true;
            
            // Make energy bar flash more aggressively
            this.scene.tweens.add({
                targets: this.scene.uiManager.energyBar,
                alpha: 0.2,
                duration: 300,
                yoyo: true,
                repeat: -1
            });
            
            // Create energy indicator if it doesn't exist
            if (!this.scene.uiManager.energyIndicator) {
                this.scene.uiManager.createEnergyIndicator();
            }
        } else if (this.energy < 100 && this.energyFull) {
            this.energyFull = false;
            
            // Stop energy bar flashing
            this.scene.tweens.killTweensOf(this.scene.uiManager.energyBar);
            this.scene.uiManager.energyBar.alpha = 1;
            
            // Remove energy indicator
            this.scene.uiManager.cleanupEnergyIndicator();
        }
    }
    
    increaseGunPower() {
        if (this.gunPowerLevel < 3) {
            this.gunPowerLevel++;
            
            // Update gun power indicators in UI
            this.scene.uiManager.updateGunPowerIndicators();
            
            // Update auto-fire rate
            this.setupAutoFire();
            
            return true;
        }
        
        return false; // Already at max power
    }
    
    // Emergency cleanup method to ensure energy weapon effects are properly reset
    forceCleanupEnergyWeapon() {
        
        // Reset all camera effects
        if (this.scene.cameras && this.scene.cameras.main) {
            // Stop any flash effects
            this.scene.cameras.main.resetFX();
            
            // Completely reset the camera to fix blue screen issue
            this.scene.cameras.main.clearAlpha();
            this.scene.cameras.main.alpha = 1;
            
            // Clear any flashes - this is the key to fixing the blue screen
            this.scene.cameras.main.clearMask(true);
            
            // Force a camera reset by doing a quick fade
            this.scene.cameras.main.fade(50, 0, 0, 0, true);
            this.scene.time.delayedCall(60, () => {
                if (this.scene && this.scene.cameras && this.scene.cameras.main) {
                    this.scene.cameras.main.resetFX();
                }
            });
        }
        
        // Clean up sidekick ship
        if (this.scene.uiManager) {
            this.scene.uiManager.cleanupEnergyIndicator();
        }
        
        // If there's any energy bar animation, kill it
        if (this.scene.uiManager && this.scene.uiManager.energyBar) {
            this.scene.tweens.killTweensOf(this.scene.uiManager.energyBar);
            this.scene.uiManager.energyBar.alpha = 1;
        }
        
        // Clean up any lingering texts
        if (this.scene.children) {
            this.scene.children.list.forEach(obj => {
                if (obj.type === 'Text' && 
                    obj.text && 
                    obj.text.includes('ENERGY WEAPON')) {
                    obj.destroy();
                }
            });
        }
        
        // Clear all tweens that might be affecting the screen color
        this.scene.tweens.getAllTweens().forEach(tween => {
            if (tween.targets && (
                tween.targets.includes(this.scene.cameras.main) ||
                (Array.isArray(tween.targets) && 
                 tween.targets.some(t => t.type === 'Graphics' || t.blendMode === Phaser.BlendModes.ADD))
            )) {
                tween.remove();
            }
        });
        
        // Make sure weapon is deactivated
        this.energyWeaponActive = false;
        
        // Reset energy if needed
        if (this.energy < 25) {
            this.energy = 25;
            this.energyFull = false;
        }
    }
}
