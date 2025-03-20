/**
 * TypeScript type definitions for Document Analyzer components
 */

// Type for document insights metrics (array-based version)
export interface InsightMetric {
  name: string;
  value: number;
}

// Type for document insights metrics (object-based version)
export interface DocumentInsights {
  clarity?: number;
  relevance?: number;
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
  mentions?: number;
}

// Type for sentiment section
export interface SentimentSection {
  section: string;
  sentiment: string;
  score: number;
}

// Type for sentiment analysis
export interface DocumentSentiment {
  overall: string;
  score: number;
  sentimentBySection?: SentimentSection[];
}

// Type for section sentiment
export interface SectionSentiment {
  section: string;
  score: number;
  sentiment?: string;
}

// Type for language quality metrics
export interface LanguageQuality {
  grammar: number;
  spelling: number;
  readability?: number;
  clarity?: number;
  overall?: number;
}

// Type for document timeline entry
export interface TimelineEntry {
  period?: string;
  entity?: string;
  date?: string;
  event?: string;
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
  fileName?: string;
  analysisType?: string;
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  insights: DocumentInsights | InsightMetric[];
  topics?: DocumentTopic[] | ApiDocumentTopic[];
  entities?: DocumentEntity[];
  sentiment?: DocumentSentiment;
  sentimentBySection?: SectionSentiment[];
  languageQuality?: LanguageQuality;
  timeline?: TimelineEntry[];
  skills?: Skill[];
  timestamp?: string;
  createdAt?: string;
} 