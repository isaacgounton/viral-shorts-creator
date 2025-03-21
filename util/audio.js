import { parseFile } from "music-metadata";

export default async function getAudioDuration(filePath) {
  try {
    const metadata = await parseFile(filePath);
    return Math.ceil(metadata.format.duration);
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}
