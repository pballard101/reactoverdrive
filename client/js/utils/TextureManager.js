// TextureManager.js - Creates and manages all game textures

export default class TextureManager {
    constructor(scene) {
        this.scene = scene;
    }
    
    createAllTextures() {
        try {
            this.createPlayerTexture();
            this.createParticleTextures();
            this.createPowerupHexTextures();
            this.createSidekickShipTexture();
            this.createBulletTexture(); // Ensure bullet texture is created
            
            // Verify textures were created successfully
            const textureKeys = this.scene.textures.getTextureKeys();
            console.log("All textures created successfully:", textureKeys);
            
            // Check for expected textures
            const expectedTextures = [
                'bullet', 'player-ship', 'star-particle', 'glow-particle', 
                'particle', 'line-particle', 'laser-beam', 
                'powerup-hex-blue', 'powerup-hex-green', 'powerup-hex-orange',
                'sidekick-ship'
            ];
            
            // Check if any expected textures are missing
            const missingTextures = expectedTextures.filter(name => !this.scene.textures.exists(name));
            
            if (missingTextures.length > 0) {
                console.warn("Missing textures detected:", missingTextures);
                // Try to recover by creating missing textures
                this.recreateMissingTextures(missingTextures);
            }
        } catch (error) {
            console.error("Error creating textures:", error);
            // Create fallback textures to prevent game from breaking
            this.createFallbackTextures();
        }
    }
    
    recreateMissingTextures(missingTextures) {
        // Try to recreate any missing textures
        missingTextures.forEach(textureName => {
            console.log(`Attempting to recreate missing texture: ${textureName}`);
            
            try {
                if (textureName === 'bullet') {
                    this.createBulletTexture();
                } else if (textureName === 'player-ship') {
                    this.createPlayerTexture();
                } else if (textureName.includes('particle') || textureName === 'laser-beam') {
                    this.createParticleTextures();
                } else if (textureName.includes('powerup-hex')) {
                    this.createPowerupHexTextures();
                } else if (textureName === 'sidekick-ship') {
                    this.createSidekickShipTexture();
                }
            } catch (error) {
                console.error(`Failed to recreate texture ${textureName}:`, error);
            }
        });
    }
    
    createFallbackTextures() {
        console.log("Creating fallback textures");
        
        try {
            // Create a simple white square to use as fallback for all textures
            const fallbackGraphics = this.scene.make.graphics({});
            fallbackGraphics.clear();
            fallbackGraphics.fillStyle(0xffffff, 1);
            fallbackGraphics.fillRect(0, 0, 16, 16);
            
            // Create a minimal set of fallback textures to keep the game running
            fallbackGraphics.generateTexture('bullet', 16, 16);
            fallbackGraphics.generateTexture('player-ship', 16, 16);
            fallbackGraphics.generateTexture('particle', 16, 16);
            fallbackGraphics.generateTexture('powerup-hex-blue', 16, 16);
            
            console.log("Fallback textures created successfully");
        } catch (error) {
            console.error("Failed to create fallback textures:", error);
        }
    }
    
    createPlayerTexture() {
        // Create a graphics object for the player ship
        const playerGraphics = this.scene.make.graphics({});
        
        // Draw a triangular ship
        playerGraphics.fillStyle(0x00ff00, 1); // Green fill
        playerGraphics.lineStyle(2, 0xffffff, 1); // White border
        
        // Draw the ship shape (triangle pointing right)
        playerGraphics.beginPath();
        playerGraphics.moveTo(5, 15); // Top left
        playerGraphics.lineTo(5, 30); // Bottom left
        playerGraphics.lineTo(40, 22.5); // Right center
        playerGraphics.lineTo(5, 15); // Back to top left
        playerGraphics.closePath();
        playerGraphics.fillPath();
        playerGraphics.strokePath();
        
        // Add engine glow
        playerGraphics.fillStyle(0x33ccff, 0.8); // Blue glow
        playerGraphics.fillRect(0, 18, 5, 9);
        
        // Generate a texture from the graphics
        playerGraphics.generateTexture('player-ship', 40, 45);
        console.log("Player ship texture created (facing right)");
    }
    
    createBulletTexture() {
        // Create bullet texture - make it more visible
        const bulletGraphics = this.scene.make.graphics({});
        
        // Clear any previous graphics
        bulletGraphics.clear();
        
        // Draw a green circle for the bullet
        bulletGraphics.fillStyle(0x00ff00, 1);
        bulletGraphics.fillCircle(4, 4, 4);
        
        // Generate the bullet texture with a specific name
        bulletGraphics.generateTexture('bullet', 8, 8);
        console.log("Bullet texture created");
    }
    
