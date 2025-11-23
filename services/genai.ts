
import { GoogleGenAI, Type, Modality } from "@google/genai";

// Helper to get the client.
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

// Audio Context Singleton for TTS
let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioCtx;
};

/**
 * Decodes base64 string to audio buffer
 */
async function decodeAudioData(base64String: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Custom PCM Decode for Gemini 24kHz
  const data = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, data.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
     channelData[i] = data[i] / 32768.0;
  }
  return buffer;
}

/**
 * Generates TTS for the given text using Gemini
 */
export const generateTTS = async (text: string): Promise<AudioBuffer | null> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return await decodeAudioData(base64Audio);
    }
    return null;
  } catch (e) {
    console.warn("TTS Generation failed", e);
    return null;
  }
};

/**
 * Generates a Monster Image
 */
export const generateMonsterImage = async (level: number, promptDesc: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: promptDesc + ", full body shot, isolated on dark background, dynamic action pose, highly detailed, 8k resolution" }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned");
  } catch (e: any) {
    if (e.message?.includes('429') || e.status === 429 || e.toString().includes('429')) {
      console.warn("Image Generation Quota Exceeded. Using fallback.");
    } else {
      console.error("Failed to generate monster image", e);
    }
    return `https://picsum.photos/seed/monster${level}/512/512`;
  }
};

/**
 * Generates Ultraman Image
 */
export const generateUltramanImage = async (promptDesc: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: promptDesc + ", full body shot, isolated on dark background, heroic pose, highly detailed, 8k resolution" }],
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned");
  } catch (e: any) {
    if (e.message?.includes('429') || e.status === 429 || e.toString().includes('429')) {
       console.warn("Image Generation Quota Exceeded. Using fallback.");
    } else {
       console.error("Failed to generate ultraman image", e);
    }
    return `https://picsum.photos/seed/hero/400/600`;
  }
};

/**
 * Checks pronunciation and returns a score (0-100)
 */
export const checkPronunciation = async (
  audioBase64: string,
  targetLetter: string
): Promise<{ correct: boolean; score: number; heard: string }> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/webm',
              data: audioBase64
            }
          },
          {
            text: `
            Task: Evaluate a child's pronunciation of "${targetLetter}".
            
            Instructions:
            1. Listen for the dominant voice. Ignore background noise.
            2. If you hear the *name* of the letter (e.g. "Ay" for A) OR the *phonetic sound* (e.g. "Ah" or "Ae" for A), consider it correct.
            3. Children may have high-pitched voices or slight lisps. Be tolerant.
            4. Scoring Guide:
               - 90-100: Clear, correct pronunciation.
               - 70-89: Acceptable pronunciation, slightly unclear or noisy but recognizable.
               - 40-69: Ambiguous, mumbled, or very heavy accent.
               - 0-39: Wrong letter, silence, or just noise.
            
            Return JSON only:
            {
              "score": number (0-100),
              "heard": string (What word or sound did you hear?)
            }
            `
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                score: { type: Type.INTEGER },
                heard: { type: Type.STRING }
            }
        }
      }
    });

    const text = response.text;
    if (text) {
      try {
        const json = JSON.parse(text);
        let score = typeof json.score === 'number' ? json.score : 0;
        const heard = typeof json.heard === 'string' ? json.heard : "Unknown";
        
        // Hybrid Judgment: If the text transcript matches the target, force a passing score.
        // This handles cases where the AI hears the word correctly but gives a low "quality" score strictly.
        const normalizedTarget = targetLetter.replace(/[^a-zA-Z]/g, '').toLowerCase();
        const normalizedHeard = heard.replace(/[^a-zA-Z]/g, '').toLowerCase();
        
        if (normalizedHeard.includes(normalizedTarget) || normalizedTarget.includes(normalizedHeard)) {
           if (score < 70 && normalizedHeard.length > 0) {
             console.log(`[Auto-Correction] AI Scored low (${score}) but transcript matched ("${heard}"). Boosting score.`);
             score = 85; 
           }
        }

        return { 
          correct: score >= 60,
          score: score,
          heard: heard
        };
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        return { correct: false, score: 0, heard: "Error" };
      }
    }
    return { correct: false, score: 0, heard: "No Response" };
  } catch (e: any) {
    if (e.message?.includes('429') || e.status === 429 || e.toString().includes('429')) {
      console.warn("Gemini API Quota Exceeded.");
      return {
        correct: false,
        score: 0,
        heard: "API Quota Exceeded"
      };
    }
    
    console.error("Audio check failed", e);
    return { correct: false, score: 0, heard: "Error" };
  }
};
