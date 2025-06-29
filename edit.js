import { spawn } from "child_process";

export function editVideo(duration, jobId = null) {
  return new Promise((resolve, reject) => {
    const inputFile = jobId ? `video_${jobId}.mp4` : "video.mp4";
    const outputFile = jobId ? `input_${jobId}.mp4` : "input.mp4";
    
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      inputFile,
      "-t",
      duration.toString(), // Trim video to exact duration (audio + 1.2s)
      "-af",
      `volume=0.1`, // Keep original video audio low throughout
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
