"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Paperclip } from 'lucide-react';

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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      {/* Logo and Title */}
      <motion.div 
        className="mb-16 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mx-auto mb-8">
          <div className="flex">
            <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
        </div>
        <h1 className="text-5xl font-bold mb-4">
          {selectedDocument ? "Let's Edit" : "Let's Create"}
        </h1>
      </motion.div>
      
      {/* Search Container */}
      <motion.div 
        className="w-full max-w-4xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Input and Buttons */}
        <motion.div 
          variants={itemVariants}
          className="bg-[#1E1E1E] rounded-2xl p-4 mb-4"
        >
          <div className="flex flex-col">
            {/* Input Field */}
            <input
              type="text"
              placeholder={placeholders[placeholderIndex]}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white text-xl p-4 outline-none w-full mb-4"
            />
            
            {/* Buttons Row */}
            <div className="flex items-center justify-between">
              {/* Documents Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsDocumentsDropdownOpen(!isDocumentsDropdownOpen)}
                  className="flex items-center space-x-2 bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white px-4 py-2 rounded-lg border border-[#333333]"
                >
                  <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 8L18 14H6L12 8Z" fill="currentColor" />
                  </svg>
                  <span>{selectedDocument ? selectedDocument.name : "Documents"}</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                
                {isDocumentsDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1E1E1E] border border-[#333333] rounded-lg shadow-lg z-10 w-64">
                    <ul>
                      <li 
                        className="px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer text-gray-400 border-b border-[#333333]"
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
                          className={`px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer ${selectedDocument?.id === doc.id ? 'bg-[#2A2A2A]' : ''}`}
                          onClick={() => {
                            setSelectedDocument(doc);
                            setIsDocumentsDropdownOpen(false);
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <span>{doc.name}</span>
                            <span className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="text-xs text-gray-500">Type: {doc.type}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
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
                className="bg-[#1E1E1E] hover:bg-[#2A2A2A] p-2 rounded-full border border-[#333333]"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
} 