// HighScoreDisplay.js - Shows and animates high score list

export default class HighScoreDisplay {
    constructor(scene) {
        this.scene = scene;
        this.gameWidth = scene.sys.game.config.width;
        this.gameHeight = scene.sys.game.config.height;
        this.displayGroup = scene.add.group();
        this.visible = false;
        this.particles = null;
        this.emitters = [];
    }

    /**
     * Show the high score display with animation
     * @param {Array} scores - Array of score objects to display
     * @param {Object} options - Display options
     * @param {number} options.highlightRank - Rank to highlight (1-based)
     * @param {boolean} options.fadeIn - Whether to animate fade in (default: true)
     */
    show(scores, options = {}) {
        const { highlightRank = -1, fadeIn = true } = options;
        
        // Clear any existing display
        this.clear();
        this.visible = true;

        // Create background panel
        const panelWidth = this.gameWidth * 0.6;
        const panelHeight = this.gameHeight * 0.7;
        const panelX = this.gameWidth / 2 - panelWidth / 2;
        const panelY = this.gameHeight / 2 - panelHeight / 2;
        
        // Add background with higher opacity for better visibility
        const background = this.scene.add.rectangle(
            this.gameWidth / 2,
            this.gameHeight / 2,
            panelWidth,
            panelHeight,
            0x000000, 
            0.9  // Increased opacity for better visibility
        );
        background.setStrokeStyle(2, 0x00bfff);
        this.displayGroup.add(background);

        // Add title
        const titleText = this.scene.add.text(
            this.gameWidth / 2,
            panelY + 40,
            'HIGH SCORES',
            {
                fontSize: '36px',
                fontStyle: 'bold',
                color: '#00ffff', // Brighter cyan color
                stroke: '#000000',
                strokeThickness: 5, // Thicker stroke
                align: 'center',
                shadow: { color: '#00bfff', blur: 10, offsetX: 0, offsetY: 0 }
            }
        ).setOrigin(0.5);
        this.displayGroup.add(titleText);

        // Add particle effects around the title
        this.setupParticles(titleText);

        // Add scores with staggered animation
        const startY = panelY + 100;
        const lineHeight = 50;
        
        // Handle empty scores list
        if (!scores || scores.length === 0) {
            const emptyText = this.scene.add.text(
                this.gameWidth / 2,
                startY + lineHeight * 2,
                'NO SCORES YET\nBE THE FIRST!',
                {
                    fontSize: '24px',
                    color: '#ffffff',
                    align: 'center'
                }
            ).setOrigin(0.5);
            this.displayGroup.add(emptyText);
        } else {
            // Draw header row
            const headerRow = this.scene.add.container(0, 0);
            
            const rankHeader = this.scene.add.text(
                panelX + 60,
                startY,
                'RANK',
                { fontSize: '20px', color: '#999999' }
            ).setOrigin(0.5, 0.5);
            
            const initialsHeader = this.scene.add.text(
                panelX + 150,
                startY,
                'PLAYER',
                { fontSize: '20px', color: '#999999' }
            ).setOrigin(0.5, 0.5);
            
            const scoreHeader = this.scene.add.text(
                panelX + 280,
                startY,
                'SCORE',
                { fontSize: '20px', color: '#999999' }
            ).setOrigin(0.5, 0.5);
            
            const dateHeader = this.scene.add.text(
                panelX + 410,
                startY,
                'DATE',
                { fontSize: '20px', color: '#999999' }
            ).setOrigin(0.5, 0.5);
            
            headerRow.add([rankHeader, initialsHeader, scoreHeader, dateHeader]);
            this.displayGroup.add(headerRow);
            
            // Add divider line
            const divider = this.scene.add.line(
                0, 0,
                panelX + 40, startY + 20,
                panelX + panelWidth - 40, startY + 20,
                0x666666
            );
            this.displayGroup.add(divider);
            
            // Draw each score row with staggered animation
            scores.forEach((score, index) => {
                const rank = index + 1;
                const rowY = startY + 40 + (index * lineHeight);
                const isHighlighted = rank === highlightRank;
                
                const scoreRow = this.createScoreRow(
                    panelX,
                    rowY,
                    rank,
                    score.initials,
                    score.score,
                    score.date,
                    isHighlighted
                );
                
                if (fadeIn) {
                    // Stagger the appearance of each row
                    const delay = 100 + (index * 100);
                    scoreRow.alpha = 0;
                    
                    this.scene.tweens.add({
                        targets: scoreRow,
                        alpha: 1,
                        duration: 400,
                        ease: 'Power2',
                        delay: delay
                    });
                    
                    // Add special effects for highlighted row
                    if (isHighlighted) {
                        this.scene.tweens.add({
                            targets: scoreRow,
                            scaleX: 1.05,
                            scaleY: 1.05,
                            yoyo: true,
                            repeat: 2,
                            duration: 200,
                            delay: delay + 400
                        });
                        
                        // Add particles around highlighted row
                        this.scene.time.delayedCall(delay + 200, () => {
                            this.addHighlightParticles(rowY);
                        });
                    }
                }
                
                this.displayGroup.add(scoreRow);
            });
        }
        
        // Create a big, obvious CONTINUE button with a 3D effect
        const buttonWidth = 250;
        const buttonHeight = 60;
        
        // Create button background (3D effect with layers)
        const buttonShadow = this.scene.add.rectangle(
            this.gameWidth / 2 + 4,
            panelY + panelHeight - 40 + 4,
            buttonWidth,
            buttonHeight,
            0x003300
        ).setOrigin(0.5).setAlpha(0.7);
        
        const buttonBg = this.scene.add.rectangle(
            this.gameWidth / 2,
            panelY + panelHeight - 40,
            buttonWidth,
            buttonHeight,
            0x00aa00
        ).setOrigin(0.5);
        
        buttonBg.setStrokeStyle(3, 0x00ff00);
        
        // Create button text
        const closeButton = this.scene.add.text(
            this.gameWidth / 2,
            panelY + panelHeight - 40,
            'CONTINUE TO MENU',
            {
                fontSize: '26px',
                fontStyle: 'bold',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                shadow: { color: '#000000', blur: 2, offsetX: 1, offsetY: 1 }
            }
        ).setOrigin(0.5);
        
        // Combine into a container 
        const buttonContainer = this.scene.add.container(0, 0, [buttonShadow, buttonBg, closeButton]);
        
        // IMPORTANT: Create a separate, larger click zone for better click detection
        const clickZone = this.scene.add.rectangle(
            this.gameWidth / 2,
            panelY + panelHeight - 40,
            buttonWidth + 20, // Make click area a bit larger
            buttonHeight + 20,
            0x00ff00,
            0.0  // Fully transparent - just for clicking
        ).setInteractive();
        
        // Set very high depth to ensure it's on top
        clickZone.setDepth(9999);
        
        // Add the click zone to the display group
        this.displayGroup.add(clickZone);
        
        // Add hover/click effects through the click zone
        clickZone.on('pointerover', () => {
            buttonBg.setFillStyle(0x00cc00);
            closeButton.setColor('#ffffff');
        });
        
        clickZone.on('pointerout', () => {
            buttonBg.setFillStyle(0x00aa00);
            closeButton.setColor('#ffffff');
        });
        
        clickZone.on('pointerdown', () => {
            buttonBg.setFillStyle(0x008800);
            closeButton.setY(closeButton.y + 2); // Press down effect
            buttonShadow.setVisible(false);
        });
        
        // Separate click handler for absolute reliability
        clickZone.on('pointerup', () => {
            this.handleMenuTransition(closeButton);
        });
        
        // Also add a keyboard shortcut - press any key to return to menu
        const menuKeyListener = (event) => {
            this.handleMenuTransition(closeButton);
            // Remove the event listener to prevent multiple calls
            window.removeEventListener('keydown', menuKeyListener);
        };
        
        // Add the keydown listener
        window.addEventListener('keydown', menuKeyListener);
        
        // Store the listener reference for cleanup
        this.menuKeyListener = menuKeyListener;
        
        // Add a method to handle the menu transition
        this.handleMenuTransition = (textButton) => {
            // Only proceed if we're visible
            if (!this.visible) return;

            // Change text to indicate process is happening
            if (textButton) {
                textButton.setText('RETURNING TO MENU...');
            }

            // Disable any interactive objects
            if (clickZone.input) {
                clickZone.disableInteractive();
            }

            // SUPER EMERGENCY DIRECT TRANSITION - Skip everything
            this.scene.scene.start('MenuScene', { restart: true });

            // Also call hide() in case the direct transition fails
            this.scene.time.delayedCall(100, () => {
                if (this.visible) {
                    this.hide();
                }
            });
        };
        
        // Add dramatic pulsing effect
        this.scene.tweens.add({
            targets: [buttonBg, buttonShadow],
            scaleX: 1.05,
            scaleY: 1.05,
            yoyo: true,
            repeat: -1,
            duration: 600,
            ease: 'Sine.easeInOut'
        });
        
        // Add the button container to the display group so it's visible
        this.displayGroup.add(buttonContainer);
        
        // Initially hide everything if we're fading in
        if (fadeIn) {
            background.alpha = 0;
            titleText.alpha = 0;
            buttonContainer.alpha = 0; // Hide the entire button container
            
            // Fade in background with FULL opacity for better visibility
            this.scene.tweens.add({
                targets: background,
                alpha: 0.95,  // Even higher opacity for better visibility
                duration: 600,
                ease: 'Power2'
            });
            
            // Fade in title separately with full opacity
            this.scene.tweens.add({
                targets: titleText,
                alpha: 1,
                duration: 600,
                ease: 'Power2'
            });
            
            // Fade in button container after a delay, ensuring the entire button appears
            this.scene.tweens.add({
                targets: buttonContainer,
                alpha: 1,  // FULL opacity for the button
                duration: 600,
                delay: 800,
                ease: 'Power2'
            });
        } else {
            // Ensure full opacity if not fading in
            background.alpha = 0.95;
            titleText.alpha = 1;
            buttonContainer.alpha = 1; // Make sure container is fully visible
        }
    }
    
