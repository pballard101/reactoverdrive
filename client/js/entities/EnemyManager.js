// EnemyManager.js - Handles enemy spawning, interactions, and powerups

import MusicWorm from './MusicWorm.js';

export default class EnemyManager {
    constructor(scene) {
        this.scene = scene;

        // Music worm tracking
        this.activeWorms = [];
        this.lastWormSpawnTime = 0;
        this.wormSpawnCooldown = 3000; // 3 seconds between worms for testing!
    }
    
    // Helper method to calculate Y position based on note
    getNoteYPosition(note) {
        // Get game dimensions
        const gameHeight = this.scene.gameHeight || 720;
        
        // Calculate lane height (same as EQVisualizer)
        const laneHeight = gameHeight / 7;
        
        // Safety check for null or undefined note
        if (!note || typeof note !== 'string' || note.length === 0) {
            return Phaser.Math.Between(50, gameHeight - 50);
        }
        
        // Get the note's base name and any accidental
        const noteName = note[0];
        const hasAccidental = note.length > 1 && (note[1] === '#' || note[1] === 'b');
        
        // Notes in standard order
        const notes = ["C", "D", "E", "F", "G", "A", "B"];
        let noteIndex = notes.indexOf(noteName);
        
        if (noteIndex === -1) {
            // If invalid note, return a random Y position
            return Phaser.Math.Between(50, gameHeight - 50);
        }
        
        // Get the lane's center Y position
        let yPosition = (noteIndex * laneHeight) + (laneHeight / 2);
        
        // If it's a sharp or flat, position it between the appropriate notes
        if (hasAccidental) {
            const accidental = note[1];
            if (accidental === '#' && noteIndex < 6) {
                // For sharp notes, position between this note and the next
                const nextNoteY = ((noteIndex + 1) * laneHeight) + (laneHeight / 2);
                yPosition = (yPosition + nextNoteY) / 2;
            } else if (accidental === 'b' && noteIndex > 0) {
                // For flat notes, position between this note and the previous
                const prevNoteY = ((noteIndex - 1) * laneHeight) + (laneHeight / 2);
                yPosition = (yPosition + prevNoteY) / 2;
            }
        }
        
        return yPosition;
    }
    
    spawnEnemy(strength, note = null) {
        // Create a visible enemy shape
        let color, enemyType;
        
        // Get game dimensions
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Deterministic enemy type selection based on musical properties
        let enemyValue = 0;
        
        if (this.scene.audioAnalyzer && this.scene.audioAnalyzer.frequencyData) {
            // Use frequency analysis to determine enemy type
            const freqData = this.scene.audioAnalyzer.frequencyData;
            const bassRange = freqData.slice(0, 32); // Low frequencies
            const midRange = freqData.slice(80, 160); // Mid frequencies  
            const highRange = freqData.slice(200, 255); // High frequencies
            
            const avgBass = bassRange.reduce((sum, val) => sum + val, 0) / bassRange.length;
            const avgMid = midRange.reduce((sum, val) => sum + val, 0) / midRange.length;
            const avgHigh = highRange.reduce((sum, val) => sum + val, 0) / highRange.length;
            
            // Combine frequency analysis with strength to determine enemy type
            const combinedValue = (avgBass * 0.4) + (avgMid * 0.3) + (avgHigh * 0.3) + (strength * 100);
            enemyValue = (combinedValue % 100) / 100; // Normalize to 0-1
        } else {
            // Fallback: Use strength and time-based deterministic value
            const timeBasedValue = ((this.scene.time.now / 100) % 100) / 100;
            enemyValue = (strength + timeBasedValue) % 1;
        }
        
        // Map musical characteristics to enemy types (deterministic)
        if (enemyValue < 0.15) {
            // Complex/high-energy music -> hexagon
            color = 0x9900ff; // Purple for hexagon
            enemyType = 'hexagon';
        } else if (enemyValue < 0.40) {
            // High intensity -> triangle
            color = 0xffaa00; // Very bright yellow-orange (NOT red!)
            enemyType = 'triangle';
            strength = Math.max(strength, 0.71); // Ensure proper strength value
        } else if (enemyValue < 0.65) {
            // Low intensity -> circle
            color = 0x00ffff; // Cyan for weak beats
            enemyType = 'circle';
            strength = Math.min(strength, 0.39); // Ensure proper strength value
        } else {
            // Medium intensity -> square
            color = 0xffff00; // Yellow for medium beats
            enemyType = 'square';
            strength = Math.max(Math.min(strength, 0.69), 0.41); // Keep in medium range
        }
        
        // Get current volume level from AudioAnalyzer if available
        let volumeLevel = 0.5;
        let currentBPM = 120;
        if (this.scene.audioAnalyzer) {
            volumeLevel = this.scene.audioAnalyzer.currentVolume || 0.5;
            currentBPM = this.scene.audioAnalyzer.currentBPM || 120;
            
            // Debug log periodically
            if (Math.random() < 0.01) {
            }
        }
        
        // Calculate size based on multiple factors - with BALANCED EFFECTS:
        // 1. Beat strength (basic size determination)
        // 2. Current volume (louder = bigger) - Moderate effect
        // 3. BPM (faster songs = smaller enemies, slower songs = bigger enemies) - Subtle scaling
        
        // Start with base size from beat strength (smaller range)
        let baseSize = 8 + (strength * 15); // Range 8-23 (much smaller)
        
        // Add volume factor - BALANCED effect for dynamic feel
        const volumeFactor = 1 + (volumeLevel * 0.8); // Up to 1.8x size at max volume
        
        // Add inverse BPM factor with MODERATE scaling
        // At 60 BPM: 1.6x size, at 180 BPM: 0.6x size
        const bpmFactor = 1.6 - (Math.min(Math.max(currentBPM, 60), 180) / 200); // Moderate scaling
        
        // Combine all factors to get final size
        const size = Math.round(baseSize * volumeFactor * bpmFactor);
        
        // Debug logging when size is especially notable
        
        // Create a graphics object for the enemy
        const graphics = this.scene.make.graphics({});
        graphics.fillStyle(color, 1);
        
        // Draw a shape based on enemy type with original type-based color
        graphics.fillStyle(color, 1);
        if (enemyType === 'hexagon') {
            // Hexagon for special enemy
            const hexRadius = size/2;
            graphics.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const x = hexRadius + hexRadius * Math.cos(angle);
                const y = hexRadius + hexRadius * Math.sin(angle);
                if (i === 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }
            }
            graphics.closePath();
            graphics.fillPath();
        } else if (strength > 0.7) {
            // Triangle for strong beats
            graphics.fillTriangle(0, size, size/2, 0, size, size);
        } else if (strength > 0.4) {
            // Square for medium beats
            graphics.fillRect(0, 0, size, size);
        } else {
            // Circle for weak beats
            graphics.fillCircle(size/2, size/2, size/2);
        }
        
