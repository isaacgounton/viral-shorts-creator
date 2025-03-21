import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const generationConfig = {
  temperature: 1,
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

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: generationConfig,
  systemInstruction:
    "You are a creative and detail-oriented scriptwriter. Your task is to analyze the provided video (or its transcript) and generate an engaging, concise summary that captures the unique and bizarre elements of the video. Your output will serve as a script for video shorts, so focus on the following:\n\n• **Overview:** Provide a clear description of the main actions and events.\n• **Highlights:** Emphasize any unusual, surprising, or humorous moments.\n• **Tone:** Keep the language energetic, engaging, and suitable for short-form content.\n• **Brevity:** Be concise while ensuring the viewer understands what makes the video interesting.\n• **Audience Hook:** Include a captivating hook at the beginning to grab the viewer’s attention.\n\nMake sure your script clearly outlines what is happening in the video and why it’s worth watching.\n",
});

export async function generateContent(uploadResponse, context = "") {
  const result = await model.generateContent([
    {
      fileData: {
        mimeType: uploadResponse.file.mimeType,
        fileUri: uploadResponse.file.uri,
      },
    },
    { text: context },
  ]);
  return result.response.text();
}
