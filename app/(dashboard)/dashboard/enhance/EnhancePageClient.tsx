"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, FileText, Upload, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  
  useEffect(() => {
    setIsLoaded(true);
  }, [documentsData]);

  // Animation variants
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
    <motion.div 
      className="min-h-screen bg-[#050505] text-white p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div className="flex items-center">
            <Star className="text-[#B4916C] h-8 w-8 mr-3" />
            <h1 className="text-3xl font-bold text-[#B4916C]">Enhance Documents</h1>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border border-[#B4916C]/20 bg-black/30 shadow-lg">
            <CardHeader>
              <CardTitle className="text-[#B4916C] text-lg flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full bg-[#B4916C] flex items-center justify-center">
                  <Mail className="text-[#050505] h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-300">
                    Select a document to enhance or upload a new one. I can help you improve your documents
                    with professional formatting, grammar corrections, and content suggestions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rest of the component will be added in the next step */}
      </div>
    </motion.div>
  );
} 