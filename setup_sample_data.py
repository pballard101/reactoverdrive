#!/usr/bin/env python3
"""
Setup sample data for MusicGame by copying MP3 files from musicsynth directory
"""
import os
import shutil
import sys
import glob

def setup_sample_data():
    """Copy sample MP3 and JSON files to the data directory"""
    print("🎵 Setting up sample music data for MusicGame...")
    
    # Get the directory paths
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(current_dir, 'data', 'uploads')
    repo_dir = os.path.dirname(current_dir)
    musicsynth_dir = os.path.join(repo_dir, 'musicsynth')
    
    # Create data directory if it doesn't exist
    os.makedirs(data_dir, exist_ok=True)
    
    # Check if musicsynth directory exists
    if not os.path.exists(musicsynth_dir):
        print(f"❌ Could not find musicsynth directory at {musicsynth_dir}")
        print("Please specify the path to the musicsynth directory:")
        musicsynth_dir = input("> ")
        if not os.path.exists(musicsynth_dir):
            print(f"❌ Directory {musicsynth_dir} not found.")
            return False
    
    # Find all MP3 files in musicsynth directory
    mp3_files = glob.glob(os.path.join(musicsynth_dir, "*.mp3"))
    if not mp3_files:
        print(f"❌ No MP3 files found in {musicsynth_dir}")
        return False
    
    # Copy MP3 files to data directory
    print(f"Found {len(mp3_files)} MP3 files to copy.")
    for file_path in mp3_files:
        filename = os.path.basename(file_path)
        dest_path = os.path.join(data_dir, filename)
        
        print(f"Copying {filename}...")
        shutil.copy2(file_path, dest_path)
        
        # Also copy corresponding JSON file if it exists
        json_path = os.path.splitext(file_path)[0] + '.json'
        if os.path.exists(json_path):
            json_filename = os.path.basename(json_path)
            json_dest = os.path.join(data_dir, json_filename)
            print(f"Copying {json_filename}...")
            shutil.copy2(json_path, json_dest)
    
    print("✅ Sample data setup complete!")
    print(f"Copied {len(mp3_files)} MP3 files to {data_dir}")
    print("\nYou can now start the server with: python start.py")
    return True

if __name__ == "__main__":
    setup_sample_data()
