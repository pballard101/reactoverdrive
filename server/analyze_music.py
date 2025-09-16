#!/usr/bin/env python3
"""
Music Analysis with Note Detection

This script analyzes an audio file and extracts beats, tempo, onsets, energy, mood, notes, and song segments.

Requirements:
    pip install librosa numpy soundfile scipy

Usage:
    python analyze_music.py input_audio.mp3 output_analysis.json
"""

import os
import sys
import json
import argparse
from pathlib import Path
import random  # For generating placeholder data
import time    # For timing operations

# Flag to track if dependencies are installed
DEPENDENCIES_INSTALLED = True

# Try to import libraries, fall back gracefully if not available
try:
    import numpy as np
    import librosa
    from scipy.ndimage import median_filter  # Rolling median for stabilization
except ImportError as e:
    DEPENDENCIES_INSTALLED = False
    print(f"⚠️ Warning: Audio analysis dependencies not installed. Using fallback mode. Error: {e}")
    print("To install all dependencies: pip install librosa numpy soundfile scipy")

# ✅ Extract Notes from Audio
def extract_notes(y, sr):
    """Detects notes played in an audio file and filters out near-duplicates."""
    if not DEPENDENCIES_INSTALLED:
        # Generate placeholder notes if dependencies are missing
        return generate_placeholder_notes()
        
    print("\n🎵 **Extracting Notes...**")

    pitches, magnitudes = librosa.piptrack(y=y, sr=sr, threshold=0.75)
    note_events = []
    last_note_time = {}

    for t in range(pitches.shape[1]):  
        pitch_values = pitches[:, t]
        valid_pitches = pitch_values[pitch_values > 0]  

        if valid_pitches.any():
            avg_pitch = np.mean(valid_pitches)
            note = librosa.hz_to_note(avg_pitch)
            note_time = librosa.frames_to_time(t, sr=sr)

            # Only keep a note if it hasn't appeared in the last 50ms
            if note not in last_note_time or (note_time - last_note_time[note]) > 0.05:
                note_events.append({"time": round(float(note_time), 2), "note": note})
                last_note_time[note] = note_time  # Update last seen time

    print(f"🎶 Extracted {len(note_events)} filtered notes")
    return note_events

def generate_placeholder_notes():
    """Generate placeholder notes when dependencies are missing."""
    print("📝 Generating placeholder notes...")
    notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]
    note_events = []
    
    # Generate 50 random notes spread over 3 minutes
    for i in range(50):
        time = round(random.uniform(0, 180), 2)  # 0 to 180 seconds
        note = random.choice(notes)
        note_events.append({"time": time, "note": note})
    
    # Sort by time
    note_events.sort(key=lambda x: x["time"])
    print(f"📝 Generated {len(note_events)} placeholder notes")
    return note_events

# ✅ Analyze Audio and Extract Music Data
def analyze_audio(file_path):
    """Analyze an audio file and return the results as a dictionary."""
    print(f"\n🎵 **Starting Analysis for:** {file_path}")
    
    # If dependencies are missing, use fallback mode
    if not DEPENDENCIES_INSTALLED:
        print("⚠️ Running in fallback mode - generating simulated audio analysis")
        return generate_fallback_analysis(file_path)

    try:
        print("📂 Loading audio file...")
        y, sr = librosa.load(file_path, sr=None)  # Load audio
        duration = librosa.get_duration(y=y, sr=sr)
        print(f"✅ Loaded: {duration:.2f} sec, {sr} Hz sample rate")
    except Exception as e:
        print(f"❌ Error loading file: {e}")
        print("⚠️ Falling back to simulated analysis...")
        return generate_fallback_analysis(file_path)

    # ✅ Detect Beats & Tempo
    print("\n⏳ **Detecting beats and tempo...**")
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    # ✅ Detect Onsets
    print("\n🎼 **Detecting onsets...**")
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, units="frames")
    onset_times = librosa.frames_to_time(onset_frames, sr=sr).tolist()

    # ✅ Analyze Energy
    print("\n⚡ **Analyzing energy levels...**")
    frame_length, hop_length = 2048, 512
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    rms_times = librosa.times_like(rms, sr=sr, hop_length=hop_length)

    # ✅ Extract Notes
    notes = extract_notes(y, sr)

    # ✅ Save Everything to JSON
    analysis = {
        "metadata": {
            "filename": os.path.basename(file_path),
            "duration": float(duration),
            "tempo": float(tempo),
            "sample_rate": sr
        },
        "beats": beat_times,
        "onsets": onset_times,
        "energy_profile": [{"time": float(t), "energy": float(e)} for t, e in zip(rms_times, rms)],
        "notes": notes
    }
    
    return analysis

