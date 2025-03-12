"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Send, FileText, ChevronDown, Paperclip } from "lucide-react";
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
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Main content - centered like the screenshot */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full px-4">
        {/* Logo at the top */}
        <div className="mb-4 mt-16">
          <div className="h-16 w-16 bg-gray-800 rounded-full flex items-center justify-center">
            <div className="flex">
              <div className="h-2 w-2 bg-white rounded-full mr-1"></div>
              <div className="h-2 w-2 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
        
        {/* Main heading */}
        <h1 className="text-4xl font-bold text-center mb-16">Which document shall we create?</h1>
        
        {/* Input container */}
        <div className="w-full bg-[#1A1A1A] rounded-2xl p-4">
          {/* Messages area */}
          {messages.length > 0 && (
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
                        : "bg-[#2A2A2A] text-white"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
          
          {/* Input area */}
          <div className="flex items-center">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask a question..."
              className="resize-none min-h-[40px] bg-transparent border-0 focus:ring-0 text-white placeholder-gray-500 flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
          </div>
        </div>
        
        {/* Bottom controls */}
        <div className="flex items-center justify-between w-full mt-4">
          {/* Document selector dropdown */}
          <div className="relative">
            <button className="flex items-center space-x-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] rounded-full py-2 px-4 text-sm font-medium focus:outline-none">
              <span>{selectedDocumentName}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            <select 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
              <option value="" disabled>Select document</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.fileName}
                </option>
              ))}
            </select>
          </div>
          
          {/* Action buttons */}
          <div className="flex space-x-2">
            <button className="bg-[#1A1A1A] hover:bg-[#2A2A2A] rounded-full p-2">
              <Paperclip className="h-5 w-5" />
            </button>
            <button 
              onClick={handleSendMessage}
              className="bg-[#1A1A1A] hover:bg-[#2A2A2A] rounded-full p-2"
              disabled={!inputMessage.trim()}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 