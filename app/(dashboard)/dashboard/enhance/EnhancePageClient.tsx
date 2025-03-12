"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Send, FileText, ChevronDown, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

// Dynamic imports for client components
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

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function EnhancePageClient({ documentsData }: EnhancePageClientProps) {
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [selectedDocumentName, setSelectedDocumentName] = useState<string>("Select document");
  const [inputMessage, setInputMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Convert string dates back to Date objects
  const documents = documentsData.map(doc => ({
    id: doc.id,
    fileName: doc.fileName,
    createdAt: new Date(doc.createdAt)
  }));
  
  // Scroll to bottom of messages when new ones are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { role: "user", content: inputMessage }]);
    
    // Simulate assistant response
    setTimeout(() => {
      let response = "I'll help you create this document. What would you like to include in it?";
      
      if (selectedDocument) {
        response = `I'll help you enhance "${selectedDocumentName}". What specific improvements would you like to make?`;
      }
      
      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    }, 1000);
    
    setInputMessage("");
  };
  
  return (
    <div className="w-full">
      <Card className="border border-[#B4916C]/20 bg-[#121212] shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-[#B4916C]">Document Enhancement</CardTitle>
          <CardDescription className="text-gray-400">
            Create or enhance documents with AI assistance
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-4 md:p-6">
          <div className="mb-6">
            <div className="mb-2 text-gray-400 text-sm">Select a document to enhance or create a new one</div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0 mb-4">
              <div className="w-full">
                <DocumentCombobox 
                  documents={documents} 
                  onSelect={(documentId: string) => {
                    setSelectedDocument(documentId);
                    // Find the document name from the ID
                    const doc = documents.find(d => d.id === documentId);
                    if (doc) {
                      setSelectedDocumentName(doc.fileName);
                    }
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Messages area */}
          <div className="bg-[#1A1A1A] rounded-lg p-4 mb-4">
            {messages.length > 0 ? (
              <div className="max-h-60 overflow-y-auto mb-4 space-y-4">
                {messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div 
                      className={`max-w-[90%] rounded-lg p-3 ${
                        message.role === "user" 
                          ? "bg-[#2A2A2A] text-white" 
                          : "bg-[#B4916C]/10 text-white border border-[#B4916C]/20"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-500" />
                <p className="mb-1">No messages yet</p>
                <p className="text-sm">Select a document and start a conversation</p>
              </div>
            )}
            
            {/* Input area */}
            <div className="flex items-end space-x-2">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-[#2A2A2A] border-gray-700 focus:border-[#B4916C] text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                className="bg-[#B4916C] hover:bg-[#A27D59] text-[#050505] font-medium"
                disabled={!inputMessage.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="text-gray-400 text-sm">
            <p>Our AI assistant can help you create or enhance documents. Select a document to get started or create a new one.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 