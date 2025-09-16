// MusicWorm.js - Smooth musical worm that grows from right edge with curved segments

export default class MusicWorm {
    constructor(scene, noteSequence, startX = null) {
        
        this.scene = scene;
        this.noteSequence = noteSequence; // Array of {note, time, duration} objects
        this.startX = startX || (scene.gameWidth || 1280) + 50; // Start off-screen to the right
        // Worm properties
        this.segments = []; // Array of segment objects
        this.isActive = true;
        this.speed = 80; // Horizontal movement speed
        this.growthTimer = null;
        this.segmentSpacing = 45; // Increased spacing for smoother sine wave curves
        this.maxSegments = Math.min(noteSequence.length, 10); // Limit for better performance
        
        // Segment properties
        this.segmentSize = 12; // Reduced from 16 for thinner profile
        this.headSize = 16; // Reduced from 20 for thinner profile
        this.segmentColors = [
            0xff4444, // C - Red
            0xff8844, // D - Orange
            0xffff44, // E - Yellow  
            0x44ff44, // F - Green
            0x44ffff, // G - Cyan
            0x4444ff, // A - Blue
            0x8844ff  // B - Purple
        ];
        
        // Growth timing - slower for smoother appearance
        this.growthInterval = 400; // Add new segment every 400ms
        this.currentNoteIndex = 1; // Start from second note (first is head)
        
        // Hit tracking
        this.segmentsDestroyed = 0;
        this.isDestroyed = false;
        
        // Energy weapon chain destruction
        this.isEnergyDestroying = false;
        this.energyChainTimer = null;
        this.totalEnergyPoints = 0;
        
        // Rainbow line effect
        this.rainbowTime = 0;
        
        // Smooth movement properties
        this.targetPositions = []; // Target Y positions for smooth transitions
        this.smoothingFactor = 0.08; // How quickly segments move to target positions
        
        // VISIBLE ORGANIC MOVEMENT SYSTEM
        this.wormSeed = Math.random() * 1000; // Unique seed for this worm's personality
        this.waveAmplitude = 15 + (Math.random() * 10); // Increased to 15-25 pixels of wave motion for visibility
        this.waveFrequency = 0.003 + (Math.random() * 0.002); // Slower wave speeds
        this.bobAmplitude = 8 + (Math.random() * 7); // Increased to 8-15 pixels of vertical bobbing for visibility
        this.bobFrequency = 0.006 + (Math.random() * 0.004); // Slower bob speeds
        
        // MODERATE INDEPENDENCE - reduced time offsets
        this.timeOffset = Math.random() * 3000; // Smaller time offset for less chaos
        this.wavePhaseShift = Math.random() * Math.PI * 2; // Random wave phase shift
        this.bobPhaseShift = Math.random() * Math.PI * 2; // Random bob phase shift
        
        // UNIQUE COLOR SYSTEM PER WORM
        this.colorSeed = Math.random() * 360; // Starting hue offset
        this.colorPalette = this.generateUniqueColorPalette();
        this.currentColorIndex = 0;
        this.colorTransitionProgress = 0;
        this.lastBeatTime = 0;
        this.beatSensitivity = 0.6 + (Math.random() * 0.4); // Different beat sensitivity per worm
        this.colorChangeChance = 0.3 + (Math.random() * 0.4); // 30-70% chance to change on beat
        
        // CURVE ENHANCEMENT
        this.curveTension = 0.3 + (Math.random() * 0.2); // Curve tightness personality
        this.curveVariation = 0.5 + (Math.random() * 0.5); // Amount of curve variation
        
        // ENHANCED WORMY CURVE SYSTEM
        this.curveDepth = 30 + (Math.random() * 15); // Moderate curve depth for organic flow
        this.curveSmoothing = 0.7 + (Math.random() * 0.3); // Curve smoothing factor
        this.curveFlowAmplitude = 20 + (Math.random() * 15); // Enhanced flow variation for worminess
        
        // Wormy personality traits
        this.slitherAmplitude = 25 + (Math.random() * 20); // 25-45 pixels of snake-like slithering
        this.slitherFrequency = 0.008 + (Math.random() * 0.004); // Slower, more natural undulation
        this.wormyPhaseOffset = Math.random() * Math.PI * 2; // Random phase for each worm
        this.segmentLag = 0.3 + (Math.random() * 0.4); // How much segments lag behind (0.3-0.7)
        
        // Unified curve system - segments and curves use the same data
        this.curvePoints = []; // Master array of curve points
        this.curveResolution = 40; // Reduced resolution for more organic curves
        this.segmentToPointIndex = new Map(); // Maps segments to curve point indices
        
        // Create the worm container and graphics
        this.createWormContainer();
        
        // Create initial head segment off-screen
        this.createHeadSegment();
        
        // Start the growth process
        this.startGrowth();
        
    }
    
    /**
     * Generate a unique color palette for this worm based on its seed
     */
    generateUniqueColorPalette() {
        const palette = [];
        const baseHue = this.colorSeed; // Starting hue based on worm seed
        const hueStep = 40 + (Math.random() * 20); // 40-60 degree steps for color variation
        
        // Generate 6 colors with different saturations and brightness
        for (let i = 0; i < 6; i++) {
            const hue = (baseHue + (i * hueStep)) % 360;
            const saturation = 0.7 + (Math.random() * 0.3); // 70-100% saturation
            const brightness = 0.8 + (Math.random() * 0.2); // 80-100% brightness
            
            const rgbColor = Phaser.Display.Color.HSVToRGB(hue / 360, saturation, brightness);
            palette.push(rgbColor.color);
        }
        
        return palette;
    }
    
    /**
     * Get the current color for this worm based on beat detection and transitions
     */
    getCurrentWormColor(segmentIndex = 0) {
        // Check for beat detection and color changes
        this.updateColorOnBeat();
        
        // Get current and next colors from palette
        const currentColor = this.colorPalette[this.currentColorIndex];
        const nextColor = this.colorPalette[(this.currentColorIndex + 1) % this.colorPalette.length];
        
        // If transitioning, interpolate between colors
        if (this.colorTransitionProgress > 0) {
            const r1 = (currentColor >> 16) & 0xFF;
            const g1 = (currentColor >> 8) & 0xFF;
            const b1 = currentColor & 0xFF;
            
            const r2 = (nextColor >> 16) & 0xFF;
            const g2 = (nextColor >> 8) & 0xFF;
            const b2 = nextColor & 0xFF;
            
            const t = this.colorTransitionProgress;
            const r = Math.round(r1 + (r2 - r1) * t);
            const g = Math.round(g1 + (g2 - g1) * t);
            const b = Math.round(b1 + (b2 - b1) * t);
            
            return (r << 16) | (g << 8) | b;
        }
        
        // Add slight variation per segment for richness
        const hueOffset = (segmentIndex * 5) % 30; // Small hue shift per segment
        const hsv = Phaser.Display.Color.RGBToHSV(
            (currentColor >> 16) & 0xFF,
            (currentColor >> 8) & 0xFF,
            currentColor & 0xFF
        );
        
        hsv.h = (hsv.h + hueOffset / 360) % 1;
        const finalColor = Phaser.Display.Color.HSVToRGB(hsv.h, hsv.s, hsv.v);
        return finalColor.color;
    }
    
    /**
     * Update color changes based on beat detection
     */
    updateColorOnBeat() {
        if (!this.scene.audioAnalyzer) return;
        
        const currentTime = this.scene.time.now;
        const timeSinceLastBeat = currentTime - this.lastBeatTime;
        
        // Simple beat detection based on volume spikes
        const currentVolume = this.scene.audioAnalyzer.currentVolume || 0;
        const isBeat = currentVolume > this.beatSensitivity && timeSinceLastBeat > 200; // Minimum 200ms between beats
        
        if (isBeat && Math.random() < this.colorChangeChance) {
            // Start color transition
            this.lastBeatTime = currentTime;
            this.currentColorIndex = (this.currentColorIndex + 1) % this.colorPalette.length;
            this.colorTransitionProgress = 0;
            
            // Animate color transition
            this.scene.tweens.add({
                targets: this,
                colorTransitionProgress: 1,
                duration: 300 + (Math.random() * 200), // 300-500ms transition
                ease: 'Power2.easeOut',
                onComplete: () => {
                    this.colorTransitionProgress = 0;
                }
            });
        }
    }
    
