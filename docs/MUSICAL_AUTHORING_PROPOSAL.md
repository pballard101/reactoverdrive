# Musical Level Authoring System Proposal

## Executive Summary

This document proposes a comprehensive **offline authoring pipeline** that transforms raw audio analysis into an explicit, deterministic level description. The runtime engine receives a fully-authored level file and simply schedules/plays it—no runtime interpretation of audio features required.

---

## 1. Authored Level Schema

The level file is the single source of truth for gameplay. It contains:

```json
{
  "version": "1.0",
  "metadata": {
    "song_id": "string",
    "title": "string",
    "artist": "string",
    "duration": 245.5,
    "tempo": 128,
    "time_signature": "4/4",
    "key": "Am",
    "authored_date": "2026-01-02T12:00:00Z"
  },

  "sections": [
    {
      "id": "section_001",
      "type": "intro|verse|chorus|bridge|solo|drop|outro",
      "start": 0.0,
      "end": 15.5,
      "energy": 0.35,
      "intensity_curve": "rising|falling|steady|volatile",
      "spawn_rate_multiplier": 0.5,
      "visual_theme": "calm|building|intense|climax"
    }
  ],

  "drops": [
    {
      "id": "drop_001",
      "time": 45.2,
      "magnitude": 0.95,
      "pre_drop_silence": 0.8,
      "formation": "burst|wave|spiral|converge",
      "enemy_count": 12
    }
  ],

  "phrases": [
    {
      "id": "phrase_001",
      "type": "riff|motif|run|call_response|arpeggio|chord_stab",
      "start": 16.0,
      "end": 20.0,
      "instrument_role": "lead|bass|percussion|pad",
      "repeat_count": 4,
      "motion_profile": "arc_ascending",
      "vertical_range": { "min": 0.2, "max": 0.8 },
      "spawn_events": [
        {
          "time": 16.0,
          "relative_time": 0.0,
          "note": "E4",
          "y_position": 0.45,
          "enemy_type": "circle|square|triangle|hexagon",
          "size": 0.6,
          "motion": {
            "type": "linear|sine|arc|hold_release",
            "amplitude": 0.1,
            "frequency": 2.0,
            "phase": 0.0
          },
          "velocity": { "x": -200, "y": 0 },
          "group_role": "lead|follow|accent"
        }
      ]
    }
  ],

  "solo_sections": [
    {
      "id": "solo_001",
      "start": 120.0,
      "end": 150.0,
      "intensity": 0.85,
      "phrase_density": "high",
      "motion_complexity": "expressive",
      "spawn_pattern": "continuous_wave"
    }
  ],

  "motion_profiles": {
    "arc_ascending": {
      "type": "parametric",
      "equation": "y = start_y + amplitude * sin(progress * PI)",
      "parameters": { "amplitude": 0.2 }
    },
    "sine_wave": {
      "type": "oscillating",
      "equation": "y = center_y + amplitude * sin(time * frequency * 2PI)",
      "parameters": { "amplitude": 0.15, "frequency": 1.5 }
    },
    "hold_release": {
      "type": "segmented",
      "segments": [
        { "duration": 0.5, "motion": "stationary" },
        { "duration": 0.2, "motion": "accelerate", "direction": "down" }
      ]
    },
    "descending_run": {
      "type": "linear",
      "equation": "y = start_y + (end_y - start_y) * progress",
      "parameters": { "start_y": 0.2, "end_y": 0.8 }
    }
  }
}
```

---

## 2. Instrument/Role Inference Heuristics

### Overview

We don't need exact instrument identification—we need **perceptual role classification**. The goal is to assign spawned enemies to musical "lanes" that feel natural.

### Frequency Band Analysis

