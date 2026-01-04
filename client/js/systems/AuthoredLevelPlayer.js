/**
 * AuthoredLevelPlayer.js
 *
 * Runtime player for pre-authored level files.
 * Reads spawn events from the authored level JSON and schedules them deterministically.
 * No runtime audio interpretation required - just event scheduling.
 */

export default class AuthoredLevelPlayer {
    constructor(scene) {
        this.scene = scene;
        this.level = null;
        this.isLoaded = false;
        this.isPlaying = false;

        // Event tracking
        this.nextEventIndex = 0;
        this.activeSpawns = [];
        this.processedDrops = new Set();

        // Section tracking
        this.currentSectionIndex = 0;
        this.currentSection = null;

        // Performance tracking
        this.spawnedCount = 0;
        this.lastUpdateTime = 0;

        // Motion calculation cache
        this.motionCalculators = {
            linear: this.calculateLinearMotion.bind(this),
            sine_wave: this.calculateSineWaveMotion.bind(this),
            arc: this.calculateArcMotion.bind(this),
            hold_release: this.calculateHoldReleaseMotion.bind(this),
            bounce: this.calculateBounceMotion.bind(this),
            converge: this.calculateConvergeMotion.bind(this),
            spiral_in: this.calculateSpiralMotion.bind(this)
        };
    }

    /**
     * Load an authored level file
     * @param {Object} levelData - The parsed level JSON
     */
    loadLevel(levelData) {
        if (!levelData) {
            console.error("AuthoredLevelPlayer: No level data provided");
            return false;
        }

        this.level = levelData;
        this.isLoaded = true;
        this.reset();

        console.log(`AuthoredLevelPlayer: Loaded level "${levelData.metadata?.song_id}"`);
        console.log(`  - ${levelData.spawn_events?.length || 0} spawn events`);
        console.log(`  - ${levelData.sections?.length || 0} sections`);
        console.log(`  - ${levelData.drops?.length || 0} drops`);
        console.log(`  - ${levelData.phrases?.length || 0} phrases`);

        return true;
    }

    /**
     * Reset the player to the beginning
     */
    reset() {
        this.nextEventIndex = 0;
        this.activeSpawns = [];
        this.processedDrops.clear();
        this.currentSectionIndex = 0;
        this.currentSection = this.level?.sections?.[0] || null;
        this.spawnedCount = 0;
        this.isPlaying = false;
    }

    /**
     * Start playback
     */
    start() {
        if (!this.isLoaded) {
            console.warn("AuthoredLevelPlayer: Cannot start - no level loaded");
            return;
        }
        this.isPlaying = true;
        console.log("AuthoredLevelPlayer: Started playback");
    }

    /**
     * Stop playback
     */
    stop() {
        this.isPlaying = false;
        console.log("AuthoredLevelPlayer: Stopped playback");
    }

    /**
     * Main update loop - called every frame
     * @param {number} currentTime - Current playback time in seconds
     */
    update(currentTime) {
        if (!this.isLoaded || !this.isPlaying || !this.level) {
            return;
        }

        this.lastUpdateTime = currentTime;

        // Update current section
        this.updateCurrentSection(currentTime);

        // Process spawn events
        this.processSpawnEvents(currentTime);

        // Update motion for active spawns
        this.updateActiveSpawns(currentTime);

        // Cleanup destroyed spawns
        this.cleanupInactiveSpawns();
    }

    /**
     * Update current section based on time
     */
    updateCurrentSection(currentTime) {
        if (!this.level.sections || this.level.sections.length === 0) {
            return;
        }

        // Find current section
        for (let i = 0; i < this.level.sections.length; i++) {
            const section = this.level.sections[i];
            if (currentTime >= section.start && currentTime < section.end) {
                if (this.currentSectionIndex !== i) {
                    this.currentSectionIndex = i;
                    this.currentSection = section;
                    this.onSectionChange(section);
                }
                break;
            }
        }
    }

    /**
     * Called when the section changes
     */
    onSectionChange(section) {
        console.log(`AuthoredLevelPlayer: Section changed to "${section.type}" (${section.id})`);

        // Notify UI if available
        if (this.scene.uiManager && this.scene.uiManager.updateSegmentInfo) {
            this.scene.uiManager.updateSegmentInfo(section.type);
        }

        // Notify audio analyzer for visual effects
        if (this.scene.audioAnalyzer && this.scene.audioAnalyzer.onSegmentChange) {
            this.scene.audioAnalyzer.onSegmentChange(section);
        }
    }

    /**
     * Process spawn events that should trigger at current time
     */
    processSpawnEvents(currentTime) {
        if (!this.level.spawn_events) {
            return;
        }

        // Process all events up to current time
        while (this.nextEventIndex < this.level.spawn_events.length) {
            const event = this.level.spawn_events[this.nextEventIndex];

            if (event.time <= currentTime) {
                this.spawnFromEvent(event, currentTime);
                this.nextEventIndex++;
            } else {
                break; // Future events, stop processing
            }
        }
    }

