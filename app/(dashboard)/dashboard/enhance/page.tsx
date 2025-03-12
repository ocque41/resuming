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
import dynamic from "next/dynamic";

// Define the Document type locally instead of importing it
interface Document {
  id: string;
  fileName: string;
  createdAt: Date;
}

// Dynamically import client components
const DocumentCombobox = dynamic(
  () => import("@/components/DocumentCombobox.client"),
  { ssr: false }
);

const ErrorRefreshButton = dynamic(
  () => import("@/components/ErrorRefreshButton.client"), 
  { ssr: false }
);

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
    
    // Map the documents to match the Document interface in DocumentCombobox
    // Convert to the expected DocumentType with Date objects
    const documents: Document[] = rawDocuments?.map(doc => ({
      id: doc.id.toString(),
      fileName: doc.fileName || 'Untitled Document',
      createdAt: doc.createdAt || new Date() // Keep as Date object
    })) || [];
    
    return (
      <div className="flex flex-col h-screen bg-[#121212]">
        <header className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center">
            <Link 
              href="/dashboard" 
              className="flex items-center justify-center h-8 w-8 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-medium text-white">
              Document AI Assistant
            </h1>
          </div>
          
          <Link 
            href="/dashboard/settings"
            className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="h-4 w-4 mr-1" />
            <span>Settings</span>
          </Link>
        </header>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar for document selection */}
          <div className="w-64 border-r border-gray-800 p-4 bg-black hidden md:block">
            <div className="mb-4">
              <h2 className="text-[#B4916C] text-sm font-medium mb-2">Your Documents</h2>
              <DocumentCombobox 
                documents={documents} 
                onSelect={(documentId) => {
                  // This is a client component function, so it will be handled client-side
                  console.log("Selected document:", documentId);
                }}
                placeholder="Select a document"
                emptyMessage="No documents available"
              />
            </div>
            
            <div className="space-y-1">
              <h2 className="text-[#B4916C] text-sm font-medium mb-2">Document Actions</h2>
              <Button variant="ghost" className="w-full justify-start text-gray-400 hover:text-white hover:bg-[#1D1D1D]">
                <FileText className="mr-2 h-4 w-4" />
                <span>Upload New Document</span>
              </Button>
              <Button variant="ghost" className="w-full justify-start text-gray-400 hover:text-white hover:bg-[#1D1D1D]">
                <FileText className="mr-2 h-4 w-4" />
                <span>Create New Document</span>
              </Button>
            </div>
          </div>
          
          {/* Main chat area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile document selector (shown only on small screens) */}
            <div className="md:hidden p-2 border-b border-gray-800">
              <DocumentCombobox 
                documents={documents}
                onSelect={(documentId) => {
                  // This is a client component function, so it will be handled client-side
                  console.log("Selected document (mobile):", documentId);
                }}
                placeholder="Select a document"
                emptyMessage="No documents available"
              />
            </div>
            
            {/* Chat messages */}
            <div className="flex-1 overflow-auto p-4">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* AI welcome message */}
                <div className="flex items-start">
                  <div className="h-8 w-8 rounded-full bg-[#B4916C]/20 flex items-center justify-center text-[#B4916C] mr-3 mt-1">
                    AI
                  </div>
                  <div className="bg-[#B4916C]/10 rounded-lg p-3 text-gray-300 max-w-[80%]">
                    <p className="text-sm">
                      Hello! I'm your document assistant. Select a document from the sidebar or upload a new one.
                      I can help you edit, format, summarize, or transform it. What would you like to do today?
                    </p>
                  </div>
                </div>
                
                {/* Sample user message */}
                <div className="flex items-start justify-end">
                  <div className="bg-gray-800 rounded-lg p-3 text-gray-300 max-w-[80%]">
                    <p className="text-sm">Can you help me optimize my resume for a software engineering position?</p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-white ml-3 mt-1">
                    You
                  </div>
                </div>
                
                {/* AI response */}
                <div className="flex items-start">
                  <div className="h-8 w-8 rounded-full bg-[#B4916C]/20 flex items-center justify-center text-[#B4916C] mr-3 mt-1">
                    AI
                  </div>
                  <div className="bg-[#B4916C]/10 rounded-lg p-3 text-gray-300 max-w-[80%]">
                    <p className="text-sm mb-3">
                      I'd be happy to help you optimize your resume! Please select your resume from the sidebar
                      or upload it if you haven't already. Once your document is ready, I can:
                    </p>
                    <ul className="list-disc text-sm pl-5 space-y-1.5">
                      <li>Highlight your relevant technical skills</li>
                      <li>Improve the wording of your achievements</li>
                      <li>Suggest a better structure for your experience section</li>
                      <li>Tailor it to match software engineering job descriptions</li>
                      <li>Fix any formatting inconsistencies</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Message input */}
            <div className="p-4 border-t border-gray-800">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-2">
                  <Textarea 
                    placeholder="Type a message..."
                    className="resize-none min-h-[60px] bg-black/50 border-gray-700 text-gray-300 rounded-lg"
                  />
                  <Button className="bg-[#B4916C] hover:bg-[#A3815C] text-white h-10 px-4 rounded-lg">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  You can ask me to analyze, edit, format, or transform your document
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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
        
        <ErrorRefreshButton />
      </div>
    );
  }
} 