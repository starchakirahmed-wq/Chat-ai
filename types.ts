export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

// Fix: Add Message interface for use in older components like Chat.tsx
export interface Message {
  sender: 'user' | 'model';
  text: string;
}

export interface UnifiedMessage {
  id: string;
  sender: 'user' | 'model';
  text?: string;
  imageUrl?: string;
  audioBase64?: string;
  videoUrl?: string;
  sources?: GroundingChunk[];
  isLoading?: boolean;
  isImage?: boolean; // Indicates if the message content is primarily an image
  isVideo?: boolean; // Indicates if the message is for video generation
  loadingText?: string; // Custom text for loading indicators
  needsApiKey?: boolean; // Flag to show API key selection UI
}
