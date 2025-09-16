// CameraManager.js - Handles camera effects with position reset safeguards

export default class CameraManager {
    constructor(scene) {
        this.scene = scene;
        this.camera = scene.cameras.main;
        this.originalPosition = { x: 0, y: 0 };
        this.isShaking = false;
        this.isFlashing = false;
        this.shakeTween = null;
        this.flashTween = null;
        
        // Save original camera position
        this.saveOriginalPosition();
        
        // Create a timer that periodically resets camera position to prevent drift
        this.resetTimer = scene.time.addEvent({
            delay: 5000, // Check every 5 seconds
            callback: this.enforceCameraConstraints,
            callbackScope: this,
            loop: true
        });
    }
    
    /**
     * Saves the original camera position for reset operations
     */
    saveOriginalPosition() {
        if (this.camera) {
            this.originalPosition = {
                x: this.camera.scrollX,
                y: this.camera.scrollY
            };
            console.log("Camera position saved:", this.originalPosition);
        }
    }
    
    /**
     * Creates a safe camera shake effect that guarantees position reset
     * @param {number} duration - Duration of shake in ms
     * @param {number} intensity - Shake intensity (0.0 to 1.0)
     */
    shake(duration, intensity) {
        // If already shaking, don't add another shake effect
        if (this.isShaking) return;
        
        try {
            // Mark as shaking
            this.isShaking = true;
            
            // Store current position before shake
            const preShakePosition = {
                x: this.camera.scrollX,
                y: this.camera.scrollY
            };
            
            // Apply the builtin shake effect
            this.camera.shake(duration, intensity);
            
            // Set a timer to reset position after shake is done
            this.scene.time.delayedCall(duration + 50, () => {
                // Do position correction if needed
                this.resetCameraPosition(preShakePosition);
                this.isShaking = false;
            });
        } catch (error) {
            console.warn("Error in camera shake:", error);
            this.isShaking = false;
        }
    }
    
    /**
     * Creates a beat response camera effect that pushes in slightly then returns
     * @param {number} strength - Beat strength (0.0 to 1.0) 
     */
    beatResponse(strength) {
        if (this.isShaking) return;
        
        try {
            this.isShaking = true;
            
            // Store current position
            const startPos = {
                x: this.camera.scrollX,
                y: this.camera.scrollY
            };
            
            // Calculate a very small zoom effect based on beat strength
            const zoomAmount = 1 + (strength * 0.01); // Max 1% zoom
            const originalZoom = this.camera.zoom;
            
            // Create a quick zoom in/out effect
            this.scene.tweens.add({
                targets: this.camera,
                zoom: zoomAmount,
                duration: 100,
                yoyo: true,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    // Force reset zoom and position
                    this.camera.zoom = originalZoom;
                    this.resetCameraPosition(startPos);
                    this.isShaking = false;
                }
            });
        } catch (error) {
            console.warn("Error in camera beat response:", error);
            this.isShaking = false;
        }
    }
    
    /**
     * Resets camera position to either a specific position or original position
     * @param {Object} position - Position to reset to (optional)
     */
    resetCameraPosition(position = null) {
        if (!this.camera) return;
        
        try {
            // Use provided position or fall back to original saved position
            const targetPos = position || this.originalPosition;
            
            // Check if we need to reset - only if position has drifted
            const xDrift = Math.abs(this.camera.scrollX - targetPos.x);
            const yDrift = Math.abs(this.camera.scrollY - targetPos.y);
            
            if (xDrift > 2 || yDrift > 2) {
                // Use tween for smooth reset
                this.scene.tweens.add({
                    targets: this.camera,
                    scrollX: targetPos.x,
                    scrollY: targetPos.y,
                    duration: 300,
                    ease: 'Sine.easeOut'
                });
                
                console.log("Camera position reset due to drift:", {
                    from: { x: this.camera.scrollX, y: this.camera.scrollY },
                    to: targetPos
                });
            }
        } catch (error) {
            console.warn("Error resetting camera position:", error);
        }
    }
    
    /**
     * Periodically checks and enforces camera constraints to prevent drift
     */
    enforceCameraConstraints() {
        // Skip if camera is in the middle of effects
        if (this.isShaking || this.isFlashing) return;
        
        // Check for significant drift from original position
        if (this.camera) {
            const currentPos = {
                x: this.camera.scrollX,
                y: this.camera.scrollY
            };
            
            const xDrift = Math.abs(currentPos.x - this.originalPosition.x);
            const yDrift = Math.abs(currentPos.y - this.originalPosition.y);
            
            // If significant drift detected, reset camera position
            if (xDrift > 5 || yDrift > 5) {
                console.log("Enforcing camera constraints - drift detected:", {
                    drift: { x: xDrift, y: yDrift },
                    current: currentPos,
                    original: this.originalPosition
                });
                
                this.resetCameraPosition();
            }
        }
    }
    
    /**
     * Creates a flash effect on beats
     * @param {number} duration - Duration of flash in ms
     * @param {number} color - Color of flash
     * @param {number} alpha - Alpha value of flash (0.0 to 1.0)
     */
    flash(duration, color, alpha) {
        if (this.isFlashing) return;
        
        try {
            this.isFlashing = true;
            this.camera.flash(duration, color, color, alpha);
            
            // Reset flash state after effect is done
            this.scene.time.delayedCall(duration + 50, () => {
                this.isFlashing = false;
            });
        } catch (error) {
            console.warn("Error in camera flash:", error);
            this.isFlashing = false;
        }
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.resetTimer) {
            this.resetTimer.remove();
            this.resetTimer = null;
        }
        
        if (this.shakeTween) {
            this.shakeTween.stop();
            this.shakeTween = null;
        }
        
        if (this.flashTween) {
            this.flashTween.stop();
            this.flashTween = null;
        }
    }
}
