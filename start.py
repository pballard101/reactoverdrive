#!/usr/bin/env python3
"""
MusicGame Starter Script
- Checks dependencies
- Ensures directories exist
- Starts the server
"""
import subprocess
import os
import sys
import importlib.util
import platform

# Determine correct path separator and venv activation script
def get_venv_info():
    """Get virtual environment information based on platform."""
    is_windows = platform.system() == "Windows"
    venv_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "venv")
    
    if is_windows:
        activate_script = os.path.join(venv_dir, "Scripts", "activate")
        python_path = os.path.join(venv_dir, "Scripts", "python.exe")
        activate_cmd = f"call {activate_script}"
    else:
        activate_script = os.path.join(venv_dir, "bin", "activate")
        python_path = os.path.join(venv_dir, "bin", "python")
        activate_cmd = f"source {activate_script}"
    
    return {
        "is_windows": is_windows,
        "venv_dir": venv_dir,
        "activate_script": activate_script,
        "python_path": python_path,
        "activate_cmd": activate_cmd,
        "exists": os.path.exists(venv_dir)
    }

def check_dependencies():
    """Check if required packages are installed, install if not."""
    required_packages = ['flask', 'numpy', 'librosa', 'soundfile', 'pyacoustid']
    missing_packages = []
    
    # Check for required packages
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package} is installed")
        except ImportError:
            print(f"❌ {package} is not installed. Will install...")
            missing_packages.append(package)
    
    # Install missing packages
    if missing_packages:
        print(f"Installing missing packages: {', '.join(missing_packages)}")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing_packages)
            print("✅ Installed missing packages")
            
            # Verify installation
            for package in missing_packages:
                try:
                    __import__(package)
                    print(f"✅ Successfully installed {package}")
                except ImportError:
                    print(f"❌ Failed to install {package}. Please install it manually.")
                    print(f"   pip install {package}")
                    sys.exit(1)  # Exit if essential packages are missing
        except subprocess.CalledProcessError:
            print("❌ Failed to install packages. Please install them manually:")
            for package in missing_packages:
                print(f"   pip install {package}")
            sys.exit(1)  # Exit if installation failed
    
    # Try to import librosa (might be difficult to install on some platforms)
    try:
        __import__('librosa')
        print("✅ librosa is installed")
    except ImportError:
        print("⚠️ librosa is not installed. Some music analysis features may not work.")
        print("   You can install it with: pip install librosa")

def ensure_directories():
    """Ensure required directories exist."""
    dirs = ['data/uploads', 'data/processed', 'client']
    for d in dirs:
        os.makedirs(os.path.join(os.path.dirname(__file__), d), exist_ok=True)
        print(f"✅ Directory '{d}' ready")

def copy_frontend_if_empty():
    """Copy frontend files if client directory is empty."""
    client_dir = os.path.join(os.path.dirname(__file__), 'client')
    if not os.listdir(client_dir):
        print("📁 Client directory is empty, copying frontend files...")
        try:
            # Try to find and copy the music-shooter frontend files
            repo_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            music_shooter_dir = os.path.join(repo_dir, 'music-shooter')
            
            if os.path.exists(music_shooter_dir):
                # Copy HTML files
                for file in os.listdir(music_shooter_dir):
                    if file.endswith('.html'):
                        src = os.path.join(music_shooter_dir, file)
                        dst = os.path.join(client_dir, file)
                        subprocess.run(['cp', src, dst])
                        print(f"✅ Copied {file}")
                
                # Copy assets and JS directories
                for dir_name in ['assets', 'js']:
                    src_dir = os.path.join(music_shooter_dir, dir_name)
                    dst_dir = os.path.join(client_dir, dir_name)
                    if os.path.exists(src_dir):
                        subprocess.run(['cp', '-r', src_dir, dst_dir])
                        print(f"✅ Copied {dir_name} directory")
            else:
                print("❌ Could not find music-shooter directory.")
                print("   Please manually copy frontend files to the client directory.")
        except Exception as e:
            print(f"❌ Error copying frontend files: {e}")
            print("   Please manually copy frontend files to the client directory.")

def run_fix_filenames():
    """Run the fix_filenames.py script to ensure consistent file naming."""
    print("\n🔧 Fixing inconsistent filenames...")
    fix_script = os.path.join(os.path.dirname(__file__), 'fix_filenames.py')
    
    if not os.path.exists(fix_script):
        print(f"⚠️ fix_filenames.py script not found at {fix_script}, skipping")
        return
    
    try:
        # Run with the current Python interpreter
        subprocess.run([sys.executable, fix_script], check=True)
        print("✅ Filename fixing complete")
    except subprocess.CalledProcessError as e:
        print(f"⚠️ Error running fix_filenames.py: {e}")
        print("   Continuing with startup anyway")

def initialize_high_scores():
    """Run the init_high_scores.py script to ensure all songs have high score files."""
    print("\n🏆 Initializing high scores for all songs...")
    highscore_script = os.path.join(os.path.dirname(__file__), 'init_high_scores.py')
    
    if not os.path.exists(highscore_script):
        print(f"⚠️ init_high_scores.py script not found at {highscore_script}, skipping")
        return
    
    try:
        # Run with the current Python interpreter
        subprocess.run([sys.executable, highscore_script], check=True)
        print("✅ High score initialization complete")
    except subprocess.CalledProcessError as e:
        print(f"⚠️ Error running init_high_scores.py: {e}")
        print("   Continuing with startup anyway")

def start_server():
    """Start the Flask server."""
    print("\n🚀 Starting MusicGame server...")
    server_script = os.path.join(os.path.dirname(__file__), 'server', 'api_server.py')
    
    if not os.path.exists(server_script):
        print(f"❌ Server script not found at {server_script}")
        return
    
    venv_info = get_venv_info()
    
    # Check if virtual environment exists
    if venv_info["exists"]:
        python_executable = venv_info["python_path"]
        print(f"Using virtual environment Python: {python_executable}")
        
        try:
            # Run with the virtual environment's Python interpreter
            subprocess.run([python_executable, server_script])
        except Exception as e:
            print(f"❌ Error starting server with virtual environment: {e}")
            print("\nFalling back to system Python...")
            fallback_start_server(server_script)
    else:
        print("⚠️ Virtual environment not found, using system Python")
        fallback_start_server(server_script)

def fallback_start_server(server_script):
    """Fall back to starting the server with the system Python."""
    print(f"Using system Python executable: {sys.executable}")
    try:
        # Run with the current Python interpreter
        subprocess.run([sys.executable, server_script])
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        print("\nAlternative: You can try running these commands manually:")
        print(f"pip install flask numpy librosa")
        print(f"python {server_script}")

if __name__ == "__main__":
    print("🎵🎮 MusicGame Startup")
    
    # Check if running from virtual environment
    venv_info = get_venv_info()
    in_venv = hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)
    
    if venv_info["exists"] and not in_venv:
        print("🔄 Virtual environment detected but not activated")
        print(f"To activate manually: {venv_info['activate_cmd']}")
    
    check_dependencies()
    ensure_directories()
    copy_frontend_if_empty()
    run_fix_filenames()  # Run the filename fixer before starting the server
    initialize_high_scores()  # Initialize high scores for all songs
    start_server()
