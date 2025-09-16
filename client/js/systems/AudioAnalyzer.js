
// AudioAnalyzer.js - Handles audio processing and music-based events

import EQVisualizer from './EQVisualizer.js';

export default class AudioAnalyzer {
    constructor(scene) {
        this.scene = scene;
        
        // Audio state
        this.music = null;
        this.audioData = scene.audioData;
        this.nextBeatIndex = 0;
        this.currentSegmentIndex = 0;
        this.currentBPM = 0;
        this.averageBPM = 0;          // Track the average BPM from the data
        this.calculatedAverageBPM = false; // Flag to track if we've calculated average BPM
        this.lastBeatTime = 0;
        
        // Log the audio data we received
        if (this.audioData) {
            // Log metadata if available for debugging
            if (this.audioData.metadata) {
                if (this.audioData.metadata.bpm) {
                    this.averageBPM = this.audioData.metadata.bpm;
                    this.currentBPM = this.averageBPM;
                    this.calculatedAverageBPM = true;
                }
            }
        }
        
        // Enemy spawn rate control
        this.enemySpawnRate = 1.0; // Default rate multiplier
        this.lastEnemySpawnTime = 0;
        this.maxEnemiesPerBeat = 10; // Increased from 3 to 10 - allowing many more enemies per beat
        
        // Volume tracking for dynamic enemy sizing
        this.currentVolume = 0.5; // Default volume level (0-1)
        this.volumeHistory = []; // Keep track of recent volume levels
        this.volumeHistorySize = 10; // Number of volume samples to track
        
        // Beat visualization properties
        this.beatVisualsEnabled = true;
        this.lastBeatVisualTime = 0;
        
        // Track active notes for enemy spawning
        this.currentActiveNotes = ['C', 'E', 'G']; // Default to C major chord notes
        this.lastNoteChangeTime = 0;
        
        // Initialize EQ visualizer
        this.eqVisualizer = new EQVisualizer(scene);
    }
    
    initializeAudio() {
        try {
            if (!this.scene.songData) {
                throw new Error("No song data available for AudioAnalyzer.");
            }
    
            const audioKey = 'music';
            
            // Check if music already exists
            if (this.music) {
                this.music.stop();
            }
            
            // Create new music instance
            if (this.scene.cache.audio.has(audioKey)) {
                // Check for saved music volume from localStorage
                let musicVolume = 1.0; // Default volume
                try {
                    const savedVolume = localStorage.getItem('reactoverdrive_music_volume');
                    if (savedVolume) {
                        musicVolume = parseFloat(savedVolume);
                    }
                } catch (error) {
                    console.warn("Could not load saved music volume, using default");
                }
                
                this.music = this.scene.sound.add(audioKey, {
                    loop: false,
                    volume: musicVolume
                });
                
            } else {
                throw new Error(`Music with key '${audioKey}' not found in cache!`);
            }
            
            // Setup event listeners
            this.music.once('complete', () => {
                this.scene.gameOver();
            });
            
            // Start playing the music
            this.music.play();
            
            return true;
        } catch (error) {
            console.error("❌ Error initializing audio:", error);
            return false;
        }
    }
    
    update() {
        // Update EQ Visualizer even if music isn't playing to maintain the background visualization
        if (this.eqVisualizer && typeof this.eqVisualizer.update === 'function') {
            this.eqVisualizer.update();
        }
        
        // Only process audio analysis if music is playing
        if (!this.music || !this.music.isPlaying) {
            return;
        }
        
        // Track previous volume for transition detection
        const previousVolume = this.currentVolume;
        
        // Calculate current position in music (in seconds)
        const currentTime = (this.scene.time.now - this.scene.gameStartTime) / 1000;
        
        // Calculate current audio intensity and volume (for energy field and enemy sizing)
        let audioIntensity = 0.3; // Default moderate intensity
        let currentVolume = 0.5; // Default volume level
        
        // Update UI volume debug more frequently - on every frame
        if (this.scene.uiManager && typeof this.scene.uiManager.updateVolumeDebug === 'function') {
            this.scene.uiManager.updateVolumeDebug(this.currentVolume, this.currentBPM);
        }
        
        // Use beat strength if available for better intensity calculation
        if (this.audioData && this.audioData.beats && this.nextBeatIndex > 0 && this.nextBeatIndex < this.audioData.beats.length) {
            // Get the most recent beat
            const recentBeat = this.audioData.beats[this.nextBeatIndex - 1];
            
            // Calculate time since last beat
            const timeSinceLastBeat = currentTime - recentBeat.time;
            
            // Intensity decays over time since last beat (max 2 seconds)
            const decayFactor = Math.max(0, 1 - (timeSinceLastBeat / 2));
            
            // Use beat strength and BPM to calculate intensity
            audioIntensity = 0.2 + (recentBeat.strength * 0.5 * decayFactor) + (this.currentBPM / 200 * 0.3);
            
            // Ensure intensity is within 0-1 range
            audioIntensity = Math.min(1, Math.max(0, audioIntensity));
            
            // Extract volume information from recent beats - check both strength and energy properties
            let beatVolume = 0.5; // Default value
            
            // First try to get strength
            if (typeof recentBeat.strength === 'number') {
                beatVolume = recentBeat.strength;
            } 
            // Then try energy if strength isn't available
            else if (typeof recentBeat.energy === 'number') {
                beatVolume = recentBeat.energy;
            }
            
            // Amplify the volume value to make it more pronounced
            currentVolume = Math.min(1.0, beatVolume * 2.0); // Double the effect (was 1.2)
        }
        
        // Update current volume for enemy scaling - even less smoothing for more pronounced changes
        this.currentVolume = this.currentVolume * 0.3 + currentVolume * 0.7; // Much faster transitions (was 0.6/0.4)
        
        // Add to volume history for tracking
        this.volumeHistory.push(this.currentVolume);
        if (this.volumeHistory.length > this.volumeHistorySize) {
            this.volumeHistory.shift(); // Remove oldest entry
        }
        
        // Update energy field visualization if available
        if (this.scene.particleSystem && this.scene.particleSystem.updateEnergyField) {
            this.scene.particleSystem.updateEnergyField(audioIntensity);
        }
        
        // Debug volume changes to console more frequently
        
        // Detect significant volume changes to pulse existing enemies - lower threshold even more
        if (Math.abs(this.currentVolume - previousVolume) > 0.05) { // Was 0.1
            this.pulseExistingEnemies(this.currentVolume);
            
            // Add a VERY obvious notification about volume changes
            this.showVolumeChangeNotification(this.currentVolume);
        }
        
        // Update time debug text
        let nextBeatTime = 0;
        if (this.audioData && this.audioData.beats && this.audioData.beats.length > 0) {
            if (this.nextBeatIndex < this.audioData.beats.length) {
                nextBeatTime = this.audioData.beats[this.nextBeatIndex].time;
            } else {
                // If we've gone through all beats, use the first beat time for the next loop
                nextBeatTime = this.audioData.beats[0].time;
            }
        }
        
        // Update UI time info
        if (this.scene.uiManager && this.scene.uiManager.updateTimeInfo) {
            this.scene.uiManager.updateTimeInfo(currentTime, nextBeatTime);
        }
        
        // Update audio data debug info
        if (this.scene.uiManager && this.scene.uiManager.updateDataInfo) {
            this.scene.uiManager.updateDataInfo(
                this.audioData && this.audioData.beats ? this.audioData.beats.length : 0,
                this.nextBeatIndex,
                this.audioData && this.audioData.segments ? this.audioData.segments.length : 0
            );
        }
        
        // Debug - force reset beat index if it's not advancing
        if (this.audioData && this.audioData.beats && this.nextBeatIndex === 0 && currentTime > 5) {
            console.log("Resetting beat index - detection not working");
            this.resetBeatIndex(currentTime);
        }
        
        // Process beats
        this.processBeat(currentTime);
        
        // Process segments
        this.processSegment(currentTime);
        
        // Check if we've reached the end of the track
        if (this.audioData && this.audioData.metadata && currentTime >= this.audioData.metadata.duration) {
            // Instead of stopping, just reset the game time to loop back to the beginning
            this.scene.gameStartTime = this.scene.time.now;
            this.nextBeatIndex = 0;
            this.currentSegmentIndex = 0;
        }
        
        // Spawn enemies at a controlled rate even if beat detection fails
        this.controlledEnemySpawning(currentTime);
    }
    
