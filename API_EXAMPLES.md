# API Examples

## Generate Shorts from URL

### YouTube/yt-dlp compatible URLs
```bash
curl -X POST http://localhost:3000/api/generate-shorts \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "context": "Viral content for social media",
    "language": "en",
    "voice": "en-US-AvaNeural"
  }'
```

### Direct Video URLs (.mp4, .webm, etc.)
```bash
curl -X POST http://localhost:3000/api/generate-shorts \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/video.mp4",
    "context": "Transform this video into viral content",
    "language": "en"
  }'
```

## Generate Shorts from Uploaded Video

```bash
curl -X POST http://localhost:3000/api/generate-shorts-upload \
  -F "video=@/path/to/your/video.mp4" \
  -F "context=Create engaging short content" \
  -F "language=en" \
  -F "voice=en-US-AvaNeural"
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

## Supported Video Formats

### Direct URL Support
- .mp4
- .webm
- .avi
- .mov
- .mkv
- .flv
- .wmv
- .m4v
- .3gp

### Upload Support
All video formats supported by FFmpeg are automatically converted to MP4.

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Shorts generated successfully",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "downloadUrl": "/api/download/550e8400-e29b-41d4-a716-446655440000",
  "language": "en-US",
  "voice": "en-US-AvaNeural"
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