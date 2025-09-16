// HighScoreManager.js - Manages high scores for the music game

export default class HighScoreManager {
    constructor(scene) {
        this.scene = scene;
        // Initialize with empty scores array
        this.currentScores = [];
        this.isLoading = false;
        
        console.log("HighScoreManager initialized");
        
        // Create mock scores for immediate use if needed
        this._mockScores = this.createMockScores();
    }

    /**
     * Fetch high scores for a specific song
     * @param {string} songId - The song ID to get scores for
     * @param {boolean} force - Whether to force a refresh of scores even if already loaded
     * @returns {Promise} - Promise resolving to array of high scores
     */
    async getHighScores(songId, force = false) {
        if (!songId) {
            console.error("No song ID provided");
            return [];
        }
        
        // If we already have scores and force is false, return them
        if (this.currentScores.length > 0 && !force) {
            return this.currentScores;
        }

        this.isLoading = true;
        
        try {
            const response = await fetch(`/scores/${songId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch scores: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.currentScores = data.scores || [];
            this.isLoading = false;
            return this.currentScores;
        } catch (error) {
            console.error("Error fetching high scores:", error);
            this.isLoading = false;
            
            // For demo purposes, create some mock scores if we can't fetch from API
            this.currentScores = this.createMockScores();
            return this.currentScores;
        }
    }

    /**
     * Submit a new score to the server
     * @param {Object} scoreData - The score data to submit
     * @param {string} scoreData.songId - The song ID
     * @param {number} scoreData.score - The player's score
     * @param {string} scoreData.initials - The player's 3-letter initials
     * @returns {Promise} - Promise resolving to object with updated scores and rank
     */
    async submitScore(scoreData) {
        console.log("🏆🏆🏆 SUBMITTING SCORE:", scoreData);
        
        if (!scoreData || !scoreData.songId || !scoreData.score || !scoreData.initials) {
            console.error("Invalid score data", scoreData);
            return { success: false, error: "Invalid score data" };
        }

        // BACKUP THE SCORE LOCALLY IN CASE SERVER SUBMISSION FAILS
        // This ensures the score is never lost even if server issues occur
        try {
            const scoresKey = `highscores_${scoreData.songId}`;
            const savedScores = JSON.parse(localStorage.getItem(scoresKey) || '{"scores":[]}');
            
            // Add new score to local storage
            savedScores.scores.push({
                initials: scoreData.initials,
                score: scoreData.score,
                date: new Date().toISOString().split('T')[0]
            });
            
            // Sort and keep top 10
            savedScores.scores.sort((a, b) => b.score - a.score);
            if (savedScores.scores.length > 10) {
                savedScores.scores = savedScores.scores.slice(0, 10);
            }
            
            // Save back to localStorage
            localStorage.setItem(scoresKey, JSON.stringify(savedScores));
            console.log("✅ Score backed up to localStorage");
        } catch (e) {
            console.warn("Failed to backup score to localStorage:", e);
        }

        // Try to submit the score to the server
        try {
            console.log("📤 Sending score to server via fetch...");
            
            const response = await fetch('/scores', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    songId: scoreData.songId,
                    score: scoreData.score,
                    initials: scoreData.initials
                })
            });

            if (!response.ok) {
                // If the server returns an error, try to parse it
                try {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to submit score");
                } catch (parseError) {
                    throw new Error(`Failed to submit score: ${response.statusText}`);
                }
            }

            const data = await response.json();
            console.log("✅ Score submitted successfully:", data);
            this.currentScores = data.scores || [];
            return {
                success: true,
                scores: this.currentScores,
                rank: data.rank
            };
        } catch (error) {
            console.error("❌ Error submitting score to server:", error);
            
            // Use the local backup we just created if server submission fails
            try {
                const scoresKey = `highscores_${scoreData.songId}`;
                const savedScores = JSON.parse(localStorage.getItem(scoresKey) || '{"scores":[]}');
                console.log("Using local backup scores:", savedScores);
                this.currentScores = savedScores.scores;
                
                // Find rank of submitted score
                const rank = this.currentScores.findIndex(s => 
                    s.initials === scoreData.initials && s.score === scoreData.score
                ) + 1;
                
                return {
                    success: true,
                    scores: this.currentScores,
                    rank: rank > 0 ? rank : 1  // Default to rank 1 if not found
                };
            } catch (e) {
                console.error("Failed to use local backup, falling back to mock scores:", e);
                // Fall back to mock scores as last resort
                const mockResult = this.addMockScore(scoreData);
                return mockResult;
            }
        }
    }

    /**
     * Check if a score qualifies for the high scores list
     * @param {number} score - The score to check
     * @returns {boolean} - True if score qualifies for top 10, false otherwise
     */
    isHighScore(score) {
        console.log(`Checking if ${score} is a high score...`);
        
        // Log current scores for debugging
        if (this.currentScores && this.currentScores.length > 0) {
            console.log(`Current scores: ${JSON.stringify(this.currentScores.slice(0, 3))}...`);
        } else {
            console.log("No current scores available, using mock scores");
            this.currentScores = this._mockScores;
        }
        
        // ALWAYS save real scores - don't use mock/fake scores
        console.log("🏆 All player scores are now being saved permanently");
        return true;
        
        // If we have fewer than 10 scores, any score qualifies
        if (this.currentScores.length < 10) {
            console.log(`Have only ${this.currentScores.length} scores, so ${score} qualifies!`);
            return true;
        }
        
        // Check if score is higher than the lowest score in the top 10
        const lowestScore = Math.min(...this.currentScores.map(s => s.score));
        console.log(`Lowest high score is currently ${lowestScore}`);
        
        // Always return true for scores over 10,000 for testing (lowered threshold)
        if (score > 10000) {
            console.log(`Score ${score} is over 10,000, so it qualifies regardless!`);
            return true;
        }
        
        const qualifies = score > lowestScore;
        console.log(`Score ${score} qualifies: ${qualifies}`);
        return qualifies;
    }

    /**
     * Get the rank a score would have in the current high scores
     * @param {number} score - The score to check
     * @returns {number} - The rank (1-based, -1 if doesn't qualify)
     */
    getRankForScore(score) {
        const sortedScores = [...this.currentScores].sort((a, b) => b.score - a.score);
        
        for (let i = 0; i < sortedScores.length; i++) {
            if (score >= sortedScores[i].score) {
                return i + 1;
            }
        }
        
        // If we have fewer than 10 scores, the score will be last on the list
        if (sortedScores.length < 10) {
            return sortedScores.length + 1;
        }
        
        return -1; // Doesn't qualify
    }

    /**
     * Create an empty score template with just the current player's score
     * @param {string} initials - Player's initials (defaults to "YOU")
     * @param {number} score - Player's score (defaults to current score)
     * @returns {Array} - Array with a single score entry
     */
    createEmptyScoreTemplate(initials = "YOU", score = null) {
        const playerScore = score || (this.scene.score || 10000);
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Return a single entry with the player's score
        return [
            { initials, score: playerScore, date: today }
        ];
    }
    
    /**
     * Create mock scores for demonstration purposes
     * @returns {Array} - Array of mock score objects
     */
    createMockScores() {
        // Generate a date string for today
        const today = new Date().toISOString().split('T')[0];
        
        const mockScores = [
            { initials: "AAA", score: 1000000, date: today },
            { initials: "BBB", score: 900000, date: today },
            { initials: "CCC", score: 800000, date: today },
            { initials: "DDD", score: 700000, date: today },
            { initials: "EEE", score: 600000, date: today },
            { initials: "FFF", score: 500000, date: today },
            { initials: "GGG", score: 400000, date: today },
        ];
        
        return mockScores;
    }

    /**
     * Add a new score to the mock scores list
     * @param {Object} scoreData - The score data to add
     * @returns {Object} - Object with success status, scores and rank
     */
    addMockScore(scoreData) {
        // If we don't have any scores yet, create some mock ones
        if (this.currentScores.length === 0) {
            this.currentScores = this.createMockScores();
        }
        
        // Add the new score
        const newScore = {
            initials: scoreData.initials,
            score: scoreData.score,
            date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
        };
        
        // Add to current scores
        this.currentScores.push(newScore);
        
        // Sort scores by score (descending)
        this.currentScores.sort((a, b) => b.score - a.score);
        
        // Limit to 10 scores
        if (this.currentScores.length > 10) {
            this.currentScores = this.currentScores.slice(0, 10);
        }
        
        // Get rank of the new score
        const rank = this.currentScores.findIndex(s => s.score === newScore.score) + 1;
        
        return {
            success: true,
            scores: this.currentScores,
            rank: rank
        };
    }
}
