"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Clock, Info, Download, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cacheDocument, getCachedDocument, clearCachedDocument, getCacheAge } from "@/lib/cache/documentCache";
import { toast } from "@/hooks/use-toast";

// Modern SimpleFileDropdown component
function ModernFileDropdown({ 
  cvs, 
  onSelect, 
  selectedCVName 
}: { 
  cvs: string[]; 
  onSelect: (cvId: string, cvName: string) => void; 
  selectedCVName?: string | null; 
}) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 bg-black border border-gray-700 hover:border-[#B4916C] text-gray-300 rounded-md flex justify-between items-center transition-colors duration-200"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedCVName || "Select a CV"}</span>
        <svg 
          className={`h-5 w-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      {open && cvs.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#121212] border border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          <ul className="py-1" role="listbox">
            {cvs.map((cv) => {
              const [name, id] = cv.split('|');
              return (
                <li 
                  key={id}
                  className="px-4 py-2 text-sm text-gray-300 hover:bg-[#1A1A1A] hover:text-white cursor-pointer"
                  role="option"
                  onClick={() => {
                    onSelect(id, name);
                    setOpen(false);
                  }}
                >
                  {name}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      {open && cvs.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#121212] border border-gray-700 rounded-md shadow-lg">
          <div className="px-4 py-2 text-sm text-gray-500">No CVs available</div>
        </div>
      )}
    </div>
  );
}

// Interface for the component props
interface SpecificOptimizeCVCardProps {
  cvs?: string[]; // Format: "filename|id"
}

// Component implementation
export default function SpecificOptimizeCVCard({ cvs = [] }: SpecificOptimizeCVCardProps) {
  // State for CV selection
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  
  // State for job description
  const [jobDescription, setJobDescription] = useState<string>("");
  
  // State for processing
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>("");
  const [error, setError] = useState<string | null>(null);
  
  // State for optimization results
  const [matchScore, setMatchScore] = useState<number>(0);
  const [keywordMatches, setKeywordMatches] = useState<{keyword: string, count: number}[]>([]);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [optimizedText, setOptimizedText] = useState<string>("");
  const [improvements, setImprovements] = useState<string[]>([]);
  
  // State for UI views
  const [showStructuredView, setShowStructuredView] = useState<boolean>(true);
  
  // State for DOCX download
  const [isDownloadingDocx, setIsDownloadingDocx] = useState<boolean>(false);
  
  // State for status polling
  const [statusPollingEnabled, setStatusPollingEnabled] = useState<boolean>(false);
  const [statusPollingInterval, setStatusPollingInterval] = useState<number>(1000);
  
  // State for processing too long detection
  const [processingTooLong, setProcessingTooLong] = useState<boolean>(false);
  
  // Auto-select first CV if available
  useEffect(() => {
    if (cvs.length > 0 && !selectedCVId) {
      const [name, id] = cvs[0].split('|');
      handleSelectCV(id, name);
    }
  }, [cvs]);
  
  // Handle CV selection
  const handleSelectCV = useCallback(async (cvId: string, cvName: string) => {
    setSelectedCVId(cvId);
    setSelectedCVName(cvName);
    setSelectedCV(`${cvName}|${cvId}`);
    console.log(`Selected CV: ${cvName} (ID: ${cvId})`);
    
    // Reset states when a new CV is selected
    setIsProcessed(false);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setError(null);
    setOptimizedText("");
    setMatchScore(0);
    setKeywordMatches([]);
    setMissingKeywords([]);
    
    // Start polling for status
    setStatusPollingEnabled(true);
    setStatusPollingInterval(1000);
  }, []);
  
  // Process the CV with job description
  const processCV = useCallback(async () => {
    if (!selectedCVId) {
      setError("Please select a CV first");
      return;
    }
    
    if (!jobDescription.trim()) {
      setError("Please enter a job description");
      return;
    }
    
    // Set processing state
    setIsProcessing(true);
    setIsProcessed(false);
    setProcessingProgress(0);
    setProcessingStatus("Starting job-specific optimization...");
    setError(null);
    
    try {
      console.log(`Processing CV: ${selectedCVName} (ID: ${selectedCVId}) with job description`);
      
      // Start the optimization process
      const response = await fetch('/api/cv/process-specific', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          jobDescription: jobDescription
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to optimize CV: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Optimization failed");
      }
      
      // Set the results
      setMatchScore(data.matchScore);
      setKeywordMatches(data.keywordMatches);
      setMissingKeywords(data.missingKeywords);
      setOptimizedText(data.optimizedText);
      
      // Mark as processed
      setIsProcessed(true);
      setIsProcessing(false);
      setProcessingProgress(100);
      setProcessingStatus("Optimization complete");
      
      // Show success toast
      toast({
        title: "Optimization Complete",
        description: "Your CV has been optimized for the job description",
        duration: 3000,
      });
      
    } catch (error) {
      console.error("Error optimizing CV:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred during optimization");
      setIsProcessing(false);
      setProcessingProgress(0);
      setStatusPollingEnabled(false);
    }
  }, [selectedCVId, selectedCVName, jobDescription]);
  
  // Add polling for processing status
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const checkStatus = async () => {
      if (!statusPollingEnabled || !selectedCVId) return;
      
      try {
        // In a real implementation, we would call an API endpoint to check status
        // For now, we'll use the mock implementation with simulated progress
        
        // Check if we have a cached document
        const cachedDoc = await getCachedDocument(selectedCVId, 'specific');
        
        if (cachedDoc && isProcessing) {
          // If we have a cached document, the processing is complete
          setProcessingProgress(100);
          setProcessingStatus("Optimization complete");
          setIsProcessed(true);
          setIsProcessing(false);
          setStatusPollingEnabled(false);
          
          // Set the results from the cached document
          if (cachedDoc.content) {
            setOptimizedText(cachedDoc.content);
          }
          
          return;
        }
        
        // If no cached document yet, continue with simulated progress
        if (isProcessing && processingProgress < 100) {
          // Increment progress by 5-15% each time
          const increment = Math.floor(Math.random() * 10) + 5;
          const newProgress = Math.min(processingProgress + increment, 100);
          
          setProcessingProgress(newProgress);
          
          // Update status message based on progress
          if (newProgress < 30) {
            setProcessingStatus("Analyzing job description...");
          } else if (newProgress < 60) {
            setProcessingStatus("Extracting keywords and requirements...");
          } else if (newProgress < 90) {
            setProcessingStatus("Optimizing CV content...");
          } else {
            setProcessingStatus("Finalizing optimization...");
          }
          
          // If we've reached 100%, mark as complete after a short delay
          if (newProgress === 100) {
            setTimeout(() => {
              setIsProcessed(true);
              setIsProcessing(false);
              setStatusPollingEnabled(false);
            }, 1000);
          } else {
            // Continue polling
            timeoutId = setTimeout(checkStatus, statusPollingInterval);
          }
        }
      } catch (err) {
        console.error("Error checking status:", err);
        setStatusPollingEnabled(false);
      }
    };
    
    if (statusPollingEnabled) {
      timeoutId = setTimeout(checkStatus, statusPollingInterval);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [statusPollingEnabled, statusPollingInterval, selectedCVId, isProcessing, processingProgress]);
  
  // Add a useEffect to detect when processing is taking too long
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isProcessing && processingStatus) {
      // Set a timeout to show the reset button after 30 seconds
      timeoutId = setTimeout(() => {
        setProcessingTooLong(true);
      }, 30000); // 30 seconds
    } else {
      // Clear processing too long flag when not processing
      setProcessingTooLong(false);
    }
    
    // Clean up the timeout when the component unmounts or status changes
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isProcessing, processingStatus]);
  
  // Add a function to handle reset
  const handleResetProcessing = async () => {
    try {
      // Reset processing state
      setProcessingStatus('Starting job-specific optimization...');
      setProcessingProgress(0);
      setError(null);
      
      // Restart the process
      processCV();
      
      // Show toast notification
      toast({
        title: 'Processing Reset',
        description: 'CV optimization has been reset. Trying again...',
        duration: 3000
      });
    } catch (error) {
      console.error('Error resetting processing:', error);
      setError('Failed to reset processing. Please try again.');
    }
  };
  
  // Handle download DOCX
  const handleDownloadDocx = async () => {
    if (!selectedCVId || !isProcessed) return;
    
    setIsDownloadingDocx(true);
    
    try {
      const response = await fetch(`/api/cv/generate-docx?cvId=${selectedCVId}&type=specific`);
      
      if (!response.ok) {
        throw new Error('Failed to generate DOCX file');
      }
      
      // Get the filename from the content-disposition header or use a default
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : 'optimized-cv.docx';
      
      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a download link and click it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "Your optimized CV has been downloaded",
        duration: 3000,
      });
    } catch (error) {
      console.error('Error downloading DOCX:', error);
      setError('Failed to download the optimized CV');
      
      toast({
        title: "Error",
        description: "Failed to download the optimized CV",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsDownloadingDocx(false);
    }
  };
  
  return (
    <Card className="w-full shadow-lg border border-[#B4916C]/20 bg-[#121212]">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-[#B4916C]">Job-Specific CV Optimization</CardTitle>
        <CardDescription className="text-gray-400">
          Optimize your CV for a specific job by providing the job description
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 md:p-6">
        <div className="space-y-6">
          {/* CV Selection */}
          <div>
            <div className="mb-2 text-gray-400 text-sm">Select your CV</div>
            <ModernFileDropdown 
              cvs={cvs} 
              selectedCVName={selectedCVName} 
              onSelect={handleSelectCV} 
            />
          </div>
          
          {/* Job Description Input */}
          <div>
            <div className="mb-2 text-gray-400 text-sm">Paste the job description</div>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              className="min-h-[200px] bg-black border-gray-700 focus:border-[#B4916C] text-white"
            />
          </div>
          
          {/* Error Display */}
          {error && (
            <Alert className="bg-red-950 border-red-900">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Processing Status */}
          {isProcessing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{processingStatus}</span>
                <span className="text-[#B4916C]">{processingProgress}%</span>
              </div>
              <Progress value={processingProgress} className="h-2" />
              
              {processingTooLong && (
                <button
                  onClick={handleResetProcessing}
                  className="px-3 py-1 bg-red-900/30 hover:bg-red-800/50 text-red-300 border border-red-800 rounded-md flex items-center text-xs mt-2"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Taking too long? Reset
                </button>
              )}
            </div>
          )}
          
          {/* Optimization Results */}
          {isProcessed && (
            <div className="space-y-6">
              {/* Match Score */}
              <div className="bg-black p-4 rounded-lg border border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-2">Job Match Score</h3>
                <div className="flex items-center">
                  <div className="text-4xl font-bold text-[#B4916C]">{matchScore}%</div>
                  <div className="ml-4 text-sm text-gray-400">
                    Match with job requirements
                  </div>
                </div>
              </div>
              
              {/* Keyword Matches */}
              <div className="bg-black p-4 rounded-lg border border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-2">Keyword Matches</h3>
                <div className="grid grid-cols-2 gap-4">
                  {keywordMatches.map(({ keyword, count }) => (
                    <div key={keyword} className="flex justify-between items-center">
                      <span className="text-gray-300">{keyword}</span>
                      <span className="text-[#B4916C]">×{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Missing Keywords */}
              {missingKeywords.length > 0 && (
                <div className="bg-black p-4 rounded-lg border border-gray-800">
                  <h3 className="text-lg font-semibold text-white mb-2">Missing Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                    {missingKeywords.map((keyword) => (
                      <span 
                        key={keyword}
                        className="px-2 py-1 bg-red-950/30 text-red-300 border border-red-900/50 rounded-md text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Download Button */}
              <Button
                onClick={handleDownloadDocx}
                disabled={isDownloadingDocx}
                className="w-full bg-[#B4916C] hover:bg-[#A27D59] text-white font-medium"
              >
                {isDownloadingDocx ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Generating DOCX...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download Optimized CV
                  </>
                )}
              </Button>
            </div>
          )}
          
          {/* Optimize Button */}
          {!isProcessing && !isProcessed && (
            <Button
              onClick={processCV}
              disabled={!selectedCVId || !jobDescription.trim()}
              className="w-full bg-[#B4916C] hover:bg-[#A27D59] text-white font-medium"
            >
              Optimize CV for Job
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 