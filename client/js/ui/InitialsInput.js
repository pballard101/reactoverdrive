// InitialsInput.js - UI for entering player initials for high scores

export default class InitialsInput {
    constructor(scene) {
        this.scene = scene;
        this.gameWidth = scene.sys.game.config.width;
        this.gameHeight = scene.sys.game.config.height;
        
        // Debug dimensions
        console.log(`InitialsInput constructor - Game dimensions: ${this.gameWidth}x${this.gameHeight}`);
        
        // Create a group with high depth to ensure visibility
        this.inputGroup = scene.add.group();
        
        // Set super high depth at creation - even higher than before
        this.inputGroup.setDepth(10000);
        
        this.visible = false;
        this.maxLength = 3;
        this.callback = null;
        this.currentInitials = 'AAA';
        this.selectedIndex = 0;
        this.charBoxes = [];
        this.inputElements = []; // Track all created elements for cleanup
        
        // Create a background container that will hold everything
        // This helps ensure proper visibility and cleanup
        this.container = scene.add.container(0, 0);
        this.container.setDepth(9000);
        
        console.log("✅ InitialsInput initialized with extra container");
    }

    /**
     * Show the initials input UI
     * @param {Function} callback - Function to call when initials are submitted or canceled
     */
    show(callback) {
        console.log("🎮🎮🎮 InitialsInput SHOW called! 🎮🎮🎮");
        if (this.visible) {
            console.log("InitialsInput already visible, ignoring");
            return;
        }
        
        this.visible = true;
        this.callback = callback;
        this.currentInitials = 'AAA';
        this.selectedIndex = 0;
        
        // Create background panel
        const panelWidth = this.gameWidth * 0.4;
        const panelHeight = this.gameHeight * 0.3;
        const panelX = this.gameWidth / 2 - panelWidth / 2;
        const panelY = this.gameHeight / 2 - panelHeight / 2;
        
        // Set high depth for all input elements
        this.inputGroup.setDepth(2000);
        
        // Create a solid background to ensure visibility
        const dimmerBackground = this.scene.add.rectangle(
            this.gameWidth / 2,
            this.gameHeight / 2,
            this.gameWidth,
            this.gameHeight,
            0x000000,
            0.7 // Semi-transparent black overlay for the whole screen
        );
        this.inputGroup.add(dimmerBackground);
        
        const background = this.scene.add.rectangle(
            this.gameWidth / 2,
            this.gameHeight / 2,
            panelWidth,
            panelHeight,
            0x000000,
            0.95 // Increased opacity for better visibility
        );
        background.setStrokeStyle(4, 0x00ff00); // Thicker, brighter stroke
        this.inputGroup.add(background);
        
        console.log("Input panel created at", this.gameWidth/2, this.gameHeight/2);
        
        // Title text
        const titleText = this.scene.add.text(
            this.gameWidth / 2,
            panelY + 30,
            'ENTER YOUR INITIALS',
            {
                fontSize: '32px', // Larger font
                fontStyle: 'bold',
                color: '#00ff00',
                stroke: '#000000',
                strokeThickness: 4,
                shadow: { color: '#00ff00', blur: 10, offsetX: 0, offsetY: 0 } // Add glow effect
            }
        ).setOrigin(0.5);
        this.inputGroup.add(titleText);
        
        // Create character boxes
        this.charBoxes = [];
        const startX = this.gameWidth / 2 - ((this.maxLength * 60) / 2) + 30;
        
        for (let i = 0; i < this.maxLength; i++) {
            const char = this.currentInitials.charAt(i) || 'A';
            const charBox = this.createCharBox(startX + (i * 60), panelY + panelHeight/2, char, i);
            this.charBoxes.push(charBox);
            this.inputGroup.add(charBox);
        }
        
        // Highlight the first box
        this.updateSelection();
        
        // Instructions text
        const instructionsText = this.scene.add.text(
            this.gameWidth / 2,
            panelY + panelHeight - 40,
            'Arrow Keys: Select/Change  |  Enter: Submit  |  Esc: Cancel',
            {
                fontSize: '18px', // Slightly larger
                color: '#ffffff', // Brighter color
                stroke: '#000000', // Add stroke
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        this.inputGroup.add(instructionsText);
        
        // Set up input listeners
        this.setupInputListeners();
        
        // Add animation
        this.scene.tweens.add({
            targets: this.inputGroup.getChildren(),
            alpha: { from: 0, to: 1 },
            duration: 300,
            ease: 'Power2'
        });
        
        // Add pulsing effect to selected box
        this.pulseSelectedBox();
    }
    
    /**
     * Create a character box for an initial
     */
    createCharBox(x, y, char, index) {
        const container = this.scene.add.container(x, y);
        
        // Background box
        const rect = this.scene.add.rectangle(0, 0, 60, 70, 0x222222); // Larger box
        rect.setStrokeStyle(3, 0xaaaaaa); // Thicker stroke
        container.add(rect);
        
        // Character text
        const text = this.scene.add.text(0, 0, char, {
            fontSize: '42px', // Larger font
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000', // Add stroke for better visibility
            strokeThickness: 1
        }).setOrigin(0.5);
        container.add(text);
        
        // Up arrow
        const upArrow = this.scene.add.text(0, -35, '▲', {
            fontSize: '24px', // Larger arrow
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5);
        upArrow.setInteractive();
        upArrow.on('pointerdown', () => {
            this.changeChar(index, 1);
        });
        container.add(upArrow);
        
        // Down arrow
        const downArrow = this.scene.add.text(0, 35, '▼', {
            fontSize: '24px', // Larger arrow
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5);
        downArrow.setInteractive();
        downArrow.on('pointerdown', () => {
            this.changeChar(index, -1);
        });
        container.add(downArrow);
        
        // Store components for later access
        container.rect = rect;
        container.text = text;
        container.upArrow = upArrow;
        container.downArrow = downArrow;
        container.index = index;
        
        return container;
    }
    
    /**
     * Set up keyboard input listeners
     */
    setupInputListeners() {
        // Arrow keys for navigation and character selection
        this.leftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        this.rightKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
        this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.enterKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        
        // Track last key state
        this.lastKeyState = {
            left: false,
            right: false,
            up: false,
            down: false,
            enter: false,
            esc: false
        };
        
        // Add event listener for direct letter typing
        this.keyHandler = (event) => {
            // Only handle A-Z and a-z keys
            if (/^[a-z]$/i.test(event.key)) {
                const char = event.key.toUpperCase();
                this.setChar(this.selectedIndex, char);
                
                // Move to next character if not at the end
                if (this.selectedIndex < this.maxLength - 1) {
                    this.selectedIndex++;
                    this.updateSelection();
                }
            }
        };
        
        // Add the event listener
        window.addEventListener('keydown', this.keyHandler);
        
        // Add update callback
        this.updateEvent = this.scene.events.on('update', this.update, this);
    }
    
    /**
     * Update method called every frame
     */
    update() {
        if (!this.visible) return;
        
        // Check keyboard input
        const leftDown = this.leftKey.isDown;
        const rightDown = this.rightKey.isDown;
        const upDown = this.upKey.isDown;
        const downDown = this.downKey.isDown;
        const enterDown = this.enterKey.isDown;
        const escDown = this.escKey.isDown;
        
        // Move selection left
        if (leftDown && !this.lastKeyState.left) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateSelection();
        }
        
        // Move selection right
        if (rightDown && !this.lastKeyState.right) {
            this.selectedIndex = Math.min(this.maxLength - 1, this.selectedIndex + 1);
            this.updateSelection();
        }
        
        // Increment character
        if (upDown && !this.lastKeyState.up) {
            this.changeChar(this.selectedIndex, 1);
        }
        
        // Decrement character
        if (downDown && !this.lastKeyState.down) {
            this.changeChar(this.selectedIndex, -1);
        }
        
        // Submit
        if (enterDown && !this.lastKeyState.enter) {
            this.submit();
        }
        
        // Cancel
        if (escDown && !this.lastKeyState.esc) {
            this.cancel();
        }
        
        // Update last key state
        this.lastKeyState.left = leftDown;
        this.lastKeyState.right = rightDown;
        this.lastKeyState.up = upDown;
        this.lastKeyState.down = downDown;
        this.lastKeyState.enter = enterDown;
        this.lastKeyState.esc = escDown;
    }
    
    /**
     * Update visual selection indicator
     */
    updateSelection() {
        this.charBoxes.forEach((box, index) => {
            if (index === this.selectedIndex) {
                // Highlight selected box
                box.rect.setStrokeStyle(3, 0x00ff00);
                box.text.setColor('#ffffff');
                box.upArrow.setColor('#00ff00');
                box.downArrow.setColor('#00ff00');
            } else {
                // Normal appearance for unselected boxes
                box.rect.setStrokeStyle(2, 0xaaaaaa);
                box.text.setColor('#aaaaaa');
                box.upArrow.setColor('#aaaaaa');
                box.downArrow.setColor('#aaaaaa');
            }
        });
        
        // Reset and restart pulsing effect
        this.scene.tweens.killTweensOf(this.charBoxes[this.selectedIndex].rect);
        this.pulseSelectedBox();
    }
    
    /**
     * Add pulsing effect to the selected box
     */
    pulseSelectedBox() {
        if (!this.charBoxes[this.selectedIndex]) return;
        
        this.scene.tweens.add({
            targets: this.charBoxes[this.selectedIndex].rect,
            strokeAlpha: { from: 1, to: 0.3 },
            yoyo: true,
            repeat: -1,
            duration: 500
        });
    }
    
    /**
     * Change the character at the specified index
     * @param {number} index - Index of the character to change
     * @param {number} direction - Direction of change (1 = up, -1 = down)
     */
    changeChar(index, direction) {
        if (index < 0 || index >= this.maxLength) return;
        
        // Get the current character
        let char = this.currentInitials.charAt(index) || 'A';
        
        // Convert to character code
        let charCode = char.charCodeAt(0);
        
        // Change character code
        charCode += direction;
        
        // Wrap around A-Z (ASCII 65-90)
        if (charCode > 90) charCode = 65;
        if (charCode < 65) charCode = 90;
        
        // Convert back to character
        char = String.fromCharCode(charCode);
        
        // Update initials
        this.setChar(index, char);
    }
    
    /**
     * Set a specific character at the specified index
     * @param {number} index - Index of the character to set
     * @param {string} char - Character to set (should be A-Z)
     */
    setChar(index, char) {
        if (index < 0 || index >= this.maxLength) return;
        
        // Update the current initials string
        this.currentInitials = 
            this.currentInitials.substring(0, index) + 
            char + 
            this.currentInitials.substring(index + 1, this.maxLength);
        
        // Update the displayed character
        if (this.charBoxes[index]) {
            this.charBoxes[index].text.setText(char);
        }
        
        // Add a little scale bounce effect
        if (this.charBoxes[index] && this.charBoxes[index].text) {
            this.scene.tweens.add({
                targets: this.charBoxes[index].text,
                scale: { from: 1.3, to: 1 },
                duration: 200,
                ease: 'Back.Out'
            });
        }
    }
    
    /**
     * Submit the entered initials
     */
    submit() {
        console.log("📝📝📝 Submitting initials:", this.currentInitials);
        
        // Store callback and initials before cleanup
        const savedCallback = this.callback;
        const savedInitials = this.currentInitials;
        
        // Clean up UI immediately
        this.cleanup();
        
        // Call the callback with the initials AFTER cleanup
        if (savedCallback) {
            console.log("✅ Calling initials callback with:", savedInitials);
            savedCallback(savedInitials);
        } else {
            console.warn("⚠️ No callback registered for initials submission");
        }
    }
    
    /**
     * Cancel initial input
     */
    cancel() {
        // Clean up
        this.cleanup();
        
        // Call the callback with null to indicate cancellation
        if (this.callback) {
            this.callback(null);
        }
    }
    
    /**
     * Clean up resources when input is done
     */
    cleanup() {
        console.log("🧹 Cleaning up initials input");
        
        // Mark as no longer visible
        this.visible = false;
        
        try {
            // Remove keyboard event listener
            window.removeEventListener('keydown', this.keyHandler);
            
            // Remove update callback
            this.scene.events.off('update', this.update, this);
            
            // Kill any tweens associated with this UI
            if (this.charBoxes) {
                this.charBoxes.forEach(box => {
                    if (box && box.rect) {
                        this.scene.tweens.killTweensOf(box.rect);
                    }
                });
            }
            
            // Immediately clear the input group without animation
            if (this.inputGroup) {
                this.inputGroup.clear(true, true);
            }
            
            // Clear the container as well
            if (this.container) {
                this.container.removeAll(true);
            }
            
            // Clear references
            this.charBoxes = [];
            
            // DO NOT clear callback here as we need it for submit
            // this.callback = null;
            
            console.log("✅ InitialsInput cleanup complete");
        } catch (error) {
            console.error("❌ Error during InitialsInput cleanup:", error);
        }
    }
}
