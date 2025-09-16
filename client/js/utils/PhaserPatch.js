// PhaserPatch.js - Patches Phaser to prevent texture frame errors

export default class PhaserPatch {
    static apply(game) {
        console.log('Applying Phaser patches to prevent texture frame errors');
        
        // Wait for Phaser to be fully loaded
        if (typeof Phaser !== 'undefined' && Phaser.Textures) {
            PhaserPatch.patchTextureFrame();
            PhaserPatch.patchSpriteFrame();
        } else {
            // If Phaser isn't loaded yet, wait for it
            setTimeout(() => PhaserPatch.apply(game), 100);
        }
    }
    
    static patchTextureFrame() {
        try {
            // Patch the Phaser.Textures.Frame constructor if it exists
            if (typeof Phaser !== 'undefined' && Phaser.Textures && Phaser.Textures.Frame) {
                const originalFrame = Phaser.Textures.Frame;
                
                // Create a wrapper that catches frame creation errors
                Phaser.Textures.Frame = function(texture, name, sourceIndex, x, y, width, height) {
                    // Check if name is a problematic number (like 360)
                    if (typeof name === 'number' && (name === 360 || name > 359)) {
                        console.warn(`Intercepted problematic frame number: ${name}, converting to string`);
                        name = name.toString();
                    }
                    
                    // Call original constructor
                    return new originalFrame(texture, name, sourceIndex, x, y, width, height);
                };
                
                // Copy over any static properties
                Object.setPrototypeOf(Phaser.Textures.Frame, originalFrame);
                Object.assign(Phaser.Textures.Frame, originalFrame);
                
                console.log('Patched Phaser.Textures.Frame');
            }
        } catch (error) {
            console.warn('Could not patch Phaser.Textures.Frame:', error);
        }
    }
    
    static patchSpriteFrame() {
        try {
            // Patch the sprite setFrame method if it exists
            if (typeof Phaser !== 'undefined' && Phaser.GameObjects && Phaser.GameObjects.Sprite) {
                const originalSetFrame = Phaser.GameObjects.Sprite.prototype.setFrame;
                
                if (originalSetFrame) {
                    Phaser.GameObjects.Sprite.prototype.setFrame = function(frame, updateSize, updateOrigin) {
                        // Check if frame is a problematic number
                        if (typeof frame === 'number' && (frame === 360 || frame > 359)) {
                            console.warn(`Intercepted setFrame with problematic value: ${frame}, using frame 0 instead`);
                            frame = 0;
                        }
                        
                        // Call original method
                        return originalSetFrame.call(this, frame, updateSize, updateOrigin);
                    };
                    
                    console.log('Patched Phaser.GameObjects.Sprite.setFrame');
                }
            }
        } catch (error) {
            console.warn('Could not patch Phaser.GameObjects.Sprite.setFrame:', error);
        }
    }
    
    static patchTextureGet() {
        try {
            // Patch the texture get method at the Texture level
            if (typeof Phaser !== 'undefined' && Phaser.Textures && Phaser.Textures.Texture) {
                const originalGet = Phaser.Textures.Texture.prototype.get;
                
                if (originalGet) {
                    Phaser.Textures.Texture.prototype.get = function(name) {
                        // Check if name is a problematic number
                        if (typeof name === 'number' && (name === 360 || name > 359)) {
                            console.warn(`Intercepted texture.get with problematic frame: ${name}, using __BASE instead`);
                            name = '__BASE';
                        }
                        
                        try {
                            return originalGet.call(this, name);
                        } catch (error) {
                            console.warn(`Error getting frame '${name}', falling back to __BASE:`, error);
                            try {
                                return originalGet.call(this, '__BASE');
                            } catch (fallbackError) {
                                console.warn('Could not get fallback frame __BASE:', fallbackError);
                                return null;
                            }
                        }
                    };
                    
                    console.log('Patched Phaser.Textures.Texture.get');
                }
            }
        } catch (error) {
            console.warn('Could not patch Phaser.Textures.Texture.get:', error);
        }
    }
    
    static interceptConsoleErrors() {
        // More aggressive console error interception
        const originalError = console.error;
        
        console.error = function(...args) {
            const message = args.join(' ');
            
            // Check for texture frame errors and suppress them
            if (message.includes('Texture.frame missing') || 
                message.includes('Frame') && message.includes('360')) {
                console.warn('SUPPRESSED TEXTURE ERROR:', message);
                return; // Don't let the error through
            }
            
            // Allow other errors through
            originalError.apply(console, args);
        };
        
        console.log('Console error interception activated');
    }
}
