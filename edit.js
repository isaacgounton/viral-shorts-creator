import { spawn } from "child_process";

export function editVideo(duration) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      "video.mp4",
      "-t",
      duration.toString(), // Trim video to exact duration (audio + 1.2s)
      "-af",
      `volume=0.1`, // Keep original video audio low throughout
      "-y", // Overwrite output file
      "input.mp4",
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
