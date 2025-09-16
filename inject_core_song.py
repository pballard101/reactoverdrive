#!/usr/bin/env python3
"""
ReactOverdrive Core Song Injection Script

This script processes MP3 files and injects them as "core" songs into ReactOverdrive 
with the artist set to "ReactOverdrive". It runs the full analysis pipeline that 
uploaded songs go through.

Usage:
    # Inject new core song
    python inject_core_song.py --mp3 "path/to/song.mp3" --title "Song Name"
    
    # Update existing song to ReactOverdrive artist
    python inject_core_song.py --update-existing --song-path "client/assets/music/band/Unknown_Artist/Blood_Ocean"
    
    # Batch process multiple songs
    python inject_core_song.py --batch --source-dir "path/to/songs/"
"""

import os
import sys
import json
import argparse
import shutil
import subprocess
import datetime
import time
import traceback
from pathlib import Path

# Add the server directory to Python path so we can import the analysis modules
SERVER_DIR = Path(__file__).parent / "server"
sys.path.insert(0, str(SERVER_DIR))

# Configuration
CORE_MUSIC_BASE = "client/assets/music/band"
CORE_ARTIST = "ReactOverdrive"
DEFAULT_SCORE = 500
DEFAULT_INITIALS = "ROD"

class CoreSongInjector:
    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.core_music_dir = self.base_dir / CORE_MUSIC_BASE
        self.server_dir = self.base_dir / "server"
        
        # Ensure core music directory exists
        self.core_music_dir.mkdir(parents=True, exist_ok=True)
        
        # Check if analysis scripts exist
        self.analyze_music_script = self.server_dir / "analyze_music.py"
        if not self.analyze_music_script.exists():
            print(f"⚠️ Warning: Music analysis script not found at {self.analyze_music_script}")
    
    def log(self, message, level="INFO"):
        """Simple logging function."""
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
    
    def error(self, message):
        """Log error message."""
        self.log(message, "ERROR")
    
    def success(self, message):
        """Log success message."""
        self.log(message, "SUCCESS")
    
    def warning(self, message):
        """Log warning message."""
        self.log(message, "WARNING")
    
    def sanitize_filename(self, name):
        """Sanitize a string to be safe for use as a filename/directory name."""
        # Replace spaces with underscores and remove special characters
        sanitized = name.replace(" ", "_")
        # Remove or replace problematic characters
        problematic_chars = '<>:"/\\|?*'
        for char in problematic_chars:
            sanitized = sanitized.replace(char, "")
        return sanitized
    
    def create_song_directory(self, title):
        """Create the directory structure for a core song."""
        sanitized_title = self.sanitize_filename(title)
        song_dir = self.core_music_dir / CORE_ARTIST / sanitized_title
        song_dir.mkdir(parents=True, exist_ok=True)
        return song_dir
    
    def copy_mp3_file(self, source_mp3, target_dir, title):
        """Copy MP3 file to target directory with proper naming."""
        source_path = Path(source_mp3)
        if not source_path.exists():
            raise FileNotFoundError(f"Source MP3 file not found: {source_mp3}")
        
        # Use the title as the filename
        target_filename = f"{title}.mp3"
        target_path = target_dir / target_filename
        
        self.log(f"Copying {source_path} to {target_path}")
        shutil.copy2(source_path, target_path)
        
        return target_path
    
    def create_metadata_file(self, song_dir, title, filename):
        """Create the *_info.json metadata file."""
        base_name = Path(filename).stem
        metadata_file = song_dir / f"{base_name}_info.json"
        
        metadata = {
            "title": title,
            "artist": CORE_ARTIST,
            "filename": filename
        }
        
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        self.log(f"Created metadata file: {metadata_file}")
        return metadata_file
    
    def run_music_analysis(self, mp3_file, song_dir):
        """Run the music analysis script on the MP3 file."""
        base_name = Path(mp3_file).stem
        analysis_file = song_dir / f"{base_name}_analysis.json"
        
        if not self.analyze_music_script.exists():
            self.warning("Music analysis script not found, skipping analysis")
            return None
        
        self.log(f"Running music analysis on {mp3_file}")
        
        try:
            # Run the analysis script
            cmd = ["python", str(self.analyze_music_script), str(mp3_file), str(analysis_file)]
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=self.server_dir)
            
            if result.returncode == 0:
                self.success(f"Music analysis completed: {analysis_file}")
                return analysis_file
            else:
                self.error(f"Music analysis failed: {result.stderr}")
                return None
        except Exception as e:
            self.error(f"Error running music analysis: {e}")
            return None
    
    def create_high_scores_file(self, song_dir, title):
        """Create the initial high scores file."""
        base_name = self.sanitize_filename(title)
        scores_file = song_dir / f"{base_name}_scores.json"
        
        scores_data = {
            "scores": [
                {
                    "initials": DEFAULT_INITIALS,
                    "score": DEFAULT_SCORE,
                    "date": datetime.datetime.now().strftime("%Y-%m-%d")
                }
            ]
        }
        
        with open(scores_file, 'w', encoding='utf-8') as f:
            json.dump(scores_data, f, indent=2)
        
        self.log(f"Created high scores file: {scores_file}")
        return scores_file
    
    def create_debug_log(self, song_dir, title, operations):
        """Create a debug log file documenting the injection process."""
        base_name = self.sanitize_filename(title)
        debug_file = song_dir / f"{base_name}_debug.log"
        
        with open(debug_file, 'w', encoding='utf-8') as f:
            f.write("=== CORE SONG INJECTION DEBUG LOG ===\n")
            f.write(f"Date: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Song Title: {title}\n")
            f.write(f"Artist: {CORE_ARTIST}\n")
            f.write(f"Target Directory: {song_dir}\n")
            f.write("="*50 + "\n\n")
            
            for operation in operations:
                f.write(f"[{operation['timestamp']}] {operation['message']}\n")
        
        self.log(f"Created debug log: {debug_file}")
        return debug_file
    
    def inject_song(self, mp3_path, title):
        """Main function to inject a single song."""
        operations = []
        start_time = time.time()
        
        def log_operation(message):
            timestamp = datetime.datetime.now().strftime("%H:%M:%S")
            operations.append({"timestamp": timestamp, "message": message})
            self.log(message)
        
        try:
            log_operation(f"Starting core song injection for: {title}")
            
            # Create song directory
            song_dir = self.create_song_directory(title)
            log_operation(f"Created song directory: {song_dir}")
            
            # Copy MP3 file
            mp3_filename = f"{title}.mp3"
            target_mp3 = self.copy_mp3_file(mp3_path, song_dir, title)
            log_operation(f"Copied MP3 file: {target_mp3}")
            
            # Create metadata file
            metadata_file = self.create_metadata_file(song_dir, title, mp3_filename)
            log_operation(f"Created metadata file: {metadata_file}")
            
            # Run music analysis
            analysis_file = self.run_music_analysis(target_mp3, song_dir)
            if analysis_file:
                log_operation(f"Completed music analysis: {analysis_file}")
            else:
                log_operation("Music analysis was skipped or failed")
            
            # Create high scores file
            scores_file = self.create_high_scores_file(song_dir, title)
            log_operation(f"Created high scores file: {scores_file}")
            
            # Create debug log
            debug_file = self.create_debug_log(song_dir, title, operations)
            
            execution_time = time.time() - start_time
            self.success(f"Successfully injected core song '{title}' in {execution_time:.2f} seconds")
            self.success(f"Song location: {song_dir}")
            
            return True
            
        except Exception as e:
            self.error(f"Failed to inject song '{title}': {e}")
            self.error(traceback.format_exc())
            return False
    
    def update_existing_song(self, song_path):
        """Update an existing song to change artist to ReactOverdrive."""
        song_path = Path(song_path)
        
        if not song_path.exists():
            self.error(f"Song path does not exist: {song_path}")
            return False
        
        self.log(f"Updating existing song at: {song_path}")
        
        # Find the info.json file
        info_files = list(song_path.glob("*_info.json"))
        if not info_files:
            self.error(f"No info.json file found in {song_path}")
            return False
        
        info_file = info_files[0]
        
        try:
            # Read current metadata
            with open(info_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            old_artist = metadata.get("artist", "Unknown")
            title = metadata.get("title", "Unknown Title")
            
            self.log(f"Updating artist from '{old_artist}' to '{CORE_ARTIST}' for song '{title}'")
            
            # Update artist
            metadata["artist"] = CORE_ARTIST
            
            # Write back to file
            with open(info_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2)
            
            # Move to ReactOverdrive directory if needed
            current_artist_dir = song_path.parent.name
            if current_artist_dir != CORE_ARTIST:
                new_song_dir = self.create_song_directory(title)
                
                # Copy all files to new location
                for file in song_path.iterdir():
                    if file.is_file():
                        shutil.copy2(file, new_song_dir / file.name)
                        self.log(f"Copied {file.name} to new location")
                
                self.success(f"Moved song from {song_path} to {new_song_dir}")
                self.warning(f"Original files still exist at {song_path} - you may want to remove them manually")
            
            self.success(f"Successfully updated song '{title}' to artist '{CORE_ARTIST}'")
            return True
            
        except Exception as e:
            self.error(f"Failed to update song: {e}")
            self.error(traceback.format_exc())
            return False
    
    def batch_process(self, source_dir):
        """Process multiple MP3 files from a source directory."""
        source_path = Path(source_dir)
        
        if not source_path.exists():
            self.error(f"Source directory does not exist: {source_dir}")
            return False
        
        # Find all MP3 files
        mp3_files = list(source_path.glob("*.mp3"))
        if not mp3_files:
            self.warning(f"No MP3 files found in {source_dir}")
            return False
        
        self.log(f"Found {len(mp3_files)} MP3 files to process")
        
        successful = 0
        failed = 0
        
        for mp3_file in mp3_files:
            # Use the filename (without extension) as the title
            title = mp3_file.stem.replace("_", " ")
            
            self.log(f"Processing: {mp3_file.name} -> '{title}'")
            
            if self.inject_song(mp3_file, title):
                successful += 1
            else:
                failed += 1
        
        self.log(f"Batch processing complete: {successful} successful, {failed} failed")
        return failed == 0


def main():
    parser = argparse.ArgumentParser(description="Inject core songs into ReactOverdrive")
    
    # Main operation modes
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--mp3", help="Path to MP3 file to inject")
    group.add_argument("--update-existing", action="store_true", help="Update existing song to ReactOverdrive artist")
    group.add_argument("--batch", action="store_true", help="Batch process MP3 files")
    
    # Additional arguments
    parser.add_argument("--title", help="Song title (required with --mp3)")
    parser.add_argument("--song-path", help="Path to existing song directory (required with --update-existing)")
    parser.add_argument("--source-dir", help="Source directory for batch processing (required with --batch)")
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.mp3 and not args.title:
        parser.error("--title is required when using --mp3")
    
    if args.update_existing and not args.song_path:
        parser.error("--song-path is required when using --update-existing")
    
    if args.batch and not args.source_dir:
        parser.error("--source-dir is required when using --batch")
    
    # Create injector and run
    injector = CoreSongInjector()
    
    try:
        if args.mp3:
            success = injector.inject_song(args.mp3, args.title)
        elif args.update_existing:
            success = injector.update_existing_song(args.song_path)
        elif args.batch:
            success = injector.batch_process(args.source_dir)
        
        if success:
            print("\n✅ Operation completed successfully!")
            sys.exit(0)
        else:
            print("\n❌ Operation failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