```python
ROLES = {
    "bass": {
        "freq_range": (20, 250),      # Hz
        "energy_weight": 0.7,
        "onset_sharpness": "soft",
        "typical_rhythm": "downbeat"
    },
    "percussion": {
        "freq_range": (2000, 8000),   # Snare, hi-hat region
        "energy_weight": 0.9,
        "onset_sharpness": "sharp",
        "typical_rhythm": "regular"
    },
    "lead": {
        "freq_range": (250, 2000),    # Melodic content
        "energy_weight": 0.5,
        "onset_sharpness": "medium",
        "typical_rhythm": "varied"
    },
    "pad": {
        "freq_range": (100, 1000),
        "energy_weight": 0.3,
        "onset_sharpness": "very_soft",
        "typical_rhythm": "sustained"
    }
}
```

### Detection Algorithm

```python
def infer_instrument_role(time_window, audio_data):
    """
    Analyzes a time window and returns the dominant instrument role.
    """

    # 1. Extract frequency spectrum for this window
    spectrum = get_spectrum(audio_data, time_window)

    # 2. Calculate energy in each frequency band
    bass_energy = sum_energy(spectrum, 20, 250)
    mid_energy = sum_energy(spectrum, 250, 2000)
    high_energy = sum_energy(spectrum, 2000, 8000)

    # 3. Analyze onset characteristics
    onset_sharpness = calculate_onset_sharpness(audio_data, time_window)

    # 4. Score each role
    scores = {}

    # Bass: High low-frequency energy, soft onsets
    scores["bass"] = (
        bass_energy * 0.6 +
        (1.0 - onset_sharpness) * 0.4
    ) if bass_energy > mid_energy * 0.5 else 0

    # Percussion: Sharp onsets, high-frequency content
    scores["percussion"] = (
        onset_sharpness * 0.7 +
        high_energy * 0.3
    ) if onset_sharpness > 0.6 else 0

    # Lead: Mid-frequency dominance, melodic contour
    melodic_variance = calculate_pitch_variance(audio_data, time_window)
    scores["lead"] = (
        mid_energy * 0.4 +
        melodic_variance * 0.4 +
        onset_sharpness * 0.2
    ) if mid_energy > bass_energy else 0

    # Pad: Sustained energy, low onset sharpness
    sustain_factor = calculate_sustain(audio_data, time_window)
    scores["pad"] = (
        sustain_factor * 0.6 +
        (1.0 - onset_sharpness) * 0.4
    ) if sustain_factor > 0.5 else 0

    return max(scores, key=scores.get)
```

### Vertical Mapping by Role

| Role | Vertical Zone | Rationale |
|------|--------------|-----------|
| Bass | 70-100% (bottom) | Low frequencies = low position |
| Percussion | 30-70% (center) | Rhythmic backbone, central focus |
| Lead | 10-50% (upper-mid) | Melodic prominence |
| Pad | 40-80% (spread) | Atmospheric, background |

---

## 3. Solo Detection Heuristics

### Characteristics of Solo Sections

1. **Increased melodic density**: More notes per second in mid-frequency range
2. **Reduced rhythmic regularity**: Less predictable beat patterns
3. **Sustained high energy**: Consistent elevated energy without drops
4. **Pitch variety**: Wider pitch range within short time windows
5. **Reduced percussive dominance**: Drums often pull back

### Detection Algorithm

```python
def detect_solo_sections(audio_data, segments):
    """
    Identifies likely solo/lead sections in the audio.
    Returns list of (start_time, end_time, confidence) tuples.
    """

    solos = []
    window_size = 4.0  # 4-second analysis windows
    hop_size = 1.0     # 1-second hop

    for t in range(0, duration, hop_size):
        window = get_window(audio_data, t, window_size)

        # Metric 1: Melodic density (notes per second in lead range)
        note_density = count_onsets_in_range(window, 250, 2000) / window_size
        density_score = min(1.0, note_density / 8.0)  # Normalize to 8 notes/sec

        # Metric 2: Pitch variance (how much the pitch moves)
        pitch_variance = calculate_pitch_variance(window)
        variance_score = min(1.0, pitch_variance / 12.0)  # Normalize to 12 semitones

        # Metric 3: Sustained mid-frequency energy
        mid_energy = get_sustained_energy(window, 250, 2000)
        energy_score = mid_energy / max_energy

        # Metric 4: Percussion suppression
        perc_energy = get_energy(window, 2000, 8000)
        perc_suppression = 1.0 - (perc_energy / avg_perc_energy)
        perc_score = max(0, perc_suppression)

        # Metric 5: Rhythmic irregularity
        beat_regularity = calculate_beat_regularity(window)
        irregularity_score = 1.0 - beat_regularity

        # Combine scores
        solo_likelihood = (
            density_score * 0.25 +
            variance_score * 0.25 +
            energy_score * 0.20 +
            perc_score * 0.15 +
            irregularity_score * 0.15
        )

        if solo_likelihood > 0.65:
            solos.append((t, t + window_size, solo_likelihood))

    # Merge adjacent solo windows
    return merge_adjacent_sections(solos, gap_threshold=2.0)
```

