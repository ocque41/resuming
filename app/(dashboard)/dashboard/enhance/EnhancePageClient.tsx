"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Paperclip,
  Send,
  Globe,
  FileText,
  Link as LinkIcon,
  Check
} from "lucide-react";

interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
}

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
}

interface EnhancePageClientProps {
  documentsData?: DocumentData[];
}

export default function EnhancePageClient({
  documentsData: initialDocumentsData = []  // Provide a default value
}: EnhancePageClientProps) {
  // State management
  const [documentsData, setDocumentsData] = useState<DocumentData[]>(initialDocumentsData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDocumentsDropdownOpen, setIsDocumentsDropdownOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isMessageSending, setIsMessageSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);

  // Refs for input fields and auto-scrolling
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  
  // Backend Integration: fetch documents dynamically from API on mount
  useEffect(() => {
    async function fetchDocuments() {
      try {
        const response = await fetch("/api/documents");
        if (!response.ok) {
          console.error("API response not ok:", response.status, response.statusText);
          return;
        }
        const data = await response.json();
        // Log for debugging
        console.log("Fetched documents:", data);
        setDocumentsData(data.documents || []);
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      }
    }
    fetchDocuments();
  }, []);
  
  // Scroll to the bottom every time new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);
  
  // Focus on the appropriate input based on conversation state
  useEffect(() => {
    if (conversationStarted) {
      chatInputRef.current?.focus();
    } else {
      searchInputRef.current?.focus();
    }
  }, [conversationStarted]);
  
  // Handler to send a message
  const handleSendRequest = async () => {
    if (!searchQuery.trim() || isMessageSending) {
      return;
    }
    
    setChatError(null);
    
    // Create a new user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: searchQuery,
      role: "user",
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    const query = searchQuery;
    setSearchQuery('');
    setConversationStarted(true);
    setIsMessageSending(true);
    
    try {
      // Simulate a delay for the AI response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: selectedDocument 
          ? `I'm analyzing "${selectedDocument.name}".\nYour query was: "${query}"\nSimulated AI response regarding the document.`
          : `General response to your query: "${query}".\nSimulated AI response for general professional document creation.`,
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      setChatError("Failed to get response. Please try again.");
    }
    
    setIsMessageSending(false);
  };
  
  // Handler for file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    console.log("File selected:", file.name);
    
    const newDocument: DocumentData = {
      id: `upload-${Date.now()}`,
      name: file.name,
      type: file.name.endsWith('.pdf') ? 'document' : 'cv',
      createdAt: new Date().toISOString()
    };
    
    setDocumentsData(prev => [...prev, newDocument]);
    
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      content: `File "${file.name}" uploaded successfully. You can now ask questions or edit this document.`,
      role: "assistant",
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, systemMessage]);
  };
  
  // Wrap the render output in a try-catch to help isolate rendering errors.
  try {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center p-2 sm:p-4">
        {/* Back Button */}
        <div className="fixed top-4 left-4 z-10">
          <Link href="/dashboard" className="flex items-center text-white hover:text-[#B4916C] transition-colors">
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-sm">Back</span>
          </Link>
        </div>
        
        {/* Show the search interface until a conversation starts */}
        {!conversationStarted ? (
          <motion.div 
            className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-screen px-2 sm:px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Logo */}
            <div className="w-16 h-16 bg-[#1A1A1A] rounded-full flex items-center justify-center mb-6">
              <div className="flex">
                <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>
            
            {/* Dynamic Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-8 sm:mb-16 text-white text-center">
              Discover Smarter Search
            </h1>
            
            {/* Search Input */}
            <div className="w-full relative mb-8">
              <div className="relative flex items-center w-full">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Ask a question..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendRequest();
                  }}
                  className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#B4916C]"
                />
                <div className="absolute right-2 flex space-x-1 sm:space-x-2">
                  {/* Speed Button - Hide text on small screens */}
                  <button 
                    className="bg-[#1A1A1A] hover:bg-[#2A2A2A] px-2 sm:px-3 py-2 rounded-md transition-colors flex items-center"
                  >
                    <span className="hidden sm:inline mr-1 text-sm">Speed</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 9L12 16L5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  
                  {/* Search Button - Hide text on small screens */}
                  <button 
                    className="bg-[#2A2A2A] hover:bg-[#3A3A3A] px-2 sm:px-3 py-2 rounded-md transition-colors flex items-center"
                    onClick={handleSendRequest}
                  >
                    <Globe className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline text-sm">Search</span>
                  </button>
                </div>
              </div>
              
              {/* Suggested Queries */}
              <div className="w-full mt-8">
                {[
                  { icon: <Globe className="w-4 h-4" />, text: "Why is Nvidia growing rapidly?" },
                  { icon: <Globe className="w-4 h-4" />, text: "What is OpenAI o1?" },
                  { icon: <FileText className="w-4 h-4" />, text: "Tell me about a video that explains Cursor" },
                  { icon: <LinkIcon className="w-4 h-4" />, text: "Summary: https://arxiv.org/pdf/2407.16833" }
                ].map((query, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center mb-4 text-gray-300 hover:text-white cursor-pointer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 * index }}
                    onClick={() => {
                      setSearchQuery(query.text);
                      setTimeout(() => handleSendRequest(), 100);
                    }}
                  >
                    <div className="mr-2 text-gray-500">→</div>
                    <div className="mr-2">{query.icon}</div>
                    <span>{query.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            className="w-full max-w-3xl mx-auto flex flex-col items-center px-4 pt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto mb-6 w-full">
              {chatMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  className={`mb-6 ${message.role === "user" ? "ml-auto" : "mr-auto"}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <div className={`max-w-[90%] sm:max-w-[80%] ${message.role === "user" ? "ml-auto" : "mr-auto"}`}>
                    <div className={`p-4 rounded-lg ${message.role === "user" ? "bg-[#1A1A1A] text-white" : "bg-[#2A2A2A] text-white"}`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <div className={`text-xs text-gray-500 mt-1 ${message.role === "user" ? "text-right" : "text-left"}`}>
                      {message.role === "user" ? "You" : "Assistant"} • {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isMessageSending && (
                <motion.div
                  className="mb-6 w-full flex justify-start"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="max-w-[85%] sm:max-w-[75%]">
                    <div className="p-3 rounded-lg bg-[#2A2A2A] text-white">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#B4916C]" />
                        <p className="text-sm text-gray-300">Thinking...</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat Input Area */}
            <div className="sticky bottom-0 w-full bg-[#050505] pt-2 sm:pt-4">
              <div className="relative flex items-center w-full">
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder="Ask a follow-up question..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendRequest(); }}
                  className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#B4916C]"
                />
                <div className="absolute right-2 flex space-x-2">
                  {/* Attachment Button */}
                  <button 
                    className="p-2 rounded-md transition-colors bg-[#2A2A2A] hover:bg-[#3A3A3A]"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload document"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".doc,.docx,.pdf,.txt"
                  />
                  
                  {/* Send Button */}
                  <button 
                    className={`p-2 rounded-md transition-colors ${
                      searchQuery.trim() && !isMessageSending
                        ? "bg-[#B4916C] hover:bg-[#A3805C] text-white" 
                        : "bg-[#2A2A2A] text-gray-500 cursor-not-allowed"
                    }`}
                    onClick={handleSendRequest}
                    disabled={!searchQuery.trim() || isMessageSending}
                  >
                    {isMessageSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              
              {chatError && (
                <div className="mt-2 text-red-400 text-sm">
                  {chatError}
                  <button 
                    onClick={() => setChatError(null)}
                    className="ml-2 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    );
  } catch (error: any) {
    console.error("Render error in EnhancePageClient:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">
        <div>
          <h1>Error Rendering Page</h1>
          <p>{error.message || "Unknown error"}</p>
        </div>
      </div>
    );
  }
}