"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Define the type for document data - matching the server component
interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
}

interface EnhancePageClientProps {
  documentsData: DocumentData[];
}

// Create a simple error boundary
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Client error caught:", event.error);
      setHasError(true);
      // Prevent the error from bubbling up
      event.preventDefault();
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  if (hasError) {
    return (
      <div className="p-4 bg-red-900 text-white rounded-md">
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p>There was an error rendering this component.</p>
        <button 
          onClick={() => setHasError(false)}
          className="mt-4 px-4 py-2 bg-white text-red-900 rounded-md"
        >
          Try Again
        </button>
      </div>
    );
  }
  
  return <>{children}</>;
}

// Export the component with proper type annotations
export default function EnhancePageClient({ documentsData }: EnhancePageClientProps) {
  // Basic state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Console log for debugging
  useEffect(() => {
    console.log("Rendering EnhancePageClient with documents:", documentsData);
  }, [documentsData]);
  
  // Return a simple UI
  return (
    <div className="min-h-screen bg-[#050505] text-white p-4">
      {/* Back Button */}
      <div className="fixed top-4 left-4 z-10">
        <Link href="/dashboard" className="flex items-center text-white hover:text-[#B4916C] transition-colors">
          <ArrowLeft className="w-5 h-5 mr-1" />
          <span className="text-sm">Back</span>
        </Link>
      </div>
      
      <div className="pt-16 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-white">Enhance Page</h1>
        <p className="mb-4 text-white">Simple version for debugging</p>
        
        {/* Display document count */}
        <div className="mb-6 p-4 bg-[#1A1A1A] rounded-md border border-[#333333]">
          <p className="text-white">Documents loaded: {documentsData.length}</p>
          {documentsData.length > 0 && (
            <ul className="mt-2">
              {documentsData.map(doc => (
                <li key={doc.id} className="text-sm text-gray-400">
                  {doc.name} ({doc.type})
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Simple search input */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type something..."
            className="w-full p-2 bg-[#1A1A1A] border border-[#333333] rounded text-white placeholder-gray-500"
          />
        </div>
      </div>
    </div>
  );
} 