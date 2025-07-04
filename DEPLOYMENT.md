# Deployment Guide

## Quick Deploy with Docker

### 1. Environment Variables
Set these environment variables:

```bash
export GEMINI_API_KEY=your_gemini_api_key
export EDGE_TTS_URL=https://your-edge-tts-server.com
export EDGE_TTS_API_KEY=your_edge_tts_api_key
export PORT=3000
```

### 2. Build and Run
```bash
# Build the Docker image
docker build -t viral-shorts-creator .

# Run the container
docker run -d \
  --name viral-shorts-creator \
  -p 3000:3000 \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  -e EDGE_TTS_URL=$EDGE_TTS_URL \
  -e EDGE_TTS_API_KEY=$EDGE_TTS_API_KEY \
  viral-shorts-creator
```

### 3. Using Docker Compose
```bash
# Start the service
docker compose up -d

# Check health
docker compose ps

# View logs
docker compose logs -f
```

## API Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### Get Available Voices
```bash
curl http://localhost:3000/api/voices?language=en
```

### Generate Shorts (Get Download Link)
```bash
curl -X POST http://localhost:3000/api/generate-shorts \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://youtube.com/watch?v=example",
    "context": "This is a tutorial video",
    "language": "en",
    "voice": "en-US-AvaNeural",
    "cookies_url": "https://your-server.com/youtube-cookies.txt"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Shorts generated successfully",
  "jobId": "12345678-1234-1234-1234-123456789abc",
  "downloadUrl": "/api/download/12345678-1234-1234-1234-123456789abc",
  "language": "en-US",
  "voice": "en-US-AvaNeural"
}
```

### Generate Shorts (Return Video File Directly)
```bash
curl -X POST http://localhost:3000/api/generate-shorts \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://youtube.com/watch?v=example",
    "context": "This is a tutorial video",
    "language": "en",
    "voice": "en-US-AvaNeural",
    "cookies_url": "https://your-server.com/youtube-cookies.txt",
    "return_file": true
  }' \
  --output shorts.mp4
```

### Download Generated Video
```bash
curl http://localhost:3000/api/download/12345678-1234-1234-1234-123456789abc \
  --output shorts.mp4
```

**API Parameters:**
- `url` (required): YouTube video URL
- `context` (optional): Additional context for script generation
- `language` (optional): Language code (en, es, fr, de, ja, etc.) - defaults to "en"
- `voice` (optional): Specific voice name - if not provided, uses default for language
- `cookies_url` (optional): URL to download YouTube cookies file (required for some videos due to bot detection)
- `return_file` (optional): If true, returns the video file directly instead of download link

**Getting YouTube Cookies:**
1. Export cookies from your browser using a browser extension
2. Host the cookies.txt file on a accessible URL
3. Pass the URL in the `cookies_url` parameter

## Health Monitoring

The service includes:
- Health check endpoint at `/health`
- Docker health checks
- Restart policies
- Logging with Morgan

## Production Notes

1. **Resource Requirements**:
   - CPU: 2+ cores recommended
   - RAM: 4GB+ recommended  
   - Storage: 10GB+ for temporary files

2. **Dependencies**:
   - FFmpeg for video processing
   - Python3 + yt-dlp for video downloads
   - Node.js 20+ for the application

3. **Security**:
   - API keys are passed as environment variables
   - CORS is enabled
   - Helmet security headers are applied