    /**
     * Create a single score row
     */
    createScoreRow(baseX, y, rank, initials, score, date, isHighlighted) {
        const container = this.scene.add.container(0, 0);
        const textColor = isHighlighted ? '#00ff00' : '#ffffff';
        const fontSize = isHighlighted ? '26px' : '24px';
        const glow = isHighlighted ? 8 : 2; // Add glow to all rows, stronger for highlighted
        // Define row height here since it's missing
        const rowHeight = 50; // Match the lineHeight used in show()
        
        // Rank text with medal emoji for top 3
        let rankPrefix = '';
        if (rank === 1) rankPrefix = '🥇 ';
        else if (rank === 2) rankPrefix = '🥈 ';
        else if (rank === 3) rankPrefix = '🥉 ';
        
        const rankText = this.scene.add.text(
            baseX + 60,
            y,
            `${rankPrefix}${rank}`,
            { 
                fontSize, 
                color: textColor,
                fontStyle: isHighlighted ? 'bold' : 'normal',
                stroke: '#000000',  // Add stroke to all text
                strokeThickness: isHighlighted ? 2 : 1
            }
        ).setOrigin(0.5, 0.5);
        
        // Add glow effect for highlighted row
        if (isHighlighted) {
            rankText.setShadow(0, 0, '#00ff00', glow);
        }
        
        // Initials 
        const initialsText = this.scene.add.text(
            baseX + 150,
            y,
            initials,
            { 
                fontSize, 
                color: textColor,
                fontStyle: isHighlighted ? 'bold' : 'normal',
                stroke: '#000000',  // Add stroke to all text
                strokeThickness: isHighlighted ? 2 : 1 
            }
        ).setOrigin(0.5, 0.5);
        
        if (isHighlighted) {
            initialsText.setShadow(0, 0, '#00ff00', glow);
        }
        
        // Score with formatting
        const formattedScore = score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const scoreText = this.scene.add.text(
            baseX + 280,
            y,
            formattedScore,
            { 
                fontSize, 
                color: textColor,
                fontStyle: isHighlighted ? 'bold' : 'normal',
                stroke: '#000000',  // Add stroke to all text
                strokeThickness: isHighlighted ? 2 : 1 
            }
        ).setOrigin(0.5, 0.5);
        
        if (isHighlighted) {
            scoreText.setShadow(0, 0, '#00ff00', glow);
        }
        
        // Date
        let displayDate = date || '';
        if (displayDate.length > 10) {
            displayDate = displayDate.substring(0, 10);
        }
        
        const dateText = this.scene.add.text(
            baseX + 410,
            y,
            displayDate,
            { 
                fontSize: isHighlighted ? '22px' : '20px', 
                color: isHighlighted ? '#aaffaa' : '#cccccc'  // Brighter color for non-highlighted
            }
        ).setOrigin(0.5, 0.5);
        
        container.add([rankText, initialsText, scoreText, dateText]);
        
        // Add row background for highlighted row
        if (isHighlighted) {
            const rowBg = this.scene.add.rectangle(
                baseX + 250,
                y,
                550,
                rowHeight - 6, // Use rowHeight instead of lineHeight
                0x003300,
                0.4
            ).setStrokeStyle(1, 0x00ff00, 0.5);
            
            container.add(rowBg);
            // Ensure background is at the back
            container.sendToBack(rowBg);
        }
        
        return container;
    }

