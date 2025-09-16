// UIManager.js - Handles game UI elements including HUD, health bars, etc.

export default class UIManager {
    constructor(scene) {
        this.scene = scene;
        
        // Debug mode flag - starts hidden
        this.debugMode = false;
        
        // Initialize UI elements
        this.createUI();
        
        // Create debug text (initially hidden)
        this.createDebugUI();
        
        // Setup debug toggle key
        this.setupDebugToggle();
    }
    
    createUI() {
        // Get game dimensions for responsive positioning
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Create a container for all UI elements
        this.uiContainer = this.scene.add.container(0, 0);
        
        // Create score text in top left with retro font
        this.scoreText = this.scene.add.text(50, 20, 'Score: 0', { 
            fontSize: '24px', 
            fontFamily: 'Courier, monospace', // Retro-style courier font
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0);
        
        // Create orbs at the bottom left
        const orbRadius = 30; // Larger orbs
        const orbSpacing = 80; // Increased spacing between orbs
        const margin = 45; // Margin from edge
        const orbY = gameHeight - margin; // Position from bottom
        const orbStartX = margin; // Start from left
        
        // Define orb colors with more vibrant hues
        const healthColor = 0x00ff44; // Bright green (always green now)
        const energyColor = 0x0066ff; // Rich blue (distinct from cyan Grub Terminator)
        const gunPowerColor = 0xff6600; // Bright orange
        const grubTerminatorColor = 0x00ffff; // Cyan (matching Grub Terminator)
        
        // Get initial values
        const initialHealth = this.scene.playerHealth || 100;
        const initialEnergy = this.scene.playerEnergy || 25;
        const initialGunPower = this.scene.playerGunPowerLevel || 1;
        
        // Create background orbs (full black circles with glow)
        this.healthOrbBg = this.scene.add.circle(orbStartX, orbY, orbRadius, 0x000000);
        this.energyOrbBg = this.scene.add.circle(orbStartX + orbSpacing, orbY, orbRadius, 0x000000);
        this.gunPowerOrbBg = this.scene.add.circle(orbStartX + (orbSpacing * 2), orbY, orbRadius, 0x000000);
        this.grubTerminatorOrbBg = this.scene.add.circle(orbStartX + (orbSpacing * 3), orbY, orbRadius, 0x333333); // Dark gray for hidden state
        
        // Add outer rings with shine
        this.healthOrbRing = this.scene.add.circle(orbStartX, orbY, orbRadius + 3, 0x333333);
        this.energyOrbRing = this.scene.add.circle(orbStartX + orbSpacing, orbY, orbRadius + 3, 0x333333);
        this.gunPowerOrbRing = this.scene.add.circle(orbStartX + (orbSpacing * 2), orbY, orbRadius + 3, 0x333333);
        this.grubTerminatorOrbRing = this.scene.add.circle(orbStartX + (orbSpacing * 3), orbY, orbRadius + 3, 0x333333);
        
        // Add shadows and depth effects
        this.healthOrbShadow = this.scene.add.circle(orbStartX + 2, orbY + 2, orbRadius, 0x000000, 0.3).setDepth(-2);
        this.energyOrbShadow = this.scene.add.circle(orbStartX + orbSpacing + 2, orbY + 2, orbRadius, 0x000000, 0.3).setDepth(-2);
        this.gunPowerOrbShadow = this.scene.add.circle(orbStartX + (orbSpacing * 2) + 2, orbY + 2, orbRadius, 0x000000, 0.3).setDepth(-2);
        this.grubTerminatorOrbShadow = this.scene.add.circle(orbStartX + (orbSpacing * 3) + 2, orbY + 2, orbRadius, 0x000000, 0.3).setDepth(-2);
        
        // Set rings to be behind the fills but in front of the shadows
        this.healthOrbRing.setDepth(-1);
        this.energyOrbRing.setDepth(-1);
        this.gunPowerOrbRing.setDepth(-1);
        this.grubTerminatorOrbRing.setDepth(-1);
        
        // Add to container
        this.uiContainer.add([
            this.healthOrbShadow, this.energyOrbShadow, this.gunPowerOrbShadow, this.grubTerminatorOrbShadow,
            this.healthOrbRing, this.energyOrbRing, this.gunPowerOrbRing, this.grubTerminatorOrbRing,
            this.healthOrbBg, this.energyOrbBg, this.gunPowerOrbBg, this.grubTerminatorOrbBg
        ]);
        
        // Create filled orbs (these will be updated with the fill percentage)
        this.healthOrb = this.scene.add.circle(orbStartX, orbY, orbRadius * (initialHealth / 100), healthColor);
        this.energyOrb = this.scene.add.circle(orbStartX + orbSpacing, orbY, orbRadius * (initialEnergy / 100), energyColor);
        this.gunPowerOrb = this.scene.add.circle(orbStartX + (orbSpacing * 2), orbY, orbRadius * (initialGunPower / 3), gunPowerColor);
        
        // Grub Terminator orb starts full (companion is initially active)
        this.grubTerminatorOrb = this.scene.add.circle(orbStartX + (orbSpacing * 3), orbY, orbRadius, grubTerminatorColor);
        
        // Add to container
        this.uiContainer.add([this.healthOrb, this.energyOrb, this.gunPowerOrb, this.grubTerminatorOrb]);
        
        // Add glow effects for WebGL mode
        if (this.scene.renderer.type === Phaser.WEBGL) {
            try {
                if (this.healthOrb.preFX) {
                    this.healthOrb.preFX.addGlow(healthColor, 8, 0, false);
                }
                if (this.energyOrb.preFX) {
                    this.energyOrb.preFX.addGlow(energyColor, 8, 0, false);
                }
                if (this.gunPowerOrb.preFX) {
                    this.gunPowerOrb.preFX.addGlow(gunPowerColor, 8, 0, false);
                }
                if (this.grubTerminatorOrb.preFX) {
                    this.grubTerminatorOrb.preFX.addGlow(grubTerminatorColor, 8, 0, false);
                }
            } catch (error) {
                console.warn("Error applying glow to orbs:", error);
            }
        }
        
        // Create pulsing animations for the rings
        this.scene.tweens.add({
            targets: [this.healthOrbRing],
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.scene.tweens.add({
            targets: [this.energyOrbRing],
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 1300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 300 // Offset timing for variety
        });
        
        this.scene.tweens.add({
            targets: [this.gunPowerOrbRing],
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 1700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 600 // Offset timing for variety
        });
        
        this.scene.tweens.add({
            targets: [this.grubTerminatorOrbRing],
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 1900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 900 // Offset timing for variety
        });
    }
    
    
    createDebugUI() {
        // Get game dimensions for responsive positioning
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Create debug text
        this.beatText = this.scene.add.text(20, 50, 'BPM: -', { fontSize: '16px', color: '#ffffff' });
        this.segmentText = this.scene.add.text(20, 80, 'Segment: -', { fontSize: '16px', color: '#ffffff' });
        
        // Add more debug text for timing
        this.timeText = this.scene.add.text(20, 110, 'Time: 0.00s | Next Beat: -', { 
            fontSize: '16px', 
            color: '#ffffff' 
        });
        
        // Add debug text for audio data
        this.dataText = this.scene.add.text(20, 140, 'Audio Data: Loading...', { 
            fontSize: '16px', 
            color: '#ffffff' 
        });
        
        // Add new debug text for volume levels and enemy size calculations - with larger font and better colors
        this.volumeText = this.scene.add.text(20, 170, 'Volume: -', { 
            fontSize: '20px', 
            color: '#00ffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        
        this.bpmFactorText = this.scene.add.text(20, 200, 'BPM Factor: -', { 
            fontSize: '20px', 
            color: '#00ffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        
        this.enemySizeText = this.scene.add.text(20, 230, 'Enemy Size Factors: -', { 
            fontSize: '20px', 
            color: '#00ffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        
        this.recentEnemiesText = this.scene.add.text(20, 260, 'Recent Enemies: -', { 
            fontSize: '20px', 
            color: '#00ffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        
        // Add a background rectangle to make debug info more readable
        this.debugBackground = this.scene.add.rectangle(150, 200, 300, 200, 0x000000, 0.7);
        
        // Test Mode Toggle Button (only visible in debug mode) - made more prominent
        this.testModeButton = this.scene.add.text(20, 290, '[ TOGGLE TEST MODE: OFF ]', {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffff00',
            backgroundColor: '#333333',
            stroke: '#000000',
            strokeThickness: 2,
            padding: { x: 10, y: 5 }
        }).setInteractive();
        
        // Size comparison button - add a button to spawn test enemies with min and max sizes
        this.sizeCompareButton = this.scene.add.text(20, 330, '[ SPAWN SIZE COMPARISON ]', {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffff00',
            backgroundColor: '#333333',
            stroke: '#000000',
            strokeThickness: 2,
            padding: { x: 10, y: 5 }
        }).setInteractive();
        
        // Add button functionality
        this.testModeButton.on('pointerdown', () => {
            this.toggleTestMode();
        });
        
        this.sizeCompareButton.on('pointerdown', () => {
            this.spawnSizeComparison();
        });
        
        // Test mode flag
        this.testMode = false;
        this.testModeTimer = null;
        this.testModeDirection = 1; // 1 = increasing, -1 = decreasing
        this.extremeTestMode = true; // Use more extreme values in test mode
        
        // Add MAJOR indicator that our code changes are working
        this.majorUpdateNotice = this.scene.add.text(20, 370, '⚠️ NEW VERSION LOADED ⚠️', {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ff0000',
            backgroundColor: '#ffff00',
            stroke: '#000000',
            strokeThickness: 4,
            padding: { x: 10, y: 5 }
        });
        
        // Pulsing effect on the notice
        this.scene.tweens.add({
            targets: this.majorUpdateNotice,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // Create a container for all debug text
        this.debugContainer = this.scene.add.container(0, 0);
        this.debugContainer.add([
            this.debugBackground,
            this.beatText, 
            this.segmentText, 
            this.timeText, 
            this.dataText,
            this.volumeText,
            this.bpmFactorText,
            this.enemySizeText,
            this.recentEnemiesText,
            this.testModeButton,
            this.sizeCompareButton,
            this.majorUpdateNotice
        ]);
        
        // Initially hide debug info
        this.debugContainer.setVisible(false);
        
        // Add debug mode indicator (only visible when debug mode is active)
        this.debugIndicator = this.scene.add.text(20, 320, 'DEBUG MODE (Press C to toggle)', {
            fontSize: '16px',
            color: '#ffff00',
            backgroundColor: '#333333',
            padding: { x: 5, y: 2 }
        });
        this.debugIndicator.setVisible(false);
        
        // Keep track of recent enemy sizes for debugging
        this.recentEnemySizes = [];
        
        // Create a visual size indicator
        this.sizeIndicator = this.scene.add.graphics();
        this.sizeIndicator.setDepth(100);
        this.debugContainer.add(this.sizeIndicator);
        
        // Create volume history visualization
        this.volumeHistory = [];
        this.volumeHistorySize = 30; // Number of samples to display
        this.volumeGraph = this.scene.add.graphics();
        this.volumeGraph.setDepth(100);
        this.debugContainer.add(this.volumeGraph);
    }
    
    toggleTestMode() {
        this.testMode = !this.testMode;
        
        if (this.testMode) {
            // Start the test mode timer
            this.testModeTimer = this.scene.time.addEvent({
                delay: 100, // 100ms updates for smooth oscillation
                callback: this.updateTestMode,
                callbackScope: this,
                loop: true
            });
            
            this.testModeButton.setText('[ TOGGLE TEST MODE: ON ]');
            this.testModeButton.setBackgroundColor('#660000');
            
            // Show a visual notification that test mode is active
            const notification = this.scene.add.text(
                this.scene.gameWidth / 2, 
                this.scene.gameHeight / 2, 
                'TEST MODE ACTIVE\nVolume will oscillate automatically\nEnemies should change size dramatically', 
                {
                    fontSize: '24px',
                    fontStyle: 'bold',
                    align: 'center',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 4,
                    backgroundColor: '#660000',
                    padding: { x: 20, y: 10 }
                }
            ).setOrigin(0.5);
            
            // Fade out after a few seconds
            this.scene.tweens.add({
                targets: notification,
                alpha: 0,
                y: notification.y - 50,
                duration: 3000,
                onComplete: () => {
                    notification.destroy();
                }
            });
        } else {
            // Stop the test mode timer
            if (this.testModeTimer) {
                this.testModeTimer.remove();
                this.testModeTimer = null;
            }
            
            // Reset volume to normal
            if (this.scene.audioAnalyzer) {
                this.scene.audioAnalyzer.currentVolume = 0.5;
            }
            
            this.testModeButton.setText('[ TOGGLE TEST MODE: OFF ]');
            this.testModeButton.setBackgroundColor('#333333');
        }
    }
    
    spawnSizeComparison() {
        // Check if enemyManager exists
        if (!this.scene.enemyManager || typeof this.scene.enemyManager.spawnEnemy !== 'function') {
            console.error("Enemy manager not found for size comparison");
            return;
        }
        
        // Get game dimensions
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight / 2; // Middle of screen
        
        // Force minimum volume for small enemy
        const originalVolume = this.scene.audioAnalyzer ? this.scene.audioAnalyzer.currentVolume : 0.5;
        if (this.scene.audioAnalyzer) {
            this.scene.audioAnalyzer.currentVolume = 0.1;
        }
        
        // Spawn a small enemy (low strength and volume)
        const smallEnemy = this.scene.enemyManager.spawnEnemy(0.2, 'C');
        if (smallEnemy) {
            // Position at center left
            smallEnemy.x = gameWidth - 200;
            smallEnemy.y = gameHeight - 100;
            
            // Add a label
            const smallLabel = this.scene.add.text(
                smallEnemy.x, 
                smallEnemy.y - smallEnemy.height, 
                'MIN SIZE', 
                {
                    fontSize: '16px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            ).setOrigin(0.5);
            
            // Destroy label when enemy destroys
            smallEnemy.on('destroy', () => {
                smallLabel.destroy();
            });
            
            // Stop enemy from moving
            smallEnemy.setVelocity(0, 0);
        }
        
        // Force maximum volume for large enemy
        if (this.scene.audioAnalyzer) {
            this.scene.audioAnalyzer.currentVolume = 1.0;
        }
        
        // Spawn a large enemy (high strength and volume)
        const largeEnemy = this.scene.enemyManager.spawnEnemy(0.8, 'C');
        if (largeEnemy) {
            // Position at center right
            largeEnemy.x = gameWidth - 200;
            largeEnemy.y = gameHeight + 100;
            
            // Add a label
            const largeLabel = this.scene.add.text(
                largeEnemy.x, 
                largeEnemy.y - largeEnemy.height, 
                'MAX SIZE', 
                {
                    fontSize: '16px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            ).setOrigin(0.5);
            
            // Destroy label when enemy destroys
            largeEnemy.on('destroy', () => {
                largeLabel.destroy();
            });
            
            // Stop enemy from moving
            largeEnemy.setVelocity(0, 0);
        }
        
        // Restore original volume
        if (this.scene.audioAnalyzer) {
            this.scene.audioAnalyzer.currentVolume = originalVolume;
        }
        
        // Show notification
        const notification = this.scene.add.text(
            this.scene.gameWidth / 2, 
            this.scene.gameHeight / 2, 
            'SIZE COMPARISON SPAWNED\nCompare the minimum and maximum enemy sizes', 
            {
                fontSize: '24px',
                fontStyle: 'bold',
                align: 'center',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                backgroundColor: '#003366',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5);
        
        // Fade out after a few seconds
        this.scene.tweens.add({
            targets: notification,
            alpha: 0,
            y: notification.y - 50,
            duration: 2000,
            onComplete: () => {
                notification.destroy();
            }
        });
    }
    
    updateTestMode() {
        // Only proceed if audioAnalyzer exists
        if (!this.scene.audioAnalyzer) return;
        
        // Get current volume
        let volume = this.scene.audioAnalyzer.currentVolume || 0.5;
        
        if (this.extremeTestMode) {
            // Use more extreme oscillation (slower and with larger range)
            // Change by 0.025 instead of 0.05 for slower oscillation
            volume += 0.025 * this.testModeDirection;
            
            // Use extreme limits (0.05 to 1.0) instead of (0.1 to 1.0)
            if (volume >= 1.0) {
                volume = 1.0;
                this.testModeDirection = -1;
            } else if (volume <= 0.05) {
                volume = 0.05;
                this.testModeDirection = 1;
            }
        } else {
            // Original behavior
            volume += 0.05 * this.testModeDirection;
            
            if (volume >= 1.0) {
                volume = 1.0;
                this.testModeDirection = -1;
            } else if (volume <= 0.1) {
                volume = 0.1;
                this.testModeDirection = 1;
            }
        }
        
        // Set the volume in the audio analyzer
        this.scene.audioAnalyzer.currentVolume = volume;
        
        // Update the volume history
        this.volumeHistory.push(volume);
        if (this.volumeHistory.length > this.volumeHistorySize) {
            this.volumeHistory.shift();
        }
        
        // Update volume graph
        this.updateVolumeGraph();
    }
    
    updateVolumeGraph() {
        if (!this.debugMode || !this.volumeGraph) return;
        
        this.volumeGraph.clear();
        
        // Calculate graph dimensions
        const graphWidth = 200;
        const graphHeight = 60;
        const graphX = 320;
        const graphY = 170;
        
        // Draw background
        this.volumeGraph.fillStyle(0x000000, 0.5);
        this.volumeGraph.fillRect(graphX, graphY, graphWidth, graphHeight);
        
        // Draw border
        this.volumeGraph.lineStyle(1, 0xffffff, 0.8);
        this.volumeGraph.strokeRect(graphX, graphY, graphWidth, graphHeight);
        
        // Draw volume history graph
        if (this.volumeHistory.length > 1) {
            // Calculate x step based on number of samples
            const xStep = graphWidth / (this.volumeHistorySize - 1);
            
            // Draw connecting lines for volume history
            this.volumeGraph.lineStyle(2, 0x00ffff, 1);
            this.volumeGraph.beginPath();
            
            for (let i = 0; i < this.volumeHistory.length; i++) {
                const x = graphX + (i * xStep);
                // Invert the y value (0 at bottom, 1 at top)
                const y = graphY + graphHeight - (this.volumeHistory[i] * graphHeight);
                
                if (i === 0) {
                    this.volumeGraph.moveTo(x, y);
                } else {
                    this.volumeGraph.lineTo(x, y);
                }
            }
            
            this.volumeGraph.strokePath();
        }
        
        // Draw label
        if (!this.volumeGraphLabel) {
            this.volumeGraphLabel = this.scene.add.text(graphX + graphWidth / 2, graphY - 5, 'VOLUME HISTORY', {
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5, 1);
            this.debugContainer.add(this.volumeGraphLabel);
        }
    }
    
    /**
     * Updates the volume debug information
     * @param {number} volume - Current volume level
     * @param {number} bpm - Current BPM
     */
    updateVolumeDebug(volume, bpm) {
        // Only update if debug mode is active
        if (!this.debugMode) return;
        
        // Add to volume history
        this.volumeHistory.push(volume);
        if (this.volumeHistory.length > this.volumeHistorySize) {
            this.volumeHistory.shift();
        }
        
        // Update volume graph
        this.updateVolumeGraph();
        
        // Update volume text with color coding
        if (this.volumeText) {
            // Color code based on volume (green = low, yellow = medium, red = high)
            let color;
            if (volume < 0.3) color = '#00ff00';
            else if (volume < 0.6) color = '#ffff00';
            else color = '#ff0000';
            
            this.volumeText.setText(`Volume: ${volume.toFixed(2)} ${this.testMode ? '(TEST MODE)' : ''}`);
            this.volumeText.setColor(color);
        }
        
        // Update BPM factor text - calculate the same way EnemyManager does
        if (this.bpmFactorText && typeof bpm === 'number') {
            // Calculate BPM factor (same formula from EnemyManager)
            const bpmFactor = 2.5 - (Math.min(Math.max(bpm, 60), 180) / 80);
            
            // Color code based on BPM factor
            let color;
            if (bpmFactor < 1.0) color = '#ff6600'; // Fast tempo (small enemies) - orange
            else if (bpmFactor < 2.0) color = '#ffff00'; // Medium tempo - yellow
            else color = '#00ff00'; // Slow tempo (big enemies) - green
            
            this.bpmFactorText.setText(`BPM: ${bpm.toFixed(0)} | Factor: ${bpmFactor.toFixed(2)}`);
            this.bpmFactorText.setColor(color);
        }
    }
    
    /**
     * Updates the enemy size debug information
     * @param {number} baseSize - Base size before factors
     * @param {number} volumeFactor - Volume multiplier
     * @param {number} bpmFactor - BPM multiplier
     * @param {number} finalSize - Final calculated size
     */
    updateEnemySizeDebug(baseSize, volumeFactor, bpmFactor, finalSize) {
        // Only update if debug mode is active
        if (!this.debugMode) return;
        
        // Update enemy size factors text with color coding
        if (this.enemySizeText) {
            // Color code based on final size
            let sizeColor;
            if (finalSize < 30) sizeColor = '#00ffff'; // Small - cyan
            else if (finalSize < 60) sizeColor = '#ffff00'; // Medium - yellow
            else sizeColor = '#ff6600'; // Large - orange
            
            // Create color-coded text
            this.enemySizeText.setText(
                `Size: ${finalSize}px = ${baseSize.toFixed(1)} × ${volumeFactor.toFixed(2)}vol × ${bpmFactor.toFixed(2)}bpm`
            );
            this.enemySizeText.setColor(sizeColor);
        }
        
        // Add to recent enemy sizes array (keep last 5)
        this.recentEnemySizes.unshift({
            size: finalSize,
            time: Date.now()
        });
        
        // Keep array limited to 5 items
        if (this.recentEnemySizes.length > 5) {
            this.recentEnemySizes.pop();
        }
        
        // Update recent enemies text with more detail
        if (this.recentEnemiesText) {
            // Show sizes with arrows indicating trend
            let sizeText = "";
            for (let i = 0; i < this.recentEnemySizes.length; i++) {
                // Add arrow for trend (except first item)
                if (i > 0) {
                    const diff = this.recentEnemySizes[i-1].size - this.recentEnemySizes[i].size;
                    if (diff > 5) sizeText += " ↑ "; // Increasing size
                    else if (diff < -5) sizeText += " ↓ "; // Decreasing size
                    else sizeText += " = "; // Stable
                }
                
                sizeText += `${this.recentEnemySizes[i].size}`;
            }
                
            this.recentEnemiesText.setText(`Recent Enemies: ${sizeText}`);
        }
        
        // Update the size indicator visualization
        this.updateSizeIndicator(finalSize);
    }
    
    updateSizeIndicator(size) {
        // Clear previous graphics
        this.sizeIndicator.clear();
        
        // Draw size indicator
        const maxSize = 100; // Maximum size reference
        const indicatorX = 480;
        const indicatorY = 250;
        const indicatorWidth = 120;
        const indicatorHeight = 20;
        
        // Draw background bar
        this.sizeIndicator.fillStyle(0x333333, 0.8);
        this.sizeIndicator.fillRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight);
        
        // Draw size bar
        const fillWidth = Math.min(indicatorWidth, (size / maxSize) * indicatorWidth);
        let fillColor = 0x00ffff; // Default cyan
        
        if (size > 60) fillColor = 0xff6600; // Orange for large
        else if (size > 30) fillColor = 0xffff00; // Yellow for medium
        
        this.sizeIndicator.fillStyle(fillColor, 1);
        this.sizeIndicator.fillRect(indicatorX, indicatorY, fillWidth, indicatorHeight);
        
        // Draw size value text
        if (!this.sizeIndicatorText) {
            this.sizeIndicatorText = this.scene.add.text(indicatorX + indicatorWidth / 2, indicatorY - 5, '', {
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5, 1);
            this.debugContainer.add(this.sizeIndicatorText);
        }
        
        this.sizeIndicatorText.setText(`${size}px`);
    }
    
    setupDebugToggle() {
        // Add keyboard listener for debug mode toggle
        this.scene.input.keyboard.on('keydown-C', () => {
            this.debugMode = !this.debugMode;
            this.debugContainer.setVisible(this.debugMode);
            this.debugIndicator.setVisible(this.debugMode);
            
            if (this.debugMode) {
                console.log("Debug mode enabled");
            } else {
                console.log("Debug mode disabled");
            }
        });
    }
    
    updateBeatInfo(bpm, strength) {
        this.beatText.setText(`BPM: ${bpm.toFixed(2)} (${strength.toFixed(2)})`);
        
        // Also update BPM factor in debug display if audioAnalyzer exists
        if (this.debugMode && this.scene.audioAnalyzer) {
            const volume = this.scene.audioAnalyzer.currentVolume || 0.5;
            this.updateVolumeDebug(volume, bpm);
        }
    }
    
    updateTimeInfo(currentTime, nextBeatTime) {
        // Format the time values, handling non-numeric values
        const formattedCurrentTime = typeof currentTime === 'number' ? 
            `${currentTime.toFixed(2)}s` : currentTime;
        
        const formattedNextBeatTime = typeof nextBeatTime === 'number' ? 
            `${nextBeatTime.toFixed(2)}s` : nextBeatTime;
        
        this.timeText.setText(`Time: ${formattedCurrentTime} | Next Beat: ${formattedNextBeatTime}`);
    }
    
    updateDataInfo(beatsCount, currentBeatIndex, segmentsCount) {
        this.dataText.setText(`Beats: ${beatsCount} | Current: ${currentBeatIndex} | Segments: ${segmentsCount}`);
    }
    
    updateSegmentInfo(segmentType) {
        // Get game dimensions for responsive positioning
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Update segment text in debug UI
        this.segmentText.setText(`Segment: ${segmentType}`);
        
        // Show segment change notification (always visible, even in non-debug mode)
        const segmentText = this.scene.add.text(gameWidth / 2, gameHeight / 3, 
            `${segmentType.toUpperCase()}`, 
            { 
                fontSize: '32px',
                fontFamily: 'Courier, monospace', // Use retro font for consistency
                fontStyle: 'bold',
                color: this.getSegmentColor(segmentType),
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5);
        
        // Animate and remove the notification
        this.scene.tweens.add({
            targets: segmentText,
            alpha: 0,
            y: gameHeight / 3 - 20,
            scale: 1.5,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                segmentText.destroy();
            }
        });
    }
    
    showSegmentChange(segmentType, intensity) {
        // Get game dimensions for responsive positioning
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Show segment change notification
        const segmentText = this.scene.add.text(gameWidth / 2, gameHeight / 3, 
            `${segmentType.toUpperCase()}`, 
            { 
                fontSize: '32px',
                fontFamily: 'Courier, monospace', // Use retro font for consistency
                fontStyle: 'bold',
                color: this.getSegmentColor(segmentType),
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5);
        
        // Animate and remove the notification
        this.scene.tweens.add({
            targets: segmentText,
            alpha: 0,
            y: gameHeight / 3 - 20,
            scale: 1.5,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                segmentText.destroy();
            }
        });
        
        // Update the segment text in debug UI
        this.segmentText.setText(`Segment: ${segmentType} (${intensity.toFixed(1)})`);
    }
    
    // Helper function to get color for segment type
    getSegmentColor(segmentType) {
        switch (segmentType) {
            case 'chorus':
                return '#ff00ff'; // Magenta for chorus
            case 'verse':
                return '#00ffff'; // Cyan for verse
            case 'bridge':
                return '#ffff00'; // Yellow for bridge
            case 'outro':
                return '#ff0000'; // Red for outro
            case 'intro':
                return '#00ff00'; // Green for intro
            default:
                return '#ffffff'; // White for unknown
        }
    }
    
    updateScore(newScore) {
        this.scoreText.setText(`Score: ${newScore.toLocaleString()}`);
    }
    
    updateHealthBar() {
        // Safely get health value from player if it exists
        let health = 100;
        if (this.scene.player && typeof this.scene.player.health === 'number') {
            health = this.scene.player.health;
        }
        
        // Make sure health is within bounds
        health = Math.max(0, Math.min(100, health));
        
        // Get the full radius of the background circle
        const fullRadius = this.healthOrbBg.radius;
        
        // Update the orb size based on health percentage
        this.healthOrb.radius = fullRadius * (health / 100);
        
        // Make sure it's visible if it has any value at all
        if (health <= 0) {
            this.healthOrb.visible = false;
        } else {
            this.healthOrb.visible = true;
        }
        
        // Add a ripple effect when health changes significantly
        if (this.lastHealth && Math.abs(this.lastHealth - health) > 5) {
            this.createRippleEffect(this.healthOrb.x, this.healthOrb.y, 0x00ff44);
            
            // Create a quick pulse effect
            this.scene.tweens.add({
                targets: this.healthOrb,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 150,
                yoyo: true,
                ease: 'Sine.easeOut'
            });
        }
        
        // Add pulsing glow effect when health is full
        if (health >= 95 && !this.healthOrbGlowing) {
            this.healthOrbGlowing = true;
            this.addPulsingGlowEffect(this.healthOrb, 0x00ff44);
        } else if (health < 95 && this.healthOrbGlowing) {
            this.healthOrbGlowing = false;
            if (this.healthOrbGlowTween) {
                this.healthOrbGlowTween.remove();
                this.healthOrbGlowTween = null;
            }
        }
        
        // Store current health for next comparison
        this.lastHealth = health;
    }
    
    updateEnergyBar() {
        // Safely get energy value from player if it exists
        let energy = 25;
        if (this.scene.player && typeof this.scene.player.energy === 'number') {
            energy = this.scene.player.energy;
        }
        
        // Make sure energy is within bounds
        energy = Math.max(0, Math.min(100, energy));
        
        // Get the full radius of the background circle
        const fullRadius = this.energyOrbBg.radius;
        
        // Update the orb size based on energy percentage
        this.energyOrb.radius = fullRadius * (energy / 100);
        
        // Make sure it's visible if it has any value at all
        if (energy <= 0) {
            this.energyOrb.visible = false;
        } else {
            this.energyOrb.visible = true;
        }
        
        // Add a ripple effect when energy changes significantly
        if (this.lastEnergy && Math.abs(this.lastEnergy - energy) > 5) {
            this.createRippleEffect(this.energyOrb.x, this.energyOrb.y, 0x0066ff);
            
            // Create a quick pulse effect
            this.scene.tweens.add({
                targets: this.energyOrb,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 150,
                yoyo: true,
                ease: 'Sine.easeOut'
            });
        }
        
        // Add pulsing glow effect when energy is full
        if (energy >= 95 && !this.energyOrbGlowing) {
            this.energyOrbGlowing = true;
            this.addPulsingGlowEffect(this.energyOrb, 0x0066ff);
        } else if (energy < 95 && this.energyOrbGlowing) {
            this.energyOrbGlowing = false;
            if (this.energyOrbGlowTween) {
                this.energyOrbGlowTween.remove();
                this.energyOrbGlowTween = null;
            }
        }
        
        // Store current energy for next comparison
        this.lastEnergy = energy;
    }
    
    updateGunPowerIndicators() {
        // Safely get gun power level from player if it exists
        let gunPowerLevel = 1;
        if (this.scene.player && typeof this.scene.player.gunPowerLevel === 'number') {
            gunPowerLevel = this.scene.player.gunPowerLevel;
        }
        
        // Make sure gun power level is within bounds (1-3)
        gunPowerLevel = Math.max(1, Math.min(3, gunPowerLevel));
        
        // Get the full radius of the background circle
        const fullRadius = this.gunPowerOrbBg.radius;
        
        // Update the orb size based on gun power percentage (1/3, 2/3, or 3/3)
        this.gunPowerOrb.radius = fullRadius * (gunPowerLevel / 3);
        
        // Make sure it's visible if it has any value at all
        if (gunPowerLevel <= 0) {
            this.gunPowerOrb.visible = false;
        } else {
            this.gunPowerOrb.visible = true;
        }
        
        // Add a dramatic flash effect and ripple when gun power level changes
        if (this.lastGunPower && this.lastGunPower !== gunPowerLevel) {
            // Create ripple effect
            this.createRippleEffect(this.gunPowerOrb.x, this.gunPowerOrb.y, 0xff6600, 2);
            
            // Create a dramatic pulse effect
            this.scene.tweens.add({
                targets: this.gunPowerOrb,
                scaleX: 1.5,
                scaleY: 1.5,
                duration: 300,
                yoyo: true,
                ease: 'Back.easeOut'
            });
        }
        
        // Add pulsing glow effect when gun power is at max level
        if (gunPowerLevel >= 3 && !this.gunPowerOrbGlowing) {
            this.gunPowerOrbGlowing = true;
            this.addPulsingGlowEffect(this.gunPowerOrb, 0xff6600);
        } else if (gunPowerLevel < 3 && this.gunPowerOrbGlowing) {
            this.gunPowerOrbGlowing = false;
            if (this.gunPowerOrbGlowTween) {
                this.gunPowerOrbGlowTween.remove();
                this.gunPowerOrbGlowTween = null;
            }
        }
        
        // Store current gun power for next comparison
        this.lastGunPower = gunPowerLevel;
    }
    
    /**
     * Adds a pulsing glow effect to an orb when it's at full value
     * @param {Phaser.GameObjects.GameObject} orb - The orb to add the effect to
     * @param {number} color - The color of the glow
     */
    addPulsingGlowEffect(orb, color) {
        // Create a glowing ring around the orb
        const glowRing = this.scene.add.circle(orb.x, orb.y, orb.radius + 5, color, 0.4);
        glowRing.setDepth(orb.depth - 1); // Behind the orb
        
        // Add it to the UI container
        this.uiContainer.add(glowRing);
        
        // Create pulsing animation
        this.glowTween = this.scene.tweens.add({
            targets: glowRing,
            radius: orb.radius + 15, // Expand a bit more
            alpha: 0.2, // Fade as it expands
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Store reference to the glow ring and tween for later cleanup
        orb.glowRing = glowRing;
        orb.glowTween = this.glowTween;
    }
    
    updateGrubTerminatorOrb() {
        if (!this.scene.grubTerminator) return;
        
        if (this.scene.grubTerminator.isHidden) {
            // Calculate fill percentage based on timer
            const totalHideTime = 5000; // 5 seconds
            const remainingTime = this.scene.grubTerminator.hiddenTimer;
            const fillPercentage = Math.max(0, (totalHideTime - remainingTime) / totalHideTime);
            
            // Update orb radius based on fill percentage
            const newRadius = 30 * fillPercentage;
            this.grubTerminatorOrb.setRadius(newRadius);
            
            // Set background to dark gray when hidden
            this.grubTerminatorOrbBg.setFillStyle(0x333333);
        } else {
            // Companion is active - full cyan orb
            this.grubTerminatorOrb.setRadius(30);
            this.grubTerminatorOrbBg.setFillStyle(0x000000);
        }
    }
    
    showPowerupEffect(type, value) {
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        let text = '';
        let color = '#ffffff';
        
        switch (type) {
            case 'energy':
                text = `+${value} ENERGY!`;
                color = '#00e5ff';
                break;
            case 'health':
                text = `+${value} HEALTH!`;
                color = '#00ff44';
                break;
            case 'gunpower':
                text = `GUN POWER UP!\n${value}`;
                color = '#ff6600';
                break;
            case 'score':
                text = `+${value} POINTS!`;
                color = '#ffff00';
                break;
        }
        
        const effectText = this.scene.add.text(
            gameWidth / 2,
            gameHeight / 2 - 100,
            text,
            {
                fontSize: '32px',
                fontStyle: 'bold',
                color: color,
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }
        ).setOrigin(0.5);
        
        this.scene.tweens.add({
            targets: effectText,
            y: effectText.y - 80,
            alpha: 0,
            scale: 1.5,
            duration: 2000,
            ease: 'Power2.easeOut',
            onComplete: () => {
                effectText.destroy();
            }
        });
    }
    
    /**
     * Creates a particle stream effect from a powerup to the appropriate orb
     * @param {string} powerupType - The type of powerup ('blue', 'green', 'orange')
     * @param {number} sourceX - The x coordinate where the powerup was collected
     * @param {number} sourceY - The y coordinate where the powerup was collected
     */
    createPowerupAbsorptionEffect(powerupType, sourceX, sourceY) {
        // Determine which orb to target and what color to use
        let targetOrb, color;
        
        switch (powerupType) {
            case 'blue': // Energy powerup
                targetOrb = this.energyOrb;
                color = 0x0066ff;
                break;
            case 'green': // Health powerup
                targetOrb = this.healthOrb;
                color = 0x00ff44;
                break;
            case 'orange': // Gun power powerup
                targetOrb = this.gunPowerOrb;
                color = 0xff6600;
                break;
            default:
                console.warn(`Unknown powerup type: ${powerupType}`);
                return;
        }
        
        if (!targetOrb) return;
        
        // Create particles that flow from the source to the target orb
        const particleCount = 30; // Number of particles to create
        const baseDuration = 800; // Base duration for particles to reach the orb
        
        // Keep track of the current filled radius for smooth animations
        const startRadius = targetOrb.radius;
        
        // Calculate how much the radius should increase for this powerup
        let targetRadius;
        switch (powerupType) {
            case 'blue': // Energy increases by 25%
                // Get current energy and calculate target
                let energy = 25;
                if (this.scene.player && typeof this.scene.player.energy === 'number') {
                    energy = this.scene.player.energy;
                }
                // Ensure we don't go over 100%
                const targetEnergy = Math.min(100, energy + 25);
                targetRadius = this.energyOrbBg.radius * (targetEnergy / 100);
                break;
                
            case 'green': // Health increases by 25 points
                // Get current health and calculate target
                let health = 100;
                if (this.scene.player && typeof this.scene.player.health === 'number') {
                    health = this.scene.player.health;
                }
                // Ensure we don't go over 100%
                const targetHealth = Math.min(100, health + 25);
                targetRadius = this.healthOrbBg.radius * (targetHealth / 100);
                break;
                
            case 'orange': // Gun power increases by 1 level
                // Get current gun power level
                let gunPowerLevel = 1;
                if (this.scene.player && typeof this.scene.player.gunPowerLevel === 'number') {
                    gunPowerLevel = this.scene.player.gunPowerLevel;
                }
                // Ensure we don't go over level 3
                const targetGunPower = Math.min(3, gunPowerLevel + 1);
                targetRadius = this.gunPowerOrbBg.radius * (targetGunPower / 3);
                break;
        }
        
        // Track particles for completing the effect
        let particlesCreated = 0;
        let particlesArrived = 0;
        
        // Create multiple particles that fly from the source to the orb
        for (let i = 0; i < particleCount; i++) {
            // Small random offset for starting position
            const offsetX = Math.random() * 40 - 20;
            const offsetY = Math.random() * 40 - 20;
            
            // Create particle
            const particle = this.scene.add.circle(
                sourceX + offsetX, 
                sourceY + offsetY, 
                3 + Math.random() * 4, // Random size between 3-7
                color,
                0.8
            );
            
            // Add glow effect for WebGL
            if (this.scene.renderer.type === Phaser.WEBGL) {
                try {
                    particle.preFX.addGlow(color, 4, 0, false);
                } catch (error) {
                    // Silently handle errors
                }
            }
            
            // Set blend mode for better visuals
            particle.setBlendMode(Phaser.BlendModes.ADD);
            
            // Set depth to appear above other elements
            particle.setDepth(100);
            
            // Random delay for staggered effect
            const delay = Math.random() * 200;
            
            // Add to tracking count
            particlesCreated++;
            
            // Create the path animation with delay
            this.scene.time.delayedCall(delay, () => {
                // Calculate duration with slight variation and distance-based adjustment
                const dx = targetOrb.x - particle.x;
                const dy = targetOrb.y - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Duration increases with distance but with some random variation
                const duration = baseDuration + (distance / 5) + (Math.random() * 200);
                
                // Create a path with slight curve
                const controlPointX = (particle.x + targetOrb.x) / 2 + (Math.random() * 100 - 50);
                const controlPointY = (particle.y + targetOrb.y) / 2 + (Math.random() * 100 - 50);
                
                // Animate along the path
                this.scene.tweens.add({
                    targets: particle,
                    x: {
                        value: targetOrb.x,
                        duration: duration,
                        ease: function(t) {
                            // Quadratic bezier curve
                            const mt = 1 - t;
                            return mt * mt * particle.x + 2 * mt * t * controlPointX + t * t * targetOrb.x;
                        }
                    },
                    y: {
                        value: targetOrb.y,
                        duration: duration,
                        ease: function(t) {
                            // Quadratic bezier curve
                            const mt = 1 - t;
                            return mt * mt * particle.y + 2 * mt * t * controlPointY + t * t * targetOrb.y;
                        }
                    },
                    scale: {
                        value: 0.5,
                        duration: duration,
                        ease: 'Sine.easeIn'
                    },
                    onComplete: () => {
                        // Create a small flash effect at the orb
                        this.createRippleEffect(targetOrb.x, targetOrb.y, color, 0.5);
                        
                        // Destroy the particle
                        particle.destroy();
                        
                        // Track particles that have arrived
                        particlesArrived++;
                        
                        // If all particles have arrived, update the orb radius
                        if (particlesArrived === particlesCreated) {
                            // Animate the orb filling up
                            this.scene.tweens.add({
                                targets: targetOrb,
                                radius: targetRadius,
                                duration: 300,
                                ease: 'Back.easeOut',
                                onComplete: () => {
                                    // Create a final ripple effect
                                    this.createRippleEffect(targetOrb.x, targetOrb.y, color, 1);
                                }
                            });
                        }
                    }
                });
                
                // Add "acceleration" by increasing scale at the beginning
                this.scene.tweens.add({
                    targets: particle,
                    scale: 1.5,
                    duration: 100,
                    yoyo: true,
                    ease: 'Back.easeOut'
                });
            });
        }
        
        // Create a burst effect at the source
        const burstParticles = 12;
        for (let i = 0; i < burstParticles; i++) {
            const angle = (i / burstParticles) * Math.PI * 2;
            const speed = 2 + Math.random() * 2;
            const distance = 30 + Math.random() * 20;
            
            const particleX = sourceX;
            const particleY = sourceY;
            
            const burstParticle = this.scene.add.circle(
                particleX,
                particleY,
                2 + Math.random() * 3,
                color,
                0.8
            );
            
            burstParticle.setBlendMode(Phaser.BlendModes.ADD);
            burstParticle.setDepth(99);
            
            this.scene.tweens.add({
                targets: burstParticle,
                x: particleX + Math.cos(angle) * distance,
                y: particleY + Math.sin(angle) * distance,
                alpha: 0,
                scale: 0.5,
                duration: 400 + Math.random() * 200,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    burstParticle.destroy();
                }
            });
        }
    }
    
    /**
     * Creates a ripple effect that emanates from the specified coordinates
     * @param {number} x - The x coordinate of the center of the ripple
     * @param {number} y - The y coordinate of the center of the ripple
     * @param {number} color - The color of the ripple
     * @param {number} intensity - The intensity of the ripple (1 = normal, 2 = stronger)
     */
    createRippleEffect(x, y, color, intensity = 1) {
        // Create multiple expanding rings
        const numRings = intensity === 1 ? 2 : 3;
        
        for (let i = 0; i < numRings; i++) {
            // Create ring with color and transparency
            const ring = this.scene.add.circle(x, y, 5, color, 0.7);
            
            // Set ring depth to be above the orbs
            ring.setDepth(10);
            
            // Define animation timing based on which ring it is
            const delay = i * 100; // Stagger start times
            const duration = 300 + (i * 100); // Outer rings last longer
            
            // Start animation after delay
            this.scene.time.delayedCall(delay, () => {
                // Expand and fade the ring
                this.scene.tweens.add({
                    targets: ring,
                    radius: 50 * intensity, // Size based on intensity
                    alpha: 0,
                    duration: duration,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        ring.destroy();
                    }
                });
            });
        }
    }
    
    createEnergyIndicator() {
        // If energy indicator already exists, don't create another one
        if (this.energyIndicator && this.energyIndicator.active) return;
        
        // Only create indicator if player exists
        if (!this.scene.player) return;
        
        // Play energy weapon online sound when the sidekick ship spawns
        if (this.scene.soundManager) {
            this.scene.soundManager.playEnergyWeaponOnline();
        }
        
        // Check if sidekick-ship texture exists, create fallback if not
        if (!this.scene.textures.exists('sidekick-ship')) {
            console.warn("Sidekick-ship texture not found, creating fallback for energy weapon");
            
            // Create a fallback texture for the energy weapon ship
            const graphics = this.scene.make.graphics({});
            graphics.fillStyle(0x0066ff, 1); // Rich blue to match energy theme
            graphics.fillTriangle(0, 10, 20, 5, 0, 0); // Simple triangle ship
            graphics.generateTexture('sidekick-ship', 20, 10);
            graphics.destroy();
        }
        
        // Create the indicator sprite above the player ship
        this.energyIndicator = this.scene.physics.add.sprite(
            this.scene.player.x, 
            this.scene.player.y - 30, 
            'sidekick-ship'
        );
        this.energyIndicator.setDepth(2);
        
        // Add glow effect (WebGL only)
        if (this.scene.renderer.type === Phaser.WEBGL) {
            try {
                this.energyIndicator.preFX.addGlow(0x0066ff, 4, 0, false); // Rich blue to match energy theme
            } catch (error) {
                console.warn("Error applying energy indicator glow:", error);
            }
        }
        
        // Add pulsing effect
        this.scene.tweens.add({
            targets: this.energyIndicator,
            scale: 1.2,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Make it follow the player above its position
        this.energyIndicatorFollower = this.scene.time.addEvent({
            delay: 10,
            callback: () => {
                if (this.energyIndicator && this.energyIndicator.active && this.scene.player) {
                    this.energyIndicator.x = this.scene.player.x;
                    this.energyIndicator.y = this.scene.player.y - 30;
                }
            },
            loop: true
        });
        
        return this.energyIndicator;
    }
    
    cleanupEnergyIndicator() {
        if (this.energyIndicator && this.energyIndicator.active) {
            // Add fade out effect
            this.scene.tweens.add({
                targets: this.energyIndicator,
                alpha: 0,
                scale: 0,
                duration: 500,
                onComplete: () => {
                    this.energyIndicator.destroy();
                    this.energyIndicator = null;
                    
                    // Also remove the follower event if it exists
                    if (this.energyIndicatorFollower) {
                        this.energyIndicatorFollower.remove();
                        this.energyIndicatorFollower = null;
                    }
                }
            });
        }
    }
}
