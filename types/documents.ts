export interface Document {
  id: string;
  fileName: string;
  createdAt: Date | string; // Allow both Date and string to handle API responses
  filePath?: string;
  content?: string;
  type?: string;
  size?: number;
  metadata?: string | Record<string, any>;
  userId?: string | number;
} 