    /**
     * Spawn an enemy from an authored event
     */
    spawnFromEvent(event, currentTime) {
        if (!this.scene.enemyManager) {
            return null;
        }

        // Map size (0-1) to strength (used by EnemyManager)
        const strength = event.size || 0.5;
        const note = event.note || 'C4';

        // Spawn the enemy
        const enemy = this.scene.enemyManager.spawnEnemy(strength, note);

        if (!enemy) {
            return null;
        }

        // Override position based on authored y_position
        const gameHeight = this.scene.gameHeight || 720;
        const gameWidth = this.scene.gameWidth || 1280;

        // Y position from authored data (0 = top, 1 = bottom)
        enemy.y = event.y_position * gameHeight;

        // Handle special spawn positions for drops
        if (event.motion && event.motion.start_x !== undefined) {
            enemy.x = event.motion.start_x * gameWidth;
        }

        // Store motion data for updates
        enemy.authoredMotion = event.motion;
        enemy.spawnTime = event.time;
        enemy.authoredEvent = event;
        enemy.groupId = event.group_id;

        // Override velocity if specified
        if (event.velocity) {
            enemy.setVelocity(event.velocity.x, event.velocity.y);
        }

        // Track active spawns for motion updates
        this.activeSpawns.push(enemy);
        this.spawnedCount++;

        // Special handling for drop events
        if (event.is_drop) {
            this.handleDropSpawn(enemy, event);
        }

        return enemy;
    }

    /**
     * Handle special effects for drop-spawned enemies
     */
    handleDropSpawn(enemy, event) {
        // Add visual emphasis
        if (this.scene.particleSystem) {
            const color = enemy.tint || 0xffffff;
            this.scene.particleSystem.createExplosion(enemy.x, enemy.y, 30, color);
        }

        // Screen shake for first enemy of a drop
        if (!this.processedDrops.has(event.group_id)) {
            this.processedDrops.add(event.group_id);

            // Camera shake
            if (this.scene.cameraManager) {
                this.scene.cameraManager.shake(200, 0.01);
            } else {
                this.scene.cameras.main.shake(200, 0.01);
            }

            // Flash effect
            if (this.scene.cameraManager) {
                this.scene.cameraManager.flash(300, 0xffffff, 0.3);
            }
        }
    }

    /**
     * Update motion for all active spawns
     */
    updateActiveSpawns(currentTime) {
        const gameHeight = this.scene.gameHeight || 720;
        const gameWidth = this.scene.gameWidth || 1280;

        let updatedCount = 0;
        for (const spawn of this.activeSpawns) {
            if (!spawn.active || !spawn.authoredMotion) {
                continue;
            }

            const motion = spawn.authoredMotion;
            const timeSinceSpawn = currentTime - spawn.spawnTime;

            // Calculate lifetime (assume 5 seconds if not specified)
            const lifetime = 5.0;
            const progress = Math.min(1.0, timeSinceSpawn / lifetime);

            // Get motion calculator
            const calculator = this.motionCalculators[motion.type];
            if (calculator) {
                const result = calculator(motion, progress, timeSinceSpawn);

                // Apply position using Phaser's setPosition to keep physics body in sync
                const newY = result.y !== undefined ? result.y * gameHeight : spawn.y;
                const newX = result.x !== undefined ? result.x * gameWidth : spawn.x;

                if (result.y !== undefined || result.x !== undefined) {
                    // Use setPosition which properly syncs the physics body
                    spawn.setPosition(newX, newY);
                    updatedCount++;
                }

                // Apply velocity changes
                if (result.velocityX !== undefined && spawn.body) {
                    spawn.body.velocity.x = result.velocityX;
                }
                if (result.velocityY !== undefined && spawn.body) {
                    spawn.body.velocity.y = result.velocityY;
                }
            }
        }

        // Debug log every 60 frames
        if (this.scene.time && this.scene.time.now % 1000 < 20 && updatedCount > 0) {
            console.log(`AuthoredLevelPlayer: Updated ${updatedCount} spawns with motion`);
        }
    }

    /**
     * Remove inactive spawns from tracking
     */
    cleanupInactiveSpawns() {
        this.activeSpawns = this.activeSpawns.filter(spawn => spawn.active);
    }

    // ==========================================================================
    // MOTION CALCULATORS
    // ==========================================================================

    /**
     * Linear motion - straight line from start to end
     */
    calculateLinearMotion(motion, progress, time) {
        const startY = motion.start_y !== undefined ? motion.start_y : motion.center_y || 0.5;
        const endY = motion.end_y !== undefined ? motion.end_y : motion.center_y || 0.5;

        return {
            y: startY + (endY - startY) * progress
        };
    }

