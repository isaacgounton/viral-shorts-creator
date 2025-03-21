import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

// Initialize GoogleAIFileManager with your GEMINI_API_KEY.
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

export async function uploadVideo(filePath, fileName) {
  // Upload the file and specify a display name.
  const uploadResponse = await fileManager.uploadFile(filePath, {
    mimeType: "video/mp4",
    displayName: fileName,
  });
  const name = uploadResponse.file.name;

  // Poll getFile() on a set interval (10 seconds here) to check file state.
  let file = await fileManager.getFile(name);

  while (file.state === FileState.PROCESSING) {
    process.stdout.write(".");
    // Sleep for 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    // Fetch the file from the API again
    file = await fileManager.getFile(name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error("Video processing failed.");
  }
  return uploadResponse;
}