    controlledEnemySpawning(currentTime) {
        // Only spawn enemies if enough time has passed since the last spawn
        const minTimeBetweenSpawns = 1.5; // Reduced from 2.0 seconds between spawns
        
        // Count existing enemies for performance management only
        let enemyCount = 0;
        this.scene.children.list.forEach(obj => {
            if (obj.enemyType && obj.enemyType !== 'powerupHex') {
                enemyCount++;
            }
        });
        
        // Check if current segment is high energy (like chorus)
        let isHighEnergySegment = false;
        if (this.audioData && this.audioData.segments && this.currentSegmentIndex < this.audioData.segments.length) {
            const segment = this.audioData.segments[this.currentSegmentIndex];
            isHighEnergySegment = segment.type === 'chorus';
        }
        
        // Calculate adaptive enemy cap based on current BPM
        // Faster songs (higher BPM) can have more enemies
        // Range: 25 enemies at 60 BPM to 50 enemies at 180+ BPM
        const baseCap = 25;
        const bpmBonus = Math.max(0, Math.min(25, (this.currentBPM - 60) / 5));
        const enemyCap = Math.round(baseCap + bpmBonus);
        
        // Only spawn if we're under the adaptive cap and enough time has passed
        if (enemyCount < enemyCap && currentTime - this.lastEnemySpawnTime > minTimeBetweenSpawns) {
            // Spawn enemies with controlled strength
            if (this.scene.enemyManager && typeof this.scene.enemyManager.spawnEnemy === 'function') {
                // Determine how many enemies to spawn based on BPM
                let enemiesToSpawn = 1;
                
                // For faster music (higher BPM), spawn more enemies per batch
                if (this.currentBPM > 150) {
                    enemiesToSpawn = 3; // Very fast music
                } else if (this.currentBPM > 120) {
                    enemiesToSpawn = 2; // Moderately fast music
                }
                
                // Maybe spawn even more enemies in high-energy segments
                if (isHighEnergySegment) {
                    enemiesToSpawn += 1;
                }
                
                // Spawn the enemies
                for (let i = 0; i < enemiesToSpawn; i++) {
                    // Use wider and higher strength range (0.3-0.7 instead of 0.3-0.6)
                    const randomStrength = 0.3 + (Math.random() * 0.4);
                    
                    // Increase strength for high energy segments
                    const finalStrength = isHighEnergySegment ? 
                        Math.min(0.8, randomStrength + 0.1) : randomStrength;
                    
                    // Get a random note from current active notes
                    const note = this.getRandomActiveNote();
                        
                    // Spawn enemy with both strength and note
                    this.scene.enemyManager.spawnEnemy(finalStrength, note);
                }
                
                this.lastEnemySpawnTime = currentTime;
                
                // Occasionally spawn a powerup - increased chance from 5% to 10%
                const canSpawnPowerup = this.scene.enemyManager.spawnPowerupHex && 
                                        typeof this.scene.enemyManager.spawnPowerupHex === 'function' &&
                                        (!this.scene.enemyManager.powerupHex || !this.scene.enemyManager.powerupHex.active);
                                        
                if (Math.random() < 0.1 && canSpawnPowerup) {
                    this.scene.enemyManager.spawnPowerupHex();
                }
            }
        }
    }
    
    resetBeatIndex(currentTime) {
        // Find the next beat based on current time
        if (!this.audioData || !this.audioData.beats) return;
        
        for (let i = 0; i < this.audioData.beats.length; i++) {
            if (this.audioData.beats[i].time > currentTime) {
                this.nextBeatIndex = i;
                break;
            }
        }
    }
    
