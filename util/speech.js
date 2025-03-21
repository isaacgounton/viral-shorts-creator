import { ElevenLabsClient,play } from "elevenlabs";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.EL_KEY, // Defaults to process.env.ELEVENLABS_API_KEY
});

import { writeFile } from "fs/promises";

export default async function generateAudio(text) {
  const audio = await elevenlabs.generate({
    voice: "iiidtqDt9FBdT1vfBluA",
    text: text,
    model_id: "eleven_turbo_v2_5",
  });
  // Save the audio buffer as an MP3 file
  await writeFile("./speech.mp3", audio);
}

