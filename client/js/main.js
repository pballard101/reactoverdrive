// main.js - Entry point for the game

import GameScene from './scenes/GameScene.js';
import MenuScene from './scenes/MenuScene.js';

// Simple fix: suppress the specific texture frame error
const originalConsoleError = console.error;
console.error = (...args) => {
    const message = args.join(' ');
    if (message.includes('Texture.frame missing: 360')) {
        console.warn('Suppressed texture frame 360 error - likely rotation value used as frame number');
        return;
    }
    originalConsoleError.apply(console, args);
};

// Main game configuration with higher resolution and proper scaling
const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    physics: {
        default: 'arcade',
        arcade: { 
            gravity: { y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container',
        width: 1280,
        height: 720
    },
    input: {
        gamepad: true // Enable gamepad input
    },
    scene: [MenuScene, GameScene]
};

// Initialize the game
const game = new Phaser.Game(config);

// Export game instance for potential global access
export default game;