def generate_fallback_analysis(file_path):
    """Generate fallback analysis when dependencies are missing."""
    print("📊 Generating simulated audio analysis...")
    
    # Try to get file metadata through basic file operations
    filename = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)
    
    # Estimate duration based on MP3 file size (rough estimate)
    # Assuming roughly 1MB per minute for medium quality MP3
    estimated_duration = (file_size / (1024 * 1024)) * 60
    
    # Generate placeholder beats (approximately 1-2 beats per second)
    tempo = random.uniform(85, 120)
    beat_interval = 60 / tempo
    beats = [i * beat_interval for i in range(int(estimated_duration / beat_interval))]
    
    # Generate onsets (more frequent than beats)
    onset_count = int(estimated_duration * 2)  # 2 onsets per second on average
    onsets = [random.uniform(0, estimated_duration) for _ in range(onset_count)]
    onsets.sort()
    
    # Generate energy profile (one measurement per second)
    energy_profile = []
    for i in range(int(estimated_duration) + 1):
        # Create some variation in energy over time
        base_energy = 0.5
        variation = 0.3 * abs(math.sin(i / 10))
        energy = base_energy + variation
        energy_profile.append({"time": float(i), "energy": float(energy)})
    
    # Extract notes
    notes = generate_placeholder_notes()
    
    # Create full analysis
    analysis = {
        "metadata": {
            "filename": filename,
            "duration": float(estimated_duration),
            "tempo": float(tempo),
            "sample_rate": 44100,  # Standard sample rate
            "generation_method": "fallback" # Indicate this was generated, not analyzed
        },
        "beats": beats,
        "onsets": onsets,
        "energy_profile": energy_profile,
        "notes": notes
    }
    
    print(f"✅ Generated fallback analysis for {filename} ({estimated_duration:.1f} sec)")
    return analysis

# ✅ Detect Song Segments Based on Energy & Mood
def detect_segments(analysis_data):
    """Detect segments (intro, verse, chorus) from energy and mood profiles."""
    print("\n🔍 **Detecting segments from audio analysis...**")

    duration = analysis_data["metadata"]["duration"]
    energy_profile = analysis_data["energy_profile"]
    
    # If dependencies are missing and we're using generated data
    if not DEPENDENCIES_INSTALLED or analysis_data["metadata"].get("generation_method") == "fallback":
        print("⚠️ Using simulated segment detection")
        segments = generate_fallback_segments(duration)
        analysis_data["segments"] = segments
        return analysis_data
    
    times = [e["time"] for e in energy_profile]
    energy_values = [e["energy"] for e in energy_profile]

    max_energy = max(energy_values) if energy_values else 1
    norm_energy = [e/max_energy for e in energy_values]

    # Apply stronger double smoothing to energy profile
    # First smoothing pass - larger filter size for more aggressive smoothing
    smoothed_energy = median_filter(norm_energy, size=15)  # Increased from 5 to 15
    # Second smoothing pass to further reduce noise
    smoothed_energy = median_filter(smoothed_energy, size=9)

    # ---- MAJOR SEGMENT DETECTION (fewer, larger segments) ----
    
    # Use a much larger window size and higher threshold to detect only major changes
    change_points = []
    
    # Fixed window size - larger to detect only significant changes
    # Use a proportion of the song length but with reasonable bounds
    window_size = max(30, min(int(len(norm_energy) * 0.04), 60))  # Much larger window
    
    # Calculate average energy
    avg_energy = sum(smoothed_energy) / len(smoothed_energy)
    
    # Set thresholds
    high_threshold = avg_energy * 1.4  # Slightly higher threshold
    low_threshold = avg_energy * 0.6   # Slightly lower threshold
    
    # Higher threshold for change detection
    change_threshold = 0.35 * avg_energy  # Increased from 0.2 to 0.35
    
    # Minimum segment duration in seconds (approximately)
    min_segment_duration = 10  # seconds
    min_indices_between_segments = int(min_segment_duration * len(times) / duration)
    
    # Find significant change points
    for i in range(window_size, len(smoothed_energy) - window_size):
        # Skip if too close to previous change point
        if change_points and (i - change_points[-1]) < min_indices_between_segments:
            continue
            
        prev_avg = sum(smoothed_energy[i-window_size:i]) / window_size
        next_avg = sum(smoothed_energy[i:i+window_size]) / window_size

        if abs(next_avg - prev_avg) > change_threshold:
            change_points.append(i)

    # Always include start and end points
    if 0 not in change_points:
        change_points = [0] + change_points
    if len(smoothed_energy) - 1 not in change_points:
        change_points.append(len(smoothed_energy) - 1)
    
    change_points = sorted(change_points)
    
    # Limit to a reasonable number of segments by enforcing minimum duration
    filtered_change_points = [0]  # Always keep the start point
    for cp in change_points[1:-1]:  # Skip the first and last points
        if cp - filtered_change_points[-1] >= min_indices_between_segments:
            filtered_change_points.append(cp)
    filtered_change_points.append(change_points[-1])  # Always keep the end point
    
    change_points = filtered_change_points
    
    print(f"🔀 Identified {len(change_points)-1} major song segments")
    
    # Create segments with cleaner type assignment
    segments = []
    for i in range(len(change_points) - 1):
        start_time = times[change_points[i]]
        end_time = times[change_points[i+1]]
        
        # Calculate average energy in this segment
        start_idx = change_points[i]
        end_idx = change_points[i+1]
        segment_energy = sum(smoothed_energy[start_idx:end_idx + 1]) / (end_idx - start_idx + 1)

        # Determine segment type
        if i == 0:
            segment_type = "intro"
        elif i == len(change_points) - 2:  # Last segment
            segment_type = "outro"
        elif segment_energy > high_threshold:
            segment_type = "chorus"
        elif segment_energy < low_threshold:
            segment_type = "verse"
        else:
            segment_type = "bridge"

        segments.append({
            "type": segment_type, 
            "start": float(start_time), 
            "end": float(end_time),
            "energy": float(segment_energy)
        })

    analysis_data["segments"] = segments
    return analysis_data

