import { z } from 'zod';
import { documentSchema, agentRequestSchema } from './config';

// Zod schema types
export type Document = z.infer<typeof documentSchema>;
export type AgentRequest = z.infer<typeof agentRequestSchema>;

// Document types
export type DocumentType = 'plain' | 'markdown' | 'pdf' | 'docx';
export type DocumentTemplate = 'blank' | 'resume' | 'cover_letter' | 'report';

// Agent types
export type AgentRole = 'creator' | 'editor' | 'reviewer';

// Response types
export interface AgentResponse {
  content: string;
  suggestions?: string[];
  metadata?: Record<string, unknown>;
  error?: string;
}

// Context types
export interface DocumentContext {
  userId: string;
  documentId?: string;
  collectionId?: string;
  previousVersions?: string[];
  settings?: DocumentSettings;
}

export interface DocumentSettings {
  language?: string;
  style?: string;
  tone?: string;
  format?: string;
  maxLength?: number;
}

// Event types
export interface DocumentEvent {
  type: 'create' | 'edit' | 'review';
  timestamp: number;
  userId: string;
  documentId: string;
  changes?: DocumentChanges;
}

export interface DocumentChanges {
  before?: string;
  after?: string;
  diff?: string;
  summary?: string;
}

// Error types
export interface AgentError extends Error {
  code: string;
  details?: Record<string, unknown>;
} 