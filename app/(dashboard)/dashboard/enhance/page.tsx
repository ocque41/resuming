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

// Instruct Next.js that this page must render dynamically (to allow cookies usage)
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    
    // Map the documents to match the Document interface and convert dates to ISO strings for serialization
    const documents = rawDocuments?.map(doc => ({
      id: doc.id.toString(),
      fileName: doc.fileName || "Untitled Document",
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString()
    })) || [];
    
    // Pass only serializable data to the client component under the prop name "documentsData"
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
            <EnhancePageClient documentsData={documents} />
          </div>
        </div>
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