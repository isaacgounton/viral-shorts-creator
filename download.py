import sys
import yt_dlp

def download_video(video_url):
    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',  # Select best video and audio quality
        'outtmpl': 'video',         # Use the video title for the filename
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',            # Convert to mp4 format
        }],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([video_url])

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python download_video.py <video_url>")
    else:
        video_url = sys.argv[1]
        download_video(video_url)
