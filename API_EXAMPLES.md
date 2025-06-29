# API Examples

## Generate Shorts from URL

### YouTube URLs (Optimized Processing)
```bash
curl -X POST http://localhost:3000/api/generate-shorts \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "context": "Viral content for social media",
    "language": "en",
    "voice": "en-US-AvaNeural",
    "format": "portrait"
  }'
```

**⚡ Smart Processing**: YouTube URLs automatically attempt direct processing via Gemini's video understanding API first (faster), with automatic fallback to download method for reliability.

### Direct Video URLs (.mp4, .webm, etc.)
```bash
curl -X POST http://localhost:3000/api/generate-shorts \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/video.mp4",
    "context": "Transform this video into viral content",
    "language": "en",
    "format": "landscape"
  }'
```

## Generate Shorts from Uploaded Video

```bash
curl -X POST http://localhost:3000/api/generate-shorts-upload \
  -F "video=@/path/to/your/video.mp4" \
  -F "context=Create engaging short content" \
  -F "language=en" \
  -F "voice=en-US-AvaNeural" \
  -F "format=square"
```

## Get Available Voices

### All voices
```bash
curl http://localhost:3000/api/voices
```

### Voices for specific language
```bash
curl http://localhost:3000/api/voices?language=es
```

## Download Generated Video

```bash
curl -O http://localhost:3000/api/download/{jobId}
```

## Video Output Formats

Choose the aspect ratio that fits your target social media platform:

### Available Formats
- **`portrait`** - 1080x1920 (9:16) - Perfect for TikTok, Instagram Reels, YouTube Shorts
- **`landscape`** - 1920x1080 (16:9) - Ideal for YouTube, Twitter, Facebook videos  
- **`square`** - 1080x1080 (1:1) - Great for Instagram feed posts, Twitter videos

### Format Examples
```json
{
  "format": "portrait"   // Default - optimized for vertical mobile viewing
  "format": "landscape"  // Traditional horizontal video format
  "format": "square"     // Square format for social media feeds
}
```

## Generate Clips from URL (Intelligent Analysis)

### Analyze video and find best clips
```bash
curl -X POST http://localhost:3000/api/generate-clips \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "clipDuration": 60,
    "maxClips": 10,
    "overlap": 30,
    "weights": {
      "audio": 0.4,
      "visual": 0.3,
      "motion": 0.3
    }
  }'
```

**Features**: Analyzes video using audio energy, scene changes, and motion detection to find the most engaging clips.

### Upload video for clip analysis
```bash
curl -X POST http://localhost:3000/api/generate-clips-upload \
  -F "video=@/path/to/your/video.mp4" \
  -F "clipDuration=90" \
  -F "maxClips=5" \
  -F "overlap=45"
```

### Get analyzed clips
```bash
curl http://localhost:3000/api/jobs/{jobId}/clips
```

### Download specific clip
```bash
curl -O http://localhost:3000/api/jobs/{jobId}/clips/{clipId}/download
```

### Extract and download multiple clips
```bash
curl -X POST http://localhost:3000/api/jobs/{jobId}/extract-clips \
  -H "Content-Type: application/json" \
  -d '{
    "clipIds": ["clip_30_90", "clip_120_180", "clip_240_300"]
  }'
```

## Supported Input Sources

### YouTube URLs (Optimized Processing)
- `youtube.com/watch?v=` - Standard YouTube videos
- `youtu.be/` - Short YouTube URLs  
- `youtube.com/shorts/` - YouTube Shorts
- `m.youtube.com/watch?v=` - Mobile YouTube URLs

**Smart Processing**: Attempts direct processing via Gemini's video understanding API first for speed, automatically falls back to download method if needed for reliability.

### Direct Video URL Support
- .mp4, .webm, .avi, .mov, .mkv, .flv, .wmv, .m4v, .3gp

### File Upload Support
All video formats supported by FFmpeg are automatically converted to MP4.

