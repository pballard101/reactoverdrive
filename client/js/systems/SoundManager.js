// SoundManager.js - Handles all sound effects in the game

export default class SoundManager {
    constructor(scene) {
        this.scene = scene;
        
        // Load saved settings from localStorage
        this.loadSavedSettings();
        
        // Sound effect references
        this.sounds = {};
        
        // Load the default sound configuration
        this.loadSoundConfig();
        
        // Register the toggle key
        this.setupToggleKey();
        
        console.log("🔊 SoundManager initialized with settings:", {
            enabled: this.soundsEnabled,
            volume: this.masterVolume
        });
    }
    
    /**
     * Load saved settings from localStorage
     */
    loadSavedSettings() {
        try {
            // Load sound effects enabled/disabled state (default true)
            const sfxMuted = localStorage.getItem('reactoverdrive_sfx_muted');
            this.soundsEnabled = sfxMuted !== 'true'; // Inverted because muted means disabled
            
            // Load sound effects volume (default 70%)
            const sfxVolume = localStorage.getItem('reactoverdrive_sfx_volume');
            this.masterVolume = sfxVolume ? parseFloat(sfxVolume) : 0.7;
            
            console.log("🔊 SoundManager loaded settings:", {
                enabled: this.soundsEnabled,
                volume: this.masterVolume
            });
        } catch (error) {
            console.warn("⚠️ Error loading SoundManager settings:", error);
            // Use defaults
            this.soundsEnabled = true;
            this.masterVolume = 0.7;
        }
    }
    
    async loadSoundConfig() {
        try {
            // Try to load the sound configuration
            const response = await fetch('./js/soundConfig.js');
            if (response.ok) {
                const configModule = await import('../soundConfig.js');
                this.soundConfig = configModule.default;
                console.log("✅ Loaded sound configuration:", this.soundConfig);
            } else {
                // If the file doesn't exist yet, use default values
                console.log("⚠️ Sound config file not found, using defaults");
                this.soundConfig = {
                    BulletFire: 0.3,
                    EnemyDestroyed: 0.3,
                    PowerUp_Energy: 0.9,
                    PowerUp_Gun: 0.9,
                    PowerUP_Health: 0.9,
                    EnergyWeaponOnline: 0.9,
                    EnergyWeaponUsed: 0.9
                };
            }
        } catch (error) {
            console.warn("⚠️ Error loading sound config, using defaults:", error);
            this.soundConfig = {
                BulletFire: 0.5,
                EnemyDestroyed: 0.7,
                PowerUp_Energy: 0.8,
                PowerUp_Gun: 0.8,
                PowerUP_Health: 0.8,
                EnergyWeaponOnline: 0.9,
                EnergyWeaponUsed: 0.8
            };
        }
        
        // Preload the sound effects
        this.preloadSounds();
    }
    
    preloadSounds() {
        // Define sound keys and their file paths
        const soundFiles = {
            'BulletFire': 'assets/soundfx/BulletFire.mp3',
            'EnemyDestroyed': 'assets/soundfx/EnemyDestroyed.mp3',
            'PowerUp_Energy': 'assets/soundfx/PowerUp_Energy.mp3',
            'PowerUp_Gun': 'assets/soundfx/PowerUp_Gun.mp3',
            'PowerUP_Health': 'assets/soundfx/PowerUP_Health.mp3',
            'EnergyWeaponOnline': 'assets/soundfx/EnergyWeaponOnline.mp3',
            'EnergyWeaponUsed': 'assets/soundfx/EnergyWeaponUsed.mp3'
        };
        
        // Load each sound file
        Object.entries(soundFiles).forEach(([key, path]) => {
            if (!this.scene.load.cacheManager.audio.exists(key)) {
                this.scene.load.audio(key, path);
            }
        });
        
        // Once they're loaded, create the sound objects
        this.scene.load.once('complete', () => {
            // Create sound objects for each loaded audio file
            Object.keys(soundFiles).forEach(key => {
                // Get volume from config or use default
                const volume = this.soundConfig[key] || 0.7;
                
                // Create the sound with config
                this.sounds[key] = this.scene.sound.add(key, {
                    volume: volume * this.masterVolume,
                    loop: false
                });
                
                console.log(`🎵 Created sound: ${key} (volume: ${volume})`);
            });
        });
        
        // Start loading if not already loaded
        this.scene.load.start();
    }
    
