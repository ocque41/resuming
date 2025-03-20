'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, BarChart2 } from 'lucide-react';
import DocumentAnalyzerClient from '@/components/advanced-document-analyzer/DocumentAnalyzer.client';

interface Document {
  id: number;
  fileName: string;
  createdAt: string;
  userId: number;
  filepath?: string;
  rawText?: string;
  metadata?: any;
}

// Component that uses useSearchParams
function DocumentAnalyzerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get('documentId');
  const [document, setDocument] = useState<Document | undefined>(undefined);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch documents
    const fetchDocuments = async () => {
      try {
        console.log('Fetching documents for the analyzer');
        const response = await fetch('/api/documents');
        if (!response.ok) {
          console.error('Failed to fetch documents, status:', response.status);
          throw new Error('Failed to fetch documents');
        }
        const data = await response.json();
        console.log('Documents fetched successfully, count:', data.documents?.length || 0);
        setDocuments(data.documents || []);

        // If documentId is provided, find the document
        if (documentId) {
          console.log('Document ID from URL params:', documentId);
          const selectedDoc = data.documents.find(
            (doc: Document) => doc.id.toString() === documentId
          );
          if (selectedDoc) {
            console.log('Found matching document:', selectedDoc.fileName);
            setDocument(selectedDoc);
          } else {
            console.error('Document not found with ID:', documentId);
            setError(`Document with ID ${documentId} not found`);
          }
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
        setError('Failed to load documents. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [documentId]);

  // Transform documents to the format expected by the DocumentAnalyzerClient
  const transformedDocuments = documents.map(doc => ({
    id: doc.id.toString(),
    fileName: doc.fileName,
    createdAt: doc.createdAt,
  }));

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center text-[#8A8782] hover:text-[#F9F6EE] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span>Back</span>
        </button>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-safiro font-medium text-[#F9F6EE]">
            Document Analyzer
          </h1>
          <p className="text-[#8A8782] mt-2">
            Analyze your documents with AI to extract insights and recommendations
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-pulse text-[#8A8782]">Loading...</div>
          </div>
        ) : error ? (
          <div className="bg-[#1A1009] border border-[#3A2A19] text-[#F9BC8F] p-4 rounded-lg">
            {error}
          </div>
        ) : (
          <DocumentAnalyzerClient 
            documents={transformedDocuments}
          />
        )}
      </div>
    </div>
  );
}

// Main page component with suspense boundary
export default function DocumentAnalyzerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-pulse text-[#8A8782]">Loading document analyzer...</div>
      </div>
    }>
      <DocumentAnalyzerContent />
    </Suspense>
  );
} 