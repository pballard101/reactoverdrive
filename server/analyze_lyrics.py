#!/usr/bin/env python3
"""
Music Analysis Script with Song Identification & Synced Lyrics

This script analyzes an audio file, identifies the song using AcoustID,
fetches synced lyrics from LRC Lib, and saves them as an LRC file.

Requirements:
    pip install librosa numpy soundfile requests pyacoustid musicbrainzngs
"""

import json
import os
import sys
import requests
import argparse
from pathlib import Path

# Flag to track if dependencies are installed
DEPENDENCIES_INSTALLED = True

# Try to import acoustid
try:
    import acoustid
    # API Keys
    # Get AcoustID API key from environment variable
    # To use: export ACOUSTID_API_KEY="your_key_here"
    ACOUSTID_API_KEY = os.environ.get("ACOUSTID_API_KEY")
    if not ACOUSTID_API_KEY:
        print("⚠️ Warning: ACOUSTID_API_KEY environment variable not set.")
        print("Song identification will be disabled.")
        ACOUSTID_API_KEY = None
    LRC_LIB_API_URL = "https://lrclib.net/api/get"  # LRC Lib API endpoint
except ImportError:
    DEPENDENCIES_INSTALLED = False
    print("⚠️ Warning: AcoustID not installed. Using simple metadata extraction.")
    print("To install: pip install pyacoustid")

def fetch_synced_lyrics(artist, title):
    """Fetch synced lyrics from LRC Lib API."""
    try:
        # Make request to LRC Lib API
        response = requests.get(
            LRC_LIB_API_URL,
            params={"artist": artist, "song": title},
            timeout=10
        )
        
        # Check if request was successful
        if response.status_code == 200:
            data = response.json()
            
            # Check if lyrics were found
            if data and "syncedLyrics" in data and data["syncedLyrics"]:
                return data["syncedLyrics"]
                
        print(f"No synced lyrics found for {title} by {artist}")
        return None
        
    except Exception as e:
        print(f"Error fetching lyrics: {e}")
        return None

