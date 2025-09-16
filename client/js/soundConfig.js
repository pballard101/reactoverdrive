/**
 * Sound configuration for the music game
 * Defines sound effects and their settings
 */
export default {
    // Sound effects
    sfx: {
        // UI sounds
        blip: {
            path: 'assets/soundfx/blip.mp3',
            volume: 0.3,
            pool: 4  // Allows multiple instances to play simultaneously
        },
        select: {
            path: 'assets/soundfx/select.mp3',
            volume: 0.5,
            pool: 2
        },
        
        // Gameplay sounds
        shoot: {
            path: 'assets/soundfx/shoot.mp3',
            volume: 0.4,
            pool: 8
        },
        explosion: {
            path: 'assets/soundfx/explosion.mp3',
            volume: 0.6,
            pool: 4
        },
        powerup: {
            path: 'assets/soundfx/powerup.mp3',
            volume: 0.5,
            pool: 2
        },
        
        // Special sound effects
        energyWeapon: {
            path: 'assets/soundfx/EnergyWeaponUsed.mp3',
            volume: 0.7,
            pool: 1
        },
        gameOver: {
            path: 'assets/soundfx/gameOver.mp3',
            volume: 0.8,
            pool: 1
        },
        highScore: {
            path: 'assets/soundfx/highScore.mp3',
            volume: 0.8,
            pool: 1
        }
    },
    
    // Sound effect groups
    groups: {
        ui: ['blip', 'select'],
        weapons: ['shoot', 'energyWeapon'],
        events: ['explosion', 'powerup', 'gameOver', 'highScore']
    },
    
    // Global settings
    settings: {
        sfxEnabled: true,
        sfxVolume: 0.7,
        defaultPool: 2
    }
};
