import 'dotenv/config';
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import generateShorts from "./shorts.js";
import { selectVoiceInteractively, detectLanguageFromCode, getVoicesForLanguage, getAvailableVoices } from "./util/voice-selector.js";

// Create readline interface
const rl = readline.createInterface({ input, output });

async function main() {
  try {
    const url = await rl.question("URL: ");
    let context = await rl.question("Context: ");
    if (context.trim().length > 0) {
      context = "context: " + context;
    }

    // Cookies URL (optional)
    const cookiesUrl = await rl.question("Cookies URL (optional, press Enter to skip): ");

    // Language detection and voice selection
    const languageInput = await rl.question("Language (e.g., en, es, fr, de, ja, or en-US): ");
    const detectedLanguage = detectLanguageFromCode(languageInput || 'en');
    console.log(`Detected language: ${detectedLanguage}`);

    // Get available voices for the language
    const allVoices = await getAvailableVoices();
    const languageVoices = getVoicesForLanguage(allVoices, detectedLanguage);

    if (languageVoices.length === 0) {
      console.log(`No voices found for ${detectedLanguage}, using English voices.`);
      const englishVoices = getVoicesForLanguage(allVoices, 'en-US');
      console.log("\nAvailable English voices:");
      englishVoices.forEach((voice, index) => {
        console.log(`${index + 1}. ${voice.name} (${voice.gender})`);
      });
      
      const voiceChoice = await rl.question("Select voice number: ");
      const selectedVoice = englishVoices[parseInt(voiceChoice) - 1] || englishVoices[0];
      
      await generateShorts(url, context, selectedVoice.name, 'en-US', cookiesUrl || null);
    } else {
      console.log(`\nAvailable voices for ${detectedLanguage}:`);
      languageVoices.forEach((voice, index) => {
        console.log(`${index + 1}. ${voice.name} (${voice.gender})`);
      });
      
      const voiceChoice = await rl.question("Select voice number: ");
      const selectedVoice = languageVoices[parseInt(voiceChoice) - 1] || languageVoices[0];
      
      await generateShorts(url, context, selectedVoice.name, detectedLanguage, cookiesUrl || null);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    rl.close();
  }
}

main();
