"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Paperclip, Send, ArrowLeft, Loader2, Globe, FileText, Link as LinkIcon, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

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
  documentsData: DocumentData[];
}

export default function EnhancePageClient({ documentsData: initialDocumentsData }: EnhancePageClientProps) {
  // Use session safely with optional chaining
  const { data: session } = useSession();
  
  // Basic state setup with safe defaults
  const [documentsData, setDocumentsData] = useState<DocumentData[]>(initialDocumentsData || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDocumentsDropdownOpen, setIsDocumentsDropdownOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isMessageSending, setIsMessageSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  
  // Scroll to bottom of chat when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Focus input when conversation starts
  useEffect(() => {
    if (conversationStarted) {
      chatInputRef.current?.focus();
    } else {
      searchInputRef.current?.focus();
    }
  }, [conversationStarted]);
  
  // Example suggested queries
  const suggestedQueries = [
    { icon: <Globe className="w-4 h-4" />, text: "Why is Nvidia growing rapidly?" },
    { icon: <Globe className="w-4 h-4" />, text: "What is OpenAI o1?" },
    { icon: <FileText className="w-4 h-4" />, text: "Tell me about a video that explains Cursor" },
    { icon: <LinkIcon className="w-4 h-4" />, text: "Summary: https://arxiv.org/pdf/2407.16833" },
  ];
  
  // Handle sending a message
  const handleSendRequest = async () => {
    if (!searchQuery.trim() || isMessageSending) {
      return;
    }
    
    // Clear any previous errors
    setChatError(null);
    
    // Create a new user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: searchQuery,
      role: "user",
      timestamp: new Date().toISOString()
    };
    
    // Add the user message to the chat
    setChatMessages(prevMessages => [...prevMessages, userMessage]);
    
    // Clear the input field
    setSearchQuery('');
    
    // Set conversation started to true
    setConversationStarted(true);
    
    // Simulate sending the message to the AI
    setIsMessageSending(true);
    
    try {
      // Simulate a delay for the AI response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create a simulated AI response
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `This is a simulated response to: "${userMessage.content}"`,
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      // Add the AI response to the chat
      setChatMessages(prevMessages => [...prevMessages, aiResponse]);
    } catch (error: any) {
      console.error("Failed to get AI response:", error);
      setChatError("Failed to get a response. Please try again.");
    } finally {
      setIsMessageSending(false);
    }
  };
  
  // Fetch user documents from the database with better error handling
  const fetchUserDocuments = async () => {
    if (!session?.user?.id) return;
    
    setIsLoadingDocuments(true);
    setDocumentError(null);
    
    try {
      // Add a timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`/api/documents?userId=${session.user.id}`, {
        signal: controller.signal
      }).catch(error => {
        console.error("Fetch error:", error);
        return null;
      });
      
      clearTimeout(timeoutId);
      
      // If the fetch failed completely
      if (!response) {
        throw new Error("Network error. Please check your connection.");
      }
      
      if (!response.ok) {
        throw new Error(`Error fetching documents: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validate the response data
      if (!data || !Array.isArray(data.documents)) {
        console.error("Invalid response format:", data);
        throw new Error("Received invalid data from server");
      }
      
      setDocumentsData(data.documents);
    } catch (error: any) {
      console.error("Failed to fetch documents:", error);
      // Don't crash if the API isn't implemented yet
      if (error.name === 'AbortError') {
        setDocumentError("Request timed out. Please try again.");
      } else if (error.message?.includes("fetch")) {
        setDocumentError("API not available. Using demo data.");
        // Use the initial data as fallback
        setDocumentsData(initialDocumentsData || []);
      } else {
        setDocumentError("Failed to load your documents. Please try again.");
      }
    } finally {
      setIsLoadingDocuments(false);
    }
  };
  
  // Fetch documents when the component mounts or session changes
  useEffect(() => {
    if (session?.user?.id) {
      fetchUserDocuments();
    }
  }, [session?.user?.id]);
  
  // Handle file upload with better error handling
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // If session is not available, use demo mode
    if (!session?.user?.id) {
      console.log("No session, using demo mode for upload");
      
      // Create a demo document
      const newDocument: DocumentData = {
        id: `demo-${Date.now()}`,
        name: file.name,
        type: file.name.endsWith('.pdf') ? 'document' : 'cv',
        createdAt: new Date().toISOString()
      };
      
      // Add the demo document to the list
      setDocumentsData(prev => [...prev, newDocument]);
      
      // Add a system message about the upload
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        content: `Demo mode: "${file.name}" uploaded successfully. You can now ask questions about this document.`,
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, systemMessage]);
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', session.user.id);
    
    try {
      setIsLoadingDocuments(true);
      
      // Add a timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for uploads
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      }).catch(error => {
        console.error("Upload fetch error:", error);
        return null;
      });
      
      clearTimeout(timeoutId);
      
      // If the fetch failed completely
      if (!response) {
        throw new Error("Network error during upload. Please check your connection.");
      }
      
      if (!response.ok) {
        throw new Error(`Error uploading document: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validate the response data
      if (!data || !data.document) {
        console.error("Invalid upload response format:", data);
        throw new Error("Received invalid data from server");
      }
      
      // Add the new document to the list
      setDocumentsData(prev => [...prev, data.document]);
      
      // Add a system message about the upload
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        content: `File "${file.name}" uploaded successfully. You can now ask questions about this document.`,
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, systemMessage]);
    } catch (error: any) {
      console.error("Failed to upload document:", error);
      
      // Don't crash if the API isn't implemented yet
      if (error.name === 'AbortError') {
        setChatError("Upload timed out. Please try again with a smaller file.");
      } else if (error.message?.includes("fetch") || error.message?.includes("network")) {
        setChatError("Upload API not available. Using demo mode.");
        
        // Create a demo document as fallback
        const newDocument: DocumentData = {
          id: `demo-${Date.now()}`,
          name: file.name,
          type: file.name.endsWith('.pdf') ? 'document' : 'cv',
          createdAt: new Date().toISOString()
        };
        
        // Add the demo document to the list
        setDocumentsData(prev => [...prev, newDocument]);
        
        // Add a system message about the upload
        const systemMessage: ChatMessage = {
          id: Date.now().toString(),
          content: `Demo mode: "${file.name}" uploaded successfully. You can now ask questions about this document.`,
          role: "assistant",
          timestamp: new Date().toISOString()
        };
        
        setChatMessages(prev => [...prev, systemMessage]);
      } else {
        setChatError("Failed to upload your document. Please try again.");
      }
    } finally {
      setIsLoadingDocuments(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Handle document selection
  const handleDocumentSelect = (doc: DocumentData | null) => {
    setSelectedDocument(doc);
    setIsDocumentsDropdownOpen(false);
    
    if (doc) {
      // Add a system message about the document selection
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        content: `Now working with "${doc.name}". You can ask questions or request edits for this document.`,
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, systemMessage]);
    }
  };
  
  // Simplified render with error boundaries
  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-[#050505] text-white p-4 pt-14 sm:pt-20">
      <div className="w-full max-w-5xl mx-auto">
        {/* Back Button */}
        <motion.div 
          className="fixed top-4 left-4 z-10"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link href="/dashboard" className="flex items-center text-white hover:text-[#B4916C] transition-colors">
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="font-borna text-sm hidden sm:inline">Back</span>
          </Link>
        </motion.div>
        
        {!conversationStarted ? (
          <motion.div 
            className="w-full max-w-3xl mx-auto flex flex-col items-center"
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
            
            {/* Title */}
            <h1 className="text-4xl sm:text-5xl font-bold mb-16 font-safiro text-white text-center">
              {selectedDocument ? "Let's edit professional documents" : "Let's make professional documents"}
            </h1>
            
            {/* Search Input */}
            <div className="w-full mb-8">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Ask a question..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSendRequest();
                    }
                  }}
                  className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#B4916C] font-borna"
                />
                <button 
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md transition-colors ${
                    searchQuery.trim() ? "text-[#B4916C] hover:text-[#A3805B]" : "text-gray-500"
                  }`}
                  onClick={handleSendRequest}
                  disabled={!searchQuery.trim()}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Suggested Queries */}
            <div className="w-full">
              <div className="flex items-center mb-4">
                <div className="flex-1 h-px bg-[#333333]"></div>
                <span className="px-4 text-gray-500 text-sm font-borna">Try asking</span>
                <div className="flex-1 h-px bg-[#333333]"></div>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {suggestedQueries.map((query, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center mb-4 text-gray-300 hover:text-white cursor-pointer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 * index }}
                    onClick={() => {
                      setSearchQuery(query.text);
                      setTimeout(() => {
                        handleSendRequest();
                      }, 100);
                    }}
                  >
                    <div className="mr-2 text-gray-500">→</div>
                    <div className="mr-2">{query.icon}</div>
                    <span className="font-borna">{query.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            className="w-full max-w-3xl mx-auto flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Document Title when in conversation mode */}
            {selectedDocument && (
              <motion.div 
                className="mb-6 text-center"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h1 className="text-2xl sm:text-3xl font-bold font-safiro text-white">
                  {selectedDocument ? "Let's edit professional documents" : "Let's make professional documents"}
                </h1>
                <p className="text-[#B4916C] font-borna mt-1">
                  Working with: {selectedDocument.name}
                </p>
              </motion.div>
            )}
            
            {/* Recent Chats Title */}
            <div className="mb-4 border-b border-[#333333] pb-2">
              <h2 className="text-xl font-safiro text-white">Recent Chats</h2>
            </div>
            
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto mb-6">
              {chatMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  className={`mb-6 ${message.role === "user" ? "ml-auto" : "mr-auto"}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <div 
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === "user" 
                        ? "bg-[#B4916C] text-white ml-auto" 
                        : "bg-[#1A1A1A] text-white"
                    }`}
                  >
                    {message.content}
                  </div>
                  <div 
                    className={`text-xs text-gray-500 mt-1 ${
                      message.role === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    {message.role === "user" ? "You" : "Assistant"} • {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </motion.div>
              ))}
              
              {isMessageSending && (
                <motion.div
                  className="mb-6 mr-auto"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="bg-[#1A1A1A] text-white rounded-lg p-4 flex items-center">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-[#B4916C] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-[#B4916C] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-[#B4916C] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Assistant is thinking...
                  </div>
                </motion.div>
              )}
              
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat Input */}
            <div className="sticky bottom-0 bg-[#050505] pt-2">
              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <input
                    ref={chatInputRef}
                    type="text"
                    placeholder="Ask a follow-up question..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSendRequest();
                      }
                    }}
                    className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#B4916C] font-borna"
                  />
                </div>
                
                <div className="relative">
                  <button 
                    className="bg-[#2A2A2A] hover:bg-[#3A3A3A] p-2 rounded-md transition-colors"
                    onClick={() => setIsDocumentsDropdownOpen(!isDocumentsDropdownOpen)}
                    title="Select document"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  
                  {isDocumentsDropdownOpen && (
                    <div 
                      className="absolute bottom-full mb-2 right-0 bg-[#1A1A1A] border border-[#333333] rounded-lg shadow-lg z-10 w-64"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-2 border-b border-[#333333] flex justify-between items-center">
                        <h3 className="font-borna text-sm text-white">Your Documents</h3>
                        <button 
                          onClick={() => {
                            fileInputRef.current?.click();
                            setIsDocumentsDropdownOpen(false);
                          }}
                          className="text-xs text-[#B4916C] hover:text-[#A3805B] transition-colors"
                        >
                          Upload
                        </button>
                      </div>
                      
                      {isLoadingDocuments ? (
                        <div className="p-4 text-center">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#B4916C]" />
                          <p className="text-sm text-gray-400 font-borna">Loading documents...</p>
                        </div>
                      ) : documentError ? (
                        <div className="p-4 text-center">
                          <p className="text-sm text-red-400 font-borna mb-2">{documentError}</p>
                          <button 
                            onClick={fetchUserDocuments}
                            className="text-xs text-[#B4916C] hover:text-[#A3805B] transition-colors"
                          >
                            Try Again
                          </button>
                        </div>
                      ) : (
                        <ul className="max-h-[200px] overflow-y-auto">
                          <li 
                            className="px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer text-gray-400 border-b border-[#333333] font-borna"
                            onClick={() => handleDocumentSelect(null)}
                          >
                            No document (general chat)
                          </li>
                          {documentsData.length > 0 ? (
                            documentsData.map((doc) => (
                              <li 
                                key={doc.id}
                                className={`px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer font-borna ${selectedDocument?.id === doc.id ? 'bg-[#2A2A2A]' : ''}`}
                                onClick={() => handleDocumentSelect(doc)}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="truncate max-w-[150px]">{doc.name}</span>
                                  <span className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="text-xs text-gray-500">Type: {doc.type}</div>
                              </li>
                            ))
                          ) : (
                            <li className="px-4 py-3 text-gray-500 font-borna text-sm">
                              No documents found. Upload one to get started.
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Upload Button - Hidden but accessible via the dropdown */}
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
                      ? "bg-[#B4916C] hover:bg-[#A3805B] text-white" 
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
              <div className="mt-2 text-red-400 text-sm font-borna">
                {chatError}
                <button 
                  onClick={() => setChatError(null)}
                  className="ml-2 underline"
                >
                  Dismiss
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
} 