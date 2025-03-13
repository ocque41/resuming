"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, Paperclip, Globe } from 'lucide-react';

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
  const [isSpeedDropdownOpen, setIsSpeedDropdownOpen] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState('Speed');
  
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
        <h1 className="text-5xl font-bold mb-4">Discover Smarter Search</h1>
      </motion.div>
      
      {/* Search Container */}
      <motion.div 
        className="w-full max-w-4xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Search Input and Buttons */}
        <motion.div 
          variants={itemVariants}
          className="bg-[#1E1E1E] rounded-2xl p-4 mb-4"
        >
          <div className="flex flex-col">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Ask a question..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white text-xl p-4 outline-none w-full mb-4"
            />
            
            {/* Buttons Row */}
            <div className="flex items-center justify-between">
              {/* Speed Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsSpeedDropdownOpen(!isSpeedDropdownOpen)}
                  className="flex items-center space-x-2 bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white px-4 py-2 rounded-lg border border-[#333333]"
                >
                  <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 8L18 14H6L12 8Z" fill="currentColor" />
                  </svg>
                  <span>{selectedSpeed}</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                
                {isSpeedDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1E1E1E] border border-[#333333] rounded-lg shadow-lg z-10">
                    <ul>
                      <li 
                        className="px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer"
                        onClick={() => {
                          setSelectedSpeed('Fast');
                          setIsSpeedDropdownOpen(false);
                        }}
                      >
                        Fast
                      </li>
                      <li 
                        className="px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer"
                        onClick={() => {
                          setSelectedSpeed('Balanced');
                          setIsSpeedDropdownOpen(false);
                        }}
                      >
                        Balanced
                      </li>
                      <li 
                        className="px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer"
                        onClick={() => {
                          setSelectedSpeed('Precise');
                          setIsSpeedDropdownOpen(false);
                        }}
                      >
                        Precise
                      </li>
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Search Button */}
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2">
                <Globe className="w-5 h-5" />
                <span>Search</span>
              </button>
              
              {/* Utility Buttons */}
              <div className="flex space-x-2">
                <button className="bg-[#1E1E1E] hover:bg-[#2A2A2A] p-2 rounded-full border border-[#333333]">
                  <Paperclip className="w-5 h-5" />
                </button>
                <button className="bg-[#1E1E1E] hover:bg-[#2A2A2A] p-2 rounded-full border border-[#333333]">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
} 