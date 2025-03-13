"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Search, ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
      let response = "I'll help you create this document. What specific content would you like to include?";
      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    }, 1000);
    
    setInputMessage("");
  };
  
  return (
    <div className="w-full flex flex-col items-center min-h-[calc(100vh-120px)]">
      {/* Logo and Title */}
      <div className="w-full max-w-4xl text-center mb-12 mt-16 px-4">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-[#222222] rounded-full flex items-center justify-center">
            <div className="h-2 w-2 bg-white rounded-full mr-1"></div>
            <div className="h-2 w-2 bg-white rounded-full"></div>
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 md:mb-12">Let's make a document</h1>
      </div>
      
      {/* Search Container */}
      <div className="w-full max-w-4xl px-4">
        <div className="bg-[#1A1A1A] rounded-2xl p-4 md:p-6 shadow-xl border border-[#333333]">
          {/* Search Input */}
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Describe the document you want to create..."
            className="w-full bg-[#1A1A1A] border-none text-white text-lg resize-none min-h-[60px] focus:outline-none focus:ring-0 placeholder-gray-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          
          {/* Button Row */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            {/* Left Buttons */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                className="bg-[#222222] hover:bg-[#333333] text-white rounded-full px-3 md:px-4 h-10 flex items-center"
              >
                <FileText className="text-green-400 h-4 w-4 mr-1 md:mr-2" />
                <span>Documents</span>
                <ChevronDown className="h-4 w-4 ml-1 md:ml-2" />
              </Button>
              
              <Button
                onClick={handleSendMessage}
                className="bg-[#2A4D7F] hover:bg-[#3A5D8F] text-white rounded-full px-4 md:px-6 h-10 flex items-center"
              >
                <Search className="h-4 w-4 mr-2" />
                <span>Create</span>
              </Button>
            </div>
            
            {/* Right Buttons */}
            <div className="ml-auto flex items-center space-x-2">
              <Button
                variant="ghost"
                className="bg-[#222222] hover:bg-[#333333] text-white rounded-full p-2 h-10 w-10 flex items-center justify-center"
                aria-label="Attach file"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              
              <Button
                onClick={handleSendMessage}
                variant="ghost"
                className="bg-[#222222] hover:bg-[#333333] text-white rounded-full p-2 h-10 w-10 flex items-center justify-center"
                aria-label="Submit"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Messages area */}
        {messages.length > 0 && (
          <div className="mt-8 space-y-4 px-2">
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
        )}
      </div>
    </div>
  );
} 