### Solo Section Gameplay Effects

When a section is marked as `"type": "solo"`:

```json
{
  "spawn_behavior": {
    "phrase_grouping": "continuous",
    "motion_complexity": "high",
    "vertical_motion": "expressive_waves",
    "spawn_rate": 1.5
  },
  "visual_effects": {
    "background_intensity": 0.8,
    "particle_density": "high",
    "color_saturation": 1.2
  }
}
```

---

## 4. Drop/Impact Detection Heuristics

### What Defines a "Drop"?

1. **Energy contrast**: Sudden increase in RMS energy (>50% jump)
2. **Pre-drop silence/reduction**: Energy dip before the drop
3. **Bass introduction**: Low-frequency content appears suddenly
4. **Onset density spike**: Many instruments hit simultaneously
5. **Spectral fullness**: Broad frequency content after the drop

### Detection Algorithm

```python
def detect_drops(audio_data, energy_profile):
    """
    Identifies major drops and impact moments.
    Returns list of Drop objects with timing and magnitude.
    """

    drops = []

    # Smooth the energy profile
    smoothed_energy = median_filter(energy_profile, size=10)

    # Calculate rate of change
    energy_derivative = np.gradient(smoothed_energy)

    # Find rapid energy increases
    for i in range(len(energy_derivative)):
        current_energy = smoothed_energy[i]

        # Look for pre-drop dip (energy low point before spike)
        if i > 0:
            # Check if we're at a local minimum followed by rapid increase
            is_local_min = (
                smoothed_energy[i] < smoothed_energy[i-1] and
                i + 1 < len(smoothed_energy) and
                smoothed_energy[i] < smoothed_energy[i+1]
            )

            if is_local_min:
                # Look ahead for energy spike
                future_window = smoothed_energy[i:i+20]  # ~0.5 seconds ahead
                if len(future_window) > 5:
                    max_future = max(future_window)
                    energy_jump = max_future - current_energy

                    # Significant jump threshold
                    if energy_jump > avg_energy * 0.5:
                        # Find the exact drop moment
                        drop_index = i + np.argmax(energy_derivative[i:i+20])
                        drop_time = index_to_time(drop_index)

                        # Calculate drop magnitude (0-1)
                        magnitude = min(1.0, energy_jump / max_energy)

                        # Calculate pre-drop silence duration
                        pre_silence = calculate_silence_before(i)

                        drops.append(Drop(
                            time=drop_time,
                            magnitude=magnitude,
                            pre_drop_silence=pre_silence,
                            energy_contrast=energy_jump / current_energy
                        ))

    # Filter out drops that are too close together
    return filter_drops_by_proximity(drops, min_gap=4.0)
```

### Spectral Fullness Check

```python
def calculate_spectral_fullness(spectrum):
    """
    Measures how "full" the frequency spectrum is.
    A drop typically has high spectral fullness.
    """

    # Divide spectrum into bands
    bands = [
        (20, 60),     # Sub-bass
        (60, 250),    # Bass
        (250, 500),   # Low-mid
        (500, 2000),  # Mid
        (2000, 4000), # Upper-mid
        (4000, 8000), # Presence
        (8000, 16000) # Brilliance
    ]

    # Count bands with significant energy
    active_bands = 0
    for low, high in bands:
        band_energy = sum_energy(spectrum, low, high)
        if band_energy > threshold:
            active_bands += 1

    return active_bands / len(bands)
```