    /**
     * Updates the audio data used by the analyzer with fresh data
     * This is crucial when audio data is loaded after the AudioAnalyzer is created
     * @param {Object} newAudioData - The new audio data to use
     */
    updateAudioData(newAudioData) {
        if (!newAudioData) {
            console.error("❌ Cannot update AudioAnalyzer with null data");
            return;
        }
        
        // Store previous beat count for logging
        const oldBeatCount = this.audioData && this.audioData.beats ? this.audioData.beats.length : 0;
        
        // Update with the new data
        this.audioData = newAudioData;
        
        // Log a sample of the data structure to debug
        if (this.audioData.beats && this.audioData.beats.length > 0) {
            console.log("📊 Sample beat data structure:", JSON.stringify(this.audioData.beats[0]));
            
            // Check if the beats array contains numbers (timestamps) instead of objects with properties
            if (typeof this.audioData.beats[0] === 'number') {
                
                // Convert each number to a beat object with time and default strength
                this.audioData.beats = this.audioData.beats.map(beatTime => {
                    return {
                        time: beatTime,
                        strength: 0.5  // Default strength
                    };
                });
                
            } 
            // Check if we need to remap the beats array from a different object structure
            else if (this.audioData.beats[0] && typeof this.audioData.beats[0].time === 'undefined') {
                
                // Try to determine the correct properties based on what's available
                const sampleBeat = this.audioData.beats[0];
                let timeProperty = null;
                let strengthProperty = null;
                
                // Look for possible time properties
                for (const prop of ['start', 'timestamp', 'time', 't']) {
                    if (typeof sampleBeat[prop] === 'number') {
                        timeProperty = prop;
                        break;
                    }
                }
                
                // Look for possible strength properties
                for (const prop of ['strength', 'confidence', 'energy', 'loudness', 'intensity']) {
                    if (typeof sampleBeat[prop] === 'number') {
                        strengthProperty = prop;
                        break;
                    }
                }
                
                // Only remap if we found a time property
                if (timeProperty) {
                    this.audioData.beats = this.audioData.beats.map(beat => {
                        return {
                            time: beat[timeProperty],
                            strength: strengthProperty ? beat[strengthProperty] : 0.5  // Default strength if not found
                        };
                    });
                    
                } else {
                    console.error("❌ Could not remap object-based beat data, no valid time property found");
                }
            }
        }
        
        // Reset beat tracking
        this.nextBeatIndex = 0;
        this.calculatedAverageBPM = false;
        
        // Log the update
        const newBeatCount = this.audioData.beats ? this.audioData.beats.length : 0;
        
        if (this.audioData.segments) {
        }
        
        // Log BPM from metadata if available
        if (this.audioData.metadata && this.audioData.metadata.bpm) {
            this.averageBPM = this.audioData.metadata.bpm;
            this.currentBPM = this.averageBPM;
            this.calculatedAverageBPM = true;
        } else if (this.audioData.beats && this.audioData.beats.length > 1) {
            // Calculate average BPM from the beats if no metadata BPM
            this.calculateAverageBPM();
        }
    }
    
    calculateAverageBPM() {
        
        // First check if BPM metadata exists
        if (this.audioData.metadata && this.audioData.metadata.bpm) {
            this.averageBPM = this.audioData.metadata.bpm;
            this.calculatedAverageBPM = true;
            return;
        }
        
        // Calculate from beat timings if no metadata
        const timeDiffs = [];
        let totalTimeDiff = 0;
        
        // Look at all beats to get the average time between them
        for (let i = 1; i < this.audioData.beats.length; i++) {
            const currentBeat = this.audioData.beats[i];
            const prevBeat = this.audioData.beats[i-1];
            const timeDiff = currentBeat.time - prevBeat.time;
            
            // Only include reasonable values (filter out any erroneous entries)
            if (timeDiff > 0.1 && timeDiff < 2.0) {
                timeDiffs.push(timeDiff);
                totalTimeDiff += timeDiff;
            }
        }
        
        if (timeDiffs.length > 0) {
            const avgTimeDiff = totalTimeDiff / timeDiffs.length;
            this.averageBPM = 60 / avgTimeDiff;
        } else {
            // Fallback to default if we couldn't calculate
            this.averageBPM = 120;
        }
        
        this.calculatedAverageBPM = true;
    }
    
    processBeat(currentTime) {
        if (!this.audioData || !this.audioData.beats || this.audioData.beats.length === 0) {
            console.warn("No beat data available");
            return;
        }
        
        // Process notes for EQ visualization
        this.processNotesForEQ(currentTime);
    
        // Check if we should calculate the average BPM from the analysis data
        if (!this.calculatedAverageBPM && this.audioData.beats.length > 1) {
            this.calculateAverageBPM();
        }
    
        if (this.nextBeatIndex < this.audioData.beats.length) {
            const nextBeat = this.audioData.beats[this.nextBeatIndex];
            if (!nextBeat || typeof nextBeat.time === 'undefined') {
                console.warn("Invalid beat data at index", this.nextBeatIndex);
                this.nextBeatIndex++;
                return;
            }
            
            
            if (currentTime >= nextBeat.time) {
                // Beat detected!
                
                // Calculate instantaneous BPM from the time difference between beats
                if (this.nextBeatIndex > 0) {
                    const prevBeat = this.audioData.beats[this.nextBeatIndex - 1];
                    const timeDiff = nextBeat.time - prevBeat.time;
                    if (timeDiff > 0) {
                        const instantBpm = 60 / timeDiff;
                        
                        // Check if the instantaneous BPM is reasonable - ignore values that are too far from average
                        if (instantBpm > 40 && instantBpm < 240) {
                            this.currentBPM = instantBpm;
                        } else {
                            // If the instantaneous BPM is unreasonable, use the average BPM instead
                            this.currentBPM = this.averageBPM || 120;
                        }
                    }
                } else if (this.averageBPM) {
                    // Use pre-calculated average BPM for first beat
                    this.currentBPM = this.averageBPM;
                } else {
                    // Set a default BPM if we don't have anything else
                    this.currentBPM = 120;
                }
                
                // Trigger beat event
                this.onBeat(nextBeat);
                this.nextBeatIndex++;
                
                // Force spawn an enemy if none have been spawned for a while
                if (this.lastEnemySpawnTime === undefined || 
                    currentTime - this.lastEnemySpawnTime > 3) {
                    this.spawnEnemiesOnBeat(nextBeat);
                    this.lastEnemySpawnTime = currentTime;
                }
            }
        } else if (this.audioData.beats && this.audioData.beats.length > 0) {
            // If we've gone through all beats, loop back to the beginning
            // but don't reset the BPM value, keep it stable
            this.nextBeatIndex = 0;
        }
    }
    
