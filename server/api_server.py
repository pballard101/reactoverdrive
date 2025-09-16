#!/usr/bin/env python3
from flask import Flask, request, jsonify, send_from_directory
import subprocess
import os
import sys
import json
import datetime
from pathlib import Path

app = Flask(__name__, static_folder='../client')

# Enable CORS for development
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'OPTIONS, GET, POST'
    return response

@app.route('/')
def serve_game():
    """Serve the main game HTML file."""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files from the client directory."""
    return send_from_directory(app.static_folder, path)

@app.route('/data/<path:filename>')
def serve_data_file(filename):
    """Serve music and JSON files from the data directory."""
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
    
    # Determine the subdirectory (uploads or processed)
    if filename.startswith('uploads/'):
        return send_from_directory(os.path.join(data_dir, 'uploads'), filename[8:])
    elif filename.startswith('processed/'):
        return send_from_directory(os.path.join(data_dir, 'processed'), filename[10:])
    elif filename.startswith('debug_files/'):
        return send_from_directory(os.path.join(data_dir, 'uploads', 'debug_files'), filename[12:])
    else:
        # Try to find the file in either directory
        for subdir in ['uploads', 'processed']:
            file_path = os.path.join(data_dir, subdir, filename)
            if os.path.exists(file_path):
                return send_from_directory(os.path.join(data_dir, subdir), filename)
            
            # Also check debug_files subdirectory
            debug_path = os.path.join(data_dir, subdir, 'debug_files', filename)
            if os.path.exists(debug_path):
                return send_from_directory(os.path.join(data_dir, subdir, 'debug_files'), filename)
    
    return "File not found", 404

@app.route('/debug/<path:filename>')
def serve_debug_file(filename):
    """Serve debug log files."""
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
    
    # Check all possible locations for debug files
    for subdir in ['uploads', 'processed']:
        # Check in main directory
        debug_path = os.path.join(data_dir, subdir, filename)
        if os.path.exists(debug_path) and filename.endswith('_debug.log'):
            return send_from_directory(os.path.join(data_dir, subdir), filename)
            
        # Check in debug_files subdirectory
        debug_files_path = os.path.join(data_dir, subdir, 'debug_files', filename)
        if os.path.exists(debug_files_path):
            return send_from_directory(os.path.join(data_dir, subdir, 'debug_files'), filename)
    
    return "Debug file not found", 404

@app.route('/test')
def test():
    """Basic test endpoint."""
    return "OK"

@app.route('/songs')
def list_songs():
    """Return a list of all processed songs with their metadata."""
    songs = []
    
    # First, load songs from processed_songs.json
    processed_songs_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'processed', 'processed_songs.json')
    if os.path.exists(processed_songs_file):
        try:
            with open(processed_songs_file, 'r', encoding='utf-8') as f:
                processed_data = json.load(f)
                for song in processed_data:
                    # Convert the processed song format to the format expected by the frontend
                    song_info = {
                        'title': song.get('title', 'Unknown Title'),
                        'artist': song.get('artist', 'Unknown Artist'),
                        'filename': song.get('filename', ''),
                        'path': song.get('file_path', ''),
                        'hasDebug': os.path.exists(song.get('file_path', '').replace('.mp3', '_debug.log')),
                        'hasAnalysis': os.path.exists(song.get('analysis_path', '')),
                        'debugFile': os.path.basename(song.get('file_path', '').replace('.mp3', '_debug.log')) if os.path.exists(song.get('file_path', '').replace('.mp3', '_debug.log')) else None,
                        'isProcessed': True
                    }
                    songs.append(song_info)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            print(f"Error reading processed_songs.json: {e}")
    
    # Also check for core songs in client/assets/music directory
    core_music_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'client', 'assets', 'music', 'band')
    if os.path.exists(core_music_dir):
        for root, dirs, files in os.walk(core_music_dir):
            for file in files:
                if file.lower().endswith('.mp3'):
                    # Extract artist and title from directory structure
                    rel_path = os.path.relpath(root, core_music_dir)
                    path_parts = rel_path.split(os.sep)
                    
                    if len(path_parts) >= 2:
                        artist = path_parts[0].replace('_', ' ')
                        title = path_parts[1].replace('_', ' ')
                    else:
                        artist = 'Unknown Artist'
                        title = os.path.splitext(file)[0].replace('_', ' ')
                    
                    # Check if this song is already in our processed list
                    already_exists = any(s['filename'] == file and s['artist'] == artist for s in songs)
                    if not already_exists:
                        song_info = {
                            'title': title,
                            'artist': artist,
                            'filename': file,
                            'path': os.path.join('client', 'assets', 'music', 'band', rel_path).replace('\\', '/'),
                            'hasDebug': False,
                            'hasAnalysis': os.path.exists(os.path.join(root, file.replace('.mp3', '_analysis.json'))),
                            'debugFile': None,
                            'isProcessed': False
                        }
                        songs.append(song_info)
    
    # Check uploads directory for newly uploaded songs that might not be processed yet
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'uploads')
    if os.path.exists(uploads_dir):
        for file in os.listdir(uploads_dir):
            if file.lower().endswith('.mp3'):
                # Check if this song is already in our list
                already_exists = any(s['filename'] == file for s in songs)
                if not already_exists:
                    # Try to load info from JSON file
                    info_file = os.path.join(uploads_dir, file.replace('.mp3', '_info.json'))
                    title = os.path.splitext(file)[0].replace('_', ' ')
                    artist = 'Unknown Artist'
                    
                    if os.path.exists(info_file):
                        try:
                            with open(info_file, 'r', encoding='utf-8') as f:
                                info_data = json.load(f)
                                title = info_data.get('title', title)
                                artist = info_data.get('artist', artist)
                        except:
                            pass
                    
                    song_info = {
                        'title': title,
                        'artist': artist,
                        'filename': file,
                        'path': os.path.join('data', 'uploads', file).replace('\\', '/'),
                        'hasDebug': os.path.exists(os.path.join(uploads_dir, file.replace('.mp3', '_debug.log'))),
                        'hasAnalysis': os.path.exists(os.path.join(uploads_dir, file.replace('.mp3', '_analysis.json'))),
                        'debugFile': file.replace('.mp3', '_debug.log') if os.path.exists(os.path.join(uploads_dir, file.replace('.mp3', '_debug.log'))) else None,
                        'isProcessed': False
                    }
                    songs.append(song_info)
    
    # Sort songs by artist then title for better organization
    songs.sort(key=lambda x: (x['artist'], x['title']))
    
    return jsonify({'songs': songs})

@app.route('/upload', methods=['POST'])
def upload_song():
    """Handle MP3 file uploads and trigger processing."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if not file.filename.lower().endswith('.mp3'):
        return jsonify({'error': 'Only MP3 files are supported'}), 400
    
    # Save file to uploads directory
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Create debug_files directory if it doesn't exist
    debug_dir = os.path.join(uploads_dir, 'debug_files')
    os.makedirs(debug_dir, exist_ok=True)
    
    # Handle spaces and special characters in filename
    safe_filename = file.filename.replace(' ', '_').replace('(', '').replace(')', '')
    
    filepath = os.path.join(uploads_dir, safe_filename)
    file.save(filepath)
    
    # Process the file
    try:
        process_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'process_upload.py')
        
        # Run processing in background
        subprocess.Popen(['python', process_script, filepath])
        
        # Generate expected debug log path
        debug_log_path = os.path.join(uploads_dir, f"{os.path.splitext(safe_filename)[0]}_debug.log")
        
        return jsonify({
            'message': 'File uploaded successfully and processing started',
            'filename': safe_filename,
            'originalFilename': file.filename,
            'debugLogPath': f"data/uploads/{os.path.splitext(safe_filename)[0]}_debug.log" 
        })
    except Exception as e:
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500

