#!/usr/bin/env python3
"""
Runs full processing: song identification, lyrics, and music analysis.
Creates detailed debug logs for each processed song.
"""
import subprocess
import argparse
import json
import time
import datetime
import os
import sys
import traceback
from pathlib import Path
import shutil

# Configuration for default high scores
DEFAULT_INITIALS = "BTF"
DEFAULT_SCORE = 100

def create_debug_logger(log_file_path):
    """Creates a debug logger that writes to both console and a file."""
    
    class DebugLogger:
        def __init__(self, log_file_path):
            self.log_file = open(log_file_path, "w", encoding="utf-8")
            self.start_time = time.time()
            
            # Write header
            self.log(f"=== DEBUG LOG ===")
            self.log(f"Date: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            self.log(f"Python version: {sys.version}")
            self.log(f"OS: {os.name} - {sys.platform}")
            self.log("="*50)
            
        def log(self, message, level="INFO"):
            """Log a message with timestamp to both console and file."""
            timestamp = time.time() - self.start_time
            formatted_msg = f"[{timestamp:.3f}s] [{level}] {message}"
            
            # Print to console
            print(formatted_msg)
            
            # Write to log file
            self.log_file.write(formatted_msg + "\n")
            self.log_file.flush()  # Ensure it's written immediately
            
        def error(self, message):
            """Log an error message."""
            self.log(message, "ERROR")
            
        def warning(self, message):
            """Log a warning message."""
            self.log(message, "WARNING")
            
        def success(self, message):
            """Log a success message."""
            self.log(message, "SUCCESS")
            
        def debug(self, message):
            """Log a debug message."""
            self.log(message, "DEBUG")
            
        def system_info(self, title, data):
            """Log structured system information."""
            self.log(f"--- {title} ---")
            if isinstance(data, dict):
                for key, value in data.items():
                    self.log(f"  {key}: {value}")
            else:
                self.log(f"  {data}")
            
        def close(self):
            """Close the log file."""
            self.log("=== END DEBUG LOG ===")
            self.log_file.close()
    
    return DebugLogger(log_file_path)

def run_script(script, *args, logger=None):
    """Helper function to run a script with arguments and log outputs."""
    # Use absolute path to the script in the same directory
    script_path = Path(__file__).parent / script
    command = ["python", str(script_path)] + list(args)
    
    if logger:
        logger.log(f"Running: {' '.join(command)}")
    else:
        print(f"\n🚀 Running: {' '.join(command)}")
    
    start_time = time.time()
    result = subprocess.run(command, capture_output=True, text=True)
    execution_time = time.time() - start_time
    
    if logger:
        logger.log(f"Script execution time: {execution_time:.2f} seconds")
        logger.log(f"Return code: {result.returncode}")
        
        if result.stdout:
            logger.log(f"--- Output from {script} ---")
            for line in result.stdout.splitlines():
                logger.log(f"  > {line}")
        
        if result.stderr:
            logger.error(f"Errors from {script}:")
            for line in result.stderr.splitlines():
                logger.error(f"  > {line}")
    else:
        print(f"--- Output from {script} ---")
        print(result.stdout)
        if result.stderr:
            print(f"⚠️ Error in {script}: {result.stderr}")
    
    return result.returncode == 0  # Return True if successful

def log_file_info(file_path, logger):
    """Log detailed information about a file."""
    if not file_path.exists():
        logger.warning(f"File does not exist: {file_path}")
        return
    
    file_info = {
        "Path": str(file_path),
        "Size": f"{file_path.stat().st_size / 1024:.2f} KB",
        "Modified": datetime.datetime.fromtimestamp(file_path.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
        "Exists": file_path.exists()
    }
    
    logger.system_info(f"File Info: {file_path.name}", file_info)
    
    # If it's a JSON file, log its content structure
    if file_path.suffix.lower() == '.json' and file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Log a summary of the JSON structure
            if isinstance(data, dict):
                top_level_keys = list(data.keys())
                logger.debug(f"JSON contains keys: {top_level_keys}")
                
                # If metadata is present, log key information
                if "artist" in data:
                    logger.log(f"Artist: {data['artist']}")
                if "title" in data:
                    logger.log(f"Title: {data['title']}")
                
                # Log nested structure summary
                for key in top_level_keys:
                    if isinstance(data[key], dict):
                        logger.debug(f"  '{key}' contains keys: {list(data[key].keys())}")
                    elif isinstance(data[key], list):
                        logger.debug(f"  '{key}' is a list with {len(data[key])} items")
        except Exception as e:
            logger.error(f"Error reading JSON file: {e}")

def main():
    parser = argparse.ArgumentParser(description="Run full song processing with detailed debug logging.")
    parser.add_argument("input_file", help="Audio file to process")
    args = parser.parse_args()

    song_path = Path(args.input_file)
    base_dir = song_path.parent
    output_file = base_dir / f"{song_path.stem}_analysis.json"
    metadata_file = base_dir / f"{song_path.stem}_info.json"
    debug_log_file = base_dir / f"{song_path.stem}_debug.log"
    
    # Create debug logger
    logger = create_debug_logger(debug_log_file)
    
    try:
        # Log basic information
        logger.log(f"Starting full processing for: {song_path.name}")
        logger.system_info("Processing Files", {
            "Input File": str(song_path),
            "Output Analysis": str(output_file),
            "Metadata File": str(metadata_file),
            "Debug Log": str(debug_log_file)
        })
        
        # Log input file info
        log_file_info(song_path, logger)
        
        # Step 1: Run Music Analysis
        logger.log("\n=== STEP 1: Music Analysis ===")
        analysis_success = run_script("analyze_music.py", str(song_path), str(output_file), logger=logger)
        
        if analysis_success:
            logger.success(f"Music analysis complete: {output_file}")
            log_file_info(output_file, logger)
        else:
            logger.error("Music analysis failed. Skipping lyrics and file organization.")
            logger.close()
            exit(1)  # Stop further processing
        
        # Step 2: Run Lyrics Fetching
        logger.log("\n=== STEP 2: Lyrics Fetching ===")
        if run_script("analyze_lyrics.py", str(song_path), logger=logger):
            logger.success("Lyrics fetching complete")
            # Check if LRC file was created
            lrc_file = base_dir / f"{song_path.stem}.lrc"
            log_file_info(lrc_file, logger)
        else:
            logger.warning("Lyrics fetching failed, continuing with file organization.")
        
        # Check if metadata file was created by analyze_lyrics
        log_file_info(metadata_file, logger)
        
        # Step 3: Organize Files (Only if metadata exists and is valid)
        logger.log("\n=== STEP 3: File Organization ===")
        if metadata_file.exists():
            try:
                with open(metadata_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                
                logger.system_info("Metadata Contents", metadata)
                
                if metadata.get("title") and metadata.get("artist"):
                    logger.log(f"Valid metadata found: {metadata.get('artist')} - {metadata.get('title')}")
                    run_script("organize_files.py", str(metadata_file), str(base_dir), logger=logger)
                    logger.success("File organization complete.")
                else:
                    logger.warning(f"Metadata file exists but is incomplete. Skipping organization.")
                    logger.log(f"Missing fields: {'title' if not metadata.get('title') else ''} {'artist' if not metadata.get('artist') else ''}")
            except json.JSONDecodeError:
                logger.error("Metadata file is invalid JSON. Skipping organization.")
            except Exception as e:
                logger.error(f"Unexpected error processing metadata: {str(e)}")
                logger.error(traceback.format_exc())
        else:
            logger.warning("Skipping file organization (metadata file not found).")
        
        # Create a copy of all files for debugging purposes
        try:
            debug_dir = base_dir / "debug_files"
            debug_dir.mkdir(exist_ok=True)
            
            # Copy relevant files to debug directory
            for file_path in [song_path, output_file, metadata_file]:
                if file_path.exists():
                    debug_file = debug_dir / file_path.name
                    shutil.copy2(file_path, debug_file)
                    logger.log(f"Copied {file_path.name} to debug directory")
            
            # Also copy the debug log itself
            shutil.copy2(debug_log_file, debug_dir / debug_log_file.name)
        except Exception as e:
            logger.error(f"Error creating debug file copies: {e}")
        
        # Step 4: Initialize high scores file
        logger.log("\n=== STEP 4: High Score Initialization ===")
        high_score_file = base_dir / f"{song_path.stem}_scores.json"
        
        if high_score_file.exists():
            logger.log(f"High score file already exists: {high_score_file}")
        else:
            try:
                # Create default scores data with proper JSON formatting
                scores_data = {
                    "scores": [
                        {
                            "initials": DEFAULT_INITIALS,
                            "score": DEFAULT_SCORE,
                            "date": datetime.datetime.now().strftime("%Y-%m-%d")
                        }
                    ]
                }
                
                # Validate JSON structure by converting to string and back
                # This helps catch any formatting errors
                json_str = json.dumps(scores_data, indent=2)
                scores_data = json.loads(json_str)
                
                # Save scores file
                with open(high_score_file, 'w', encoding='utf-8') as f:
                    json.dump(scores_data, f, indent=2)
                logger.success(f"Created high score file: {high_score_file}")
                
                # Copy to debug directory if it exists
                debug_dir = base_dir / "debug_files"
                if debug_dir.exists():
                    shutil.copy2(high_score_file, debug_dir / high_score_file.name)
                    logger.log(f"Copied high score file to debug directory")
            except Exception as e:
                logger.error(f"Error creating high score file: {str(e)}")
        
        logger.success("\nFull processing complete!")
    except Exception as e:
        logger.error(f"Unhandled exception during processing: {str(e)}")
        logger.error(traceback.format_exc())
    finally:
        # Close the logger to ensure all data is written
        logger.close()

if __name__ == "__main__":
    main()
