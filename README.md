# 🎵 ReactOverdrive

> An old-school shoot-em-up that grooves to your music! Upload your favorite tracks, challenge your friends, and battle for the highest score in this retro-styled, music-reactive space shooter.

## ✨ Features

- **🎵 Music-Reactive Gameplay** - Enemies spawn and move to the beat of your music
- **📁 Upload Your Own Tracks** - Drop in any MP3 file and watch the game adapt
- **🏆 Persistent High Scores** - Challenge friends and compete for the top spot
- **🎮 Retro Arcade Aesthetics** - Classic shoot-em-up vibes with modern flair
- **🎯 Real-Time Audio Analysis** - Advanced beat detection and frequency analysis
- **🐳 Docker Ready** - One-command deployment with persistent data
- **🎊 Particle Effects** - Visual effects that dance to your music
- **⚡ Special Attacks** - Energy-based power-ups for epic moments

## 🚀 Quick Start (Docker)

### Prerequisites
- Docker and Docker Compose installed

### Launch the Game
```bash
# Clone the repository
git clone <your-repo-url>
cd reactoverdrive

# Start the game with Docker Compose
docker-compose up -d

# Open your browser
open http://localhost:5001
```

### Managing Game Data
```bash
# View persistent volumes
docker volume ls | grep reactoverdrive

# Backup high scores
docker run --rm -v reactoverdrive_highscores:/data -v $(pwd):/backup alpine tar czf /backup/highscores-backup.tar.gz -C /data .

# Reset all user data (keeps core music)
docker-compose down
docker volume rm reactoverdrive_usermusic_uploads reactoverdrive_usermusic_processed reactoverdrive_highscores
docker-compose up -d
```

## 🛠️ Manual Setup

### Prerequisites
- Python 3.6+ 
- Modern web browser with JavaScript enabled
- FFmpeg (optional, for better format support)

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd reactoverdrive

# Install Python dependencies
pip install -r requirements.txt

# Start the game server
python start.py

