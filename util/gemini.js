import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const generationConfig = {
  temperature: 0.9,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: {
      hook: {
        type: "string",
      },
      script: {
        type: "string",
      },
    },
    required: ["hook", "script"],
  },
};

function getSystemInstruction(language) {
  const languageNames = {
    'en-US': 'English',
    'es-ES': 'Spanish',
    'fr-FR': 'French',
    'de-DE': 'German',
    'it-IT': 'Italian',
    'pt-PT': 'Portuguese',
    'pt-BR': 'Portuguese (Brazilian)',
    'ja-JP': 'Japanese',
    'ko-KR': 'Korean',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'ar-SA': 'Arabic',
    'ru-RU': 'Russian',
    'hi-IN': 'Hindi',
    'nl-NL': 'Dutch',
    'sv-SE': 'Swedish',
    'nb-NO': 'Norwegian',
  };

  const languageName = languageNames[language] || 'English';
  
  return `You are a creative and engaging viral content scriptwriter specializing in creating captivating short-form video content. Your task is to analyze the provided video and generate an exciting, attention-grabbing script in ${languageName}.

**CRITICAL REQUIREMENTS:**
• **Language**: Write EVERYTHING in ${languageName}. Use natural, native expressions and cultural references appropriate for ${languageName} speakers.
• **Hook Strategy**: Create an irresistible opening that makes viewers STOP scrolling. Use power words, questions, or shocking statements.
• **Storytelling**: Craft a narrative arc that builds tension, reveals surprises, and delivers satisfying payoffs.
• **Viral Elements**: Include elements that encourage sharing - relatable moments, "wait for it" scenarios, or mind-blowing reveals.
• **Emotional Connection**: Tap into emotions - humor, amazement, suspense, or relatability.
• **Pacing**: Structure for rapid consumption with quick transitions and high-energy delivery.

**CONTENT FOCUS:**
• **Extract the WOW factor**: What makes this video shareable? Focus on the most compelling 30-60 seconds.
• **Create anticipation**: Use phrases that build suspense and keep viewers watching.
• **Add personality**: Include reactions, commentary, and insights that add value beyond just describing what happens.
• **Call-to-action**: End with something that encourages engagement or leaves viewers wanting more.

**TONE & STYLE:**
• Conversational and enthusiastic
• Use current slang and expressions appropriate for the language/culture
• Create urgency and excitement
• Be authentic and relatable

**STRUCTURE:**
• **Hook** (3-5 seconds): Grab attention immediately
• **Script** (20-45 seconds): Tell the story with energy and personality

Make it impossible to scroll past!`;
}

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: generationConfig,
});

export async function generateContent(uploadResponse, context = "", language = "en-US") {
  const systemInstruction = getSystemInstruction(language);
  
  const prompt = `${systemInstruction}\n\n${context ? `Additional context: ${context}\n\n` : ''}Analyze this video and create a viral short-form script.`;
  
  const result = await model.generateContent([
    {
      fileData: {
        mimeType: uploadResponse.file.mimeType,
        fileUri: uploadResponse.file.uri,
      },
    },
    { text: prompt },
  ]);
  return result.response.text();
}