    createParticleTextures() {
        console.log("Creating particle textures using canvas approach");
        
        try {
            // Create star particle with canvas
            this.createStarParticleWithCanvas();
            
            // Create glow particle with canvas
            this.createGlowParticleWithCanvas();
            
            // Create regular particle
            this.createRegularParticleWithCanvas();
            
            // Create line particle
            this.createLineParticleWithCanvas();
            
            // Create laser beam
            this.createLaserBeamWithCanvas();
            
            // Verify textures were created
            const textureKeys = this.scene.textures.getTextureKeys();
            console.log("Particle textures created:", textureKeys.filter(key => 
                key.includes('particle') || key === 'laser-beam'));
                
            return true;
        } catch (error) {
            console.error("Error creating particle textures:", error);
            // Create simplified fallback textures
            this.createSimplifiedParticleTextures();
            return false;
        }
    }
    
    // Create a star particle using canvas (more reliable than graphics)
    createStarParticleWithCanvas() {
        try {
            // Create canvas with willReadFrequently flag
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
            
            // Add texture to the game
            this.scene.textures.addCanvas('star-particle', canvas);
            
            console.log("Successfully created star-particle texture using canvas");
            return true;
        } catch (error) {
            console.error("Failed to create star-particle texture with canvas:", error);
            return false;
        }
    }
    
    // Create a glow particle using canvas
    createGlowParticleWithCanvas() {
        try {
            // Create canvas with willReadFrequently flag
            const canvas = document.createElement('canvas');
            canvas.width = 16;
            canvas.height = 16;
            canvas.willReadFrequently = true;
            
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, 16, 16);
            
            // Create a softer gradient for glow effect
            const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');   // Almost white center
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)'); // Medium transparency
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');     // Fully transparent edge
            
