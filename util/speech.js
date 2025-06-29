import { writeFile } from "fs/promises";

const EDGE_TTS_URL = process.env.EDGE_TTS_URL || "http://localhost:5050";
const EDGE_TTS_API_KEY = process.env.EDGE_TTS_API_KEY || "your_api_key_here";

export default async function generateAudio(text, voice = "en-US-AvaNeural", jobId = null) {
  try {
    const response = await fetch(`${EDGE_TTS_URL}/v1/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${EDGE_TTS_API_KEY}`,
      },
      body: JSON.stringify({
        input: text,
        voice: voice, // Use the selected voice
        response_format: "mp3",
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      throw new Error(`Edge TTS API error: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const filename = jobId ? `./speech_${jobId}.mp3` : "./speech.mp3";
    await writeFile(filename, Buffer.from(audioBuffer));
    console.log(`Audio generated successfully with voice: ${voice}`);
  } catch (error) {
    console.error("Error generating audio with Edge TTS:", error);
    throw error;
  }
}

