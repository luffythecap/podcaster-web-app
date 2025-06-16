import { action } from "./_generated/server";
import { v } from "convex/values";

import OpenAI from "openai";
import { SpeechCreateParams } from "openai/resources/audio/speech.mjs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Retry helper
async function retryWithDelay<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 3000
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err.status === 429 && retries > 0) {
      console.warn(`⚠️ Rate limit hit. Retrying in ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
      return retryWithDelay(fn, retries - 1, delay);
    }
    console.error("❌ OpenAI API error:", err.message || err);
    throw err;
  }
}

// Audio generation action with retry
export const generateAudioAction = action({
  args: { input: v.string(), voice: v.string() },
  handler: async (_, { voice, input }) => {
    const mp3 = await retryWithDelay(() =>
      openai.audio.speech.create({
        model: "tts-1",
        voice: voice as SpeechCreateParams["voice"],
        input,
      })
    );

    const buffer = await mp3.arrayBuffer();
    return buffer;
  },
});

// Thumbnail generation with retry
export const generateThumbnailAction = action({
  args: { prompt: v.string() },
  handler: async (_, { prompt }) => {
    const response = await retryWithDelay(() =>
      openai.images.generate({
        model: "dall-e-3",
        prompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      })
    );

    const url = response.data[0].url;

    if (!url) {
      throw new Error("❌ Error generating thumbnail: No URL returned.");
    }

    const imageResponse = await fetch(url);
    const buffer = await imageResponse.arrayBuffer();
    return buffer;
  },
});
