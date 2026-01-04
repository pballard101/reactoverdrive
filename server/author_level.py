#!/usr/bin/env python3
"""
Musical Level Authoring Pipeline

This script transforms raw audio analysis into an explicit, deterministic level description.
The runtime engine receives a fully-authored level file and simply schedules/plays it.

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

# Instrument separation using Demucs (PyTorch-based, works on ARM/M1)
# Set to True to enable guitar stem analysis for solo detection
INSTRUMENT_SEPARATION_ENABLED = True

# Try to import demucs
DEMUCS_AVAILABLE = False
try:
    import demucs.api
    DEMUCS_AVAILABLE = True
except ImportError:
    try:
        import demucs.separate
        DEMUCS_AVAILABLE = True
    except ImportError:
        print("Warning: Demucs not installed. Falling back to high-density detection.")
        INSTRUMENT_SEPARATION_ENABLED = False


# =============================================================================
# CONSTANTS AND CONFIGURATION
# =============================================================================

MOTION_PROFILES = {
    "linear": {
        "type": "linear",
        "description": "Straight line movement"
    },
    "sine_wave": {
        "type": "sine_wave",
        "description": "Oscillating up and down"
    },
    "arc_ascending": {
        "type": "arc",
        "description": "Parabolic arc upward"
    },
    "arc_descending": {
        "type": "arc",
        "description": "Parabolic arc downward"
    },
    "hold_release": {
        "type": "hold_release",
        "description": "Stationary then sudden move"
    },
    "bounce": {
        "type": "bounce",
        "description": "Bouncing motion with decay"
    }
}

INSTRUMENT_ROLES = {
    "bass": {"freq_range": (20, 250), "vertical_zone": (0.7, 1.0)},
    "percussion": {"freq_range": (2000, 8000), "vertical_zone": (0.3, 0.7)},
    "lead": {"freq_range": (250, 2000), "vertical_zone": (0.1, 0.5)},
    "pad": {"freq_range": (100, 1000), "vertical_zone": (0.4, 0.8)}
}

PHRASE_MOTION_MAPPING = {
    "run_ascending": {"profile": "linear", "start_y": 0.7, "end_y": 0.3},
    "run_descending": {"profile": "linear", "start_y": 0.3, "end_y": 0.7},
    "riff": {"profile": "sine_wave", "amplitude": 0.05, "frequency": 0.8},
    "arpeggio": {"profile": "arc_ascending", "amplitude": 0.07},
    "chord_stab": {"profile": "hold_release", "hold_ratio": 0.7},
    "call_response": {"profile": "bounce", "amplitude": 0.06, "frequency": 0.6, "decay": 0.5},
    "motif": {"profile": "sine_wave", "amplitude": 0.04, "frequency": 0.7},
    "single": {"profile": "linear", "start_y": 0.5, "end_y": 0.5}
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
        # Find frequency bins in this range
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


def separate_instruments(audio_path, output_dir="/tmp/stems_output"):
    """Separate audio into instrument stems using Demucs.

    Demucs separates audio into: drums, bass, vocals, other (guitar/keys/synths)
    We analyze the 'other' stem for guitar solo detection.

    Returns dict with stem data or None if separation fails/disabled.
    """
    if not INSTRUMENT_SEPARATION_ENABLED or not DEMUCS_AVAILABLE:
        print("Instrument separation disabled, using high-density detection")
        return None

    print("Separating instruments with Demucs...")

    try:
        import subprocess
        from pathlib import Path

        # Create output directory
        os.makedirs(output_dir, exist_ok=True)

        # Get the song name (without extension)
        song_name = Path(audio_path).stem

        # Run demucs command-line tool
        # Using htdemucs model which gives: drums, bass, other, vocals
        cmd = [
            sys.executable, "-m", "demucs",
            "-n", "htdemucs",
            "-o", output_dir,
            "--two-stems", "no_vocals",  # Just separate vocals from instruments
            audio_path
        ]

        print(f"  Running: {' '.join(cmd[:5])}...")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )

        if result.returncode != 0:
            print(f"  Demucs failed: {result.stderr[:200]}")
            # Try alternative approach - full 4-stem separation
            cmd = [
                sys.executable, "-m", "demucs",
                "-n", "htdemucs",
                "-o", output_dir,
                audio_path
            ]
            print("  Trying full stem separation...")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            if result.returncode != 0:
                print(f"  Demucs failed again: {result.stderr[:200]}")
                return None

        # Find the output stems
        # Demucs outputs to: output_dir/htdemucs/song_name/stem.wav
        stem_dir = Path(output_dir) / "htdemucs" / song_name

        if not stem_dir.exists():
            print(f"  Stem directory not found: {stem_dir}")
            return None

        stems = {}
        for stem_file in stem_dir.glob("*.wav"):
            stem_name = stem_file.stem  # drums, bass, vocals, other, or no_vocals/vocals
            print(f"  Loading stem: {stem_name}")

            y, sr = librosa.load(str(stem_file), sr=None)
            rms = librosa.feature.rms(y=y)[0]
            times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)

            stems[stem_name] = {
                'audio': y,
                'sr': sr,
                'rms': rms,
                'times': times
            }

        print(f"  Loaded {len(stems)} stems: {list(stems.keys())}")
        return stems if stems else None

    except subprocess.TimeoutExpired:
        print("  Demucs timed out (>5 minutes)")
        return None
    except Exception as e:
        print(f"  Demucs error: {e}")
        return None


def detect_instrument_dominance(stems, duration):
    """Detect which instrument is dominant at each point in the song.

    Returns a list of sections where a specific instrument is dominant.
    """
    if not stems:
        return []

    print("Detecting instrument dominance...")

    # Debug: Check stem data
    for stem_name, stem_data in stems.items():
        rms = stem_data['rms']
        print(f"  DEBUG {stem_name}: min={np.min(rms):.4f} max={np.max(rms):.4f} mean={np.mean(rms):.4f}")

    sections = []
    window_size = 1.0  # 1-second analysis windows
    current_dominant = None
    section_start = 0

    t = 0.0
    while t < duration:
        # Get energy for each stem in this window
        energies = {}
        for stem_name, stem_data in stems.items():
            times = stem_data['times']
            rms = stem_data['rms']

            # Find RMS values in this time window
            mask = (times >= t) & (times < t + window_size)
            if np.any(mask):
                energies[stem_name] = float(np.mean(rms[mask]))
            else:
                energies[stem_name] = 0.0

        total_energy = sum(energies.values())
        if total_energy < 0.001:  # Silence
            t += window_size
            continue

        # Find dominant instrument (>40% of total energy)
        dominant = None
        max_ratio = 0
        for stem_name, energy in energies.items():
            ratio = energy / total_energy
            if ratio > max_ratio:
                max_ratio = ratio
                if ratio > 0.40:  # Must be >40% to be considered dominant
                    dominant = stem_name

        # Track section changes
        if dominant != current_dominant:
            if current_dominant is not None and t > section_start + 1.0:
                sections.append({
                    'start': section_start,
                    'end': t,
                    'instrument': current_dominant,
                    'intensity': max_ratio
                })
            current_dominant = dominant
            section_start = t

        t += window_size

    # Add final section
    if current_dominant is not None and duration > section_start + 1.0:
        sections.append({
            'start': section_start,
            'end': duration,
            'instrument': current_dominant,
            'intensity': max_ratio
        })

    # Merge adjacent sections with same instrument
    merged = []
    for section in sections:
        if merged and merged[-1]['instrument'] == section['instrument']:
            merged[-1]['end'] = section['end']
        else:
            merged.append(section)

    # Filter to only significant sections (>2 seconds)
    result = [s for s in merged if s['end'] - s['start'] >= 2.0]

    print(f"  Found {len(result)} instrument-dominant sections")
    for s in result[:10]:  # Print first 10
        print(f"    {s['start']:.1f}s-{s['end']:.1f}s: {s['instrument']} ({s['intensity']:.0%})")

    return result


def calculate_onset_sharpness(y, sr, onset_times):
    """Calculate how sharp/percussive each onset is."""
    print("Calculating onset sharpness...")

    hop_length = 512
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    onset_env_times = librosa.times_like(onset_env, sr=sr, hop_length=hop_length)

    sharpness_values = []
    for onset_time in onset_times:
        # Find nearest index
        idx = np.argmin(np.abs(onset_env_times - onset_time))

        # Calculate sharpness as ratio of peak to surrounding values
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
    """
    Analyze time windows and assign instrument roles based on frequency content.
    """
    print("Inferring instrument roles...")

    times = freq_bands["times"]
    duration = times[-1] if len(times) > 0 else 0

    roles_over_time = []

    t = 0
    while t < duration:
        # Get indices for this window
        window_mask = (times >= t) & (times < t + window_size)

        if not np.any(window_mask):
            t += hop_size
            continue

        # Calculate energy in each band for this window
        bass_energy = np.mean(freq_bands["bands"]["bass"][window_mask])
        low_mid_energy = np.mean(freq_bands["bands"]["low_mid"][window_mask])
        mid_energy = np.mean(freq_bands["bands"]["mid"][window_mask])
        upper_mid_energy = np.mean(freq_bands["bands"]["upper_mid"][window_mask])
        presence_energy = np.mean(freq_bands["bands"]["presence"][window_mask])

        # Get onset sharpness for this window
        window_onsets = [o for o in onset_sharpness if t <= o["time"] < t + window_size]
        avg_sharpness = np.mean([o["sharpness"] for o in window_onsets]) if window_onsets else 0.3

        # Score each role
        scores = {}

        # Bass: High low-frequency energy, soft onsets
        total_energy = bass_energy + mid_energy + presence_energy + 0.001
        scores["bass"] = (bass_energy / total_energy * 0.6 + (1.0 - avg_sharpness) * 0.4)

        # Percussion: Sharp onsets, high-frequency content
        scores["percussion"] = (avg_sharpness * 0.7 + presence_energy / total_energy * 0.3)

        # Lead: Mid-frequency dominance
        scores["lead"] = (mid_energy / total_energy * 0.5 + upper_mid_energy / total_energy * 0.3 + avg_sharpness * 0.2)

        # Pad: Sustained energy, low onset sharpness
        scores["pad"] = ((1.0 - avg_sharpness) * 0.6 + low_mid_energy / total_energy * 0.4)

        # Find dominant role
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

    # Normalize and smooth energy
    max_energy = np.max(rms) if np.max(rms) > 0 else 1
    norm_energy = rms / max_energy
    smoothed = median_filter(norm_energy, size=15)
    smoothed = median_filter(smoothed, size=9)

    # Calculate thresholds
    avg_energy = np.mean(smoothed)
    high_threshold = avg_energy * 1.4
    low_threshold = avg_energy * 0.6

    # Find change points
    window_size = max(30, min(int(len(norm_energy) * 0.04), 60))
    change_threshold = 0.35 * avg_energy
    min_segment_duration = 10  # seconds
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

    # Create sections
    sections = []
    for i in range(len(change_points) - 1):
        start_idx = change_points[i]
        end_idx = change_points[i + 1]

        start_time = float(rms_times[start_idx])
        end_time = float(rms_times[end_idx])

        # Calculate average energy for this section
        section_energy = float(np.mean(smoothed[start_idx:end_idx + 1]))

        # Determine section type
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

        # Determine intensity curve
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

    # Smooth energy profile
    smoothed = median_filter(rms, size=10)

    # Calculate energy derivative
    energy_derivative = np.gradient(smoothed)

    # Find peaks in the derivative (rapid increases)
    avg_energy = np.mean(smoothed)
    max_energy = np.max(smoothed)

    drops = []
    min_gap_samples = int(4.0 * len(rms_times) / (rms_times[-1] if len(rms_times) > 0 else 1))

    for i in range(20, len(smoothed) - 20):
        current_energy = smoothed[i]

        # Check for local minimum followed by rapid increase
        is_local_min = (
            smoothed[i] < smoothed[i-1] and
            smoothed[i] < smoothed[i+1]
        )

        if is_local_min:
            # Look ahead for energy spike
            future_window = smoothed[i:min(i+30, len(smoothed))]
            if len(future_window) > 5:
                max_future = np.max(future_window)
                energy_jump = max_future - current_energy

                # Significant jump threshold
                if energy_jump > avg_energy * 0.5:
                    # Check if too close to previous drop
                    if drops and (i - drops[-1]["_index"]) < min_gap_samples:
                        continue

                    # Find exact drop moment
                    drop_offset = np.argmax(energy_derivative[i:i+30])
                    drop_idx = i + drop_offset
                    drop_time = float(rms_times[drop_idx]) if drop_idx < len(rms_times) else float(rms_times[-1])

                    # Calculate magnitude
                    magnitude = min(1.0, energy_jump / max_energy) if max_energy > 0 else 0.5

                    # Calculate pre-drop silence
                    pre_silence = 0.0
                    for j in range(i-1, max(0, i-30), -1):
                        if smoothed[j] < avg_energy * 0.3:
                            pre_silence = float(rms_times[i] - rms_times[j])
                            break

                    # Calculate spectral fullness at drop
                    spectral_fullness = calculate_spectral_fullness(freq_bands, drop_idx)

                    # Determine formation type based on characteristics
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
                        "_index": drop_idx  # Internal use for gap checking
                    })

    # Remove internal index
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

    # Get average energy across all bands at this time
    all_energies = [band[time_idx] if time_idx < len(band) else 0 for band in freq_bands["bands"].values()]
    threshold = np.mean(all_energies) * 0.5 if all_energies else 0

    for band_energy in freq_bands["bands"].values():
        if time_idx < len(band_energy) and band_energy[time_idx] > threshold:
            active_bands += 1

    return active_bands / total_bands if total_bands > 0 else 0.5


# =============================================================================
# SOLO DETECTION
# =============================================================================

def detect_solo_sections(rms, rms_times, freq_bands, onset_sharpness, duration):
    """Identify solo/lead sections based on musical characteristics."""
    print("Detecting solo sections...")

    solos = []
    window_size = 4.0  # 4-second analysis windows
    hop_size = 1.0

    avg_energy = np.mean(rms)

    t = 0
    while t < duration - window_size:
        # Get time indices for this window
        window_mask = (rms_times >= t) & (rms_times < t + window_size)
        band_mask = (freq_bands["times"] >= t) & (freq_bands["times"] < t + window_size)

        if not np.any(window_mask) or not np.any(band_mask):
            t += hop_size
            continue

        # Metric 1: Mid-frequency density
        mid_energy = np.mean(freq_bands["bands"]["mid"][band_mask])
        upper_mid_energy = np.mean(freq_bands["bands"]["upper_mid"][band_mask])
        total_band_energy = sum(np.mean(b[band_mask]) for b in freq_bands["bands"].values())

        density_score = (mid_energy + upper_mid_energy) / (total_band_energy + 0.001)
        density_score = min(1.0, density_score * 2)

        # Metric 2: Energy level (solos tend to be high energy)
        window_energy = np.mean(rms[window_mask])
        energy_score = min(1.0, window_energy / (avg_energy * 1.5)) if avg_energy > 0 else 0.5

        # Metric 3: Onset sharpness in window (solos have varied articulation)
        window_onsets = [o for o in onset_sharpness if t <= o["time"] < t + window_size]
        if len(window_onsets) >= 3:
            sharpness_values = [o["sharpness"] for o in window_onsets]
            sharpness_variance = np.var(sharpness_values)
            variance_score = min(1.0, sharpness_variance * 10)
        else:
            variance_score = 0.3

        # Metric 4: Percussion suppression
        perc_energy = np.mean(freq_bands["bands"]["presence"][band_mask])
        bass_energy = np.mean(freq_bands["bands"]["bass"][band_mask])
        perc_ratio = perc_energy / (bass_energy + mid_energy + 0.001)
        perc_suppression = max(0, 1.0 - perc_ratio * 2)

        # Combine scores
        solo_likelihood = (
            density_score * 0.30 +
            energy_score * 0.25 +
            variance_score * 0.25 +
            perc_suppression * 0.20
        )

        if solo_likelihood > 0.55:
            solos.append({
                "start": float(t),
                "end": float(t + window_size),
                "confidence": float(solo_likelihood)
            })

        t += hop_size

    # Merge adjacent solo windows
    merged_solos = merge_adjacent_sections(solos, gap_threshold=2.0)

    # Format output
    result = []
    for i, solo in enumerate(merged_solos):
        result.append({
            "id": f"solo_{i:03d}",
            "start": solo["start"],
            "end": solo["end"],
            "intensity": solo.get("confidence", 0.7),
            "phrase_density": "high",
            "motion_complexity": "expressive",
            "spawn_pattern": "continuous_wave"
        })

    print(f"  Found {len(result)} solo sections")

    return result


def detect_guitar_solos_from_stems(stems, duration, min_duration=2.0):
    """Detect guitar solos by analyzing the 'other' stem (guitar/keys/synths).

    Uses relative RMS energy to find sections where the guitar stem has
    unusually high activity compared to its own baseline.

    This is more accurate than note density because it looks at the actual
    guitar audio rather than the mixed signal.

    Args:
        stems: Dict of stem data from separate_instruments()
        duration: Song duration in seconds
        min_duration: Minimum solo duration in seconds

    Returns:
        List of guitar solo sections
    """
    if not stems:
        return []

    # Find the guitar stem - could be 'other' (4-stem) or 'no_vocals' (2-stem)
    guitar_stem = None
    for name in ['other', 'no_vocals']:
        if name in stems:
            guitar_stem = stems[name]
            print(f"Detecting guitar solos from '{name}' stem...")
            break

    if guitar_stem is None:
        print("  No guitar stem found, skipping guitar solo detection")
        return []

    rms = guitar_stem['rms']
    times = guitar_stem['times']

    # Calculate the song's baseline guitar activity using relative thresholds
    avg_rms = np.mean(rms)
    std_rms = np.std(rms)
    max_rms = np.max(rms)

    # Solo threshold: guitar activity significantly above its own average
    # Use mean + 1.5*std as "active enough to be a solo"
    solo_threshold = avg_rms + 1.5 * std_rms

    # Also require at least 60% of max to catch actual peaks
    solo_threshold = max(solo_threshold, max_rms * 0.6)

    print(f"  Guitar RMS: avg={avg_rms:.4f}, max={max_rms:.4f}, threshold={solo_threshold:.4f}")

    # Find sections where guitar activity exceeds threshold
    solo_sections = []
    in_solo = False
    solo_start = 0.0

    for t, r in zip(times, rms):
        if r > solo_threshold and not in_solo:
            # Starting a potential solo
            in_solo = True
            solo_start = t
        elif r <= solo_threshold and in_solo:
            # Ending a potential solo
            in_solo = False
            if t - solo_start >= min_duration:
                # Calculate average intensity for this section
                mask = (times >= solo_start) & (times < t)
                section_rms = rms[mask]
                intensity = float(np.mean(section_rms) / max_rms) if max_rms > 0 else 0.5

                solo_sections.append({
                    "id": f"guitar_solo_{len(solo_sections):03d}",
                    "start": float(solo_start),
                    "end": float(t),
                    "intensity": intensity,
                    "type": "guitar_solo"
                })

    # Handle case where song ends during a solo
    if in_solo and duration - solo_start >= min_duration:
        mask = (times >= solo_start)
        section_rms = rms[mask]
        intensity = float(np.mean(section_rms) / max_rms) if max_rms > 0 else 0.5

        solo_sections.append({
            "id": f"guitar_solo_{len(solo_sections):03d}",
            "start": float(solo_start),
            "end": float(duration),
            "intensity": intensity,
            "type": "guitar_solo"
        })

    print(f"  Found {len(solo_sections)} guitar solo sections")
    for s in solo_sections:
        print(f"    {s['start']:.1f}s - {s['end']:.1f}s (intensity: {s['intensity']:.2f})")

    return solo_sections


def detect_high_density_sections(notes, tempo, min_duration=2.0):
    """Detect sections with high note density (potential solos/leads).

    FALLBACK: Only used when instrument separation is unavailable.

    Uses RELATIVE note density compared to the song's average to identify
    lead/solo sections. This prevents falsely detecting busy songs as all-solo.
    """
    if not notes:
        return []

    print("Detecting high-density note sections...")

    window_size = 2.0  # 2-second windows
    hop_size = 0.5

    sorted_notes = sorted(notes, key=lambda n: n["time"])
    if not sorted_notes:
        return []

    duration = sorted_notes[-1]["time"]

    # First pass: calculate density for each window to find song's baseline
    all_densities = []
    t = 0
    while t < duration - window_size:
        window_notes = [n for n in sorted_notes if t <= n["time"] < t + window_size]
        note_density = len(window_notes) / window_size
        all_densities.append((t, note_density))
        t += hop_size

    if not all_densities:
        return []

    # Calculate relative thresholds based on song's characteristics
    densities_only = [d[1] for d in all_densities]
    avg_density = np.mean(densities_only)
    std_density = np.std(densities_only)
    max_density = np.max(densities_only)

    # High-density threshold: must be significantly above average
    # Use mean + 1.5*std, but at least 50% above average
    relative_threshold = max(avg_density * 1.5, avg_density + 1.5 * std_density)
    # Also must be at least 60% of the max density to catch actual peaks
    relative_threshold = max(relative_threshold, max_density * 0.6)

    print(f"  Song density: avg={avg_density:.1f}/s, max={max_density:.1f}/s, threshold={relative_threshold:.1f}/s")

    high_density_sections = []
    for t, note_density in all_densities:
        if note_density >= relative_threshold:
            window_notes = [n for n in sorted_notes if t <= n["time"] < t + window_size]

            # Calculate pitch variance to determine movement type
            pitches = [n.get("midi", 60) for n in window_notes]
            pitch_variance = np.var(pitches) if len(pitches) > 1 else 0

            # Determine if this is a fast run or melodic section
            movement_type = "smooth" if pitch_variance < 8 else "melodic"

            # Calculate intensity relative to song's range
            intensity = (note_density - avg_density) / (max_density - avg_density) if max_density > avg_density else 0.5

            high_density_sections.append({
                "start": float(t),
                "end": float(t + window_size),
                "confidence": min(1.0, intensity),
                "note_density": float(note_density),
                "pitch_variance": float(pitch_variance),
                "movement_type": movement_type
            })

    # Merge adjacent high-density windows
    merged = merge_adjacent_sections(high_density_sections, gap_threshold=1.0)

    result = []
    for i, section in enumerate(merged):
        result.append({
            "id": f"high_density_{i:03d}",
            "start": section["start"],
            "end": section["end"],
            "intensity": section.get("confidence", 0.7),
            "note_density": section.get("note_density", 8.0),
            "pitch_variance": section.get("pitch_variance", 5.0),
            "movement_type": section.get("movement_type", "melodic"),
            "spawn_pattern": "rapid_fire"
        })

    print(f"  Found {len(result)} high-density sections")
    return result


def merge_adjacent_sections(sections, gap_threshold=2.0):
    """Merge adjacent sections that are close together."""
    if not sections:
        return []

    # Sort by start time
    sorted_sections = sorted(sections, key=lambda x: x["start"])

    merged = [sorted_sections[0].copy()]

    for section in sorted_sections[1:]:
        last = merged[-1]

        # Check if this section is close enough to merge
        if section["start"] - last["end"] <= gap_threshold:
            # Extend the last section
            last["end"] = section["end"]
            # Average the confidence
            if "confidence" in section and "confidence" in last:
                last["confidence"] = (last["confidence"] + section["confidence"]) / 2
        else:
            merged.append(section.copy())

    return merged


# =============================================================================
# NOTE AND PHRASE EXTRACTION
# =============================================================================

def extract_notes(pitches, magnitudes, sr, hop_length=512):
    """Extract notes from pitch tracking data."""
    print("Extracting notes...")

    notes = []
    last_note_time = {}

    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    for t in range(pitches.shape[1]):
        # Get pitches with significant magnitude
        pitch_values = pitches[:, t]
        mag_values = magnitudes[:, t]

        # Find the strongest pitch
        max_idx = np.argmax(mag_values)
        if pitch_values[max_idx] > 0 and mag_values[max_idx] > 0.1:
            freq = pitch_values[max_idx]

            # Convert frequency to note
            try:
                note_name = librosa.hz_to_note(freq)
                note_time = librosa.frames_to_time(t, sr=sr, hop_length=hop_length)

                # Filter out near-duplicates (same note within 50ms)
                base_note = note_name[:-1] if note_name[-1].isdigit() else note_name
                if base_note not in last_note_time or (note_time - last_note_time[base_note]) > 0.05:
                    notes.append({
                        "time": float(note_time),
                        "note": note_name,
                        "frequency": float(freq),
                        "magnitude": float(mag_values[max_idx])
                    })
                    last_note_time[base_note] = note_time
            except:
                pass

    print(f"  Extracted {len(notes)} notes")

    return notes


def detect_phrases(notes, beat_times, tempo):
    """Group notes into musical phrases."""
    print("Detecting phrases...")

    if not notes:
        return []

    phrases = []
    current_phrase_notes = []
    last_note_time = 0

    # Gap threshold based on tempo
    beat_duration = 60 / tempo if tempo > 0 else 0.5
    gap_threshold = beat_duration * 1.5

    for note in notes:
        gap = note["time"] - last_note_time

        if gap > gap_threshold and current_phrase_notes:
            # End current phrase
            phrase_type = analyze_phrase_type(current_phrase_notes)
            motion = PHRASE_MOTION_MAPPING.get(phrase_type, PHRASE_MOTION_MAPPING["motif"])

            phrases.append({
                "notes": current_phrase_notes,
                "type": phrase_type,
                "motion": motion,
                "start": current_phrase_notes[0]["time"],
                "end": current_phrase_notes[-1]["time"]
            })
            current_phrase_notes = []

        current_phrase_notes.append(note)
        last_note_time = note["time"]

    # Don't forget the last phrase
    if current_phrase_notes:
        phrase_type = analyze_phrase_type(current_phrase_notes)
        motion = PHRASE_MOTION_MAPPING.get(phrase_type, PHRASE_MOTION_MAPPING["motif"])

        phrases.append({
            "notes": current_phrase_notes,
            "type": phrase_type,
            "motion": motion,
            "start": current_phrase_notes[0]["time"],
            "end": current_phrase_notes[-1]["time"]
        })

    print(f"  Found {len(phrases)} phrases")

    return phrases


def note_to_midi(note_name):
    """Convert note name to MIDI number."""
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    # Normalize note name - replace unicode sharp/flat with ASCII
    note_name = note_name.replace('♯', '#').replace('♭', 'b')

    # Parse note name (e.g., "C4", "F#5")
    if len(note_name) >= 2:
        if note_name[1] == '#' or note_name[1] == 'b':
            base_note = note_name[:2]
            octave_str = note_name[2:] if len(note_name) > 2 else '4'
        else:
            base_note = note_name[0]
            octave_str = note_name[1:] if len(note_name) > 1 else '4'

        # Parse octave, handling edge cases
        try:
            octave = int(octave_str) if octave_str else 4
        except ValueError:
            octave = 4  # Default octave if parsing fails

        # Handle flats by converting to sharps
        if 'b' in base_note:
            idx = note_names.index(base_note[0])
            base_note = note_names[(idx - 1) % 12]

        try:
            note_idx = note_names.index(base_note.replace('b', '').upper())
            return octave * 12 + note_idx
        except ValueError:
            return 60  # Default to middle C

    return 60


def analyze_phrase_type(notes):
    """Determine the type of phrase based on pitch and rhythm patterns."""
    if len(notes) < 2:
        return "single"

    # Get MIDI pitches
    pitches = [note_to_midi(n["note"]) for n in notes]

    # Calculate intervals
    intervals = [pitches[i+1] - pitches[i] for i in range(len(pitches)-1)]

    # Check for ascending run
    if len(intervals) >= 3 and all(d > 0 for d in intervals):
        return "run_ascending"

    # Check for descending run
    if len(intervals) >= 3 and all(d < 0 for d in intervals):
        return "run_descending"

    # Check for arpeggio (intervals of 3-4 semitones)
    if len(intervals) >= 2:
        arpeggio_intervals = [3, 4, 5]  # Minor third, major third, perfect fourth
        is_arpeggio = all(abs(i) in arpeggio_intervals for i in intervals)
        if is_arpeggio:
            return "arpeggio"

    # Check for repeating pattern (riff)
    if len(pitches) >= 4:
        half = len(pitches) // 2
        first_half = pitches[:half]
        second_half = pitches[half:half*2]
        if first_half == second_half:
            return "riff"

    # Check for chord stab (all same pitch)
    if len(set(pitches)) == 1:
        return "chord_stab"

    # Default to motif
    return "motif"


def detect_repeating_phrases(phrases):
    """Identify phrases that repeat and mark them."""
    print("Detecting repeating phrases...")

    phrase_signatures = {}
    repeat_count = 0

    for phrase in phrases:
        sig = create_phrase_signature(phrase)

        if sig and sig in phrase_signatures:
            phrase["is_repeat"] = True
            phrase["original_id"] = phrase_signatures[sig]
            repeat_count += 1
        else:
            phrase["is_repeat"] = False
            if sig:
                phrase_signatures[sig] = phrase.get("id", len(phrase_signatures))

    print(f"  Found {repeat_count} repeating phrases")

    return phrases


def create_phrase_signature(phrase):
    """Create a normalized signature for phrase comparison."""
    notes = phrase.get("notes", [])
    if len(notes) < 2:
        return None

    # Relative pitches (intervals)
    pitches = [note_to_midi(n["note"]) for n in notes]
    intervals = tuple(pitches[i+1] - pitches[i] for i in range(len(pitches)-1))

    # Relative rhythms
    times = [n["time"] for n in notes]
    durations = [times[i+1] - times[i] for i in range(len(times)-1)]

    if not durations:
        return None

    avg_duration = sum(durations) / len(durations) if durations else 1
    normalized_durations = tuple(round(d / avg_duration, 1) for d in durations) if avg_duration > 0 else ()

    return (intervals, normalized_durations)


# =============================================================================
# SPAWN EVENT GENERATION
# =============================================================================

def get_role_for_time(roles_over_time, time):
    """Get the instrument role for a specific time."""
    for role_info in reversed(roles_over_time):
        if role_info["time"] <= time:
            return role_info["role"]
    return "lead"  # Default


def get_section_for_time(sections, time):
    """Get the section for a specific time."""
    for section in sections:
        if section["start"] <= time < section["end"]:
            return section
    return sections[-1] if sections else None


def calculate_y_position(note, role, phrase_progress=0):
    """Calculate vertical position based on note and instrument role."""
    # Get role's vertical zone
    zone = INSTRUMENT_ROLES.get(role, INSTRUMENT_ROLES["lead"])
    min_y, max_y = zone["vertical_zone"]

    # Map note pitch to position within zone
    midi = note_to_midi(note["note"])

    # Normalize MIDI (assume range 36-96, 5 octaves)
    normalized = (midi - 36) / 60
    normalized = max(0, min(1, normalized))

    # Invert (higher notes = lower Y in screen coords, but we want higher = higher position visually)
    # Actually, keep it: higher pitch = lower Y value = higher on screen
    y_position = max_y - normalized * (max_y - min_y)

    return float(y_position)


def determine_enemy_type(note, section, role):
    """Determine enemy type based on musical context."""
    energy = section.get("energy", 0.5) if section else 0.5

    if role == "bass":
        return "hexagon"  # Bass gets special hexagons
    elif energy > 0.7:
        return "triangle"  # High energy = triangles
    elif energy > 0.4:
        return "square"  # Medium energy = squares
    else:
        return "circle"  # Low energy = circles


def generate_spawn_events(phrases, roles_over_time, sections, drops, tempo, beat_times,
                          high_density_sections=None, all_notes_raw=None,
                          instrument_sections=None):
    """Convert beats to spawn events synchronized with the music.

    Spawns ONE enemy per beat normally, but behavior changes based on:
    - Instrument-dominant sections (guitar solo, drum solo, bass breakdown)
    - High-density note sections (fallback if no instrument separation)
    """
    print("Generating spawn events...")

    events = []
    base_velocity = -200
    beat_duration = 60.0 / tempo
    high_density_sections = high_density_sections or []
    instrument_sections = instrument_sections or []

    # Collect all notes from all phrases for beat matching
    all_notes = []
    for phrase in phrases:
        for note in phrase.get("notes", []):
            all_notes.append(note)
    all_notes.sort(key=lambda n: n["time"])

    # Helper to check what instrument is dominant at a given time
    def get_instrument_section(time):
        for section in instrument_sections:
            if section["start"] <= time < section["end"]:
                return section
        return None

    # Helper to check if a time is in a high-density section
    def get_high_density_section(time):
        for section in high_density_sections:
            if section["start"] <= time < section["end"]:
                return section
        return None

    # Track which times we've spawned for (to avoid duplicates)
    spawned_times = set()

    # Generate ONE spawn event per beat
    for beat_idx, beat_time in enumerate(beat_times):
        # Get section energy at this beat
        section = get_section_for_time(sections, beat_time)
        section_energy = section.get("energy", 0.5) if section else 0.5

        # Check for instrument-dominant section
        inst_section = get_instrument_section(beat_time)
        dominant_instrument = inst_section['instrument'] if inst_section else None

        # During vocal sections, reduce spawning to give breathing room
        if dominant_instrument == 'vocals':
            # Only spawn every other beat during vocal sections
            if beat_idx % 2 != 0:
                continue

        # Skip quiet sections (below 30% energy)
        if section_energy < 0.30:
            continue

        # Find notes within this beat window (±half beat)
        window_start = beat_time - beat_duration * 0.5
        window_end = beat_time + beat_duration * 0.5
        notes_in_beat = [n for n in all_notes if window_start <= n["time"] < window_end]

        # Skip beats with no musical content
        if not notes_in_beat:
            continue

        # Use average pitch of notes in this beat for Y position
        avg_midi = sum(n.get("midi", 60) for n in notes_in_beat) / len(notes_in_beat)
        max_magnitude = max(n.get("magnitude", 0.5) for n in notes_in_beat)

        # Calculate Y position from pitch (higher pitch = higher on screen)
        y_pos = 0.9 - (avg_midi - 36) / 60.0 * 0.8  # Map MIDI 36-96 to 0.9-0.1
        y_pos = max(0.1, min(0.9, y_pos))

        # Get role for motion variety
        role = get_role_for_time(roles_over_time, beat_time)

        # Adjust behavior based on dominant instrument
        if dominant_instrument == 'drums':
            # Drum-dominant: more varied Y positions, punchy motion
            y_pos = 0.1 + (beat_idx % 9) * 0.1  # Spread across screen
            motion_params = {
                "type": "bounce",
                "center_y": y_pos,
                "amplitude": 0.08,
                "frequency": 1.2,
                "decay": 0.4
            }
            enemy_type = "square"
            size = 0.5 + section_energy * 0.3
            velocity_x = base_velocity * 1.2  # Faster during drums
        elif dominant_instrument == 'bass':
            # Bass-dominant: bigger, slower enemies, lower on screen
            y_pos = 0.6 + (beat_idx % 4) * 0.1  # Lower third of screen (0.6-0.9)
            motion_params = {
                "type": "sine_wave",
                "center_y": y_pos,
                "amplitude": 0.04,
                "frequency": 0.4  # Slow movement
            }
            enemy_type = "hexagon"
            size = 0.7 + section_energy * 0.3  # Bigger
            velocity_x = base_velocity * 0.7  # Slower
        elif dominant_instrument == 'other':
            # Guitar/keys-dominant: spread across screen, faster
            y_pos = 0.2 + (beat_idx % 7) * 0.1  # Upper-mid screen (0.2-0.8)
            motion_params = {
                "type": "linear",
                "center_y": y_pos,
                "amplitude": 0.02,
                "frequency": 0.8
            }
            enemy_type = "circle"
            size = 0.35 + max_magnitude * 0.2
            velocity_x = base_velocity * 1.3  # Fast
        else:
            # Normal behavior
            base_amplitude = 0.06
            frequency = 0.7
            amplitude = base_amplitude * (0.8 + section_energy * 0.4)

            motion_params = {
                "type": "sine_wave",
                "center_y": y_pos,
                "amplitude": amplitude,
                "frequency": frequency * (0.9 + section_energy * 0.2),
                "phase": (beat_idx % 4) * 0.25
            }
            size = 0.4 + max_magnitude * 0.3 + section_energy * 0.2
            velocity_x = base_velocity * (0.8 + section_energy * 0.5)
            enemy_type = "triangle" if section_energy > 0.7 else "square" if section_energy > 0.4 else "circle"

        # Note name from average MIDI
        note_name = midi_to_note_name(int(avg_midi))

        event = {
            "time": float(beat_time),
            "note": note_name,
            "y_position": float(y_pos),
            "enemy_type": enemy_type,
            "size": float(min(1.0, size)),
            "motion": motion_params,
            "velocity": {"x": float(velocity_x), "y": 0},
            "group_id": f"beat_{beat_idx:04d}",
            "section_energy": float(section_energy),
            "notes_in_beat": len(notes_in_beat),
            "dominant_instrument": dominant_instrument
        }

        events.append(event)
        spawned_times.add(round(beat_time, 3))

    # Generate rapid-fire events for high-density sections (solos)
    # Limit spawning to avoid overwhelming the player - spawn every Nth note
    for hd_section in high_density_sections:
        # Get all notes in this high-density section
        section_notes = [n for n in all_notes
                        if hd_section["start"] <= n["time"] < hd_section["end"]]

        if not section_notes:
            continue

        # Calculate spawn frequency based on section density
        # Aim for ~3-4 enemies per second max during solos
        section_duration = hd_section["end"] - hd_section["start"]
        density = len(section_notes) / section_duration if section_duration > 0 else 10
        target_rate = 3.5  # enemies per second during solos
        skip_factor = max(1, int(density / target_rate))

        movement_type = hd_section.get("movement_type", "melodic")
        base_y = 0.5  # Center line for smooth runs

        for i, note in enumerate(section_notes):
            # Only spawn every Nth note to control density
            if i % skip_factor != 0:
                continue

            # Skip if we already spawned at this time (from beat-based)
            if round(note["time"], 3) in spawned_times:
                continue

            spawned_times.add(round(note["time"], 3))

            # Y position depends on movement type
            if movement_type == "smooth":
                # Horizontal line with tiny variance
                y_pos = base_y + ((i % 5) - 2) * 0.02  # ±4% variance
            else:
                # Melodic - follow pitch contour
                midi = note.get("midi", 60)
                y_pos = 0.9 - (midi - 36) / 60.0 * 0.8
                y_pos = max(0.1, min(0.9, y_pos))

            # Minimal motion for solo notes - they're already rapid
            motion_params = {
                "type": "linear" if movement_type == "smooth" else "sine_wave",
                "center_y": y_pos,
                "amplitude": 0.02,  # Very small
                "frequency": 0.5
            }

            event = {
                "time": float(note["time"]),
                "note": note.get("note", "C4"),
                "y_position": float(y_pos),
                "enemy_type": "circle",  # Small fast enemies for solos
                "size": 0.35,  # Smaller size for rapid-fire
                "motion": motion_params,
                "velocity": {"x": -280, "y": 0},  # Faster velocity
                "group_id": hd_section["id"],
                "is_solo": True,
                "section_energy": hd_section.get("intensity", 0.8)
            }

            events.append(event)

    # Generate events from drops (these are special formations)
    for drop in drops:
        drop_events = generate_drop_formation(drop)
        events.extend(drop_events)

    # Sort by time
    events.sort(key=lambda e: e["time"])

    print(f"  Generated {len(events)} spawn events")

    return events


def midi_to_note_name(midi):
    """Convert MIDI number to note name."""
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    octave = (midi // 12) - 1
    note_idx = midi % 12
    return f"{note_names[note_idx]}{octave}"


def generate_drop_formation(drop):
    """Generate spawn events for a drop moment."""
    events = []

    drop_time = drop["time"]
    enemy_count = drop.get("enemy_count", 10)
    formation = drop.get("formation", "burst")
    magnitude = drop.get("magnitude", 0.8)

    # Spawn duration (all enemies appear within this window)
    spawn_duration = 0.3

    if formation == "burst":
        # Radial burst from edges
        for i in range(enemy_count):
            angle = (i / enemy_count) * 2 * 3.14159

            # Start position on edge
            start_x = 0.5 + 0.6 * np.cos(angle)
            start_y = 0.5 + 0.6 * np.sin(angle)

            # Stagger spawn times slightly
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
        # Wave from right side
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
        # Converge from corners
        corners = [(0.1, 0.1), (0.9, 0.1), (0.1, 0.9), (0.9, 0.9)]
        per_corner = enemy_count // 4

        for corner_idx, (cx, cy) in enumerate(corners):
            for i in range(per_corner):
                spawn_time = drop_time + (i / per_corner) * spawn_duration

                events.append({
                    "time": float(spawn_time),
                    "note": "G4",
                    "y_position": float(cy),
                    "enemy_type": "hexagon",
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
            angle = (i / enemy_count) * 4 * 3.14159  # Two full rotations
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

def author_level(audio_path, output_path=None):
    """Main authoring pipeline - transforms audio into authored level."""
    print(f"\n{'='*60}")
    print(f"MUSICAL LEVEL AUTHORING PIPELINE")
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

    # Step 8: Detect solo sections
    solos = detect_solo_sections(
        features["rms"], features["rms_times"],
        freq_bands, onset_sharpness, duration
    )

    # Step 9: Extract notes
    notes = extract_notes(features["pitches"], features["magnitudes"], sr)

    # Step 9b: Instrument separation (if Demucs available)
    stems = separate_instruments(audio_path)

    # Step 9c: Detect guitar solos from stems OR fallback to note density
    if stems:
        # Use guitar stem analysis for solo detection (more accurate)
        guitar_solos = detect_guitar_solos_from_stems(stems, duration)
        instrument_sections = detect_instrument_dominance(stems, duration)
        # Use guitar solos as our high-density sections
        high_density_sections = guitar_solos
    else:
        # Fallback to note density detection (less accurate for fast songs)
        print("Instrument separation unavailable, using note density fallback")
        instrument_sections = []
        high_density_sections = detect_high_density_sections(notes, features["tempo"])

    # Step 10: Detect phrases
    phrases = detect_phrases(notes, features["beat_times"], features["tempo"])
    phrases = detect_repeating_phrases(phrases)

    # Step 11: Generate spawn events (beat-synchronized, with instrument awareness)
    spawn_events = generate_spawn_events(
        phrases, roles_over_time, sections, drops, features["tempo"], features["beat_times"],
        high_density_sections, notes, instrument_sections
    )

    # Step 12: Assemble final level
    level = {
        "version": "1.0",
        "metadata": {
            "song_id": Path(audio_path).stem,
            "filename": Path(audio_path).name,
            "duration": float(duration),
            "tempo": float(features["tempo"]),
            "authored_date": datetime.now().isoformat(),
            "total_spawn_events": len(spawn_events),
            "total_phrases": len(phrases),
            "total_drops": len(drops),
            "total_sections": len(sections)
        },
        "sections": sections,
        "drops": drops,
        "solo_sections": solos,
        "high_density_sections": high_density_sections,
        "instrument_sections": instrument_sections,
        "phrases": [
            {
                "id": f"phrase_{i:03d}",
                "type": p["type"],
                "start": p["start"],
                "end": p["end"],
                "instrument_role": get_role_for_time(roles_over_time, p["start"]),
                "is_repeat": p.get("is_repeat", False),
                "motion_profile": p["motion"]["profile"],
                "note_count": len(p.get("notes", []))
            }
            for i, p in enumerate(phrases)
        ],
        "motion_profiles": MOTION_PROFILES,
        "spawn_events": spawn_events
    }

    # Save to file
    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(level, f, indent=2, ensure_ascii=False)
        print(f"\n{'='*60}")
        print(f"Level authored successfully!")
        print(f"Output: {output_path}")
        print(f"{'='*60}\n")

    return level


# =============================================================================
# COMMAND LINE INTERFACE
# =============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Author a game level from audio analysis"
    )
    parser.add_argument("input_file", help="Input audio file (MP3, WAV, etc.)")
    parser.add_argument("output_file", nargs="?", help="Output JSON file (optional)")

    args = parser.parse_args()

    if not args.output_file:
        # Default output name
        input_path = Path(args.input_file)
        args.output_file = str(input_path.with_suffix('.level.json'))

    author_level(args.input_file, args.output_file)