@app.route('/scores/<song_id>', methods=['GET'])
def get_high_scores(song_id):
    """Get high scores for a specific song."""
    # Sanitize song_id to prevent directory traversal
    song_id = os.path.basename(song_id)
    
    # Check for scores file in uploads, processed, and core music directories
    scores_found = False
    scores_data = {"scores": []}
    
    # Check data directories first
    for directory in ['uploads', 'processed']:
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', directory)
        scores_file = os.path.join(data_dir, f"{song_id}_scores.json")
        
        if os.path.exists(scores_file):
            try:
                with open(scores_file, 'r', encoding='utf-8') as f:
                    scores_data = json.load(f)
                    scores_found = True
                    break
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                print(f"Error reading scores file {scores_file}: {e}")
    
    # If not found in data directories, check core music directory
    if not scores_found:
        core_music_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'client', 'assets', 'music', 'band')
        # Look for scores file in any subdirectory of core music
        for root, dirs, files in os.walk(core_music_dir):
            scores_file = os.path.join(root, f"{song_id}_scores.json")
            if os.path.exists(scores_file):
                try:
                    with open(scores_file, 'r', encoding='utf-8') as f:
                        scores_data = json.load(f)
                        scores_found = True
                        break
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    print(f"Error reading scores file {scores_file}: {e}")
    
    # If no scores file found, return empty array
    if not scores_found:
        return jsonify({"scores": []})
    
    # Ensure scores are sorted by score (descending)
    if "scores" in scores_data:
        scores_data["scores"] = sorted(scores_data["scores"], key=lambda x: x.get("score", 0), reverse=True)
    
    # Return only top 10 scores
    top_scores = scores_data.get("scores", [])[:10]
    return jsonify({"scores": top_scores})

