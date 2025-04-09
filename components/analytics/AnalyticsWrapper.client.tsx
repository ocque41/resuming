"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// Dynamically import the visualizer component with loading state
const AnalyticsVisualizer = dynamic(() => import("./AnalyticsVisualizer.client"), {
  loading: () => (
    <div className="flex flex-col items-center justify-center w-full h-64 bg-[#111111] border border-[#222222] rounded-md">
      <div className="w-8 h-8 border-2 border-t-transparent border-[#B4916C] rounded-full animate-spin mb-2"></div>
      <p className="text-[#F9F6EE]">Loading analytics...</p>
    </div>
  ),
  ssr: false
});

// Simple client component wrapper for the analytics visualizer
export default function AnalyticsWrapper() {
  const [showInfo, setShowInfo] = useState(true);
  
  return (
    <div>
      {showInfo && (
        <div className="mb-6 bg-gradient-to-r from-[#151515] to-[#111111] border border-[#222222] rounded-lg overflow-hidden relative">
          <button 
            onClick={() => setShowInfo(false)}
            className="absolute top-3 right-3 text-[#8A8782] hover:text-[#F9F6EE] transition-colors"
            aria-label="Close info banner"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className="p-4 bg-[#B4916C]/10 border-b border-[#B4916C]/20">
            <h3 className="text-lg font-safiro text-[#F9F6EE] flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#B4916C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              New Analytics Dashboard
            </h3>
          </div>
          
          <div className="p-4">
            <p className="text-[#C5C2BA] mb-4">
              This new analytics dashboard provides real-time metrics and insights into document analysis quality and system performance. Use the tabs to navigate between different views.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="flex items-start">
                <div className="bg-[#B4916C] rounded-full p-1 mt-0.5 mr-3 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-[#111111]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[#F9F6EE] text-sm font-medium">User Feedback Metrics</h4>
                  <p className="text-[#8A8782] text-xs">Track user satisfaction and feedback trends</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-[#B4916C] rounded-full p-1 mt-0.5 mr-3 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-[#111111]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[#F9F6EE] text-sm font-medium">Document Type Performance</h4>
                  <p className="text-[#8A8782] text-xs">Compare analysis quality across document types</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-[#B4916C] rounded-full p-1 mt-0.5 mr-3 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-[#111111]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[#F9F6EE] text-sm font-medium">AI Model Comparison</h4>
                  <p className="text-[#8A8782] text-xs">Evaluate performance metrics across different AI models</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-[#B4916C] rounded-full p-1 mt-0.5 mr-3 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-[#111111]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[#F9F6EE] text-sm font-medium">System Performance</h4>
                  <p className="text-[#8A8782] text-xs">Monitor analysis times and success rates</p>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-[#8A8782] italic">
              Data shown is aggregated from user feedback and system metrics to help us continuously improve the document analysis system.
            </div>
          </div>
        </div>
      )}
      
      <AnalyticsVisualizer />
    </div>
  );
} 