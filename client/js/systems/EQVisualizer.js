// EQVisualizer.js - Classic EQ visualizer with just boxes - no background lanes

export default class EQVisualizer {
    constructor(scene) {
        this.scene = scene;
        this.eqBoxes = []; // Arrays of small boxes for each lane
        this.colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0x8b00ff]; // Colors for each note
        
        // Calculate lane height to fill screen
        this.laneHeight = this.scene.gameHeight / 7;
        
        // Use up to 90% of screen width for visualization (increased from 85%)
        this.maxVisualizerWidth = this.scene.gameWidth * 0.9;
        
        // Increased number of boxes per lane (from 25 to 38) to extend visualizer 50% further
        this.boxCount = 38;
        
        // Flag to track if the visualizer is active
        this.active = true;
        
        // Setup visualization
        this.setupVisualization();
    }
    
    setupVisualization() {
        // Create EQ boxes for each note
        for (let i = 0; i < 7; i++) {
            const y = this.getYPosition(i);
            const color = this.colors[i];
            
            // Create boxes for this lane
            this.createEQBoxes(i, y, color);
        }
    }
    
    createEQBoxes(laneIndex, y, color) {
        // Box dimensions - height is 100% of lane height to remove vertical gaps
        const boxHeight = this.laneHeight;
        // Width is 1/4 of height as requested
        const boxWidth = boxHeight * 0.25;
        // Restore horizontal gap between boxes as requested
        const boxGap = boxWidth * 0.15;
        
        // Calculate total width needed
        const totalWidth = (boxWidth + boxGap) * this.boxCount;
        
        // Make sure it doesn't exceed our max width
        const actualWidth = Math.min(totalWidth, this.maxVisualizerWidth);
        
        // Recalculate box count if needed
        const actualBoxCount = Math.floor(actualWidth / (boxWidth + boxGap));
        
        // Array to store boxes
        const boxes = [];
        
        // Create boxes from right to left
        for (let i = 0; i < actualBoxCount; i++) {
            // Calculate x position - starting from right side
            const x = this.scene.gameWidth - (i * (boxWidth + boxGap)) - boxWidth/2;
            
            // Calculate alpha (opacity) based on position
            // Stronger falloff for more dramatic gradient
            // Boxes on far right stay opaque, fade out more quickly to the left
            const alphaRatio = 1 - (i / actualBoxCount);
            const alpha = Math.pow(alphaRatio, 2) * 0.9 + 0.1; // Ensure minimum alpha of 0.1
            
            // Create box
            const box = this.scene.add.rectangle(
                x,         // Position from right to left
                y,         // Vertical center of lane
                boxWidth,  // Narrow width (1/4 of height)
                boxHeight, // Box height
                color      // Lane color
            ).setOrigin(0.5, 0.5) // Center origin
             .setAlpha(alpha)    // Gradient alpha
             .setDepth(-4)       // Above lane background
             .setVisible(false); // Hidden initially
            
            boxes.push(box);
        }
        
        // Store the boxes for this lane
        this.eqBoxes[laneIndex] = boxes;
    }
    
    getYPosition(index) {
        // Position in the center of each lane
        return (index * this.laneHeight) + (this.laneHeight / 2);
    }
    
    pulseBar(laneIndex, energy) {
        // Skip if visualizer is not active
        if (!this.active) return;
        
        // Make sure index is valid
        if (laneIndex < 0 || laneIndex >= this.eqBoxes.length) return;
        
        // Get boxes for this lane
        const boxes = this.eqBoxes[laneIndex];
        if (!boxes || boxes.length === 0) return;
        
        // Boost energy for better visual effect
        const boostedEnergy = Math.min(1.0, energy * 1.3);
        
        // Calculate how many boxes to show based on energy
        const boxesToShow = Math.max(1, Math.ceil(boxes.length * boostedEnergy));
        
        // Reset all boxes to their original state first
        boxes.forEach(box => {
            box.setVisible(false);
            box.setScale(1);
            
            // Make sure any active tweens are stopped
            this.scene.tweens.killTweensOf(box);
        });
        
        // Show/hide boxes based on energy level
        boxes.forEach((box, i) => {
            // Show boxes from right to left up to the energy level
            if (i < boxesToShow) {
                box.setVisible(true);
                
                // Get the base alpha value
                const baseAlpha = box.alpha;
                
                // Create pulse effect - briefly increase alpha then return
                this.scene.tweens.add({
                    targets: box,
                    alpha: Math.min(1.0, baseAlpha * 1.5), // Increase alpha but not beyond 1.0
                    scaleY: 1.2,         // Slightly taller
                    duration: 150 * (1 - i/boxes.length), // Faster for right boxes
                    ease: 'Quad.Out',
                    yoyo: true,
                    onComplete: () => {
                        // Begin fade out 
                        this.scene.tweens.add({
                            targets: box,
                            alpha: 0,
                            scaleY: 0.3,
                            duration: 500,
                            ease: 'Cubic.In',
                            delay: i * 15, // Stagger the fade-out
                            onComplete: () => {
                                box.setVisible(false);
                                box.setScale(1); // Reset scale
                                
                                // Restore original alpha for next use
                                const alphaRatio = 1 - (i / boxes.length);
                                const alpha = Math.pow(alphaRatio, 2) * 0.9 + 0.1;
                                box.setAlpha(alpha);
                            }
                        });
                    }
                });
            }
        });
    }
    
    activateLane(note, energy) {
        let noteIndex = ["C", "D", "E", "F", "G", "A", "B"].indexOf(note[0]);
        if (noteIndex === -1) return;
        
        // Ensure the visualizer is active
        this.active = true;
        
        // Pulse the corresponding bar with the note energy
        this.pulseBar(noteIndex, energy);
    }
    
    // Method to handle player getting hit
    handlePlayerHit() {
        // Reset all boxes to ensure they can be shown again
        for (let laneIndex = 0; laneIndex < this.eqBoxes.length; laneIndex++) {
            const boxes = this.eqBoxes[laneIndex];
            if (boxes) {
                boxes.forEach(box => {
                    // Stop any ongoing animations
                    this.scene.tweens.killTweensOf(box);
                    
                    // Reset the box to its original state
                    box.setVisible(false);
                    box.setScale(1);
                    
                    // Restore original alpha
                    const i = boxes.indexOf(box);
                    const alphaRatio = 1 - (i / boxes.length);
                    const alpha = Math.pow(alphaRatio, 2) * 0.9 + 0.1;
                    box.setAlpha(alpha);
                });
            }
        }
        
        // Ensure visualizer is active
        this.active = true;
    }
    
    update() {
        // Method kept for consistency, but not needed now
    }
}
