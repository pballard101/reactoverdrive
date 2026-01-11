// GameScene.js - With specific bullet-enemy collision fix and high score system
import Player from '../entities/Player.js';
import EnemyManager from '../entities/EnemyManager.js';
import GrubTerminator from '../entities/GrubTerminator.js';
import AudioAnalyzer from '../systems/AudioAnalyzer.js';
import AuthoredLevelPlayer from '../systems/AuthoredLevelPlayer.js';
import ParticleSystem from '../systems/ParticleSystem.js';
import UIManager from '../systems/UIManager.js';
import PowerupManager from '../systems/PowerupManager.js';
import TextureManager from '../utils/TextureManager.js';
import SoundManager from '../systems/SoundManager.js';
import CameraManager from '../systems/CameraManager.js';
import HighScoreManager from '../utils/HighScoreManager.js';
import HighScoreDisplay from '../ui/HighScoreDisplay.js';
import InitialsInput from '../ui/InitialsInput.js';
import PauseMenu from '../ui/PauseMenu.js';
import Commentator from '../systems/Commentator.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.isGameStarted = false;
        this.isGameOver = false;
        this.score = 0;
        this.showingHighScores = false;
        this.enteringInitials = false;
        this.highScoreStartPanel = null; // Added to track the high score panel
    }

    init(data) {

        if (data && data.songData) {
            this.songData = data.songData;
        } else {
            console.error("❌ No song data received!");
        }
    }

    preload() {
        console.log("🔧 GameScene.preload() called - songData:", this.songData ? "present" : "MISSING");
        if (this.songData) {
            const basePath = this.songData.path;
            const filename = this.songData.filename;

            console.log("🎵 GameScene.preload() - Loading song:", {
                title: this.songData.title,
                artist: this.songData.artist,
                basePath: basePath,
                filename: filename
            });

            // Extract base filename (without extension)
            const baseFilename = filename.replace('.mp3', '');

            // Check if basePath already includes the full file path (for processed songs)
            const isFullPath = basePath.endsWith('.mp3');

            // Construct paths based on whether we have a full path or directory path
            const audioPath = isFullPath ? basePath : `${basePath}/${filename}`;

            // For analysis file, if we have a full path, get the directory
            const analysisBasePath = isFullPath ? basePath.substring(0, basePath.lastIndexOf('/')) : basePath;
            const analysisFile = `${baseFilename}_analysis.json`;
            const jsonPath = `${analysisBasePath}/${analysisFile}`;

            // Authored level file path
            const levelFile = `${baseFilename}.level.json`;
            const levelPath = `${analysisBasePath}/${levelFile}`;

            console.log("📊 Computed paths:", {
                audioPath: audioPath,
                jsonPath: jsonPath,
                levelPath: levelPath,
                isFullPath: isFullPath
            });

            // Queue audio, analysis JSON, and level JSON for loading
            console.log("📦 Queueing audio file:", audioPath);
            this.load.audio('music', audioPath);

            console.log("📦 Queueing JSON file:", jsonPath);
            this.load.json('audioData', jsonPath);

            // Try to load authored level file (optional - may not exist for all songs)
            console.log("📦 Queueing level file:", levelPath);
            this.load.json('authoredLevel', levelPath);

            // Add loaders with better error handling
            this.load.on('filecomplete-audio-music', (key, type, data) => {
                console.log("✅ Audio loaded successfully:", key);
            });

            this.load.on('filecomplete-json-audioData', (key, type, data) => {
                console.log("✅ JSON loaded successfully! Keys:", Object.keys(data));
                console.log("   - Beats:", data.beats ? data.beats.length : 0);
                console.log("   - Segments:", data.segments ? data.segments.length : 0);
                this.audioData = data;
            });

            this.load.on('filecomplete-json-authoredLevel', (key, type, data) => {
                console.log("✅ Authored level loaded successfully!");
                console.log("   - Spawn events:", data.spawn_events ? data.spawn_events.length : 0);
                console.log("   - Sections:", data.sections ? data.sections.length : 0);
                console.log("   - Drops:", data.drops ? data.drops.length : 0);
            });

            // Add error handlers for the file loads
            this.load.on('loaderror', (fileObj) => {
                // Only log errors for critical files, not optional ones
                if (fileObj.key !== 'authoredLevel') {
                    console.error(`❌ LOADER ERROR:`, {
                        key: fileObj.key,
                        url: fileObj.url,
                        type: fileObj.type
                    });
                }
            });

            this.load.once('complete', () => {
                console.log("🏁 Phaser loader complete");
                console.log("   - Audio in cache:", this.cache.audio.exists('music'));
                console.log("   - JSON in cache:", this.cache.json.exists('audioData'));
                console.log("   - Level in cache:", this.cache.json.exists('authoredLevel'));

                if (this.cache.json.exists('audioData')) {
                    this.audioData = this.cache.json.get('audioData');
                    console.log("✅ Retrieved audioData from cache");
                } else {
                    console.error(`❌ audioData not found in cache after load completed!`);
                    console.error("   The JSON file failed to load");
                }

                // Store authored level data for later use in create()
                if (this.cache.json.exists('authoredLevel')) {
                    this.authoredLevelData = this.cache.json.get('authoredLevel');
                    console.log("✅ Retrieved authoredLevel from cache");
                }
            });

            // Phaser automatically starts the loader after preload() completes
            // and waits for all files to load before calling create()
            console.log("🚀 Files queued for loading (Phaser will start automatically)");
        } else {
            console.error("❌ No song data provided to GameScene");
        }
    }
    
    create() {
        
        // Store reference to game dimensions for relative positioning
        this.gameWidth = this.sys.game.config.width;
        this.gameHeight = this.sys.game.config.height;
        
        // Set physics world bounds to match game dimensions
        this.physics.world.setBounds(0, 0, this.gameWidth, this.gameHeight);
        
        // Initialize camera manager to prevent drift
        this.cameraManager = new CameraManager(this);
        
        // Initialize high score manager
        this.highScoreManager = new HighScoreManager(this);
        
        // Initialize high score display
        this.highScoreDisplay = new HighScoreDisplay(this);
        
        // Set up a more robust callback when high scores are dismissed
        this.highScoreDisplay.setHiddenCallback(() => {
            console.log(`🎯 HighScore hidden callback fired! isGameOver=${this.isGameOver}, enteringInitials=${this.enteringInitials}`);

            this.showingHighScores = false;

            // If the game is over and we're not entering initials,
            // explicitly return to the menu
            if (this.isGameOver && !this.enteringInitials) {
                console.log("✅ Conditions met - calling returnToMenu in 100ms");

                // Use a short delay to allow any lingering animations to complete
                this.time.delayedCall(100, () => {
                    this.returnToMenu();
                });
            } else {
                console.log("❌ Conditions NOT met - not calling returnToMenu");
            }
        });
        
        // Initialize initials input
        this.initialsInput = new InitialsInput(this);
    
        // Create a basic audio data if none is found or when loading fails
        if (!this.audioData) {
            
            // Create a more substantial dummy data for better gameplay without analysis
            const estimatedDuration = 240; // 4 minutes default
            const dummyBeats = [];
            const dummySegments = [];
            
            // Generate dummy beats every 0.5 seconds
            for (let i = 0; i < estimatedDuration; i += 0.5) {
                dummyBeats.push({ time: i, strength: 0.5 + (Math.random() * 0.3) });
            }
            
            // Generate segments for structure
            dummySegments.push({ type: 'intro', start: 0, end: 30 });
            dummySegments.push({ type: 'verse', start: 30, end: 60 });
            dummySegments.push({ type: 'chorus', start: 60, end: 90 });
            dummySegments.push({ type: 'verse', start: 90, end: 120 });
            dummySegments.push({ type: 'chorus', start: 120, end: 150 });
            dummySegments.push({ type: 'bridge', start: 150, end: 180 });
            dummySegments.push({ type: 'chorus', start: 180, end: 210 });
            dummySegments.push({ type: 'outro', start: 210, end: estimatedDuration });
            
            this.audioData = {
                beats: dummyBeats,
                segments: dummySegments,
                metadata: { 
                    duration: estimatedDuration,
                    title: this.songData ? this.songData.title : "Unknown Song",
                    artist: this.songData ? this.songData.artist : "Unknown Artist"
                }
            };
            
        }

        // Set default game values
        this.playerHealth = 100;
        this.playerEnergy = 25;
        this.playerGunPowerLevel = 1;
        this.score = 0;
        
        // Initialize texture manager
        this.textureManager = new TextureManager(this);
        this.textureManager.createAllTextures();
        
        // Initialize particle system
        this.particleSystem = new ParticleSystem(this);
        
        // Initialize background particles
        this.particleSystem.createBackgroundParticles();
        
        // CRUCIAL: Create bullets group WITH PHYSICS
        this.bullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 30
        });
        
        // EXPLICITLY CREATE SPRITE FOR PLAYER
        const playerSprite = this.physics.add.sprite(
            this.gameWidth * 0.2,  // Position at 20% of screen width (left side)
            this.gameHeight / 2, // Center vertically
            'player-ship'
        );
        playerSprite.setCollideWorldBounds(true);
        
        // No rotation needed as texture now faces right
        
        // Now create the player with the existing sprite
        this.player = new Player(this, playerSprite.x, playerSprite.y, playerSprite);
        
        // Create UI manager AFTER player is created
        this.uiManager = new UIManager(this);
        
        // Create pause menu FIRST so settings are loaded before audio systems
        this.pauseMenu = new PauseMenu(this);

        // Create enemy manager
        this.enemyManager = new EnemyManager(this);

        // Create powerup manager
        this.powerupManager = new PowerupManager(this);

        // Create Grub Terminator companion
        this.grubTerminator = new GrubTerminator(this);
        
            // Create audio analyzer
            this.audioAnalyzer = new AudioAnalyzer(this);
            
            // Ensure the audioData will be updated when it's fully loaded
            if (this.cache.json.exists('audioData')) {
                this.audioData = this.cache.json.get('audioData');
                // Make sure we update the analyzer with fresh data
                if (this.audioData && this.audioAnalyzer) {
                    this.audioAnalyzer.updateAudioData(this.audioData);
                }
            } else {
                // Add a load complete listener to update AudioAnalyzer when data is ready
                this.load.once('complete', () => {
                    if (this.cache.json.exists('audioData')) {
                        this.audioData = this.cache.json.get('audioData');
                        if (this.audioData && this.audioAnalyzer) {
                            this.audioAnalyzer.updateAudioData(this.audioData);
                        }
                    }
                });
            }
        
        // Create sound manager
        this.soundManager = new SoundManager(this);

        // Create commentator
        this.commentator = new Commentator(this);

        // Create authored level player for pre-authored levels
        this.authoredLevelPlayer = new AuthoredLevelPlayer(this);

        // Load authored level data - check cache directly since preload callbacks may not have run yet
        if (!this.authoredLevelData && this.cache.json.exists('authoredLevel')) {
            this.authoredLevelData = this.cache.json.get('authoredLevel');
            console.log("✅ Retrieved authoredLevel from cache in create()");
        }

        if (this.authoredLevelData) {
            const loaded = this.authoredLevelPlayer.loadLevel(this.authoredLevelData);
            if (loaded) {
                console.log("🎮 Using AUTHORED level for deterministic spawning");
                console.log("   - Spawn events:", this.authoredLevelData.spawn_events?.length || 0);
            }
        } else {
            console.log("📝 No authored level found - using real-time audio analysis for spawning");
        }

        // Setup controls
        this.setupControls();
        
        // Set up cleanup timer for off-screen enemies
        this.setupCleanupTimer();
        
        // Create start button
        this.createStartButton();
    }
    
    setupCleanupTimer() {
        // Create a timer that periodically checks for off-screen enemies
        this.cleanupTimer = this.time.addEvent({
            delay: 1000, // Check every second
            callback: this.cleanupOffscreenEnemies,
            callbackScope: this,
            loop: true
        });
    }
    
    cleanupOffscreenEnemies() {
        // Count how many enemies were cleaned up
        let cleanupCount = 0;
        
        // Calculate margins based on game dimensions
        const margin = 50;
        const maxY = this.gameHeight + margin;
        const minY = -margin;
        const maxX = this.gameWidth + margin;
        const minX = -margin;
        
        // Check all game objects for enemies that are off-screen
        this.children.list.forEach(obj => {
            // Only check objects with enemyType that are not hexagons or powerups
            if (obj.enemyType && 
                obj.enemyType !== 'hexagon' && 
                obj.enemyType !== 'powerupHex' && 
                obj.active) {
                
                // Check if the object is far off-screen (with a generous margin)
                if (obj.y > maxY || obj.y < minY || obj.x > maxX || obj.x < minX) {
                    if (this.enemyManager && typeof this.enemyManager.destroyEnemy === 'function') {
                        this.enemyManager.destroyEnemy(obj);
                    } else {
                        obj.destroy();
                    }
                    cleanupCount++;
                }
            }
        });
        
    }
    
    createStartButton() {
        // Create an overlay to dim the entire screen except for the high scores
        const dimOverlay = this.add.rectangle(
            this.gameWidth / 2,
            this.gameHeight / 2,
            this.gameWidth,
            this.gameHeight,
            0x000000,
            0.6  // Dimming effect for the entire screen
        );
        
        // Create container to hold everything we'll show in the start screen
        this.startContainer = this.add.container(0, 0);
        this.startContainer.add(dimOverlay);
        
        // Load high scores using the song filename as the ID
        if (this.songData && this.songData.filename) {
            // Extract the song ID without the extension (to match server format)
            // Handle both .mp3 and filenames without extensions
            const songId = this.songData.filename.includes('.') ? 
                this.songData.filename.substring(0, this.songData.filename.lastIndexOf('.')) :
                this.songData.filename;
            
            this.highScoreManager.getHighScores(songId).then(() => {
                // Show the high scores in the background while loading
                this.showHighScoresOnStart();
            }).catch(error => {
                console.error("Error loading high scores:", error);
                // Try to show high scores anyway using mock data
                this.showHighScoresOnStart();
            });
        }
        
        // The start button will be added inside the showHighScoresOnStart method
        // We'll store the button text and state for later use
        this.startButtonReady = this.cache.audio.exists('music');
        this.startButtonText = this.startButtonReady ? 
            'CLICK TO START' : 
            'LOADING SONG...';
        
        // Add song title if available
        if (this.songData) {
            const titleText = this.add.text(
                this.gameWidth / 2,
                this.gameHeight * 0.15,
                this.songData.title || "Unknown Song",
                {
                    fontSize: '36px',
                    fontStyle: 'bold',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 4
                }
            ).setOrigin(0.5);
            
            // Add artist name if available
            const artistText = this.add.text(
                this.gameWidth / 2,
                this.gameHeight * 0.15 + 40,
                this.songData.artist || "",
                {
                    fontSize: '24px',
                    color: '#aaaaaa'
                }
            ).setOrigin(0.5);
            
            this.startContainer.add([titleText, artistText]);
        }
        
        // Show the high scores and start button immediately if we already know the stats
        if (this.highScoreManager.currentScores) {
            this.showHighScoresOnStart();
        }
        
        // Setup audio load listener if not already loaded
        if (!this.startButtonReady) {
            this.load.on('complete', this.enableStartButtonWhenReady, this);
        }
    }
    
    /**
     * Show high scores on the start screen
     */
    showHighScoresOnStart() {
        if (!this.startContainer) return;
        
        // Get scores from manager or use empty array
        const scores = (this.highScoreManager && this.highScoreManager.currentScores) 
            ? this.highScoreManager.currentScores 
            : [];
            
        // Attempt to load scores from server in background
        if (this.highScoreManager && this.songData) {
            // Handle both .mp3 and filenames without extensions
            const songId = this.songData.filename.includes('.') ? 
                this.songData.filename.substring(0, this.songData.filename.lastIndexOf('.')) :
                this.songData.filename;
            this.highScoreManager.getHighScores(songId, true).catch(err => console.warn(err));
        }
        
        // Create a high scores list in a compact format
        const scoreListHeight = Math.min(scores.length * 30, 250);
        
        // Make the panel larger to accommodate the start button
        const panelHeight = scoreListHeight + 140; // Extra space for button
        const scorePanel = this.add.container(this.gameWidth / 2, this.gameHeight / 2 - 40);
        
        // Add background for scores (fully opaque)
        const bg = this.add.rectangle(
            0, 0,
            350, panelHeight,
            0x000000, 1.0 // Full opacity for the score panel
        ).setStrokeStyle(2, 0x00bfff);
        
        // Add glow effect to the score panel
        this.addGlowEffect(bg);
        
        scorePanel.add(bg);
        
        // Add heading
        const heading = this.add.text(
            0, -scoreListHeight/2 - 20,
            'HIGH SCORES',
            {
                fontSize: '24px',
                fontStyle: 'bold',
                color: '#00bfff',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        
        scorePanel.add(heading);
        
        // Add scores or "no scores" message
        if (scores.length === 0) {
            const noScoresText = this.add.text(
                0, 0,
                'No scores yet.\nBe the first!',
                {
                    fontSize: '18px',
                    color: '#ffffff',
                    align: 'center'
                }
            ).setOrigin(0.5);
            
            scorePanel.add(noScoresText);
        } else {
            // Only show top 5 scores in the start screen to save space
            const displayScores = scores.slice(0, 5);
            
            displayScores.forEach((score, index) => {
                const y = -scoreListHeight/2 + 20 + (index * 30);
                const isTop3 = index < 3;
                
                // Rank with medal for top 3
                let rankPrefix = '';
                if (index === 0) rankPrefix = '🥇 ';
                else if (index === 1) rankPrefix = '🥈 ';
                else if (index === 2) rankPrefix = '🥉 ';
                
                const rankText = this.add.text(
                    -150, y,
                    `${rankPrefix}${index + 1}`,
                    {
                        fontSize: '18px',
                        color: isTop3 ? '#ffffff' : '#aaaaaa'
                    }
                ).setOrigin(0.5);
                
                // Initials
                const initialsText = this.add.text(
                    -80, y,
                    score.initials,
                    {
                        fontSize: '18px',
                        color: isTop3 ? '#ffffff' : '#aaaaaa',
                        fontStyle: isTop3 ? 'bold' : 'normal'
                    }
                ).setOrigin(0.5);
                
                // Score
                const formattedScore = score.score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                const scoreText = this.add.text(
                    50, y,
                    formattedScore,
                    {
                        fontSize: '18px',
                        color: isTop3 ? '#ffffff' : '#aaaaaa',
                        fontStyle: isTop3 ? 'bold' : 'normal'
                    }
                ).setOrigin(0.5);
                
                scorePanel.add([rankText, initialsText, scoreText]);
            });
            
            // Add "See More" text if there are more than 5 scores
            if (scores.length > 5) {
                const moreText = this.add.text(
                    0, scoreListHeight/2 + 10,
                    `+ ${scores.length - 5} more scores`,
                    {
                        fontSize: '16px',
                        color: '#aaaaaa',
                        fontStyle: 'italic'
                    }
                ).setOrigin(0.5);
                
                scorePanel.add(moreText);
            }
        }
        
        // Create a start button inside the high score panel
        const buttonColor = this.startButtonReady ? 
            '#00ff00' : // Green when ready
            '#888888'; // Gray when loading
            
        const startButton = this.add.text(
            0, // Center in the score panel 
            scoreListHeight/2 + 70, // Position below the scores
            this.startButtonText, 
            {
                fontSize: '32px',
                fontStyle: 'bold',
                color: buttonColor,
                backgroundColor: '#333333',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5);
        
        scorePanel.add(startButton);
        
        // Only make it interactive if audio is loaded
        if (this.startButtonReady) {
            startButton.setInteractive();
            
            startButton.on('pointerdown', () => {
                
                // Immediately destroy the start container
                if (this.startContainer) {
                    this.startContainer.destroy();
                    this.startContainer = null;
                }
                
                // Also destroy the high score panel which is separate from the container
                if (this.highScoreStartPanel) {
                    this.highScoreStartPanel.destroy();
                    this.highScoreStartPanel = null;
                }
                
                // First mark panels for destruction
                if (this.startContainer) {
                    this.startContainer.destroy();
                    this.startContainer = null;
                }
                
                if (this.highScoreStartPanel) {
                    this.highScoreStartPanel.destroy();
                    this.highScoreStartPanel = null;
                }
                
                // Do a full scene cleanup and start game
                this.time.delayedCall(100, () => {
                    // Force removal of any UI elements that might still be visible
                    const uiElements = this.children.list.filter(obj => 
                        obj.type === 'Text' || 
                        obj.type === 'Container' || 
                        obj.type === 'Rectangle'
                    );
                    
                    // Destroy any UI elements with high depth values
                    uiElements.forEach(element => {
                        if (element.depth > 100 || element.text === 'LOADING SONG...') {
                            element.destroy();
                        }
                    });
                    
                    this.beginGame();
                });
            });
            
            // Add a pulsing effect for the active button
            this.tweens.add({
                targets: startButton,
                scale: 1.1,
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        } else {
            // Store reference to update later when audio loads
            this.startButton = startButton;
            
            // Add a subtle pulsing effect for the loading button
            this.tweens.add({
                targets: startButton,
                alpha: 0.7,
                duration: 1200,
                yoyo: true,
                repeat: -1
            });
            
            // Setup audio load listener if not already loaded
            this.load.on('complete', this.enableStartButtonWhenReady, this);
        }
        
        // Do NOT add panel to start container - add it directly to the scene
        // This makes it appear ABOVE the dimming overlay
        // Set a high depth value to ensure it's above all other elements
        scorePanel.setDepth(1001);
        
        // Store a reference to the score panel so we can destroy it later
        this.highScoreStartPanel = scorePanel;
        
        // NOTE: We intentionally DON'T add to startContainer so it stays above the dimming effect
        
        // Add a subtle floating animation to the panel
        this.tweens.add({
            targets: scorePanel,
            y: scorePanel.y + 5,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    
    /**
     * Add glow effect to an object
     */
    addGlowEffect(object) {
        // Create a mask for the glow effect
        const glowMask = this.make.graphics();
        glowMask.fillStyle(0xffffff);
        glowMask.fillRect(
            object.x - object.width/2 - 10,
            object.y - object.height/2 - 10,
            object.width + 20,
            object.height + 20
        );
        
        // Create a glow effect using post-processing (if available)
        if (this.renderer.type === Phaser.WEBGL && this.cameras.main.postFX) {
            try {
                // Add a bloom effect to the camera for the glow
                this.cameras.main.postFX.addBloom(0x00bfff, 0.2, 0.2, 0.7);
            } catch (error) {
                console.warn("Could not add bloom effect:", error);
            }
        }
    }
    
    /**
     * Enables the start button when audio is fully loaded
     */
    enableStartButtonWhenReady() {
        if (!this.startButton) return;
        
        // Check if audio is now loaded
        if (this.cache.audio.exists('music')) {
            
            // Update button appearance
            this.startButton.setText('CLICK TO START');
            this.startButton.setColor('#00ff00');
            this.startButton.setInteractive();
            
            // Clear the loading animation
            this.tweens.killTweensOf(this.startButton);
            
            // Add the active button animation
            this.tweens.add({
                targets: this.startButton,
                scale: 1.1,
                alpha: 1,
                duration: 800,
                yoyo: true,
                repeat: -1
            });
            
            // Set up click handler
            this.startButton.on('pointerdown', () => {
                
                // Immediately destroy the start container
                if (this.startContainer) {
                    this.startContainer.destroy();
                    this.startContainer = null;
                }
                
                // Also destroy the high score panel which is separate from the container
                if (this.highScoreStartPanel) {
                    this.highScoreStartPanel.destroy();
                    this.highScoreStartPanel = null;
                }
                
                // First mark panels for destruction
                if (this.startContainer) {
                    this.startContainer.destroy();
                    this.startContainer = null;
                }
                
                if (this.highScoreStartPanel) {
                    this.highScoreStartPanel.destroy();
                    this.highScoreStartPanel = null;
                }
                
                // Do a full scene cleanup and start game with audio check if needed
                if (this.sound.context.state === 'suspended') {
                    this.sound.context.resume().then(() => {
                        this.time.delayedCall(100, () => {
                            // Force removal of any UI elements that might still be visible
                            const uiElements = this.children.list.filter(obj => 
                                obj.type === 'Text' || 
                                obj.type === 'Container' || 
                                obj.type === 'Rectangle'
                            );
                            
                            // Destroy any UI elements with high depth values
                            uiElements.forEach(element => {
                                if (element.depth > 100 || element.text === 'LOADING SONG...') {
                                    element.destroy();
                                }
                            });
                            
                            this.beginGame();
                        });
                    }).catch(error => {
                        this.time.delayedCall(100, () => {
                            // Force removal of any UI elements that might still be visible
                            const uiElements = this.children.list.filter(obj => 
                                obj.type === 'Text' || 
                                obj.type === 'Container' || 
                                obj.type === 'Rectangle'
                            );
                            
                            // Destroy any UI elements with high depth values
                            uiElements.forEach(element => {
                                if (element.depth > 100 || element.text === 'LOADING SONG...') {
                                    element.destroy();
                                }
                            });
                            
                            this.beginGame();
                        });
                    });
                } else {
                    this.time.delayedCall(100, () => {
                        // Force removal of any UI elements that might still be visible
                        const uiElements = this.children.list.filter(obj => 
                            obj.type === 'Text' || 
                            obj.type === 'Container' || 
                            obj.type === 'Rectangle'
                        );
                        
                        // Destroy any UI elements with high depth values
                        uiElements.forEach(element => {
                            if (element.depth > 100 || element.text === 'LOADING SONG...') {
                                element.destroy();
                            }
                        });
                        
                        this.beginGame();
                    });
                }
            });
        }
    }
    
    // Helper method to check if a file exists before trying to load it
    checkFileExists(url) {
        return new Promise(resolve => {
            const http = new XMLHttpRequest();
            http.open('HEAD', url);
            http.onreadystatechange = function() {
                if (this.readyState === this.DONE) {
                    resolve(this.status !== 404);
                }
            };
            http.send();
        });
    }
    
    // Try loading audio from the next path in the list
    tryNextAudioPath(paths) {
        if (paths.length === 0) {
            console.error("❌ Tried all audio paths but none worked!");
            return;
        }
        
        const nextPath = paths.shift();
        
        this.checkFileExists(nextPath).then(exists => {
            if (exists) {
                    this.load.audio('music', nextPath);
                this.load.start();
            } else {
                // Try the next path in the list
                this.tryNextAudioPath(paths);
            }
        });
    }
    
    // Try loading analysis data from the next path in the list
    tryNextAnalysisPath(paths) {
        if (paths.length === 0) {
            console.error("❌ Tried all analysis paths but none worked!");
            console.log("⚠️ Will create dummy analysis data when game starts");
            return;
        }
        
        const nextPath = paths.shift();
        
        this.checkFileExists(nextPath).then(exists => {
            if (exists) {
                    this.load.json('audioData', nextPath);
                this.load.start();
            } else {
                // Try the next path in the list
                this.tryNextAnalysisPath(paths);
            }
        });
    }
    
    displayError(errorMessage) {
        console.error(errorMessage);
        
        // Create an error display on screen
        const errorText = this.add.text(
            this.gameWidth / 2, 
            this.gameHeight / 2 - 50, 
            'ERROR', 
            {
                fontSize: '36px',
                fontStyle: 'bold',
                color: '#ff0000',
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5);
        
        // Add details below
        const errorDetails = this.add.text(
            this.gameWidth / 2, 
            this.gameHeight / 2 + 10, 
            errorMessage, 
            {
                fontSize: '18px',
                fontStyle: 'bold',
                color: '#ffffff',
                backgroundColor: '#440000',
                padding: { x: 20, y: 10 },
                wordWrap: { width: this.gameWidth * 0.8 }
            }
        ).setOrigin(0.5);
        
        // Add file path info if available
        if (this.songData) {
            // Show the actual audio path used (handle both full paths and directory paths)
            const displayPath = this.songData.path.endsWith('.mp3')
                ? this.songData.path
                : `${this.songData.path}/${this.songData.filename}`;
            const pathInfo = this.add.text(
                this.gameWidth / 2,
                this.gameHeight / 2 + 80,
                `Path: ${displayPath}`, 
                {
                    fontSize: '14px',
                    color: '#aaaaaa',
                    backgroundColor: '#220000',
                    padding: { x: 10, y: 5 },
                    wordWrap: { width: this.gameWidth * 0.8 }
                }
            ).setOrigin(0.5);
        }
    }
    
    beginGame() {
        if (this.isGameStarted) return;
        
        // Final cleanup of any loading UI elements still visible
        this.children.list.forEach(element => {
            // Target loading messages and high score elements
            if ((element.type === 'Text' && element.text && element.text.includes('LOADING SONG')) ||
                (element.depth > 100)) {
                element.destroy();
            }
        });
        
        this.isGameStarted = true;
        this.gameStartTime = this.time.now;
        
        // Add very minimal vignette effect to camera (much lighter)
        if (this.renderer.type === Phaser.WEBGL) {
            try {
                // Check if postFX is available on the camera
                if (this.cameras.main.postFX) {
                    // Further reduced strength to 0.1 (from 0.3) to make it barely noticeable
                    this.vignetteEffect = this.cameras.main.postFX.addVignette(0.5, 0.5, 0.1, 0.1);
                    this.vignetteColor = 0x000000; // Black tint
                } else {
                    console.warn("PostFX not available on camera, skipping vignette effect");
                    this.vignetteEffect = null;
                }
            } catch (error) {
                console.warn("Error adding vignette effect:", error);
                this.vignetteEffect = null;
            }
        } else {
        }
        
        // Debug: Check if audio is loaded
        
        // Make sure music is actually loaded before initializing audio
        if (!this.cache.audio.exists('music')) {
            const errorMsg = "Music not found in cache! Audio playback impossible.";
            console.error(`❌ ${errorMsg}`);
            this.displayError(errorMsg);
            // Continue with the game without audio
            this.startGame();
        } else {
        // Initialize audio
        try {
            if (this.audioAnalyzer) {
                const success = this.audioAnalyzer.initializeAudio();
                if (!success) {
                    this.displayError("Failed to initialize audio system!");
                } else {
                    // Apply pause menu settings AFTER audio is initialized
                    if (this.pauseMenu) {
                        this.pauseMenu.applySettings();
                    }
                }
            }
        } catch (error) {
            console.error("❌ Error initializing audio:", error);
            this.displayError(`Audio error: ${error.message}`);
        }
        this.startGame();
        }
    }
    
    startGame() {
        
        // Setup player
        if (this.player) {
            
            // Ensure player is active
            this.player.sprite.setActive(true);
            this.player.sprite.setVisible(true);
            
            // Make sure physics is enabled
            if (this.player.sprite.body) {
                this.player.sprite.body.enable = true;
            }
            
            // Setup auto-fire if the method exists
            if (typeof this.player.setupAutoFire === 'function') {
                this.player.setupAutoFire();
            }
        }
        
        // DIRECT BULLET-ENEMY COLLISION SETUP
        this.setupBulletCollisions();
        
        // Start authored level player if we have an authored level
        if (this.authoredLevelPlayer && this.authoredLevelPlayer.hasAuthoredLevel()) {
            console.log("🎮 Starting authored level playback");
            this.authoredLevelPlayer.start();
            // Skip initial enemy spawn - authored level handles all spawning
        } else {
            // Fallback: Initial enemy spawn (only when not using authored level)
            if (this.enemyManager && typeof this.enemyManager.spawnEnemy === 'function') {
                this.enemyManager.spawnEnemy(0.5);
            }
        }

        // Initial powerup
        if (this.powerupManager && typeof this.powerupManager.spawnPowerupHex === 'function') {
            this.powerupManager.spawnPowerupHex();
        }

        // Start static powerup spawner
        if (this.powerupManager && typeof this.powerupManager.startStaticPowerupSpawner === 'function') {
            this.powerupManager.startStaticPowerupSpawner();
        }

        // Initialize score
        this.score = 0;
        if (this.uiManager) {
            this.uiManager.updateScore(this.score);
        }
    }
    
    setupBulletCollisions() {
        
        // Instead of using timers or complex updates, we'll set up a direct collision handler
        this.physics.world.on('worldbounds', (body) => {
            // If a bullet hits the world bounds, deactivate it
            if (body.gameObject && this.bullets.contains(body.gameObject)) {
                body.gameObject.setActive(false);
                body.gameObject.setVisible(false);
            }
        });
        
        // Use a continuous overlap check for bullets and ALL enemies
        this.time.addEvent({
            delay: 16, // Check every frame (~60fps) for reliable collision detection
            callback: this.checkBulletCollisions,
            callbackScope: this,
            loop: true
        });
    }
    
    checkBulletCollisions() {
        if (!this.bullets) return;
        
        // Get active bullets
        const activeBullets = this.bullets.getChildren().filter(bullet => bullet.active);
        if (activeBullets.length === 0) return;
        
        // Find all enemies
        const enemies = this.children.list.filter(obj => {
            return obj.enemyType && obj.active && obj.enemyType !== 'hexagon' && obj.enemyType !== 'powerupHex';
        });
        
        if (enemies.length === 0) return;
        
        // Check each bullet against each enemy
        activeBullets.forEach(bullet => {
            // Get bullet bounds once
            const bulletBounds = bullet.getBounds();
            
            enemies.forEach(enemy => {
                // Check for collision
                if (Phaser.Geom.Intersects.RectangleToRectangle(bulletBounds, enemy.getBounds())) {
                    // Handle collision
                    console.log("🎯 Bullet collision detected with", enemy.enemyType, "at bullet pos:", bullet.x, bullet.y, "enemy pos:", enemy.x, enemy.y);

                    // Deactivate bullet
                    bullet.setActive(false);
                    bullet.setVisible(false);

                    // Clean up bullet trail immediately on collision
                    if (bullet.trailEmitter) {
                        // Skip the fade animation and destroy immediately for collisions
                        if (bullet.trailEmitter.graphics && bullet.trailEmitter.graphics.active) {
                            bullet.trailEmitter.graphics.destroy();
                        }
                        bullet.trailEmitter = null;
                    }

                    // Clean up follow event timer
                    if (bullet.followEvent) {
                        bullet.followEvent.remove();
                        bullet.followEvent = null;
                    }
                    
                    // Use enemyManager to destroy the enemy properly
                    if (this.enemyManager && typeof this.enemyManager.destroyEnemy === 'function') {
                        this.enemyManager.destroyEnemy(enemy);
                    } else {
                        // Fallback to direct destroy if needed
                        if (enemy.body) {
                            enemy.body.enable = false;
                        }
                        enemy.destroy();
                    }
                }
            });
        });
    }
    
    addScore(points) {
        // Don't add score if it's locked (song completed)
        if (this.scoreLocked) {
            return;
        }
        
        this.score += points;
        
        // Update score display
        if (this.uiManager && typeof this.uiManager.updateScore === 'function') {
            this.uiManager.updateScore(this.score);
        }
    }

    setupControls() {
        // Set up keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.aKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.dKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.oneKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        
        // Track key press state to avoid multiple toggles on a single press
        this.lastKeyState = {
            one: false,
            escape: false,
            gamepadFire: false,
            gamepadEnergy: false,
            gamepadToggle: false,
            gamepadStart: false,
            gamepadMenu: false
        };
        
        // Set up gamepad controls
        this.setupGamepadControls();
    }
    
    setupGamepadControls() {
        // Initialize gamepad tracking
        this.gamepadConnected = false;
        this.activeGamepad = null;
        
        // Listen for gamepad connection
        this.input.gamepad.on('connected', (pad) => {
            console.log(`Gamepad connected: ${pad.id}`);
            this.gamepadConnected = true;
            this.activeGamepad = pad;
            
            // Show gamepad connected message
            this.showGamepadMessage(`Controller connected: ${pad.id}`);
        });
        
        // Listen for gamepad disconnection
        this.input.gamepad.on('disconnected', (pad) => {
            console.log(`Gamepad disconnected: ${pad.id}`);
            this.gamepadConnected = false;
            this.activeGamepad = null;
            
            // Show gamepad disconnected message
            this.showGamepadMessage('Controller disconnected');
        });
    }
    
    showGamepadMessage(message) {
        // Create text message
        const text = this.add.text(
            this.gameWidth / 2, 
            this.gameHeight - 50, 
            message, 
            {
                fontSize: '18px',
                color: '#00ff00',
                backgroundColor: '#222222',
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5);
        
        // Fade out and remove after 3 seconds
        this.tweens.add({
            targets: text,
            alpha: 0,
            y: this.gameHeight - 40,
            duration: 3000,
            onComplete: () => {
                text.destroy();
            }
        });
    }

    /**
     * Updates the vignette effect with the current color and adds subtle breathing animation
     * Error protected to prevent crashes
     */
    updateVignetteEffect() {
        // Skip vignette updates if the game is over
        if (this.isGameOver || this.showingHighScores) {
            return;
        }
        
        // Handle built-in WebGL vignette if available
        if (this.renderer && this.renderer.type === Phaser.WEBGL) {
            try {
                // Get camera's postFX module and check if it exists
                const camera = this.cameras.main;
                
                // Only proceed if we have a valid FX pipeline
                if (camera && camera.postFX) {
                    // If we don't have a vignette effect reference but FX is supported, create it
                    if (!this.vignetteEffect && typeof camera.postFX.addVignette === 'function') {
                        // Clear any existing effects to avoid duplication
                        camera.postFX.clear();
                        
                        // Create a new vignette effect
                        this.vignetteEffect = camera.postFX.addVignette(0.5, 0.5, 0.7, 0.5);
                        this.vignetteColor = 0x000000; // Changed to black to remove green tint
                    }
                    
                    // If we have a valid vignette effect reference
                    if (this.vignetteEffect) {
                        // Apply current segment color to vignette if available
                        if (this.vignetteColor) {
                            this.vignetteEffect.color = this.vignetteColor;
                        }
                        
                        // Limit update frequency to reduce unnecessary updates
                        if (this.audioAnalyzer && this.time.now % 100 < 16) { // Only update a few times per second
                            // Get audio intensity from analyzer or use default
                            let intensity = 0.5;
                            
                            // Safely access audio data
                            if (this.audioAnalyzer && this.audioAnalyzer.currentBPM && this.gameStartTime) {
                                // Calculate time since last beat
                                const currentTime = (this.time.now - this.gameStartTime) / 1000;
                                const lastBeatTime = this.audioAnalyzer.lastBeatTime || 0;
                                const timeSinceLastBeat = currentTime - lastBeatTime;
                                
                                // Decay factor based on time since last beat
                                const decayFactor = Math.max(0, 1 - (timeSinceLastBeat / 0.5));
                                
                                // Get intensity from audio
                                intensity = 0.3 + (decayFactor * 0.3);
                            }
                            
                            // Apply much more subtle strength changes based on intensity
                            const subtleStrength = 0.2 + (intensity * 0.15); // Range: 0.2 - 0.35 (reduced from 0.5-0.7)
                            this.vignetteEffect.strength = subtleStrength;
                        }
                    }
                }
            } catch (error) {
                // If we get an error, disable vignette effect for future attempts
                console.warn("Error updating built-in vignette effect:", error);
                this.vignetteEffect = null;
            }
        }
        
        // Update custom vignette (as fallback or additional effect)
        if (this.particleSystem && 
            this.particleSystem.customVignette && 
            typeof this.particleSystem.updateCustomVignette === 'function') {
            try {
                // Get audio intensity similar to above
                let intensity = 0.5;
                
                // Safely access audio data
                if (this.audioAnalyzer && this.audioAnalyzer.currentBPM && this.gameStartTime) {
                    const currentTime = (this.time.now - this.gameStartTime) / 1000;
                    const lastBeatTime = this.audioAnalyzer.lastBeatTime || 0;
                    const timeSinceLastBeat = currentTime - lastBeatTime;
                    const decayFactor = Math.max(0, 1 - (timeSinceLastBeat / 0.5));
                    intensity = 0.3 + (decayFactor * 0.3);
                }
                
                // Calculate more subtle strength changes for custom vignette
                const subtleStrength = 0.2 + (intensity * 0.15); // Range: 0.2 - 0.35 (reduced)
                
                // Check if the customVignette array exists
                if (Array.isArray(this.particleSystem.customVignette) && 
                    this.particleSystem.customVignette.length > 0) {
                    
                    // Update the custom vignette with current color and subtle breathing effect
                    this.particleSystem.updateCustomVignette(
                        this.vignetteColor || 0x000000, 
                        subtleStrength, 
                        0.7 // Fixed radius - we'll let the beat handler change this on beats
                    );
                }
            } catch (error) {
                console.warn("Error updating custom vignette effect:", error);
                // Disable custom vignette on error
                if (this.particleSystem) {
                    this.particleSystem.customVignette = null;
                }
            }
        }
    }
    
    update() {
        // Skip if game not started
        if (!this.isGameStarted) return;

        // Calculate current music time
        const currentMusicTime = (this.time.now - this.gameStartTime) / 1000;

        // Update authored level player if using authored level
        // This handles all spawning based on pre-authored events
        if (this.authoredLevelPlayer && this.authoredLevelPlayer.hasAuthoredLevel()) {
            this.authoredLevelPlayer.update(currentMusicTime);
        }

        // Regular update calls - AudioAnalyzer still handles visual effects and beat detection
        if (this.audioAnalyzer) {
            this.audioAnalyzer.update();
        }

        if (this.player && typeof this.player.update === 'function') {
            this.player.update();
        }

        // EnemyManager update handles breathing effects and worm updates
        // When using authored level, spawning is handled by AuthoredLevelPlayer
        if (this.enemyManager && typeof this.enemyManager.update === 'function') {
            this.enemyManager.update();
        }
        
        // Update Grub Terminator companion
        if (this.grubTerminator && typeof this.grubTerminator.update === 'function') {
            this.grubTerminator.update();
        }
        
        // Update Grub Terminator orb in UI
        if (this.uiManager && typeof this.uiManager.updateGrubTerminatorOrb === 'function') {
            this.uiManager.updateGrubTerminatorOrb();
        }

        // Update UI Manager for trippy score effects
        if (this.uiManager && typeof this.uiManager.update === 'function') {
            this.uiManager.update(this.time.now, this.game.loop.delta);
        }

        // Update sound manager
        if (this.soundManager && typeof this.soundManager.update === 'function') {
            this.soundManager.update();
        }
        
        // Update vignette color and subtle breathing animation between beats
        this.updateVignetteEffect();
        
        // Check gamepad input
        this.handleGamepadInput();
        
        // Space key for manual firing
        if (this.spaceKey && this.spaceKey.isDown && this.player && typeof this.player.fireBullet === 'function') {
            this.player.fireBullet();
        }
        
        // Check for ESC key press to toggle pause menu
        if (this.escKey && this.pauseMenu) {
            const escKeyDown = this.escKey.isDown;
            if (escKeyDown && !this.lastKeyState.escape) {
                console.log("🎛️ ESC key pressed - toggling pause menu");
                this.pauseMenu.toggle();
            }
            this.lastKeyState.escape = escKeyDown;
        }
        
        // Check for 1 key press to toggle center circle
        if (this.oneKey && this.particleSystem) {
            // Only toggle when key is first pressed down (not held)
            const oneKeyDown = this.oneKey.isDown;
            if (oneKeyDown && !this.lastKeyState.one && typeof this.particleSystem.toggleCentralParticles === 'function') {
                this.particleSystem.toggleCentralParticles();
            }
            this.lastKeyState.one = oneKeyDown;
        }
        
        // Manage bullets that go off screen
        this.updateBullets();
    }
    
    handleGamepadInput() {
        // If no gamepad is connected or player not available, return
        if (!this.gamepadConnected || !this.activeGamepad || !this.player) return;
        
        const pad = this.activeGamepad;
        
        // Fire bullet with A button or right trigger
        const fireButton = pad.buttons[0].pressed || pad.R2 > 0.5;
        if (fireButton && !this.lastKeyState.gamepadFire && typeof this.player.fireBullet === 'function') {
            this.player.fireBullet();
        }
        this.lastKeyState.gamepadFire = fireButton;
        
        // Activate energy weapon with B button or left trigger when available
        const energyButton = pad.buttons[1].pressed || pad.L2 > 0.5;
        if (energyButton && !this.lastKeyState.gamepadEnergy && 
            this.player.energyFull && !this.player.energyWeaponActive && 
            typeof this.player.activateEnergyWeapon === 'function') {
            this.player.activateEnergyWeapon();
        }
        this.lastKeyState.gamepadEnergy = energyButton;
        
        // Toggle central particles with Y button
        const toggleButton = pad.buttons[3].pressed;
        if (toggleButton && !this.lastKeyState.gamepadToggle && 
            this.particleSystem && typeof this.particleSystem.toggleCentralParticles === 'function') {
            this.particleSystem.toggleCentralParticles();
        }
        this.lastKeyState.gamepadToggle = toggleButton;
        
        // Toggle pause menu with Start button (button 9) or Menu button (button 8)
        const startButton = pad.buttons[9] && pad.buttons[9].pressed;
        const menuButton = pad.buttons[8] && pad.buttons[8].pressed;
        
        if ((startButton && !this.lastKeyState.gamepadStart) || 
            (menuButton && !this.lastKeyState.gamepadMenu)) {
            if (this.pauseMenu) {
                console.log("🎛️ Gamepad pause button pressed - toggling pause menu");
                this.pauseMenu.toggle();
            }
        }
        this.lastKeyState.gamepadStart = startButton;
        this.lastKeyState.gamepadMenu = menuButton;
    }

    updateBullets() {
        if (!this.bullets) return;

        // DEBUG: Confirm our fixes are loaded (remove this after testing)
        if (!this.debugLogged) {
            console.log("✅ Updated updateBullets() with trail cleanup fixes loaded");
            this.debugLogged = true;
        }

        // Define boundaries with margins based on game dimensions
        const margin = 10;
        const maxX = this.gameWidth + margin;
        const maxY = this.gameHeight + margin;

        this.bullets.getChildren().forEach(bullet => {
            // ALWAYS check for orphaned trail graphics, even on inactive bullets
            if (bullet.trailEmitter && bullet.trailEmitter.graphics && bullet.trailEmitter.graphics.active) {
                // If bullet is inactive but trail still exists, clean it up
                if (!bullet.active || !bullet.visible) {
                    console.log("🧹 Cleaning up orphaned trail graphics on inactive bullet");
                    bullet.trailEmitter.graphics.destroy();
                    bullet.trailEmitter = null;
                    if (bullet.followEvent) {
                        bullet.followEvent.remove();
                        bullet.followEvent = null;
                    }
                    return;
                }
            }

            if (bullet.active) {

                // Debug: Check for bullets with zero velocity (stuck bullets)
                if (bullet.body && (bullet.body.velocity.x === 0 && bullet.body.velocity.y === 0)) {
                    console.log("🐛 Found stuck bullet at:", bullet.x, bullet.y, "Age:", this.time.now - bullet.creationTime);

                    // Clean up stuck bullets immediately
                    bullet.setActive(false);
                    bullet.setVisible(false);

                    // Clean up trail immediately
                    if (bullet.trailEmitter) {
                        if (bullet.trailEmitter.graphics && bullet.trailEmitter.graphics.active) {
                            bullet.trailEmitter.graphics.destroy();
                        }
                        bullet.trailEmitter = null;
                    }

                    if (bullet.followEvent) {
                        bullet.followEvent.remove();
                        bullet.followEvent = null;
                    }

                    return; // Skip boundary check for this bullet
                }

                if (bullet.y < -margin || bullet.y > maxY || bullet.x < -margin || bullet.x > maxX) {
                    bullet.setActive(false);
                    bullet.setVisible(false);
                    
                    // Clean up bullet trail if it exists - immediate cleanup for off-screen bullets
                    if (bullet.trailEmitter) {
                        // Skip the fade animation and destroy immediately for off-screen bullets
                        if (bullet.trailEmitter.graphics && bullet.trailEmitter.graphics.active) {
                            bullet.trailEmitter.graphics.destroy();
                        }
                        bullet.trailEmitter = null;
                    }

                    // Clean up follow event timer if it exists
                    if (bullet.followEvent) {
                        bullet.followEvent.remove();
                        bullet.followEvent = null;
                    }
                }
            }
        });
    }

    gameOver() {
        
        if (this.isGameOver) {
            return;
        }
        
        this.isGameOver = true;

        // Reset commentator
        if (this.commentator) {
            this.commentator.reset();
        }

        // Stop audio and cleanup
        if (this.audioAnalyzer) {
            this.audioAnalyzer.cleanup();
        }
        
        // Reset camera position before ending to prevent display issues
        if (this.cameraManager) {
            this.cameraManager.resetCameraPosition();
        }

        // Add game over text - changed to "Song Complete" with green color
        const gameOverText = this.add.text(
            this.gameWidth / 2, 
            this.gameHeight / 2, 
            'SONG COMPLETE', 
            {
                fontSize: '48px',
                fontStyle: 'bold',
                color: '#00ff00',
                stroke: '#000000',
                strokeThickness: 6
            }
        ).setOrigin(0.5);

        // Add final score text
        const scoreText = this.add.text(
            this.gameWidth / 2, 
            this.gameHeight / 2 + 60, 
            `FINAL SCORE: ${this.score}`, 
            {
                fontSize: '32px',
                fontStyle: 'bold',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5);
        
        // Disable player controls
        if (this.player) {
            this.player.disable();
        }
        
        // Lock the score to prevent further updates (let visuals continue)
        this.scoreLocked = true;

        // Add a celebration explosion
        if (this.particleSystem) {
            this.particleSystem.createExplosion(
                this.gameWidth / 2, 
                this.gameHeight / 2, 
                100, 
                0x00ff00 // Green explosion instead of red
            );
        }

        // Brief camera shake
        this.cameras.main.shake(1000, 0.05);
        
        
        // Wait a shorter moment before checking high scores (1.5 seconds instead of 2)
        this.time.delayedCall(1500, () => {
            this.checkForHighScore();
        });
    }
    
    /**
     * Check if the player's score is a high score
     * SIMPLIFIED: Always shows the initials input for testing
     */
    checkForHighScore() {
        
        // Extract song ID if available
        let songId = "unknown";
        if (this.songData && this.songData.filename) {
            songId = this.songData.filename.includes('.') ? 
                this.songData.filename.substring(0, this.songData.filename.lastIndexOf('.')) :
                this.songData.filename;
        }
        
        // For debug/testing: Show current high scores to check what's stored
        if (this.highScoreManager) {
            this.highScoreManager.getHighScores(songId, true)
                .then(scores => {
                })
                .catch(err => console.warn("Error fetching scores:", err));
        }
        
        // Force delay before showing initials input to ensure UI is ready
        this.time.delayedCall(500, () => {
            this.showInitialsInput();
        });
    }
    
    /**
     * Show the initials input for high score entry
     */
    showInitialsInput() {
        
        // First, reset scene state for safety
        this.enteringInitials = true;
        
        // Make sure we don't have any tweens that could cause radius errors
        this.tweens.killAll();
        
        // Clear any camera effects
        if (this.cameras.main.postFX) {
            try {
                this.cameras.main.postFX.clear();
            } catch (e) {
                console.error("Failed to clear postFX:", e);
            }
        }
        
        // Use our dedicated InitialsInput class instead of re-implementing UI logic here
        if (this.initialsInput) {
            this.initialsInput.show((initials) => {
                this.enteringInitials = false;
                
                if (initials) {
                    this.submitHighScore(initials);
                } else {
                    // If initials is null (cancelled), return to menu
                    this.returnToMenu();
                }
            });
        } else {
            // Fallback if the InitialsInput class isn't available for some reason
            console.error("InitialsInput class not available, using direct prompt");
            try {
                // ULTRA SAFE DIRECT PROMPT - This bypasses Phaser entirely
                const userInitials = prompt("You got a high score! Enter your 3 letter initials:", "AAA");
                
                const initials = userInitials ? userInitials.substring(0, 3).toUpperCase() : "AAA";
                console.log("Collected initials via prompt:", initials);
                
                this.enteringInitials = false;
                this.submitHighScore(initials);
            } catch (e) {
                console.error("Browser prompt failed:", e);
                // Emergency fallback
                this.enteringInitials = false;
                this.submitHighScore("AAA");
            }
        }
    }
    
    /**
     * Submit a high score to the server
     * @param {string} initials - Player's 3-letter initials
     */
    submitHighScore(initials) {
        
        // DEBUG FLAG - Set to true to force immediate transition to MenuScene for testing
        const EMERGENCY_BYPASS = false;
        if (EMERGENCY_BYPASS) {
            window.location.reload();
            return;
        }
        
        // To debug: show a direct message on screen indicating we're in the submitHighScore function
        const debugText = this.add.text(
            this.gameWidth / 2,
            100,
            'PROCESSING SCORE...',
            {
                fontSize: '24px',
                fontStyle: 'bold',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5).setDepth(2000);
        
        // Clear any existing UI elements that might be in the way
        this.tweens.killAll(); // Stop any running animations
        
        // EMERGENCY ESCAPE HATCH - Force return to menu after 8 seconds no matter what
        // This guarantees we won't get stuck in this screen
        const emergencyTimerId = setTimeout(() => {
            window.location.reload();
        }, 8000);
        
        if (!this.songData || !this.songData.filename) {
            console.error("Cannot submit high score: no song data available");
            // Skip high score display and go directly to menu
            clearTimeout(emergencyTimerId);
            window.location.reload();
            return;
        }
        
        // Extract the song ID without the extension (to match server format)
        const songId = this.songData.filename.includes('.') ? 
            this.songData.filename.substring(0, this.songData.filename.lastIndexOf('.')) :
            this.songData.filename;
        
        
        // Actually use the HighScoreManager to submit the score instead of creating fake scores
        if (this.highScoreManager) {
            debugText.setText('SUBMITTING SCORE TO SERVER...');
            
            // Create the score data object
            const scoreData = {
                songId: songId,
                score: this.score,
                initials: initials
            };
            
            // Submit the score using the high score manager
            this.highScoreManager.submitScore(scoreData)
                .then(result => {
                    
                    // Get real scores and rank from the result
                    const scores = result.scores || [];
                    const rank = result.rank || 1;
                    
                    // Cancel the emergency timeout
                    clearTimeout(emergencyTimerId);
                    
                    debugText.setText('SCORE SAVED! SHOWING HIGH SCORES...');
                    
                    // Wait a short moment, then show high scores with the real data
                    this.time.delayedCall(500, () => this.showHighScores(scores, rank, debugText));
                })
                .catch(error => {
                    console.error("❌ Error submitting score:", error);
                    debugText.setText('ERROR SAVING SCORE. LOADING SCORES...');
                    
                    // If submission fails, try to at least load the existing scores
                    this.highScoreManager.getHighScores(songId, true)
                        .then(scores => {
                            
                            // Add the current score to the existing scores
                            scores.push({
                                initials: initials,
                                score: this.score,
                                date: new Date().toISOString().split('T')[0]
                            });
                            
                            // Sort the scores in descending order
                            scores.sort((a, b) => b.score - a.score);
                            
                            // Find the rank of the current score
                            let rank = 1;
                            for (let i = 0; i < scores.length; i++) {
                                if (scores[i].initials === initials && scores[i].score === this.score) {
                                    rank = i + 1;
                                    break;
                                }
                            }
                            
                            // Limit to top 10 scores
                            if (scores.length > 10) {
                                scores = scores.slice(0, 10);
                            }
                            
                            // Cancel the emergency timeout
                            clearTimeout(emergencyTimerId);
                            
                            // Show high scores with the loaded data
                            this.showHighScores(scores, rank, debugText);
                        })
                        .catch(err => {
                            console.error("Failed to load existing scores as fallback:", err);
                            
                            // Create a minimal score list with just the current score as a last resort
                            const scores = [{
                                initials: initials,
                                score: this.score,
                                date: new Date().toISOString().split('T')[0]
                            }];
                            
                            // Cancel the emergency timeout
                            clearTimeout(emergencyTimerId);
                            
                            // Show high scores with just the current score
                            this.showHighScores(scores, 1, debugText);
                        });
                });
        } else {
            console.error("No high score manager available");
            debugText.setText('NO SCORE MANAGER AVAILABLE');
            
            // Create a minimal score list with just the current score as a last resort
            const scores = [{
                initials: initials,
                score: this.score,
                date: new Date().toISOString().split('T')[0]
            }];
            
            // Cancel the emergency timeout
            clearTimeout(emergencyTimerId);
            
            // Show high scores with just the current score
            this.showHighScores(scores, 1, debugText);
        }
    }
    
    /**
     * Show high scores after submitting a score
     * @param {Array} scores - The scores to display
     * @param {number} rank - The rank to highlight
     * @param {Phaser.GameObjects.Text} debugText - Debug text object to update
     */
    showHighScores(scores, rank, debugText) {
        
        // Clean up any debug text
        if (debugText) {
            debugText.destroy();
        }
        
        // Mark as showing high scores
        this.showingHighScores = true;
        
        // Use the HighScoreDisplay class to show scores with highlighting
        if (this.highScoreDisplay) {
            this.highScoreDisplay.show(scores, { 
                highlightRank: rank,
                fadeIn: true 
            });
        } else {
            console.error("No highScoreDisplay available!");
            this.returnToMenu();
        }
    }
    
    /**
     * Return to the menu scene
     */
    returnToMenu() {
        console.log("🔄 returnToMenu() called - reloading page...");
        // Just reload the page to completely reset everything
        window.location.reload();
    }
    
    /**
     * Cleanup when scene shuts down
     */
    shutdown() {
        console.log("🧹 GameScene shutdown - cleaning up resources");

        // Cleanup player
        if (this.player) {
            // Stop player auto-fire timer
            if (this.player.autoFireTimer) {
                this.player.autoFireTimer.remove();
                this.player.autoFireTimer = null;
            }

            // Destroy player sprite
            if (this.player.sprite) {
                this.player.sprite.destroy();
            }

            // Cleanup player glow
            if (this.player.glow) {
                this.player.glow.destroy();
                this.player.glow = null;
            }

            if (this.player.glowFollower) {
                this.player.glowFollower.remove();
                this.player.glowFollower = null;
            }

            this.player = null;
        }

        // Cleanup pause menu
        if (this.pauseMenu) {
            this.pauseMenu.cleanup();
            this.pauseMenu = null;
        }

        // Cleanup other systems
        if (this.soundManager && typeof this.soundManager.cleanup === 'function') {
            this.soundManager.cleanup();
        }

        if (this.audioAnalyzer && typeof this.audioAnalyzer.cleanup === 'function') {
            this.audioAnalyzer.cleanup();
        }

        // Clear any existing timers
        if (this.cleanupTimer) {
            this.cleanupTimer.remove();
            this.cleanupTimer = null;
        }
    }
}
