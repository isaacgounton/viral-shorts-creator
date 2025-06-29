import { spawn } from "child_process";

// Helper function to get optimized video filter for different formats
function getOptimizedVideoFilter(format) {
  // Pre-limit resolution to avoid processing massive files, then apply format-specific scaling
  const baseOptimization = "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease";
  
  let formatFilter;
  switch (format) {
    case 'portrait':
      formatFilter = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
      break;
    case 'landscape':
      formatFilter = 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080';
      break;
    case 'square':
      formatFilter = 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080';
      break;
    default:
      formatFilter = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920'; // Default to portrait
  }
  
  return `${baseOptimization},${formatFilter}`;
}

export function editVideo(duration, jobId = null, format = 'portrait') {
  return new Promise((resolve, reject) => {
    const inputFile = jobId ? `video_${jobId}.mp4` : "video.mp4";
    const outputFile = jobId ? `input_${jobId}.mp4` : "input.mp4";
    
    const optimizedVideoFilter = getOptimizedVideoFilter(format);
    
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      inputFile,
      "-t",
      duration.toString(), // Trim video to exact duration (audio + 1.2s)
      "-vf",
      optimizedVideoFilter, // Apply resolution optimization + aspect ratio and cropping
      "-af",
      `volume=0.1`, // Keep original video audio low throughout
      // Video encoding optimizations for speed
      "-c:v", "libx264",     // Use H.264 codec
      "-preset", "fast",     // Faster encoding (vs 'medium' default)
      "-crf", "23",          // Good quality/speed balance (18-28 range, lower = better quality)
      "-maxrate", "2M",      // Limit bitrate to 2Mbps (plenty for social media)
      "-bufsize", "4M",      // Buffer size for rate control
      "-movflags", "+faststart", // Optimize for web streaming
      "-y", // Overwrite output file
      outputFile,
    ]);

    ffmpeg.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });

    ffmpeg.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    ffmpeg.on("close", (code) => {
      console.log(`child process exited with code ${code}`);
      resolve(code);
    });

    ffmpeg.on("error", (error) => {
      reject(error);
    });
  });
}
export function editAudio() {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      "speech.wav",
      "-filter:a",
      "volume=1.5",
      "input.wav",
    ]);

    ffmpeg.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });

    ffmpeg.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    ffmpeg.on("close", (code) => {
      console.log(`Process exited with code ${code}`);
      resolve(code);
    });

    ffmpeg.on("error", (error) => {
      reject(error);
    });
  });
}