        // Use a safer approach: directly create a canvas texture
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.willReadFrequently = true; // Add this attribute to optimize
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, size, size);
        
        // Draw the shape directly on canvas with original type-based color
        ctx.fillStyle = Phaser.Display.Color.HexStringToColor('#' + color.toString(16).padStart(6, '0')).rgba;
        
        if (enemyType === 'hexagon') {
            // Energy Orb - glowing effect with bright core
            const hexRadius = size/2;

            // Create radial gradient for glowing effect
            const gradient = ctx.createRadialGradient(
                size/2, size/2, 0,           // Inner circle (center)
                size/2, size/2, hexRadius    // Outer circle (edge)
            );

            // Bright white/cyan core
            gradient.addColorStop(0, 'rgba(200, 255, 255, 1.0)');     // Bright cyan-white core
            gradient.addColorStop(0.3, 'rgba(153, 0, 255, 0.9)');     // Purple mid-section
            gradient.addColorStop(0.7, 'rgba(153, 0, 255, 0.6)');     // Fading purple
            gradient.addColorStop(1, 'rgba(153, 0, 255, 0.2)');       // Very transparent edge

            // Draw hexagon shape with gradient
            ctx.fillStyle = gradient;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const x = size/2 + hexRadius * Math.cos(angle);
                const y = size/2 + hexRadius * Math.sin(angle);
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fill();

            // Add bright white outline for extra glow
            ctx.strokeStyle = 'rgba(200, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (strength > 0.7) {
            // Triangle - solid bright yellow-orange, no gradient
            ctx.fillStyle = 'rgba(255, 170, 0, 1.0)'; // Very bright yellow-orange
            ctx.beginPath();
            ctx.moveTo(size/2, 0);
            ctx.lineTo(0, size);
            ctx.lineTo(size, size);
            ctx.closePath();
            ctx.fill();

            // Add bright outline for pop
            ctx.strokeStyle = 'rgba(255, 220, 100, 0.9)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (strength > 0.4) {
            // Square - solid bright yellow, no gradient
            ctx.fillStyle = 'rgba(255, 255, 0, 1.0)'; // Bright yellow
            ctx.fillRect(0, 0, size, size);

            // Add white outline for pop
            ctx.strokeStyle = 'rgba(255, 255, 150, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, size, size);
        } else {
            // Circle - solid bright cyan, no gradient
            ctx.fillStyle = 'rgba(0, 255, 255, 1.0)'; // Bright cyan
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
            ctx.fill();

            // Add white outline for pop
            ctx.strokeStyle = 'rgba(150, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Create unique texture name using timestamp and random to prevent collisions
        const textureName = `enemy-${this.scene.time.now}-${Math.floor(Math.random() * 1000)}`;
        
        // Check if texture already exists and create a unique one if needed
        let finalTextureName = textureName;
        let counter = 0;
        while (this.scene.textures.exists(finalTextureName)) {
            finalTextureName = `${textureName}-${counter}`;
            counter++;
        }
        
        // Add the canvas as a texture
        this.scene.textures.addCanvas(finalTextureName, canvas);
        
        // Determine Y position based on note or use random if no note provided
        let yPosition;
        if (note) {
            // Use note to determine Y position
            yPosition = this.getNoteYPosition(note);
        } else {
            // Fallback to random position
            yPosition = Phaser.Math.Between(50, gameHeight - 50);
        }
        
        // Create the enemy sprite with the generated texture
        const enemy = this.scene.physics.add.sprite(
            gameWidth, // Spawn at right edge
            yPosition, // Y position based on note or random
            textureName
        );
        
        // Store size factors for debugging and visualization
        enemy.baseSize = baseSize;
        enemy.volumeFactor = volumeFactor;
        enemy.bpmFactor = bpmFactor;
        enemy.finalSize = size;
        
        // Store the note on the enemy for reference (after enemy is created)
        if (note) {
            enemy.note = note;
        }
        
        // Add enemy type property for collision detection and scoring
        enemy.enemyType = enemyType;
        
        // Set velocity based on strength and enemy type - now moving left instead of down
        if (enemyType === 'hexagon') {
            // Hexagons move slower
            const speed = 100 + (strength * 100);
            enemy.setVelocityX(-speed); // Move left
            
            // Add pulsing visibility effect to hexagon
            this.scene.tweens.add({
                targets: enemy,
                alpha: 0.2,
                duration: 500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Flag to track if the hexagon is in reverse motion
            enemy.isReversing = false;
            // Flag to prevent multiple collision handling
            enemy.isCollisionHandled = false;

            // Create particle trail that follows the hexagon
            this.createHexagonTrail(enemy);
        } else {
            // Regular enemies - set velocity based on strength
            const speed = 150 + (strength * 200);
            enemy.setVelocityX(-speed); // Move left

            // Add pulsing red danger aura for regular enemies
            this.createDangerAura(enemy, size);
        }

        // Add enhanced FX to enemies based on size (no wireframes)
        if (this.scene.particleSystem) {
            if (size > 55) {
                // Large enemies get a strong glow effect
                this.scene.particleSystem.addGlowEffect(enemy, color, 6);
            } else if (size > 35) {
                // Medium enemies get a moderate glow
                this.scene.particleSystem.addGlowEffect(enemy, color, 4);
            } else {
                // Small enemies get minimal glow
                this.scene.particleSystem.addGlowEffect(enemy, color, 2);
            }
        } else {
            // Fallback for non-WebGL - add a glow effect via blendMode
            enemy.setBlendMode(Phaser.BlendModes.ADD);
        }
        
        // Store original size for breathing effect
        enemy.originalSize = size;
        enemy.baseScale = 1.0;
        
        // Start with spawn-in effect: scale from 0 to full size
        enemy.setScale(0);
        
        // Create spawn-in particle burst using existing explosion method
        if (this.scene.particleSystem) {
            this.scene.particleSystem.createExplosion(enemy.x, enemy.y, size * 0.5, color);
        }
        
        // Animate spawn-in with scaling tween
        this.scene.tweens.add({
            targets: enemy,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 400,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Brief flash effect when spawn completes using smaller explosion
                if (this.scene.particleSystem) {
                    this.scene.particleSystem.createExplosion(enemy.x, enemy.y, size * 0.3, 0xffffff);
                }
            }
        });
        
        // Add some rotation - triangles rotate MUCH faster for aggressive look
        enemy.rotation = Math.random() * Math.PI;
        if (enemyType === 'triangle') {
            enemy.rotationSpeed = Phaser.Math.Between(-10, 10) * 0.02; // Very fast, visible rotation!
        } else {
            enemy.rotationSpeed = Phaser.Math.Between(-2, 2) * 0.01; // Normal rotation
        }
        
        // Add color pulsing to the enemy
        this.scene.tweens.add({
            targets: enemy,
            alpha: 0.7,
            duration: 300 + Math.random() * 300,
            yoyo: true,
            repeat: -1
        });
        
        // Subtle color pulse that maintains type-based colors
        const colorPulse = this.scene.time.addEvent({
            delay: 100 + Math.random() * 200,
            callback: () => {
                if (enemy.active) {
                    // Gentle color pulsing that enhances the base color
                    const intensity = 0.8 + (Math.sin(this.scene.time.now / 300) * 0.2);
                    
                    // Get base color components and apply intensity
                    const baseColor = Phaser.Display.Color.ValueToColor(color);
                    const r = Math.min(255, Math.floor(baseColor.r * intensity));
                    const g = Math.min(255, Math.floor(baseColor.g * intensity));
                    const b = Math.min(255, Math.floor(baseColor.b * intensity));
                    
                    enemy.setTint(Phaser.Display.Color.GetColor(r, g, b));
                } else {
                    colorPulse.destroy();
                }
            },
            loop: true
        });
        
        // Update function for this enemy with additional size-related behaviors
        this.scene.time.addEvent({
            delay: 30,
            callback: () => {
                if (enemy.active) {
                    enemy.rotation += enemy.rotationSpeed;
                    
                    // Add subtle size-based behavior:
                    // Larger enemies rotate slightly faster
                    if (size > 50) {
                        enemy.rotationSpeed = enemy.rotationSpeed * 1.005;
                    }
                    
                    // Destroy if it goes off screen (left side)
                    if (enemy.x < -50) {
                        // Clean up particle trail if this is a hexagon
                        if (enemy.enemyType === 'hexagon' && enemy.trailParticleManager) {
                            enemy.trailParticleManager.destroy();
                        }
                        // Clean up danger aura if this is a regular enemy
                        if (enemy.dangerAura) {
                            enemy.dangerAura.destroy();
                        }
                        if (enemy.auraUpdateTimer) {
                            enemy.auraUpdateTimer.remove();
                        }
                        // Clean up particle effects
                        if (enemy.particleManager) {
                            enemy.particleManager.destroy();
                        }
                        enemy.destroy();
                        colorPulse.destroy();
                    }
                }
            },
            loop: true
        });
        
        // Add physics for collisions with player
        this.scene.physics.add.overlap(this.scene.player.sprite, enemy, (p, e) => {
            this.handlePlayerEnemyCollision(p, e);
        });
        
        return enemy;
    }
    
    handlePlayerEnemyCollision(player, enemy) {
        try {
            // Special behavior for hexagons
            if (enemy.enemyType === 'hexagon') {
                this.handleHexagonCollision(player, enemy);
            } else {
                // Regular collision behavior for other enemies
                this.handleRegularEnemyCollision(player, enemy);
            }
        } catch (error) {
            console.warn("Error handling collision:", error);
        }
    }
    
    handleHexagonCollision(player, enemy) {
        // Only process if not already in reverse
        if (!enemy.isReversing) {
            // Determine direction of collision
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            
            // Normalize the direction vector
            const length = Math.sqrt(dx * dx + dy * dy);
            const ndx = dx / length;
            const ndy = dy / length;
            
            // Set velocity in the opposite direction of collision (push away)
            const pushSpeed = 300;
            enemy.setVelocity(-ndx * pushSpeed, -ndy * pushSpeed);
            enemy.isReversing = true;
            
            // Make it fully visible during reverse
            this.scene.tweens.killTweensOf(enemy);
            enemy.setAlpha(1);
            
            // Add a glow effect during reverse
            if (this.scene.particleSystem) {
                this.scene.particleSystem.addGlowEffect(enemy, 0xffffff, 8);
            }
            
            // Check for collisions with other enemies while in reverse
            const reverseCollider = this.scene.physics.add.overlap(enemy, this.scene.children.list, (hexagon, target) => {
                // Skip if trying to interact with itself or if target is being destroyed
                if (target === hexagon || target.isBeingDestroyed) return;
                
                // Mark the target as being processed to prevent double-handling
                target.isBeingProcessed = true;
                
                // Special handling for different types of objects
                if (target.enemyType) {
                    // Case 1: Another purple hexagon - make them bounce off each other
                    if (target.enemyType === 'hexagon') {
                        
                        // IMPORTANT: Skip collisions if the other hexagon is already being handled
                        // This prevents them from destroying each other in the same frame
                        if (target.isCollisionHandled) {
                                return;
                        }
                        
                        // Mark both hexagons to prevent multiple handling
                        hexagon.isCollisionHandled = true;
                        target.isCollisionHandled = true;
                        
                        // Calculate direction between hexagons
                        const dx = hexagon.x - target.x;
                        const dy = hexagon.y - target.y;
                        
                        // Normalize the direction vector
                        const length = Math.sqrt(dx * dx + dy * dy);
                        const ndx = dx / length;
                        const ndy = dy / length;
                        
                        // Set velocities to bounce off each other
                        const speed = 200;
                        hexagon.setVelocity(ndx * speed, ndy * speed);
                        
                        // Only set the other hexagon to reverse if it's not already in reverse mode
                        if (!target.isReversing) {
                            target.setVelocity(-ndx * speed, -ndy * speed);
                            
                            // Make it fully visible during reverse
                            this.scene.tweens.killTweensOf(target);
                            target.setAlpha(1);
                            
                            // Flag it as reversing
                            target.isReversing = true;
                            
                            // Add a glow effect
                            if (this.scene.particleSystem) {
                                this.scene.particleSystem.addGlowEffect(target, 0xffffff, 8);
                            }
                            
                            // Return to normal after some time
                            this.scene.time.delayedCall(2000, () => {
                                if (target.active) {
                                    target.isReversing = false;
                                    target.setVelocityX(-100); // Now move left
                                    
                                    // Reset collision handling flag
                                    target.isCollisionHandled = false;
                                    
                                    // Restore pulsing visibility
                                    this.scene.tweens.add({
                                        targets: target,
                                        alpha: 0.2,
                                        duration: 500,
                                        yoyo: true,
                                        repeat: -1,
                                        ease: 'Sine.easeInOut'
                                    });
                                    
                                    // Remove the glow effect
                                    if (this.scene.particleSystem) {
                                        this.scene.particleSystem.clearEffects(target);
                                    }
                                }
                            });
                        }
                        
                        // Clear the flag after a short delay to allow for multiple collisions
                        this.scene.time.delayedCall(100, () => {
                            if (hexagon.active) hexagon.isCollisionHandled = false;
                            if (target.active) target.isBeingProcessed = false;
                        });
                    }
                    // Case 2: Power-up hex - don't destroy it
                    else if (target.enemyType === 'powerupHex') {
                        target.isBeingProcessed = false;
                        return;
                    } 
                    // Case 3: Regular enemy - destroy it with bonus points
                    else {
                        this.destroyEnemy(target, true);
                        target.isBeingProcessed = false;
                    }
                } else {
                    target.isBeingProcessed = false;
                }
            });
            
            // After some time, return to normal behavior
            this.scene.time.delayedCall(2000, () => {
                if (enemy.active) {
                    enemy.isReversing = false;
                    enemy.setVelocityX(-100); // Now move left
                    enemy.isCollisionHandled = false; // Reset the flag
                    
                    // Restore pulsing visibility
                    this.scene.tweens.add({
                        targets: enemy,
                        alpha: 0.2,
                        duration: 500,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    
                    // Remove the glow effect
                    if (this.scene.particleSystem) {
                        this.scene.particleSystem.clearEffects(enemy);
                    }
                    
                    // Remove the reverse collision detector
                    reverseCollider.destroy();
                }
            });
        }
    }
    
    handleRegularEnemyCollision(player, enemy) {
        // Flash player on collision (reduced effect)
        this.scene.tweens.add({
            targets: player,
            alpha: 0.7,
            duration: 100,
            yoyo: true
        });
        
        // Create explosion effect using particle system only
        if (this.scene.particleSystem) {
            this.scene.particleSystem.createExplosion(enemy.x, enemy.y, enemy.width, enemy.tint || 0xff0000);
        }
        
        // Damage the player
        this.scene.player.takeDamage(10);
        
        // Properly destroy the enemy using our destroy method
        this.destroyEnemy(enemy);
    }
    
    destroyEnemy(enemy, isHexagonKill = false) {
        try {
            // CRITICAL: Disable physics and collisions FIRST
            if (enemy.body) {
                enemy.body.enable = false;
            }
            
            // Disable collision detection
            enemy.setActive(false);
            enemy.isBeingDestroyed = true;
            
            let pointsAwarded = 0;
            
            // Calculate base points based on enemy type
            pointsAwarded = this.getPointsForEnemyType(enemy.enemyType);
            
            // Play enemy destroyed sound
            if (this.scene.soundManager) {
                this.scene.soundManager.playEnemyDestroyed();
            }
            
            // If this is a kill by a hexagon in reverse motion, add 25% bonus
            if (isHexagonKill) {
                const bonus = Math.floor(pointsAwarded * 0.25);
                pointsAwarded += bonus;
                
                // Show bonus text
                const bonusText = this.scene.add.text(enemy.x, enemy.y, `+${bonus} BONUS!`, {
                    fontSize: '18px',
                    fontStyle: 'bold',
                    color: '#ffff00',
                    stroke: '#000000',
                    strokeThickness: 3
                }).setOrigin(0.5);
                
                // Animate the bonus text
                this.scene.tweens.add({
                    targets: bonusText,
                    y: enemy.y - 50,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => {
                        bonusText.destroy();
                    }
                });
            }
            
            // Add points to score
            this.scene.addScore(pointsAwarded);
            
            // Use the particle system for explosion effects
            if (this.scene.particleSystem) {
                this.scene.particleSystem.createExplosion(enemy.x, enemy.y, enemy.width, enemy.tint || 0xff0000);
            }
            
            // Add a very subtle screen shake (reduced intensity)
            this.scene.cameras.main.shake(100, 0.002);

            // Clean up particle trail if this is a hexagon
            if (enemy.enemyType === 'hexagon' && enemy.trailParticleManager) {
                enemy.trailParticleManager.destroy();
            }

            // Clean up danger aura if this is a regular enemy
            if (enemy.dangerAura) {
                enemy.dangerAura.destroy();
            }
            if (enemy.auraUpdateTimer) {
                enemy.auraUpdateTimer.remove();
            }

            // Clean up particle effects
            if (enemy.particleManager) {
                enemy.particleManager.destroy();
            }

            // Destroy the enemy
            enemy.destroy();
            
            // Return points awarded for reference
            return pointsAwarded;
        } catch (error) {
            console.warn("Error destroying enemy:", error);
            return 0;
        }
    }
    
    getPointsForEnemyType(enemyType) {
        switch (enemyType) {
            case 'circle':
                return 100; // Blue circle - 100 points
            case 'square':
                return 200; // Yellow square - 200 points
            case 'triangle':
                return 300; // Red triangle - 300 points
            case 'hexagon':
                return 50; // Purple hexagon - 50 points
            default:
                return 50; // Other enemies - 50 points
        }
    }
    
    addScoreForEnemy(enemyType) {
        const points = this.getPointsForEnemyType(enemyType);
        this.scene.addScore(points);
        return points;
    }
    
    /**
     * Adds a pulsing outline effect to make large enemies more noticeable
     * @param {Phaser.GameObjects.Sprite} enemy - The enemy sprite to add the outline to
     * @param {number} color - The color of the outline
     */
    addPulsingOutline(enemy, color) {
        if (!enemy || !enemy.active || !this.scene) return;
        
        try {
            // Create outline graphics
            const outline = this.scene.add.graphics();
            outline.setDepth(enemy.depth - 1); // Behind the enemy
            
            // Store on the enemy for future reference
            enemy.outlineEffect = outline;
            
            // Update function for the outline
            const updateOutline = () => {
                if (!enemy.active || !outline) {
                    // Clean up if enemy is destroyed
                    if (outline) outline.destroy();
                    return;
                }
                
                // Clear previous outline
                outline.clear();
                
                // Draw new outline based on enemy shape and size
                const size = enemy.width;
                const x = enemy.x;
                const y = enemy.y;
                
                // Determine pulse intensity (0.8 to 1.2) based on time
                const pulseIntensity = 1 + (0.2 * Math.sin(this.scene.time.now / 200));
                const outlineWidth = 3 * pulseIntensity;
                
                // Set outline style
                outline.lineStyle(outlineWidth, color, 0.6);
                
                // Draw shape based on enemy type
                if (enemy.enemyType === 'hexagon') {
                    // Hexagon outline
                    const hexRadius = size/2 * 1.1; // Slightly larger than enemy
                    outline.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = (Math.PI / 3) * i;
                        const pointX = x + hexRadius * Math.cos(angle);
                        const pointY = y + hexRadius * Math.sin(angle);
                        if (i === 0) {
                            outline.moveTo(pointX, pointY);
                        } else {
                            outline.lineTo(pointX, pointY);
                        }
                    }
                    outline.closePath().strokePath();
                } else if (enemy.enemyType === 'triangle') {
                    // Triangle outline
                    const padding = size * 0.1;
                    outline.beginPath();
                    outline.moveTo(x, y - size/2 - padding);
                    outline.lineTo(x - size/2 - padding, y + size/2 + padding);
                    outline.lineTo(x + size/2 + padding, y + size/2 + padding);
                    outline.closePath().strokePath();
                } else if (enemy.enemyType === 'square') {
                    // Square outline
                    const halfSize = size/2 * 1.1; // Slightly larger
                    outline.strokeRect(x - halfSize, y - halfSize, size * 1.1, size * 1.1);
                } else {
                    // Circle outline (default)
                    outline.strokeCircle(x, y, size/2 * 1.1);
                }
            };
            
            // Set up timer to update outline
            const timer = this.scene.time.addEvent({
                delay: 50,
                callback: updateOutline,
                loop: true
            });
            
            // Store timer reference for cleanup
            enemy.outlineTimer = timer;
            
            // Ensure outline is destroyed when enemy is destroyed
            enemy.on('destroy', () => {
                if (outline) outline.destroy();
                if (timer) timer.remove();
            });
            
            // Initial update
            updateOutline();
        } catch (error) {
            console.warn("Error adding pulsing outline:", error);
        }
    }
    
    /**
     * Generate a deterministic note sequence from actual audio analysis data
     */
    generateNoteSequence() {
        const sequence = [];
        
        // Get current time to base the sequence timing on
        const currentTime = this.scene.audioAnalyzer ? 
                           ((this.scene.time.now - this.scene.gameStartTime) / 1000) : 0;
        
        // Try to use real audio analysis data if available
        if (this.scene.audioAnalyzer && this.scene.audioAnalyzer.frequencyData) {
            // Use frequency analysis to determine notes
            const frequencyData = this.scene.audioAnalyzer.frequencyData;
            const segmentLength = 8; // Generate 8 segments
            
            for (let i = 0; i < segmentLength; i++) {
                // Sample different frequency ranges for each segment
                const sampleIndex = Math.floor((i / segmentLength) * frequencyData.length);
                const frequency = frequencyData[sampleIndex] || 0;
                
                // Map frequency intensity to note (deterministic based on audio)
                const noteIndex = Math.floor((frequency / 255) * 7); // 0-6 for 7 notes
                const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
                const note = notes[Math.max(0, Math.min(6, noteIndex))];
                
                const time = currentTime + (i * 0.4); // 400ms between notes
                const duration = 0.3;
                
                sequence.push({
                    note: note,
                    time: time,
                    duration: duration,
                    frequency: frequency // Store original frequency for reference
                });
            }
        } else {
            // Fallback: Use a deterministic pattern based on current time
            // This ensures the same time in a song always produces the same pattern
            const timeBasedSeed = Math.floor(currentTime * 10) % 100; // Deterministic seed
            const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
            
            for (let i = 0; i < 8; i++) {
                // Use time-based deterministic selection instead of random
                const noteIndex = (timeBasedSeed + i * 3) % notes.length;
                const note = notes[noteIndex];
                
                const time = currentTime + (i * 0.4);
                const duration = 0.3;
                
                sequence.push({
                    note: note,
                    time: time,
                    duration: duration
                });
            }
        }
        
        return sequence;
    }
    
    /**
     * Spawn a MusicWorm enemy
     */
    spawnMusicWorm() {
        // Check cooldown
        const currentTime = this.scene.time.now;
        if (currentTime - this.lastWormSpawnTime < this.wormSpawnCooldown) {
            return null;
        }
        
        // Don't spawn too many worms at once
        if (this.activeWorms.length >= 2) {
            return null;
        }
        
        // Generate note sequence
        const noteSequence = this.generateNoteSequence();
        
        // Create the worm
        const worm = new MusicWorm(this.scene, noteSequence);
        this.activeWorms.push(worm);
        this.lastWormSpawnTime = currentTime;
        
        return worm;
    }
    
    /**
     * Check if conditions are right to spawn a worm based on musical analysis
     */
    shouldSpawnWorm() {
        
        // Get current time for deterministic spawning
        const currentTime = this.scene.time.now;
        const gameTime = currentTime - (this.scene.gameStartTime || 0);
        
        // If no audio analyzer, use time-based deterministic spawning for testing
        if (!this.scene.audioAnalyzer) {
            // Spawn every 15-20 seconds with some variation
            const spawnInterval = 15000 + ((gameTime % 5000)); // 15-20 second intervals
            const shouldSpawn = (gameTime % spawnInterval) < 100; // Small window for spawning
            return shouldSpawn;
        }
        
        const volume = this.scene.audioAnalyzer.currentVolume || 0.5;
        const bpm = this.scene.audioAnalyzer.currentBPM || 120;
        
        // Get frequency data for musical analysis
        let hasStrongBass = false;
        let hasHighFrequency = false;
        
        if (this.scene.audioAnalyzer.frequencyData) {
            const freqData = this.scene.audioAnalyzer.frequencyData;
            const bassRange = freqData.slice(0, 32); // Low frequencies
            const highRange = freqData.slice(200, 255); // High frequencies
            
            // Check for strong bass (bass drops, strong beats)
            const avgBass = bassRange.reduce((sum, val) => sum + val, 0) / bassRange.length;
            hasStrongBass = avgBass > 80; // Lowered threshold
            
            // Check for high frequency content (cymbals, melody)
            const avgHigh = highRange.reduce((sum, val) => sum + val, 0) / highRange.length;
            hasHighFrequency = avgHigh > 60; // Lowered threshold
        } else {
            // Fallback: simulate musical features with dummy data
            // Use time-based patterns to simulate bass and high frequency content
            hasStrongBass = Math.sin(gameTime / 4000) > 0.3; // Simulate bass every ~8 seconds
            hasHighFrequency = Math.cos(gameTime / 3000) > 0.2; // Simulate highs every ~6 seconds
        }
        
        // More permissive triggers for better spawning
        const triggers = {
            volumePeak: volume > 0.4, // Lowered threshold
            strongBass: hasStrongBass,
            hasHighFreq: hasHighFrequency,
            steadyBeat: bpm >= 80 && bpm <= 180, // Wider BPM range
            timeCondition: (gameTime % 12000) > 10000 // Every 12 seconds, 2-second window
        };
        
        // Worm spawns on musical activity OR time-based fallback
        const shouldSpawn = (triggers.volumePeak && (triggers.strongBass || triggers.hasHighFreq) && triggers.steadyBeat) || triggers.timeCondition;
        
        
        return shouldSpawn;
    }
    
    /**
     * Retrofit all existing worms with new collision detection when energy weapon is deployed
     */
    retrofitAllWormsForEnergyWeapon() {
        
        this.activeWorms.forEach((worm, index) => {
            if (worm && worm.isActive && !worm.isDestroyed) {
                worm.retrofitCollisionDetection();
            } else {
            }
        });
        
    }
    
    // Update method called from scene
    update() {
        // Apply breathing effect to all active enemies based on real-time audio
        this.updateEnemyBreathing();
        
        // Update active worms and check for score penalties
        this.activeWorms.forEach((worm, index) => {
            if (worm.isActive) {
                worm.update();
                
                // Check if worm went off screen (penalty system)
                if (worm.segments && worm.segments.length > 0) {
                    const headSegment = worm.segments.find(seg => seg.isHead);
                    if (headSegment && headSegment.x < -100) {
                        // Worm escaped! Apply score penalty
                        const penalty = 500 * worm.segments.length; // 500 points per remaining segment
                        this.scene.addScore(-penalty); // Subtract points
                        
                        // Show penalty message
                        const penaltyText = this.scene.add.text(
                            this.scene.gameWidth / 2, this.scene.gameHeight / 3,
                            `WORM ESCAPED!\n-${penalty} POINTS!`,
                            {
                                fontSize: '28px',
                                fontStyle: 'bold',
                                color: '#ff0000',
                                stroke: '#000000',
                                strokeThickness: 4,
                                align: 'center'
                            }
                        ).setOrigin(0.5);
                        
                        // Animate penalty text
                        this.scene.tweens.add({
                            targets: penaltyText,
                            alpha: 0,
                            scale: 1.3,
                            duration: 2000,
                            onComplete: () => penaltyText.destroy()
                        });
                        
                        
                        // Mark worm as destroyed to trigger cleanup
                        worm.destroyWorm(false);
                    }
                }
            } else {
                // Remove inactive worms
                this.activeWorms.splice(index, 1);
            }
        });
        
        // Check for worm spawning based on musical analysis (deterministic)
        // Check every 10 frames to avoid excessive CPU usage
        if (this.scene.time.now % 167 < 16) { // Roughly every 10 frames at 60fps
            if (this.shouldSpawnWorm()) {
                const worm = this.spawnMusicWorm();
            }
        }
    }
    
    /**
     * Updates all active enemies with breathing effect based on current audio intensity
     */
    updateEnemyBreathing() {
        // Get current audio intensity
        let currentIntensity = 0.5; // Default fallback
        if (this.scene.audioAnalyzer && this.scene.audioAnalyzer.currentVolume !== undefined) {
            currentIntensity = this.scene.audioAnalyzer.currentVolume;
        }
        
        // Calculate breathing scale factor
        // Range from 0.8x to 1.4x based on audio intensity
        const breathingScale = 0.8 + (currentIntensity * 0.6);
        
        // Apply to all active enemies
        this.scene.children.list.forEach(child => {
            if (child.enemyType && child.originalSize && child.active && !child.isBeingDestroyed) {
                // Skip powerup hexes from breathing effect
                if (child.enemyType === 'powerupHex') return;
                
                // Apply smooth breathing scale
                const targetScale = child.baseScale * breathingScale;
                
                // Use a lerp for smooth transitions instead of instant changes
                const currentScale = child.scaleX;
                const lerpedScale = Phaser.Math.Linear(currentScale, targetScale, 0.1);
                
                child.setScale(lerpedScale);
            }
        });
    }

    /**
     * Creates enemy-specific particle effects
     * @param {Phaser.GameObjects.Sprite} enemy - The enemy sprite to add particles to
     * @param {string} enemyType - The type of enemy (circle, square, triangle)
     */
    createEnemyParticles(enemy, enemyType) {
        try {
            let particleColor, particleSize, particleConfig;

            // Create particle texture based on enemy type
            const particleTextureName = `enemy-particle-${enemyType}-${this.scene.time.now}`;

            if (!this.scene.textures.exists(particleTextureName)) {
                const pSize = 8;
                const canvas = document.createElement('canvas');
                canvas.width = pSize;
                canvas.height = pSize;
                const ctx = canvas.getContext('2d');

                // Different particles for different enemy types
                if (enemyType === 'circle') {
                    // Blue sparks for circle
                    const gradient = ctx.createRadialGradient(pSize/2, pSize/2, 0, pSize/2, pSize/2, pSize/2);
                    gradient.addColorStop(0, 'rgba(100, 255, 255, 1.0)');
                    gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(pSize/2, pSize/2, pSize/2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (enemyType === 'square') {
                    // Orange embers for square
                    const gradient = ctx.createRadialGradient(pSize/2, pSize/2, 0, pSize/2, pSize/2, pSize/2);
                    gradient.addColorStop(0, 'rgba(255, 200, 100, 1.0)');
                    gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(pSize/2, pSize/2, pSize/2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (enemyType === 'triangle') {
                    // Red energy dots for triangle
                    const gradient = ctx.createRadialGradient(pSize/2, pSize/2, 0, pSize/2, pSize/2, pSize/2);
                    gradient.addColorStop(0, 'rgba(255, 100, 100, 1.0)');
                    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(pSize/2, pSize/2, pSize/2, 0, Math.PI * 2);
                    ctx.fill();
                }

                this.scene.textures.addCanvas(particleTextureName, canvas);
            }

            // Create particle emitter
            const particleManager = this.scene.add.particles(particleTextureName);

            // Different particle behaviors for different enemy types
            if (enemyType === 'circle') {
                // Blue sparks - crackling around the edges
                particleConfig = {
                    follow: enemy,
                    lifespan: 400,
                    speed: { min: 20, max: 50 },
                    scale: { start: 0.8, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    blendMode: 'ADD',
                    frequency: 100,
                    quantity: 1
                };
            } else if (enemyType === 'square') {
                // Orange embers - trailing behind
                particleConfig = {
                    follow: enemy,
                    x: 15, // Offset to the right (trailing)
                    lifespan: 500,
                    speed: { min: 10, max: 30 },
                    scale: { start: 1.0, end: 0.2 },
                    alpha: { start: 0.9, end: 0 },
                    blendMode: 'ADD',
                    frequency: 80,
                    quantity: 1,
                    gravityY: -20 // Float upward slightly
                };
            } else if (enemyType === 'triangle') {
                // Red energy - pulsing outward
                particleConfig = {
                    follow: enemy,
                    lifespan: 300,
                    speed: { min: 30, max: 60 },
                    scale: { start: 0.6, end: 0 },
                    alpha: { start: 1.0, end: 0 },
                    blendMode: 'ADD',
                    frequency: 60,
                    quantity: 2
                };
            }

            const emitter = particleManager.createEmitter(particleConfig);
            particleManager.setDepth(enemy.depth - 2);

            // Store references for cleanup
            enemy.particleEmitter = emitter;
            enemy.particleManager = particleManager;

        } catch (error) {
            console.error('Error creating enemy particles:', error);
        }
    }

    /**
     * Creates a pulsing red danger aura around regular enemies
     * @param {Phaser.GameObjects.Sprite} enemy - The enemy sprite to add the aura to
     * @param {number} size - The size of the enemy
     */
    createDangerAura(enemy, size) {
        try {
            // console.log(`🔴 Creating danger aura for ${enemy.enemyType}, size: ${size}`);

            // Create a graphics object for the red aura
            const aura = this.scene.add.graphics();
            aura.setDepth(enemy.depth - 1); // Behind the enemy

            // Store reference for cleanup
            enemy.dangerAura = aura;

            // Create pulsing animation for the aura - BIGGER and MORE VISIBLE
            const auraScale = { value: 1.6 };
            const auraAlpha = { value: 0.5 };

            this.scene.tweens.add({
                targets: auraScale,
                value: 1.9,
                duration: 400,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.scene.tweens.add({
                targets: auraAlpha,
                value: 0.3,
                duration: 400,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // console.log(`🔴 Aura animations created with scale: ${auraScale.value}, alpha: ${auraAlpha.value}`);

            // Update the aura every frame to follow the enemy
            let frameCount = 0;
            const updateAura = this.scene.time.addEvent({
                delay: 30,
                callback: () => {
                    if (!enemy.active || !aura) {
                        // console.log(`🔴 Stopping aura update - enemy active: ${enemy.active}, aura exists: ${!!aura}`);
                        if (aura) aura.destroy();
                        updateAura.remove();
                        return;
                    }

                    // Clear and redraw the aura as a filled glow
                    aura.clear();
                    aura.fillStyle(0xff0000, auraAlpha.value);

                    const auraSize = (size / 2) * auraScale.value;

                    // Log first few frames for debugging
                    // if (frameCount < 3) {
                    //     console.log(`🔴 Drawing aura frame ${frameCount}: type=${enemy.enemyType}, pos=(${enemy.x}, ${enemy.y}), size=${auraSize}, alpha=${auraAlpha.value}`);
                    //     frameCount++;
                    // }

                    // Draw filled shape with rotation matching enemy
                    if (enemy.enemyType === 'triangle') {
                        // Calculate triangle points with rotation
                        const cos = Math.cos(enemy.rotation);
                        const sin = Math.sin(enemy.rotation);

                        // Three points of triangle (top, bottom-left, bottom-right)
                        const p1x = enemy.x + (0 * cos - (-auraSize) * sin);
                        const p1y = enemy.y + (0 * sin + (-auraSize) * cos);
                        const p2x = enemy.x + ((-auraSize) * cos - auraSize * sin);
                        const p2y = enemy.y + ((-auraSize) * sin + auraSize * cos);
                        const p3x = enemy.x + (auraSize * cos - auraSize * sin);
                        const p3y = enemy.y + (auraSize * sin + auraSize * cos);

                        aura.fillTriangle(p1x, p1y, p2x, p2y, p3x, p3y);
                    } else if (enemy.enemyType === 'square') {
                        // Draw rotated square using polygon
                        const cos = Math.cos(enemy.rotation);
                        const sin = Math.sin(enemy.rotation);

                        // Four corners of square
                        const corners = [
                            { x: -auraSize, y: -auraSize },
                            { x: auraSize, y: -auraSize },
                            { x: auraSize, y: auraSize },
                            { x: -auraSize, y: auraSize }
                        ];

                        const rotatedCorners = corners.map(corner => ({
                            x: enemy.x + (corner.x * cos - corner.y * sin),
                            y: enemy.y + (corner.x * sin + corner.y * cos)
                        }));

                        aura.fillPoints(rotatedCorners, true);
                    } else {
                        // Circle doesn't need rotation
                        aura.fillCircle(enemy.x, enemy.y, auraSize);
                    }
                },
                loop: true
            });

            // Store the timer for cleanup
            enemy.auraUpdateTimer = updateAura;
        } catch (error) {
            console.error('Error creating danger aura:', error);
        }
    }

    /**
     * Creates a particle trail that follows the hexagon as it bounces
     * @param {Phaser.GameObjects.Sprite} hexagon - The hexagon sprite to attach the trail to
     */
    createHexagonTrail(hexagon) {
        try {
            // Create particle texture sized relative to the hexagon (about 75% of hexagon size)
            const hexagonSize = hexagon.width || 30;
            const particleSize = Math.max(20, Math.round(hexagonSize * 0.75));
            const particleTextureName = `hexagon-trail-particle-${this.scene.time.now}`;

            // Check if texture already exists
            if (!this.scene.textures.exists(particleTextureName)) {
                const particleCanvas = document.createElement('canvas');
                particleCanvas.width = particleSize;
                particleCanvas.height = particleSize;
                const particleCtx = particleCanvas.getContext('2d');

                // Create a glowing particle with radial gradient
                const gradient = particleCtx.createRadialGradient(
                    particleSize/2, particleSize/2, 0,
                    particleSize/2, particleSize/2, particleSize/2
                );

                gradient.addColorStop(0, 'rgba(200, 255, 255, 1.0)');     // Bright cyan-white center
                gradient.addColorStop(0.5, 'rgba(153, 0, 255, 0.8)');     // Purple
                gradient.addColorStop(1, 'rgba(153, 0, 255, 0)');         // Transparent edge

                particleCtx.fillStyle = gradient;
                particleCtx.beginPath();
                particleCtx.arc(particleSize/2, particleSize/2, particleSize/2, 0, Math.PI * 2);
                particleCtx.fill();

                this.scene.textures.addCanvas(particleTextureName, particleCanvas);
            }

            // Create particle emitter manager
            const particleManager = this.scene.add.particles(particleTextureName);

            // Create the emitter that follows the hexagon
            const trailEmitter = particleManager.createEmitter({
                follow: hexagon,
                lifespan: 800,      // Particles fade out after 800ms (longer trail)
                speed: 0,           // No initial speed - just appear where hexagon was
                scale: {
                    start: 1.2,     // Start slightly larger
                    end: 0.3        // Fade to smaller
                },
                alpha: {
                    start: 0.9,     // Start more opaque
                    end: 0
                },
                blendMode: 'ADD',   // Additive blending for glow effect
                frequency: 30,      // Emit more frequently for denser trail
                gravityY: 0         // No gravity
            });

            // Set depth behind the hexagon but in front of background
            particleManager.setDepth(hexagon.depth - 1);

            // Store references for cleanup
            hexagon.trailEmitter = trailEmitter;
            hexagon.trailParticleManager = particleManager;

            console.log('✨ Created particle trail for hexagon');
        } catch (error) {
            console.error('Error creating hexagon trail:', error);
        }
    }
}
