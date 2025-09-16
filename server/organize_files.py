#!/usr/bin/env python3
"""
Organize analyzed music files into the game assets directory and update the processed songs catalog.
"""
import os
import json
import shutil
import argparse
from pathlib import Path

# Get the base directory for reactoverdrive (parent of server directory)
BASE_DIR = Path(__file__).parent.parent

# Define paths using the reactoverdrive structure
UPLOADS_DIR = BASE_DIR / "data" / "uploads"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
CATALOG_FILE = PROCESSED_DIR / "processed_songs.json"

def ensure_directories():
    """Ensure all required directories exist."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Create catalog file with empty array if it doesn't exist
    if not CATALOG_FILE.exists():
        with open(CATALOG_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
        print(f"✅ Created empty catalog: {CATALOG_FILE}")

def update_song_catalog(song_info, dest_dir):
    """Update the processed_songs.json file with new song metadata."""
    # Ensure directories exist
    ensure_directories()
    
    catalog = []

    # Load existing catalog if available
    if CATALOG_FILE.exists():
        with open(CATALOG_FILE, "r", encoding="utf-8") as f:
            try:
                catalog = json.load(f)
            except json.JSONDecodeError:
                print("⚠️ Catalog file is corrupt. Resetting...")

    # Check if song is already in catalog
    for entry in catalog:
        if entry.get("filename") == song_info.get("filename"):
            print(f"🔄 {song_info.get('filename')} already in catalog. Updating entry.")
            # Remove the old entry so we can add the updated one
            catalog.remove(entry)
            break

    # Use relative paths for the game client
    relative_path = f"data/processed/{song_info.get('artist', 'Unknown_Artist').replace(' ', '_')}/{song_info.get('title', 'Unknown_Title').replace(' ', '_')}"

    # Add new song to catalog
    catalog_entry = {
        "title": song_info.get("title", "Unknown_Title"),
        "artist": song_info.get("artist", "Unknown_Artist"),
        "filename": song_info.get("filename"),
        "duration": song_info.get("duration", 0),  # Ensure duration is included
        "tempo": song_info.get("tempo", 0),  # Store BPM
        "mood": song_info.get("mood", "Unknown"),
        "file_path": f"{relative_path}/{song_info.get('filename')}",  # Relative path for client
        "analysis_path": f"{relative_path}/{song_info.get('filename', '').replace('.mp3', '_analysis.json')}",  # JSON path
    }
    catalog.append(catalog_entry)

    # Save updated catalog
    with open(CATALOG_FILE, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)

    print(f"✅ Updated catalog: {CATALOG_FILE}")

def organize_files(song_info, source_dir):
    """Move analyzed music files to processed directory and update catalog."""
    # Ensure all required directories exist
    ensure_directories()
    
    artist = song_info.get("artist", "Unknown_Artist").replace(" ", "_")
    title = song_info.get("title", "Unknown_Title").replace(" ", "_")
    filename = song_info.get("filename")

    if not filename:
        print("⚠️ No filename found in metadata! Skipping file move.")
        return

    # Define destination paths in the reactoverdrive structure
    artist_path = PROCESSED_DIR / artist
    dest_dir = artist_path / title  # Folder for song name

    # Create directories if they don't exist
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Get file stem (e.g., "bulletbfly" from "bulletbfly.mp3")
    song_stem = Path(filename).stem

    # Expected files to move
    file_list = [
        f"{song_stem}_info.json",
        f"{song_stem}.lrc",
        f"{song_stem}_analysis.json",
        f"{song_stem}_debug.log",  # Also copy debug log if available
        filename  # Move the actual audio file
    ]

    # Move files
    for file_name in file_list:
        source_file = Path(source_dir) / file_name
        dest_file = dest_dir / file_name
        
        if source_file.exists():
            # Use copy2 to preserve metadata
            shutil.copy2(str(source_file), str(dest_file))
            print(f"✅ Copied {source_file} → {dest_file}")
        else:
            if not (file_name.endswith('.lrc') or file_name.endswith('_debug.log')):
                # Only print warning for essential files
                print(f"⚠️ File not found: {source_file}")

    print(f"🎵 Organization complete: {dest_dir}")

    # Update song catalog with relative paths
    update_song_catalog(song_info, dest_dir)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Organize analyzed music files.")
    parser.add_argument("metadata_file", help="Path to song metadata JSON")
    parser.add_argument("source_dir", help="Directory where the files are stored")

    args = parser.parse_args()

    # Ensure directories exist first
    ensure_directories()

    try:
        # Load metadata
        with open(args.metadata_file, "r", encoding="utf-8") as f:
            song_info = json.load(f)

        organize_files(song_info, args.source_dir)
    except Exception as e:
        print(f"❌ Error organizing files: {e}")
        raise  # Re-raise the exception to see the full traceback
