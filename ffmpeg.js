import { spawn } from "child_process";

export default function addAudioToVideo() {
  return new Promise((resolve, reject) => {
    const outputPath = "./" + Date.now() + ".mp4";
    const ffmpegArgs = [
      "-i",
      "video.mp4", // Input video
      "-i",
      "speech.mp3", // Input audio
      "-filter_complex",
      "[0:a]volume=0.3[a0];[1:a]volume=1.5[a1];[a0][a1]amix=inputs=2:duration=first[a]",
      "-map",
      "0:v",
      "-map",
      "[a]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      outputPath,
    ];
    const ffmpegProcess = spawn("ffmpeg", ffmpegArgs);

    ffmpegProcess.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });

    ffmpegProcess.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    ffmpegProcess.on("close", (code) => {
      console.log(`ffmpeg process exited with code ${code}`);
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`ffmpeg process exited with code ${code}`));
      }
    });
  });
}
