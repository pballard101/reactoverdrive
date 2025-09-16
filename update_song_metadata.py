#!/usr/bin/env python3
"""
Update metadata for all songs in the uploads directory.
This script tries to extract artist and title info from filenames
and creates _info.json files for better song identification.
"""

import os
import json
import sys
from pathlib import Path

def extract_metadata_from_filename(filename):
    """Extract artist and title from common filename patterns."""
    base_name = Path(filename).stem
    
    # Handle common patterns
    # Pattern 1: "Artist - Title"
    if " - " in base_name:
        parts = base_name.split(" - ", 1)
        if len(parts) == 2:
            artist = parts[0].strip()
            title = parts[1].strip()
            
            # Handle track numbers at the beginning of artist
            if artist[0:2].isdigit() and artist[2:3] in [" ", "-"]:
                artist = artist[3:].strip()
                
            return artist, title
    
    # Pattern 2: "Title"
    # For filenames without an obvious artist-title separator,
    # assume the whole filename is the title
    return "Unknown Artist", base_name

def update_metadata_file(mp3_path):
    """Create or update metadata file for an MP3 file."""
    base_name = mp3_path.stem
    metadata_path = mp3_path.parent / f"{base_name}_info.json"
    
    # If metadata file already exists, check if it has proper artist and title
    if metadata_path.exists():
        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                
            if existing_data.get('artist') != 'Unknown Artist' and existing_data.get('title'):
                print(f"✅ Metadata file {metadata_path.name} already has artist and title info")
                return
        except json.JSONDecodeError:
            print(f"🔄 Existing metadata file {metadata_path.name} has invalid JSON. Will recreate.")
    
    # Extract metadata from filename
    artist, title = extract_metadata_from_filename(mp3_path.name)
    
    # For special case handling - add known artists for specific songs
    if mp3_path.name == "Sober.mp3":
        artist = "Tool"  # Hard-code correct artist for Sober
    elif mp3_path.name == "05 Schism.mp3":
        artist = "Tool"
        title = "Schism"
    elif mp3_path.name == "bulletbfly.mp3":
        artist = "Linkin Park"
        title = "Bullet the Butterfly"
    elif mp3_path.name == "Blood Ocean.mp3":
        artist = "Dethklok"
    elif mp3_path.name == "Trip Like I Do.mp3":
        artist = "The Crystal Method"
        title = "Trip Like I Do"
    elif mp3_path.name == "1-01 Dani California.mp3":
        artist = "Red Hot Chili Peppers"
        title = "Dani California"
    elif mp3_path.name == "02 - Busy Child.mp3":
        artist = "The Crystal Method"
        title = "Busy Child"
    elif mp3_path.name == "06 - Karma Police.mp3":
        artist = "Radiohead"
        title = "Karma Police"
    
    # Create metadata object
    metadata = {
        "artist": artist,
        "title": title,
        "filename": mp3_path.name
    }
    
    # Save to file
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"✅ Created/updated metadata for: {artist} - {title}")

def process_directory(directory):
    """Process all MP3 files in a directory."""
    directory_path = Path(directory)
    if not directory_path.exists():
        print(f"❌ Directory {directory} does not exist!")
        return

    mp3_files = list(directory_path.glob("*.mp3"))
    print(f"Found {len(mp3_files)} MP3 files in {directory}")
    
    for mp3_file in mp3_files:
        update_metadata_file(mp3_file)

if __name__ == "__main__":
    # Default to data/uploads directory if no argument provided
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "uploads")
    
    if len(sys.argv) > 1:
        data_dir = sys.argv[1]
    
    print(f"🔍 Processing MP3 files in: {data_dir}")
    process_directory(data_dir)
    print("✅ Metadata update complete!")
