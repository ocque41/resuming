import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getAllUserDocuments } from "@/lib/db/queries.server";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Import the client component wrapper
import EnhancePageClient from "./EnhancePageClient";

// Instruct Next.js that this page must render dynamically (to allow cookies usage)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Define the Document type locally
interface Document {
  id: string;
  fileName: string;
  createdAt: Date;
}

export default async function DocumentEditorPage() {
  try {
    const user = await getUser();
    if (!user) {
      redirect("/sign-in");
    }
    
    let teamData;
    let rawDocuments: {
      id: number;
      userId: number;
      fileName: string;
      filepath: string;
      rawText: string | null;
      createdAt: Date;
      metadata: string | null;
    }[] = [];
    
    try {
      teamData = await getTeamForUser(user.id);
      if (!teamData) {
        console.error("Team not found for user:", user.id);
      }
      
      // Try to fetch all user documents
      try {
        console.log("Fetching documents for user:", user.id);
        
        // Call getAllUserDocuments with both required parameters
        const result = await getAllUserDocuments(user.id, {
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        });
        
        console.log("Documents fetched successfully:", result.documents.length);
        
        // Extract the documents array from the result
        rawDocuments = result.documents;
      } catch (error) {
        console.error("Error fetching all documents, falling back to CVs:", error);
      }
      
      // If no documents were found, fall back to CVs
      if (!rawDocuments || rawDocuments.length === 0) {
        console.log("No documents found, falling back to CVs");
        rawDocuments = await getCVsForUser(user.id);
        console.log("CVs fetched:", rawDocuments.length);
      }
    } catch (error) {
      console.error("Error fetching team or documents:", error);
      // Continue with empty data rather than crashing
    }
    
    // Map the documents to match the Document interface and convert dates to ISO strings for serialization
    const documents = rawDocuments?.map(doc => ({
      id: doc.id.toString(),
      fileName: doc.fileName || "Untitled Document",
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString()
    })) || [];
    
    // Pass only serializable data to the client component under the prop name "documentsData"
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        {/* Header with back button */}
        <header className="absolute top-4 left-4 md:top-8 md:left-8 z-10">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center h-10 w-10 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </header>
        
        <main className="w-full py-4">
          <EnhancePageClient documentsData={documents} />
        </main>
      </div>
    );
  } catch (error) {
    console.error("Error in DocumentEditorPage:", error);
    
    // Fallback UI – using a Link instead of a button with an onClick handler
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative">
          {/* Header with back button and title */}
          <header className="flex items-center mb-8">
            <Link 
              href="/dashboard" 
              className="flex items-center justify-center h-10 w-10 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-white">
              Document AI Assistant
            </h1>
          </header>
          
          <div className="mt-6">
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                We encountered an error loading the Document AI Assistant. Please try refreshing the page or contact support if the issue persists.
              </AlertDescription>
            </Alert>
            
            <Link 
              href="/dashboard/enhance"
              className="px-4 py-2 bg-[#B4916C] text-white rounded-md hover:bg-[#A3815C] transition-colors inline-block"
            >
              Refresh Page
            </Link>
          </div>
        </div>
      </div>
    );
  }
} 