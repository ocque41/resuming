"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Paperclip, Send, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
}

interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
}

interface EnhancePageClientProps {
  documentsData: DocumentData[];
}

export default function EnhancePageClient({ documentsData: initialDocumentsData }: EnhancePageClientProps) {
  const [documentsData, setDocumentsData] = useState<DocumentData[]>(initialDocumentsData);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDocumentsDropdownOpen, setIsDocumentsDropdownOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Add state for chat messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      content: "How can I help you with your documents today?",
      role: "assistant",
      timestamp: new Date().toISOString()
    }
  ]);
  
  // Rotating placeholder phrases
  const placeholders = [
    "Create a professional resume for a software engineer...",
    "Edit my cover letter to highlight leadership skills...",
    "Format this document as a business proposal...",
    "Rewrite this paragraph to be more concise...",
    "Create a project timeline document with milestones..."
  ];
  
  // Rotate placeholders every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prevIndex) => (prevIndex + 1) % placeholders.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDocumentsDropdownOpen) {
        setIsDocumentsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDocumentsDropdownOpen]);
  
  // Fetch documents from the API
  const fetchDocuments = async () => {
    setIsLoadingDocuments(true);
    setDocumentError(null);
    
    try {
      // In a real implementation, this would be an API call to your backend
      // For now, we'll simulate a delay and then use the initial data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // This is where you would fetch from your Dropbox/Neon integration
      // const response = await fetch('/api/documents');
      // const data = await response.json();
      // setDocumentsData(data);
      
      // For now, just use the initial data
      console.log("Documents fetched successfully");
      
      // Simulate adding a new document for demonstration
      const newDocument: DocumentData = {
        id: `mock${documentsData.length + 1}`,
        name: `New Document ${documentsData.length + 1}`,
        type: "document",
        createdAt: new Date().toISOString()
      };
      
      setDocumentsData(prev => [...prev, newDocument]);
    } catch (error) {
      console.error("Error fetching documents:", error);
      setDocumentError("Failed to load documents. Please try again.");
    } finally {
      setIsLoadingDocuments(false);
    }
  };
  
  // Fetch documents on initial load
  useEffect(() => {
    fetchDocuments();
  }, []);
  
  // Handle file upload with integration to storage
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    console.log("File selected:", file.name);
    
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // In a real implementation, this would be an API call to your backend
      // For now, we'll simulate a delay and then add a mock document
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // This is where you would upload to your Dropbox integration
      // const response = await fetch('/api/upload', {
      //   method: 'POST',
      //   body: formData
      // });
      // const data = await response.json();
      
      // Simulate a successful upload
      const newDocument: DocumentData = {
        id: `upload${Date.now()}`,
        name: file.name,
        type: file.name.endsWith('.pdf') ? 'document' : 'cv',
        createdAt: new Date().toISOString()
      };
      
      setDocumentsData(prev => [...prev, newDocument]);
      
      // Add a system message about the upload
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        content: `File "${file.name}" uploaded successfully. You can now ask questions about this document.`,
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, systemMessage]);
      
      // Automatically select the new document
      setSelectedDocument(newDocument);
      
    } catch (error) {
      console.error("Error uploading file:", error);
      
      // Add an error message to the chat
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        content: "There was an error uploading your file. Please try again.",
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.6,
        ease: "easeOut"
      } 
    }
  };

  // Add a ref for scrolling to the bottom of the chat
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom of chat when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Add state for chat loading and errors
  const [isMessageSending, setIsMessageSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  
  // Update the handleSendRequest function to include loading states and error handling
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
    
    // Store the query and clear the input
    const query = searchQuery;
    setSearchQuery('');
    
    // Set loading state
    setIsMessageSending(true);
    
    try {
      // In a real implementation, this would be an API call to your backend
      // For now, we'll simulate a delay and then add a mock response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // This is where you would call your AI service
      // const response = await fetch('/api/chat', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     message: query,
      //     documentId: selectedDocument?.id || null,
      //   }),
      // });
      // 
      // if (!response.ok) {
      //   throw new Error(`Error: ${response.status}`);
      // }
      // 
      // const data = await response.json();
      // const assistantMessage = data.message;
      
      // Simulate a successful response
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: selectedDocument 
          ? `I'm analyzing "${selectedDocument.name}".\n\nYour query was: "${query}"\n\nThis is a simulated response about your document. In the actual implementation, this would be a response from the AI about your specific document.`
          : `Your query was: "${query}"\n\nThis is a simulated response. In the actual implementation, this would be a response from the AI.`,
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prevMessages => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      setChatError("Failed to get a response. Please try again.");
      
      // Add an error message to the chat
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an error processing your request. Please try again.",
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsMessageSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white">
      {/* Fixed Header with Back Button */}
      <motion.div 
        className="fixed top-0 left-0 right-0 z-10 bg-[#050505] border-b border-[#333333] p-4 flex items-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link href="/dashboard" className="flex items-center text-white hover:text-[#B4916C] transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="font-borna text-sm">Back to Dashboard</span>
        </Link>
        
        {selectedDocument && (
          <div className="ml-auto flex items-center">
            <span className="text-sm font-borna text-gray-400 mr-2">Editing:</span>
            <span className="text-sm font-borna text-white truncate max-w-[150px]">{selectedDocument.name}</span>
          </div>
        )}
      </motion.div>
      
      {/* Main Content Area with Proper Padding for Fixed Header */}
      <div className="flex-1 overflow-hidden flex flex-col pt-16 pb-20">
        {/* Title Section */}
        <motion.div 
          className="text-center py-4 sm:py-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-safiro text-white">
            {selectedDocument ? `Enhancing: ${selectedDocument.name}` : "Document Assistant"}
          </h1>
          <p className="text-gray-400 font-borna text-sm sm:text-base mt-2">
            {selectedDocument 
              ? "Ask questions or request edits for your document" 
              : "Upload a document or start a conversation"}
          </p>
        </motion.div>
        
        {/* Chat Messages - Scrollable Area */}
        <motion.div 
          className="flex-1 overflow-y-auto px-4 pb-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {chatMessages.length > 0 ? (
            <div className="space-y-4">
              {chatMessages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`p-3 sm:p-4 rounded-lg border ${
                    message.role === "user" 
                      ? "bg-[#1A1A1A] border-[#333333] ml-auto mr-0 max-w-[80%]" 
                      : "bg-[#2A2A2A] border-[#444444] ml-0 mr-auto max-w-[80%]"
                  }`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-borna text-white text-sm">
                      {message.role === "user" ? "You" : "Assistant"}
                    </h3>
                    <span className="text-xs text-gray-500 font-borna ml-2">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 font-borna whitespace-pre-wrap">
                    {message.content}
                  </p>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-4 text-gray-400 font-borna">
                No messages yet. Start a conversation!
              </div>
            </div>
          )}
        </motion.div>
      </div>
      
      {/* Add error message display in the chat area */}
      {chatError && (
        <div className="bg-red-900/20 border border-red-800 text-red-200 p-2 rounded-md text-sm font-borna mb-4 mx-auto">
          {chatError}
          <button 
            onClick={() => setChatError(null)}
            className="ml-2 underline text-red-300 hover:text-red-100"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Fixed Input Area at Bottom */}
      <motion.div 
        className="fixed bottom-0 left-0 right-0 bg-[#050505] border-t border-[#333333] p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#1A1A1A] rounded-lg border border-[#333333] p-2 sm:p-3">
            <div className="flex items-end">
              <div className="flex-1">
                <textarea
                  placeholder={placeholders[placeholderIndex]}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSendRequest();
                    }
                  }}
                  className="bg-transparent text-white text-sm sm:text-base p-2 outline-none w-full min-h-[40px] max-h-[120px] resize-none font-borna"
                  rows={1}
                />
              </div>
              
              <div className="flex space-x-2 ml-2">
                {/* Document Selection Button */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDocumentsDropdownOpen(!isDocumentsDropdownOpen);
                    }}
                    className="bg-[#2A2A2A] hover:bg-[#3A3A3A] p-2 rounded-full border border-[#444444] transition-colors"
                    title={selectedDocument ? selectedDocument.name : "Select document"}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fill="currentColor"/>
                      <path d="M14 17H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/>
                    </svg>
                  </button>
                  
                  {isDocumentsDropdownOpen && (
                    <div 
                      className="absolute bottom-full mb-2 right-0 bg-[#1A1A1A] border border-[#333333] rounded-lg shadow-lg z-10 w-64"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-2 border-b border-[#333333] flex justify-between items-center">
                        <h3 className="font-borna text-sm text-white">Your Documents</h3>
                        <button 
                          onClick={fetchDocuments} 
                          className="text-xs text-[#B4916C] hover:text-[#A3805B] transition-colors"
                          disabled={isLoadingDocuments}
                        >
                          Refresh
                        </button>
                      </div>
                      
                      {documentError && (
                        <div className="p-3 text-red-400 text-xs font-borna">
                          {documentError}
                          <button 
                            onClick={fetchDocuments}
                            className="ml-2 underline"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      
                      {isLoadingDocuments ? (
                        <div className="p-4 flex justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-[#B4916C]" />
                        </div>
                      ) : (
                        <ul className="max-h-[200px] overflow-y-auto">
                          <li 
                            className="px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer text-gray-400 border-b border-[#333333] font-borna"
                            onClick={() => {
                              setSelectedDocument(null);
                              setIsDocumentsDropdownOpen(false);
                            }}
                          >
                            No document (general chat)
                          </li>
                          {documentsData.length > 0 ? (
                            documentsData.map((doc) => (
                              <li 
                                key={doc.id}
                                className={`px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer font-borna ${selectedDocument?.id === doc.id ? 'bg-[#2A2A2A]' : ''}`}
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  setIsDocumentsDropdownOpen(false);
                                  
                                  // Add a system message about the document selection
                                  const systemMessage: ChatMessage = {
                                    id: Date.now().toString(),
                                    content: `Now working with "${doc.name}". You can ask questions or request edits for this document.`,
                                    role: "assistant",
                                    timestamp: new Date().toISOString()
                                  };
                                  
                                  setChatMessages(prev => [...prev, systemMessage]);
                                }}
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
                
                {/* Upload Button */}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".doc,.docx,.pdf,.txt"
                />
                <button 
                  className="bg-[#2A2A2A] hover:bg-[#3A3A3A] p-2 rounded-full border border-[#444444] transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload a document"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                
                {/* Update the Send button to show loading state */}
                <button 
                  className={`p-2 rounded-full transition-colors flex items-center justify-center ${
                    searchQuery.trim() && !isMessageSending
                      ? "bg-[#B4916C] hover:bg-[#A3805B]" 
                      : "bg-[#2A2A2A] text-gray-500 cursor-not-allowed"
                  }`}
                  onClick={handleSendRequest}
                  disabled={!searchQuery.trim() || isMessageSending}
                  title="Send message"
                >
                  {isMessageSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Add a loading indicator for the last message if it's still being processed */}
      {isMessageSending && (
        <motion.div
          className="p-3 sm:p-4 rounded-lg border bg-[#2A2A2A] border-[#444444] ml-0 mr-auto max-w-[80%]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#B4916C]" />
            <p className="text-sm text-gray-300 font-borna">Thinking...</p>
          </div>
        </motion.div>
      )}
    </div>
  );
} 