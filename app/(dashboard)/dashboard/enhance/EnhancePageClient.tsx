"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Paperclip, Send, ArrowLeft, Loader2, Globe, FileText, Link as LinkIcon, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

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
  const { data: session } = useSession();
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
  
  // Fetch user documents from the database
  const fetchUserDocuments = async () => {
    if (!session?.user?.id) return;
    
    setIsLoadingDocuments(true);
    setDocumentError(null);
    
    try {
      const response = await fetch(`/api/documents?userId=${session.user.id}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching documents: ${response.status}`);
      }
      
      const data = await response.json();
      setDocumentsData(data.documents);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      setDocumentError("Failed to load your documents. Please try again.");
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
  
  // Handle file upload to the actual database
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !session?.user?.id) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', session.user.id);
    
    try {
      setIsLoadingDocuments(true);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Error uploading document: ${response.status}`);
      }
      
      const data = await response.json();
      
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
    } catch (error) {
      console.error("Failed to upload document:", error);
      setChatError("Failed to upload your document. Please try again.");
    } finally {
      setIsLoadingDocuments(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
  const [conversationStarted, setConversationStarted] = useState(false);
  
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
    
    // Set conversation started to true
    setConversationStarted(true);
    
    // Set loading state
    setIsMessageSending(true);
    
    try {
      // Simulate a delay for the response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate a response
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
      setChatError("Failed to send message. Please try again.");
      
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

  // Example suggested queries
  const suggestedQueries = [
    { icon: <Globe className="w-4 h-4" />, text: "Why is Nvidia growing rapidly?" },
    { icon: <Globe className="w-4 h-4" />, text: "What is OpenAI o1?" },
    { icon: <FileText className="w-4 h-4" />, text: "Tell me about a video that explains Cursor" },
    { icon: <LinkIcon className="w-4 h-4" />, text: "Summary: https://arxiv.org/pdf/2407.16833" },
  ];

  const chatInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Update the useEffect to use the correct ref based on conversation state
  useEffect(() => {
    if (conversationStarted) {
      chatInputRef.current?.focus();
    } else {
      searchInputRef.current?.focus();
    }
  }, [conversationStarted]);

  // Update title when document selection changes
  useEffect(() => {
    // If we're in conversation mode, update the document title in the header
    if (conversationStarted && selectedDocument) {
      // You could also update the page title here if needed
      // document.title = `Editing: ${selectedDocument.name}`;
    }
  }, [selectedDocument, conversationStarted]);
  
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
            
            {/* Updated Title */}
            <h1 className="text-4xl sm:text-5xl font-bold mb-16 font-safiro text-white text-center">
              {selectedDocument ? "Let's edit professional documents" : "Let's make professional documents"}
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
                    if (e.key === 'Enter') {
                      handleSendRequest();
                    }
                  }}
                  className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#B4916C] font-borna"
                />
                <div className="absolute right-2 flex space-x-2">
                  <div className="relative">
                    <button 
                      className="bg-[#2A2A2A] hover:bg-[#3A3A3A] p-2 rounded-md transition-colors flex items-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDocumentsDropdownOpen(!isDocumentsDropdownOpen);
                      }}
                    >
                      <span className="mr-1 text-sm hidden sm:inline font-borna">Speed</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    className="bg-[#2A2A2A] hover:bg-[#3A3A3A] p-2 rounded-md text-white font-borna text-sm flex items-center"
                    onClick={handleSendRequest}
                  >
                    <Globe className="w-4 h-4 mr-1" />
                    <span>Search</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Suggested Queries */}
            <div className="w-full">
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
                  <div className={`${message.role === "user" ? "ml-auto" : "mr-auto"} max-w-[85%] sm:max-w-[75%]`}>
                    <div className={`p-3 sm:p-4 rounded-lg ${
                      message.role === "user" 
                        ? "bg-[#1A1A1A] text-white" 
                        : "bg-[#2A2A2A] text-white"
                    }`}>
                      <p className="whitespace-pre-wrap font-borna text-sm sm:text-base">{message.content}</p>
                    </div>
                    <div className={`text-xs text-gray-500 mt-1 font-borna ${
                      message.role === "user" ? "text-right" : "text-left"
                    }`}>
                      {message.role === "user" ? "You" : "Assistant"} • {
                        new Date(message.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })
                      }
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {/* Loading indicator */}
              {isMessageSending && (
                <motion.div
                  className="mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex justify-start">
                    <div className="max-w-[85%] sm:max-w-[75%]">
                      <div className="p-3 sm:p-4 rounded-lg bg-[#2A2A2A] text-white">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-[#B4916C]" />
                          <p className="text-sm text-gray-300 font-borna">Thinking...</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={chatEndRef} />
            </div>
            
            {/* Input Area */}
            <div className="sticky bottom-0 bg-[#050505] pt-4">
              <div className="relative flex items-center w-full">
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
                
                <div className="absolute right-2 flex space-x-2">
                  {/* Document Selection Button */}
                  <div className="relative">
                    <button 
                      className="bg-[#2A2A2A] hover:bg-[#3A3A3A] p-2 rounded-md transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDocumentsDropdownOpen(!isDocumentsDropdownOpen);
                      }}
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
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 