    // Track last segment type for comparison to avoid duplicate effects
    lastSegmentType = null;
    lastSegmentChangeTime = 0;
    
    processSegment(currentTime) {
        // Check if we have segment data
        if (!this.audioData || !this.audioData.segments || this.audioData.segments.length === 0) {
            // If no segments found, create a default segment structure for debugging
            this.audioData.segments = [
                { type: 'intro', start: 0, end: 30 },
                { type: 'verse', start: 30, end: 60 },
                { type: 'chorus', start: 60, end: 90 },
                { type: 'verse', start: 90, end: 120 },
                { type: 'bridge', start: 120, end: 150 },
                { type: 'chorus', start: 150, end: 180 },
                { type: 'outro', start: 180, end: 300 }
            ];
        }
        
        // Find the current segment based on time - only process segment changes every 250ms
        // to avoid flickering from rapid segment changes
        const MIN_TIME_BETWEEN_SEGMENT_CHECKS = 0.25; // seconds
        
        if (currentTime - this.lastSegmentChangeTime < MIN_TIME_BETWEEN_SEGMENT_CHECKS) {
            // Skip segment check if we checked too recently
            return;
        }
        
        this.lastSegmentChangeTime = currentTime;
        let nextSegmentIndex = -1;
        
        // Log the currentTime for debugging (less frequently to reduce spam)
        
        // Determine which segment we're in based on start and end times
        for (let i = 0; i < this.audioData.segments.length; i++) {
            const segment = this.audioData.segments[i];
            
            // Ensure segment has start and end properties
            if (segment.start === undefined || segment.end === undefined) {
                console.warn(`Segment ${i} is missing start or end properties`, segment);
                continue;
            }
            
            // Check if current time is within this segment
            if (currentTime >= segment.start && currentTime < segment.end) {
                nextSegmentIndex = i;
                break;
            }
        }
        
        // If no matching segment was found (possibly past the last segment), use the last one
        if (nextSegmentIndex === -1 && this.audioData.segments.length > 0) {
            nextSegmentIndex = this.audioData.segments.length - 1;
        }
        
        // Only process if we have a valid segment index
        if (nextSegmentIndex !== -1) {
            const newSegment = this.audioData.segments[nextSegmentIndex];
            
            // Important change: Only trigger segment change if the type is different
            // This prevents flickering when crossing segment boundaries
            const newSegmentType = newSegment.type || 'unknown';
            
            // Check if index changed AND the type is different from last type
            if (nextSegmentIndex !== this.currentSegmentIndex && 
                newSegmentType !== this.lastSegmentType) {
                
                
                // If this is not the first segment change, get the previous segment for logging
                if (this.currentSegmentIndex >= 0 && this.currentSegmentIndex < this.audioData.segments.length) {
                    const prevSegment = this.audioData.segments[this.currentSegmentIndex];
                }
                
                // Update segment index and type
                this.currentSegmentIndex = nextSegmentIndex;
                this.lastSegmentType = newSegmentType;
                
                // Trigger segment change event
                this.onSegmentChange(newSegment);
            } else if (nextSegmentIndex !== this.currentSegmentIndex) {
                // If only the index changed but not the type, just update the index silently
                this.currentSegmentIndex = nextSegmentIndex;
            }
        }
    }
    
    /**
     * Makes existing enemies pulse in response to volume changes
     * @param {number} volume - Current volume level (0-1)
     */
    pulseExistingEnemies(volume) {
        // Only continue if we have a scene with game objects
        if (!this.scene || !this.scene.children || !this.scene.children.list) return;
        
        // Find all enemies in the scene
        const enemies = this.scene.children.list.filter(obj => 
            obj.enemyType && obj.enemyType !== 'powerupHex' && obj.active);
        
        // Pulse them based on volume
        if (enemies.length > 0) {
            enemies.forEach(enemy => {
                // Calculate scale based on volume (more volume = much bigger pulse)
                const scaleFactor = 1 + (volume * 0.8); // Scale up to 80% larger (was 40%)
                
                // Skip if the enemy was recently pulsed
                if (enemy.lastPulseTime && this.scene.time.now - enemy.lastPulseTime < 100) {
                    return;
                }
                
                // Store pulse time
                enemy.lastPulseTime = this.scene.time.now;
                
                // Create a quick pulse effect
                this.scene.tweens.add({
                    targets: enemy,
                    scale: scaleFactor,
                    duration: 150,
                    yoyo: true,
                    ease: 'Sine.easeOut',
                    
                    // Adjust color tint based on volume (only for objects that support tinting)
                    onStart: () => {
                        // Only apply tint effects to objects that have the setTint method
                        if (typeof enemy.setTint === 'function') {
                            // Store original tint if not already stored
                            if (!enemy.originalTint) {
                                enemy.originalTint = enemy.tint || 0xffffff;
                            }
                            
                            // For high volume, shift toward brighter color
                            if (volume > 0.7) {
                                enemy.setTint(0xffffff);
                            }
                        }
                    },
                    
                    // Restore original tint when done
                    onComplete: () => {
                        if (enemy.active && enemy.originalTint && typeof enemy.setTint === 'function') {
                            enemy.setTint(enemy.originalTint);
                        }
                    }
                });
                
                // Also update the debug UI if this enemy has size factors stored
                if (enemy.baseSize && enemy.volumeFactor && enemy.bpmFactor && enemy.finalSize &&
                    this.scene.uiManager && typeof this.scene.uiManager.updateEnemySizeDebug === 'function') {
                    // Show current enemy's size info in debug
                    this.scene.uiManager.updateEnemySizeDebug(
                        enemy.baseSize,
                        enemy.volumeFactor,
                        enemy.bpmFactor,
                        enemy.finalSize
                    );
                }
            });
        }
    }
    
    /**
     * Process audio data to detect notes for EQ visualization
     * @param {number} currentTime - Current playback time in seconds
     */
    processNotesForEQ(currentTime) {
        // Check if we have segment data with pitch information
        if (!this.audioData || !this.audioData.segments) return;
        
        // Find current segment
        let currentSegment = null;
        for (const segment of this.audioData.segments) {
            if (currentTime >= segment.start && currentTime < segment.end) {
                currentSegment = segment;
                break;
            }
        }
        
        if (!currentSegment) return;
        
        // If we have pitch data in the segment, use it
        if (currentSegment.pitches) {
            this.visualizePitches(currentSegment.pitches);
        } else {
            // Otherwise, generate some simulated notes based on the segment type
            this.simulateNotesForSegment(currentSegment, currentTime);
        }
    }
    