def identify_song(file_path):
    """Identify song using AcoustID and return metadata, or fallback to defaults if no match."""
    print("🔍 Identifying song...")

    # If dependencies aren't installed, use filename for metadata
    if not DEPENDENCIES_INSTALLED:
        # Try to extract artist and title from filename using common patterns
        filename = Path(file_path).stem
        
        # Handle common filename patterns: "Artist - Title" or "## Artist - Title"
        if " - " in filename:
            # Skip any track numbers at the beginning
            if filename[0:2].isdigit() and filename[2:3] in [" ", "-"]:
                filename = filename[3:].strip()
                
            parts = filename.split(" - ", 1)
            if len(parts) == 2:
                return {
                    "title": parts[1].strip(),
                    "artist": parts[0].strip(),
                    "filename": os.path.basename(file_path)
                }
        
        # Default fallback if no pattern matched
        return {
            "title": filename.replace("_", " "),
            "artist": "Unknown Artist",
            "filename": os.path.basename(file_path)
        }

    try:
        # Check if API key is available
        if not ACOUSTID_API_KEY:
            print("❌ AcoustID API key not available. Using fallback metadata.")
            return fallback_to_filename_metadata(file_path)

        # Generate fingerprint and duration
        duration, fingerprint = acoustid.fingerprint_file(file_path)

        # Send request to AcoustID
        response = acoustid.lookup(ACOUSTID_API_KEY, fingerprint, duration, meta="recordings")

        # Debug: Log full response
        print(f"\n📡 **FULL AcoustID Response:** {json.dumps(response, indent=2)}\n")

        # Handle API errors
        if "error" in response:
            print(f"🚨 AcoustID Error: {response['error']['message']}")
            return None

        # Ensure we have results
        if "results" not in response or not response["results"]:
            print("❌ No results found for this song. Using fallback metadata.")

            # Use filename as title, default artist
            fallback_title = Path(file_path).stem.replace("_", " ")
            return {
                "title": fallback_title,
                "artist": "Unknown Artist",
                "filename": os.path.basename(file_path)
            }

        # Sort results by confidence score
        results_sorted = sorted(response["results"], key=lambda x: float(x["score"]), reverse=True)

        # Select the best match
        best_match = None
        highest_score = 0.0

        for result in results_sorted:
            if "recordings" not in result or not result["recordings"]:
                continue

            for recording in result["recordings"]:
                title = recording.get("title", None)
                if not title:
                    print(f"⚠️ Warning: No title found in AcoustID match. Skipping this result.")
                    continue  # Skip bad results

                artist_name = recording.get("artists", [{"name": "Unknown Artist"}])[0].get("name", "Unknown Artist")
                confidence_score = float(result["score"])

                # Ignore generic track names like "Track 3"
                if title.lower().startswith("track "):
                    continue

                if confidence_score > highest_score:
                    best_match = {"title": title, "artist": artist_name, "filename": os.path.basename(file_path)}
                    highest_score = confidence_score

        # If no good match, fallback to defaults
        if not best_match:
            print("❌ No high-confidence matches found. Using fallback metadata.")
            
            # Try to extract from filename as a fallback
            filename = Path(file_path).stem
            if " - " in filename:
                parts = filename.split(" - ", 1)
                if len(parts) == 2:
                    return {
                        "title": parts[1].strip(),
                        "artist": parts[0].strip(),
                        "filename": os.path.basename(file_path)
                    }
            
            return {
                "title": filename.replace("_", " "),
                "artist": "Unknown Artist",
                "filename": os.path.basename(file_path)
            }

        print(f"\n✅ Best Match Found: {best_match['title']} by {best_match['artist']}")
        return best_match

    except Exception as e:
        print(f"❌ Error identifying song: {e}")
        
        # Fallback to extracting from filename
        filename = Path(file_path).stem
        if " - " in filename:
            parts = filename.split(" - ", 1)
            if len(parts) == 2:
                return {
                    "title": parts[1].strip(),
                    "artist": parts[0].strip(),
                    "filename": os.path.basename(file_path)
                }
                
        return {
            "title": filename.replace("_", " "),
            "artist": "Unknown Artist",
            "filename": os.path.basename(file_path)
        }

def save_file(filename, content):
    """Save text content to a file."""
    with open(filename, "w", encoding="utf-8") as f:
        f.write(content)

def analyze_audio(file_path):
    """Analyze the audio file, identify the song, fetch lyrics, and save LRC file."""
    print(f"\n🔎 Analyzing file: {file_path}")

    # Identify the song
    song_info = identify_song(file_path)
    
    if song_info:
        print("\n✅ **Best Match Selected:**")
        print(f"🎶 Title: {song_info['title']}")
        print(f"🎤 Artist: {song_info['artist']}")

        # Add the filename to the song metadata
        song_info["filename"] = os.path.basename(file_path)

        # Save metadata as JSON
        metadata_filename = os.path.join(os.path.dirname(file_path), f"{Path(file_path).stem}_info.json")
        save_file(metadata_filename, json.dumps(song_info, indent=2))
        print(f"✅ Saved song metadata to {metadata_filename}")

        # Fetch and save synced lyrics if dependency is available
        if DEPENDENCIES_INSTALLED:
            print("\n🎼 Fetching lyrics now...")
            lrc_content = fetch_synced_lyrics(song_info["artist"], song_info["title"])

            if lrc_content:
                lrc_filename = os.path.join(os.path.dirname(file_path), f"{Path(file_path).stem}.lrc")
                save_file(lrc_filename, lrc_content)
                print(f"✅ Saved synced lyrics to {lrc_filename}")
            else:
                print("❌ No synced lyrics found.")
        else:
            print("⚠️ Skipping lyrics fetching since dependencies are not installed.")
    else:
        print("❌ Skipping lyrics fetching since song identification failed.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze audio files and fetch synced lyrics")
    parser.add_argument("input_file", help="Audio file to analyze")
    
    args = parser.parse_args()
    
    analyze_audio(args.input_file)
