import { spawn } from "child_process";

export function editVideo(time) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      "video.mp4",
      "-af",
      `volume=0.1:enable='between(t,0,${time})',volume=0.7:enable='gt(t,${time})'`,
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