    /**
     * Get a random active note for enemy spawning
     * @returns {string} A note name (like "C", "D#", etc.)
     */
    getRandomActiveNote() {
        // If we have active notes, choose one randomly
        if (this.currentActiveNotes && this.currentActiveNotes.length > 0) {
            const index = Math.floor(Math.random() * this.currentActiveNotes.length);
            return this.currentActiveNotes[index];
        }
        
        // Fallback to a random note if no active notes are available
        const allNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const randomIndex = Math.floor(Math.random() * allNotes.length);
        return allNotes[randomIndex];
    }

    /**
     * Visualize pitches from audio analysis and collect active notes
     * @param {Array} pitches - Array of pitch values
     */
    visualizePitches(pitches) {
        // Simplified mapping of pitch indices to note names
        const noteMap = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Collect active notes (above threshold)
        const threshold = 0.3;
        const activeNotes = [];
        
        // Find dominant pitches (above a threshold)
        let dominantPitchIndex = -1;
        let maxEnergy = threshold;
        
        for (let i = 0; i < pitches.length; i++) {
            if (pitches[i] > threshold) {
                const note = noteMap[i % 12];
                activeNotes.push(note);
                
                // Keep track of the most dominant pitch
                if (pitches[i] > maxEnergy) {
                    maxEnergy = pitches[i];
                    dominantPitchIndex = i;
                }
            }
        }
        
        // If we found a dominant pitch, visualize it
        if (dominantPitchIndex >= 0) {
            const note = noteMap[dominantPitchIndex % 12];
            this.eqVisualizer.activateLane(note, maxEnergy);
        }
        
        // Update the active notes list if we found any
        if (activeNotes.length > 0) {
            this.currentActiveNotes = activeNotes;
        }
    }
    
    /**
     * Simulate notes based on segment type when precise pitch data isn't available
     * @param {Object} segment - Current audio segment
     * @param {number} currentTime - Current playback time
     */
    simulateNotesForSegment(segment, currentTime) {
        // Only simulate a note every 0.2 seconds to avoid overwhelming visuals
        if (this.lastNoteTime && currentTime - this.lastNoteTime < 0.2) return;
        
        // Generate notes based on segment type
        let noteOptions = ['C', 'E', 'G']; // Default to C major chord notes
        let energy = 0.5;
        
        switch(segment.type) {
            case 'chorus':
                noteOptions = ['C', 'D', 'E', 'G', 'A']; // Pentatonic scale
                energy = 0.7 + (Math.random() * 0.3); // Higher energy
                break;
            case 'verse':
                noteOptions = ['E', 'G', 'B', 'D']; // Em7 chord notes
                energy = 0.4 + (Math.random() * 0.3); // Medium energy
                break;
            case 'bridge':
                noteOptions = ['A', 'C', 'E']; // Am chord notes
                energy = 0.3 + (Math.random() * 0.3); // Lower energy
                break;
            default:
                noteOptions = ['C', 'E', 'G']; // C major chord notes
                energy = 0.4 + (Math.random() * 0.3); // Default energy
        }
        
        // Select a random note from options
        const noteIndex = Math.floor(Math.random() * noteOptions.length);
        const note = noteOptions[noteIndex];
        
        // Activate lane with the note
        this.eqVisualizer.activateLane(note, energy);
        
        // Update active notes for enemy spawning (only update every 0.5 seconds to keep some stability)
        if (!this.lastNoteChangeTime || currentTime - this.lastNoteChangeTime > 0.5) {
            this.currentActiveNotes = noteOptions;
            this.lastNoteChangeTime = currentTime;
        }
        
        // Store last note time
        this.lastNoteTime = currentTime;
    }
    
    onBeat(beat) {
        // Store the current time as last beat time
        this.lastBeatTime = (this.scene.time.now - this.scene.gameStartTime) / 1000;
        
        // Trigger EQ visualization on beats with random notes for more activity
        const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const randomNote = notes[Math.floor(Math.random() * notes.length)];
        this.eqVisualizer.activateLane(randomNote, beat.strength);
        
        // Update beat info in UI
        if (this.scene.uiManager && this.scene.uiManager.updateBeatInfo) {
            this.scene.uiManager.updateBeatInfo(this.currentBPM, beat.strength);
        }
        
        // Spawn a powerup hexagon (20% chance on any beat)
        const canSpawnPowerup = this.scene.enemyManager && 
                                typeof this.scene.enemyManager.spawnPowerupHex === 'function' &&
                                (!this.scene.enemyManager.powerupHex || !this.scene.enemyManager.powerupHex.active);
                                
        if (Math.random() < 0.2 && canSpawnPowerup) {
            this.scene.enemyManager.spawnPowerupHex();
        }
        
        // Add beat-reactive FX to player
        this.addBeatFXToPlayer(beat);
        
        // Create beat-reactive visual effects
        this.createBeatVisuals(beat);
        
        // Pulse vignette effect with beat
        this.pulseVignetteWithBeat(beat);
        
        // Use camera manager for beat responses if available, otherwise fallback to direct shake
        if (this.scene.cameraManager) {
            if (beat.strength > 0.5) {
                // For stronger beats, use a shake
                const intensity = beat.strength * 0.005; // Very subtle shake
                this.scene.cameraManager.shake(100, intensity);
            } else {
                // For milder beats, use a beat response (subtle zoom)
                this.scene.cameraManager.beatResponse(beat.strength);
            }
        } else if (beat.strength > 0.5) {
            // Fallback to direct camera shake if cameraManager not available
            const intensity = beat.strength * 0.005; // Very subtle shake
            this.scene.cameras.main.shake(100, intensity);
        }
        
        // Spawn enemies based on beat strength and current segment
        this.spawnEnemiesOnBeat(beat);
        
        // Pulse starfield on beats
        if (this.scene.particleSystem && typeof this.scene.particleSystem.pulseStarfield === 'function') {
            this.scene.particleSystem.pulseStarfield(beat.strength);
        }
    }
    