    /**
     * Generate the unified curve points array that both segments and curves use
     */
    generateUnifiedCurvePoints(currentTime) {
        if (this.segments.length === 0) {
            this.curvePoints = [];
            return;
        }
        
        // Sort segments by X position
        const sortedSegments = [...this.segments].sort((a, b) => a.x - b.x);
        
        // Calculate base segment positions with organic movement
        const baseSegmentPoints = sortedSegments.map((segment, segmentIndex) => {
            // Base position
            let organicX = segment.x;
            let organicY = segment.smoothY || segment.y;
            
            // Independent timing per worm
            const independentTime = currentTime + this.timeOffset;
            
            // Horizontal wave motion (creates the ~~~ effect)
            const wavePhase = (independentTime * this.waveFrequency) + 
                             (segmentIndex * 0.4) + 
                             this.wavePhaseShift + 
                             this.wormSeed;
            const horizontalWave = Math.sin(wavePhase) * this.waveAmplitude;
            organicX += horizontalWave;
            
            // Vertical bobbing
            const bobPhase = (independentTime * this.bobFrequency) + 
                            (segmentIndex * 0.6) + 
                            this.bobPhaseShift +
                            this.wormSeed;
            const verticalBob = Math.sin(bobPhase) * this.bobAmplitude;
            organicY += verticalBob;
            
            // ENHANCED WORMY SLITHERING SYSTEM - Snake-like movement
            
            // Primary slithering motion - creates the main snake-like S-curve movement
            const slitherPhase = (independentTime * this.slitherFrequency) + 
                                (segmentIndex * this.segmentLag) + 
                                this.wormyPhaseOffset;
            const primarySlither = Math.sin(slitherPhase) * this.slitherAmplitude;
            
            // Secondary undulation - adds flowing ~~~ motion on top of slithering
            const undulationPhase = (independentTime * this.waveFrequency * 1.5) + 
                                   (segmentIndex * 0.8) + 
                                   this.wavePhaseShift;
            const secondaryUndulation = Math.sin(undulationPhase) * this.curveFlowAmplitude * 0.4;
            
            // Tertiary body wave - segments follow the head with delay (snake-like trailing)
            const bodyWavePhase = (independentTime * this.bobFrequency * 0.7) + 
                                 (segmentIndex * this.segmentLag * 2) + 
                                 this.bobPhaseShift;
            const tertiaryBodyWave = Math.sin(bodyWavePhase) * this.curveDepth * 0.3;
            
            // Combine all wormy movements for natural snake-like flow
            const wormyFlow = primarySlither + secondaryUndulation + tertiaryBodyWave;
            organicY += wormyFlow;
            
            // Add slight horizontal slithering too for full snake effect
            const horizontalSlither = Math.sin(slitherPhase * 0.7) * (this.slitherAmplitude * 0.2);
            organicX += horizontalSlither;
            
            // Age-based variation (segments get more animated as they age)
            const ageVariation = Math.min(segment.age / 2, 1);
            const finalY = organicY * ageVariation + (segment.smoothY || segment.y) * (1 - ageVariation);
            
            return {
                x: organicX,
                y: finalY,
                segmentIndex: segmentIndex,
                segment: segment,
                shrinkScale: (segment.isShrinking && segment.shrinkScale !== undefined) ? segment.shrinkScale : 1.0
            };
        });
        
        // Generate high-resolution curve points using Catmull-Rom interpolation
        this.curvePoints = [];
        this.segmentToPointIndex.clear();
        
        if (baseSegmentPoints.length < 2) {
            // Single segment - just add it as a single point
            if (baseSegmentPoints.length === 1) {
                this.curvePoints.push(baseSegmentPoints[0]);
                this.segmentToPointIndex.set(baseSegmentPoints[0].segment, 0);
            }
            return;
        }
        
        // Interpolate between segment points with high resolution
        for (let i = 0; i < baseSegmentPoints.length - 1; i++) {
            const p0 = i > 0 ? baseSegmentPoints[i - 1] : baseSegmentPoints[i];
            const p1 = baseSegmentPoints[i];
            const p2 = baseSegmentPoints[i + 1];
            const p3 = i < baseSegmentPoints.length - 2 ? baseSegmentPoints[i + 2] : baseSegmentPoints[i + 1];
            
            // Map current segment to its point index in curve
            this.segmentToPointIndex.set(p1.segment, this.curvePoints.length);
            
            // Add the segment point itself
            this.curvePoints.push(p1);
            
            // Check for shrinking segments
            let segmentScale = Math.min(p1.shrinkScale, p2.shrinkScale);
            if (segmentScale <= 0) continue;
            
            // Generate interpolated points between segments using Catmull-Rom
            for (let t = 1; t <= this.curveResolution; t++) {
                const normalizedT = t / this.curveResolution;
                const effectiveT = normalizedT * segmentScale;
                
                if (effectiveT > segmentScale) break;
                
                // Catmull-Rom spline calculation
                const t2 = effectiveT * effectiveT;
                const t3 = t2 * effectiveT;
                
                // Catmull-Rom basis functions
                const f1 = -0.5 * t3 + t2 - 0.5 * effectiveT;
                const f2 = 1.5 * t3 - 2.5 * t2 + 1.0;
                const f3 = -1.5 * t3 + 2.0 * t2 + 0.5 * effectiveT;
                const f4 = 0.5 * t3 - 0.5 * t2;
                
                // Calculate smooth spline point
                const x = f1 * p0.x + f2 * p1.x + f3 * p2.x + f4 * p3.x;
                const y = f1 * p0.y + f2 * p1.y + f3 * p2.y + f4 * p3.y;
                
                this.curvePoints.push({
                    x: x,
                    y: y,
                    segmentIndex: -1, // Interpolated point, not a segment
                    segment: null,
                    shrinkScale: segmentScale
                });
                
                // Stop if we're interpolating a shrinking segment
                if (segmentScale < 1.0 && normalizedT >= segmentScale) {
                    break;
                }
            }
        }
        
        // Add the last segment
        if (baseSegmentPoints.length > 1) {
            const lastSegment = baseSegmentPoints[baseSegmentPoints.length - 1];
            this.segmentToPointIndex.set(lastSegment.segment, this.curvePoints.length);
            this.curvePoints.push(lastSegment);
        }
    }
    
    /**
     * Get the unified position for a segment from the curve points array
     */
    getUnifiedSegmentPosition(segment) {
        const pointIndex = this.segmentToPointIndex.get(segment);
        if (pointIndex !== undefined && this.curvePoints[pointIndex]) {
            const point = this.curvePoints[pointIndex];
            return {
                x: point.x,
                y: point.y,
                visualX: point.x,
                visualY: point.y
            };
        }
        
        // Fallback to basic position if not found in curve points
        return {
            x: segment.x,
            y: segment.smoothY || segment.y,
            visualX: segment.x,
            visualY: segment.smoothY || segment.y
        };
    }
    
