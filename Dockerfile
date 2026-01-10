FROM python:3.10-slim

# Install system dependencies (--no-install-recommends reduces memory usage during build)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    gcc \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies with extended timeout for slow networks
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 300 -r requirements.txt

# Copy application files (excluding directories that will be mounted)
COPY server ./server
COPY client ./client
COPY *.py ./

# Keep core music (Blood Ocean) but create directory structure for additional music
RUN mkdir -p data/uploads data/processed

# Expose the port the app runs on
EXPOSE 8080

# Set the app name environment variable
ENV APP_NAME="ReactOverdrive"

# Command to run the application
CMD ["python", "server/api_server.py"]