    addBeatFXToPlayer(beat) {
        // Add subtle effects to the player that pulse with the beat
        if (!this.scene.player || !this.scene.player.sprite) return;
        
        // Scale player slightly with beat (very subtle)
        const scaleAmount = 1 + (beat.strength * 0.05); // Max 5% increase
        this.scene.player.sprite.setScale(scaleAmount);
        
        // Reset scale after a short time
        this.scene.time.delayedCall(100, () => {
            if (this.scene.player && this.scene.player.sprite) {
                this.scene.player.sprite.setScale(1);
            }
        });
        
        // Add a brief flash effect (subtle, not for photosensitivity)
        if (this.scene.renderer.type === Phaser.WEBGL && 
            this.scene.player.sprite.preFX && 
            beat.strength > 0.6) {
            try {
                // Get color based on current segment
                let color = 0xffffff;
                if (this.audioData.segments && this.currentSegmentIndex < this.audioData.segments.length) {
                    const segment = this.audioData.segments[this.currentSegmentIndex];
                    switch(segment.type) {
                        case 'chorus': color = 0xff00ff; break;
                        case 'verse': color = 0x00ffff; break;
                        case 'bridge': color = 0xffff00; break;
                        default: color = 0xffffff;
                    }
                }
                
                // Add temporary glow
                const glow = this.scene.player.sprite.preFX.addGlow(color, 2, 0, false);
                
                // Remove glow after a short time
                this.scene.time.delayedCall(150, () => {
                    if (this.scene.player && this.scene.player.sprite && this.scene.player.sprite.preFX) {
                        this.scene.player.sprite.preFX.clear();
                    }
                });
            } catch (error) {
                console.warn("Error applying player beat effect:", error);
            }
        }
    }
    
    createBeatVisuals(beat) {
        // Prevent too many beat visuals from being created too quickly
        const currentTime = (this.scene.time.now - this.scene.gameStartTime) / 1000;
        if (currentTime - this.lastBeatVisualTime < 0.1) return;
        this.lastBeatVisualTime = currentTime;
        
        // Create a beat circle that expands outward from the center
        if (this.scene.particleSystem) {
            // Get color based on current segment
            let color = 0xffffff;
            if (this.audioData.segments && this.currentSegmentIndex < this.audioData.segments.length) {
                const segment = this.audioData.segments[this.currentSegmentIndex];
                switch(segment.type) {
                    case 'chorus': color = 0xff00ff; break; // Magenta
                    case 'verse': color = 0x00ffff; break;  // Cyan
                    case 'bridge': color = 0xffff00; break; // Yellow
                    default: color = 0xffffff; break;       // White
                }
            }
            
            // Create beat circle at center of screen - behind everything
            const centerX = this.scene.gameWidth / 2;
            const centerY = this.scene.gameHeight / 2;
            
            // Scale the size based on beat strength (stronger beats = bigger circles)
            // Reduced base size from 60 to 40, max from 180 to 120
            const sizeFactor = 40 + (beat.strength * 80);
            
            // Only create the central effect if showCentralParticles is enabled
            if (this.scene.particleSystem.showCentralParticles) {
                // Create the beat visualization
                this.scene.particleSystem.createColorChangeEffect(centerX, centerY, color, sizeFactor);
            }
            
            // For stronger beats, create additional beat circles at random positions
            if (beat.strength > 0.65) { // Only on stronger beats (threshold increased)
                // One smaller secondary circle - use game dimensions for proper positioning
                const randomX = Phaser.Math.Between(this.scene.gameWidth * 0.2, this.scene.gameWidth * 0.8); 
                const randomY = Phaser.Math.Between(this.scene.gameHeight * 0.2, this.scene.gameHeight * 0.8); 
                const smallerSize = sizeFactor * 0.4; // Even smaller secondary circles
                this.scene.particleSystem.createColorChangeEffect(randomX, randomY, color, smallerSize);
                
                // For very strong beats, add a subtle screen shake
                if (beat.strength > 0.8) { // Increased threshold
                    const intensity = beat.strength * 0.004; // Even more subtle shake
                    this.scene.cameras.main.shake(120, intensity);
                }
            }
        }
        
        // For stronger beats, create additional beat visuals around the player
        if (beat.strength > 0.6 && this.scene.player && this.scene.particleSystem) {
            const playerX = this.scene.player.x || 400;
            const playerY = this.scene.player.y || 300;
            
            // Create beat particles around player
            this.scene.particleSystem.createBeatParticles(beat.strength, playerX, playerY);
        }
    }
    
