import downloadVideo from "./download.js";
import { editAudio, editVideo } from "./edit.js";
import addAudioToVideo from "./ffmpeg.js";
import deleteFile from "./file.js";
import { uploadVideo } from "./upload.js";
import getAudioDuration from "./util/audio.js";
import { generateContent } from "./util/gemini.js";
import generateAudio from "./util/speech.js";

export default async function generateShorts(url, context, voice = "en-US-AvaNeural", language = "en-US") {
  await downloadVideo(url);
  const upload = await uploadVideo("./video.mp4", "Video");
  const script = await generateContent(upload, context, language);
  
  const scriptData = JSON.parse(script);
  const fullText = scriptData["hook"] + " " + scriptData["script"];
  
  await generateAudio(fullText, voice);
  
  const audioDuration = await getAudioDuration("./speech.mp3");
  console.log(`Audio duration: ${audioDuration} seconds`);

  // Add 1200ms (1.2 seconds) buffer after audio ends
  const totalVideoDuration = audioDuration + 1.2;
  
  await editVideo(totalVideoDuration);
  await addAudioToVideo();

  deleteFile("./video.mp4");
  deleteFile("./speech.mp3");
}
