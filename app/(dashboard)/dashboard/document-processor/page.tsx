import { Metadata } from 'next';
import DocumentProcessorWrapper from './DocumentProcessorWrapper';

export const metadata: Metadata = {
  title: 'Document Processor | AI Document Assistant',
  description: 'Upload and process documents with AI assistance',
};

export default function DocumentProcessorPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Document Processor</h1>
        <p className="text-muted-foreground">
          Upload documents and interact with our AI assistant to analyze, edit, or create documents.
        </p>
      </div>
      
      <DocumentProcessorWrapper />
    </div>
  );
} 