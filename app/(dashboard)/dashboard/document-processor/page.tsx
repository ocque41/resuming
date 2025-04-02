import dynamic from 'next/dynamic';
import { Metadata } from 'next';

// Dynamically import the DocumentProcessor component
const DocumentProcessor = dynamic(
  () => import('@/app/components/DocumentProcessor'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-4xl mx-auto p-8 border rounded-lg">
        <div className="h-16 w-48 bg-gray-200 animate-pulse rounded mb-4"></div>
        <div className="h-64 bg-gray-100 animate-pulse rounded"></div>
      </div>
    )
  }
);

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
      
      <DocumentProcessor />
    </div>
  );
} 