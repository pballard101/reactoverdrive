#!/bin/bash
#
# Author all song levels
#
# This script runs the authoring pipeline on all songs that have analysis files,
# generating .level.json files for each.
#
# Usage:
#   ./author_all_levels.sh
#
# Requirements:
#   - Python 3 with librosa, numpy, scipy installed
#   - Songs in ../client/songs/ directory with _analysis.json files
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SONGS_DIR="$SCRIPT_DIR/../client/songs"

echo "=================================="
echo "Musical Level Authoring Pipeline"
echo "=================================="
echo ""

# Check if songs directory exists
if [ ! -d "$SONGS_DIR" ]; then
    echo "Error: Songs directory not found at $SONGS_DIR"
    exit 1
fi

# Count processed songs
processed=0
skipped=0
failed=0

# Find all MP3 files in songs directory
for mp3_file in "$SONGS_DIR"/*/*.mp3; do
    if [ ! -f "$mp3_file" ]; then
        continue
    fi

    # Get the base name and directory
    song_dir=$(dirname "$mp3_file")
    base_name=$(basename "$mp3_file" .mp3)

    # Check if analysis file exists
    analysis_file="$song_dir/${base_name}_analysis.json"
    if [ ! -f "$analysis_file" ]; then
        echo "Skipping $base_name - no analysis file found"
        ((skipped++))
        continue
    fi

    # Output level file
    level_file="$song_dir/${base_name}.level.json"

    # Check if level file already exists
    if [ -f "$level_file" ]; then
        echo "Skipping $base_name - level file already exists"
        ((skipped++))
        continue
    fi

    echo "Processing: $base_name"

    # Run the authoring script
    python3 "$SCRIPT_DIR/author_level.py" "$mp3_file" "$level_file"

    if [ $? -eq 0 ]; then
        echo "  Created: $level_file"
        ((processed++))
    else
        echo "  Failed to process $base_name"
        ((failed++))
    fi

    echo ""
done

echo "=================================="
echo "Summary"
echo "=================================="
echo "Processed: $processed"
echo "Skipped:   $skipped"
echo "Failed:    $failed"
echo ""
