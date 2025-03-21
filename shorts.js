import downloadVideo from "./download.js";
import { editAudio, editVideo } from "./edit.js";
import addAudioToVideo from "./ffmpeg.js";
import deleteFile from "./file.js";
import { uploadVideo } from "./upload.js";
import getAudioDuration from "./util/audio.js";
import { generateContent } from "./util/gemini.js";
import generateAudio from "./util/speech.js";

export default async function generateShorts(url, context) {
  await downloadVideo(url);
  const upload = await uploadVideo("./video.mp4", "Video");
  const script = await generateContent(upload, context);
  await generateAudio(
    JSON.parse(script)["hook"] + JSON.parse(script)["script"]
  );
  // const audioDuration = await getAudioDuration("./speech.wav");

  // await editVideo(audioDuration);
  // await editAudio();

  await addAudioToVideo();

  deleteFile("./video.mp4");
  deleteFile("./speech.mp3");
}
