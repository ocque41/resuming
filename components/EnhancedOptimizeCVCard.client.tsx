"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Clock, Info, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cacheDocument, getCachedDocument, clearCachedDocument, getCacheAge } from "@/lib/cache/documentCache";

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
        className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 hover:border-[#B4916C] text-gray-300 rounded-md flex justify-between items-center transition-colors duration-200"
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
        <div className="absolute z-10 w-full mt-1 bg-[#0A0A0A] border border-gray-800 rounded-md shadow-lg max-h-60 overflow-auto">
          <ul className="py-1" role="listbox">
            {cvs.map((cv) => {
              const [name, id] = cv.split('|');
              return (
                <li 
                  key={id}
                  className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer"
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
        <div className="absolute z-10 w-full mt-1 bg-[#0A0A0A] border border-gray-800 rounded-md shadow-lg">
          <div className="px-4 py-2 text-sm text-gray-500">No CVs available</div>
        </div>
      )}
    </div>
  );
}

// Interface for the component props
interface EnhancedOptimizeCVCardProps {
  cvs?: string[]; // Format: "filename|id"
}

// Component implementation
export default function EnhancedOptimizeCVCard({ cvs = [] }: EnhancedOptimizeCVCardProps) {
  // State for CV selection
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  
  // State for processing
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  // State for ATS scores
  const [originalAtsScore, setOriginalAtsScore] = useState<number>(0);
  const [improvedAtsScore, setImprovedAtsScore] = useState<number>(0);
  
  // State for UI views
  const [originalText, setOriginalText] = useState<string>("");
  const [optimizedText, setOptimizedText] = useState<string>("");
  const [improvements, setImprovements] = useState<string[]>([]);
  
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
  
  // Fetch original CV text
  const fetchOriginalText = useCallback(async (cvId: string) => {
    try {
      if (!cvId) return;
      
      const response = await fetch(`/api/cv/get-text?cvId=${cvId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.text) {
          setOriginalText(data.text);
          return data.text;
        }
      }
    } catch (error) {
      console.error("Error fetching original CV text:", error);
    }
    return "";
  }, []);
  
  // Handle CV selection with fetching original text
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
    
    // Fetch original text
    await fetchOriginalText(cvId);
    
    // Start polling for status
    setStatusPollingEnabled(true);
    setStatusPollingInterval(1000);
  }, [fetchOriginalText]);
  
  // Process the CV
  const processCV = useCallback(async (forceRefresh: boolean = false) => {
    if (!selectedCVId) {
      setError("Please select a CV first");
      return;
    }
    
    // Set processing state
    setIsProcessing(true);
    setIsProcessed(false);
    setProcessingProgress(0);
    setProcessingStatus("Starting optimization...");
    setError(null);
    
    try {
      console.log(`Processing CV: ${selectedCVName} (ID: ${selectedCVId}), force refresh: ${forceRefresh}`);
      
      // Start the optimization process
      const response = await fetch('/api/cv/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          forceRefresh: forceRefresh
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
      
      // Start polling for status
      setStatusPollingEnabled(true);
      setStatusPollingInterval(1000);
      
    } catch (error) {
      console.error("Error optimizing CV:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred during optimization");
      setIsProcessing(false);
      setProcessingProgress(0);
      setStatusPollingEnabled(false);
    }
  }, [selectedCVId, selectedCVName]);
  
  // Handle reset
  const handleResetProcessing = useCallback(async () => {
    try {
      // Reset processing state
      setProcessingStatus('selecting');
      setProcessingProgress(0);
      
      // If we have a CV ID, call the API to cancel processing
      if (selectedCVId) {
        const response = await fetch(`/api/cv/process/cancel?cvId=${selectedCVId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to cancel processing');
        }
      }
      
      // Clear any existing error
      setError(null);
      
      // Restart the process
      if (selectedCVId) {
        const retryResponse = await fetch(`/api/cv/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cvId: selectedCVId, forceRefresh: true }),
        });
        
        if (retryResponse.ok) {
          setStatusPollingEnabled(true);
          setStatusPollingInterval(1000);
        }
      }
    } catch (error) {
      console.error('Error resetting processing:', error);
      setError('Failed to reset processing. Please try again.');
    }
  }, [selectedCVId]);
  
  // Polling mechanism for process status
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const checkStatus = async () => {
      if (!statusPollingEnabled || !selectedCVId) return;
      
      try {
        const response = await fetch(`/api/cv/process/status?cvId=${selectedCVId}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.processing) {
            // Still processing
            setIsProcessing(true);
            setProcessingStatus(data.step || "Processing...");
            setProcessingProgress(data.progress || 0);
            
            // Check if processing is stuck
            if (data.isStuck) {
              console.warn(`Processing appears stuck at ${data.progress}% for ${data.stuckMinutes} minutes`);
              
              // If stuck for more than 3 minutes, show error and offer retry
              if (data.stuckMinutes > 3) {
                setError(`Processing appears stuck at ${data.progress}%. You can wait or try again.`);
              }
            } else {
              // Clear error if processing is moving again
              setError(null);
            }
            
            // Continue polling, but back off if progress is slow
            const newInterval = data.progress > 80 ? 1000 :
                               data.progress > 60 ? 2000 :
                               data.progress > 40 ? 3000 : 2000;
            
            setStatusPollingInterval(newInterval);
            timeoutId = setTimeout(checkStatus, newInterval);
          } else if (data.isComplete) {
            // Processing completed
            setIsProcessing(false);
            setIsProcessed(true);
            setProcessingStatus("Processing completed");
            setProcessingProgress(100);
            setStatusPollingEnabled(false);
            
            // Update state with optimization results
            if (data.optimizedText) {
              setOptimizedText(data.optimizedText);
            }
            
            if (data.improvements) {
              setImprovements(data.improvements);
            }
            
            if (data.atsScore) {
              setOriginalAtsScore(data.atsScore);
            }
            
            if (data.improvedAtsScore) {
              setImprovedAtsScore(data.improvedAtsScore);
            }
          } else if (data.error) {
            // Processing encountered an error
            setIsProcessing(false);
            setError(`Processing error: ${data.error}`);
            setStatusPollingEnabled(false);
          } else {
            // Not processing or idle
            setIsProcessing(false);
            setProcessingStatus(null);
            setProcessingProgress(null);
            
            // Stop polling if nothing is happening
            if (!data.processing && !data.isComplete) {
              setStatusPollingEnabled(false);
            }
          }
        } else {
          // Stop polling on error
          setStatusPollingEnabled(false);
          setError("Error checking processing status");
        }
      } catch (err) {
        console.error("Error checking CV processing status:", err);
        setStatusPollingEnabled(false);
      }
    };
    
    if (statusPollingEnabled) {
      timeoutId = setTimeout(checkStatus, statusPollingInterval);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [statusPollingEnabled, statusPollingInterval, selectedCVId]);
  
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
  
  // Handle DOCX download
  const handleDownloadDocx = useCallback(async () => {
    if (!selectedCVId) {
      setError("Please select a CV first");
      return;
    }
    
    setIsDownloadingDocx(true);
    
    try {
      // First, try to get the optimized text
      let optimizedTextToUse = optimizedText;
      
      // If we don't have optimized text yet, we need to optimize the CV first
      if (!optimizedTextToUse) {
        setError("Please optimize the CV first before downloading");
        setIsDownloadingDocx(false);
        return;
      }
      
      // Call the API to generate the DOCX file
      const response = await fetch('/api/cv/generate-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          optimizedText: optimizedTextToUse,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate DOCX file');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.docxBase64) {
        throw new Error('Failed to generate DOCX file');
      }
      
      // Create a download link for the DOCX file
      const linkSource = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${data.docxBase64}`;
      const downloadLink = document.createElement('a');
      downloadLink.href = linkSource;
      downloadLink.download = `${selectedCVName?.replace(/\.[^/.]+$/, '') || 'optimized'}-cv.docx`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      console.log('DOCX file downloaded successfully');
    } catch (error) {
      console.error('Error downloading DOCX:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsDownloadingDocx(false);
    }
  }, [selectedCVId, selectedCVName, optimizedText]);
  
  return (
    <Card className="w-full shadow-lg border-0 bg-[#1A1A1A]">
      <CardHeader className="bg-[#121212] text-white rounded-t-lg">
        <CardTitle className="text-[#B4916C] flex items-center gap-2">
          <span>Enhanced CV Optimizer</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* CV Selection */}
        <div className="mb-6">
          <div className="mb-2 text-gray-400 text-sm">Select a CV to optimize</div>
          <ModernFileDropdown 
            cvs={cvs} 
            onSelect={handleSelectCV} 
            selectedCVName={selectedCVName}
          />
        </div>
        
        {/* Error Display */}
        {error && (
          <Alert className="mb-6 bg-red-950 border-red-900 text-red-200">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 bg-red-800 hover:bg-red-700 border-red-700 text-white" 
                onClick={() => processCV(true)}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Process Button */}
        {!isProcessed && !isProcessing && (
          <Button 
            onClick={() => processCV(false)} 
            disabled={!selectedCVId || isProcessing}
            className="w-full bg-[#B4916C] hover:bg-[#A27D59] text-black font-medium mb-4"
          >
            Optimize CV
          </Button>
        )}
        
        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mb-4 p-4 border rounded-md bg-[#050505]">
            <h3 className="text-lg font-semibold">Processing CV</h3>
            <p className="text-sm text-muted-foreground">
              {processingStatus}. Might take a couple minutes, please wait for an accurate optimization.
            </p>
            <div className="w-full h-2 bg-secondary mt-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-in-out" 
                style={{ width: `${processingProgress || 0}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm">{processingProgress || 0}%</p>
              {processingTooLong && (
                <button
                  onClick={handleResetProcessing}
                  className="px-3 py-1 bg-red-900/30 hover:bg-red-800/50 text-red-300 border border-red-800 rounded-md flex items-center text-xs"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Taking too long? Reset
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Results Section */}
        {isProcessed && (
          <div className="mt-6">
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-800 overflow-hidden mt-4">
                <div className="bg-gray-900/50 p-4">
                  <h4 className="text-white font-medium mb-4">Optimization Results</h4>
                  
                  <div className="mb-4">
                    <div className="bg-gray-800 p-4 rounded-md">
                      <h5 className="text-white font-medium mb-2">Optimized Content</h5>
                      <div className="text-gray-300 whitespace-pre-wrap text-sm max-h-96 overflow-y-auto p-2 bg-gray-900 rounded">
                        {optimizedText || "No optimized content available yet."}
                      </div>
                    </div>
                  </div>
                  
                  {/* Download DOCX Button */}
                  <Button
                    onClick={handleDownloadDocx}
                    disabled={isDownloadingDocx || !optimizedText}
                    className="w-full bg-[#050505] hover:bg-gray-800 text-white border border-gray-700 mb-4"
                  >
                    {isDownloadingDocx ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating DOCX...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download as DOCX
                      </>
                    )}
                  </Button>
                  
                  {improvements && improvements.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-white font-medium mb-2">Improvements Made</h5>
                      <ul className="list-disc pl-5 space-y-1 text-gray-300">
                        {improvements.map((improvement, index) => (
                          <li key={index}>{improvement}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <Button
                    onClick={handleResetProcessing}
                    className="bg-transparent hover:bg-gray-800 text-gray-400 border border-gray-700 flex items-center justify-center mt-4 w-full"
                  >
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Start Over
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 