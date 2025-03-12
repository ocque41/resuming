import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, FileText, Send, Settings, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the Document type locally
interface Document {
  id: string;
  fileName: string;
  createdAt: Date;
}

// Import the client component wrapper instead of using dynamic imports directly
import EnhancePageClient from "./EnhancePageClient";

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
      
      rawDocuments = await getCVsForUser(user.id);
    } catch (error) {
      console.error("Error fetching team or documents:", error);
      // Continue with empty data rather than crashing
    }
    
    // Map the documents to match the Document interface
    const documents = rawDocuments?.map(doc => ({
      id: doc.id.toString(),
      fileName: doc.fileName || 'Untitled Document',
      // Convert Date to string for serialization
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString()
    })) || [];
    
    // Pass only serializable data to the client component
    // Change 'documents' to 'documentsData' to match the prop name in the client component
    return <EnhancePageClient documentsData={documents} />;
  } catch (error) {
    console.error("Error in DocumentEditorPage:", error);
    
    // Return a fallback UI instead of crashing
    return (
      <div className="flex flex-col min-h-screen bg-[#121212] p-6">
        <header className="flex items-center mb-8">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center h-8 w-8 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-medium text-white">
            Document AI Assistant
          </h1>
        </header>
        
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            We encountered an error loading the Document AI Assistant. Please try refreshing the page or contact support if the issue persists.
          </AlertDescription>
        </Alert>
        
        {/* Use a simple button instead of the client component */}
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#B4916C] text-white rounded-md hover:bg-[#A3815C] transition-colors"
        >
          Refresh Page
        </button>
      </div>
    );
  }
} 