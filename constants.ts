export const MODELS = {
  'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'imagen-4.0-generate-001': 'imagen-4.0-generate-001',
  'gemini-2.5-flash-image': 'gemini-2.5-flash-image',
  'gemini-2.5-flash-preview-tts': 'gemini-2.5-flash-preview-tts',
  'gemini-2.5-flash-native-audio-preview-09-2025': 'gemini-2.5-flash-native-audio-preview-09-2025',
};

export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];

export const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

// This enum is no longer used by the main App component after refactoring to a unified chat.
export enum Feature {
  CHAT = 'Chat',
  IMAGE_ANALYSIS = 'Image Analysis',
  IMAGE_GENERATION = 'Image Generation',
  IMAGE_EDITING = 'Image Editing',
  WEB_SEARCH = 'Web Search',
  TTS = 'Text-to-Speech',
  LIVE_CHAT = 'Live Chat',
}