def generate_fallback_segments(duration):
    """Generate fallback song segments when dependencies are missing."""
    print("🎵 Generating simulated song segments...")
    
    # Typical song structure (times in seconds)
    segments = []
    
    # Intro (usually 10-15% of song)
    intro_end = min(duration * 0.15, 30)  # Max 30 seconds
    segments.append({"type": "intro", "start": 0.0, "end": intro_end})
    
    # Verse 1
    verse1_end = intro_end + min(duration * 0.2, 45)  # Typical verse length
    segments.append({"type": "verse", "start": intro_end, "end": verse1_end})
    
    # Chorus 1
    chorus1_end = verse1_end + min(duration * 0.15, 30)
    segments.append({"type": "chorus", "start": verse1_end, "end": chorus1_end})
    
    # Verse 2
    verse2_end = chorus1_end + min(duration * 0.2, 45)
    segments.append({"type": "verse", "start": chorus1_end, "end": verse2_end})
    
    # Chorus 2
    chorus2_end = verse2_end + min(duration * 0.15, 30)
    segments.append({"type": "chorus", "start": verse2_end, "end": chorus2_end})
    
    # Bridge or solo
    bridge_end = chorus2_end + min(duration * 0.1, 30)
    segments.append({"type": "bridge", "start": chorus2_end, "end": bridge_end})
    
    # Final chorus
    final_chorus_end = duration - 5  # Leave a little for outro
    segments.append({"type": "chorus", "start": bridge_end, "end": final_chorus_end})
    
    # Outro
    segments.append({"type": "outro", "start": final_chorus_end, "end": duration})
    
    print(f"✅ Generated {len(segments)} song segments")
    return segments

# ✅ Main Execution: Analyze Music + Detect Segments
def analyze_and_detect_segments(input_file, output_file=None):
    """Runs full analysis and segment detection, saving results to JSON."""
    print(f"\n🎵 **Processing Audio File:** {input_file}")

    analysis = analyze_audio(input_file)
    if analysis:
        analysis = detect_segments(analysis)

        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(analysis, f, indent=2, ensure_ascii=False)  # Fix Unicode issue
            print(f"\n📁 **Analysis saved to:** {output_file}")

        print("\n✅ **Analysis & Segment Detection Complete!**\n")
        return analysis
    else:
        print("❌ Failed to analyze file.")
        
        # Create fallback analysis even in case of failure
        fallback = generate_fallback_analysis(input_file)
        fallback = detect_segments(fallback)
        
        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(fallback, f, indent=2, ensure_ascii=False)
            print(f"\n📁 **Fallback analysis saved to:** {output_file}")
        
        print("\n⚠️ **Used fallback analysis due to errors!**\n")
        return fallback

# ✅ Command-line Execution
if __name__ == "__main__":
    # Add missing math module for fallback functions
    import math
    
    parser = argparse.ArgumentParser(description="Analyze music and detect song segments")
    parser.add_argument("input_file", help="Audio file to analyze")
    parser.add_argument("output_file", nargs="?", help="Output JSON file (optional)")

    args = parser.parse_args()
    if not args.output_file:
        args.output_file = str(Path(args.input_file).with_suffix('.json'))

    analyze_and_detect_segments(args.input_file, args.output_file)