    /**
     * Sine wave motion - oscillating up and down
     * Uses actual time for smooth continuous oscillation
     */
    calculateSineWaveMotion(motion, progress, time) {
        const centerY = motion.center_y || 0.5;
        const amplitude = motion.amplitude || 0.1;
        const frequency = motion.frequency || 1.5;
        const phase = motion.phase || 0;

        // Use actual time (in seconds) for oscillation, not progress
        // This creates smooth, continuous wave motion
        return {
            y: centerY + amplitude * Math.sin((time * frequency + phase) * Math.PI * 2)
        };
    }

    /**
     * Arc motion - parabolic curve
     */
    calculateArcMotion(motion, progress, time) {
        const startY = motion.start_y !== undefined ? motion.start_y : motion.center_y || 0.5;
        const amplitude = motion.amplitude || 0.2;

        // Parabolic arc: peaks at progress = 0.5
        return {
            y: startY - amplitude * Math.sin(progress * Math.PI)
        };
    }

    /**
     * Hold-release motion - stationary then sudden movement
     */
    calculateHoldReleaseMotion(motion, progress, time) {
        const startY = motion.start_y !== undefined ? motion.start_y : motion.center_y || 0.5;
        const holdRatio = motion.hold_ratio || 0.7;
        const releaseDistance = motion.release_distance || 0.3;

        if (progress < holdRatio) {
            // Holding phase
            return { y: startY };
        } else {
            // Release phase with easing
            const releaseProgress = (progress - holdRatio) / (1 - holdRatio);
            const easedProgress = releaseProgress * releaseProgress; // Ease in quad
            return {
                y: startY + releaseDistance * easedProgress
            };
        }
    }

    /**
     * Bounce motion - decaying bounces
     */
    calculateBounceMotion(motion, progress, time) {
        const centerY = motion.center_y || 0.5;
        const amplitude = motion.amplitude || 0.2;
        const frequency = motion.frequency || 1.0;
        const decay = motion.decay || 0.5;

        const decayFactor = Math.exp(-decay * progress * 5);
        return {
            y: centerY + amplitude * Math.abs(Math.sin(progress * frequency * Math.PI * 4)) * decayFactor
        };
    }

    /**
     * Converge motion - move toward a target point
     */
    calculateConvergeMotion(motion, progress, time) {
        const startX = motion.start_x || 1.0;
        const startY = motion.start_y || 0.5;
        const targetX = motion.target_x || 0.5;
        const targetY = motion.target_y || 0.5;

        // Ease in for acceleration effect
        const easedProgress = progress * progress;

        return {
            x: startX + (targetX - startX) * easedProgress,
            y: startY + (targetY - startY) * easedProgress
        };
    }

    /**
     * Spiral motion - spiraling toward center
     */
    calculateSpiralMotion(motion, progress, time) {
        const centerX = motion.center_x || 0.5;
        const centerY = motion.center_y || 0.5;
        const startRadius = motion.start_radius || 0.4;
        const rotations = motion.rotations || 2.0;

        // Decrease radius over time
        const currentRadius = startRadius * (1 - progress);
        const angle = progress * rotations * Math.PI * 2;

        return {
            x: centerX + currentRadius * Math.cos(angle),
            y: centerY + currentRadius * Math.sin(angle)
        };
    }

    // ==========================================================================
    // UTILITY METHODS
    // ==========================================================================

    /**
     * Get current section info
     */
    getCurrentSection() {
        return this.currentSection;
    }

    /**
     * Get playback progress (0-1)
     */
    getProgress() {
        if (!this.level || !this.level.metadata) {
            return 0;
        }
        const duration = this.level.metadata.duration || 1;
        return Math.min(1, this.lastUpdateTime / duration);
    }

    /**
     * Get number of remaining events
     */
    getRemainingEvents() {
        if (!this.level || !this.level.spawn_events) {
            return 0;
        }
        return this.level.spawn_events.length - this.nextEventIndex;
    }

    /**
     * Check if level is in a solo section
     */
    isInSoloSection(currentTime) {
        if (!this.level || !this.level.solo_sections) {
            return false;
        }

        for (const solo of this.level.solo_sections) {
            if (currentTime >= solo.start && currentTime < solo.end) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get upcoming drop (if within next N seconds)
     */
    getUpcomingDrop(currentTime, lookAhead = 2.0) {
        if (!this.level || !this.level.drops) {
            return null;
        }

        for (const drop of this.level.drops) {
            const timeUntilDrop = drop.time - currentTime;
            if (timeUntilDrop > 0 && timeUntilDrop <= lookAhead) {
                return {
                    drop,
                    timeUntil: timeUntilDrop
                };
            }
        }
        return null;
    }

    /**
     * Get spawn rate multiplier from current section
     */
    getSpawnRateMultiplier() {
        if (this.currentSection && this.currentSection.spawn_rate_multiplier) {
            return this.currentSection.spawn_rate_multiplier;
        }
        return 1.0;
    }

    /**
     * Get level metadata
     */
    getMetadata() {
        return this.level?.metadata || null;
    }

    /**
     * Check if an authored level is available
     */
    hasAuthoredLevel() {
        return this.isLoaded && this.level && this.level.spawn_events && this.level.spawn_events.length > 0;
    }
}
