import { Suspense } from "react";
import { getLatestDocumentAnalysis } from "@/lib/db/queries.server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import SharedAnalysisViewer from "@/components/SharedAnalysisViewer.client";

interface PageProps {
  params: {
    id: string;
  };
}

export default async function SharedAnalysisPage({ params }: PageProps) {
  const { id } = params;
  
  try {
    // Get the document analysis from the database
    const analysis = await getLatestDocumentAnalysis(Number(id));
    
    if (!analysis) {
      return (
        <div className="container mx-auto p-6">
          <div className="bg-red-50 p-4 rounded border border-red-300">
            <h1 className="text-2xl font-bold text-red-800 mb-2">Analysis Not Found</h1>
            <p className="text-red-700">
              No analysis was found for document ID: {id}. The document may have been deleted or the ID is incorrect.
            </p>
          </div>
        </div>
      );
    }
    
    // Get document info
    const documents = await db.select().from(cvs).where(eq(cvs.id, Number(id))).limit(1);
    const document = documents.length > 0 ? documents[0] : null;
    
    if (!document) {
      return (
        <div className="container mx-auto p-6">
          <div className="bg-red-50 p-4 rounded border border-red-300">
            <h1 className="text-2xl font-bold text-red-800 mb-2">Document Not Found</h1>
            <p className="text-red-700">
              The document for this analysis could not be found.
            </p>
          </div>
        </div>
      );
    }
    
    // Format date
    const analysisDate = new Date(analysis.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    return (
      <div className="container mx-auto p-6">
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">Document Analysis Report</h1>
              <p className="text-gray-600">
                {document.fileName} • Analysis date: {analysisDate}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Link
                href={`/api/reports/analysis?documentId=${id}`}
                target="_blank"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                </svg>
                Download PDF Report
              </Link>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <Suspense fallback={<div className="p-4 text-center">Loading analysis results...</div>}>
              <SharedAnalysisViewer analysis={analysis} />
            </Suspense>
          </div>
        </div>
        
        <div className="text-center text-gray-500 text-sm mt-8">
          <p>This analysis was generated using CV Optimizer.</p>
          <p>The information is provided for informational purposes only.</p>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading shared analysis:", error);
    
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 p-4 rounded border border-red-300">
          <h1 className="text-2xl font-bold text-red-800 mb-2">Error Loading Analysis</h1>
          <p className="text-red-700">
            There was an error loading the analysis results.
          </p>
        </div>
      </div>
    );
  }
} 