"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, FileText, Upload, Mail } from 'lucide-react';

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
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Add effect to track component mounting and animate in
  useEffect(() => {
    console.log("EnhancePageClient mounted");
    console.log("Received documentsData:", documentsData);
    setIsLoaded(true);
    
    // Return cleanup function
    return () => {
      console.log("EnhancePageClient unmounted");
    };
  }, [documentsData]);

  // Character animation variants
  const characterVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.5,
        delay: 0.2
      }
    }
  };
  
  // Document card animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({ 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.3,
        delay: 0.1 * i
      }
    })
  };

  return (
    <div className="p-6 bg-[#050505] text-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header with animated sparkle effect */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center mb-8"
        >
          <Star className="text-[#B4916C] mr-3" />
          <h1 className="text-3xl font-bold text-[#B4916C]">Enhance Documents</h1>
        </motion.div>
        
        {/* Character assistant */}
        <motion.div
          variants={characterVariants}
          initial="hidden"
          animate="visible"
          className="mb-8 p-6 bg-[#1A1A1A] rounded-lg border border-[#2D2D2D]"
        >
          <div className="flex items-start">
            <div className="w-12 h-12 rounded-full bg-[#B4916C] flex items-center justify-center mr-4">
              <Mail className="text-[#050505]" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-xl mb-2">AI Assistant</h3>
              <p className="text-gray-400">
                Select a document to enhance or upload a new one. I can help you improve your documents
                with professional formatting, grammar corrections, and content suggestions.
              </p>
            </div>
          </div>
        </motion.div>
        
        {/* Document grid with animations */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Documents</h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center px-4 py-2 bg-[#B4916C] text-[#050505] rounded-md font-medium"
            >
              <Upload className="mr-2" size={18} />
              Upload New
            </motion.button>
          </div>
          
          {documentsData.length === 0 ? (
            <div className="text-center py-12 bg-[#1A1A1A] rounded-lg border border-[#2D2D2D]">
              <FileText className="mx-auto mb-3 text-gray-500" size={48} />
              <p className="text-gray-400">No documents found. Upload a document to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documentsData.map((doc, index) => (
                <motion.div 
                  key={doc.id}
                  custom={index}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ scale: 1.03, boxShadow: "0 10px 30px -15px rgba(0, 0, 0, 0.3)" }}
                  className={`border ${selectedDocument?.id === doc.id ? 'border-[#B4916C]' : 'border-[#2D2D2D]'} 
                             rounded-lg p-4 bg-[#1A1A1A] cursor-pointer transition-all`}
                  onClick={() => setSelectedDocument(doc)}
                >
                  <div className="flex items-start">
                    <div className="p-2 bg-[#2D2D2D] rounded mr-3">
                      <FileText className="text-[#B4916C]" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{doc.name}</h3>
                      <p className="text-sm text-gray-400">Type: {doc.type}</p>
                      <p className="text-sm text-gray-400">
                        Created: {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        
        {/* Selected document section */}
        {selectedDocument && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
            className="p-6 bg-[#1A1A1A] rounded-lg border border-[#2D2D2D] overflow-hidden"
          >
            <h2 className="text-xl font-semibold mb-4">Enhance: {selectedDocument.name}</h2>
            <div className="flex space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-[#B4916C] text-[#050505] rounded-md font-medium"
              >
                Start Enhancement
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-transparent border border-[#2D2D2D] text-white rounded-md font-medium"
              >
                View Details
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 