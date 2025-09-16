// ParticleSystem.js - Manages all particle effects in the game

export default class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        
        // Particle system state
        this.particleEmitters = [];
        this.showCentralParticles = false; // Default to false - center circle off by default
        this.showSatelliteParticles = true;
        this.centralParticlesPersist = false; // New flag to persist central particles state
        
        // Energy field visualization
        this.energyField = null;
        this.energyLevel = 0;
        this.targetEnergyLevel = 0;
        this.lastEnergyUpdate = 0;
        
        // Track missing textures to avoid repeated failures
        this.missingTextures = new Set();
        
        // Create necessary particle textures at initialization
        this.ensureRequiredTextures();
        this.createParticleTextures();
    }
    
    // New method to ensure all required textures exist
    ensureRequiredTextures() {
        const requiredTextures = ['star-particle', 'glow-particle', 'particle', 'line-particle'];
        
        // Check and create any missing textures
        requiredTextures.forEach(textureName => {
            if (!this.scene.textures.exists(textureName)) {
                console.warn(`Required texture '${textureName}' is missing! Creating fallback.`);
                this.createFallbackTexture(textureName);
            }
        });
    }
    
    // Create a fallback texture if one is missing
    createFallbackTexture(textureName) {
        try {
            console.log(`Creating fallback texture for '${textureName}'`);
            const graphics = this.scene.make.graphics({});
            
            // Clear any previous graphics
            graphics.clear();
            
            // Different shapes based on texture name
            switch(textureName) {
                case 'star-particle':
                case 'glow-particle':
                    // Simple circle for star/glow
                    graphics.fillStyle(0xffffff, 1);
                    graphics.fillCircle(8, 8, 8);
                    graphics.generateTexture(textureName, 16, 16);
                    break;
                    
                case 'particle':
                    // Square for regular particle
                    graphics.fillStyle(0xffffff, 1);
                    graphics.fillRect(0, 0, 8, 8);
                    graphics.generateTexture(textureName, 8, 8);
                    break;
                    
                case 'line-particle':
                    // Rectangle for line particles
                    graphics.fillStyle(0xffffff, 1);
                    graphics.fillRect(0, 0, 2, 10);
                    graphics.generateTexture(textureName, 2, 10);
                    break;
                    
                case 'laser-beam':
                    // Rectangle for laser
                    graphics.fillStyle(0x00ffff, 1);
                    graphics.fillRect(0, 0, 100, 8);
                    graphics.generateTexture(textureName, 100, 8);
                    break;
                    
                default:
                    // Default white square
                    graphics.fillStyle(0xffffff, 1);
                    graphics.fillRect(0, 0, 16, 16);
                    graphics.generateTexture(textureName, 16, 16);
            }
            
            console.log(`Successfully created fallback texture for '${textureName}'`);
            return true;
        } catch (error) {
            console.error(`Failed to create fallback texture for '${textureName}':`, error);
            // Add to missing textures set to avoid repeated attempts
            this.missingTextures.add(textureName);
            return false;
        }
    }
    
    createParticleTextures() {
        console.log("Checking particle textures");
        
        // Check and ensure all required textures exist
        const requiredTextures = [
            'star-particle', 'glow-particle', 'particle', 
            'line-particle', 'laser-beam'
        ];
        
        // For each required texture, verify or create
        requiredTextures.forEach(textureName => {
            if (!this.scene.textures.exists(textureName)) {
                // Skip if we've already tried and failed to create this texture
                if (this.missingTextures.has(textureName)) {
                    console.warn(`Skipping already failed texture '${textureName}'`);
                    return;
                }
                
                console.warn(`Required texture '${textureName}' is missing! Creating fallback.`);
                this.createFallbackTexture(textureName);
            } else {
                console.log(`Texture '${textureName}' is available`);
            }
        });
    }
    
    // Create a dedicated star particle texture with a more distinctive shape
    createStarParticleTexture() {
        console.log("Creating specialized star-particle texture");
        
        try {
            // Create a canvas with willReadFrequently=true to optimize performance
            const canvas = document.createElement('canvas');
            canvas.width = 16;
            canvas.height = 16;
            canvas.willReadFrequently = true;
            
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, 16, 16);
            
            // Create a radial gradient for a better looking particle
            const gradient = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');   // White center
            gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)'); // Slightly transparent
            gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.4)'); // More transparent
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');     // Fully transparent edge
            
            // Fill with gradient
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(8, 8, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Add texture to the game using the canvas
            this.scene.textures.addCanvas('star-particle', canvas);
            
            console.log("Successfully created specialized star-particle texture using canvas");
            
            // Also create the glow particle with the same technique
            this.createGlowParticleTexture();
            
            return true;
        } catch (error) {
            console.error("Failed to create star-particle texture:", error);
            return false;
        }
    }
    
    createGlowParticleTexture() {
        try {
            // Create a canvas with willReadFrequently=true to optimize performance
            const canvas = document.createElement('canvas');
            canvas.width = 16;
            canvas.height = 16;
            canvas.willReadFrequently = true;
            
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, 16, 16);
            
            // Create a radial gradient for a soft glow
            const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');   // Almost white center  
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)'); // Medium transparency
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');     // Fully transparent edge
            
            // Fill with gradient
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(8, 8, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Add texture to the game using the canvas
            this.scene.textures.addCanvas('glow-particle', canvas);
            
            console.log("Successfully created glow-particle texture using canvas");
            return true;
        } catch (error) {
            console.error("Failed to create glow-particle texture:", error);
            return false;
        }
    }
    
    createBackgroundParticles() {
        // Get game dimensions for responsive sizing
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Create a simple pure black background rectangle that covers the entire game area
        const background = this.scene.add.rectangle(
            gameWidth / 2, 
            gameHeight / 2, 
            gameWidth, 
            gameHeight, 
            0x000000
        );
        background.setDepth(-20);
        
        // Create a starfield background
        this.createStarfield();
        
        // Create energy field visualization
        this.createEnergyField();
        
        // Initialize empty particle emitters array
        this.particleEmitters = [];
    }
    
    createStarfield() {
        console.log("Creating starfield background");
        
        // Get game dimensions for responsive positioning
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Only one array to store all stars (all will be moving)
        this.stars = [];
        this.starSpeed = 1.0; // Base speed multiplier for stars
        
        // Create many stars with various sizes and speeds for depth perception
        const starCount = 300; // Increased for better star density
        
        for (let i = 0; i < starCount; i++) {
            // Start from random position across the screen height, but from right side
            const x = Phaser.Math.Between(0, gameWidth + 50); // Some stars start beyond right edge
            const y = Phaser.Math.Between(0, gameHeight);
            
            // Determine layer (far/mid/close) for consistent visuals
            const layer = i % 3; // 0 = far, 1 = mid, 2 = close
            
            // Size based on layer (smaller = further away)
            let size;
            if (layer === 0) { // Far stars
                size = Phaser.Math.FloatBetween(0.3, 0.7);
            } else if (layer === 1) { // Mid-distance stars
                size = Phaser.Math.FloatBetween(0.7, 1.0);
            } else { // Close stars
                size = Phaser.Math.FloatBetween(1.0, 1.4);
            }
            
            // Brightness also based on layer (dimmer = further away)
            let brightness;
            if (layer === 0) {
                brightness = Phaser.Math.Between(80, 120); // Dim (far)
            } else if (layer === 1) {
                brightness = Phaser.Math.Between(120, 180); // Medium (mid)
            } else {
                brightness = Phaser.Math.Between(180, 255); // Bright (close)
            }
            
            const color = Phaser.Display.Color.GetColor(brightness, brightness, brightness);
            
            // Create the star as a circle
            const star = this.scene.add.circle(x, y, size, color, 1);
            star.setDepth(-15 - layer); // Layer-based depth (close stars in front)
            
            // Alpha also based on layer for added depth perception
            const alpha = layer === 0 ? 0.5 : (layer === 1 ? 0.7 : 0.9);
            star.setAlpha(alpha);
            
            // Speed based on layer - parallax effect
            let speed;
            if (layer === 0) {
                speed = Phaser.Math.FloatBetween(0.3, 0.7); // Slow (far away stars)
            } else if (layer === 1) {
                speed = Phaser.Math.FloatBetween(0.8, 1.2); // Medium (middle distance)
            } else {
                speed = Phaser.Math.FloatBetween(1.3, 2.0); // Fast (close stars)
            }
            
            // Store properties on star object for updates
            star.baseSpeed = speed;
            star.currentSpeed = speed;
            star.originalScale = star.scaleX || 1;
            star.originalAlpha = alpha;
            star.layer = layer;
            
            // Add twinkling effect to some far/mid stars
            if ((layer === 0 || layer === 1) && Math.random() < 0.4) {
                this.scene.tweens.add({
                    targets: star,
                    alpha: alpha * 0.5, // Reduce to half brightness
                    duration: Phaser.Math.Between(1000, 3000),
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
            
            // Add to stars array
            this.stars.push(star);
        }
        
        // Set up an update event to move stars based on music
        this.scene.events.on('update', this.updateStars, this);
    }
    
    /**
     * Updates all stars positions based on their speed and the music
     * This runs every frame to provide continuous movement
     */
    updateStars() {
        if (!this.stars || this.stars.length === 0) return;
        
        const gameHeight = this.scene.gameHeight || 720;
        const gameWidth = this.scene.gameWidth || 1280;
        
        // Get audio analyzer for music-reactive movement
        const analyzer = this.scene.audioAnalyzer;
        
        // Use audio intensity and BPM to influence star movement
        let musicSpeedFactor = 1.0;
        let sinOffset = 0;
        
        // If we have active audio analysis, use it to enhance star movement
        if (analyzer && analyzer.currentBPM > 0) {
            // Base continuous music factor on BPM
            musicSpeedFactor = Math.min(2.0, Math.max(0.5, analyzer.currentBPM / 120));
            
            // Use time since last beat for pulsing movement
            const currentTime = (this.scene.time.now - this.scene.gameStartTime) / 1000;
            const lastBeatTime = analyzer.lastBeatTime || 0;
            const timeSinceLastBeat = currentTime - lastBeatTime;
            const beatDuration = analyzer.currentBPM > 0 ? (60 / analyzer.currentBPM) : 0.5;
            
            // Calculate sin wave based on beat progress (for swaying motion)
            if (beatDuration > 0) {
                // Create a sine wave that completes one cycle per beat
                const beatProgress = (timeSinceLastBeat / beatDuration);
                sinOffset = Math.sin(beatProgress * Math.PI * 2) * 0.3;
            }
            
            // Debug logging (uncomment to see actual BPM data)
            // if (Math.random() < 0.01) { // Only log occasionally
            //     console.log(`BPM: ${analyzer.currentBPM.toFixed(1)}, Speed: ${musicSpeedFactor.toFixed(2)}`);
            // }
        }
        
        // Get current time for additional movement variation
        const now = this.scene.time.now / 1000;
        
        // Update each star position with music-reactive movement
        this.stars.forEach(star => {
            if (!star.active) return;
            
            // Basic horizontal movement with music speed factor
            star.x -= star.currentSpeed * this.starSpeed * musicSpeedFactor;
            
            // Optional: Add subtle vertical sway based on music rhythm
            if (sinOffset !== 0) {
                // Adjust y position with a subtle sway (more for distant stars)
                const swayFactor = star.layer === 0 ? 0.5 : (star.layer === 1 ? 0.3 : 0.1);
                star.y += sinOffset * swayFactor;
                
                // Keep stars within screen bounds
                if (star.y < 0) star.y = 0;
                if (star.y > gameHeight) star.y = gameHeight;
            }
            
            // Reset position when star goes off left side of screen
            if (star.x < -5) {
                star.x = gameWidth + 5;
                star.y = Phaser.Math.Between(0, gameHeight);
                
                // Reset to original alpha for consistent visuals
                star.setAlpha(star.originalAlpha);
            }
        });
    }
    
    
    /**
     * Clears all existing satellite emitters
     */
    clearSatelliteEmitters() {
        if (this.particleEmitters && this.particleEmitters.length > 0) {
            // Find and destroy all satellite emitters
            const satelliteEmitters = this.particleEmitters.filter(e => e.type === 'satellite' && e.active);
            
            satelliteEmitters.forEach(emitterObj => {
                if (emitterObj.emitter) {
                    try {
                        emitterObj.emitter.destroy();
                        emitterObj.active = false;
                    } catch (error) {
                        console.warn("Error destroying satellite emitter:", error);
                    }
                }
            });
            
            // Remove destroyed emitters from array
            this.particleEmitters = this.particleEmitters.filter(e => e.active);
        }
    }
    
    createSatelliteEmitter(x, y, segmentType) {
        console.log("Creating satellite using NATIVE SHAPES WITHOUT TEXTURES");
        
        try {
            // Get color based on segment type - more vibrant colors
            let color;
            switch(segmentType) {
                case 'chorus':
                    color = 0xff00ff; // Magenta
                    break;
                case 'verse':
                    color = 0x00ffff; // Cyan
                    break;
                case 'bridge':
                    color = 0xffff00; // Yellow
                    break;
                default:
                    color = 0x00ff88; // Green
            }
            
            // Create game dimensions for reference
            const gameWidth = this.scene.gameWidth || 1280;
            const gameHeight = this.scene.gameHeight || 720;
            
            // Use safer orbit parameters (smaller range, more centered)
            const centerX = (gameWidth / 2) + Phaser.Math.Between(-80, 80);
            const centerY = (gameHeight / 2) + Phaser.Math.Between(-80, 80);
            const radius = Phaser.Math.Between(60, 120);
            const duration = Phaser.Math.Between(8000, 10000);
            
            // Create a container for multiple shapes to make a "satellite"
            const satellite = this.scene.add.container(x, y);
            satellite.segmentType = segmentType; // Store segment type for reference
            
            // Create a glowing circle - this uses native Phaser shapes, NO TEXTURES!
            const mainCircle = this.scene.add.circle(0, 0, 8, color, 0.8);
            mainCircle.setBlendMode(Phaser.BlendModes.ADD);
            
            // Create a smaller bright core
            const coreCircle = this.scene.add.circle(0, 0, 4, 0xffffff, 0.9);
            coreCircle.setBlendMode(Phaser.BlendModes.ADD);
            
            // Add a subtle outer glow using another circle
            const glowCircle = this.scene.add.circle(0, 0, 12, color, 0.3);
            glowCircle.setBlendMode(Phaser.BlendModes.ADD);
            
            // Add all shapes to the container
            satellite.add(glowCircle);
            satellite.add(mainCircle);
            satellite.add(coreCircle);
            
            // Add pulsing animation to make it more interesting
            this.scene.tweens.add({
                targets: [mainCircle, coreCircle],
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 800,
                yoyo: true,
                repeat: -1
            });
            
            // Add to emitters array for tracking
            this.particleEmitters.push({
                emitter: satellite,
                type: 'satellite',
                active: true,
                createdAt: this.scene.time.now,
                segmentType: segmentType,
                x: x,
                y: y
            });
            
            // Create a path for the satellite to follow
            const path = new Phaser.Curves.Ellipse(centerX, centerY, radius, radius);
            const pathFollower = this.scene.add.follower(path, x, y, null);
            pathFollower.setVisible(false);
            
            // Start following the path with proper error handling
            try {
                pathFollower.startFollow({
                    duration: duration,
                    repeat: -1,
                    ease: 'Linear'
                });
                
                // Make the satellite follow the path follower
                const followTimer = this.scene.time.addEvent({
                    delay: 30,
                    callback: () => {
                        if (satellite && satellite.active && pathFollower && pathFollower.active) {
                            satellite.setPosition(pathFollower.x, pathFollower.y);
                        } else {
                            // Clean up if either object was destroyed
                            if (followTimer) followTimer.remove();
                            if (pathFollower && pathFollower.active) pathFollower.destroy();
                        }
                    },
                    loop: true
                });
                
                // Fade out and destroy after some time
                this.scene.time.delayedCall(6000, () => {
                    if (satellite && satellite.active) {
                        this.scene.tweens.add({
                            targets: satellite,
                            alpha: 0,
                            duration: 1500,
                            onComplete: () => {
                                if (satellite && satellite.active) satellite.destroy();
                                if (pathFollower && pathFollower.active) pathFollower.destroy();
                                if (followTimer) followTimer.remove();
                                
                                // Remove from emitters array
                                const index = this.particleEmitters.findIndex(e => e.emitter === satellite);
                                if (index !== -1) {
                                    this.particleEmitters[index].active = false;
                                }
                            }
                        });
                    }
                });
                
                // Occasionally emit small particles for a trail effect
                if (Math.random() < 0.5) {
                    const trailTimer = this.scene.time.addEvent({
                        delay: 200,
                        callback: () => {
                            if (satellite && satellite.active) {
                                const smallGlow = this.scene.add.circle(
                                    satellite.x, 
                                    satellite.y, 
                                    3, 
                                    color, 
                                    0.5
                                );
                                smallGlow.setBlendMode(Phaser.BlendModes.ADD);
                                
                                // Fade out the trail particle
                                this.scene.tweens.add({
                                    targets: smallGlow,
                                    alpha: 0,
                                    scale: 0.5,
                                    duration: 800,
                                    onComplete: () => smallGlow.destroy()
                                });
                            } else {
                                trailTimer.remove();
                            }
                        },
                        loop: true
                    });
                    
                    // Make sure to clean up the trail timer
                    this.scene.time.delayedCall(6000, () => {
                        if (trailTimer) trailTimer.remove();
                    });
                }
            } catch (error) {
                console.warn("Error setting up satellite movement:", error);
                // Clean up on error
                if (satellite) satellite.destroy();
                if (pathFollower) pathFollower.destroy();
            }
            
            return satellite;
        } catch (error) {
            console.warn("Error creating satellite:", error);
            return null;
        }
    }
    
    createFlowingParticle() {
        try {
            // Random position at the edges - using game dimensions
            const gameWidth = this.scene.gameWidth || 1280;
            const gameHeight = this.scene.gameHeight || 720;
            
            let x, y;
            if (Math.random() > 0.5) {
                // Come from sides
                x = Math.random() > 0.5 ? -20 : gameWidth + 20;
                y = Phaser.Math.Between(0, gameHeight);
            } else {
                // Come from top/bottom
                x = Phaser.Math.Between(0, gameWidth);
                y = Math.random() > 0.5 ? -20 : gameHeight + 20;
            }
            
            // Random color - more vibrant colors
            const colors = [0x8800ff, 0x00ffff, 0xff00ff, 0x00ff88, 0xff3366, 0xffcc00];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            // Create the particle - randomly choose between star and glow particles
            const particleType = Math.random() > 0.5 ? 'star-particle' : 'glow-particle';
            
            // Safety check - make sure the texture exists
            if (!this.scene.textures.exists(particleType)) {
                console.warn(`Missing texture: ${particleType} for flowing particle. Creating fallback.`);
                // Create a fallback texture
                this.createFallbackTexture(particleType);
                
                // If texture creation failed, skip this particle
                if (!this.scene.textures.exists(particleType)) {
                    console.error(`Failed to create fallback for ${particleType}`);
                    return null;
                }
            }
            
            const particle = this.scene.add.image(x, y, particleType);
            particle.setTint(color);
            particle.setAlpha(0.7);  // More visible
            particle.setScale(0.5);  // Much larger particles
            particle.setBlendMode(Phaser.BlendModes.ADD);
            particle.setDepth(-9);
            
            // Calculate direction toward game center with some randomness
            const angle = Phaser.Math.Angle.Between(x, y, gameWidth / 2, gameHeight / 2) + 
                         (Math.random() - 0.5) * Math.PI/2;
            
            // Set velocity based on angle - faster movement
            const speed = Phaser.Math.Between(30, 60);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            // Animate the particle
            this.scene.tweens.add({
                targets: particle,
                x: x + (vx * 20), // Move in direction
                y: y + (vy * 20),
                alpha: 0,
                scale: 0,
                duration: Phaser.Math.Between(4000, 8000),  // Longer lifetime
                onComplete: () => {
                    particle.destroy();
                }
            });
            
            return particle;
        } catch (error) {
            console.warn("Error creating flowing particle:", error);
            return null;
        }
    }
    
    createExplosion(x, y, size, color) {
        try {
            console.log(`Creating explosion at (${x}, ${y}) with size ${size} and color ${color}`);
            
            // SIMPLIFIED APPROACH: Just use circles for the explosion effect
            // No particle emitters that might cause texture issues
            
            // Create a main expanding circle
            const mainCircle = this.scene.add.circle(x, y, size/2, color, 0.7);
            mainCircle.setDepth(10);
            
            // Animate the main circle
            this.scene.tweens.add({
                targets: mainCircle,
                scale: 3,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    mainCircle.destroy();
                }
            });
            
            // Create multiple small circles for a more detailed explosion effect
            const smallCircleCount = Math.min(20, Math.max(10, Math.floor(size / 2)));
            
            for (let i = 0; i < smallCircleCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * size;
                const px = x + Math.cos(angle) * distance * 0.5; // Start closer to center
                const py = y + Math.sin(angle) * distance * 0.5;
                
                // Create a small circle
                const smallCircle = this.scene.add.circle(px, py, 2 + Math.random() * 4, color, 0.8);
                smallCircle.setDepth(11);
                
                // Animate it outward
                this.scene.tweens.add({
                    targets: smallCircle,
                    x: px + Math.cos(angle) * distance,
                    y: py + Math.sin(angle) * distance,
                    alpha: 0,
                    scale: 0.5,
                    duration: 300 + Math.random() * 300,
                    onComplete: () => {
                        smallCircle.destroy();
                    }
                });
            }
            
            // Add a subtle screen shake
            this.scene.cameras.main.shake(100, 0.002);
            
            return true;
        } catch (error) {
            console.warn("Error creating explosion:", error);
            return false;
        }
    }
    
    createBeatParticles(strength, x, y) {
        try {
            // Create particles based on beat strength - reduce particle count
            const particleCount = Math.floor(strength * 20); // Reduced from 30
            
            // Use circles instead of textures for better reliability
            console.log(`Creating ${particleCount} beat particles at (${x}, ${y})`);
            
            // Random colors for particles
            const colors = [0xffffff, 0x00ffff, 0xff00ff, 0xffff00, 0x00ff88];
            
            for (let i = 0; i < particleCount; i++) {
                // Random positioning around the center point
                const px = x + Phaser.Math.Between(-15, 15);
                const py = y + Phaser.Math.Between(-15, 15);
                
                // Random size between 2-5 pixels
                const size = 2 + Math.random() * 3;
                
                // Random color from our palette
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                // Create a circle instead of using an image texture
                const particle = this.scene.add.circle(px, py, size, color, 0.8);
                particle.setBlendMode(Phaser.BlendModes.ADD);
                particle.setDepth(10); // Make sure particles appear above background
                
                // Animate the particle
                this.scene.tweens.add({
                    targets: particle,
                    alpha: 0,
                    scale: 0,
                    x: px + Phaser.Math.Between(-25, 25), // Wider spread
                    y: py + Phaser.Math.Between(-25, 25),
                    duration: 600 + Math.random() * 400, // Variable duration
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        if (particle && particle.active) {
                            particle.destroy();
                        }
                    }
                });
            }
            
            // Add a small flash at the center point
            const flash = this.scene.add.circle(x, y, 8, 0xffffff, 0.7);
            flash.setBlendMode(Phaser.BlendModes.ADD);
            flash.setDepth(11);
            
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                scale: 2.5,
                duration: 300,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    if (flash && flash.active) {
                        flash.destroy();
                    }
                }
            });
            
            return true;
        } catch (error) {
            console.warn("Error creating beat particles:", error);
            return false;
        }
    }
    
    createColorChangeEffect(x, y, color, size = 40) {
        try {
            // Skip if central particles are disabled
            if (!this.showCentralParticles) {
                return;
            }
            
            console.log(`Creating color change effect at (${x}, ${y}) with color ${color} and size ${size}`);
            
            // Get game dimensions for scaling effects
            const gameWidth = this.scene.gameWidth || 1280;
            const gameHeight = this.scene.gameHeight || 720;
            
            // Scale size based on game dimensions
            const scaleFactor = Math.min(gameWidth, gameHeight) / 800;
            size = size * scaleFactor;
            
            // Get player energy if available to scale effect
            let energyScale = 1.0;
            if (this.scene.player && typeof this.scene.player.energy === 'number') {
                // Scale based on energy (0.8 to 1.3x)
                energyScale = 0.8 + (this.scene.player.energy / 100) * 0.5;
                size *= energyScale;
            }
            
            // Create concentric rainbow rings (not radiating lines)
            const rainbowColors = [0xff0000, 0xff7700, 0xffff00, 0x00ff00, 0x0077ff, 0x7700ff, 0xff00ff];
            const numRings = 6; // Number of rainbow rings
            
            // Create a central white/bright core
            const core = this.scene.add.circle(x, y, size * 0.5, 0xffffff, 0.7);
            core.setDepth(-13);
            
            // Animate core
            this.scene.tweens.add({
                targets: core,
                scale: 1.5,
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                    core.destroy();
                }
            });
            
            // Create concentric rings from inside out
            for (let i = 0; i < numRings; i++) {
                // Calculate radius - each ring gets progressively larger
                const ringSize = size * (0.7 + (i * 0.25));
                const ringColor = rainbowColors[i % rainbowColors.length];
                const ringAlpha = 0.4 - (i * 0.05); // Outer rings get more transparent
                
                // Create the ring
                const ring = this.scene.add.circle(x, y, ringSize, ringColor, ringAlpha);
                ring.setDepth(-12 - (i * 0.1)); // Inner rings on top
                
                // Animate the ring outward and fade out
                this.scene.tweens.add({
                    targets: ring,
                    scale: 1.5 + (i * 0.2), // Outer rings expand more
                    alpha: 0,
                    duration: 800 + (i * 100), // Outer rings last longer
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        ring.destroy();
                    }
                });
            }
            
            // Create a few subtle pulsing circles for depth
            for (let i = 0; i < 3; i++) {
                const pulseSize = size * (0.3 + (i * 0.3));
                const pulseColor = 0xffffff;
                const pulseAlpha = 0.3 - (i * 0.05);
                
                const pulse = this.scene.add.circle(x, y, pulseSize, pulseColor, pulseAlpha);
                pulse.setDepth(-13);
                
                this.scene.tweens.add({
                    targets: pulse,
                    scale: 2.0 + (i * 0.5),
                    alpha: 0,
                    duration: 1000 + (i * 200),
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        pulse.destroy();
                    }
                });
            }
            
            // Add a subtle tinted background flash
            const tint = this.scene.add.rectangle(
                gameWidth / 2, 
                gameHeight / 2, 
                gameWidth, 
                gameHeight, 
                color, 
                0.02
            );
            tint.setDepth(-19);
            this.scene.tweens.add({
                targets: tint,
                alpha: 0,
                duration: 800,
                onComplete: () => {
                    tint.destroy();
                }
            });
        } catch (error) {
            console.warn("Error creating color change effect:", error);
        }
    }
    
    updateBackgroundParticles(intensity, beatStrength) {
        // Adjust particle emission based on music intensity and beat strength
        if (this.particleEmitters && this.particleEmitters.length > 0) {
            this.particleEmitters.forEach(emitterObj => {
                if (emitterObj.active && emitterObj.emitter && emitterObj.emitter.active) {
                    // Adjust particle emission rate based on intensity - safely
                    if (emitterObj.emitter.frequency !== undefined) {
                        try {
                            const baseFrequency = emitterObj.type === 'central' ? 50 : 120;
                            const newFrequency = Math.max(20, baseFrequency - (intensity * 30));
                            emitterObj.emitter.frequency = newFrequency;
                        } catch (error) {
                            console.warn("Error updating emitter frequency:", error);
                        }
                    }
                    
                    // Pulse the emitter on strong beats - reduced effect for performance
                    if (beatStrength > 0.5 && Math.random() < 0.5) {  // Only 50% chance to apply effect
                        try {
                            // Temporarily increase particle speed and scale
                            const speedBoost = beatStrength * 50; // Reduced from 100
                            const scaleBoost = beatStrength * 0.25; // Reduced from 0.5
                            
                            // Apply temporary boost
                            if (emitterObj.emitter.setSpeed && typeof emitterObj.emitter.setSpeed === 'function') {
                                emitterObj.emitter.setSpeed(30 + speedBoost, 80 + speedBoost);
                            }
                            
                            if (emitterObj.emitter.setScale && typeof emitterObj.emitter.setScale === 'function') {
                                emitterObj.emitter.setScale(0.5 + scaleBoost, 1.0 + scaleBoost);
                            }
                            
                            // Reset after a short time
                            this.scene.time.delayedCall(300, () => {
                                if (emitterObj.emitter && emitterObj.emitter.active) {
                                    if (emitterObj.emitter.setSpeed && typeof emitterObj.emitter.setSpeed === 'function') {
                                        emitterObj.emitter.setSpeed(30, 80);
                                    }
                                    
                                    if (emitterObj.emitter.setScale && typeof emitterObj.emitter.setScale === 'function') {
                                        emitterObj.emitter.setScale(0.5, 1.0);
                                    }
                                }
                            });
                        } catch (error) {
                            console.warn("Error pulsing emitter:", error);
                        }
                    }
                }
            });
        }
    }
    
    toggleCentralParticles() {
        this.showCentralParticles = !this.showCentralParticles;
        this.centralParticlesPersist = this.showCentralParticles; // Remember the setting
        
        console.log(`Central particles ${this.showCentralParticles ? 'enabled' : 'disabled'}`);
        
        // Find and toggle the central emitter
        if (this.particleEmitters && this.particleEmitters.length > 0) {
            let centralEmitterFound = false;
            
            this.particleEmitters.forEach(emitterObj => {
                if (emitterObj.type === 'central' && emitterObj.emitter && emitterObj.emitter.active !== undefined) {
                    centralEmitterFound = true;
                    
                    try {
                        if (this.showCentralParticles) {
                            console.log("Starting central emitter");
                            if (typeof emitterObj.emitter.start === 'function') {
                                emitterObj.emitter.start();
                            } else if (typeof emitterObj.emitter.setEmitting === 'function') {
                                emitterObj.emitter.setEmitting(true);
                            } else {
                                console.warn("Could not find a method to start central emitter");
                            }
                            emitterObj.active = true;
                        } else {
                            console.log("Stopping central emitter");
                            if (typeof emitterObj.emitter.stop === 'function') {
                                emitterObj.emitter.stop();
                            } else if (typeof emitterObj.emitter.setEmitting === 'function') {
                                emitterObj.emitter.setEmitting(false);
                            } else if (emitterObj.emitter.frequency !== undefined) {
                                // Last resort: try to modify the frequency to stop emission
                                emitterObj.emitter.frequency = -1;
                                console.warn("Using frequency fallback to stop central emitter");
                            } else {
                                console.warn("Could not find a method to stop central emitter");
                            }
                            emitterObj.active = false;
                        }
                    } catch (error) {
                        console.warn("Error toggling central particles:", error);
                    }
                }
            });
            
            if (!centralEmitterFound) {
                console.log("No central emitter found in particleEmitters array");
            }
        } else {
            console.log("No particleEmitters array found or it's empty");
        }
        
        // Show toggle notification
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        const toggleText = this.scene.add.text(gameWidth/2, gameHeight * 0.15, 
            `Central Particles: ${this.showCentralParticles ? 'ON' : 'OFF'}`, 
            { 
                fontSize: '24px', 
                fontStyle: 'bold',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5);
        
        // Animate and remove the notification
        this.scene.tweens.add({
            targets: toggleText,
            alpha: 0,
            y: gameHeight * 0.13,
            duration: 1500,
            onComplete: () => {
                toggleText.destroy();
            }
        });
    }
    
    // New method to restore central particles if they were turned off
    restoreCentralParticles() {
        // Only do something if they were disabled but should be enabled by default
        if (!this.showCentralParticles && this.centralParticlesPersist) {
            console.log("Automatically restoring central particles");
            this.showCentralParticles = true;
            
            // Similar to toggleCentralParticles but without the notification
            if (this.particleEmitters && this.particleEmitters.length > 0) {
                this.particleEmitters.forEach(emitterObj => {
                    if (emitterObj.type === 'central' && emitterObj.emitter) {
                        try {
                            if (typeof emitterObj.emitter.start === 'function') {
                                emitterObj.emitter.start();
                            } else if (typeof emitterObj.emitter.setEmitting === 'function') {
                                emitterObj.emitter.setEmitting(true);
                            }
                            emitterObj.active = true;
                        } catch (error) {
                            console.warn("Error restoring central particles:", error);
                        }
                    }
                });
            }
        }
    }
    
    toggleSatelliteParticles() {
        this.showSatelliteParticles = !this.showSatelliteParticles;
        console.log(`Satellite particles ${this.showSatelliteParticles ? 'enabled' : 'disabled'}`);
        
        // Find and toggle all satellite emitters
        if (this.particleEmitters && this.particleEmitters.length > 0) {
            let satelliteEmittersFound = false;
            
            this.particleEmitters.forEach(emitterObj => {
                if (emitterObj.type === 'satellite' && emitterObj.emitter) {
                    satelliteEmittersFound = true;
                    
                    try {
                        if (this.showSatelliteParticles) {
                            if (typeof emitterObj.emitter.start === 'function') {
                                emitterObj.emitter.start();
                            } else if (typeof emitterObj.emitter.setEmitting === 'function') {
                                emitterObj.emitter.setEmitting(true);
                            } else {
                                console.warn("Could not find a method to start satellite emitter");
                            }
                            emitterObj.active = true;
                        } else {
                            if (typeof emitterObj.emitter.stop === 'function') {
                                emitterObj.emitter.stop();
                            } else if (typeof emitterObj.emitter.setEmitting === 'function') {
                                emitterObj.emitter.setEmitting(false);
                            } else if (emitterObj.emitter.frequency !== undefined) {
                                // Last resort: try to modify the frequency to stop emission
                                emitterObj.emitter.frequency = -1;
                                console.warn("Using frequency fallback to stop satellite emitter");
                            } else {
                                console.warn("Could not find a method to stop satellite emitter");
                            }
                            emitterObj.active = false;
                        }
                    } catch (error) {
                        console.warn("Error toggling satellite particles:", error);
                    }
                }
            });
            
            if (!satelliteEmittersFound) {
                console.log("No satellite emitters found in particleEmitters array");
            }
        } else {
            console.log("No particleEmitters array found or it's empty");
        }
        
        // Show toggle notification
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        const toggleText = this.scene.add.text(gameWidth/2, gameHeight * 0.2, 
            `Satellite Particles: ${this.showSatelliteParticles ? 'ON' : 'OFF'}`, 
            { 
                fontSize: '24px', 
                fontStyle: 'bold',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5);
        
        // Animate and remove the notification
        this.scene.tweens.add({
            targets: toggleText,
            alpha: 0,
            y: gameHeight * 0.18,
            duration: 1500,
            onComplete: () => {
                toggleText.destroy();
            }
        });
    }
    
    // WebGL-safe helper methods
    
    addGlowEffect(target, color, distance = 4) {
        if (!target) return false;
        
        // Only apply effect if in WebGL mode and target has preFX property
        if (this.scene.renderer.type === Phaser.WEBGL && target.preFX) {
            try {
                target.preFX.addGlow(color, distance, 0, false);
                return true;
            } catch (error) {
                console.warn("Error applying glow effect:", error);
            }
        }
        return false;
    }
    
    clearEffects(target) {
        if (!target) return false;
        
        // Only clear effects if in WebGL mode and target has preFX
        if (this.scene.renderer.type === Phaser.WEBGL && target.preFX) {
            try {
                target.preFX.clear();
                return true;
            } catch (error) {
                console.warn("Error clearing effects:", error);
            }
        }
        return false;
    }
    
    /**
     * Creates an energy field visualization that responds to music
     */
    createEnergyField() {
        // Get game dimensions
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Create an energy field as a circular gradient
        const graphics = this.scene.add.graphics();
        
        // Define the energy field as a container with graphics
        this.energyField = this.scene.add.container(gameWidth / 2, gameHeight / 2);
        this.energyField.setDepth(-14); // Between starfield and rainbow rings
        
        // Create gradient circle with alpha
        const radius = Math.max(gameWidth, gameHeight) * 0.5;
        
        // Create gradient using multiple circles with decreasing alpha
        const steps = 10;
        const colors = [0x6600ff, 0x4400cc, 0x330099, 0x220066]; // Purple gradient
        
        for (let i = 0; i < steps; i++) {
            const circle = this.scene.add.circle(
                0, 0, 
                radius * (i / steps), 
                colors[i % colors.length], 
                0.05 - (i * 0.005)
            );
            this.energyField.add(circle);
        }
        
        // Start with low energy
        this.energyField.setScale(0.1);
        
        // Create custom vignette effect (if not using FX pipeline)
        this.createCustomVignette();
    }
    
    /**
     * Creates a custom vignette effect using standard graphics
     * This serves as a fallback when the FX pipeline isn't available
     */
    createCustomVignette() {
        // Get game dimensions
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Create a container for the vignette elements
        this.customVignette = this.scene.add.container();
        this.customVignette.setDepth(1000); // Above most game elements
        
        // Create the gradient for the vignette using multiple translucent circles
        const steps = 12;
        const maxRadius = Math.max(gameWidth, gameHeight);
        
        // Create nested circles with increasing opacity toward the edges
        for (let i = 0; i < steps; i++) {
            // Calculate relative position in the gradient (0 to 1)
            const t = i / (steps - 1);
            
            // Calculate radius and alpha for this step
            // Use quadratic easing to make the gradient more concentrated at the edges
            const radius = maxRadius * (t * t);
            
            // Alpha increases toward the edge
            // Use a function that starts very low and ramps up quickly at the end
            const alpha = Math.max(0, t * t * t * 0.5);
            
            // Default color black
            const color = 0x000000;
            
            // Create a full-screen ring at this step
            const ring = this.scene.add.circle(
                gameWidth / 2, 
                gameHeight / 2,
                radius,
                color,
                alpha
            );
            
            this.customVignette.add(ring);
        }
        
        // Set initial properties
        this.customVignetteColor = 0x000000; // Default black
        this.customVignetteStrength = 0.5;
        this.customVignetteRadius = 0.7;
        
        // Store reference to the rings for animation
        this.customVignetteRings = this.customVignette.getAll();
    }
    
    /**
     * Updates the custom vignette effect with new color and parameters
     * @param {number} color - Hex color for the vignette
     * @param {number} strength - Strength of the effect (0-1)
     * @param {number} radius - Radius of the inner clear area (0-1) 
     */
    updateCustomVignette(color, strength, radius) {
        if (!this.customVignette || !this.customVignetteRings) return;
        
        // Get game dimensions
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Store the new parameters
        if (color !== undefined) this.customVignetteColor = color;
        if (strength !== undefined) this.customVignetteStrength = strength;
        if (radius !== undefined) this.customVignetteRadius = radius;
        
        // Calculate max radius based on screen size and radius parameter
        const maxRadius = Math.max(gameWidth, gameHeight) * 1.5;
        
        // Update each ring in the vignette
        this.customVignetteRings.forEach((ring, i) => {
            // Safety check - skip if ring is null or undefined
            if (!ring || !ring.active) return;
            
            // Calculate relative position in the gradient (0 to 1)
            const t = i / (this.customVignetteRings.length - 1);
            
            // Scale radius based on the radius parameter (smaller value = smaller clear area)
            const adjustedRadius = maxRadius * t * t * (2 - this.customVignetteRadius);
            
            // Adjust alpha based on strength parameter
            const alpha = Math.max(0, t * t * this.customVignetteStrength * 0.5);
            
            try {
                // Update ring properties with safety checks
                if (typeof ring.setRadius === 'function') {
                    ring.setRadius(adjustedRadius);
                }
                if (typeof ring.setAlpha === 'function') {
                    ring.setAlpha(alpha);
                }
                if (typeof ring.setFillStyle === 'function') {
                    ring.setFillStyle(this.customVignetteColor, alpha);
                }
            } catch (error) {
                console.warn(`Error updating vignette ring ${i}:`, error);
            }
        });
    }
    
    /**
     * Update energy field based on music intensity
     * @param {number} intensity - Music intensity value (0-1)
     */
    updateEnergyField(intensity) {
        if (!this.energyField) return;
        
        // Update target energy level
        this.targetEnergyLevel = 0.2 + (intensity * 0.8); // Base scale 0.2 to 1.0
        
        const now = this.scene.time.now;
        if (now - this.lastEnergyUpdate > 100) { // Update every 100ms
            // Smoothly interpolate current energy to target
            this.energyLevel += (this.targetEnergyLevel - this.energyLevel) * 0.1;
            
            // Update energy field scale
            this.energyField.setScale(this.energyLevel);
            
            this.lastEnergyUpdate = now;
        }
    }
    
    /**
     * Makes the starfield respond to music beats
     * @param {number} beatStrength - Strength of the current beat (0-1)
     */
    pulseStarfield(beatStrength) {
        // Log beat detection (uncomment to debug)
        // console.log(`Beat detected with strength: ${beatStrength.toFixed(2)}`);
        
        // Pulse the energy field
        if (this.energyField) {
            // Temporary boost based on beat strength
            const boostAmount = 0.2 + (beatStrength * 0.8); // Up to 100% boost
            const targetScale = this.energyLevel * (1 + boostAmount);
            
            // Apply boost with a tween
            this.scene.tweens.add({
                targets: this.energyField,
                scale: targetScale,
                duration: 200,
                yoyo: true,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    if (this.energyField) {
                        this.energyField.setScale(this.energyLevel);
                    }
                }
            });
        }
        
        // More dramatic speed boost on beat - creates a noticeable "warp speed" effect
        const speedBoost = 1 + (beatStrength * 4.0); // 1x to 5x speed boost (increased from 2.0 to 4.0)
        this.starSpeed = speedBoost;
        
        // Add camera movement on strong beats for extra impact
        if (beatStrength > 0.6) {
            // Small camera movement down to enhance "flying" feeling
            this.scene.cameras.main.pan(
                this.scene.cameras.main.midPoint.x,
                this.scene.cameras.main.midPoint.y + (10 * beatStrength),
                100,
                'Power2'
            );
            
            // Return camera to center
            this.scene.time.delayedCall(120, () => {
                this.scene.cameras.main.pan(
                    this.scene.cameras.main.midPoint.x,
                    this.scene.cameras.main.midPoint.y,
                    250,
                    'Sine.easeOut'
                );
            });
        }
        
        // Gradually return to normal speed with a smoother transition
        this.scene.time.delayedCall(150, () => { // Shorter delay for more immediate response
            this.scene.tweens.add({
                targets: this,
                starSpeed: 1.0, // Return to normal speed
                duration: 600, // Shorter duration for more immediate response
                ease: 'Expo.easeOut' // More dramatic easing curve
            });
        });
        
        // Check if we have our stars array
        if (this.stars && this.stars.length > 0) {
            // Animate different percentages of stars based on layer
            // (more close stars, fewer distant stars for a better 3D effect)
            const closeStars = this.stars.filter(star => star.active && star.layer === 2);
            const midStars = this.stars.filter(star => star.active && star.layer === 1);
            const farStars = this.stars.filter(star => star.active && star.layer === 0);
            
            // Calculate how many stars to animate in each layer based on beat strength
            const closeStarsCount = Math.floor(closeStars.length * Math.min(0.8, 0.4 + (beatStrength * 0.5)));
            const midStarsCount = Math.floor(midStars.length * Math.min(0.6, 0.3 + (beatStrength * 0.4)));
            const farStarsCount = Math.floor(farStars.length * Math.min(0.4, 0.2 + (beatStrength * 0.3)));
            
            // Helper function to animate a batch of stars
            const animateStars = (stars, count, scaleFactor) => {
                if (stars.length === 0) return;
                
                // Randomly select stars to animate
                const shuffled = [...stars].sort(() => 0.5 - Math.random());
                const selectedStars = shuffled.slice(0, count);
                
                // Animate the selected stars
                selectedStars.forEach(star => {
                    // Scale based on beat strength and layer
                    const maxScale = star.originalScale * (1 + (beatStrength * scaleFactor));
                    const maxAlpha = Math.min(1, star.originalAlpha * 1.5);
                    
                    // Stop any existing tweens on this star
                    this.scene.tweens.killTweensOf(star);
                    
                    // Create new tween - more dramatic for close stars
                    this.scene.tweens.add({
                        targets: star,
                        scale: maxScale,
                        alpha: maxAlpha,
                        duration: 150, // Slightly longer for visibility
                        yoyo: true,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            if (star.active) {
                                star.setScale(star.originalScale);
                                star.setAlpha(star.originalAlpha);
                            }
                        }
                    });
                    
                    // For stronger beats and closer stars, change color for emphasis
                    if (star.layer === 2 && beatStrength > 0.6 && Math.random() < 0.3) {
                        star.setFillStyle(0xffffff);
                        this.scene.time.delayedCall(200, () => {
                            if (star.active) {
                                // Return to original color based on layer
                                let brightness;
                                if (star.layer === 0) {
                                    brightness = Phaser.Math.Between(80, 120);
                                } else if (star.layer === 1) {
                                    brightness = Phaser.Math.Between(120, 180);
                                } else {
                                    brightness = Phaser.Math.Between(180, 255);
                                }
                                const color = Phaser.Display.Color.GetColor(brightness, brightness, brightness);
                                star.setFillStyle(color);
                            }
                        });
                    }
                    
                    // Boost individual star speed (more for close stars)
                    const speedMultiplier = star.layer === 2 ? 3.0 : (star.layer === 1 ? 2.0 : 1.0);
                    star.currentSpeed = star.baseSpeed * (1 + (beatStrength * speedMultiplier));
                    
                    // Gradually return to base speed
                    this.scene.tweens.add({
                        targets: star,
                        currentSpeed: star.baseSpeed,
                        duration: 1000,
                        ease: 'Sine.easeOut'
                    });
                });
            };
            
            // Animate each layer with different intensities
            animateStars(closeStars, closeStarsCount, 3.0); // Close stars pulse more dramatically
            animateStars(midStars, midStarsCount, 2.0); // Mid stars moderate pulse
            animateStars(farStars, farStarsCount, 1.0); // Far stars gentle pulse
        }
    }
}
