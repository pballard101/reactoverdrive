// PauseMenu.js - Handles the pause menu overlay with volume controls and settings

export default class PauseMenu {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.isPaused = false;
        
        // HTML elements for the pause menu
        this.pauseContainer = null;
        this.soundEffectsSlider = null;
        this.musicSlider = null;
        this.soundEffectsMuteCheckbox = null;
        this.debugModeCheckbox = null;
        
        // Store original settings to restore if needed
        this.originalSettings = {
            soundEffectsVolume: 1.0,
            musicVolume: 1.0,
            soundEffectsMuted: false,
            debugMode: false
        };
        
        // Load saved settings
        this.loadSettings();
        
        console.log("🎛️ PauseMenu initialized");
    }
    
    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            // Load sound effects volume (default 70%)
            const sfxVolume = localStorage.getItem('reactoverdrive_sfx_volume');
            this.soundEffectsVolume = sfxVolume ? parseFloat(sfxVolume) : 0.7;
            
            // Load music volume (default 50%)
            const musicVolume = localStorage.getItem('reactoverdrive_music_volume');
            this.musicVolume = musicVolume ? parseFloat(musicVolume) : 0.5;
            
            // Load mute state (default false)
            const sfxMuted = localStorage.getItem('reactoverdrive_sfx_muted');
            this.soundEffectsMuted = sfxMuted === 'true';
            
            // Load debug mode state (default false)
            const debugMode = localStorage.getItem('reactoverdrive_debug_mode');
            this.debugModeEnabled = debugMode === 'true';
            
            console.log("📦 Loaded settings:", {
                sfxVolume: this.soundEffectsVolume,
                musicVolume: this.musicVolume,
                sfxMuted: this.soundEffectsMuted,
                debugMode: this.debugModeEnabled
            });
            
            // Apply loaded settings to the game
            this.applySettings();
        } catch (error) {
            console.warn("⚠️ Error loading pause menu settings:", error);
            // Use defaults
            this.soundEffectsVolume = 0.7;
            this.musicVolume = 0.5;
            this.soundEffectsMuted = false;
            this.debugModeEnabled = false;
        }
    }
    
    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('reactoverdrive_sfx_volume', this.soundEffectsVolume.toString());
            localStorage.setItem('reactoverdrive_music_volume', this.musicVolume.toString());
            localStorage.setItem('reactoverdrive_sfx_muted', this.soundEffectsMuted.toString());
            localStorage.setItem('reactoverdrive_debug_mode', this.debugModeEnabled.toString());
            
            console.log("💾 Settings saved to localStorage");
        } catch (error) {
            console.warn("⚠️ Error saving pause menu settings:", error);
        }
    }
    
    /**
     * Apply current settings to the game systems
     */
    applySettings() {
        // Apply sound effects volume and mute state
        if (this.scene.soundManager) {
            this.scene.soundManager.setVolume(this.soundEffectsVolume);
            this.scene.soundManager.soundsEnabled = !this.soundEffectsMuted;
        }
        
        // Apply music volume
        if (this.scene.audioAnalyzer && this.scene.audioAnalyzer.music) {
            this.scene.audioAnalyzer.music.setVolume(this.musicVolume);
        }
        
        // Apply debug mode
        if (this.scene.uiManager) {
            const currentDebugMode = this.scene.uiManager.debugMode;
            if (currentDebugMode !== this.debugModeEnabled) {
                this.scene.uiManager.setDebugMode(this.debugModeEnabled);
            }
        }
    }
    
    /**
     * Show the pause menu
     */
    show() {
        if (this.isVisible) return;
        
        console.log("⏸️ Showing pause menu");
        this.isVisible = true;
        this.isPaused = true;
        
        // Pause the game
        this.pauseGame();
        
        // Create the HTML pause menu
        this.createPauseMenuHTML();
        
        // Store original settings for cancel functionality
        this.storeOriginalSettings();
    }
    
    /**
     * Hide the pause menu
     */
    hide() {
        if (!this.isVisible) return;
        
        console.log("▶️ Hiding pause menu");
        this.isVisible = false;
        this.isPaused = false;
        
        // Resume the game
        this.resumeGame();
        
        // Remove the HTML pause menu
        this.removePauseMenuHTML();
        
        // Save settings
        this.saveSettings();
    }
    
    /**
     * Toggle the pause menu visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    /**
     * Pause the game systems
     */
    pauseGame() {
        // Pause the scene
        this.scene.scene.pause();
        
        // Pause audio if playing
        if (this.scene.audioAnalyzer && this.scene.audioAnalyzer.music) {
            if (this.scene.audioAnalyzer.music.isPlaying) {
                this.scene.audioAnalyzer.music.pause();
                this.musicWasPaused = true;
            } else {
                this.musicWasPaused = false;
            }
        }
        
        console.log("⏸️ Game paused");
    }
    
    /**
     * Resume the game systems
     */
    resumeGame() {
        // Resume the scene
        this.scene.scene.resume();
        
        // Resume audio if it was playing
        if (this.scene.audioAnalyzer && this.scene.audioAnalyzer.music && this.musicWasPaused) {
            this.scene.audioAnalyzer.music.resume();
        }
        
        console.log("▶️ Game resumed");
    }
    
    /**
     * Store original settings for cancel functionality
     */
    storeOriginalSettings() {
        this.originalSettings = {
            soundEffectsVolume: this.soundEffectsVolume,
            musicVolume: this.musicVolume,
            soundEffectsMuted: this.soundEffectsMuted,
            debugMode: this.debugModeEnabled
        };
    }
    
    /**
     * Restore original settings (cancel changes)
     */
    restoreOriginalSettings() {
        this.soundEffectsVolume = this.originalSettings.soundEffectsVolume;
        this.musicVolume = this.originalSettings.musicVolume;
        this.soundEffectsMuted = this.originalSettings.soundEffectsMuted;
        this.debugModeEnabled = this.originalSettings.debugMode;
        
        // Apply the restored settings
        this.applySettings();
        
        // Update the UI controls
        this.updateUIControls();
        
        console.log("🔄 Settings restored to original values");
    }
    
    /**
     * Create the HTML pause menu overlay
     */
    createPauseMenuHTML() {
        // Create main container
        this.pauseContainer = document.createElement('div');
        this.pauseContainer.id = 'pause-menu-container';
        this.pauseContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: 'Courier New', monospace;
        `;
        
        // Create menu panel
        const menuPanel = document.createElement('div');
        menuPanel.style.cssText = `
            background-color: #222;
            border: 3px solid #00bfff;
            border-radius: 10px;
            padding: 30px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 0 20px rgba(0, 191, 255, 0.5);
            color: #ffffff;
        `;
        
        // Create title
        const title = document.createElement('h2');
        title.textContent = 'GAME PAUSED';
        title.style.cssText = `
            text-align: center;
            color: #00bfff;
            margin-top: 0;
            margin-bottom: 25px;
            font-size: 28px;
            text-shadow: 0 0 10px rgba(0, 191, 255, 0.8);
        `;
        menuPanel.appendChild(title);
        
        // Create settings section
        const settingsSection = document.createElement('div');
        settingsSection.style.cssText = `
            margin-bottom: 25px;
        `;
        
        // Sound Effects Volume
        settingsSection.appendChild(this.createSliderControl('Sound Effects Volume', 'soundEffectsSlider', this.soundEffectsVolume, (value) => {
            this.soundEffectsVolume = value;
            this.applySettings();
        }));
        
        // Music Volume
        settingsSection.appendChild(this.createSliderControl('Music Volume', 'musicSlider', this.musicVolume, (value) => {
            this.musicVolume = value;
            this.applySettings();
        }));
        
        // Sound Effects Mute Checkbox
        settingsSection.appendChild(this.createCheckboxControl('Mute Sound Effects', 'soundEffectsMuteCheckbox', this.soundEffectsMuted, (checked) => {
            this.soundEffectsMuted = checked;
            this.applySettings();
        }));
        
        // Debug Mode Checkbox
        settingsSection.appendChild(this.createCheckboxControl('Debug Mode', 'debugModeCheckbox', this.debugModeEnabled, (checked) => {
            this.debugModeEnabled = checked;
            this.applySettings();
        }));
        
        menuPanel.appendChild(settingsSection);
        
        // Create buttons section
        const buttonsSection = document.createElement('div');
        buttonsSection.style.cssText = `
            display: flex;
            justify-content: space-around;
            margin-top: 25px;
        `;
        
        // Resume button
        const resumeButton = document.createElement('button');
        resumeButton.textContent = 'Resume';
        resumeButton.style.cssText = this.getButtonStyle('#00ff00');
        resumeButton.addEventListener('click', () => {
            this.hide();
        });
        buttonsSection.appendChild(resumeButton);
        
        // Cancel button (restore original settings)
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.cssText = this.getButtonStyle('#ff9900');
        cancelButton.addEventListener('click', () => {
            this.restoreOriginalSettings();
            this.hide();
        });
        buttonsSection.appendChild(cancelButton);
        
        // Return to Menu button
        const menuButton = document.createElement('button');
        menuButton.textContent = 'Main Menu';
        menuButton.style.cssText = this.getButtonStyle('#ff0000');
        menuButton.addEventListener('click', () => {
            this.hide();
            this.scene.scene.start('MenuScene', { restart: true });
        });
        buttonsSection.appendChild(menuButton);
        
        menuPanel.appendChild(buttonsSection);
        
        // Add instructions
        const instructions = document.createElement('div');
        instructions.innerHTML = `
            <div style="text-align: center; margin-top: 15px; font-size: 14px; color: #aaa;">
                Press <strong>ESC</strong> or <strong>Start</strong> button to resume
            </div>
        `;
        menuPanel.appendChild(instructions);
        
        this.pauseContainer.appendChild(menuPanel);
        document.body.appendChild(this.pauseContainer);
        
        // Handle ESC key to close menu
        this.escKeyHandler = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.hide();
            }
        };
        document.addEventListener('keydown', this.escKeyHandler);
    }
    
    /**
     * Create a slider control element
     */
    createSliderControl(label, id, initialValue, onChangeCallback) {
        const container = document.createElement('div');
        container.style.cssText = `
            margin-bottom: 15px;
        `;
        
        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.style.cssText = `
            display: block;
            margin-bottom: 5px;
            color: #ffffff;
            font-weight: bold;
        `;
        
        const sliderContainer = document.createElement('div');
        sliderContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = id;
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.01';
        slider.value = initialValue.toString();
        slider.style.cssText = `
            flex: 1;
            height: 6px;
            background: #333;
            outline: none;
            border-radius: 3px;
        `;
        
        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = Math.round(initialValue * 100) + '%';
        valueDisplay.style.cssText = `
            min-width: 40px;
            color: #00bfff;
            font-weight: bold;
            text-align: right;
        `;
        
        // Store references
        if (id === 'soundEffectsSlider') this.soundEffectsSlider = slider;
        if (id === 'musicSlider') this.musicSlider = slider;
        
        slider.addEventListener('input', (event) => {
            const value = parseFloat(event.target.value);
            valueDisplay.textContent = Math.round(value * 100) + '%';
            onChangeCallback(value);
        });
        
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueDisplay);
        
        container.appendChild(labelElement);
        container.appendChild(sliderContainer);
        
        return container;
    }
    
    /**
     * Create a checkbox control element
     */
    createCheckboxControl(label, id, initialChecked, onChangeCallback) {
        const container = document.createElement('div');
        container.style.cssText = `
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = id;
        checkbox.checked = initialChecked;
        checkbox.style.cssText = `
            width: 18px;
            height: 18px;
        `;
        
        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.htmlFor = id;
        labelElement.style.cssText = `
            color: #ffffff;
            font-weight: bold;
            cursor: pointer;
        `;
        
        // Store references
        if (id === 'soundEffectsMuteCheckbox') this.soundEffectsMuteCheckbox = checkbox;
        if (id === 'debugModeCheckbox') this.debugModeCheckbox = checkbox;
        
        checkbox.addEventListener('change', (event) => {
            onChangeCallback(event.target.checked);
        });
        
        container.appendChild(checkbox);
        container.appendChild(labelElement);
        
        return container;
    }
    
    /**
     * Get button style CSS
     */
    getButtonStyle(color) {
        return `
            background-color: ${color};
            color: #ffffff;
            border: none;
            padding: 10px 20px;
            font-size: 16px;
            font-weight: bold;
            border-radius: 5px;
            cursor: pointer;
            font-family: 'Courier New', monospace;
            transition: all 0.2s;
        `;
    }
    
    /**
     * Update UI controls to reflect current settings
     */
    updateUIControls() {
        if (this.soundEffectsSlider) {
            this.soundEffectsSlider.value = this.soundEffectsVolume.toString();
            // Update the value display
            const valueDisplay = this.soundEffectsSlider.parentNode.querySelector('span');
            if (valueDisplay) {
                valueDisplay.textContent = Math.round(this.soundEffectsVolume * 100) + '%';
            }
        }
        
        if (this.musicSlider) {
            this.musicSlider.value = this.musicVolume.toString();
            // Update the value display
            const valueDisplay = this.musicSlider.parentNode.querySelector('span');
            if (valueDisplay) {
                valueDisplay.textContent = Math.round(this.musicVolume * 100) + '%';
            }
        }
        
        if (this.soundEffectsMuteCheckbox) {
            this.soundEffectsMuteCheckbox.checked = this.soundEffectsMuted;
        }
        
        if (this.debugModeCheckbox) {
            this.debugModeCheckbox.checked = this.debugModeEnabled;
        }
    }
    
    /**
     * Remove the HTML pause menu overlay
     */
    removePauseMenuHTML() {
        if (this.pauseContainer) {
            document.body.removeChild(this.pauseContainer);
            this.pauseContainer = null;
        }
        
        if (this.escKeyHandler) {
            document.removeEventListener('keydown', this.escKeyHandler);
            this.escKeyHandler = null;
        }
        
        // Clear references
        this.soundEffectsSlider = null;
        this.musicSlider = null;
        this.soundEffectsMuteCheckbox = null;
        this.debugModeCheckbox = null;
    }
    
    /**
     * Cleanup when the pause menu is destroyed
     */
    cleanup() {
        this.removePauseMenuHTML();
        console.log("🧹 PauseMenu cleaned up");
    }
}