    spawnEnemiesOnBeat(beat) {
        // Make sure enemyManager exists and has spawnEnemy function
        if (!this.scene.enemyManager || typeof this.scene.enemyManager.spawnEnemy !== 'function') {
            console.error("Enemy manager not found or missing spawnEnemy function!");
            return;
        }
        
        // Calculate adaptive enemy cap based on current BPM
        // Faster songs (higher BPM) can have more enemies
        // Range: 25 enemies at 60 BPM to 50 enemies at 180+ BPM
        const baseCap = 25;
        const bpmBonus = Math.max(0, Math.min(25, (this.currentBPM - 60) / 5));
        const enemyCap = Math.round(baseCap + bpmBonus);
        
        // Count existing enemies to prevent performance issues
        let enemyCount = 0;
        this.scene.children.list.forEach(obj => {
            if (obj.enemyType && obj.enemyType !== 'powerupHex') {
                enemyCount++;
            }
        });
        
        // Only spawn if we're below the adaptive cap
        if (enemyCount < enemyCap) {
            // Determine enemy count based on beat strength, BPM, and segment type
            let enemiesToSpawn = 0;
            
            // Base enemy count on beat strength
            if (beat.strength > 0.7) {
                enemiesToSpawn = 3; // Very strong beat
            } else if (beat.strength > 0.45) {
                enemiesToSpawn = 2; // Medium beat
            } else if (beat.strength > 0.25) {
                enemiesToSpawn = 1; // Weaker beat
            } else if (Math.random() < 0.3) {
                // Even weak beats have a chance to spawn enemies
                enemiesToSpawn = 1;
            }
            
            // Adjust based on BPM - faster songs (higher BPM) spawn more enemies per beat
            const bpmFactor = this.currentBPM / 120; // 1.0 at normal tempo, 1.5 at 180 BPM
            enemiesToSpawn = Math.round(enemiesToSpawn * bpmFactor);
            
            // Ensure at least 1 enemy for beats that should spawn something
            if (beat.strength > 0.25 && enemiesToSpawn === 0) {
                enemiesToSpawn = 1;
            }
            
            // Modify based on segment type
            if (this.audioData.segments && this.currentSegmentIndex < this.audioData.segments.length) {
                const segment = this.audioData.segments[this.currentSegmentIndex];
                if (segment.type === 'chorus') {
                    enemiesToSpawn += 2; // More enemies during chorus
                } else if (segment.type === 'verse') {
                    enemiesToSpawn += 1; // More enemies during verse
                } else if (segment.type === 'bridge' && enemiesToSpawn > 0) {
                    // 50% chance to reduce enemy count during bridge (calmer section)
                    if (Math.random() < 0.5) {
                        enemiesToSpawn -= 1;
                    }
                }
            }
            
            // Cap at reasonable number based on maxEnemiesPerBeat, but let BPM influence the cap
            const dynamicCap = Math.round(this.maxEnemiesPerBeat * bpmFactor);
            enemiesToSpawn = Math.min(enemiesToSpawn, dynamicCap);
            
            // Ensure positive number
            enemiesToSpawn = Math.max(0, enemiesToSpawn);
            
            // Spawn multiple enemies with varying strength - positioned in sync with beat
            for (let i = 0; i < enemiesToSpawn; i++) {
                if (enemyCount + i >= enemyCap) break; // Safety check
                
                // Vary strength slightly for each enemy
                const variation = (Math.random() * 0.2) - 0.1; // -0.1 to +0.1
                const adjustedStrength = Math.min(0.8, beat.strength + variation);
                
                // Get a random note from current active notes if available
                const note = this.getRandomActiveNote();
                
                // Spawn enemy with adjusted strength and note
                const enemy = this.scene.enemyManager.spawnEnemy(adjustedStrength, note);
                
                // Add "beat spawned" property to track enemies that came from beats
                if (enemy) {
                    enemy.beatSpawned = true;
                    enemy.beatStrength = beat.strength;
                    
                    // Make the enemy briefly pulse to show it's tied to the beat
                    this.scene.tweens.add({
                        targets: enemy,
                        scale: 1.3,
                        duration: 150,
                        yoyo: true,
                        ease: 'Sine.easeOut'
                    });
                }
            }
            
            // Update last spawn time
            this.lastEnemySpawnTime = (this.scene.time.now - this.scene.gameStartTime) / 1000;
        } else {
        }
    }
    
    /**
     * Makes the vignette effect pulse with the beat
     * @param {Object} beat - The current beat data
     */
    pulseVignetteWithBeat(beat) {
        // Try using the WebGL FX pipeline vignette first
        let usingBuiltInVignette = false;
        
        if (this.scene.renderer && this.scene.renderer.type === Phaser.WEBGL && this.scene.vignetteEffect) {
            try {
                // Calculate effect intensity based on beat strength
                const strength = 0.5 + (beat.strength * 0.5); // Scale from 0.5 to 1.0
                const radius = Math.max(0.3, 0.7 - (beat.strength * 0.3)); // Stronger beats = smaller radius
                
                // Create a quick pulse effect 
                this.scene.tweens.add({
                    targets: this.scene.vignetteEffect,
                    strength: strength,
                    radius: radius, 
                    duration: 200,
                    yoyo: true,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        // Reset to default values after pulse
                        if (this.scene.vignetteEffect) {
                            try {
                                this.scene.vignetteEffect.radius = 0.7;
                                this.scene.vignetteEffect.strength = 0.5;
                            } catch (error) {
                                // Silently handle errors
                            }
                        }
                    }
                });
                
                usingBuiltInVignette = true;
            } catch (error) {
                console.warn("Error pulsing built-in vignette effect:", error);
                // Disable built-in vignette effect for future attempts to avoid repeated errors
                this.scene.vignetteEffect = null;
                usingBuiltInVignette = false;
            }
        }
        