### Drop Gameplay Formation

```json
{
  "id": "drop_001",
  "time": 45.2,
  "magnitude": 0.95,
  "pre_drop_silence": 0.8,
  "formation": "burst",
  "spawn_config": {
    "pattern": "radial_burst",
    "enemy_count": 15,
    "spawn_duration": 0.3,
    "initial_positions": "screen_edges",
    "converge_point": { "x": 0.5, "y": 0.5 },
    "motion": {
      "type": "accelerating_inward",
      "initial_velocity": 50,
      "acceleration": 300
    }
  }
}
```

---

## 5. Phrase Grouping System

### Phrase Types

| Type | Description | Motion Behavior |
|------|-------------|-----------------|
| `riff` | Repeating melodic pattern | Loop motion, consistent spacing |
| `motif` | Short recognizable pattern | Arc motion, grouped spawn |
| `run` | Ascending/descending sequence | Linear diagonal motion |
| `call_response` | Two alternating parts | Alternating sides, mirrored |
| `arpeggio` | Broken chord pattern | Staircase vertical motion |
| `chord_stab` | Simultaneous notes | Burst spawn, horizontal line |

### Phrase Detection Algorithm

```python
def detect_phrases(notes, beats, segments):
    """
    Groups notes into musical phrases based on timing and pitch patterns.
    """

    phrases = []
    current_phrase = []
    last_note_time = 0

    for note in notes:
        # Check for phrase break conditions
        gap = note.time - last_note_time

        # Gap threshold based on tempo (longer gap at slower tempos)
        beat_duration = 60 / tempo
        gap_threshold = beat_duration * 1.5

        if gap > gap_threshold and current_phrase:
            # End current phrase, analyze and store
            phrase_type = analyze_phrase_type(current_phrase)
            motion = assign_motion_profile(phrase_type, current_phrase)

            phrases.append(Phrase(
                notes=current_phrase,
                type=phrase_type,
                motion=motion,
                start=current_phrase[0].time,
                end=current_phrase[-1].time
            ))
            current_phrase = []

        current_phrase.append(note)
        last_note_time = note.time

    return phrases

def analyze_phrase_type(notes):
    """
    Determines the type of phrase based on pitch and rhythm patterns.
    """

    if len(notes) < 2:
        return "single"

    # Calculate pitch direction
    pitches = [note_to_midi(n.note) for n in notes]
    directions = [pitches[i+1] - pitches[i] for i in range(len(pitches)-1)]

    # Check for patterns
    if all(d > 0 for d in directions):
        return "run_ascending"
    elif all(d < 0 for d in directions):
        return "run_descending"
    elif is_repeating_pattern(pitches):
        return "riff"
    elif is_arpeggio_pattern(pitches):
        return "arpeggio"
    elif len(set(pitches)) == 1:  # All same pitch
        return "chord_stab"
    elif is_call_response(notes):
        return "call_response"
    else:
        return "motif"
```

### Repeat Detection

```python
def detect_repeating_phrases(phrases):
    """
    Identifies phrases that repeat and marks them for consistent treatment.
    """

    phrase_signatures = {}

    for phrase in phrases:
        # Create a signature based on relative pitches and rhythms
        sig = create_phrase_signature(phrase)

        if sig in phrase_signatures:
            # Mark as repeat
            phrase.is_repeat = True
            phrase.original_id = phrase_signatures[sig]
        else:
            phrase_signatures[sig] = phrase.id
            phrase.is_repeat = False

    return phrases

def create_phrase_signature(phrase):
    """
    Creates a normalized signature for phrase comparison.
    """
    notes = phrase.notes
    if len(notes) < 2:
        return None

    # Relative pitches (intervals)
    pitches = [note_to_midi(n.note) for n in notes]
    intervals = tuple(pitches[i+1] - pitches[i] for i in range(len(pitches)-1))

    # Relative rhythms (note durations normalized)
    times = [n.time for n in notes]
    durations = [times[i+1] - times[i] for i in range(len(times)-1)]
    avg_duration = sum(durations) / len(durations)
    normalized_durations = tuple(round(d / avg_duration, 1) for d in durations)

    return (intervals, normalized_durations)
```