@app.route('/scores', methods=['POST'])
def submit_score():
    """Submit a new high score."""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Validate required fields
    required_fields = ["songId", "score", "initials"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    song_id = os.path.basename(data["songId"])  # Sanitize to prevent directory traversal
    score = data["score"]
    initials = data["initials"][:3].upper()  # Ensure max 3 characters, uppercase
    
    # Validate score is a number
    try:
        score = int(score)
    except (ValueError, TypeError):
        return jsonify({"error": "Score must be a number"}), 400
    
    # Find the song in uploads, processed, or core music directories
    scores_file = None
    
    # Check data directories first
    for directory in ['uploads', 'processed']:
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', directory)
        potential_file = os.path.join(data_dir, f"{song_id}_scores.json")
        
        # Check if the corresponding mp3 file exists to verify this is a valid song
        mp3_file = os.path.join(data_dir, f"{song_id}.mp3")
        if os.path.exists(mp3_file):
            scores_file = potential_file
            break
    
    # If not found in data directories, check core music directory
    if not scores_file:
        core_music_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'client', 'assets', 'music', 'band')
        # Look for mp3 file in any subdirectory of core music
        for root, dirs, files in os.walk(core_music_dir):
            mp3_file = os.path.join(root, f"{song_id}.mp3")
            if os.path.exists(mp3_file):
                # Store scores in the same directory as the music file for core music
                scores_file = os.path.join(root, f"{song_id}_scores.json")
                break
    
    if not scores_file:
        return jsonify({"error": f"Song not found: {song_id}"}), 404
    
    # Load existing scores or create new file
    scores_data = {"scores": []}
    if os.path.exists(scores_file):
        try:
            with open(scores_file, 'r', encoding='utf-8') as f:
                scores_data = json.load(f)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            print(f"Error reading scores file {scores_file}, creating new file: {e}")
    
    # Add new score with timestamp
    new_score = {
        "initials": initials,
        "score": score,
        "date": datetime.datetime.now().strftime("%Y-%m-%d")
    }
    
    if "scores" not in scores_data:
        scores_data["scores"] = []
    
    scores_data["scores"].append(new_score)
    
    # Sort scores by score (descending)
    scores_data["scores"] = sorted(scores_data["scores"], key=lambda x: x.get("score", 0), reverse=True)
    
    # Save all scores
    try:
        with open(scores_file, 'w', encoding='utf-8') as f:
            json.dump(scores_data, f, indent=2)
    except Exception as e:
        return jsonify({"error": f"Failed to save scores: {str(e)}"}), 500
    
    # Return only top 10 scores
    top_scores = scores_data["scores"][:10]
    return jsonify({
        "message": "Score submitted successfully",
        "scores": top_scores,
        "rank": next((i+1 for i, s in enumerate(scores_data["scores"]) if s == new_score), -1)
    })

@app.route('/process', methods=["POST"])
def process_song():
    """Endpoint to process an already uploaded song."""
    data = request.get_json() or request.form  # Support JSON or form data
    file_path = data.get("file_path")

    if not file_path:
        return jsonify({"error": "Missing 'file_path' in request body"}), 400

    if not os.path.exists(file_path):
        return jsonify({"error": "File not found", "file": file_path}), 400

    # Run process_upload.py on the given file
    process_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'process_upload.py')
    result = subprocess.run(["python", process_script, file_path], capture_output=True, text=True)

    # Construct debug log path
    file_basename = os.path.splitext(os.path.basename(file_path))[0]
    debug_log_path = os.path.join(os.path.dirname(file_path), f"{file_basename}_debug.log")
    debug_log_url = f"data/{os.path.relpath(debug_log_path, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data'))}"

    if result.returncode == 0:
        print(result.stdout)
        response_data = {
            "message": "Processing complete",
            "file": file_path,
            "output": result.stdout.strip(),
            "debugLog": debug_log_url if os.path.exists(debug_log_path) else None
        }
        return jsonify(response_data)
    else:
        error_message = result.stderr.strip()
        print(f"❌ Error processing {file_path}: {error_message}")
        return jsonify({
            "error": "Processing failed",
            "file": file_path,
            "details": error_message,
            "debugLog": debug_log_url if os.path.exists(debug_log_path) else None
        }), 500

if __name__ == "__main__":
    # Try different ports in case the primary one is taken
    # Port 5000 is commonly used by AirPlay on macOS
    ports_to_try = [8080, 5050, 3000, 8000]
    
    for port in ports_to_try:
        try:
            print(f"Attempting to start server on port {port}...")
            app.run(debug=False, host="0.0.0.0", port=port)
            break  # If successful, exit the loop
        except OSError as e:
            print(f"Port {port} is unavailable: {e}")
            if port == ports_to_try[-1]:
                print("All ports are in use. Please manually specify a port.")
                print("You can run the server with: python api_server.py")
                sys.exit(1)
