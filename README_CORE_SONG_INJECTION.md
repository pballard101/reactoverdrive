# ReactOverdrive Core Song Injection CLI

This CLI tool allows you to inject "core" songs into ReactOverdrive with the artist automatically set to "ReactOverdrive". The script runs the full analysis pipeline that uploaded songs go through.

## Features

- **Full Analysis Pipeline**: Runs music analysis to extract beats, tempo, segments, notes, and energy profiles
- **Proper Directory Structure**: Creates songs in `client/assets/music/band/ReactOverdrive/Song_Title/`
- **Complete Metadata**: Generates proper `*_info.json`, `*_analysis.json`, and `*_scores.json` files
- **Debug Logging**: Creates detailed debug logs for troubleshooting
- **Batch Processing**: Process multiple songs at once
- **Update Existing**: Convert existing songs to ReactOverdrive artist

## Usage

### 1. Inject a New Core Song

```bash
python inject_core_song.py --mp3 "path/to/your_song.mp3" --title "Song Title"
```

**Example:**
```bash
python inject_core_song.py --mp3 "/Users/patrick/Music/Epic_Beat.mp3" --title "Epic Beat"
```

This will:
- Create `client/assets/music/band/ReactOverdrive/Epic_Beat/`
- Copy the MP3 file as `Epic Beat.mp3`
- Run music analysis to create `Epic Beat_analysis.json`
- Create metadata file `Epic Beat_info.json` with artist "ReactOverdrive"
- Initialize `Epic Beat_scores.json` with default high score
- Generate `Epic Beat_debug.log` for troubleshooting

### 2. Update Existing Song

```bash
python inject_core_song.py --update-existing --song-path "client/assets/music/band/Unknown_Artist/Song_Name"
```

**Example:**
```bash
python inject_core_song.py --update-existing --song-path "client/assets/music/band/Unknown_Artist/Blood_Ocean"
```

This will:
- Update the artist to "ReactOverdrive" in the metadata
- Move all files to the proper ReactOverdrive directory structure
- Preserve existing analysis data

### 3. Batch Process Multiple Songs

```bash
python inject_core_song.py --batch --source-dir "path/to/mp3/folder"
```

**Example:**
```bash
python inject_core_song.py --batch --source-dir "/Users/patrick/ReactOverdrive_Songs"
```

This will:
- Find all MP3 files in the source directory
- Process each one using the filename (without extension) as the title
- Create proper core song structure for each

## Quick Blood Ocean Update

The included helper script updates Blood Ocean specifically:

```bash
python update_blood_ocean.py
```

## File Structure Created

For each core song, the following structure is created:

```
client/assets/music/band/ReactOverdrive/Song_Title/
├── Song Title.mp3              # The audio file
├── Song Title_info.json        # Metadata with artist "ReactOverdrive"
├── Song Title_analysis.json    # Music analysis data (beats, tempo, etc.)
├── Song Title_scores.json      # High scores initialization
└── Song Title_debug.log        # Debug log of injection process
```

## Requirements

- Python 3.6+
- Access to the ReactOverdrive server analysis scripts
- MP3 files to inject

### Optional Dependencies (for better analysis)

```bash
pip install librosa numpy soundfile scipy
```

If these are not installed, the script will generate simulated analysis data.

## Examples

### Example 1: Add a New Core Song
```bash
# Copy your MP3 to a convenient location
cp ~/Downloads/awesome_track.mp3 ./temp_song.mp3

# Inject it as a core song
python inject_core_song.py --mp3 "./temp_song.mp3" --title "Awesome Track"

# Clean up
rm ./temp_song.mp3
```

### Example 2: Convert Multiple Songs
```bash
# Prepare a folder with your MP3s
mkdir core_songs_to_add
cp ~/Music/reactoverdrive_songs/*.mp3 core_songs_to_add/

# Batch process them all
python inject_core_song.py --batch --source-dir "core_songs_to_add"

# Clean up
rm -rf core_songs_to_add
```

### Example 3: Update an Existing Song
```bash
# If you have a song with wrong artist, update it
python inject_core_song.py --update-existing --song-path "client/assets/music/band/Some_Artist/Cool_Song"
```

## Troubleshooting

### Common Issues

1. **"Music analysis script not found"**
   - Make sure you're running from the ReactOverdrive root directory
   - Verify `server/analyze_music.py` exists

2. **"Source MP3 file not found"**
   - Check the file path is correct
   - Use absolute paths if relative paths don't work

3. **Permission errors**
   - Make sure you have write permissions to the ReactOverdrive directory
   - Try running with appropriate permissions

### Debug Information

Each injection creates a debug log file that contains:
- Timestamp of each operation
- File paths used
- Success/failure status of each step
- Error messages if something goes wrong

Check the `*_debug.log` file in the song directory for detailed information.

## Notes

- The script automatically sets the artist to "ReactOverdrive" for all core songs
- Existing analysis files are preserved when updating songs
- The script handles filename sanitization (spaces become underscores, special characters removed)
- Default high score is set to 500 points with initials "ROD"
- Original files are preserved when updating existing songs (you can manually delete them later)

## Success Example

When successful, you'll see output like:
```
[2025-06-13 15:33:04] [INFO] Starting core song injection for: Epic Beat
[2025-06-13 15:33:04] [INFO] Created song directory: /path/to/reactoverdrive/client/assets/music/band/ReactOverdrive/Epic_Beat
[2025-06-13 15:33:04] [INFO] Copied MP3 file: /path/to/target.mp3
[2025-06-13 15:33:04] [INFO] Created metadata file: /path/to/metadata.json
[2025-06-13 15:33:05] [SUCCESS] Music analysis completed: /path/to/analysis.json
[2025-06-13 15:33:05] [INFO] Created high scores file: /path/to/scores.json
[2025-06-13 15:33:05] [SUCCESS] Successfully injected core song 'Epic Beat' in 1.23 seconds

✅ Operation completed successfully!
