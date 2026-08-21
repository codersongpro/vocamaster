export interface VocabItem {
  id: string;
  word: string;
  definition: string;
  koreanDefinition: string;
}

export type ProcessingStatus = 'idle' | 'analyzing' | 'generating_audio' | 'complete' | 'error';

export interface ExtractedData {
  items: VocabItem[];
}

export interface FilePart {
  mimeType: string;
  data: string; // base64 string
}

