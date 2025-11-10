import { GoogleGenAI, Modality, GenerateContentResponse, Type } from '@google/genai';
import { GroundingChunk } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateText = async (prompt: string, model: string, thinking: boolean): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: thinking ? { thinkingConfig: { thinkingBudget: 32768 } } : {},
    });
    return response.text;
  } catch (error) {
    console.error("Error generating text:", error);
    return "Sorry, I encountered an error. Please try again.";
  }
};

export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
  try {
    const imagePart = { inlineData: { data: imageBase64, mimeType } };
    const textPart = { text: prompt };
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [textPart, imagePart] },
    });
    return response.text;
  } catch (error) {
    console.error("Error analyzing image:", error);
    return "Sorry, I couldn't analyze the image. Please try again.";
  }
};

export const generateImage = async (prompt: string, aspectRatio: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
      },
    });
    if (response.generatedImages && response.generatedImages.length > 0) {
      return response.generatedImages[0].image.imageBytes;
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const editImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string | null> => {
    try {
        const imagePart = { inlineData: { data: imageBase64, mimeType } };
        const textPart = { text: prompt };
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, imagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
            return part.inlineData.data;
        }
        return null;
    } catch (error) {
        console.error("Error editing image:", error);
        return null;
    }
};

export const searchWeb = async (query: string): Promise<{ text: string, sources: GroundingChunk[] }> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    const text = response.text;
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { text, sources: sources as GroundingChunk[] };
  } catch (error) {
    console.error("Error with web search:", error);
    return { text: "Sorry, I couldn't perform the web search. Please try again.", sources: [] };
  }
};

export const generateSpeech = async (text: string, voice: string): Promise<string | null> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio || null;
    } catch (error) {
        console.error("Error generating speech:", error);
        return null;
    }
};

export const generateVideo = async (prompt: string, image: { base64: string, mimeType: string } | null): Promise<{ uri?: string; error?: string; errorType?: 'ApiKey' | 'General' }> => {
    try {
        const videoAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const payload: any = {
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt || 'An interesting and dynamic video.',
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9',
            },
        };

        if (image) {
            payload.image = {
                imageBytes: image.base64,
                mimeType: image.mimeType,
            };
        } else if (!prompt) {
            return { error: "A prompt is required for video generation.", errorType: 'General' };
        }

        let operation = await videoAI.models.generateVideos(payload);
        
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await videoAI.operations.getVideosOperation({ operation: operation });
        }
        
        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!uri) {
            return { error: "Video generation failed to produce a result.", errorType: 'General' };
        }
        return { uri };

    } catch (error: any) {
        console.error("Error generating video:", error);
        if (error.message?.includes("Requested entity was not found")) {
            return { error: "Your API key is invalid or missing required permissions. Please select a different key.", errorType: 'ApiKey' };
        }
        return { error: "An unexpected error occurred during video generation.", errorType: 'General' };
    }
};


export const getLiveChatSession = (callbacks: any) => {
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: 'Your transcribed response should be in clean, plain text paragraphs. Do not use any markdown formatting like asterisks.',
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
    });
};

export const preprocessInput = async (userInput: string): Promise<{ classification: 'GIBBERISH' | 'TYPO' | 'VALID'; corrected_text?: string }> => {
  try {
    const prompt = `Analyze the following user input for a chatbot. Classify it into one of three categories:
- 'GIBBERISH': If it is meaningless, random characters, or nonsensical noise (e.g., "تتتتتتت", "asdfasdf").
- 'TYPO': If it is a comprehensible request but contains spelling mistakes, words stuck together, or other typos (e.g., "ارسم لحت", "what is teh capital of France").
- 'VALID': If it is a well-formed, understandable request.

If you classify it as 'TYPO', provide a corrected version of the text.

User Input: "${userInput}"

Respond ONLY with a valid JSON object.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: {
              type: Type.STRING,
              description: "The classification of the input: GIBBERISH, TYPO, or VALID."
            },
            corrected_text: {
              type: Type.STRING,
              description: "The corrected version of the text if the classification is TYPO. Can be an empty string."
            },
          },
          required: ["classification"],
        },
      },
    });

    const resultJson = JSON.parse(response.text);
    return resultJson;

  } catch (error) {
    console.error("Error preprocessing input:", error);
    // If preprocessing fails, assume the input is valid to not block the user.
    return { classification: 'VALID' };
  }
};
