import { writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";

const EDGE_TTS_URL = process.env.EDGE_TTS_URL || "http://localhost:5050";
const EDGE_TTS_API_KEY = process.env.EDGE_TTS_API_KEY || "your_api_key_here";

// Cache voices to avoid repeated API calls
const VOICE_CACHE_FILE = "./voices-cache.json";

// Language detection mapping from common language codes
const LANGUAGE_MAPPING = {
  // English variants
  'en': 'en-US', 'eng': 'en-US',
  // Spanish variants
  'es': 'es-ES', 'spa': 'es-ES', 'español': 'es-ES',
  // French variants
  'fr': 'fr-FR', 'fra': 'fr-FR', 'français': 'fr-FR',
  // German variants
  'de': 'de-DE', 'ger': 'de-DE', 'deutsch': 'de-DE',
  // Italian variants
  'it': 'it-IT', 'ita': 'it-IT', 'italiano': 'it-IT',
  // Portuguese variants
  'pt': 'pt-PT', 'por': 'pt-PT', 'português': 'pt-PT',
  'pt-br': 'pt-BR', 'portuguese-brazil': 'pt-BR',
  // Japanese variants
  'ja': 'ja-JP', 'jp': 'ja-JP', 'jpn': 'ja-JP', '日本語': 'ja-JP',
  // Chinese variants
  'zh': 'zh-CN', 'cn': 'zh-CN', 'chi': 'zh-CN', '中文': 'zh-CN',
  'zh-tw': 'zh-TW', 'tw': 'zh-TW', 'traditional-chinese': 'zh-TW',
  // Korean variants
  'ko': 'ko-KR', 'kr': 'ko-KR', 'kor': 'ko-KR', '한국어': 'ko-KR',
  // Arabic variants
  'ar': 'ar-SA', 'ara': 'ar-SA', 'العربية': 'ar-SA',
  // Russian variants
  'ru': 'ru-RU', 'rus': 'ru-RU', 'русский': 'ru-RU',
  // Hindi variants
  'hi': 'hi-IN', 'hin': 'hi-IN', 'हिंदी': 'hi-IN',
  // Dutch variants
  'nl': 'nl-NL', 'dut': 'nl-NL', 'nederlands': 'nl-NL',
  // Swedish variants
  'sv': 'sv-SE', 'swe': 'sv-SE', 'svenska': 'sv-SE',
  // Norwegian variants
  'no': 'nb-NO', 'nor': 'nb-NO', 'norsk': 'nb-NO',
};

export async function getAvailableVoices() {
  // Check cache first
  if (existsSync(VOICE_CACHE_FILE)) {
    try {
      const cached = await readFile(VOICE_CACHE_FILE, 'utf-8');
      const cacheData = JSON.parse(cached);
      // Cache for 1 hour
      if (Date.now() - cacheData.timestamp < 3600000) {
        return cacheData.voices;
      }
    } catch (error) {
      console.log("Cache file invalid, fetching fresh voices...");
    }
  }

  // Fetch from API
  try {
    const response = await fetch(`${EDGE_TTS_URL}/v1/voices/all`, {
      headers: {
        "Authorization": `Bearer ${EDGE_TTS_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    const voices = data.voices;

    // Cache the result
    await writeFile(VOICE_CACHE_FILE, JSON.stringify({
      voices,
      timestamp: Date.now()
    }));

    return voices;
  } catch (error) {
    console.error("Error fetching voices:", error);
    // Return some default voices if API fails
    return [
      { name: "en-US-AvaNeural", language: "en-US", gender: "Female" },
      { name: "en-US-AndrewNeural", language: "en-US", gender: "Male" },
      { name: "es-ES-ElviraNeural", language: "es-ES", gender: "Female" },
      { name: "fr-FR-DeniseNeural", language: "fr-FR", gender: "Female" },
    ];
  }
}

export function detectLanguageFromCode(languageInput) {
  if (!languageInput) return 'en-US';
  
  const normalized = languageInput.toLowerCase().trim();
  
  // Direct match (e.g., "en-US")
  if (normalized.includes('-') && normalized.length >= 5) {
    return languageInput;
  }
  
  // Map from common codes
  return LANGUAGE_MAPPING[normalized] || 'en-US';
}

export function getVoicesForLanguage(voices, languageCode) {
  const targetLanguage = detectLanguageFromCode(languageCode);
  return voices.filter(voice => voice.language === targetLanguage);
}

export function groupVoicesByLanguage(voices) {
  const grouped = {};
  voices.forEach(voice => {
    if (!grouped[voice.language]) {
      grouped[voice.language] = [];
    }
    grouped[voice.language].push(voice);
  });
  return grouped;
}

export async function selectVoiceInteractively(languageCode = null) {
  const voices = await getAvailableVoices();
  
  if (languageCode) {
    const languageVoices = getVoicesForLanguage(voices, languageCode);
    if (languageVoices.length > 0) {
      console.log(`\nAvailable voices for ${detectLanguageFromCode(languageCode)}:`);
      languageVoices.forEach((voice, index) => {
        console.log(`${index + 1}. ${voice.name} (${voice.gender})`);
      });
      return languageVoices;
    }
  }
  
  // Show all voices grouped by language
  const grouped = groupVoicesByLanguage(voices);
  console.log("\nAvailable languages and voices:");
  
  let voiceIndex = 1;
  const allVoices = [];
  
  Object.keys(grouped).sort().forEach(lang => {
    console.log(`\n${lang}:`);
    grouped[lang].forEach(voice => {
      console.log(`  ${voiceIndex}. ${voice.name} (${voice.gender})`);
      allVoices.push(voice);
      voiceIndex++;
    });
  });
  
  return allVoices;
}