---

## 6. Motion Profile System

### Core Motion Types

```python
MOTION_PROFILES = {
    "linear": {
        "description": "Straight line movement",
        "equation": "y = start_y + (end_y - start_y) * t",
        "parameters": ["start_y", "end_y"]
    },

    "sine_wave": {
        "description": "Oscillating up and down",
        "equation": "y = center_y + amplitude * sin(t * frequency * 2PI)",
        "parameters": ["center_y", "amplitude", "frequency"]
    },

    "arc": {
        "description": "Parabolic arc motion",
        "equation": "y = start_y + amplitude * sin(t * PI)",
        "parameters": ["start_y", "amplitude"]
    },

    "hold_release": {
        "description": "Stationary then sudden move",
        "segments": [
            {"phase": "hold", "duration_ratio": 0.7, "motion": "none"},
            {"phase": "release", "duration_ratio": 0.3, "motion": "accelerate"}
        ]
    },

    "bounce": {
        "description": "Bouncing motion with decay",
        "equation": "y = center_y + amplitude * abs(sin(t * frequency * PI)) * exp(-decay * t)",
        "parameters": ["center_y", "amplitude", "frequency", "decay"]
    },

    "spiral_in": {
        "description": "Spiraling toward center",
        "equation_x": "x = center_x + radius * cos(t * rotations * 2PI) * (1 - t)",
        "equation_y": "y = center_y + radius * sin(t * rotations * 2PI) * (1 - t)",
        "parameters": ["center_x", "center_y", "radius", "rotations"]
    }
}
```

### Motion Assignment Based on Phrase Type

```python
def assign_motion_profile(phrase_type, notes):
    """
    Assigns appropriate motion profile based on phrase characteristics.
    """

    mapping = {
        "run_ascending": {
            "profile": "linear",
            "params": {"start_y": 0.8, "end_y": 0.2}
        },
        "run_descending": {
            "profile": "linear",
            "params": {"start_y": 0.2, "end_y": 0.8}
        },
        "riff": {
            "profile": "sine_wave",
            "params": {"amplitude": 0.15, "frequency": 2.0}
        },
        "arpeggio": {
            "profile": "arc",
            "params": {"amplitude": 0.25}
        },
        "chord_stab": {
            "profile": "hold_release",
            "params": {}
        },
        "call_response": {
            "profile": "bounce",
            "params": {"amplitude": 0.2, "frequency": 1.0, "decay": 0.5}
        },
        "motif": {
            "profile": "sine_wave",
            "params": {"amplitude": 0.1, "frequency": 1.5}
        }
    }

    return mapping.get(phrase_type, {
        "profile": "linear",
        "params": {"start_y": 0.5, "end_y": 0.5}
    })
```

### Runtime Motion Calculation

```javascript
// In the game runtime
function calculateMotionY(spawn, currentTime) {
    const motion = spawn.motion;
    const progress = (currentTime - spawn.time) / spawn.lifetime;

    switch (motion.type) {
        case "linear":
            return lerp(motion.start_y, motion.end_y, progress);

        case "sine_wave":
            return motion.center_y +
                   motion.amplitude * Math.sin(progress * motion.frequency * Math.PI * 2);

        case "arc":
            return motion.start_y +
                   motion.amplitude * Math.sin(progress * Math.PI);

        case "hold_release":
            if (progress < motion.hold_ratio) {
                return motion.start_y;
            } else {
                const releaseProgress = (progress - motion.hold_ratio) / (1 - motion.hold_ratio);
                return motion.start_y + motion.release_delta * easeInQuad(releaseProgress);
            }

        case "bounce":
            return motion.center_y +
                   motion.amplitude *
                   Math.abs(Math.sin(progress * motion.frequency * Math.PI)) *
                   Math.exp(-motion.decay * progress);
    }
}
```

