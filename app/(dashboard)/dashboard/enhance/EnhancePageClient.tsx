"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Paperclip, Send, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
}

interface EnhancePageClientProps {
  documentsData: DocumentData[];
}

export default function EnhancePageClient({ documentsData }: EnhancePageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDocumentsDropdownOpen, setIsDocumentsDropdownOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  
  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Here you would implement the actual file upload logic
      console.log("File selected:", files[0].name);
      // After upload is complete, you would add the new document to documentsData
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

  // Add a function to handle the send button click
  const handleSendRequest = () => {
    if (!searchQuery.trim()) {
      // You could add a toast notification here
      console.log("Please enter a request");
      return;
    }
    
    console.log("Sending request:", {
      query: searchQuery,
      document: selectedDocument ? selectedDocument.id : null
    });
    
    // Here you would implement the actual request sending logic
    // For now, just clear the input
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col items-start justify-start min-h-screen bg-[#050505] text-white p-4 pt-14 sm:pt-4 sm:items-center sm:justify-center">
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
      
      {/* Logo and Title */}
      <motion.div 
        className="mb-6 sm:mb-8 md:mb-12 text-center w-full"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <div className="flex">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-1"></div>
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full"></div>
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 font-safiro text-white">
          {selectedDocument ? "Let's Edit" : "Let's Create"}
        </h1>
        <p className="text-gray-400 font-borna text-sm sm:text-base">
          {selectedDocument 
            ? "Enhance your existing document with AI" 
            : "Create a new document or upload one to get started"}
        </p>
      </motion.div>
      
      {/* Search Container */}
      <motion.div 
        className="w-full max-w-xl sm:max-w-2xl md:max-w-4xl px-0 sm:px-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Input and Buttons */}
        <motion.div 
          variants={itemVariants}
          className="bg-[#1A1A1A] rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-lg border border-[#333333]"
        >
          <div className="flex flex-col">
            {/* Input Field */}
            <textarea
              placeholder={placeholders[placeholderIndex]}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                // Send on Ctrl+Enter or Cmd+Enter
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSendRequest();
                }
              }}
              className="bg-transparent text-white text-base sm:text-xl p-2 sm:p-4 outline-none w-full mb-4 min-h-[100px] sm:min-h-[120px] resize-none font-borna"
            />
            
            {/* Buttons Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              {/* Documents Dropdown */}
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDocumentsDropdownOpen(!isDocumentsDropdownOpen);
                  }}
                  className="flex items-center space-x-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white px-4 py-2 rounded-lg border border-[#333333] font-borna transition-colors w-full sm:w-auto justify-between sm:justify-start"
                >
                  <span className="truncate max-w-[200px]">{selectedDocument ? selectedDocument.name : "Documents"}</span>
                  <svg className="w-4 h-4 flex-shrink-0 ml-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                
                {isDocumentsDropdownOpen && (
                  <div 
                    className="absolute top-full left-0 mt-1 bg-[#1A1A1A] border border-[#333333] rounded-lg shadow-lg z-10 w-full sm:w-64"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ul>
                      <li 
                        className="px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer text-gray-400 border-b border-[#333333] font-borna"
                        onClick={() => {
                          setSelectedDocument(null);
                          setIsDocumentsDropdownOpen(false);
                        }}
                      >
                        Create new document
                      </li>
                      {documentsData.map((doc) => (
                        <li 
                          key={doc.id}
                          className={`px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer font-borna ${selectedDocument?.id === doc.id ? 'bg-[#2A2A2A]' : ''}`}
                          onClick={() => {
                            setSelectedDocument(doc);
                            setIsDocumentsDropdownOpen(false);
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <span className="truncate max-w-[150px]">{doc.name}</span>
                            <span className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="text-xs text-gray-500">Type: {doc.type}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="flex space-x-2 w-full sm:w-auto justify-end">
                {/* Hidden File Input */}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".doc,.docx,.pdf,.txt"
                />
                
                {/* Upload Button */}
                <button 
                  className="bg-[#1A1A1A] hover:bg-[#2A2A2A] p-2 rounded-full border border-[#333333] transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload a document"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                
                {/* Send Button */}
                <button 
                  className="bg-[#B4916C] hover:bg-[#A3805B] p-2 rounded-full transition-colors flex items-center justify-center"
                  title="Send request"
                  onClick={handleSendRequest}
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Recent Documents Section */}
        {!selectedDocument && documentsData.length > 0 && (
          <motion.div
            variants={fadeInUp}
            className="mt-6 sm:mt-8 w-full"
          >
            <h2 className="text-xl sm:text-2xl font-safiro mb-3 sm:mb-4 text-white px-1">Recent Documents</h2>
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {documentsData.map((doc) => (
                <motion.div
                  key={doc.id}
                  className="bg-[#1A1A1A] p-3 sm:p-4 rounded-lg border border-[#333333] cursor-pointer hover:bg-[#2A2A2A] transition-colors"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedDocument(doc)}
                >
                  <div className="flex justify-between items-center mb-1 sm:mb-2">
                    <h3 className="font-borna text-white text-sm sm:text-base truncate max-w-[200px] sm:max-w-[300px]">{doc.name}</h3>
                    <span className="text-xs text-gray-500 font-borna ml-2 flex-shrink-0">{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500 font-borna">Type: {doc.type}</div>
                    <div className="text-xs text-[#B4916C] font-borna">Tap to edit</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
      
      {/* Empty State - Show when no documents and no query */}
      {!selectedDocument && documentsData.length === 0 && !searchQuery && (
        <motion.div
          variants={fadeInUp}
          className="mt-6 sm:mt-8 text-center"
        >
          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333333] max-w-md mx-auto">
            <div className="w-12 h-12 bg-[#2A2A2A] rounded-full flex items-center justify-center mx-auto mb-4">
              <Paperclip className="w-5 h-5 text-[#B4916C]" />
            </div>
            <h3 className="text-xl font-safiro mb-2 text-white">No documents yet</h3>
            <p className="text-gray-400 font-borna text-sm mb-4">
              Upload a document or create a new one to get started
            </p>
            <button 
              className="bg-[#B4916C] hover:bg-[#A3805B] px-4 py-2 rounded-lg transition-colors font-borna text-white"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Document
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
} 