import downloadVideo from "./download.js";
import { editAudio, editVideo } from "./edit.js";
import addAudioToVideo from "./ffmpeg.js";
import deleteFile from "./file.js";
import { uploadVideo } from "./upload.js";
import getAudioDuration from "./util/audio.js";
import { generateContent, generateContentFromYouTubeUrl, isYouTubeUrl } from "./util/gemini.js";
import generateAudio from "./util/speech.js";
import { updateJobStatus } from "./server.js";

export default async function generateShorts(url, context, voice = "en-US-AvaNeural", language = "en-US", cookiesUrl = null, jobId = null, format = 'portrait') {
  const videoFile = jobId ? `./video_${jobId}.mp4` : "./video.mp4";
  const audioFile = jobId ? `./speech_${jobId}.mp3` : "./speech.mp3";
  const inputFile = jobId ? `./input_${jobId}.mp4` : "./input.mp4";
  const outputFile = jobId ? `./output_${jobId}.mp4` : "./output.mp4";

  let script;
  let useDirectProcessing = false;
  
  // For YouTube URLs, try direct processing first, fallback to download if it fails
  if (isYouTubeUrl(url)) {
    try {
      console.log(`Trying YouTube direct processing for: ${url}`);
      script = await generateContentFromYouTubeUrl(url, context, language);
      console.log(`YouTube direct processing successful`);
      useDirectProcessing = true;
    } catch (error) {
      console.log(`YouTube direct processing failed, falling back to download method:`, error.message);
      useDirectProcessing = false;
    }
  }
  
  // If direct processing failed or it's not a YouTube URL, use download method
  if (!useDirectProcessing) {
    await downloadVideo(url, cookiesUrl, jobId);
    const upload = await uploadVideo(videoFile, "Video");
    script = await generateContent(upload, context, language);
  } else {
    // For successful YouTube direct processing, we still need to download for video editing
    await downloadVideo(url, cookiesUrl, jobId);
  }
  
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
