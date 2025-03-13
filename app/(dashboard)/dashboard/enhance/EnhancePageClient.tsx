"use client";

import React, { useState, useEffect } from 'react';

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
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Add effect to track component mounting
  useEffect(() => {
    console.log("EnhancePageClient mounted");
    console.log("Received documentsData:", documentsData);
    setIsLoaded(true);
    
    // Return cleanup function
    return () => {
      console.log("EnhancePageClient unmounted");
    };
  }, [documentsData]);
  
  // Extremely simple render with minimal styling and logic
  return (
    <div className="p-4 bg-[#050505] text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-[#B4916C]">Enhance Documents</h1>
      
      <p className="mb-4">
        {isLoaded ? "Component loaded successfully" : "Component is loading..."}
      </p>
      
      {documentsData.length === 0 ? (
        <p className="text-gray-400">No documents found. Upload a document to get started.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documentsData.map((doc) => (
            <div 
              key={doc.id} 
              className="border border-[#2D2D2D] rounded-lg p-4 bg-[#1A1A1A]"
            >
              <h3 className="font-semibold">{doc.name}</h3>
              <p className="text-sm text-gray-400">Type: {doc.type}</p>
              <p className="text-sm text-gray-400">
                Created: {new Date(doc.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 