            // Fill with gradient
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(8, 8, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Add texture to the game
            this.scene.textures.addCanvas('glow-particle', canvas);
            
            console.log("Successfully created glow-particle texture using canvas");
            return true;
        } catch (error) {
            console.error("Failed to create glow-particle texture with canvas:", error);
            return false;
        }
    }
    
    // Create a regular particle with canvas
    createRegularParticleWithCanvas() {
        try {
            // Create canvas with willReadFrequently flag
            const canvas = document.createElement('canvas');
            canvas.width = 8;
            canvas.height = 8;
            canvas.willReadFrequently = true;
            
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, 8, 8);
            
            // Create a simple soft circle
            const gradient = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');   // White center
            gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.7)'); // Edges fade slightly
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');   // More fade at the very edge
            
            // Fill with gradient
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(4, 4, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Add texture to the game
            this.scene.textures.addCanvas('particle', canvas);
            
            console.log("Successfully created particle texture using canvas");
            return true;
        } catch (error) {
            console.error("Failed to create particle texture with canvas:", error);
            return false;
        }
    }
    
    // Create a line particle with canvas
    createLineParticleWithCanvas() {
        try {
            // Create canvas with willReadFrequently flag
            const canvas = document.createElement('canvas');
            canvas.width = 2;
            canvas.height = 10;
            canvas.willReadFrequently = true;
            
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, 2, 10);
            
            // Create a gradient line (fading at edges)
            const gradient = ctx.createLinearGradient(0, 0, 0, 10);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');   // Fade at top
            gradient.addColorStop(0.2, 'rgba(255, 255, 255, 1.0)'); // Solid in middle
            gradient.addColorStop(0.8, 'rgba(255, 255, 255, 1.0)'); // Solid in middle
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');   // Fade at bottom
            
            // Fill with gradient
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 2, 10);
            
            // Add texture to the game
            this.scene.textures.addCanvas('line-particle', canvas);
            
            console.log("Successfully created line-particle texture using canvas");
            return true;
        } catch (error) {
            console.error("Failed to create line-particle texture with canvas:", error);
            return false;
        }
    }
    
    // Create a laser beam texture with canvas
    createLaserBeamWithCanvas() {
        try {
            // Create canvas with willReadFrequently flag
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 8;
            canvas.willReadFrequently = true;
            
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, 100, 8);
            
            // Create a vertical gradient for laser effect
            const gradient = ctx.createLinearGradient(0, 0, 0, 8);
            gradient.addColorStop(0, 'rgba(0, 255, 255, 0.4)');   // Fade at top
            gradient.addColorStop(0.5, 'rgba(0, 255, 255, 1.0)');  // Full cyan in middle
            gradient.addColorStop(1, 'rgba(0, 255, 255, 0.4)');   // Fade at bottom
            
            // Fill with gradient
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 100, 8);
            
            // Add a glow in the center
            const centerGradient = ctx.createLinearGradient(0, 3, 0, 5);
            centerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
            centerGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
            centerGradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
            
            ctx.fillStyle = centerGradient;
            ctx.fillRect(0, 3, 100, 2);
            
            // Add texture to the game
            this.scene.textures.addCanvas('laser-beam', canvas);
            
            console.log("Successfully created laser-beam texture using canvas");
            return true;
        } catch (error) {
            console.error("Failed to create laser-beam texture with canvas:", error);
            return false;
        }
    }
    
    createSimplifiedParticleTextures() {
        console.log("Creating simplified particle textures");
        
        try {
            // Create a shared fallback texture for circular particles
            const circleGraphics = this.scene.make.graphics({});
            circleGraphics.clear();
            circleGraphics.fillStyle(0xffffff, 1);
            circleGraphics.fillCircle(4, 4, 4); // Circle instead of square
            
            // Generate circular particle textures
            circleGraphics.generateTexture('star-particle', 8, 8);
            circleGraphics.generateTexture('glow-particle', 8, 8);
            circleGraphics.generateTexture('particle', 8, 8);
            
            // Create a separate graphic for the line particle
            const lineGraphics = this.scene.make.graphics({});
            lineGraphics.clear();
            lineGraphics.fillStyle(0xffffff, 1);
            lineGraphics.fillRect(0, 0, 2, 8);
            lineGraphics.generateTexture('line-particle', 2, 8);
            
            // Create a laser beam texture
            const laserGraphics = this.scene.make.graphics({});
            laserGraphics.clear();
            laserGraphics.fillStyle(0xffffff, 1);
            laserGraphics.fillRect(0, 0, 32, 8);
            laserGraphics.generateTexture('laser-beam', 32, 8);
            
            console.log("Simplified particle textures created");
        } catch (error) {
            console.error("Failed to create simplified particle textures:", error);
        }
    }
    
    createPowerupHexTextures() {
        console.log("Creating powerup hex textures using canvas approach");
        
        // Define colors and names
        const powerupHexColors = [0x0088ff, 0x00ff88, 0xff8800]; // Blue, Green, Orange
        const powerupHexColorNames = ['blue', 'green', 'orange'];
        const hexSize = 30; // Size of the hexagon
                
        // Create textures for each color state using canvas
        powerupHexColors.forEach((color, index) => {
            try {
                // Convert hex color to rgba string
                const hexString = '#' + color.toString(16).padStart(6, '0');
                const colorName = powerupHexColorNames[index];
                
                // Create canvas with willReadFrequently flag
                const canvas = document.createElement('canvas');
                canvas.width = hexSize;
                canvas.height = hexSize;
                canvas.willReadFrequently = true;
                
                const ctx = canvas.getContext('2d');
                
                // Clear canvas
                ctx.clearRect(0, 0, hexSize, hexSize);
                
                // Set fill and stroke styles
                ctx.fillStyle = hexString;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                
                // Draw hexagon
                const hexRadius = hexSize / 2;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const x = hexSize / 2 + hexRadius * 0.8 * Math.cos(angle);
                    const y = hexSize / 2 + hexRadius * 0.8 * Math.sin(angle);
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                // Add internal glow
                const innerRadius = hexRadius * 0.6;
                const gradient = ctx.createRadialGradient(
                    hexSize/2, hexSize/2, innerRadius * 0.1,
                    hexSize/2, hexSize/2, innerRadius
                );
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(hexSize/2, hexSize/2, innerRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // Add texture to the game
                this.scene.textures.addCanvas(`powerup-hex-${colorName}`, canvas);
                
                console.log(`Successfully created powerup-hex-${colorName} texture using canvas`);
            } catch (error) {
                console.error(`Failed to create powerup-hex-${powerupHexColorNames[index]} texture:`, error);
            }
        });
        
        console.log("Powerup hex textures created");
    }
    
    createSidekickShipTexture() {
        // Create a small ship shape for the sidekick
        const shipGraphics = this.scene.make.graphics({});
        
        // Draw a triangular ship (similar to player but blue)
        shipGraphics.fillStyle(0x00aaff, 1); // Blue fill
        shipGraphics.lineStyle(2, 0xffffff, 1); // White border
        
        // Draw the ship shape (triangle pointing right to match player)
        shipGraphics.beginPath();
        shipGraphics.moveTo(3, 10); // Top left
        shipGraphics.lineTo(3, 20); // Bottom left
        shipGraphics.lineTo(23, 15); // Right center
        shipGraphics.lineTo(3, 10); // Back to top left
        shipGraphics.closePath();
        shipGraphics.fillPath();
        shipGraphics.strokePath();
        
        // Add engine glow
        shipGraphics.fillStyle(0x33ccff, 0.8); // Blue glow
        shipGraphics.fillRect(0, 12, 3, 6);
        
        // Generate texture
        shipGraphics.generateTexture('sidekick-ship', 23, 30);
        
        console.log("Sidekick ship texture created (facing right)");
    }
}