---

## 7. Complete Authoring Pipeline

### Step 1: Audio Analysis (Python/Librosa)

```python
def analyze_audio(audio_path):
    """
    First pass: Extract raw audio features.
    """
    y, sr = librosa.load(audio_path)

    return {
        "beats": librosa.beat.beat_track(y=y, sr=sr),
        "onsets": librosa.onset.onset_detect(y=y, sr=sr),
        "energy_profile": librosa.feature.rms(y=y),
        "pitches": librosa.piptrack(y=y, sr=sr),
        "chromagram": librosa.feature.chroma_stft(y=y, sr=sr),
        "spectral_centroid": librosa.feature.spectral_centroid(y=y, sr=sr),
        "tempo": librosa.beat.tempo(y=y, sr=sr)
    }
```

### Step 2: Musical Structure Detection

```python
def detect_structure(audio_features):
    """
    Second pass: Identify musical structure.
    """
    return {
        "sections": detect_sections(audio_features),
        "drops": detect_drops(audio_features),
        "solos": detect_solo_sections(audio_features),
        "instrument_roles": infer_instrument_roles(audio_features)
    }
```

### Step 3: Phrase Grouping

```python
def group_phrases(audio_features, structure):
    """
    Third pass: Group notes into phrases with motion profiles.
    """
    notes = extract_notes(audio_features)
    phrases = detect_phrases(notes, audio_features["beats"])
    phrases = detect_repeating_phrases(phrases)

    for phrase in phrases:
        phrase.motion = assign_motion_profile(phrase.type, phrase.notes)
        phrase.vertical_range = calculate_vertical_range(phrase, structure)

    return phrases
```

### Step 4: Spawn Event Generation

```python
def generate_spawn_events(phrases, structure, drops):
    """
    Fourth pass: Convert phrases to explicit spawn events.
    """
    events = []

    for phrase in phrases:
        for note in phrase.notes:
            event = SpawnEvent(
                time=note.time,
                note=note.note,
                y_position=calculate_base_y(note, phrase),
                enemy_type=determine_enemy_type(note, phrase, structure),
                size=calculate_size(note, phrase, structure),
                motion=phrase.motion,
                velocity=calculate_velocity(phrase, structure),
                group_id=phrase.id
            )
            events.append(event)

    # Add drop formations
    for drop in drops:
        events.extend(generate_drop_formation(drop))

    return sorted(events, key=lambda e: e.time)
```

### Step 5: Export Authored Level

```python
def export_level(metadata, structure, phrases, events):
    """
    Final pass: Export complete level file.
    """
    level = {
        "version": "1.0",
        "metadata": metadata,
        "sections": structure["sections"],
        "drops": structure["drops"],
        "solo_sections": structure["solos"],
        "phrases": [phrase.to_dict() for phrase in phrases],
        "motion_profiles": MOTION_PROFILES,
        "spawn_events": [event.to_dict() for event in events]
    }

    return json.dumps(level, indent=2)
```

---

## 8. Runtime Integration

### Level Loader

```javascript
class AuthoredLevelPlayer {
    constructor(scene, levelData) {
        this.scene = scene;
        this.level = levelData;
        this.nextEventIndex = 0;
        this.activeSpawns = [];
    }

    update(currentTime) {
        // Process any events that should have triggered
        while (this.nextEventIndex < this.level.spawn_events.length) {
            const event = this.level.spawn_events[this.nextEventIndex];

            if (event.time <= currentTime) {
                this.spawnFromEvent(event);
                this.nextEventIndex++;
            } else {
                break; // Future events, stop processing
            }
        }

        // Update motion for all active spawns
        this.activeSpawns.forEach(spawn => {
            this.updateSpawnMotion(spawn, currentTime);
        });
    }

    spawnFromEvent(event) {
        const enemy = this.scene.enemyManager.spawnEnemy(
            event.size,
            event.note
        );

        // Override position based on authored y_position
        const gameHeight = this.scene.gameHeight;
        enemy.y = event.y_position * gameHeight;

        // Store motion data for updates
        enemy.motionData = event.motion;
        enemy.spawnTime = event.time;
        enemy.groupId = event.group_id;

        this.activeSpawns.push(enemy);
    }

    updateSpawnMotion(spawn, currentTime) {
        if (!spawn.active || !spawn.motionData) return;

        const newY = this.calculateMotionY(spawn, currentTime);
        spawn.y = newY * this.scene.gameHeight;
    }
}
```