    /**
     * Create particle effects around the title
     */
    setupParticles(titleText) {
        // Create particle manager if it doesn't exist
        if (!this.particles) {
            // Create a particle texture at runtime instead of loading from file
            const particleTexture = this.createParticleTexture();
            this.particles = this.scene.add.particles(particleTexture);
        }
        
        // Create emitter for title glow with more particles
        const titleEmitter = this.particles.createEmitter({
            x: titleText.x,
            y: titleText.y,
            lifespan: 2000,
            speed: { min: 20, max: 40 },
            scale: { start: 0.3, end: 0 },  // Larger particles
            alpha: { start: 0.6, end: 0 },  // More visible
            blendMode: 'ADD',
            tint: 0x00ffff,  // Brighter color
            frequency: 50,   // More frequent emission
            emitZone: {
                type: 'edge',
                source: new Phaser.Geom.Rectangle(-titleText.width/2, -titleText.height/2, titleText.width, titleText.height),
                quantity: 24
            }
        });
        
        this.emitters.push(titleEmitter);
    }

    /**
     * Add highlight particles around a row
     */
    addHighlightParticles(rowY) {
        if (!this.particles) {
            // Create a particle texture at runtime instead of loading from file
            const particleTexture = this.createParticleTexture();
            this.particles = this.scene.add.particles(particleTexture);
        }
        
        const panelWidth = this.gameWidth * 0.6;
        const panelX = this.gameWidth / 2 - panelWidth / 2;
        
        // Create emitter for highlighted row
        const highlightEmitter = this.particles.createEmitter({
            x: { min: panelX + 50, max: panelX + panelWidth - 50 },
            y: rowY,
            lifespan: 1500,
            speed: { min: 20, max: 40 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 0.4, end: 0 },
            blendMode: 'ADD',
            tint: 0x00ff00,
            quantity: 1,
            frequency: 50
        });
        
        this.emitters.push(highlightEmitter);
        
        // Stop emitter after 2 seconds
        this.scene.time.delayedCall(2000, () => {
            highlightEmitter.stop();
        });
    }

