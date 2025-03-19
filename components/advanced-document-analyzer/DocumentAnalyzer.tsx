import { getServerSession } from 'next-auth/next';
import DocumentAnalyzerClient from './DocumentAnalyzer.client';
import { redirect } from 'next/navigation';

// Sample document data for development mode
const sampleDocuments = [
  {
    id: "doc-1",
    fileName: "My Resume.pdf",
    createdAt: new Date().toISOString()
  },
  {
    id: "doc-2",
    fileName: "Cover Letter.docx",
    createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
  },
  {
    id: "doc-3",
    fileName: "Project Proposal.pdf",
    createdAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
  },
  {
    id: "doc-4",
    fileName: "Spreadsheet Analysis.xlsx",
    createdAt: new Date(Date.now() - 259200000).toISOString() // 3 days ago
  },
  {
    id: "doc-5",
    fileName: "Presentation.pptx",
    createdAt: new Date(Date.now() - 345600000).toISOString() // 4 days ago
  }
];

export async function DocumentAnalyzer() {
  // Force development mode temporarily to debug UI
  const isDevelopment = true; // process.env.NODE_ENV === 'development';
  
  // For development, skip authentication
  if (!isDevelopment) {
    try {
      const session = await getServerSession();
      
      if (!session || !session.user) {
        redirect("/login");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      // Show error message in development
      if (process.env.NODE_ENV === 'development') {
        return (
          <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300">
            <h3 className="font-bold">Authentication Error</h3>
            <p>{error instanceof Error ? error.message : String(error)}</p>
          </div>
        );
      }
      redirect("/login");
    }
  }

  // For development, use sample documents
  // In production, you would fetch real documents from the database
  const documents = isDevelopment ? sampleDocuments : [];

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-2xl font-safiro text-white">Document Analyzer</h2>
        <p className="text-gray-400 font-borna">
          Analyze your documents using Mistral AI to get insights and recommendations.
        </p>
      </div>
      
      <DocumentAnalyzerClient documents={documents} />
    </div>
  );
} 