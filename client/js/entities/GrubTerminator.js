// GrubTerminator.js - Companion ship that helps destroy MusicWorms

export default class GrubTerminator {
    constructor(scene) {
        this.scene = scene;
        
        // Get game dimensions
        this.gameWidth = scene.gameWidth || 1280;
        this.gameHeight = scene.gameHeight || 720;
        
        // Positioning - hockey goalie style in back-left area
        this.baseX = this.gameWidth * 0.15; // 15% from left edge
        this.currentX = this.baseX;
        this.currentY = this.gameHeight / 2;
        this.targetY = this.currentY;
        
        // State management
        this.isActive = true;
        this.isHidden = false;
        this.hiddenTimer = 0; // Time remaining while hidden
        this.lastShotTime = 0;
        this.shotCooldown = 1500; // 1.5 seconds between shots
        
        // Movement properties
        this.moveSpeed = 120; // pixels per second
        this.smoothingFactor = 0.088; // How quickly it moves to target position (10% faster)
        
        // Targeting
        this.currentTarget = null;
        this.attackRange = this.gameWidth * 0.8; // Can attack across 80% of screen
        
        // Visual components
        this.container = null;
        this.mainBall = null;
        this.coreGlow = null;
        this.outerGlow = null;
        this.bubbleTrail = [];
        this.maxBubbles = 8;
        
        // Active projectiles
        this.activeProjectiles = [];
        
        // Create the visual representation
        this.createVisuals();
        
        // Start the AI behavior
        this.startAI();
        
        console.log("🤖 Grub Terminator created at position:", this.baseX, this.currentY);
    }
    
    /**
     * Create the visual representation of the Grub Terminator
     */
    createVisuals() {
        // Create main container
        this.container = this.scene.add.container(this.currentX, this.currentY);
        this.container.setDepth(8); // Above enemies, below UI
        
        // Create the main round ball - bright cyan color
        this.mainBall = this.scene.add.circle(0, 0, 12, 0x00ffff, 0.9);
        this.mainBall.setStrokeStyle(2, 0xffffff);
        
        // Create core glow (smaller white center)
        this.coreGlow = this.scene.add.circle(0, 0, 6, 0xffffff, 0.8);
        
        // Create outer glow effect
        this.outerGlow = this.scene.add.circle(0, 0, 20, 0x00ffff, 0.3);
        this.outerGlow.setBlendMode(Phaser.BlendModes.ADD);
        
        // Add all components to container
        this.container.add(this.outerGlow);
        this.container.add(this.mainBall);
        this.container.add(this.coreGlow);
        
        // Add pulsing animation to outer glow
        this.scene.tweens.add({
            targets: this.outerGlow,
            scale: 1.3,
            alpha: 0.1,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Add subtle rotation to main ball
        this.scene.tweens.add({
            targets: this.mainBall,
            rotation: Math.PI * 2,
            duration: 4000,
            repeat: -1,
            ease: 'Linear'
        });
        
        // Initialize bubble trail
        this.initializeBubbleTrail();
        
        console.log("🤖 Grub Terminator visuals created");
    }
    
    /**
     * Initialize the bubble particle trail system
     */
    initializeBubbleTrail() {
        // Create a pool of bubble objects - fewer but larger bubbles
        this.maxBubbles = 8; // Back to 8 for better visibility
        
        for (let i = 0; i < this.maxBubbles; i++) {
            const bubble = this.scene.add.circle(
                this.currentX - (i * 8), // Further spacing (8px for better visibility)
                this.currentY + (Math.random() - 0.5) * 4, // Minimal vertical spread
                4 + Math.random() * 3, // Much larger bubbles (4-7px radius instead of 1-3)
                0x66ffff,
                0.8
            );
            bubble.setDepth(7); // Behind the terminator but above background
            bubble.setBlendMode(Phaser.BlendModes.ADD);
            bubble.isActive = true; // Start as active
            bubble.age = i * 50; // Stagger the ages for smooth trail
            bubble.maxAge = 800; // Longer lifetime for visibility
            bubble.trailIndex = i; // Store position in trail
            
            this.bubbleTrail.push(bubble);
        }
        
        console.log("🤖 Bubble trail initialized with", this.maxBubbles, "larger bubbles");
    }
    
    /**
     * Start the AI behavior system
     */
    startAI() {
        // AI update timer - runs every 100ms for efficiency
        this.aiTimer = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                if (this.isActive && !this.isHidden) {
                    this.updateAI();
                }
            },
            loop: true
        });
        