    /**
     * Hide the high score display with a melting animation
     */
    hide() {
        if (!this.visible) return;
        
        
        // Mark as invisible immediately to prevent duplicate hide calls
        this.visible = false;
        
        // Create melting effect by using multiple particle emitters
        this.createMeltEffect();
        
        // Set a backup timer to ensure callback is called even if tween fails
        const backupTimer = setTimeout(() => {
            this.clear();
            if (this.onHidden) {
                this.onHidden();
            }
        }, 1500); // 1.5 seconds - slightly longer than tween duration
        
        // Fade out all elements
        this.scene.tweens.add({
            targets: this.displayGroup.getChildren(),
            alpha: 0,
            duration: 800,
            onComplete: () => {
                // Cancel the backup timer since tween completed successfully
                clearTimeout(backupTimer);
                this.clear();
                
                // Notify scene that display is hidden
                
                if (this.onHidden) {
                    this.onHidden();
                } else {
                    console.warn("⚠️ No onHidden callback registered");
                    // ALWAYS force scene transition as a last resort - don't depend on isGameOver flag
                    this.scene.scene.start('MenuScene', { restart: true });
                }
            }
        });
    }
    
    /**
     * Create melting effect for disappearing
     */
    createMeltEffect() {
        if (!this.particles) {
            // Create a particle texture at runtime instead of loading from file
            const particleTexture = this.createParticleTexture();
            this.particles = this.scene.add.particles(particleTexture);
        }
        
        const panelWidth = this.gameWidth * 0.6;
        const panelHeight = this.gameHeight * 0.7;
        const panelX = this.gameWidth / 2 - panelWidth / 2;
        const panelY = this.gameHeight / 2 - panelHeight / 2;
        
        // Create 3 emitters with different colors and directions to create melting effect
        const colors = [0x00bfff, 0x44ccff, 0x0099cc];
        
        for (let i = 0; i < 3; i++) {
            const meltEmitter = this.particles.createEmitter({
                x: { min: panelX, max: panelX + panelWidth },
                y: { min: panelY, max: panelY + panelHeight },
                speedY: { min: 50, max: 150 },
                speedX: { min: -20, max: 20 },
                lifespan: 1500,
                scale: { start: 0.3, end: 0 },
                alpha: { start: 0.6, end: 0 },
                blendMode: 'ADD',
                tint: colors[i],
                quantity: 4,
                frequency: 10
            });
            
            this.emitters.push(meltEmitter);
            
            // Stop emitter after 800ms
            this.scene.time.delayedCall(800, () => {
                meltEmitter.stop();
            });
        }
    }

