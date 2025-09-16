import TextureManager from '../utils/TextureManager.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
        this.songs = [];  // Store available songs
        this.selectedSong = null; // Track selected song
        this.dropdown = null; // Store reference to the dropdown
        this.statusText = null; // Reference to status text
        this.isRestarting = false; // Flag for scene restart from GameScene
    }
    
    /**
     * Receive data from scene transition
     * @param {Object} data - Data passed from previous scene
     */
    init(data) {
        console.log("MenuScene init with data:", data);
        
        // Check for force transition flag
        const forceMenuTransition = localStorage.getItem('forceMenuTransition');
        if (forceMenuTransition === 'true') {
            console.log("⚠️ DETECTED FORCE MENU TRANSITION FLAG - PERFORMING HARD RESET");
            localStorage.removeItem('forceMenuTransition');
            localStorage.removeItem('forceHardRefresh');
            
            // Mark as restarting regardless of data
            this.isRestarting = true;
            
            // Force any cleanups
            this.cleanupPreviousScene();
        }
        // Regular restart check 
        else if (data && data.restart === true) {
            console.log("🔄 Handling restart from GameScene");
            this.isRestarting = true;
        } else {
            this.isRestarting = false;
        }
        
        // Always clear any existing dropdown to prevent duplicates
        if (this.dropdown) {
            console.log("Removing existing dropdown");
            this.dropdown.remove();
            this.dropdown = null;
        }
    }
    
    /**
     * Special method to ensure clean transitions
     */
    cleanupPreviousScene() {
        try {
            console.log("🧹 Performing emergency scene cleanup");
            
            // Stop any running game scenes
            if (this.scene.get('GameScene')) {
                this.scene.stop('GameScene');
            }
            
            // Clear game cache if needed
            // Only clear non-essential caches to avoid asset reloads
            
            // Reset any global state
            this.game.events.removeAllListeners();
        } catch (error) {
            console.error("Error during scene cleanup:", error);
        }
    }

    preload() {
        // Store reference to game dimensions for relative positioning
        this.gameWidth = this.sys.game.config.width;
        this.gameHeight = this.sys.game.config.height;
        console.log(`Menu dimensions: ${this.gameWidth}x${this.gameHeight}`);
        
        // Create a loading indicator
        this.loadingText = this.add.text(this.gameWidth / 2, this.gameHeight / 2, 'Loading assets...', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Set up loading progress indicator
        this.load.on('progress', (value) => {
            this.loadingText.setText(`Loading: ${Math.floor(value * 100)}%`);
        });
        
        this.load.on('complete', () => {
            console.log('All assets loaded successfully');
            
            // Set text based on whether we're restarting
            if (this.isRestarting) {
                this.loadingText.setText('Returning to menu...');
            } else {
                this.loadingText.setText('Loading songs...');
            }
            
            // Only fetch songs after assets are loaded
            this.loadSongs();
        });
        
        // Skip reloading assets if we're restarting
        if (!this.isRestarting && !this.textures.exists('menu-background')) {
            // Load background image and welcome sound
            this.load.image('menu-background', 'assets/images/reactodws.png');
            this.load.audio('welcome-sound', 'assets/soundfx/welcome2reactod.mp3');
        } else if (this.isRestarting) {
            // If restarting, trigger complete immediately
            this.load.start();
        }
    }

    async loadSongs() {
        try {
            // Use a relative URL which will work with any port
            const response = await fetch("/songs");
            const data = await response.json();
            
            if (data.songs && data.songs.length > 0) {
                this.songs = data.songs;
                this.selectedSong = this.songs[0]; // Default to first song
                this.createMenu();
            } else {
                console.error("No songs found.");
                this.add.text(this.gameWidth / 2, this.gameHeight / 2 + 50, 'No songs available!', {
                    fontSize: '20px',
                    color: '#ff0000'
                }).setOrigin(0.5);
                // Still create menu to allow uploading songs even with no songs available
                this.createMenu();
            }
        } catch (error) {
            console.error("Error fetching songs:", error);
            this.add.text(this.gameWidth / 2, this.gameHeight / 2 + 50, 'Error fetching songs!', {
                fontSize: '20px',
                color: '#ff0000'
            }).setOrigin(0.5);
            // Still create menu to allow uploading songs even if fetching fails
            this.createMenu();
        }
    }

    createMenu() {
        this.children.removeAll();

        // Ensure loading text is properly cleaned up
        if (this.loadingText) {
            this.loadingText.destroy();
            this.loadingText = null;
        }

        // Note: Texture creation moved to GameScene to avoid conflicts with MusicWorm graphics
        
        // Add background image
        const background = this.add.image(this.gameWidth / 2, this.gameHeight / 2, 'menu-background')
            .setDisplaySize(this.gameWidth, this.gameHeight);
            
        // Store welcome sound flag but don't play yet due to browser autoplay policies
        this.welcomeSoundPlayed = false;
        this.welcomeSoundReady = this.cache.audio.exists('welcome-sound');
        
        if (!this.welcomeSoundReady) {
            console.warn("Welcome sound not loaded yet");
        }
        
        // Create a dropdown (HTML select element) for song selection
        this.dropdown = document.createElement('select');
        this.dropdown.style.position = 'absolute';
        this.dropdown.style.left = '50%';
        this.dropdown.style.top = '40%';
        this.dropdown.style.transform = 'translate(-50%, -50%)';
        this.dropdown.style.fontSize = '20px';
        this.dropdown.style.padding = '5px';
        this.dropdown.style.backgroundColor = '#222';
        this.dropdown.style.color = '#00bfff'; // Changed to cyan to match background
        this.dropdown.style.minWidth = '300px'; // Make dropdown wider
        
        // Populate dropdown with song options
        this.songs.forEach((song, index) => {
            const option = document.createElement('option');
            option.value = index;
            
            // Just show artist and title without debug info
            let optionText = `${song.artist} - ${song.title}`;
            option.textContent = optionText;
            
            this.dropdown.appendChild(option);
        });

        // Append dropdown to game container
        this.game.canvas.parentNode.appendChild(this.dropdown);

        // Update selected song when dropdown changes
        this.dropdown.addEventListener('change', (event) => {
            this.selectedSong = this.songs[event.target.value];
            this.playWelcomeSoundOnce();
        });

        // Also try to play welcome sound on first dropdown interaction
        this.dropdown.addEventListener('focus', () => {
            this.playWelcomeSoundOnce();
        });

        this.dropdown.addEventListener('click', () => {
            this.playWelcomeSoundOnce();
        });

        // Create buttons container
        const buttonsContainer = this.add.container(this.gameWidth / 2, this.gameHeight / 2 + 50);

        // Create play button
        const playButton = this.add.text(0, 0, 'Click to Start', {
            fontSize: '24px',
            color: '#00bfff', // Changed to cyan to match background
            backgroundColor: '#222222',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        playButton.on('pointerdown', () => {
            this.startGame(); // Call startGame instead of directly starting the scene
        });
        
        // Add buttons to container
        buttonsContainer.add([playButton]);
        
        // Add upload button
        const uploadButton = this.add.text(
            this.gameWidth / 2, 
            this.gameHeight / 2 + 140, // Position below high scores button
            'Upload New Song', 
            {
                fontSize: '24px',
                color: '#ff9900', // Changed to orange to match background
                backgroundColor: '#222222',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5).setInteractive();

        uploadButton.on('pointerdown', () => {
            this.createUploadForm();
        });

        // Update the bottom text to remove "Music visualization game"
        this.add.text(this.gameWidth / 2, this.gameHeight - 50, 'Use arrow keys to move • E for special attack', {
            fontSize: '16px',
            color: '#00bfff' // Changed to cyan to match background
        }).setOrigin(0.5);

        this.createMenuParticles();
    }
    
    playWelcomeSoundOnce() {
        // Only play if we haven't played it yet and it's ready
        if (!this.welcomeSoundPlayed && this.welcomeSoundReady) {
            try {
                this.sound.play('welcome-sound');
                this.welcomeSoundPlayed = true;
                console.log("🎵 Welcome sound played after user interaction");
            } catch (error) {
                console.warn("Could not play welcome sound:", error);
            }
        }
    }
    
    startGame() {
        if (this.selectedSong) {
            console.log(`🎮 Starting game with song: ${this.selectedSong.title}`);
    
            // Remove dropdown from DOM
            if (this.dropdown) {
                this.dropdown.remove();
                console.log("✅ Dropdown removed!");
            }
    
            // Transition to GameScene with the selected song data
            this.scene.start('GameScene', { songData: this.selectedSong });
        } else {
            console.error("❌ No song selected!");
        }
    }
    
    shutdown() {
        // Clean up on scene shutdown
        if (this.dropdown) {
            this.dropdown.remove();
            this.dropdown = null;
        }
    }
    
    createMenuParticles() {
        // Create a particle texture dynamically
        const particleTexture = this.createParticleTexture();
        
        const particles = this.add.particles(this.gameWidth / 2, this.gameHeight / 2, particleTexture, {
            lifespan: 3000,
            speed: { min: 50, max: 150 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            blendMode: 'ADD',
            emitting: true,
            emitZone: {
                type: 'random',
                source: new Phaser.Geom.Rectangle(-this.gameWidth/2, -this.gameHeight/2, this.gameWidth, this.gameHeight),
                quantity: 20
            }
        });
    }
    
    /**
     * Create a particle texture at runtime
     * @returns {Phaser.Textures.Texture} - The created particle texture
     */
    createParticleTexture() {
        const size = 16;
        const textureKey = 'menu-particle';
        
        // Check if the texture already exists
        if (this.textures.exists(textureKey)) {
            return this.textures.get(textureKey);
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
        gradient.addColorStop(0.5, 'rgba(100, 200, 255, 0.7)');
        gradient.addColorStop(1, 'rgba(0, 100, 200, 0)');
        
        // Draw the particle
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Add the texture to the game
        this.textures.addCanvas(textureKey, canvas);
        
        return this.textures.get(textureKey);
    }
    
    createUploadForm() {
        // Create hidden file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.mp3';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        // Clean up previous status text if it exists
        if (this.statusText) {
            this.statusText.destroy();
        }
        
        // Create upload status text
        this.statusText = this.add.text(
            this.gameWidth / 2,
            this.gameHeight / 2 + 180,
            'Select an MP3 file to upload...',
            {
                fontSize: '18px',
                color: '#ffffff'
            }
        ).setOrigin(0.5);
        
        // When file is selected
        fileInput.onchange = async (event) => {
            if (!fileInput.files || fileInput.files.length === 0) return;
            
            const file = fileInput.files[0];
            this.statusText.setText(`Uploading ${file.name}...`);
            
            // Create FormData
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                // Upload the file - use relative URL for port-agnostic access
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    this.statusText.setText(`Upload complete! Processing ${file.name}...`);
                    this.statusText.setColor('#7700aa'); // Change to darker purple for better readability
                    this.statusText.setShadow(0, 0, '#cc44ff', 8); // Add glowing effect
                    this.statusText.setStroke('#ffffff', 1); // Add white stroke for better contrast
                    
                    // Debug/processing log link removed as requested
                    
                    // Create a progress indicator with a processing message
                    // that will automatically refresh the song list after 10 seconds
                    this.time.delayedCall(10000, () => {
                        this.statusText.setText('Refreshing song list...');
                        this.loadSongs();
                        
                        // Remove status after another delay
                        this.time.delayedCall(2000, () => {
                            if (this.statusText) {
                                this.statusText.destroy();
                                this.statusText = null;
                            }
                        });
                    });
                } else {
                    this.statusText.setText(`Error: ${result.error}`);
                    
                    // Remove error message after delay
                    this.time.delayedCall(5000, () => {
                        if (this.statusText) {
                            this.statusText.destroy();
                            this.statusText = null;
                        }
                    });
                }
            } catch (error) {
                this.statusText.setText(`Upload failed: ${error.message}`);
                
                // Remove error message after delay
                this.time.delayedCall(5000, () => {
                    if (this.statusText) {
                        this.statusText.destroy();
                        this.statusText = null;
                    }
                });
            }
            
            // Clean up
            document.body.removeChild(fileInput);
        };
        
        // Trigger file selection dialog
        fileInput.click();
    }
}
