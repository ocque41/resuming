// Document cache types
export interface CachedDocument {
  content: string;
  timestamp: number;
  type?: 'general' | 'specific';
  // Additional properties for legacy cache compatibility
  docxBase64?: string;
  pdfBase64?: string;
  originalAtsScore?: number;
  improvedAtsScore?: number;
  expiryTime?: number;
  originalText?: string;
  optimizedText?: string;
  improvements?: string[];
  version?: number;
}

// CV structure types
export interface StructuredCV {
  header: string[];
  profile: string[];
  achievements: string[];
  goals: string[];
  skills: string[];
  languages: string[];
  education: string[];
}

// Keyword types
export interface KeywordMatch {
  keyword: string;
  count: number;
}

// API response types
export interface ProcessSpecificResponse {
  success: boolean;
  matchScore: number;
  keywordMatches: KeywordMatch[];
  missingKeywords: string[];
  optimizedText: string;
}

// Generation options
export interface DocxGenerationOptions {
  title?: string;
  author?: string;
  description?: string;
} 