        // Fallback to custom vignette if built-in one isn't available or failed
        if (!usingBuiltInVignette && this.scene.particleSystem && this.scene.particleSystem.customVignette) {
            try {
                // Calculate effect intensity based on beat strength
                const strength = 0.5 + (beat.strength * 0.5); // Scale from 0.5 to 1.0
                const radius = Math.max(0.3, 0.7 - (beat.strength * 0.3)); // Stronger beats = smaller radius
                
                // Update custom vignette
                const color = this.scene.vignetteColor || 0x000000;
                this.scene.particleSystem.updateCustomVignette(color, strength, radius);
                
                // Reset values after pulse using a tween
                this.scene.time.delayedCall(200, () => {
                    if (this.scene.particleSystem && this.scene.particleSystem.updateCustomVignette) {
                        this.scene.particleSystem.updateCustomVignette(
                            this.scene.vignetteColor || 0x000000,
                            0.5, // Default strength
                            0.7  // Default radius
                        );
                    }
                });
            } catch (error) {
                console.warn("Error pulsing custom vignette effect:", error);
            }
        }
    }
    
    onSegmentChange(segment) {
        
        // Update UI with segment info
        if (this.scene.uiManager && this.scene.uiManager.updateSegmentInfo) {
            this.scene.uiManager.updateSegmentInfo(segment.type);
        }
        
        // Change background color based on segment - use more vibrant colors
        let bgColor, flashColor, vignetteColor;
        
        try {
            switch(segment.type) {
                case 'chorus': 
                    bgColor = 0x330033;      // Deeper purple
                    flashColor = 0xff00ff;   // Bright magenta flash
                    vignetteColor = 0xff00ff; // Magenta vignette
                    break;
                case 'verse': 
                    bgColor = 0x002244;      // Deeper blue
                    flashColor = 0x00ffff;   // Cyan flash
                    vignetteColor = 0x00ffff; // Cyan vignette
                    break;
                case 'bridge': 
                    bgColor = 0x333300;      // Deeper yellow
                    flashColor = 0xffff00;   // Bright yellow flash
                    vignetteColor = 0xffff00; // Yellow vignette
                    break;
                default: 
                    bgColor = 0x000033;      // Dark blue (default)
                    flashColor = 0x0066ff;   // Bright blue flash
                    vignetteColor = 0x6699ff; // Blue vignette
            }
            
            // Update vignette color if available, with a timer to reset it
            if (this.scene.renderer && this.scene.renderer.type === Phaser.WEBGL && this.scene.vignetteEffect) {
                this.scene.vignetteColor = vignetteColor;
                
                // Reset vignette color back to default after 3 seconds
                this.scene.time.delayedCall(3000, () => {
                    if (this.scene.vignetteEffect) {
                        this.scene.vignetteColor = 0x000000; // Reset to black
                    }
                });
            }
            
            // Ensure central particles are restored if they were turned off
            if (this.scene.particleSystem && typeof this.scene.particleSystem.restoreCentralParticles === 'function') {
                this.scene.particleSystem.restoreCentralParticles();
            }
        } catch (error) {
            console.warn("Error setting segment colors:", error);
            // Use default values if there was an error
            bgColor = 0x000033;      // Dark blue (default)
            flashColor = 0x0066ff;   // Bright blue flash
            vignetteColor = 0x6699ff; // Blue vignette
        }
        
        // Use camera manager for flash if available
        if (this.scene.cameraManager) {
            // Create a flash effect for segment change
            this.scene.cameraManager.flash(800, flashColor, 0.3);
        } else {
            // Fallback to manual flash rectangle
            const flash = this.scene.add.rectangle(
                this.scene.gameWidth / 2, 
                this.scene.gameHeight / 2, 
                this.scene.gameWidth, 
                this.scene.gameHeight, 
                flashColor, 
                0.3
            );
            flash.setDepth(100); // Above everything
            
            // Flash and fade out
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 800,
                onComplete: () => {
                    flash.destroy();
                }
            });
        }
        
        // Flash background instead of persistent tinting
        const background = this.scene.children.list.find(obj => 
            obj.type === 'Rectangle' && obj.depth === -20);
        
        if (background) {
            // Save original color (should be black)
            const originalColor = 0x000000;
            
            // Flash the background briefly with segment color
            this.scene.tweens.add({
                targets: background,
                fillColor: bgColor,
                duration: 600,
                yoyo: true,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    // Ensure it returns to black
                    background.fillColor = originalColor;
                }
            });
        }
        
        // Create multiple satellite emitters with fixed implementation for visual impact
        if (this.scene.particleSystem) {
            // Clear existing satellite emitters to prevent too many
            if (this.scene.particleSystem.clearSatelliteEmitters) {
                this.scene.particleSystem.clearSatelliteEmitters();
            }
            
            
            // Create multiple emitters based on segment type - with delay to ensure proper creation
            this.scene.time.delayedCall(100, () => {
                // Determine number of emitters based on segment type
                const emitterCount = segment.type === 'chorus' ? 3 : 
                                     segment.type === 'verse' ? 2 : 1;
                
                // Create emitters at random positions
                for (let i = 0; i < emitterCount; i++) {
                    // Place emitters within 10-90% of screen dimensions
                    const x = Phaser.Math.Between(this.scene.gameWidth * 0.1, this.scene.gameWidth * 0.9);
                    const y = Phaser.Math.Between(this.scene.gameHeight * 0.1, this.scene.gameHeight * 0.9);
                    
                    // Use the fixed satellite emitter implementation
                    this.scene.particleSystem.createSatelliteEmitter(x, y, segment.type);
                }
            });
        }
        
        // Adjust enemy spawn rate based on segment type
        switch(segment.type) {
            case 'chorus':
                // More enemies during chorus
                this.enemySpawnRate = 2.0; // Increased from 1.5
                this.maxEnemiesPerBeat = 5; // Increased from 3
                break;
            case 'verse':
                // Normal enemies during verse
                this.enemySpawnRate = 1.5; // Increased from 1.0
                this.maxEnemiesPerBeat = 3; // Increased from 2
                break;
            case 'bridge':
                // Fewer enemies during bridge
                this.enemySpawnRate = 1.0; // Increased from 0.8
                this.maxEnemiesPerBeat = 2; // Increased from 1
                break;
            default:
                // Default values for other segment types
                this.enemySpawnRate = 1.5; // Increased from 1.0
                this.maxEnemiesPerBeat = 3; // Increased from 2
        }
        
        // No need for a second set of satellite emitters - removed duplicate code
    }
    
    /**
     * Shows a large, unmistakable notification about volume changes
     * @param {number} volume - Current volume level (0-1)
     */
    showVolumeChangeNotification(volume) {
        if (!this.scene) return;
        
        // Get game dimensions
        const gameWidth = this.scene.gameWidth || 1280;
        const gameHeight = this.scene.gameHeight || 720;
        
        // Choose color based on volume
        let color;
        if (volume < 0.3) color = '#00ffff'; // Blue for low volume
        else if (volume < 0.6) color = '#ffff00'; // Yellow for medium volume
        else color = '#ff0000'; // Red for high volume
        
        // Create a HUGE notification with the volume value
        const volumeText = this.scene.add.text(
            gameWidth / 2,
            gameHeight / 2,
            `VOLUME: ${volume.toFixed(2)}`,
            {
                fontSize: '72px',
                fontStyle: 'bold',
                align: 'center',
                color: color,
                stroke: '#000000',
                strokeThickness: 6,
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5);
        
        // Add shadow for better visibility
        volumeText.setShadow(4, 4, 'rgba(0,0,0,0.5)', 10);
        
        // Set to top layer
        volumeText.setDepth(1000);
        
        // Set a brief fade-out animation
        this.scene.tweens.add({
            targets: volumeText,
            alpha: 0,
            scale: 2.0,
            duration: 750,
            ease: 'Power2',
            onComplete: () => {
                volumeText.destroy();
            }
        });
        
        // Also update enemy sizes text at the same time
        if (this.scene.uiManager && typeof this.scene.uiManager.updateVolumeDebug === 'function') {
            this.scene.uiManager.updateVolumeDebug(volume, this.currentBPM);
        }
    }
    
    // Clean up resources when the scene is destroyed or game ends
    cleanup() {
        
        // Stop the music if it's still playing
        if (this.music && this.music.isPlaying) {
            this.music.stop();
        }
        
        this.music = null;
    }
}
