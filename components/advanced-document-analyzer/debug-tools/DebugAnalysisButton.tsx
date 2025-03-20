import React from 'react';
import { Button } from '@/components/ui/button';
import { AnalysisResult } from '../types';

interface DebugAnalysisButtonProps {
  documentId?: string;
  fileName?: string;
  analysisType: string;
  onAnalysisStart: () => void;
  onAnalysisComplete: (result: AnalysisResult) => void;
  onAnalysisError: (error: string) => void;
  onAnalysisEnd: () => void;
  fallbackGenerator: () => AnalysisResult;
}

const DebugAnalysisButton: React.FC<DebugAnalysisButtonProps> = ({
  documentId,
  fileName,
  analysisType,
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisError,
  onAnalysisEnd,
  fallbackGenerator
}) => {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleDebugClick = async () => {
    console.log("Calling debug API endpoint");
    onAnalysisStart();
    
    try {
      // Call the debug API with current document data
      const response = await fetch('/api/document-analysis/debug-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: documentId || 'debug-sample',
          fileName: fileName || 'debug-sample.pdf',
          type: analysisType
        })
      });
      
      // Get the text response for debugging
      const responseText = await response.text();
      console.log("Debug API response received, length:", responseText.length);
      
      try {
        // Parse the response
        const debugSample = JSON.parse(responseText);
        console.log("Debug API response parsed successfully:", {
          hasResult: !!debugSample,
          resultKeys: Object.keys(debugSample)
        });
        
        // Call the completion handler
        onAnalysisComplete(debugSample);
      } catch (parseError) {
        console.error("Failed to parse debug API response:", parseError);
        onAnalysisError("Debug API returned invalid JSON: " + String(parseError));
        
        // Try fallback
        const fallbackSample = fallbackGenerator();
        onAnalysisComplete(fallbackSample);
      }
    } catch (error) {
      console.error("Debug API call failed:", error);
      onAnalysisError("Debug API call failed: " + String(error));
      
      // Fallback to local generation if API fails
      const fallbackSample = fallbackGenerator();
      onAnalysisComplete(fallbackSample);
    } finally {
      onAnalysisEnd();
    }
  };

  return (
    <Button
      onClick={handleDebugClick}
      className="ml-2 bg-purple-700 hover:bg-purple-800 text-white"
    >
      Debug: Test Analysis
    </Button>
  );
};

export default DebugAnalysisButton; 