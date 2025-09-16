FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

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