    /**
     * Create a procedural worm texture for the rope
     */
    createWormTexture() {
        const textureKey = `wormTexture_${this.wormSeed}`;
        
        // Check if texture already exists
        if (this.scene.textures.exists(textureKey)) {
            return textureKey;
        }
        
        // Create a procedural circular worm texture
        const size = 24; // Texture size
        const canvas = this.scene.textures.createCanvas(textureKey, size, size);
        const ctx = canvas.getContext('2d');
        
        // Create gradient for depth
        const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        
        // Use the worm's unique color palette for the texture
        const baseColor = this.colorPalette[0];
        const r = (baseColor >> 16) & 0xFF;
        const g = (baseColor >> 8) & 0xFF;
        const b = baseColor & 0xFF;
        
        gradient.addColorStop(0, `rgba(${r + 40}, ${g + 40}, ${b + 40}, 1.0)`); // Lighter center
        gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 1.0)`); // Base color
        gradient.addColorStop(1, `rgba(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)}, 0.8)`); // Darker edge
        
        // Draw the circular worm segment
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a subtle highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(size/2 - 3, size/2 - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        
        canvas.refresh();
        
        return textureKey;
    }
    
    /**
     * Create the rope-based worm container
     */
    createWormContainer() {
        this.wormContainer = this.scene.add.container(0, 0);
        this.wormContainer.setDepth(5); // Above enemies but below UI
        
        // Create the worm texture
        this.wormTextureKey = this.createWormTexture();
        
        // Initialize rope points array (will grow as segments are added)
        this.ropePoints = [];
        this.rope = null;
        
        // Initialize collision areas
        this.collisionAreas = [];
        this.frontmostCollisionArea = null;
        
    }
    
    /**
     * Create the head segment starting off-screen to the right
     */
    createHeadSegment() {
        const firstNote = this.noteSequence[0];
        const laneY = this.scene.enemyManager.getNoteYPosition(firstNote.note);
        
        // Create head segment starting off-screen
        const segment = {
            x: this.startX,
            y: laneY,
            targetY: laneY,
            smoothY: laneY, // For smooth transitions
            note: firstNote.note,
            noteIndex: 0,
            segmentIndex: 0,
            size: this.headSize,
            hitArea: null,
            isHead: true,
            age: 0 // Track how long segment has existed
        };
        
        // Add to segments array
        this.segments.push(segment);
        
        // Create hit area for this segment
        this.createSegmentHitArea(segment);
        
        // Update visuals
        this.updateWormVisuals();
        
    }
    
    /**
     * Start the growth process
     */
    startGrowth() {
        this.growthTimer = this.scene.time.addEvent({
            delay: this.growthInterval,
            callback: () => {
                if (this.isActive && !this.isDestroyed && this.segments.length < this.maxSegments && this.currentNoteIndex < this.noteSequence.length) {
                    this.addNewSegment();
                }
            },
            loop: true
        });
    }
    
    /**
     * Add a new segment that extends the worm from the tail
     */
    addNewSegment() {
        if (this.segments.length >= this.maxSegments || this.currentNoteIndex >= this.noteSequence.length) return;
        
        // Safety check for segments array
        if (!this.segments || this.segments.length === 0) {
            console.error("🐛 Cannot add segment - segments array is empty or undefined");
            return;
        }
        
        // Get the note for this segment
        const note = this.noteSequence[this.currentNoteIndex];
        if (!note) {
            console.error("🐛 Cannot add segment - note is undefined at index", this.currentNoteIndex);
            return;
        }
        
        const laneY = this.scene.enemyManager.getNoteYPosition(note.note);
        
        // Find the tail (rightmost) segment to extend from
        let tailSegment = this.segments[this.segments.length - 1];
        
        // Safety check for tailSegment
        if (!tailSegment) {
            console.error("🐛 Cannot add segment - tail segment is undefined");
            return;
        }
        
        if (this.segments.length > 1) {
            // Sort by X to find the actual tail
            const sortedSegments = [...this.segments].sort((a, b) => b.x - a.x);
            if (sortedSegments.length > 0) {
                tailSegment = sortedSegments[0];
            }
        }
        
        // Final safety check
        if (!tailSegment || tailSegment.x === undefined) {
            console.error("🐛 Cannot add segment - tailSegment.x is undefined", tailSegment);
            return;
        }
        
        // Add new segment behind the tail (to the right)
        const newX = tailSegment.x + this.segmentSpacing;
        
        // Start with tail's Y position for smooth connection
        const startY = tailSegment.smoothY || tailSegment.y;
        
        // Create new segment
        const segment = {
            x: newX,
            y: startY, // Start at tail position
            targetY: laneY, // Target lane position
            smoothY: startY, // Smooth interpolated position
            note: note.note,
            noteIndex: this.currentNoteIndex,
            segmentIndex: this.segments.length,
            size: this.segmentSize,
            hitArea: null,
            isHead: false,
            age: 0
        };
        
        // Create hit area for this segment
        this.createSegmentHitArea(segment);
        
        // Add to segments array
        this.segments.push(segment);
        
        // Update head tracking (leftmost segment is head)
        this.updateHeadTracking();
        
        // Update visuals
        this.updateWormVisuals();
        
        // Create spawn effect at the new segment
        if (this.scene.particleSystem) {
            this.scene.particleSystem.createExplosion(segment.x, segment.y, 8, this.getSegmentColor(segment.note));
        }
        
        this.currentNoteIndex++;
        
    }
    
    /**
     * Update which segment is considered the head (leftmost)
     */
    updateHeadTracking() {
        if (this.segments.length === 0) return;
        
        // Sort segments by X position and mark leftmost as head
        this.segments.sort((a, b) => a.x - b.x);
        this.segments.forEach((seg, index) => {
            const wasHead = seg.isHead;
            seg.isHead = (index === 0); // First (leftmost) is head
            
            // If this segment just became the head, create a hit area for it
            if (seg.isHead && !wasHead) {
                this.createSegmentHitArea(seg);
            }
            // If this segment is no longer the head, remove its hit area and collision handlers
            else if (!seg.isHead && wasHead && seg.hitArea) {
                // Clean up collision handlers
                if (seg.hitAreaCollision) {
                    seg.hitAreaCollision.destroy();
                    seg.hitAreaCollision = null;
                }
                if (seg.energyCollision) {
                    seg.energyCollision.destroy();
                    seg.energyCollision = null;
                }
                if (seg.beamCollision) {
                    seg.beamCollision.destroy();
                    seg.beamCollision = null;
                }
                
                seg.hitArea.destroy();
                seg.hitArea = null;
            }
        });
    }
    
    /**
     * Start energy chain destruction - rapidly destroy segments one by one
     */
    startEnergyChainDestruction(startX, startY) {
        if (this.isEnergyDestroying || this.isDestroyed) return;
        
        
        this.isEnergyDestroying = true;
        
        // Calculate total points for this worm
        this.totalEnergyPoints = 2000 + (this.segments.length * 100);
        
        // Create initial massive explosion at hit point
        if (this.scene.particleSystem) {
            this.scene.particleSystem.createExplosion(startX, startY, 80, 0x00ffff);
        }
        
        // Award the full energy weapon points immediately
        this.scene.addScore(this.totalEnergyPoints);
        
        // Show energy weapon points text
        const pointsText = this.scene.add.text(startX, startY - 50, `ENERGY BLAST!\n+${this.totalEnergyPoints}`, {
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#00ffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
        
        this.scene.tweens.add({
            targets: pointsText,
            y: startY - 100,
            alpha: 0,
            scale: 1.2,
            duration: 1500,
            onComplete: () => pointsText.destroy()
        });
        
        // Start the rapid chain destruction
        this.processEnergyChainStep();
    }
    
    /**
     * Process one step of the energy chain destruction
     */
    processEnergyChainStep() {
        if (!this.isEnergyDestroying || this.segments.length === 0) {
            // Chain complete - finish destruction
            this.completeEnergyDestruction();
            return;
        }
        
        // Find current head
        const headSegment = this.segments.find(seg => seg.isHead);
        if (!headSegment) {
            this.completeEnergyDestruction();
            return;
        }
        
        
        // Create electrical burst effect at head
        if (this.scene.particleSystem) {
            this.scene.particleSystem.createExplosion(
                headSegment.x, 
                headSegment.y, 
                40, 
                0x88ffff
            );
        }
        
        // Clean up head hit area immediately
        if (headSegment.hitArea && headSegment.hitArea.active) {
            headSegment.hitArea.destroy();
            headSegment.hitArea = null;
        }
        
        // Mark as energy shrinking (faster animation)
        headSegment.isShrinking = true;
        headSegment.shrinkScale = 1.0;
        headSegment.isEnergyShrinking = true; // Special flag for energy destruction
        
        // Create rapid shrinking animation (much faster than normal)
        this.scene.tweens.add({
            targets: headSegment,
            shrinkScale: 0,
            duration: 100, // Very fast - 100ms vs normal 400ms
            ease: 'Power2.easeOut',
            onUpdate: () => {
                this.updateWormVisuals();
            },
            onComplete: () => {
                // Remove the segment
                const segmentIndex = this.segments.indexOf(headSegment);
                if (segmentIndex !== -1) {
                    this.segments.splice(segmentIndex, 1);
                    this.segmentsDestroyed++;
                    
                    // Update head tracking for next iteration
                    this.updateHeadTracking();
                    this.updateWormVisuals();
                    
                    // Schedule next chain step after a very brief delay
                    this.energyChainTimer = this.scene.time.delayedCall(50, () => {
                        this.processEnergyChainStep();
                    });
                }
            }
        });
    }
    
    /**
     * Complete the energy destruction sequence
     */
    completeEnergyDestruction() {
        
        this.isEnergyDestroying = false;
        
        // Clean up any remaining timer
        if (this.energyChainTimer) {
            this.energyChainTimer.remove();
            this.energyChainTimer = null;
        }
        
        // Destroy the worm completely
        this.destroyWorm(true);
    }
    
    /**
     * Shrink the worm from the head (front) with smooth animation
     */
    shrinkFromHead() {
        if (this.segments.length === 0) return;
        
        // Find the current head segment
        const headSegment = this.segments.find(seg => seg.isHead);
        if (!headSegment) return;
        
        const headIndex = this.segments.indexOf(headSegment);
        
        // Clean up hit area of current head immediately to prevent multiple hits
        if (headSegment.hitArea && headSegment.hitArea.active) {
            headSegment.hitArea.destroy();
            headSegment.hitArea = null;
        }
        
        // Mark segment as shrinking to prevent visual updates
        headSegment.isShrinking = true;
        headSegment.shrinkScale = 1.0;
        
        // Create smooth shrinking animation
        this.scene.tweens.add({
            targets: headSegment,
            shrinkScale: 0,
            duration: 400,
            ease: 'Power2.easeInOut',
            onUpdate: () => {
                // Update visuals during animation
                this.updateWormVisuals();
            },
            onComplete: () => {
                // After animation completes, actually remove the segment
                const currentIndex = this.segments.indexOf(headSegment);
                if (currentIndex !== -1) {
                    this.segments.splice(currentIndex, 1);
                    this.segmentsDestroyed++;
                    
                    // Update head tracking (this will create hit area for new head)
                    this.updateHeadTracking();
                    
                    // Update visuals to show the final result
                    this.updateWormVisuals();
                    
                    // Check if worm is completely destroyed
                    if (this.segments.length === 0) {
                        this.destroyWorm(true);
                    }
                    
                }
            }
        });
    }
    
    /**
     * Get color for segment based on its note (fallback)
     */
    getSegmentColor(note) {
        const noteMap = {
            'C': 0xff4444, // Red
            'D': 0xff8844, // Orange
            'E': 0xffff44, // Yellow
            'F': 0x44ff44, // Green
            'G': 0x44ffff, // Cyan
            'A': 0x4444ff, // Blue
            'B': 0x8844ff  // Purple
        };
        
        const baseName = note[0];
        return noteMap[baseName] || 0xffffff;
    }
    
    /**
     * Get music-reactive color for segment based on real-time audio analysis
     */
    getMusicReactiveColor(segment, segmentIndex) {
        // Try to get audio analysis data
        let audioData = null;
        if (this.scene.audioAnalyzer && this.scene.audioAnalyzer.frequencyData) {
            audioData = {
                frequencyData: this.scene.audioAnalyzer.frequencyData,
                volume: this.scene.audioAnalyzer.currentVolume || 0.5,
                bpm: this.scene.audioAnalyzer.currentBPM || 120
            };
        }
        
        if (!audioData) {
            // Fallback to note-based colors if no audio data
            return this.getSegmentColor(segment.note);
        }
        
        // Analyze frequency ranges
        const freqData = audioData.frequencyData;
        const bassRange = freqData.slice(0, 64);         // Low frequencies (0-64)
        const midRange = freqData.slice(64, 160);        // Mid frequencies (64-160) 
        const highRange = freqData.slice(160, 255);      // High frequencies (160-255)
        
        // Calculate average intensity for each range
        const avgBass = bassRange.reduce((sum, val) => sum + val, 0) / bassRange.length;
        const avgMid = midRange.reduce((sum, val) => sum + val, 0) / midRange.length;
        const avgHigh = highRange.reduce((sum, val) => sum + val, 0) / highRange.length;
        
        // Normalize to 0-1 range
        const bassIntensity = Math.min(avgBass / 128, 1.0);
        const midIntensity = Math.min(avgMid / 128, 1.0);
        const highIntensity = Math.min(avgHigh / 128, 1.0);
        
        // Create dynamic hue based on frequency dominance
        let hue = 0;
        if (bassIntensity > midIntensity && bassIntensity > highIntensity) {
            // Bass dominant = red/orange hues (0-60 degrees)
            hue = bassIntensity * 60;
        } else if (midIntensity > highIntensity) {
            // Mid dominant = green/yellow hues (60-180 degrees)
            hue = 60 + (midIntensity * 120);
        } else {
            // High dominant = blue/purple hues (180-300 degrees)
            hue = 180 + (highIntensity * 120);
        }
        
        // Add segment offset for variety along the worm
        hue = (hue + (segmentIndex * 25)) % 360;
        
        // Dynamic saturation based on overall audio activity
        const saturation = 0.6 + (audioData.volume * 0.4); // 0.6 to 1.0
        
        // Dynamic brightness based on segment age and audio intensity
        const maxIntensity = Math.max(bassIntensity, midIntensity, highIntensity);
        const brightness = 0.7 + (maxIntensity * 0.3); // 0.7 to 1.0
        
        // Convert HSV to RGB and return as hex color
        const rgbColor = Phaser.Display.Color.HSVToRGB(hue / 360, saturation, brightness);
        return rgbColor.color;
    }
    
    /**
     * Retrofit collision detection for existing worms (called when energy weapon is deployed)
     */
    retrofitCollisionDetection() {
        
        // Find current head segment
        const headSegment = this.segments.find(seg => seg.isHead);
        if (!headSegment || !headSegment.hitArea) {
            return;
        }
        
        // Check if energy collision already exists
        if (headSegment.energyCollision) {
            return;
        }
        
        
        // Add energy weapon collision detection to existing head
        const wormRef = this;
        headSegment.energyCollision = this.scene.physics.add.overlap(
            this.scene.bullets,
            headSegment.hitArea,
            function(bullet, hitArea) {
                // Only process energy bullets
                if (bullet.bulletType !== 'energy') {
                    return;
                }
                
                // Skip if already being destroyed by energy weapon
                if (wormRef.isEnergyDestroying) {
                    return;
                }
                
                
                // Deactivate bullet immediately
                bullet.setActive(false);
                bullet.setVisible(false);
                
                // Start energy chain destruction
                wormRef.startEnergyChainDestruction(hitArea.x, hitArea.y);
            }
        );
        
    }
    
    /**
     * Create hit detection for a segment (RE-ENABLED)
     */
    createSegmentHitArea(segment) {
        // Only create hit areas for head segments to avoid multiple collision targets
        if (!segment.isHead) {
            return;
        }
        
        // Clean up existing hit area if it exists
        if (segment.hitArea && segment.hitArea.active) {
            segment.hitArea.destroy();
            segment.hitArea = null;
        }
        
        // Create physics-enabled hit area circle
        segment.hitArea = this.scene.add.circle(segment.x, segment.y, segment.size, 0xff0000, 0.0);
        segment.hitArea.setDepth(20); // Above everything for collision
        
        // Enable physics
        this.scene.physics.add.existing(segment.hitArea);
        segment.hitArea.body.setImmovable(true);
        segment.hitArea.body.setCircle(segment.size);
        
        // Store reference back to segment for collision handling
        segment.hitArea.segmentRef = segment;
        segment.hitArea.wormRef = this;
        segment.hitArea.enemyType = 'musicWormHead';
        
        // Set up collision detection for bullets
        const wormRef = this;
        segment.hitAreaCollision = this.scene.physics.add.overlap(
            this.scene.bullets,
            segment.hitArea,
            function(bullet, hitArea) {
                if (!bullet.active || !wormRef.isActive || wormRef.isDestroyed) return;
                
                // Skip energy bullets - they have their own system
                if (bullet.bulletType === 'energy') return;
                
                wormRef.handleHeadHit(bullet, hitArea);
            }
        );
        
    }
    
    /**
     * Handle when a bullet hits the head segment - shrinks worm from front
     */
    handleHeadHit(bullet, hitArea) {
        
        if (!this.isActive || !bullet.active || this.isDestroyed || !hitArea.segmentRef) {
            return;
        }
        
        const segment = hitArea.segmentRef;
        const segmentIndex = this.segments.indexOf(segment);
        
        
        if (segmentIndex === -1 || !segment || !segment.isHead) {
            return; // Only process head hits
        }
        
        
        // Award points for head shot
        const basePoints = 250; // Higher points for head shots
        const points = basePoints + (this.segments.length * 20); // Bonus for longer worms
        
        this.scene.addScore(points);
        
        // Create hit effect
        this.createSegmentHitEffect(segment.x, segment.smoothY || segment.y, points);
        
        // Deactivate bullet
        bullet.setActive(false);
        bullet.setVisible(false);
        
        // Clean up bullet trail if it exists
        if (bullet.trailEmitter && typeof bullet.trailEmitter.stop === 'function') {
            bullet.trailEmitter.stop();
        }
        
        // Shrink worm from front (remove head and make next segment the new head)
        this.shrinkFromHead();
        
    }
    
    /**
     * Remove a segment from the worm
     */
    removeSegment(segmentIndex) {
        if (segmentIndex < 0 || segmentIndex >= this.segments.length) return;
        
        const segment = this.segments[segmentIndex];
        
        // Clean up hit area
        if (segment.hitArea && segment.hitArea.active) {
            segment.hitArea.destroy();
        }
        
        // Remove from segments array
        this.segments.splice(segmentIndex, 1);
        this.segmentsDestroyed++;
        
        // Update head tracking
        this.updateHeadTracking();
        
        // Update visuals
        this.updateWormVisuals();
        
        // Check if worm is completely destroyed
        if (this.segments.length === 0) {
            this.destroyWorm(true);
        }
    }
    
    /**
     * Create visual effect when segment is hit
     */
    createSegmentHitEffect(x, y, points) {
        // Explosion effect
        if (this.scene.particleSystem) {
            this.scene.particleSystem.createExplosion(x, y, 25, 0xffffff);
        }
        
        // Show points text
        const pointsText = this.scene.add.text(x, y, `+${points}`, {
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        // Animate points text
        this.scene.tweens.add({
            targets: pointsText,
            y: y - 50,
            alpha: 0,
            duration: 1000,
            onComplete: () => pointsText.destroy()
        });
    }
    
    /**
     * Get rainbow color based on time
     */
    getRainbowColor(time, offset = 0) {
        const hue = ((time / 15) + offset) % 360; // Complete cycle every 15 seconds
        return Phaser.Display.Color.HSVToRGB(hue / 360, 0.8, 1).color;
    }
    
    /**
     * Update the rope-based worm visual appearance
     */
    updateWormVisuals() {
        if (this.segments.length === 0) return;
        
        const currentTime = this.scene.time.now;
        
        // Generate unified curve points for rope positioning
        this.generateUnifiedCurvePoints(currentTime);
        
        // Update rope points from curve points
        this.updateRopePoints();
        
        // Update or create the rope object
        this.updateRope();
        
        // Draw segment bodies at rope points
        this.drawSegmentBodies(currentTime);
        
        // DISABLED: No longer using rope collision system - using segment collision instead
        // this.updateCollisionAreas();
    }
    
    /**
     * Draw simple segment bodies at rope points (OPTIMIZED & FIXED)
     */
    drawSegmentBodies(currentTime) {
        // Use the same graphics object but ensure proper clearing
        if (!this.wormGraphics) {
            this.wormGraphics = this.scene.add.graphics();
            this.wormContainer.add(this.wormGraphics);
            this.wormGraphics.setDepth(6);
        }
        
        // CRITICAL: Clear graphics at START of segment drawing to prevent smearing
        this.wormGraphics.clear();
        
        if (this.ropePoints.length === 0 || this.segments.length === 0) return;
        
        // Only draw segments at the exact rope point positions
        const maxSegments = Math.min(this.segments.length, this.ropePoints.length, 5); // Limit for performance
        
        for (let i = 0; i < maxSegments; i++) {
            const segment = this.segments[i];
            const ropePoint = this.ropePoints[i];
            
            if (!segment || !ropePoint) continue;
            
            // Skip shrinking segments
            let shrinkScale = 1.0;
            if (segment.isShrinking && segment.shrinkScale !== undefined) {
                shrinkScale = segment.shrinkScale;
            }
            if (shrinkScale <= 0) continue;
            
            // FIXED: Use absolute coordinates, not relative to container
            const segmentX = ropePoint.x;
            const segmentY = ropePoint.y;
            
            // CRITICAL: Update hit area position RIGHT HERE at the same time as drawing
            if (segment.isHead && segment.hitArea && segment.hitArea.active) {
                segment.hitArea.x = segmentX;
                segment.hitArea.y = segmentY;
                
                // Update physics body position
                if (segment.hitArea.body) {
                    segment.hitArea.body.updateFromGameObject();
                }
            }
            
            // Get color
            const color = this.getCurrentWormColor(i);
            const actualSize = segment.size * shrinkScale;
            
            // Simple optimized drawing
            if (segment.isHead) {
                // Head segment with eyes
                this.wormGraphics.fillStyle(color, 1.0);
                this.wormGraphics.fillCircle(segmentX, segmentY, actualSize);
                
                // Simple eyes
                this.wormGraphics.fillStyle(0x000000, 1.0);
                this.wormGraphics.fillCircle(segmentX - actualSize * 0.3, segmentY - actualSize * 0.2, actualSize * 0.15);
                this.wormGraphics.fillCircle(segmentX + actualSize * 0.3, segmentY - actualSize * 0.2, actualSize * 0.15);
            } else {
                // Body segment 
                this.wormGraphics.fillStyle(color, 0.8);
                this.wormGraphics.fillCircle(segmentX, segmentY, actualSize * 0.8);
            }
        }
    }
    
    /**
     * Update rope points from the unified curve points
     */
    updateRopePoints() {
        if (this.curvePoints.length === 0) {
            this.ropePoints = [];
            return;
        }
        
        // Convert curve points to rope points with organic slithering
        this.ropePoints = [];
        
        // Sample points from the curve at regular intervals for the rope
        const ropePointSpacing = 20; // Distance between rope points
        const totalCurveLength = this.estimateCurveLength();
        const numRopePoints = Math.max(2, Math.floor(totalCurveLength / ropePointSpacing));
        
        for (let i = 0; i < numRopePoints; i++) {
            const t = i / (numRopePoints - 1); // 0 to 1
            const curveIndex = Math.floor(t * (this.curvePoints.length - 1));
            const nextIndex = Math.min(curveIndex + 1, this.curvePoints.length - 1);
            
            const point1 = this.curvePoints[curveIndex];
            const point2 = this.curvePoints[nextIndex];
            
            if (!point1 || !point2) continue;
            
            // Interpolate between curve points
            const localT = (t * (this.curvePoints.length - 1)) - curveIndex;
            const x = point1.x + (point2.x - point1.x) * localT;
            const y = point1.y + (point2.y - point1.y) * localT;
            
            // Apply shrinking effect - skip points that are being shrunk
            const shrinkScale = point1.shrinkScale !== undefined ? point1.shrinkScale : 1.0;
            if (shrinkScale <= 0) continue;
            
            this.ropePoints.push({ x, y });
        }
        
    }
    
    /**
     * Estimate the total length of the curve for rope point spacing
     */
    estimateCurveLength() {
        if (this.curvePoints.length < 2) return 0;
        
        let totalLength = 0;
        for (let i = 0; i < this.curvePoints.length - 1; i++) {
            const point1 = this.curvePoints[i];
            const point2 = this.curvePoints[i + 1];
            const dx = point2.x - point1.x;
            const dy = point2.y - point1.y;
            totalLength += Math.sqrt(dx * dx + dy * dy);
        }
        
        return totalLength;
    }
    
    /**
     * Update or create the Phaser Rope object with enhanced debugging
     */
    updateRope() {
        if (this.ropePoints.length < 2) {
            // Not enough points for a rope
            if (this.rope) {
                this.rope.destroy();
                this.rope = null;
            }
            // Always use fallback for short ropes
            this.createFallbackGraphics();
            return;
        }
        
        // Create rope if it doesn't exist
        if (!this.rope) {
            // Start with the first rope point
            const startPoint = this.ropePoints[0];
            
            try {
                this.rope = this.scene.add.rope(
                    startPoint.x, 
                    startPoint.y, 
                    this.wormTextureKey, 
                    null, 
                    this.ropePoints.length
                );
                this.rope.setDepth(5);
                this.wormContainer.add(this.rope);
                
            } catch (error) {
                console.error(`🪱 Failed to create rope:`, error);
                // Fallback to graphics if rope creation fails
                this.createFallbackGraphics();
                return;
            }
        }
        
        // Check if rope has the points property and sufficient points
        if (!this.rope || !this.rope.points) {
            this.createFallbackGraphics();
            return;
        }
        
        // Resize rope if needed
        if (this.rope.points.length !== this.ropePoints.length) {
            
            // Destroy and recreate rope with correct point count
            this.rope.destroy();
            this.rope = null;
            
            // Recreate with correct point count
            const startPoint = this.ropePoints[0];
            try {
                this.rope = this.scene.add.rope(
                    startPoint.x, 
                    startPoint.y, 
                    this.wormTextureKey, 
                    null, 
                    this.ropePoints.length
                );
                this.rope.setDepth(5);
                this.wormContainer.add(this.rope);
                
            } catch (error) {
                console.error(`🪱 Failed to recreate rope:`, error);
                this.createFallbackGraphics();
                return;
            }
        }
        
        // Update rope points with detailed logging
        if (this.rope && this.rope.points && this.rope.points.length === this.ropePoints.length) {
            // Update the rope's point positions
            for (let i = 0; i < this.ropePoints.length; i++) {
                if (this.rope.points[i]) {
                    // Use relative coordinates from rope origin
                    this.rope.points[i].x = this.ropePoints[i].x - this.rope.x;
                    this.rope.points[i].y = this.ropePoints[i].y - this.rope.y;
                }
            }
            
            // Force rope visual update
            this.rope.setDirty();
            
        } else {
            this.createFallbackGraphics();
        }
    }
    
    /**
     * Create optimized fallback graphics if rope creation fails
     */
    createFallbackGraphics() {
        if (!this.wormGraphics) {
            this.wormGraphics = this.scene.add.graphics();
            this.wormContainer.add(this.wormGraphics);
            this.wormGraphics.setDepth(5);
        }
        
        // CRITICAL: Clear graphics every frame to prevent accumulation
        this.wormGraphics.clear();
        
        if (this.ropePoints.length < 2) {
            return;
        }
        
        // Draw simple single line for performance
        const wormColor = this.getCurrentWormColor(0);
        this.wormGraphics.lineStyle(6, wormColor, 0.8);
        
        this.wormGraphics.beginPath();
        this.wormGraphics.moveTo(
            this.ropePoints[0].x - this.wormContainer.x,
            this.ropePoints[0].y
        );
        
        // Simple line drawing for performance
        for (let i = 1; i < this.ropePoints.length; i++) {
            this.wormGraphics.lineTo(
                this.ropePoints[i].x - this.wormContainer.x,
                this.ropePoints[i].y
            );
        }
        
        this.wormGraphics.strokePath();
    }
    
    /**
     * Update collision areas along the rope
     */
    updateCollisionAreas() {
        // Clean up existing collision areas
        this.collisionAreas.forEach(area => {
            if (area && area.destroy) {
                area.destroy();
            }
        });
        this.collisionAreas = [];
        this.frontmostCollisionArea = null;
        
        if (this.ropePoints.length === 0) return;
        
        // Create collision area at the front of the rope (head)
        const frontPoint = this.ropePoints[0];
        if (frontPoint) {
            this.frontmostCollisionArea = this.scene.add.circle(
                frontPoint.x, frontPoint.y, 15, 0xff0000, 0.0 // Invisible collision area
            );
            this.frontmostCollisionArea.setDepth(15);
            
            // Enable physics for collision
            this.scene.physics.add.existing(this.frontmostCollisionArea);
            this.frontmostCollisionArea.body.setImmovable(true);
            this.frontmostCollisionArea.body.setCircle(15);
            
            // Store references for compatibility with existing collision system
            this.frontmostCollisionArea.wormRef = this;
            this.frontmostCollisionArea.enemyType = 'ropeWormHead';
            
            this.collisionAreas.push(this.frontmostCollisionArea);
            
            // Set up collision detection for the rope head
            this.setupRopeCollision();
            
        }
    }
    
    /**
     * Set up collision detection for the rope head
     */
    setupRopeCollision() {
        if (!this.frontmostCollisionArea || !this.scene.bullets) return;
        
        const wormRef = this;
        
        // Regular bullet collision
        this.frontmostCollisionArea.bulletCollision = this.scene.physics.add.overlap(
            this.scene.bullets,
            this.frontmostCollisionArea,
            function(bullet, collisionArea) {
                // Skip energy bullets - they have their own collision system
                if (bullet.bulletType === 'energy') return;
                
                // Skip if worm is being destroyed by energy weapon
                if (wormRef.isEnergyDestroying) return;
                
                
                // Award points for hit
                wormRef.scene.addScore(500);
                
                // Shrink rope from front
                wormRef.shrinkRopeFromFront();
                
                // Deactivate bullet
                bullet.setActive(false);
                bullet.setVisible(false);
            }
        );
        
        // Energy weapon collision
        this.frontmostCollisionArea.energyCollision = this.scene.physics.add.overlap(
            this.scene.bullets,
            this.frontmostCollisionArea,
            function(bullet, collisionArea) {
                // Only process energy bullets
                if (bullet.bulletType !== 'energy') return;
                
                // Skip if already being destroyed by energy weapon
                if (wormRef.isEnergyDestroying) return;
                
                
                // Deactivate bullet
                bullet.setActive(false);
                bullet.setVisible(false);
                
                // Start energy chain destruction
                wormRef.startEnergyChainDestruction(collisionArea.x, collisionArea.y);
            }
        );
    }
    
    /**
     * Shrink the rope from the front instead of removing segments
     */
    shrinkRopeFromFront() {
        if (this.segments.length === 0) return;
        
        
        // Find and remove the head segment
        const headSegment = this.segments.find(seg => seg.isHead);
        if (headSegment) {
            // Clean up head hit area if it exists
            if (headSegment.hitArea && headSegment.hitArea.active) {
                headSegment.hitArea.destroy();
                headSegment.hitArea = null;
            }
            
            // Remove the head segment
            const segmentIndex = this.segments.indexOf(headSegment);
            if (segmentIndex !== -1) {
                this.segments.splice(segmentIndex, 1);
                this.segmentsDestroyed++;
                
                // Update head tracking for the new head
                this.updateHeadTracking();
                
                // Update visuals - this will recreate the rope with fewer points
                this.updateWormVisuals();
                
                // Check if worm is completely destroyed
                if (this.segments.length === 0) {
                    this.destroyWorm(true);
                }
                
            }
        }
    }
    
    /**
     * Draw the unified curve with enhanced wormy smoothness using lineTo interpolation
     */
    drawUnifiedCurve() {
        if (this.curvePoints.length < 2) {
            return;
        }
        
        this.wormGraphics.beginPath();
        
        // Start at the first curve point
        const firstPoint = this.curvePoints[0];
        this.wormGraphics.moveTo(
            firstPoint.x - this.wormContainer.x, 
            firstPoint.y
        );
        
        // Create smooth curves using mathematical interpolation with lineTo
        const curveSteps = 8; // Number of interpolation steps between points for smoothness
        
        for (let i = 0; i < this.curvePoints.length - 1; i++) {
            const currentPoint = this.curvePoints[i];
            const nextPoint = this.curvePoints[i + 1];
            
            // Skip points from shrinking segments
            if (currentPoint.shrinkScale <= 0 || nextPoint.shrinkScale <= 0) continue;
            
            // Create smooth curve between current and next point using interpolation
            for (let step = 1; step <= curveSteps; step++) {
                const t = step / curveSteps;
                
                // Quadratic interpolation for smooth curves
                const prevPoint = i > 0 ? this.curvePoints[i - 1] : currentPoint;
                const afterNextPoint = i < this.curvePoints.length - 2 ? this.curvePoints[i + 2] : nextPoint;
                
                // Calculate control point for smooth curve
                const controlX = (currentPoint.x + nextPoint.x) / 2;
                const controlY = (currentPoint.y + nextPoint.y) / 2;
                
                // Add some curvature based on surrounding points for worminess
                const curvature = Math.sin(t * Math.PI) * 8; // Slight curve for organic feel
                const curveOffsetY = curvature * Math.sign(nextPoint.y - currentPoint.y);
                
                // Interpolate between current and next point with curvature
                const interpX = currentPoint.x + (nextPoint.x - currentPoint.x) * t;
                const interpY = currentPoint.y + (nextPoint.y - currentPoint.y) * t + curveOffsetY;
                
                // Convert to relative coordinates and draw
                this.wormGraphics.lineTo(
                    interpX - this.wormContainer.x,
                    interpY
                );
            }
        }
        
        this.wormGraphics.strokePath();
    }
    
    /**
     * Fallback simple curve drawing for short worms
     */
    drawSimpleUnifiedCurve() {
        this.wormGraphics.beginPath();
        
        const firstPoint = this.curvePoints[0];
        this.wormGraphics.moveTo(
            firstPoint.x - this.wormContainer.x, 
            firstPoint.y
        );
        
        for (let i = 1; i < this.curvePoints.length; i++) {
            const point = this.curvePoints[i];
            if (point.shrinkScale <= 0) continue;
            
            this.wormGraphics.lineTo(
                point.x - this.wormContainer.x, 
                point.y
            );
        }
        
        this.wormGraphics.strokePath();
    }
    
    /**
     * Draw ultra-smooth Catmull-Rom spline curves that create flowing ~~~ lines
     */
    drawEnhancedCurve(organicSegments) {
        if (organicSegments.length < 2) return;
        
        // Convert segments to spline points
        const splinePoints = organicSegments.map(seg => ({
            x: seg.organicX - this.wormContainer.x,
            y: seg.organicY,
            shrinkScale: (seg.isShrinking && seg.shrinkScale !== undefined) ? seg.shrinkScale : 1.0
        }));
        
        // Handle shrinking head segment
        if (splinePoints[0].shrinkScale <= 0) return;
        
        if (splinePoints[0].shrinkScale < 1.0 && splinePoints.length > 1) {
            const retractProgress = 1 - splinePoints[0].shrinkScale;
            splinePoints[0].x = splinePoints[0].x + (splinePoints[1].x - splinePoints[0].x) * retractProgress * 0.5;
            splinePoints[0].y = splinePoints[0].y + (splinePoints[1].y - splinePoints[0].y) * retractProgress * 0.5;
        }
        
        this.wormGraphics.beginPath();
        this.wormGraphics.moveTo(splinePoints[0].x, splinePoints[0].y);
        
        // Draw Catmull-Rom spline for ultra-smooth curves
        this.drawCatmullRomSpline(splinePoints);
        
        this.wormGraphics.strokePath();
    }
    
    /**
     * Draw a Catmull-Rom spline for ultra-smooth curves with enhanced flow
     */
    drawCatmullRomSpline(points) {
        if (points.length < 2) return;
        
        // Ultra-high resolution for maximum smoothness
        const resolution = 80; // Increased from 50 for even smoother curves
        
        for (let i = 0; i < points.length - 1; i++) {
            // Get the four control points for Catmull-Rom spline
            const p0 = i > 0 ? points[i - 1] : points[i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];
            
            // Check for shrinking segments
            let segmentScale = Math.min(p1.shrinkScale, p2.shrinkScale);
            if (segmentScale <= 0) continue;
            
            // Draw the spline segment with ultra-high resolution
            for (let t = 0; t <= resolution; t++) {
                const normalizedT = t / resolution;
                const effectiveT = normalizedT * segmentScale;
                
                if (effectiveT > segmentScale) break;
                
                // Catmull-Rom spline calculation
                const t2 = effectiveT * effectiveT;
                const t3 = t2 * effectiveT;
                
                // Catmull-Rom basis functions
                const f1 = -0.5 * t3 + t2 - 0.5 * effectiveT;
                const f2 = 1.5 * t3 - 2.5 * t2 + 1.0;
                const f3 = -1.5 * t3 + 2.0 * t2 + 0.5 * effectiveT;
                const f4 = 0.5 * t3 - 0.5 * t2;
                
                // Calculate smooth spline point
                const x = f1 * p0.x + f2 * p1.x + f3 * p2.x + f4 * p3.x;
                const y = f1 * p0.y + f2 * p1.y + f3 * p2.y + f4 * p3.y;
                
                // Enhanced organic flow with multiple wave layers for ~~~ effect
                const currentTime = this.scene.time.now;
                
                // Primary flow wave - creates the main ~~~ undulation
                const primaryFlow = Math.sin((effectiveT + i + currentTime * 0.001) * Math.PI * 3) * this.curveDepth * 0.4;
                
                // Secondary flow wave - adds complexity and smoothness
                const secondaryFlow = Math.sin((effectiveT * 2 + i * 0.7 + currentTime * 0.0015) * Math.PI * 2) * this.curveFlowAmplitude * 0.3;
                
                // Tertiary subtle variation - prevents too perfect patterns
                const tertiaryFlow = Math.sin((effectiveT * 4 + i * 1.3 + currentTime * 0.0008) * Math.PI) * this.curveDepth * 0.1;
                
                // Combine all flow effects for natural ~~~ movement
                const totalFlow = primaryFlow + secondaryFlow + tertiaryFlow;
                const finalY = y + totalFlow;
                
                this.wormGraphics.lineTo(x, finalY);
                
                // Stop if we're drawing a shrinking segment
                if (segmentScale < 1.0 && normalizedT >= segmentScale) {
                    break;
                }
            }
        }
    }
    
    /**
     * Smooth easing function for hook transitions
     */
    easeInOut(t) {
        return t * t * (3 - 2 * t); // Smooth hermite interpolation
    }
    
    /**
     * Draw smooth curves connecting segments with retraction animation (legacy method)
     */
    drawSmoothCurve(sortedSegments) {
        if (sortedSegments.length < 2) return;
        
        this.wormGraphics.beginPath();
        
        // Start at first segment
        const firstSeg = sortedSegments[0];
        let startX = firstSeg.x - this.wormContainer.x;
        let startY = firstSeg.smoothY || firstSeg.y;
        
        // If first segment is shrinking, adjust the start position
        if (firstSeg.isShrinking && firstSeg.shrinkScale !== undefined) {
            const shrinkScale = firstSeg.shrinkScale;
            if (shrinkScale <= 0) return; // Skip if completely shrunk
            
            // If this is the head shrinking, find the next segment and interpolate towards it
            if (sortedSegments.length > 1) {
                const nextSeg = sortedSegments[1];
                const nextX = nextSeg.x - this.wormContainer.x;
                const nextY = nextSeg.smoothY || nextSeg.y;
                
                // Interpolate the start position towards the next segment as head shrinks
                const retractProgress = 1 - shrinkScale; // 0 to 1 as it shrinks
                startX = startX + (nextX - startX) * retractProgress * 0.5; // Pull line towards next segment
                startY = startY + (nextY - startY) * retractProgress * 0.5;
            }
        }
        
        this.wormGraphics.moveTo(startX, startY);
        
        // Draw smooth curves between segments using multiple line segments
        for (let i = 1; i < sortedSegments.length; i++) {
            const prevSeg = sortedSegments[i - 1];
            const currSeg = sortedSegments[i];
            
            let prevX = prevSeg.x - this.wormContainer.x;
            let prevY = prevSeg.smoothY || prevSeg.y;
            const currX = currSeg.x - this.wormContainer.x;
            const currY = currSeg.smoothY || currSeg.y;
            
            // Apply shrinking effect to line connections
            let lineScale = 1.0;
            if (prevSeg.isShrinking && prevSeg.shrinkScale !== undefined) {
                lineScale = prevSeg.shrinkScale;
                
                // If previous segment is shrinking, pull the line endpoint towards current segment
                const retractProgress = 1 - lineScale;
                prevX = prevX + (currX - prevX) * retractProgress * 0.3;
                prevY = prevY + (currY - prevY) * retractProgress * 0.3;
            }
            
            // Skip this line segment if the previous segment is completely shrunk
            if (lineScale <= 0) continue;
            
            // Create smooth curve using multiple intermediate points
            const steps = 8; // Number of intermediate points for smoothness
            let segmentDrawn = false;
            
            for (let step = 1; step <= steps; step++) {
                const t = step / steps;
                
                // Scale the curve progression based on shrinking
                const effectiveT = t * lineScale;
                if (effectiveT <= 0) break;
                
                // Quadratic bezier curve calculation
                const controlX = (prevX + currX) / 2;
                const controlY = (prevY + currY) / 2 + Math.sin(effectiveT * Math.PI) * 5; // Slight curve
                
                // Calculate bezier point
                const invT = 1 - effectiveT;
                const x = invT * invT * prevX + 2 * invT * effectiveT * controlX + effectiveT * effectiveT * currX;
                const y = invT * invT * prevY + 2 * invT * effectiveT * controlY + effectiveT * effectiveT * currY;
                
                this.wormGraphics.lineTo(x, y);
                segmentDrawn = true;
                
                // If we're drawing a shrinking segment, stop partway through
                if (lineScale < 1.0 && step / steps > lineScale) {
                    break;
                }
            }
        }
        
        this.wormGraphics.strokePath();
    }
    
    /**
     * Update the worm each frame
     */
    update() {
        if (!this.isActive || this.isDestroyed) return;
        
        const deltaTime = this.scene.game.loop.delta / 1000;
        const currentTime = this.scene.time.now;
        
        // Move the entire worm left
        if (this.wormContainer) {
            this.wormContainer.x -= this.speed * deltaTime;
        }
        
        // Update segment positions and smooth movement
        this.segments.forEach((segment, index) => {
            // Move segment left
            segment.x -= this.speed * deltaTime;
            
            // Age the segment
            segment.age += deltaTime;
            
            // Smooth Y movement towards target lane
            if (segment.smoothY === undefined) {
                segment.smoothY = segment.y;
            }
            
            const yDiff = segment.targetY - segment.smoothY;
            segment.smoothY += yDiff * this.smoothingFactor;
            
            // Update actual Y for physics (use smoothY for visuals)
            segment.y = segment.smoothY;
            
            // Update hit area position using rope points (same as visual segments)
            if (segment.hitArea && segment.hitArea.active && segment.isHead) {
                // Head segment should always use the first rope point (front of worm)
                if (this.ropePoints && this.ropePoints.length > 0) {
                    const ropePoint = this.ropePoints[0]; // First rope point = front of worm
                    segment.hitArea.x = ropePoint.x;
                    segment.hitArea.y = ropePoint.y;
                    
                    // Update physics body position correctly using Phaser methods
                    if (segment.hitArea.body) {
                        segment.hitArea.body.updateFromGameObject();
                    }
                }
            }
        });
        
        // Update head tracking
        this.updateHeadTracking();
        
        // Update visuals
        this.updateWormVisuals();
        
        // Check if worm has moved completely off screen (head segment)
        if (this.segments.length > 0) {
            const headSegment = this.segments.find(seg => seg.isHead);
            if (headSegment && headSegment.x < -100) {
                this.destroyWorm(false);
            }
        }
    }
    
    /**
     * Destroy the worm and clean up
     */
    destroyWorm(wasFullyDestroyed = false) {
        if (this.isDestroyed) return;
        
        this.isActive = false;
        this.isDestroyed = true;
        
        // Stop growth
        if (this.growthTimer) {
            this.growthTimer.remove();
        }
        
        // Award completion bonus if fully destroyed by shooting
        if (wasFullyDestroyed) {
            const completionBonus = 750 + (this.segmentsDestroyed * 75);
            this.scene.addScore(completionBonus);
            
            // Show completion message
            const completionText = this.scene.add.text(
                this.scene.gameWidth / 2,
                this.scene.gameHeight / 3,
                `MUSIC WORM DESTROYED!\n+${completionBonus} BONUS!`, {
                fontSize: '26px',
                fontStyle: 'bold',
                color: '#00ff88',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }).setOrigin(0.5);
            
            this.scene.tweens.add({
                targets: completionText,
                alpha: 0,
                scale: 1.4,
                duration: 2500,
                onComplete: () => completionText.destroy()
            });
            
            // Create large explosion effect
            if (this.scene.particleSystem && this.segments.length > 0) {
                const headSegment = this.segments.find(seg => seg.isHead);
                if (headSegment) {
                    this.scene.particleSystem.createExplosion(
                        headSegment.x,
                        headSegment.y,
                        60,
                        0x00ff88
                    );
                }
            }
        }
        
        // Clean up all segments
        this.segments.forEach(segment => {
            if (segment.hitArea && segment.hitArea.active) {
                segment.hitArea.destroy();
            }
        });
        
        // Clean up container
        if (this.wormContainer) {
            this.wormContainer.destroy();
        }
        
    }
}
