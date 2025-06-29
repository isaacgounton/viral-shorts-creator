import sys
import yt_dlp
import os
import tempfile
import requests

def download_video(video_url, cookies_url=None, job_id=None):
    filename = f'video_{job_id}' if job_id else 'video'
    ydl_opts = {
        # Optimize format selection for faster processing - limit to 1080p max
        'format': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        'outtmpl': filename,         # Use the video title for the filename
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',            # Convert to mp4 format
        }],
        # Additional optimizations for speed
        'writesubtitles': False,     # Skip subtitle download for speed
        'writeautomaticsub': False,  # Skip auto-generated subtitles
        'writethumbnail': False,     # Skip thumbnail download
    }
    
    # Handle cookies if provided
    if cookies_url:
        try:
            # Download cookies from URL
            response = requests.get(cookies_url)
            response.raise_for_status()
            
            # Create temporary cookies file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(response.text)
                cookies_file = f.name
            
            ydl_opts['cookiefile'] = cookies_file
            print(f"Using cookies from: {cookies_url}")
            
        except Exception as e:
            print(f"Warning: Failed to download cookies from {cookies_url}: {e}")
            print("Proceeding without cookies...")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            ydl.download([video_url])
        finally:
            # Clean up temporary cookies file
            if cookies_url and 'cookiefile' in ydl_opts:
                try:
                    os.unlink(ydl_opts['cookiefile'])
                except:
                    pass

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python download_video.py <video_url> [cookies_url] [job_id]")
    else:
        video_url = sys.argv[1]
        cookies_url = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None
        job_id = sys.argv[3] if len(sys.argv) > 3 else None
        
        download_video(video_url, cookies_url, job_id)
