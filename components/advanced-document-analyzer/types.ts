/**
 * TypeScript type definitions for Document Analyzer components
 */

// Type for document insights metrics
export interface DocumentInsights {
  clarity: number;
  relevance: number;
  completeness?: number;
  conciseness?: number;
  overallScore?: number;
}

// Type for document topics
export interface DocumentTopic {
  name: string;
  relevance: number;
}

// Type for document topic with backward compatibility for the API response
export interface ApiDocumentTopic {
  topic: string;
  relevance: number;
}

// Type for document entities
export interface DocumentEntity {
  name: string;
  type: string;
  count?: number;
}

// Type for sentiment analysis
export interface DocumentSentiment {
  overall: string;
  score: number;
}

// Type for section sentiment
export interface SectionSentiment {
  section: string;
  score: number;
}

// Type for language quality metrics
export interface LanguageQuality {
  grammar: number;
  spelling: number;
  readability: number;
  overall: number;
}

// Type for document timeline entry
export interface TimelineEntry {
  period: string;
  entity: string;
}

// Type for skill assessment
export interface Skill {
  name: string;
  level: string;
  score: number;
}

// Complete analysis result type
export interface AnalysisResult {
  documentId: string | number;
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  insights: DocumentInsights;
  topics?: DocumentTopic[] | ApiDocumentTopic[];
  entities?: DocumentEntity[];
  sentiment?: DocumentSentiment;
  sentimentBySection?: SectionSentiment[];
  languageQuality?: LanguageQuality;
  timeline?: TimelineEntry[];
  skills?: Skill[];
  timestamp?: string;
} 