---

## 9. Benefits of This Approach

### Determinism
- Same song always produces identical gameplay
- Debugging is straightforward—you can inspect the level file
- Players can learn patterns and improve

### Musical Expression
- Motion reflects musical phrasing, not just energy
- Grouped spawns create readable patterns
- Vertical motion follows melodic contour

### Performance
- No runtime audio analysis needed
- Simple event scheduling
- Predictable CPU/memory usage

### Maintainability
- Level files are human-readable JSON
- Easy to tweak specific moments
- Can be version-controlled

### Extensibility
- Add new motion profiles without changing core logic
- New phrase types can be added to detection
- Visual themes can be layered on top

---

## 10. Implementation Roadmap

### Phase 1: Enhanced Audio Analysis
1. Add frequency band analysis to `analyze_music.py`
2. Implement instrument role inference
3. Add spectral analysis for drop detection

### Phase 2: Phrase Detection
1. Implement phrase grouping algorithm
2. Add repeat detection
3. Create phrase signature system

### Phase 3: Motion System
1. Define motion profile data structures
2. Implement motion calculation in runtime
3. Add motion visualization debugging tools

### Phase 4: Level Authoring Pipeline
1. Create complete pipeline script
2. Generate authored level JSON
3. Validate output schema

### Phase 5: Runtime Integration
1. Create `AuthoredLevelPlayer` class
2. Replace direct AudioAnalyzer spawning
3. Add fallback for un-authored songs

---

## Appendix A: Example Authored Level Snippet

```json
{
  "phrases": [
    {
      "id": "phrase_guitar_riff_01",
      "type": "riff",
      "start": 32.0,
      "end": 36.0,
      "instrument_role": "lead",
      "repeat_count": 4,
      "motion_profile": "sine_wave",
      "vertical_range": { "min": 0.25, "max": 0.55 },
      "spawn_events": [
        {
          "time": 32.0,
          "note": "E4",
          "y_position": 0.40,
          "enemy_type": "triangle",
          "size": 0.7,
          "motion": {
            "type": "sine_wave",
            "center_y": 0.40,
            "amplitude": 0.10,
            "frequency": 2.0
          },
          "velocity": { "x": -180, "y": 0 },
          "group_role": "lead"
        },
        {
          "time": 32.25,
          "note": "G4",
          "y_position": 0.35,
          "enemy_type": "circle",
          "size": 0.5,
          "motion": {
            "type": "sine_wave",
            "center_y": 0.35,
            "amplitude": 0.10,
            "frequency": 2.0,
            "phase": 0.25
          },
          "velocity": { "x": -180, "y": 0 },
          "group_role": "follow"
        }
      ]
    }
  ],
  "drops": [
    {
      "id": "drop_chorus_01",
      "time": 64.0,
      "magnitude": 0.92,
      "pre_drop_silence": 0.6,
      "formation": "converge",
      "spawn_config": {
        "enemy_count": 12,
        "spawn_duration": 0.4,
        "pattern": "radial_burst",
        "positions": [
          { "angle": 0, "distance": 1.2 },
          { "angle": 30, "distance": 1.2 },
          { "angle": 60, "distance": 1.2 }
        ],
        "converge_velocity": 400
      }
    }
  ]
}
```

This authored level format gives the runtime everything it needs to recreate the exact intended gameplay experience without any runtime audio interpretation.
