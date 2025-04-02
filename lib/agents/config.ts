import { z } from 'zod';

// Environment variable validation schema
export const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  OPENAI_ORGANIZATION_ID: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
});

// Agent configuration
export const agentConfig = {
  model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 4000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

// Document types supported by the agent
export const SUPPORTED_DOCUMENT_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
] as const;

// Document creation templates
export const DOCUMENT_TEMPLATES = {
  BLANK: 'blank',
  RESUME: 'resume',
  COVER_LETTER: 'cover_letter',
  REPORT: 'report',
} as const;

// Agent roles and capabilities
export const AGENT_ROLES = {
  CREATOR: 'creator',
  EDITOR: 'editor',
  REVIEWER: 'reviewer',
} as const;

// Agent instructions and prompts
export const AGENT_INSTRUCTIONS = {
  [AGENT_ROLES.CREATOR]: `You are an AI document creation assistant. Your role is to help users create well-structured, professional documents based on their requirements and selected template.`,
  [AGENT_ROLES.EDITOR]: `You are an AI document editing assistant. Your role is to help users improve their existing documents by suggesting edits, corrections, and enhancements.`,
  [AGENT_ROLES.REVIEWER]: `You are an AI document review assistant. Your role is to analyze documents and provide constructive feedback on content, structure, and style.`,
};

// Error messages
export const ERROR_MESSAGES = {
  INVALID_ENV: 'Invalid environment configuration',
  INVALID_DOCUMENT_TYPE: 'Unsupported document type',
  INVALID_TEMPLATE: 'Invalid document template',
  INVALID_ROLE: 'Invalid agent role',
  API_ERROR: 'Error communicating with OpenAI API',
  PROCESSING_ERROR: 'Error processing document',
} as const;

// Validation schemas
export const documentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['plain', 'markdown', 'pdf', 'docx'] as const),
  template: z.enum(['blank', 'resume', 'cover_letter', 'report'] as const),
  metadata: z.record(z.string()).optional(),
});

export const agentRequestSchema = z.object({
  role: z.enum(['creator', 'editor', 'reviewer'] as const),
  document: documentSchema.optional(),
  prompt: z.string().min(1, 'Prompt is required'),
  context: z.record(z.unknown()).optional(),
}); 