    /**
     * Clear the display
     */
    clear() {
        // Remove keyboard event listener if it exists
        if (this.menuKeyListener) {
            window.removeEventListener('keydown', this.menuKeyListener);
            this.menuKeyListener = null;
        }
        
        // Stop all particle emitters
        if (this.emitters.length > 0) {
            this.emitters.forEach(emitter => {
                if (emitter && typeof emitter.stop === 'function') {
                    emitter.stop();
                }
            });
            this.emitters = [];
        }
        
        // Destroy particle manager
        if (this.particles) {
            this.particles.destroy();
            this.particles = null;
        }
        
        // Clear display group
        if (this.displayGroup) {
            this.displayGroup.clear(true, true);
        }
    }
    
    /**
     * Force immediate cleanup of all resources - no animations or delays
     */
    forceCleanup() {
        
        try {
            // Clear the visible flag immediately
            this.visible = false;
            
            // Remove keyboard event listener if it exists
            if (this.menuKeyListener) {
                window.removeEventListener('keydown', this.menuKeyListener);
                this.menuKeyListener = null;
            }
            
            // Kill all particle effects immediately
            if (this.particles) {
                this.particles.destroy();
                this.particles = null;
            }
            
            // Clear all emitters
            this.emitters = [];
            
            // Force-destroy all display elements
            if (this.displayGroup) {
                this.displayGroup.clear(true, true);
            }
            
            // Remove callback reference to prevent memory leaks
            this.onHidden = null;
            
        } catch (error) {
            console.error("Error during force cleanup:", error);
        }
    }

    /**
     * Set a callback for when display is hidden
     */
    setHiddenCallback(callback) {
        this.onHidden = callback;
    }
    
    /**
     * Create a particle texture at runtime
     */
    createParticleTexture() {
        const size = 16;
        const textureKey = 'particle-highscore';
        
        // Check if the texture already exists
        if (this.scene.textures.exists(textureKey)) {
            return this.scene.textures.get(textureKey);
        }
        
        // Create a canvas to draw the particle
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        
        // Create a radial gradient
        const gradient = ctx.createRadialGradient(
            size/2, size/2, 0,
            size/2, size/2, size/2
        );
        
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.5, 'rgba(200, 200, 200, 0.7)');
        gradient.addColorStop(1, 'rgba(128, 128, 128, 0)');
        
        // Draw the particle
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Add the texture to the game
        this.scene.textures.addCanvas(textureKey, canvas);
        
        return this.scene.textures.get(textureKey);
    }
}
