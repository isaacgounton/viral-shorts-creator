import fs from 'fs';
import { editAudio, editVideo } from "./edit.js";
import addAudioToVideo from "./ffmpeg.js";
import deleteFile from "./file.js";
import { uploadVideo } from "./upload.js";
import getAudioDuration from "./util/audio.js";
import { generateContent } from "./util/gemini.js";
import generateAudio from "./util/speech.js";
import { updateJobStatus } from "./server.js";

export default async function generateShortsFromVideo(context, voice = "en-US-AvaNeural", language = "en-US", jobId = null, format = 'portrait') {
  const videoFile = jobId ? `./video_${jobId}.mp4` : "./video.mp4";
  const audioFile = jobId ? `./speech_${jobId}.mp3` : "./speech.mp3";
  const inputFile = jobId ? `./input_${jobId}.mp4` : "./input.mp4";
  const outputFile = jobId ? `./output_${jobId}.mp4` : "./output.mp4";

  // Video file should already exist from handleVideoSource
  if (!fs.existsSync(videoFile)) {
    throw new Error(`Video file not found: ${videoFile}`);
  }

  const upload = await uploadVideo(videoFile, "Video");
  const script = await generateContent(upload, context, language);
  
  const scriptData = JSON.parse(script);
  const fullText = scriptData["hook"] + " " + scriptData["script"];
  
  // Store hook and script data in job status if jobId is provided
  if (jobId) {
    updateJobStatus(jobId, "processing", {
      progress: 40,
      hook: scriptData["hook"],
      script: scriptData["script"]
    });
  }
  
  await generateAudio(fullText, voice, jobId);
  
  const audioDuration = await getAudioDuration(audioFile);
  console.log(`Audio duration: ${audioDuration} seconds`);

  // Add 1200ms (1.2 seconds) buffer after audio ends
  const totalVideoDuration = audioDuration + 1.2;
  
  await editVideo(totalVideoDuration, jobId, format);
  await addAudioToVideo(jobId);

  // Clean up intermediate files but keep the final output
  deleteFile(videoFile);
  deleteFile(audioFile);
  deleteFile(inputFile);

  return outputFile;
}