import { spawn } from "child_process";

export default function downloadVideo(url) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", ["D:/YouTube/download.py", url]);

    pythonProcess.stdout.on("data", (data) => {
      console.log(`Output: ${data}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`Error: ${data}`);
    });

    pythonProcess.on("close", (code) => {
      console.log(`Process exited with code ${code}`);
      if (code === 0) {
        resolve(); // Resolve when the process exits successfully
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}