### Other Video Platforms
Non-YouTube URLs are processed via yt-dlp (supports 1000+ sites including Vimeo, TikTok, Instagram, etc.)

## 🎯 Clip Analysis Features

**Intelligent Video Analysis:**

- **Audio Energy Analysis**: Detects high-energy speech, music, and sound patterns
- **Scene Change Detection**: Identifies dynamic visual transitions and cuts
- **Motion Analysis**: Measures movement and visual activity levels
- **Composite Scoring**: Combines all metrics with customizable weights

**Configurable Parameters:**

- **Clip Duration**: 10-300 seconds (default: 60 seconds)
- **Maximum Clips**: 1-20 clips returned (default: 10)
- **Overlap**: Sliding window overlap in seconds (default: 30)
- **Analysis Weights**: Customize audio/visual/motion importance

**Smart Features:**

- **Position-Based Scoring**: Boosts opening/closing segments and peak content areas
- **Quality Labels**: Excellent/Good/Fair/Poor based on composite scores
- **Human-Readable Reasons**: Explains why each clip scored well
- **Ranked Results**: Clips sorted by engagement potential

## ⚡ Performance Optimizations

**Intelligent Quality Management:**

- Videos automatically limited to 1080p maximum resolution during download
- Smart resolution scaling prevents processing of unnecessarily large files
- FFmpeg encoding optimized for speed with social media quality standards

**Processing Speed Improvements:**

- **40-70% faster** processing for high-resolution input videos
- Optimized encoding settings (`-preset fast`, `-crf 23`)
- Bitrate limiting (2Mbps max) perfect for social media platforms
- Stream copying where possible to avoid re-encoding

**Quality Maintained:**

- Output quality optimized for social media (TikTok, Instagram, YouTube Shorts)
- No visible quality loss for target platforms
- Faster file streaming with `+faststart` optimization

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Job created successfully",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "statusUrl": "/api/jobs/550e8400-e29b-41d4-a716-446655440000/status",
  "downloadUrl": "/api/jobs/550e8400-e29b-41d4-a716-446655440000/download",
  "language": "en-US",
  "voice": "en-US-AvaNeural",
  "format": "portrait"
}
```

### Job Status Response (when completed)

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:02:30.000Z",
  "completedAt": "2024-01-15T10:02:30.000Z",
  "downloadUrl": "/api/jobs/550e8400-e29b-41d4-a716-446655440000/download",
  "videoUrl": "/api/jobs/550e8400-e29b-41d4-a716-446655440000/download",
  "hook": "Would you risk it all to save a life?",
  "script": "This selfless man jumped into a pond to save a drowning toddler without hesitation..."
}
```

### Clip Analysis Response

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "clips": [
    {
      "id": "clip_30_90",
      "start": 30.5,
      "end": 90.5,
      "duration": 60,
      "score": 0.85,
      "scoreLabel": "Excellent",
      "rank": 1,
      "metrics": {
        "audioEnergy": 0.82,
        "sceneChanges": 0.74,
        "motionLevel": 0.91
      },
      "reasons": ["High audio energy", "Dynamic scene changes", "High motion content", "Peak content area"]
    }
  ],
  "totalClips": 10,
  "config": {
    "clipDuration": 60,
    "maxClips": 10,
    "overlap": 30,
    "weights": {
      "audio": 0.4,
      "visual": 0.3,
      "motion": 0.3
    }
  }
}
```

### Error Response

```json
{
  "error": "Failed to generate shorts",
  "details": "Error details here"
}
```

## Health Check

```bash
curl http://localhost:3000/health
```

## Environment Variables

- `EDGE_TTS_URL`: OpenAI Edge TTS service URL
- `EDGE_TTS_API_KEY`: API key for Edge TTS
- `GEMINI_API_KEY`: Google Gemini API key for script generation
- `PORT`: Server port (default: 3000)