        console.log("🤖 AI system started");
    }
    
    /**
     * Main AI update logic
     */
    updateAI() {
        // 1. Find the best target (closest worm head to player)
        this.findTarget();
        
        // 2. Move to optimal position for current target
        this.updateTargetPosition();
        
        // 3. Attack if target is in range and cooldown is ready
        this.attemptAttack();
    }
    
    /**
     * Find the best target among active MusicWorms (rope-based collision)
     */
    findTarget() {
        this.currentTarget = null;
        this.currentTargetCollisionArea = null;
        
        if (!this.scene.enemyManager || !this.scene.enemyManager.activeWorms) {
            return;
        }
        
        let closestWorm = null;
        let closestCollisionArea = null;
        let closestDistance = Infinity;
        
        // Look through all active worms
        this.scene.enemyManager.activeWorms.forEach(worm => {
            if (!worm || !worm.isActive || worm.isDestroyed) {
                return;
            }
            
            // Check for rope-based collision area (new system)
            let targetCollisionArea = null;
            if (worm.frontmostCollisionArea && worm.frontmostCollisionArea.active) {
                targetCollisionArea = worm.frontmostCollisionArea;
            }
            // Fallback to legacy head segment system
            else if (worm.segments && worm.segments.length > 0) {
                const headSegment = worm.segments.find(seg => seg.isHead);
                if (headSegment && headSegment.hitArea && headSegment.hitArea.active) {
                    targetCollisionArea = headSegment.hitArea;
                }
            }
            
            if (!targetCollisionArea) return;
            
            // Calculate distance to player (prioritize worms closer to player)
            const distanceToPlayer = Math.abs(targetCollisionArea.x - (this.scene.player ? this.scene.player.x : 0));
            
            // Only consider worms that are within attack range and not too close to the left edge
            if (targetCollisionArea.x > 100 && targetCollisionArea.x < this.gameWidth - 50 && distanceToPlayer < closestDistance) {
                closestDistance = distanceToPlayer;
                closestWorm = worm;
                closestCollisionArea = targetCollisionArea;
            }
        });
        
        this.currentTarget = closestWorm;
        this.currentTargetCollisionArea = closestCollisionArea;
        
        // Debug logging (uncomment for debugging)
        // if (this.currentTarget) {
        //     console.log("🤖 Target acquired:", this.currentTarget.segments ? this.currentTarget.segments.length : 'rope-based', "collision area at", this.currentTargetCollisionArea?.x, this.currentTargetCollisionArea?.y);
        // }
    }
    
    /**
     * Update the target position based on current target (rope-compatible)
     */
    updateTargetPosition() {
        if (!this.currentTarget || !this.currentTargetCollisionArea) {
            // No target - return to center patrol position
            this.targetY = this.gameHeight / 2;
            return;
        }
        
        // Move to the same Y position as the target collision area
        this.targetY = this.currentTargetCollisionArea.y;
        
        // Ensure we stay within screen bounds
        this.targetY = Math.max(30, Math.min(this.gameHeight - 30, this.targetY));
    }
    
    /**
     * Attempt to attack the current target if conditions are met (rope-compatible)
     */
    attemptAttack() {
        if (!this.currentTarget || !this.currentTargetCollisionArea) return;
        
        const currentTime = this.scene.time.now;
        if (currentTime - this.lastShotTime < this.shotCooldown) return;
        
        // Check if target is in range using collision area position
        const distance = Phaser.Math.Distance.Between(
            this.currentX, this.currentY,
            this.currentTargetCollisionArea.x, this.currentTargetCollisionArea.y
        );
        
        if (distance <= this.attackRange) {
            this.fireProjectile(this.currentTargetCollisionArea);
            this.lastShotTime = currentTime;
        }
    }
    
    /**
     * Fire a line art circle projectile at the target collision area (rope-compatible)
     */
    fireProjectile(targetCollisionArea) {
        console.log("🤖 Firing projectile at collision area:", targetCollisionArea.x, targetCollisionArea.y);
        
        // Create the line art circle projectile
        const projectile = {
            graphics: this.scene.add.graphics(),
            targetX: targetCollisionArea.x,
            targetY: targetCollisionArea.y,
            currentRadius: 5,
            maxRadius: 25,
            phase: 'expanding', // 'expanding' -> 'contracting' -> 'complete'
            startTime: this.scene.time.now,
            target: this.currentTarget,
            targetCollisionArea: targetCollisionArea
        };
        
        // Position the graphics at the target location
        projectile.graphics.setPosition(targetCollisionArea.x, targetCollisionArea.y);
        projectile.graphics.setDepth(12);
        
        // Draw initial circle
        this.drawProjectileCircle(projectile);
        
        // Add to active projectiles
        this.activeProjectiles.push(projectile);
        
        // Create muzzle flash effect at terminator position
        this.createMuzzleFlash();
        
        console.log("🤖 Projectile created and added to active list");
    }
    
    /**
     * Draw the line art circle for a projectile
     */
    drawProjectileCircle(projectile) {
        projectile.graphics.clear();
        
        // Draw circle outline - bright cyan with white core
        projectile.graphics.lineStyle(3, 0x00ffff, 0.9);
        projectile.graphics.strokeCircle(0, 0, projectile.currentRadius);
        
        // Add inner glow
        projectile.graphics.lineStyle(1, 0xffffff, 0.7);
        projectile.graphics.strokeCircle(0, 0, projectile.currentRadius * 0.7);
        
        // Add outer glow effect
        projectile.graphics.lineStyle(5, 0x00ffff, 0.3);
        projectile.graphics.strokeCircle(0, 0, projectile.currentRadius * 1.2);
    }
    
    /**
     * Create muzzle flash effect when firing
     */
    createMuzzleFlash() {
        // Create a bright flash at the terminator position
        const flash = this.scene.add.circle(this.currentX, this.currentY, 15, 0xffffff, 0.8);
        flash.setDepth(10);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        
        // Animate the flash
        this.scene.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 200,
            ease: 'Power2.easeOut',
            onComplete: () => {
                flash.destroy();
            }
        });
        
        // Create particle burst
        if (this.scene.particleSystem) {
            this.scene.particleSystem.createExplosion(
                this.currentX, this.currentY, 20, 0x00ffff
            );
        }
    }
    
    /**
     * Update projectiles animation and collision
     */
    updateProjectiles() {
        if (this.activeProjectiles.length === 0) return;
        
        const currentTime = this.scene.time.now;
        
        // Update each projectile
        this.activeProjectiles.forEach((projectile, index) => {
            const elapsed = currentTime - projectile.startTime;
            
            if (projectile.phase === 'expanding') {
                // Expand the circle
                projectile.currentRadius += 1.65; // Growth rate (10% faster)
                
                if (projectile.currentRadius >= projectile.maxRadius) {
                    projectile.phase = 'contracting';
                    console.log("🤖 Projectile switching to contracting phase");
                }
            } else if (projectile.phase === 'contracting') {
                // Contract the circle
                projectile.currentRadius -= 2.2; // Contraction rate (10% faster)
                
                if (projectile.currentRadius <= 3) {
                    // Hit! Trigger damage on the target
                    this.hitTarget(projectile);
                    projectile.phase = 'complete';
                }
            } else if (projectile.phase === 'complete') {
                // Clean up
                projectile.graphics.destroy();
                this.activeProjectiles.splice(index, 1);
                return;
            }
            
            // Update visual
            this.drawProjectileCircle(projectile);
            
            // Safety cleanup - remove projectiles that have been active too long
            if (elapsed > 3000) { // 3 seconds max
                projectile.graphics.destroy();
                this.activeProjectiles.splice(index, 1);
            }
        });
    }
    
    /**
     * Handle hitting a target with a projectile
     */
    hitTarget(projectile) {
        if (!projectile.target || !projectile.target.isActive || projectile.target.isDestroyed) {
            console.log("🤖 Target no longer valid");
            return;
        }
        
        console.log("🤖 HIT! Triggering worm head destruction");
        
        // Create hit effect
        if (this.scene.particleSystem) {
            this.scene.particleSystem.createExplosion(
                projectile.targetX, projectile.targetY, 30, 0x00ffff
            );
        }
        
        // Damage the worm (trigger head shrinking)
        projectile.target.shrinkFromHead();
        
        // Award points for successful hit
        if (this.scene.addScore) {
            this.scene.addScore(150); // Bonus points for companion kill
        }
        
        // Show hit indicator
        const hitText = this.scene.add.text(
            projectile.targetX, projectile.targetY - 30,
            'COMPANION HIT!\n+150',
            {
                fontSize: '16px',
                fontStyle: 'bold',
                color: '#00ffff',
                stroke: '#000000',
                strokeThickness: 2,
                align: 'center'
            }
        ).setOrigin(0.5);
        
        // Animate hit text
        this.scene.tweens.add({
            targets: hitText,
            y: projectile.targetY - 60,
            alpha: 0,
            duration: 1500,
            onComplete: () => hitText.destroy()
        });
    }
    
    /**
     * Hide the companion when player takes damage
     */
    hideForDamage() {
        if (this.isHidden) return; // Already hidden
        
        console.log("🤖 Hiding companion due to player damage");
        
        this.isHidden = true;
        this.hiddenTimer = 5000; // 5 seconds
        
        // Fade out animation
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            ease: 'Power2.easeIn'
        });
        
        // Hide bubble trail
        this.bubbleTrail.forEach(bubble => {
            this.scene.tweens.add({
                targets: bubble,
                alpha: 0,
                duration: 300
            });
        });
    }
    
    /**
     * Show the companion after hiding period
     */
    showAfterHiding() {
        if (!this.isHidden) return;
        
        console.log("🤖 Showing companion after hiding period");
        
        this.isHidden = false;
        this.hiddenTimer = 0;
        
        // Fade in animation
        this.scene.tweens.add({
            targets: this.container,
            alpha: 1,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });
        
        // Show bubble trail
        this.bubbleTrail.forEach(bubble => {
            this.scene.tweens.add({
                targets: bubble,
                alpha: 0.6,
                duration: 500
            });
        });
    }
    
    /**
     * Update bubble trail positions and animations
     */
    updateBubbleTrail() {
        if (!this.bubbleTrail || this.bubbleTrail.length === 0) return;
        
        // Update bubbles to follow the terminator in a chain formation
        this.bubbleTrail.forEach((bubble, index) => {
            if (!bubble || !bubble.active) return;
            
            // For the first bubble, follow the terminator very closely
            if (index === 0) {
                // First bubble follows directly behind the terminator (very close)
                const targetX = this.currentX - 8; // Very close to terminator
                const targetY = this.currentY;
                
                // Very high lerp factor for tight connection
                const lerpFactor = 0.6;
                bubble.x = Phaser.Math.Linear(bubble.x, targetX, lerpFactor);
                bubble.y = Phaser.Math.Linear(bubble.y, targetY, lerpFactor);
            } else {
                // Subsequent bubbles follow the previous bubble
                const previousBubble = this.bubbleTrail[index - 1];
                if (previousBubble && previousBubble.active) {
                    const targetX = previousBubble.x - 10; // Follow previous bubble closely
                    const targetY = previousBubble.y + Math.sin((this.scene.time.now / 400) + (index * 0.2)) * 1; // Very subtle wave
                    
                    // High lerp factor for tight chain
                    const lerpFactor = 0.4;
                    bubble.x = Phaser.Math.Linear(bubble.x, targetX, lerpFactor);
                    bubble.y = Phaser.Math.Linear(bubble.y, targetY, lerpFactor);
                }
            }
            
            // Set bubble size and alpha based on position in trail
            const trailProgress = index / (this.maxBubbles - 1); // 0 = front, 1 = back
            
            // Bubbles get smaller and more transparent as they go back - but not too small
            const scale = 1.0 - (trailProgress * 0.2); // Scale from 1.0 to 0.8 (even less reduction)
            const alpha = 0.9 - (trailProgress * 0.3); // Alpha from 0.9 to 0.6 (more visible)
            
            bubble.setScale(scale);
            bubble.setAlpha(alpha);
            
            // Set radius based on scale - larger base radius
            const baseRadius = 6; // Increased from 5 to 6
            bubble.setRadius(baseRadius * scale);
        });
    }
    
    /**
     * Main update method called every frame
     */
    update() {
        if (!this.isActive) return;
        
        const deltaTime = this.scene.game.loop.delta / 1000; // Convert to seconds
        
        // Handle hiding timer
        if (this.isHidden) {
            this.hiddenTimer -= this.scene.game.loop.delta;
            if (this.hiddenTimer <= 0) {
                this.showAfterHiding();
            }
            return; // Don't update anything else while hidden
        }
        
        // Smooth movement towards target Y position
        const yDiff = this.targetY - this.currentY;
        this.currentY += yDiff * this.smoothingFactor;
        
        // Update container position
        if (this.container) {
            this.container.setPosition(this.currentX, this.currentY);
        }
        
        // Update bubble trail
        this.updateBubbleTrail();
        
        // Update projectiles
        this.updateProjectiles();
    }
    
    /**
     * Clean up when terminator is destroyed
     */
    destroy() {
        console.log("🤖 Destroying Grub Terminator");
        
        this.isActive = false;
        
        // Clean up AI timer
        if (this.aiTimer) {
            this.aiTimer.remove();
        }
        
        // Clean up bubble trail
        this.bubbleTrail.forEach(bubble => {
            if (bubble.active) {
                bubble.destroy();
            }
        });
        this.bubbleTrail = [];
        
        // Clean up active projectiles
        this.activeProjectiles.forEach(projectile => {
            if (projectile.graphics && projectile.graphics.active) {
                projectile.graphics.destroy();
            }
        });
        this.activeProjectiles = [];
        
        // Clean up visual container
        if (this.container && this.container.active) {
            this.container.destroy();
        }
        
        console.log("🤖 Grub Terminator cleanup complete");
    }
}
