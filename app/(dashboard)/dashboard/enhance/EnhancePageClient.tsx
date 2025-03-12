"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Send, FileText, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import dynamic from "next/dynamic";

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
  const [selectedDocumentName, setSelectedDocumentName] = useState<string>("Select a document");
  const [inputMessage, setInputMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your document assistant. How can I help you enhance your document today?"
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Convert string dates back to Date objects for the DocumentCombobox
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
      let response = "I'll help you enhance this document. What specific improvements would you like to make?";
      
      if (selectedDocument) {
        response = `I'll help you enhance "${selectedDocumentName}". What specific improvements would you like to make?`;
      } else {
        response = "Please select a document first so I can help you enhance it.";
      }
      
      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    }, 1000);
    
    setInputMessage("");
  };
  
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Main content - centered like Morphic.sh */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pt-8">
        {/* Header with logo */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/dashboard" className="text-xl font-semibold">Document AI</Link>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</Link>
          </div>
        </div>
        
        {/* Document selector - styled like the model selector on Morphic */}
        <div className="mb-6 relative">
          <div className="flex justify-center">
            <div className="relative inline-block">
              <select 
                className="appearance-none bg-[#1A1A1A] border border-gray-800 rounded-full py-2 pl-4 pr-10 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-700 cursor-pointer"
                value={selectedDocument || ""}
                onChange={(e) => {
                  const docId = e.target.value;
                  setSelectedDocument(docId);
                  const doc = documents.find(d => d.id === docId);
                  if (doc) {
                    setSelectedDocumentName(doc.fileName);
                  }
                }}
              >
                <option value="" disabled>Select a document</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.fileName}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto space-y-6 mb-6">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div 
                className={`max-w-[90%] rounded-lg p-4 ${
                  message.role === "user" 
                    ? "bg-[#1A1A1A] text-white" 
                    : "bg-[#1A1A1A] text-white"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input area */}
        <div className="pb-8">
          <div className="flex items-center space-x-2 bg-[#1A1A1A] rounded-lg p-2">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Message..."
              className="resize-none min-h-[40px] bg-transparent border-0 focus:ring-0 text-white placeholder-gray-500 flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button 
              onClick={handleSendMessage}
              className="bg-white hover:bg-gray-200 text-black rounded-md h-8 px-3"
              disabled={!inputMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 