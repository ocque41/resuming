"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Paperclip,
  Send,
  Globe,
  FileText,
  Link as LinkIcon,
  Check,
  ChevronDown
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
  
  // Variants for animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };
  
  // Wrap the render output in a try-catch to help isolate rendering errors.
  try {
    return (
      <div className="min-h-screen bg-[#050505] text-[#F9F6EE] flex flex-col items-center p-2 sm:p-4">
        {/* Back Button */}
        <div className="fixed top-4 left-4 z-10">
          <Link href="/dashboard" className="flex items-center text-[#F9F6EE] hover:text-[#B4916C] transition-colors duration-300">
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-sm font-borna">Back</span>
          </Link>
        </div>
        
        {/* Show the search interface until a conversation starts */}
        {!conversationStarted ? (
          <motion.div 
            className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-screen px-2 sm:px-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Logo */}
            <motion.div 
              className="w-16 h-16 bg-[#111111] rounded-full flex items-center justify-center mb-6 border border-[#222222]"
              variants={itemVariants}
            >
              <div className="w-8 h-8 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-r from-[#B4916C] to-[#B4916C]/60 opacity-30 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-[#B4916C] rounded-full mr-1"></div>
                <div className="w-2 h-2 bg-[#F9F6EE] rounded-full"></div>
              </div>
            </motion.div>
            
            {/* Dynamic Title */}
            <motion.h1 
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-8 sm:mb-12 text-[#F9F6EE] text-center font-safiro tracking-tight"
              variants={itemVariants}
            >
              Document <span className="text-[#B4916C]">Editor</span>
            </motion.h1>
            
            <motion.p
              className="text-[#C5C2BA] text-center max-w-lg mb-8 font-borna"
              variants={itemVariants}
            >
              Upload your document or start a new one. Ask questions, edit, and enhance your professional documents with AI assistance.
            </motion.p>
            
            {/* Search Input */}
            <motion.div className="w-full relative mb-8" variants={itemVariants}>
              <div className="relative flex items-center w-full group">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Ask a question or start with 'Create a...' "
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendRequest();
                  }}
                  className="w-full bg-[#111111] border border-[#222222] group-hover:border-[#333333] rounded-xl py-3.5 px-4 text-[#F9F6EE] placeholder-[#8A8782] focus:outline-none focus:ring-1 focus:ring-[#B4916C] focus:border-transparent transition-all duration-300 font-borna"
                />
                <div className="absolute right-2 flex space-x-1 sm:space-x-2">
                  {/* Document Selector */}
                  <div className="relative">
                    <button 
                      className="bg-[#1A1A1A] hover:bg-[#222222] px-2 sm:px-3 py-2 rounded-lg transition-colors duration-300 flex items-center border border-[#333333]"
                      onClick={() => setIsDocumentsDropdownOpen(!isDocumentsDropdownOpen)}
                    >
                      <span className="hidden sm:inline mr-1 text-sm font-borna">Documents</span>
                      <ChevronDown className="h-4 w-4 text-[#8A8782]" />
                    </button>
                    
                    <AnimatePresence>
                      {isDocumentsDropdownOpen && (
                        <motion.div 
                          className="absolute right-0 mt-2 w-64 bg-[#111111] border border-[#222222] rounded-lg shadow-lg py-1 z-10"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {documentsData.length === 0 ? (
                            <div className="px-4 py-3 text-[#8A8782] font-borna text-sm">
                              No documents found. Upload one to get started.
                            </div>
                          ) : (
                            documentsData.map(doc => (
                              <motion.button
                                key={doc.id}
                                className="w-full text-left px-4 py-2 text-[#F9F6EE] hover:bg-[#1A1A1A] transition-colors flex items-center justify-between font-borna text-sm"
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  setIsDocumentsDropdownOpen(false);
                                  setChatMessages(prev => [
                                    ...prev,
                                    {
                                      id: Date.now().toString(),
                                      content: `Selected document: "${doc.name}"`,
                                      role: "assistant",
                                      timestamp: new Date().toISOString()
                                    }
                                  ]);
                                  setConversationStarted(true);
                                }}
                                whileHover={{ x: 4 }}
                                transition={{ duration: 0.2 }}
                              >
                                <span>{doc.name}</span>
                                {selectedDocument?.id === doc.id && (
                                  <Check className="h-4 w-4 text-[#B4916C]" />
                                )}
                              </motion.button>
                            ))
                          )}
                          <div className="border-t border-[#222222] mt-1 pt-1">
                            <motion.button
                              className="w-full text-left px-4 py-2 text-[#B4916C] hover:bg-[#1A1A1A] transition-colors flex items-center font-borna text-sm"
                              onClick={() => fileInputRef.current?.click()}
                              whileHover={{ x: 4 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Paperclip className="h-4 w-4 mr-2" />
                              Upload new document
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Search Button */}
                  <motion.button 
                    className="bg-[#B4916C] hover:bg-[#A3815B] px-3 sm:px-4 py-2 rounded-lg transition-colors duration-300 flex items-center text-[#050505] font-medium"
                    onClick={handleSendRequest}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="hidden sm:inline mr-2 text-sm font-safiro">Start</span>
                    <Send className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
              
              {/* Suggested Queries */}
              <motion.div 
                className="w-full mt-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <h3 className="text-lg font-safiro font-semibold text-[#F9F6EE] mb-4">Try these examples</h3>
                
                {[
                  { icon: <Globe className="w-4 h-4 text-[#B4916C]" />, text: "Create a professional resume for a software engineer" },
                  { icon: <FileText className="w-4 h-4 text-[#B4916C]" />, text: "Write a cover letter for a marketing position" },
                  { icon: <LinkIcon className="w-4 h-4 text-[#B4916C]" />, text: "Help me format my document for better readability" },
                  { icon: <FileText className="w-4 h-4 text-[#B4916C]" />, text: "Summarize my uploaded document" }
                ].map((query, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center mb-4 text-[#C5C2BA] hover:text-[#F9F6EE] cursor-pointer bg-[#111111] hover:bg-[#161616] rounded-lg px-4 py-3 border border-[#222222] hover:border-[#333333] transition-all duration-300"
                    variants={itemVariants}
                    whileHover={{ x: 5, scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setSearchQuery(query.text);
                      setTimeout(() => handleSendRequest(), 100);
                    }}
                  >
                    <div className="mr-3">{query.icon}</div>
                    <span className="font-borna">{query.text}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div 
            className="w-full max-w-3xl mx-auto flex flex-col items-center px-4 pt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Chat Header */}
            <motion.div 
              className="w-full flex items-center justify-between mb-6 bg-[#111111] rounded-lg p-3 border border-[#222222]"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 bg-[#1A1A1A] rounded-full flex items-center justify-center mr-3">
                  <FileText className="w-4 h-4 text-[#B4916C]" />
                </div>
                <div>
                  <h3 className="text-sm font-safiro font-medium text-[#F9F6EE]">Document Editor</h3>
                  {selectedDocument && (
                    <p className="text-xs text-[#8A8782] font-borna">{selectedDocument.name}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center">
                <button 
                  className="text-[#8A8782] hover:text-[#B4916C] transition-colors p-1 rounded-full hover:bg-[#1A1A1A]"
                  onClick={() => {
                    setChatMessages([]);
                    setConversationStarted(false);
                    setSelectedDocument(null);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </motion.div>
            
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto mb-6 w-full">
              <AnimatePresence initial={false}>
                {chatMessages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    className={`mb-6 ${message.role === "user" ? "flex justify-end" : "flex justify-start"}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    layout
                  >
                    <div className={`max-w-[90%] sm:max-w-[80%]`}>
                      <div className={`p-4 rounded-xl ${
                        message.role === "user" 
                          ? "bg-[#B4916C]/20 border border-[#B4916C]/30 text-[#F9F6EE]" 
                          : "bg-[#111111] border border-[#222222] text-[#F9F6EE]"
                      }`}>
                        <p className="whitespace-pre-wrap font-borna">{message.content}</p>
                      </div>
                      <div className={`text-xs text-[#8A8782] mt-1.5 flex items-center ${message.role === "user" ? "justify-end" : "justify-start"} font-borna`}>
                        {message.role === "user" ? (
                          <>
                            <span>You</span>
                            <span className="mx-1">•</span>
                            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </>
                        ) : (
                          <>
                            <span>Assistant</span>
                            <span className="mx-1">•</span>
                            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isMessageSending && (
                <motion.div
                  className="mb-6 w-full flex justify-start"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="max-w-[85%] sm:max-w-[75%]">
                    <div className="p-4 rounded-xl bg-[#111111] border border-[#222222] text-[#F9F6EE]">
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 relative">
                          <div className="absolute inset-0 bg-[#B4916C]/20 rounded-full animate-ping"></div>
                          <Loader2 className="w-5 h-5 animate-spin text-[#B4916C]" />
                        </div>
                        <p className="text-sm text-[#C5C2BA] font-borna">Thinking...</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat Input Area */}
            <motion.div 
              className="sticky bottom-0 w-full bg-[#050505] pt-2 sm:pt-4 pb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative flex items-center w-full">
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder="Ask a follow-up question or give instructions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendRequest(); }}
                  className="w-full bg-[#111111] border border-[#222222] hover:border-[#333333] focus:border-[#B4916C] rounded-xl py-3.5 px-4 text-[#F9F6EE] placeholder-[#8A8782] focus:outline-none focus:ring-1 focus:ring-[#B4916C] transition-all duration-300 font-borna"
                />
                <div className="absolute right-2 flex space-x-2">
                  {/* Attachment Button */}
                  <motion.button 
                    className="p-2 rounded-lg transition-colors bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#333333]"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload document"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Paperclip className="w-5 h-5 text-[#B4916C]" />
                  </motion.button>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".doc,.docx,.pdf,.txt"
                  />
                  
                  {/* Send Button */}
                  <motion.button 
                    className={`p-2 rounded-lg transition-all duration-300 ${
                      searchQuery.trim() && !isMessageSending
                        ? "bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]" 
                        : "bg-[#1A1A1A] text-[#555555] cursor-not-allowed border border-[#222222]"
                    }`}
                    onClick={handleSendRequest}
                    disabled={!searchQuery.trim() || isMessageSending}
                    whileHover={searchQuery.trim() && !isMessageSending ? { scale: 1.05 } : {}}
                    whileTap={searchQuery.trim() && !isMessageSending ? { scale: 0.95 } : {}}
                  >
                    {isMessageSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
              </div>
              
              {chatError && (
                <motion.div 
                  className="mt-2 text-[#E57373] text-sm bg-[#E57373]/10 p-2 rounded-lg border border-[#E57373]/20 flex justify-between items-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="font-borna">{chatError}</p>
                  <button 
                    onClick={() => setChatError(null)}
                    className="text-[#E57373] hover:text-[#E57373]/80 ml-2 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </div>
    );
  } catch (error: any) {
    console.error("Render error in EnhancePageClient:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-[#F9F6EE] p-6">
        <div className="max-w-md w-full bg-[#111111] rounded-xl p-6 border border-[#222222]">
          <h1 className="text-xl font-bold text-[#B4916C] mb-4 font-safiro">Error Rendering Page</h1>
          <p className="text-[#C5C2BA] mb-4 font-borna">We encountered a problem while loading this page.</p>
          <div className="bg-[#0A0A0A] p-4 rounded-lg border border-[#222222] overflow-auto max-h-64">
            <code className="text-[#E57373] text-sm font-mono">{error.message || "Unknown error"}</code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] px-4 py-2 rounded-lg transition-colors duration-300 font-safiro"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}