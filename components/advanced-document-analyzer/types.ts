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
  structure?: number;
  engagement?: number;
  contentquality?: number;
  overallScore?: number;
  [key: string]: number | undefined; // Add index signature for dynamic properties
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
  [key: string]: number | undefined; // Add index signature for dynamic properties
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

// Type for CV specific analysis details
export interface CVAnalysis {
  skills?: {
    technical?: Array<{name: string; proficiency: string; relevance: number}>;
    soft?: Array<{name: string; evidence: string; strength: number}>;
    domain?: Array<{name: string; relevance: number}>;
  };
  experience?: {
    yearsOfExperience?: number;
    experienceProgression?: string;
    keyRoles?: string[];
    achievementsHighlighted?: boolean;
    clarity?: number;
  };
  education?: {
    highestDegree?: string;
    relevance?: number;
    continuingEducation?: boolean;
  };
  atsCompatibility?: {
    score?: number;
    keywordOptimization?: number;
    formatCompatibility?: number;
    improvementAreas?: string[];
  };
  strengths?: string[];
  weaknesses?: string[];
}

// Type for spreadsheet analysis details
export interface SpreadsheetAnalysis {
  dataStructure?: {
    tables?: Array<{
      name: string;
      columns: Array<{
        name: string;
        dataType: string;
        completeness: number;
      }>;
    }>;
    structureScore?: number;
  };
  dataQuality?: {
    completeness?: number;
    consistency?: number;
    accuracy?: number;
    issues?: Array<{
      issue: string;
      severity: string;
      recommendation: string;
    }>;
    overallScore?: number;
  };
  insights?: {
    keyMetrics?: Array<{
      name: string;
      value: string;
      insight: string;
    }>;
    trends?: Array<{
      description: string;
      significance: string;
    }>;
    anomalies?: Array<{
      description: string;
      impact: string;
    }>;
  };
}

// Type for presentation analysis details
export interface PresentationAnalysis {
  slideStructure?: {
    slideCount?: number;
    hasIntroduction?: boolean;
    hasConclusion?: boolean;
    narrativeFlow?: string;
    slideStructure?: Array<{
      type: string;
      purpose: string;
      effectiveness: number;
    }>;
    structureScore?: number;
  };
  messageClarity?: {
    mainMessage?: string;
    messageClarity?: number;
    supportingPoints?: Array<{
      point: string;
      clarity: number;
    }>;
    languageAppropriateness?: number;
    audienceAlignment?: string;
    overallClarityScore?: number;
  };
  visualBalance?: {
    textToVisualRatio?: number;
    visualConsistency?: number;
    visualImpact?: number;
  };
  audienceEngagement?: {
    engagementElements?: string[];
    interactivityScore?: number;
    attentionRetention?: number;
  };
}

// Type for content extraction and analysis results
export interface ContentExtractionResult {
  rawText?: string;
  structure?: {
    sections?: Array<{
      title: string;
      content: string;
      level: number;
    }>;
    paragraphs?: number;
    tables?: number;
    images?: number;
    lists?: number;
  };
  metadata?: Record<string, string>;
}

// Complete analysis result type
export interface AnalysisResult {
  documentId: string | number;
  fileName?: string;
  analysisType?: string;
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  insights: DocumentInsights | InsightMetric[] | any; // Make more flexible
  topics?: (DocumentTopic | ApiDocumentTopic | any)[]; // Make more flexible
  entities?: DocumentEntity[];
  sentiment?: DocumentSentiment | any; // Make more flexible
  sentimentBySection?: SectionSentiment[];
  languageQuality?: LanguageQuality;
  timeline?: TimelineEntry[];
  skills?: Skill[];
  cvAnalysis?: CVAnalysis;
  spreadsheetAnalysis?: SpreadsheetAnalysis;
  presentationAnalysis?: PresentationAnalysis;
  contentExtraction?: ContentExtractionResult;
  timestamp?: string;
  createdAt?: string;
} 