    setupToggleKey() {
        // Add key 3 to toggle sound effects
        this.threeKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
        
        // Track key press state to avoid multiple toggles on a single press
        this.lastKeyState = {
            three: false
        };
    }
    
    update() {
        // Check for 3 key press to toggle sound effects
        if (this.threeKey) {
            const threeKeyDown = this.threeKey.isDown;
            if (threeKeyDown && !this.lastKeyState.three) {
                this.toggleSounds();
            }
            this.lastKeyState.three = threeKeyDown;
        }
    }
    
    toggleSounds() {
        this.soundsEnabled = !this.soundsEnabled;
        console.log(`🔊 Sound effects ${this.soundsEnabled ? 'enabled' : 'disabled'}`);
        
        // Show a notification to the player
        if (this.scene.uiManager && typeof this.scene.uiManager.showNotification === 'function') {
            this.scene.uiManager.showNotification(
                `Sound Effects: ${this.soundsEnabled ? 'ON' : 'OFF'}`,
                this.soundsEnabled ? '#00ff00' : '#ff0000'
            );
        } else {
            // Fallback notification if UIManager doesn't have the method
            const textColor = this.soundsEnabled ? '#00ff00' : '#ff0000';
            const notification = this.scene.add.text(
                this.scene.gameWidth / 2,
                this.scene.gameHeight * 0.2,
                `Sound Effects: ${this.soundsEnabled ? 'ON' : 'OFF'}`,
                {
                    fontFamily: 'Arial',
                    fontSize: '24px',
                    color: textColor,
                    stroke: '#000000',
                    strokeThickness: 4
                }
            ).setOrigin(0.5);
            
            // Make it fade out
            this.scene.tweens.add({
                targets: notification,
                alpha: 0,
                y: notification.y - 50,
                duration: 2000,
                onComplete: () => notification.destroy()
            });
        }
    }
    
    playSound(key) {
        // Only play if sounds are enabled and the sound exists
        if (this.soundsEnabled && this.sounds[key]) {
            try {
                this.sounds[key].play();
            } catch (error) {
                console.warn(`Error playing sound ${key}:`, error);
            }
        }
    }
    
    /**
     * Set the master volume for all sound effects
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        
        // Update all existing sounds
        Object.entries(this.sounds).forEach(([key, sound]) => {
            if (sound && typeof sound.setVolume === 'function') {
                const configVolume = this.soundConfig[key] || 0.7;
                sound.setVolume(configVolume * this.masterVolume);
            }
        });
        
        console.log(`🔊 Sound effects volume set to ${Math.round(this.masterVolume * 100)}%`);
    }
    
    /**
     * Get the current master volume
     * @returns {number} Current volume level (0.0 to 1.0)
     */
    getVolume() {
        return this.masterVolume;
    }
    
    /**
     * Set sound effects enabled/disabled state
     * @param {boolean} enabled - Whether sound effects should be enabled
     */
    setSoundsEnabled(enabled) {
        this.soundsEnabled = enabled;
        console.log(`🔊 Sound effects ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Check if sound effects are enabled
     * @returns {boolean} Whether sound effects are enabled
     */
    isSoundsEnabled() {
        return this.soundsEnabled;
    }
    
    // Convenience methods for specific sounds
    playBulletFire() {
        this.playSound('BulletFire');
    }
    
    playEnemyDestroyed() {
        this.playSound('EnemyDestroyed');
    }
    
    playPowerupEnergy() {
        this.playSound('PowerUp_Energy');
    }
    
    playPowerupGun() {
        this.playSound('PowerUp_Gun');
    }
    
    playPowerupHealth() {
        this.playSound('PowerUP_Health');
    }
    
    playEnergyWeaponOnline() {
        this.playSound('EnergyWeaponOnline');
    }
    
    playEnergyWeaponUsed() {
        this.playSound('EnergyWeaponUsed');
    }
    
    // Called when scene is shut down
    cleanup() {
        // Stop and destroy all sounds
        Object.values(this.sounds).forEach(sound => {
            if (sound) {
                sound.stop();
                sound.destroy();
            }
        });
        
        this.sounds = {};
    }
}
