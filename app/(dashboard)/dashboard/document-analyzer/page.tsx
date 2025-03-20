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

  // Function to fetch a single document by ID
  const fetchDocumentById = async (id: string) => {
    try {
      console.log(`Fetching document with ID: ${id}`);
      const response = await fetch(`/api/documents/${id}`);
      
      if (!response.ok) {
        console.error(`Failed to fetch document with ID ${id}, status:`, response.status);
        throw new Error(`Failed to fetch document with ID ${id}`);
      }
      
      const data = await response.json();
      console.log('Document fetched successfully:', data.document);
      return data.document;
    } catch (error) {
      console.error('Error fetching document by ID:', error);
      throw error;
    }
  };

  // Function to fetch all documents
  const fetchAllDocuments = async () => {
    try {
      console.log('Fetching all documents for the analyzer');
      const response = await fetch('/api/documents');
      
      if (!response.ok) {
        console.error('Failed to fetch documents, status:', response.status);
        throw new Error('Failed to fetch documents');
      }
      
      const data = await response.json();
      console.log('Documents fetched successfully, count:', data.documents?.length || 0);
      return data.documents || [];
    } catch (error) {
      console.error('Error fetching all documents:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Async function to handle data fetching
    const loadData = async () => {
      try {
        setLoading(true);
        
        // If documentId is provided, fetch that specific document
        if (documentId) {
          console.log('Document ID provided in URL:', documentId);
          
          // Fetch the specific document
          const doc = await fetchDocumentById(documentId);
          setDocument(doc);
          
          // Also fetch all documents for the dropdown
          const allDocs = await fetchAllDocuments();
          setDocuments(allDocs);
        } else {
          // Just fetch all documents
          const allDocs = await fetchAllDocuments();
          setDocuments(allDocs);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load documents. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [documentId]);

  // Transform documents to the format expected by the DocumentAnalyzerClient
  const transformedDocuments = documents.map(doc => {
    // Add detailed logging about each document
    console.log(`Transforming document: ID=${doc.id}, fileName=${doc.fileName}, type=${typeof doc.createdAt}`);
    
    return {
      id: doc.id.toString(),
      fileName: doc.fileName,
      createdAt: String(doc.createdAt), // Ensure it's a string
    };
  });

  // If we have a specific document from the URL, make sure it has all required fields
  const preSelectedDocumentId = document ? document.id.toString() : undefined;
  
  // Log the pre-selected document for debugging
  if (preSelectedDocumentId) {
    console.log('Pre-selecting document for analysis:', { 
      id: preSelectedDocumentId, 
      fileName: document?.fileName,
      fileNameType: typeof document?.fileName,
      fileNameExists: !!document?.fileName,
      createdAt: document?.createdAt
    });
    
    // Double-check if the preselected document exists in the transformed documents list
    const selectedDocInList = transformedDocuments.find(doc => doc.id === preSelectedDocumentId);
    console.log('Is preselected document in the transformed list?', 
      selectedDocInList ? `Yes, with fileName=${selectedDocInList.fileName}` : 'No, document not found in list');
  }

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
            preSelectedDocumentId={preSelectedDocumentId}
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