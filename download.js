import { spawn } from "child_process";

export default function downloadVideo(url, cookiesUrl = null, jobId = null) {
  return new Promise((resolve, reject) => {
    const args = ["./download.py", url];
    
    // Always pass cookies_url (or empty string) and job_id to maintain order
    args.push(cookiesUrl || "");
    if (jobId) {
      args.push(jobId);
    }
    
    const pythonProcess = spawn("python", args);

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
