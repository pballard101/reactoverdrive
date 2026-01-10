#!/usr/bin/env python3
"""
Musical Level Authoring Pipeline - Beat-Driven Formation Spawning

Spawns formations ON THE BEAT so enemies sync with the music's pulse.
- Primary loop is over beat_times, not phrases
- Energy determines spawn frequency (every 1/2/4 beats)
- Phrases determine formation SHAPE, not timing
- Repeated phrases get the SAME formation for recognizable patterns

Usage:
    python author_level.py input_audio.mp3 output_level.json

Requirements:
    pip install librosa numpy scipy
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# Flag to track if dependencies are installed
DEPENDENCIES_INSTALLED = True

try:
    import numpy as np
    import librosa
    from scipy.ndimage import median_filter
    from scipy.signal import find_peaks
except ImportError as e:
    DEPENDENCIES_INSTALLED = False
    print(f"Warning: Audio analysis dependencies not installed. Error: {e}")
    print("To install: pip install librosa numpy scipy")


# =============================================================================
# CONSTANTS AND CONFIGURATION
# =============================================================================

# Formation shapes - REDUCED counts for less "wall" feeling
FORMATION_SHAPES = {
    "horizontal_line": {
        "description": "Enemies in a horizontal line",
        "base_count": 5
    },
    "diagonal_up": {
        "description": "Diagonal line going up (top-left to bottom-right visually)",
        "base_count": 5
    },
    "diagonal_down": {
        "description": "Diagonal line going down",
        "base_count": 5
    },
    "v_shape": {
        "description": "V formation pointing left",
        "base_count": 5
    },
    "arrow": {
        "description": "Arrow formation pointing left",
        "base_count": 6
    },
    "wave": {
        "description": "Sine wave pattern",
        "base_count": 6
    },
    "pincer": {
        "description": "Two groups from top and bottom",
        "base_count": 6
    },
    "cluster": {
        "description": "Tight cluster of enemies",
        "base_count": 4
    }
}

# Rhythmic patterns for musical timing (fractions of one beat)
RHYTHMIC_PATTERNS = {
    "straight": [0, 0.25, 0.5, 0.75],      # Regular 16th notes
    "swing": [0, 0.33, 0.67, 1.0],         # Swing triplet feel
    "triplet": [0, 0.33, 0.67],            # Triplets
    "syncopated": [0, 0.25, 0.625, 0.875], # Syncopated feel
    "dotted": [0, 0.375, 0.75],            # Dotted 8th rhythm
}

# Map phrase types to formation shapes
PHRASE_TO_FORMATION = {
    "run_ascending": "diagonal_up",
    "run_descending": "diagonal_down",
    "riff": "horizontal_line",
    "motif": "v_shape",
    "chord_stab": "horizontal_line",
    "arpeggio": "wave",
    "call_response": "pincer",
    "single": "cluster"
}

INSTRUMENT_ROLES = {
    "bass": {"freq_range": (20, 250), "vertical_zone": (0.7, 1.0)},
    "percussion": {"freq_range": (2000, 8000), "vertical_zone": (0.3, 0.7)},
    "lead": {"freq_range": (250, 2000), "vertical_zone": (0.1, 0.5)},
    "pad": {"freq_range": (100, 1000), "vertical_zone": (0.4, 0.8)}
}


# =============================================================================
# AUDIO ANALYSIS FUNCTIONS
# =============================================================================

def load_audio(file_path):
    """Load audio file and return waveform and sample rate."""
    print(f"Loading audio: {file_path}")
    y, sr = librosa.load(file_path, sr=None)
    duration = librosa.get_duration(y=y, sr=sr)
    print(f"  Duration: {duration:.2f}s, Sample rate: {sr}Hz")
    return y, sr, duration


def extract_basic_features(y, sr):
    """Extract basic audio features using librosa."""
    print("Extracting basic features...")

    # Tempo and beats
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    # Onsets
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, units="frames")
    onset_times = librosa.frames_to_time(onset_frames, sr=sr).tolist()

    # Energy profile (RMS)
    hop_length = 512
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    rms_times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
    energy_profile = [{"time": float(t), "energy": float(e)} for t, e in zip(rms_times, rms)]

    # Pitches
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr, threshold=0.75)

    print(f"  Found {len(beat_times)} beats, {len(onset_times)} onsets")

    return {
        "tempo": float(tempo) if np.isscalar(tempo) else float(tempo[0]),
        "beat_times": beat_times,
        "onset_times": onset_times,
        "energy_profile": energy_profile,
        "pitches": pitches,
        "magnitudes": magnitudes,
        "rms": rms,
        "rms_times": rms_times
    }


def extract_frequency_bands(y, sr):
    """Extract energy in different frequency bands over time."""
    print("Extracting frequency bands...")

    hop_length = 512
    n_fft = 2048

    # Compute STFT
    D = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    times = librosa.times_like(D, sr=sr, hop_length=hop_length)

    # Define frequency bands
    bands = {
        "sub_bass": (20, 60),
        "bass": (60, 250),
        "low_mid": (250, 500),
        "mid": (500, 2000),
        "upper_mid": (2000, 4000),
        "presence": (4000, 8000),
        "brilliance": (8000, 16000)
    }

    band_energies = {}
    for band_name, (low, high) in bands.items():
        mask = (freqs >= low) & (freqs < high)
        if np.any(mask):
            band_energy = np.sum(D[mask, :], axis=0)
            band_energies[band_name] = band_energy
        else:
            band_energies[band_name] = np.zeros(D.shape[1])

    print(f"  Extracted {len(bands)} frequency bands")

    return {
        "times": times,
        "bands": band_energies,
        "freqs": freqs,
        "stft": D
    }


def calculate_onset_sharpness(y, sr, onset_times):
    """Calculate how sharp/percussive each onset is."""
    print("Calculating onset sharpness...")

    hop_length = 512
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    onset_env_times = librosa.times_like(onset_env, sr=sr, hop_length=hop_length)

    sharpness_values = []
    for onset_time in onset_times:
        idx = np.argmin(np.abs(onset_env_times - onset_time))
        window = 5
        start = max(0, idx - window)
        end = min(len(onset_env), idx + window)

        peak_value = onset_env[idx]
        surrounding_avg = np.mean(onset_env[start:end])

        if surrounding_avg > 0:
            sharpness = min(1.0, peak_value / (surrounding_avg * 2))
        else:
            sharpness = 0.5

        sharpness_values.append({
            "time": float(onset_time),
            "sharpness": float(sharpness)
        })

    return sharpness_values


# =============================================================================
# INSTRUMENT ROLE INFERENCE
# =============================================================================

def infer_instrument_roles(freq_bands, onset_sharpness, window_size=1.0, hop_size=0.5):
    """Analyze time windows and assign instrument roles based on frequency content."""
    print("Inferring instrument roles...")

    times = freq_bands["times"]
    duration = times[-1] if len(times) > 0 else 0

    roles_over_time = []

    t = 0
    while t < duration:
        window_mask = (times >= t) & (times < t + window_size)

        if not np.any(window_mask):
            t += hop_size
            continue

        bass_energy = np.mean(freq_bands["bands"]["bass"][window_mask])
        low_mid_energy = np.mean(freq_bands["bands"]["low_mid"][window_mask])
        mid_energy = np.mean(freq_bands["bands"]["mid"][window_mask])
        upper_mid_energy = np.mean(freq_bands["bands"]["upper_mid"][window_mask])
        presence_energy = np.mean(freq_bands["bands"]["presence"][window_mask])

        window_onsets = [o for o in onset_sharpness if t <= o["time"] < t + window_size]
        avg_sharpness = np.mean([o["sharpness"] for o in window_onsets]) if window_onsets else 0.3

        scores = {}
        total_energy = bass_energy + mid_energy + presence_energy + 0.001

        scores["bass"] = (bass_energy / total_energy * 0.6 + (1.0 - avg_sharpness) * 0.4)
        scores["percussion"] = (avg_sharpness * 0.7 + presence_energy / total_energy * 0.3)
        scores["lead"] = (mid_energy / total_energy * 0.5 + upper_mid_energy / total_energy * 0.3 + avg_sharpness * 0.2)
        scores["pad"] = ((1.0 - avg_sharpness) * 0.6 + low_mid_energy / total_energy * 0.4)

        dominant_role = max(scores, key=scores.get)

        roles_over_time.append({
            "time": float(t),
            "duration": float(window_size),
            "role": dominant_role,
            "scores": {k: float(v) for k, v in scores.items()},
            "confidence": float(scores[dominant_role])
        })

        t += hop_size

    print(f"  Analyzed {len(roles_over_time)} time windows")
    return roles_over_time


# =============================================================================
# SECTION DETECTION
# =============================================================================

def detect_sections(rms, rms_times, duration):
    """Detect song sections (intro, verse, chorus, etc.) based on energy."""
    print("Detecting sections...")

    max_energy = np.max(rms) if np.max(rms) > 0 else 1
    norm_energy = rms / max_energy
    smoothed = median_filter(norm_energy, size=15)
    smoothed = median_filter(smoothed, size=9)

    avg_energy = np.mean(smoothed)
    high_threshold = avg_energy * 1.4
    low_threshold = avg_energy * 0.6

    window_size = max(30, min(int(len(norm_energy) * 0.04), 60))
    change_threshold = 0.35 * avg_energy
    min_segment_duration = 10
    min_indices = int(min_segment_duration * len(rms_times) / duration) if duration > 0 else 30

    change_points = [0]

    for i in range(window_size, len(smoothed) - window_size):
        if change_points and (i - change_points[-1]) < min_indices:
            continue

        prev_avg = np.mean(smoothed[i-window_size:i])
        next_avg = np.mean(smoothed[i:i+window_size])

        if abs(next_avg - prev_avg) > change_threshold:
            change_points.append(i)

    change_points.append(len(smoothed) - 1)

    sections = []
    for i in range(len(change_points) - 1):
        start_idx = change_points[i]
        end_idx = change_points[i + 1]

        start_time = float(rms_times[start_idx])
        end_time = float(rms_times[end_idx])
        section_energy = float(np.mean(smoothed[start_idx:end_idx + 1]))

        if i == 0:
            section_type = "intro"
        elif i == len(change_points) - 2:
            section_type = "outro"
        elif section_energy > high_threshold:
            section_type = "chorus"
        elif section_energy < low_threshold:
            section_type = "verse"
        else:
            section_type = "bridge"

        start_energy = float(smoothed[start_idx])
        end_energy = float(smoothed[end_idx])
        energy_diff = end_energy - start_energy

        if abs(energy_diff) < 0.1:
            intensity_curve = "steady"
        elif energy_diff > 0.2:
            intensity_curve = "rising"
        elif energy_diff < -0.2:
            intensity_curve = "falling"
        else:
            intensity_curve = "volatile"

        sections.append({
            "id": f"section_{i:03d}",
            "type": section_type,
            "start": start_time,
            "end": end_time,
            "energy": section_energy,
            "intensity_curve": intensity_curve,
            "spawn_rate_multiplier": 0.5 + section_energy * 1.5
        })

    print(f"  Found {len(sections)} sections")
    return sections


# =============================================================================
# DROP DETECTION
# =============================================================================

def detect_drops(rms, rms_times, freq_bands):
    """Detect major drops and impact moments."""
    print("Detecting drops...")

    smoothed = median_filter(rms, size=10)
    energy_derivative = np.gradient(smoothed)
    avg_energy = np.mean(smoothed)
    max_energy = np.max(smoothed)

    drops = []
    min_gap_samples = int(4.0 * len(rms_times) / (rms_times[-1] if len(rms_times) > 0 else 1))

    for i in range(20, len(smoothed) - 20):
        current_energy = smoothed[i]
        is_local_min = (smoothed[i] < smoothed[i-1] and smoothed[i] < smoothed[i+1])

        if is_local_min:
            future_window = smoothed[i:min(i+30, len(smoothed))]
            if len(future_window) > 5:
                max_future = np.max(future_window)
                energy_jump = max_future - current_energy

                if energy_jump > avg_energy * 0.5:
                    if drops and (i - drops[-1]["_index"]) < min_gap_samples:
                        continue

                    drop_offset = np.argmax(energy_derivative[i:i+30])
                    drop_idx = i + drop_offset
                    drop_time = float(rms_times[drop_idx]) if drop_idx < len(rms_times) else float(rms_times[-1])
                    magnitude = min(1.0, energy_jump / max_energy) if max_energy > 0 else 0.5

                    pre_silence = 0.0
                    for j in range(i-1, max(0, i-30), -1):
                        if smoothed[j] < avg_energy * 0.3:
                            pre_silence = float(rms_times[i] - rms_times[j])
                            break

                    spectral_fullness = calculate_spectral_fullness(freq_bands, drop_idx)

                    if magnitude > 0.8 and spectral_fullness > 0.7:
                        formation = "burst"
                    elif pre_silence > 0.5:
                        formation = "converge"
                    elif magnitude > 0.6:
                        formation = "wave"
                    else:
                        formation = "spiral"

                    drops.append({
                        "id": f"drop_{len(drops):03d}",
                        "time": drop_time,
                        "magnitude": float(magnitude),
                        "pre_drop_silence": float(pre_silence),
                        "spectral_fullness": float(spectral_fullness),
                        "formation": formation,
                        "enemy_count": int(8 + magnitude * 12),
                        "_index": drop_idx
                    })

    for drop in drops:
        del drop["_index"]

    print(f"  Found {len(drops)} drops")
    return drops


def calculate_spectral_fullness(freq_bands, time_idx):
    """Calculate how spectrally full the audio is at a given time."""
    if time_idx >= len(freq_bands["times"]):
        return 0.5

    active_bands = 0
    total_bands = len(freq_bands["bands"])

    all_energies = [band[time_idx] if time_idx < len(band) else 0 for band in freq_bands["bands"].values()]
    threshold = np.mean(all_energies) * 0.5 if all_energies else 0

    for band_energy in freq_bands["bands"].values():
        if time_idx < len(band_energy) and band_energy[time_idx] > threshold:
            active_bands += 1

    return active_bands / total_bands if total_bands > 0 else 0.5


# =============================================================================
# NOTE AND PHRASE EXTRACTION
# =============================================================================

def extract_notes(pitches, magnitudes, sr, hop_length=512):
    """Extract notes from pitch tracking data."""
    print("Extracting notes...")

    notes = []
    last_note_time = {}

    for t in range(pitches.shape[1]):
        pitch_values = pitches[:, t]
        mag_values = magnitudes[:, t]

        max_idx = np.argmax(mag_values)
        if pitch_values[max_idx] > 0 and mag_values[max_idx] > 0.1:
            freq = pitch_values[max_idx]

            try:
                note_name = librosa.hz_to_note(freq)
                note_time = librosa.frames_to_time(t, sr=sr, hop_length=hop_length)

                base_note = note_name[:-1] if note_name[-1].isdigit() else note_name
                if base_note not in last_note_time or (note_time - last_note_time[base_note]) > 0.05:
                    midi = note_to_midi(note_name)
                    notes.append({
                        "time": float(note_time),
                        "note": note_name,
                        "frequency": float(freq),
                        "magnitude": float(mag_values[max_idx]),
                        "midi": midi
                    })
                    last_note_time[base_note] = note_time
            except:
                pass

    print(f"  Extracted {len(notes)} notes")
    return notes


def note_to_midi(note_name):
    """Convert note name to MIDI number."""
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    note_name = note_name.replace('♯', '#').replace('♭', 'b')

    if len(note_name) >= 2:
        if note_name[1] == '#' or note_name[1] == 'b':
            base_note = note_name[:2]
            octave_str = note_name[2:] if len(note_name) > 2 else '4'
        else:
            base_note = note_name[0]
            octave_str = note_name[1:] if len(note_name) > 1 else '4'

        try:
            octave = int(octave_str) if octave_str else 4
        except ValueError:
            octave = 4

        if 'b' in base_note:
            idx = note_names.index(base_note[0])
            base_note = note_names[(idx - 1) % 12]

        try:
            note_idx = note_names.index(base_note.replace('b', '').upper())
            return octave * 12 + note_idx
        except ValueError:
            return 60

    return 60


def midi_to_note_name(midi):
    """Convert MIDI number to note name."""
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    octave = (midi // 12) - 1
    note_idx = midi % 12
    return f"{note_names[note_idx]}{octave}"


def detect_phrases(notes, beat_times, tempo):
    """Group notes into musical phrases."""
    print("Detecting phrases...")

    if not notes:
        return []

    phrases = []
    current_phrase_notes = []
    last_note_time = 0

    beat_duration = 60 / tempo if tempo > 0 else 0.5
    gap_threshold = beat_duration * 1.5

    for note in notes:
        gap = note["time"] - last_note_time

        if gap > gap_threshold and current_phrase_notes:
            phrase_type = analyze_phrase_type(current_phrase_notes)
            phrases.append({
                "notes": current_phrase_notes,
                "type": phrase_type,
                "start": current_phrase_notes[0]["time"],
                "end": current_phrase_notes[-1]["time"]
            })
            current_phrase_notes = []

        current_phrase_notes.append(note)
        last_note_time = note["time"]

    if current_phrase_notes:
        phrase_type = analyze_phrase_type(current_phrase_notes)
        phrases.append({
            "notes": current_phrase_notes,
            "type": phrase_type,
            "start": current_phrase_notes[0]["time"],
            "end": current_phrase_notes[-1]["time"]
        })

    print(f"  Found {len(phrases)} phrases")
    return phrases


def analyze_phrase_type(notes):
    """Determine the type of phrase based on pitch and rhythm patterns."""
    if len(notes) < 2:
        return "single"

    pitches = [n.get("midi", 60) for n in notes]
    intervals = [pitches[i+1] - pitches[i] for i in range(len(pitches)-1)]

    if len(intervals) >= 3 and all(d > 0 for d in intervals):
        return "run_ascending"

    if len(intervals) >= 3 and all(d < 0 for d in intervals):
        return "run_descending"

    if len(intervals) >= 2:
        arpeggio_intervals = [3, 4, 5]
        is_arpeggio = all(abs(i) in arpeggio_intervals for i in intervals)
        if is_arpeggio:
            return "arpeggio"

    if len(pitches) >= 4:
        half = len(pitches) // 2
        first_half = pitches[:half]
        second_half = pitches[half:half*2]
        if first_half == second_half:
            return "riff"

    if len(set(pitches)) == 1:
        return "chord_stab"

    return "motif"


def detect_repeating_phrases(phrases):
    """Identify phrases that repeat and mark them."""
    print("Detecting repeating phrases...")

    phrase_signatures = {}
    repeat_count = 0

    for i, phrase in enumerate(phrases):
        phrase["id"] = f"phrase_{i:03d}"
        sig = create_phrase_signature(phrase)

        if sig and sig in phrase_signatures:
            phrase["is_repeat"] = True
            phrase["original_id"] = phrase_signatures[sig]
            repeat_count += 1
        else:
            phrase["is_repeat"] = False
            if sig:
                phrase_signatures[sig] = phrase["id"]

    print(f"  Found {repeat_count} repeating phrases")
    return phrases


def create_phrase_signature(phrase):
    """Create a normalized signature for phrase comparison."""
    notes = phrase.get("notes", [])
    if len(notes) < 2:
        return None

    pitches = [n.get("midi", 60) for n in notes]
    intervals = tuple(pitches[i+1] - pitches[i] for i in range(len(pitches)-1))

    times = [n["time"] for n in notes]
    durations = [times[i+1] - times[i] for i in range(len(times)-1)]

    if not durations:
        return None

    avg_duration = sum(durations) / len(durations) if durations else 1
    normalized_durations = tuple(round(d / avg_duration, 1) for d in durations) if avg_duration > 0 else ()

    return (intervals, normalized_durations)


# =============================================================================
# FORMATION-BASED SPAWN GENERATION
# =============================================================================

def get_section_for_time(sections, time):
    """Get the section for a specific time."""
    for section in sections:
        if section["start"] <= time < section["end"]:
            return section
    return sections[-1] if sections else None


def get_phrase_for_time(phrases, time):
    """Get the phrase active at a specific time (or nearest phrase)."""
    best_phrase = None
    best_distance = float('inf')

    for phrase in phrases:
        # Check if time is within phrase
        if phrase["start"] <= time <= phrase["end"]:
            return phrase

        # Otherwise find nearest phrase
        distance = min(abs(phrase["start"] - time), abs(phrase["end"] - time))
        if distance < best_distance:
            best_distance = distance
            best_phrase = phrase

    return best_phrase


def calculate_spawn_interval(energy):
    """Determine how many beats between formations based on section energy.

    For a fast-paced song, we want more frequent formations.
    With 5-6 enemies per formation and rhythmic timing, formations feel less like walls.

    energy < 0.35: spawn every 8 beats (calm sections)
    energy 0.35-0.50: spawn every 4 beats
    energy 0.50-0.65: spawn every 2 beats
    energy > 0.65: spawn EVERY beat (intense sections!)
    """
    if energy < 0.35:
        return 8
    elif energy < 0.50:
        return 4
    elif energy < 0.65:
        return 2
    else:
        return 1  # Every beat for high energy!


def calculate_formation_size(energy):
    """Determine enemy count based on section energy.

    energy < 0.35: 4-5 enemies
    energy 0.35-0.55: 5-6 enemies
    energy 0.55-0.75: 6-8 enemies
    energy > 0.75: 8-10 enemies
    """
    if energy < 0.35:
        return 4
    elif energy < 0.55:
        return 5
    elif energy < 0.75:
        return 7
    else:
        return 9


def generate_formation(formation_type, beat_time, section_energy, beat_idx, phrase=None, tempo=120):
    """Generate spawn events for a formation at a specific beat time.

    Returns a list of spawn events that form the shape.
    Uses tempo-based timing so formations feel musical, not like walls.
    """
    events = []
    spawn_time = beat_time  # Spawn exactly on the beat!

    # Get formation config
    shape = FORMATION_SHAPES.get(formation_type, FORMATION_SHAPES["horizontal_line"])

    # Use base_count from shape - rhythmic timing handles the "wall" feeling
    enemy_count = shape.get("base_count", 5)

    # Base velocity - consistent across formations, slightly faster in high energy
    base_velocity = -220 if section_energy > 0.75 else -200

    # Calculate center Y from phrase notes if available
    center_y = 0.5
    if phrase:
        notes = phrase.get("notes", [])
        if notes:
            avg_midi = sum(n.get("midi", 60) for n in notes) / len(notes)
            center_y = 0.85 - (avg_midi - 36) / 60.0 * 0.7  # Map MIDI 36-96 to 0.85-0.15
            center_y = max(0.15, min(0.85, center_y))

    # Calculate spawn spread from tempo - spread across 3/4 of a beat
    # This makes enemies feel like musical notes, not a wall
    beat_duration = 60.0 / tempo
    spawn_spread = beat_duration * 0.75  # e.g., ~0.37s at 122 BPM

    # Choose rhythmic pattern based on phrase type
    if phrase and phrase.get("type") == "riff":
        pattern = RHYTHMIC_PATTERNS["straight"]  # Regular 16th notes for riffs
    elif phrase and phrase.get("type") == "arpeggio":
        pattern = RHYTHMIC_PATTERNS["triplet"]  # Triplets for arpeggios
    elif phrase and phrase.get("type") == "scale":
        pattern = RHYTHMIC_PATTERNS["dotted"]  # Dotted rhythm for scales
    else:
        pattern = RHYTHMIC_PATTERNS["swing"]  # Default swing feel

    if formation_type == "horizontal_line":
        # Spread vertically in a line with rhythmic timing
        for i in range(enemy_count):
            y_offset = (i - (enemy_count - 1) / 2) * 0.08
            y_pos = center_y + y_offset
            y_pos = max(0.1, min(0.9, y_pos))

            # Use rhythmic pattern for timing (feels like notes, not a wall)
            rhythm_idx = i % len(pattern)
            time_offset = pattern[rhythm_idx] * beat_duration

            events.append(create_formation_enemy(
                time=spawn_time + time_offset,
                y_pos=y_pos,
                velocity_x=base_velocity,
                size=0.45 + section_energy * 0.15,
                group_id=f"beat_{beat_idx:03d}",
                formation_type=formation_type
            ))

    elif formation_type == "diagonal_up":
        # Diagonal from bottom-right to top-left with rhythmic timing
        for i in range(enemy_count):
            progress = i / (enemy_count - 1) if enemy_count > 1 else 0.5
            y_pos = (center_y + 0.2) - progress * 0.4  # Goes up
            y_pos = max(0.1, min(0.9, y_pos))

            rhythm_idx = i % len(pattern)
            time_offset = pattern[rhythm_idx] * beat_duration

            events.append(create_formation_enemy(
                time=spawn_time + time_offset,
                y_pos=y_pos,
                velocity_x=base_velocity,
                size=0.45 + section_energy * 0.15,
                group_id=f"beat_{beat_idx:03d}",
                formation_type=formation_type
            ))

    elif formation_type == "diagonal_down":
        # Diagonal from top-right to bottom-left with rhythmic timing
        for i in range(enemy_count):
            progress = i / (enemy_count - 1) if enemy_count > 1 else 0.5
            y_pos = (center_y - 0.2) + progress * 0.4  # Goes down
            y_pos = max(0.1, min(0.9, y_pos))

            rhythm_idx = i % len(pattern)
            time_offset = pattern[rhythm_idx] * beat_duration

            events.append(create_formation_enemy(
                time=spawn_time + time_offset,
                y_pos=y_pos,
                velocity_x=base_velocity,
                size=0.45 + section_energy * 0.15,
                group_id=f"beat_{beat_idx:03d}",
                formation_type=formation_type
            ))

    elif formation_type == "v_shape":
        # V formation pointing left with rhythmic timing
        half = enemy_count // 2
        enemy_idx = 0
        # Top arm of V
        for i in range(half):
            progress = i / half if half > 0 else 0
            y_pos = center_y - 0.15 - progress * 0.15
            y_pos = max(0.1, min(0.9, y_pos))
            rhythm_idx = enemy_idx % len(pattern)
            time_offset = pattern[rhythm_idx] * beat_duration
            events.append(create_formation_enemy(
                time=spawn_time + time_offset,
                y_pos=y_pos,
                velocity_x=base_velocity,
                size=0.45 + section_energy * 0.15,
                group_id=f"beat_{beat_idx:03d}",
                formation_type=formation_type
            ))
            enemy_idx += 1
        # Point of V
        rhythm_idx = enemy_idx % len(pattern)
        time_offset = pattern[rhythm_idx] * beat_duration
        events.append(create_formation_enemy(
            time=spawn_time + time_offset,
            y_pos=center_y,
            velocity_x=base_velocity,
            size=0.5 + section_energy * 0.2,  # Slightly bigger at point
            group_id=f"beat_{beat_idx:03d}",
            formation_type=formation_type
        ))
        enemy_idx += 1
        # Bottom arm of V
        for i in range(half):
            progress = i / half if half > 0 else 0
            y_pos = center_y + 0.15 + progress * 0.15
            y_pos = max(0.1, min(0.9, y_pos))
            rhythm_idx = enemy_idx % len(pattern)
            time_offset = pattern[rhythm_idx] * beat_duration
            events.append(create_formation_enemy(
                time=spawn_time + time_offset,
                y_pos=y_pos,
                velocity_x=base_velocity,
                size=0.45 + section_energy * 0.15,
                group_id=f"beat_{beat_idx:03d}",
                formation_type=formation_type
            ))
            enemy_idx += 1

    elif formation_type == "arrow":
        # Arrow pointing left (triangle with tail) with rhythmic timing
        # Front point
        events.append(create_formation_enemy(
            time=spawn_time,
            y_pos=center_y,
            velocity_x=base_velocity * 1.1,  # Point moves slightly faster
            size=0.55 + section_energy * 0.2,
            group_id=f"beat_{beat_idx:03d}",
            formation_type=formation_type
        ))
        # Wings
        for i in range(1, enemy_count):
            wing_pos = (i + 1) // 2
            is_top = (i % 2 == 1)
            y_offset = wing_pos * 0.1 * (1 if is_top else -1)
            y_pos = center_y - y_offset if is_top else center_y + y_offset
            y_pos = max(0.1, min(0.9, y_pos))

            rhythm_idx = i % len(pattern)
            time_offset = pattern[rhythm_idx] * beat_duration

            events.append(create_formation_enemy(
                time=spawn_time + time_offset,
                y_pos=y_pos,
                velocity_x=base_velocity,
                size=0.4 + section_energy * 0.15,
                group_id=f"beat_{beat_idx:03d}",
                formation_type=formation_type
            ))

    elif formation_type == "wave":
        # Sine wave pattern with rhythmic timing
        for i in range(enemy_count):
            progress = i / (enemy_count - 1) if enemy_count > 1 else 0.5
            wave_offset = np.sin(progress * np.pi * 2) * 0.15
            y_pos = center_y + wave_offset
            y_pos = max(0.1, min(0.9, y_pos))

            rhythm_idx = i % len(pattern)
            time_offset = pattern[rhythm_idx] * beat_duration

            events.append(create_formation_enemy(
                time=spawn_time + time_offset,
                y_pos=y_pos,
                velocity_x=base_velocity,
                size=0.45 + section_energy * 0.15,
                group_id=f"beat_{beat_idx:03d}",
                formation_type=formation_type
            ))

    elif formation_type == "pincer":
        # Two groups from top and bottom with rhythmic timing
        half = enemy_count // 2
        enemy_idx = 0
        # Top group
        for i in range(half):
            y_pos = 0.15 + i * 0.08
            rhythm_idx = enemy_idx % len(pattern)
            time_offset = pattern[rhythm_idx] * beat_duration
            events.append(create_formation_enemy(
                time=spawn_time + time_offset,
                y_pos=y_pos,
                velocity_x=base_velocity,
                size=0.45 + section_energy * 0.15,
                group_id=f"beat_{beat_idx:03d}",
                formation_type=formation_type
            ))
            enemy_idx += 1
        # Bottom group
        for i in range(enemy_count - half):
            y_pos = 0.85 - i * 0.08
            rhythm_idx = enemy_idx % len(pattern)
            time_offset = pattern[rhythm_idx] * beat_duration
            events.append(create_formation_enemy(
                time=spawn_time + time_offset,
                y_pos=y_pos,
                velocity_x=base_velocity,
                size=0.45 + section_energy * 0.15,
                group_id=f"beat_{beat_idx:03d}",
                formation_type=formation_type
            ))
            enemy_idx += 1

    elif formation_type == "cluster":
        # Tight cluster with rhythmic timing
        for i in range(enemy_count):
            angle = (i / enemy_count) * np.pi * 2
            radius = 0.06
            y_pos = center_y + np.sin(angle) * radius
            y_pos = max(0.1, min(0.9, y_pos))

            rhythm_idx = i % len(pattern)
            time_offset = pattern[rhythm_idx] * beat_duration

            events.append(create_formation_enemy(
                time=spawn_time + time_offset,
                y_pos=y_pos,
                velocity_x=base_velocity,
                size=0.4 + section_energy * 0.15,
                group_id=f"beat_{beat_idx:03d}",
                formation_type=formation_type
            ))

    return events


def create_formation_enemy(time, y_pos, velocity_x, size, group_id, formation_type):
    """Create a single enemy spawn event for a formation."""
    return {
        "time": float(time),
        "note": "C4",
        "y_position": float(y_pos),
        "enemy_type": "circle",
        "size": float(min(0.8, size)),
        "motion": {
            "type": "linear",
            "center_y": float(y_pos),
            "amplitude": 0.02,
            "frequency": 0.5
        },
        "velocity": {"x": float(velocity_x), "y": 0},
        "group_id": group_id,
        "formation_type": formation_type,
        "is_drop": False
    }


def generate_spawn_events(phrases, sections, drops, tempo, beat_times):
    """Generate spawn events using BEAT-DRIVEN formation approach.

    Primary loop is over beat_times, not phrases.
    Spawns formations ON THE BEAT so everything syncs with the music.
    Uses phrases only to determine formation SHAPE, not timing.
    """
    print("Generating beat-driven spawn events...")

    events = []

    # Track formations for repeated phrases
    phrase_formations = {}  # original_id -> formation_type

    # Convert drops to a set of times to skip (don't spawn formations during drops)
    drop_times = set()
    for drop in drops:
        drop_time = drop["time"]
        # Skip beats within 1 second of a drop
        for bt in beat_times:
            if abs(bt - drop_time) < 1.0:
                drop_times.add(bt)

    formations_spawned = 0

    # Primary loop: iterate over BEATS, not phrases
    for beat_idx, beat_time in enumerate(beat_times):
        # Skip beats near drops (drops have their own spawning)
        if beat_time in drop_times:
            continue

        # Get section for this beat
        section = get_section_for_time(sections, beat_time)
        section_energy = section.get("energy", 0.5) if section else 0.5

        # Calculate spawn interval based on energy
        spawn_interval = calculate_spawn_interval(section_energy)

        # Only spawn on every Nth beat based on energy
        if beat_idx % spawn_interval != 0:
            continue

        # Find the phrase active at this beat (for formation shape)
        phrase = get_phrase_for_time(phrases, beat_time)

        # Determine formation type from phrase
        if phrase:
            if phrase.get("is_repeat") and phrase.get("original_id") in phrase_formations:
                # Use same formation as original phrase
                formation_type = phrase_formations[phrase["original_id"]]
            else:
                # Map phrase type to formation
                phrase_type = phrase.get("type", "motif")
                formation_type = PHRASE_TO_FORMATION.get(phrase_type, "horizontal_line")

                # Store for repeats
                if phrase.get("id"):
                    phrase_formations[phrase["id"]] = formation_type
        else:
            # No phrase at this beat - use default
            formation_type = "horizontal_line"

        # Generate formation at this BEAT time
        formation_events = generate_formation(
            formation_type, beat_time, section_energy, beat_idx, phrase, tempo
        )
        events.extend(formation_events)
        formations_spawned += 1

    # Generate drop formations (these already work well - keep as-is)
    for drop in drops:
        drop_events = generate_drop_formation(drop)
        events.extend(drop_events)

    # Sort by time
    events.sort(key=lambda e: e["time"])

    print(f"  Generated {len(events)} spawn events from {formations_spawned} formations on {len(beat_times)} beats")

    return events


def generate_drop_formation(drop):
    """Generate spawn events for a drop moment (kept from original - works well)."""
    events = []

    drop_time = drop["time"]
    enemy_count = drop.get("enemy_count", 10)
    formation = drop.get("formation", "burst")
    magnitude = drop.get("magnitude", 0.8)

    spawn_duration = 0.3

    if formation == "burst":
        for i in range(enemy_count):
            angle = (i / enemy_count) * 2 * np.pi
            start_x = 0.5 + 0.6 * np.cos(angle)
            start_y = 0.5 + 0.6 * np.sin(angle)
            spawn_time = drop_time + (i / enemy_count) * spawn_duration

            events.append({
                "time": float(spawn_time),
                "note": "C4",
                "y_position": float(start_y),
                "enemy_type": "triangle",
                "size": float(0.6 + magnitude * 0.3),
                "motion": {
                    "type": "converge",
                    "start_x": float(start_x),
                    "start_y": float(start_y),
                    "target_x": 0.5,
                    "target_y": 0.5,
                    "speed": float(300 + magnitude * 200)
                },
                "velocity": {"x": float(-np.cos(angle) * 200), "y": float(-np.sin(angle) * 200)},
                "group_id": drop["id"],
                "group_role": "accent",
                "is_drop": True
            })

    elif formation == "wave":
        for i in range(enemy_count):
            y_pos = 0.1 + (i / (enemy_count - 1)) * 0.8 if enemy_count > 1 else 0.5
            spawn_time = drop_time + (i / enemy_count) * spawn_duration

            events.append({
                "time": float(spawn_time),
                "note": "E4",
                "y_position": float(y_pos),
                "enemy_type": "square",
                "size": float(0.5 + magnitude * 0.4),
                "motion": {
                    "type": "linear",
                    "start_y": float(y_pos),
                    "end_y": float(y_pos)
                },
                "velocity": {"x": float(-250 - magnitude * 100), "y": 0},
                "group_id": drop["id"],
                "group_role": "follow",
                "is_drop": True
            })

    elif formation == "converge":
        corners = [(0.1, 0.1), (0.9, 0.1), (0.1, 0.9), (0.9, 0.9)]
        per_corner = enemy_count // 4

        for corner_idx, (cx, cy) in enumerate(corners):
            for i in range(per_corner):
                spawn_time = drop_time + (i / per_corner) * spawn_duration

                events.append({
                    "time": float(spawn_time),
                    "note": "G4",
                    "y_position": float(cy),
                    "enemy_type": "triangle",  # Changed from hexagon - hexagon is special bouncing enemy
                    "size": float(0.5 + magnitude * 0.3),
                    "motion": {
                        "type": "converge",
                        "start_x": float(cx),
                        "start_y": float(cy),
                        "target_x": 0.5,
                        "target_y": 0.5,
                        "speed": float(250 + magnitude * 150)
                    },
                    "velocity": {"x": float((0.5 - cx) * 200), "y": float((0.5 - cy) * 200)},
                    "group_id": drop["id"],
                    "group_role": "accent",
                    "is_drop": True
                })

    else:  # spiral
        for i in range(enemy_count):
            angle = (i / enemy_count) * 4 * np.pi
            radius = 0.3 + (i / enemy_count) * 0.3
            start_x = 0.5 + radius * np.cos(angle)
            start_y = 0.5 + radius * np.sin(angle)
            spawn_time = drop_time + (i / enemy_count) * spawn_duration

            events.append({
                "time": float(spawn_time),
                "note": "A4",
                "y_position": float(start_y),
                "enemy_type": "circle",
                "size": float(0.4 + magnitude * 0.4),
                "motion": {
                    "type": "spiral_in",
                    "center_x": 0.5,
                    "center_y": 0.5,
                    "start_radius": float(radius),
                    "rotations": 2.0
                },
                "velocity": {"x": float(-150), "y": 0},
                "group_id": drop["id"],
                "group_role": "follow",
                "is_drop": True
            })

    return events


# =============================================================================
# MAIN AUTHORING PIPELINE
# =============================================================================

def get_role_for_time(roles_over_time, time):
    """Get the instrument role for a specific time."""
    for role_info in reversed(roles_over_time):
        if role_info["time"] <= time:
            return role_info["role"]
    return "lead"


def author_level(audio_path, output_path=None):
    """Main authoring pipeline - transforms audio into authored level."""
    print(f"\n{'='*60}")
    print(f"MUSICAL LEVEL AUTHORING PIPELINE (Beat-Driven Formations)")
    print(f"{'='*60}\n")

    if not DEPENDENCIES_INSTALLED:
        print("ERROR: Required dependencies not installed.")
        print("Please run: pip install librosa numpy scipy")
        return None

    # Step 1: Load audio
    y, sr, duration = load_audio(audio_path)

    # Step 2: Extract basic features
    features = extract_basic_features(y, sr)

    # Step 3: Extract frequency bands
    freq_bands = extract_frequency_bands(y, sr)

    # Step 4: Calculate onset sharpness
    onset_sharpness = calculate_onset_sharpness(y, sr, features["onset_times"])

    # Step 5: Infer instrument roles
    roles_over_time = infer_instrument_roles(freq_bands, onset_sharpness)

    # Step 6: Detect sections
    sections = detect_sections(features["rms"], features["rms_times"], duration)

    # Step 7: Detect drops
    drops = detect_drops(features["rms"], features["rms_times"], freq_bands)

    # Step 8: Extract notes
    notes = extract_notes(features["pitches"], features["magnitudes"], sr)

    # Step 9: Detect phrases
    phrases = detect_phrases(notes, features["beat_times"], features["tempo"])
    phrases = detect_repeating_phrases(phrases)

    # Step 10: Generate formation-based spawn events
    spawn_events = generate_spawn_events(
        phrases, sections, drops, features["tempo"], features["beat_times"]
    )

    # Step 11: Assemble final level
    level = {
        "version": "2.1",  # Added beat_times for client beat-sync
        "metadata": {
            "song_id": Path(audio_path).stem,
            "filename": Path(audio_path).name,
            "duration": float(duration),
            "tempo": float(features["tempo"]),
            "authored_date": datetime.now().isoformat(),
            "total_spawn_events": len(spawn_events),
            "total_phrases": len(phrases),
            "total_drops": len(drops),
            "total_sections": len(sections),
            "total_beats": len(features["beat_times"]),
            "spawn_approach": "beat-driven-formations"
        },
        "beat_times": features["beat_times"],  # For client beat-sync effects
        "sections": sections,
        "drops": drops,
        "phrases": [
            {
                "id": p.get("id", f"phrase_{i:03d}"),
                "type": p["type"],
                "start": p["start"],
                "end": p["end"],
                "instrument_role": get_role_for_time(roles_over_time, p["start"]),
                "is_repeat": p.get("is_repeat", False),
                "note_count": len(p.get("notes", []))
            }
            for i, p in enumerate(phrases)
        ],
        "formation_shapes": list(FORMATION_SHAPES.keys()),
        "spawn_events": spawn_events
    }

    # Save to file
    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(level, f, indent=2, ensure_ascii=False)
        print(f"\n{'='*60}")
        print(f"Level authored successfully!")
        print(f"Output: {output_path}")
        print(f"Spawn events: {len(spawn_events)} (target: 150-300 for 4min song)")
        print(f"{'='*60}\n")

    return level


# =============================================================================
# COMMAND LINE INTERFACE
# =============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Author a game level from audio analysis (beat-driven formations)"
    )
    parser.add_argument("input_file", help="Input audio file (MP3, WAV, etc.)")
    parser.add_argument("output_file", nargs="?", help="Output JSON file (optional)")

    args = parser.parse_args()

    if not args.output_file:
        input_path = Path(args.input_file)
        args.output_file = str(input_path.with_suffix('.level.json'))

    author_level(args.input_file, args.output_file)
