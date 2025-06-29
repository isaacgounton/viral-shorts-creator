import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import downloadVideo from '../download.js';

// Function to detect if URL is a direct video file
export function isDirectVideoUrl(url) {
  const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v', '.3gp'];
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    return videoExtensions.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

// Function to download direct video file
export function downloadDirectVideo(url, jobId = null) {
  return new Promise((resolve, reject) => {
    const filename = jobId ? `video_${jobId}.mp4` : 'video.mp4';
    
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(buffer => {
        fs.writeFileSync(filename, Buffer.from(buffer));
        console.log(`Direct video downloaded: ${filename}`);
        resolve();
      })
      .catch(error => {
        console.error('Error downloading direct video:', error);
        reject(error);
      });
  });
}

// Function to convert video to MP4 format
export function convertToMp4(inputFile, outputFile) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputFile,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'fast',
      '-crf', '23',
      '-y', // Overwrite output file
      outputFile
    ]);

    ffmpeg.stdout.on('data', (data) => {
      console.log(`FFmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
      console.error(`FFmpeg stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });
  });
}

// Function to handle uploaded video file
export async function handleUploadedVideo(file, jobId = null) {
  const filename = jobId ? `video_${jobId}.mp4` : 'video.mp4';
  const tempFile = file.path;
  
  try {
    // Check if the uploaded file needs conversion
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (fileExtension === '.mp4') {
      // Just move/rename the file
      fs.renameSync(tempFile, filename);
      console.log(`Video file ready: ${filename}`);
    } else {
      // Convert to MP4
      console.log(`Converting ${fileExtension} to MP4...`);
      await convertToMp4(tempFile, filename);
      // Clean up temp file
      fs.unlinkSync(tempFile);
      console.log(`Video converted and ready: ${filename}`);
    }
  } catch (error) {
    // Clean up temp file if conversion fails
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    throw error;
  }
}

// Main function to handle any video source
export async function handleVideoSource(source, type = 'url', cookiesUrl = null, jobId = null) {
  switch (type) {
    case 'direct_url':
      await downloadDirectVideo(source, jobId);
      break;
      
    case 'youtube_url':
      await downloadVideo(source, cookiesUrl, jobId);
      break;
      
    case 'upload':
      await handleUploadedVideo(source, jobId);
      break;
      
    case 'auto': // Auto-detect URL type
    default:
      if (isDirectVideoUrl(source)) {
        console.log('Detected direct video URL');
        await downloadDirectVideo(source, jobId);
      } else {
        console.log('Detected YouTube/yt-dlp compatible URL');
        await downloadVideo(source, cookiesUrl, jobId);
      }
      break;
  }
}