# Open your browser
open http://localhost:5000
```

### Dependencies
- **librosa** - Advanced audio analysis and beat detection
- **flask** - Web server and API endpoints
- **numpy** - Numerical processing for audio data
- **soundfile** - Audio file I/O operations

## 🎮 How to Play

### Controls
- **Arrow Keys / WASD** - Move your ship
- **Spacebar** - Fire bullets at enemies
- **E** - Activate special attack (when energy is full)
- **1** - Toggle central particle effects
- **Escape** - Return to menu

### Gameplay
1. **Select Your Track** - Choose from the dropdown or upload your own MP3
2. **Survive the Beat** - Enemies spawn based on the music's rhythm and intensity
3. **Collect Power-ups** - Grab energy orbs to charge your special attack
4. **Chase High Scores** - Beat your friends and climb the leaderboard
5. **Master the Groove** - Learn each song's patterns for maximum points

### Scoring System
- **Enemy Elimination** - Base points for each enemy destroyed
- **Beat Accuracy** - Bonus points for shooting on the beat
- **Combo Multipliers** - Chain eliminations for higher scores
- **Special Attack Bonus** - Extra points for strategic power-up usage

## 🎵 Core Music

ReactOverdrive ships with **"Blood Ocean"** - a driving track perfect for getting started. This core music is embedded in the game and provides an excellent introduction to the gameplay mechanics.

### Adding Your Own Music
1. Click **"Upload New Song"** from the main menu
2. Select any MP3 file from your computer
3. Wait for processing (usually 10-20 seconds)
4. Your track appears in the song selection dropdown
5. Rock out to your favorite music!

**Supported Formats:** MP3 (primary), with FFmpeg installed: WAV, FLAC, OGG

## 📁 Project Structure

```
reactoverdrive/
├── client/                     # Frontend game files
│   ├── index.html             # Main game interface
│   ├── upload.html            # Music upload interface
│   ├── js/                    # Game logic and systems
│   │   ├── main.js            # Entry point and game loop
│   │   ├── entities/          # Game objects (Player, Enemies)
│   │   ├── scenes/            # Game scenes (Menu, Game)
│   │   ├── systems/           # Core systems (Audio, Particles, etc.)
│   │   ├── ui/                # User interface components
│   │   └── utils/             # Utility functions
│   └── assets/                # Game assets
│       ├── images/            # Sprites and textures
│       ├── music/band/        # Core music library
│       └── soundfx/           # Sound effects
├── server/                    # Backend Python server
│   ├── api_server.py          # Flask API and web server
│   ├── analyze_music.py       # Audio analysis engine
│   ├── process_upload.py      # Music processing pipeline
│   └── organize_files.py      # File management utilities
├── data/                      # Game data (Docker volumes)
│   ├── uploads/               # User uploaded music files
│   ├── processed/             # Analyzed song data
│   └── highscores/            # Persistent high score data
├── docker-compose.yml         # Docker deployment configuration
├── Dockerfile                 # Container build instructions
├── requirements.txt           # Python dependencies
└── start.py                   # Development server launcher
```

## 🐳 Docker Volumes

ReactOverdrive uses named Docker volumes to persist your game data:

- **`reactoverdrive_usermusic_uploads`** - Your uploaded MP3 files
- **`reactoverdrive_usermusic_processed`** - Analyzed song data and metadata
- **`reactoverdrive_highscores`** - High score records and player data

Core music and game assets are embedded in the Docker image, so they don't require separate volumes.

## 🎯 Game Development

### Audio Analysis Pipeline
1. **Upload Processing** - MP3 files are converted and normalized
2. **Beat Detection** - Advanced onset detection using librosa
3. **Frequency Analysis** - Real-time FFT for visual effects
4. **Tempo Mapping** - BPM detection for enemy spawn timing
5. **Caching** - Processed data is stored for quick loading

### Adding New Features
The codebase is designed for extensibility:
- **New enemy types** - Extend the `EnemyManager` class
- **Visual effects** - Add to the `ParticleSystem`
- **Audio visualizers** - Expand the `EQVisualizer`
- **Game modes** - Create new scene classes

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (especially audio sync)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Test audio features with multiple music genres
- Ensure Docker compatibility
- Update documentation for new features

## 🎼 Audio Considerations

### Supported Music
- **Best Results:** Electronic, rock, pop music with clear beats
- **Good Results:** Most genres with consistent rhythm
- **Challenging:** Classical, ambient, heavily compressed audio

### Performance Tips
- Higher quality MP3s (320kbps) provide better analysis
- Consistent volume levels work best
- Songs with clear drum patterns excel in beat detection

## 🏆 High Score System

High scores are tracked per song and persist across sessions:
- **Individual Song Records** - Best score for each track
- **Global Leaderboard** - Top scores across all music
- **Friend Challenges** - Compare scores with other players
- **Achievement System** - Unlock rewards for milestones

## 📝 TODO

- Add instructions on how to play
- Add new enemies
- Sound effects default to off
- Remove some text when hanging from chorus to bridge

## 🐛 Known Bugs

- Player cannot hurt the worm - only the worm hunter can
- When finished with the song you have to reload the browser to play another game

## 🎪 Future Enhancements

Planned features and improvements:
- **Multiplayer Support** - Compete in real-time
- **Custom Visualizers** - User-created visual effects
- **Playlist Mode** - Sequential song gameplay
- **Remix Challenges** - Community-created content
- **Mobile Support** - Touch controls for mobile devices

## 🔧 Troubleshooting

### Common Issues
- **Audio not playing:** Check browser audio permissions
- **Upload fails:** Ensure MP3 format and reasonable file size
- **Lag during gameplay:** Try lower quality settings
- **Docker issues:** Verify Docker daemon is running

### Getting Help
- Check the Issues section for known problems
- Create a new issue with detailed description
- Include browser/system information for bugs

---

**Ready to groove?** Upload your favorite tracks and let ReactOverdrive transform your music into an epic space battle! 🚀🎵

---

*ReactOverdrive - Where every song becomes an adventure.*
