"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Send, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import dynamic from "next/dynamic";

// Dynamic imports are allowed in client components
const DocumentCombobox = dynamic(
  () => import("@/components/DocumentCombobox.client"),
  { ssr: false }
);

// Define props interface with serializable types
interface EnhancePageClientProps {
  documentsData: {
    id: string;
    fileName: string;
    createdAt: string; // ISO string format
  }[];
}

export default function EnhancePageClient({ documentsData }: EnhancePageClientProps) {
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  
  // Convert string dates back to Date objects for the DocumentCombobox
  const documents = documentsData.map(doc => ({
    id: doc.id,
    fileName: doc.fileName,
    createdAt: new Date(doc.createdAt)
  }));
  
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
                setSelectedDocument(documentId);
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
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile document selector (shown only on small screens) */}
          <div className="md:hidden p-2 border-b border-gray-800">
            <DocumentCombobox 
              documents={documents}
              onSelect={(documentId) => {
                setSelectedDocument(documentId);
                console.log("Selected document (mobile):", documentId);
              }}
              placeholder="Select a document"
              emptyMessage="No documents available"
            />
          </div>
          
          {/* Main content */}
          <div className="flex-1 overflow-auto p-4">
            <div className="max-w-3xl mx-auto">
              {selectedDocument ? (
                <div>
                  <h2 className="text-xl font-medium text-white mb-4">
                    Document Editor
                  </h2>
                  <p className="text-gray-400">
                    Selected document ID: {selectedDocument}
                  </p>
                  {/* Document editing interface would go here */}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <h2 className="text-xl font-medium text-white mb-2">
                    Select a Document
                  </h2>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Choose a document from the sidebar to start editing, or upload a new document.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 