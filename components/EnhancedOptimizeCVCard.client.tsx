"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Clock, Info } from "lucide-react";
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
  const [progress, setProgress] = useState<number>(0);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'process' | null>(null);
  
  // State for ATS scores
  const [originalAtsScore, setOriginalAtsScore] = useState<number>(0);
  const [improvedAtsScore, setImprovedAtsScore] = useState<number>(0);
  
  // Add a state to track optimization completion
  const [optimizationCompleted, setOptimizationCompleted] = useState<boolean>(false);
  
  // Add a state to track stalled optimization
  const [optimizationStalled, setOptimizationStalled] = useState<boolean>(false);
  
  // Add state for cache information
  const [isCached, setIsCached] = useState<boolean>(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);
  
  // Add state for UI views
  const [originalText, setOriginalText] = useState<string>("");
  const [optimizedText, setOptimizedText] = useState<string>("");
  const [improvements, setImprovements] = useState<string[]>([]);
  
  // State for stuck processing detection
  const [isStuck, setIsStuck] = useState<boolean>(false);
  const [stuckMinutes, setStuckMinutes] = useState<number>(0);
  const [stuckSince, setStuckSince] = useState<string | null>(null);
  
  // Debug state
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
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
    setProgress(0);
    setProcessingStep("");
    setError(null);
    setErrorType(null);
    setForceRefresh(false);
    
    // Fetch original text
    const text = await fetchOriginalText(cvId);
    setOriginalText(text);
    
    // Check if we have a cached version of this document
    const cachedData = getCachedDocument(cvId);
    if (cachedData) {
      console.log("Found cached document data", cachedData);
      setIsCached(true);
      setCacheTimestamp(cachedData.timestamp);
      
      // Pre-populate data from cache
      setOriginalAtsScore(cachedData.originalAtsScore);
      setImprovedAtsScore(cachedData.improvedAtsScore);
      setIsProcessed(true);
      
      // Set optimized text if available
      if (cachedData.optimizedText) {
        setOptimizedText(cachedData.optimizedText);
      }
      
      // Set improvements if available
      if (cachedData.improvements) {
        setImprovements(cachedData.improvements);
      }
    } else {
      setIsCached(false);
      setCacheTimestamp(null);
      setOptimizedText("");
      setImprovements([]);
    }
  }, [fetchOriginalText]);
  
  // Process the CV
  const processCV = useCallback(async (forceRefreshParam: boolean = false) => {
    if (!selectedCVId) {
      setError("Please select a CV first");
      setErrorType('process');
      return;
    }
    
    // Set processing state
    setIsProcessing(true);
    setIsProcessed(false);
    setProgress(0);
    setProcessingStep("Starting optimization...");
    setError(null);
    setErrorType(null);
    setForceRefresh(forceRefreshParam);
    setOptimizationStalled(false);
    
    // Reset stuck detection
    setIsStuck(false);
    setStuckMinutes(0);
    setStuckSince(null);
    
    try {
      console.log(`Processing CV: ${selectedCVName} (ID: ${selectedCVId}), force refresh: ${forceRefreshParam}`);
      
      // Start the optimization process
      const response = await fetch('/api/cv/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          forceRefresh: forceRefreshParam
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
      
      // Update state with optimization results
      setOptimizedText(data.optimizedText || "");
      setImprovements(data.improvements || []);
      setOriginalAtsScore(data.originalAtsScore || 0);
      setImprovedAtsScore(data.improvedAtsScore || 0);
      
      // Cache the document data
      cacheDocument(selectedCVId, {
        docxBase64: "dummy", // Adding a dummy value since we're removing PDF functionality
        optimizedText: data.optimizedText,
        improvements: data.improvements,
        originalAtsScore: data.originalAtsScore,
        improvedAtsScore: data.improvedAtsScore,
        expiryTime: 24 * 60 * 60 * 1000, // 24 hours
        originalText: originalText
      });
      
      // Set processing complete
      setIsProcessing(false);
      setIsProcessed(true);
      setProgress(100);
      setOptimizationCompleted(true);
      
      console.log("CV optimization completed successfully");
    } catch (error) {
      console.error("Error optimizing CV:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred during optimization");
      setErrorType('process');
      setIsProcessing(false);
      setProgress(0);
    }
  }, [selectedCVId, selectedCVName]);
  
  // Handle reset
  const handleReset = useCallback(() => {
    // Clear states
    setIsProcessed(false);
    setIsProcessing(false);
    setProgress(0);
    setProcessingStep("");
    setError(null);
    setErrorType(null);
    setOptimizedText("");
    setImprovements([]);
    setOptimizationCompleted(false);
    setOptimizationStalled(false);
    
    // Clear cache for this CV
    if (selectedCVId) {
      clearCachedDocument(selectedCVId);
      setIsCached(false);
      setCacheTimestamp(null);
    }
    
    console.log("Reset optimization state");
  }, [selectedCVId]);
  
  // Check for stalled processing
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isProcessing) {
      // Set up an interval to check if processing is stuck
      let lastProgress = progress;
      let stuckCounter = 0;
      
      intervalId = setInterval(() => {
        if (progress === lastProgress) {
          stuckCounter++;
          
          // If stuck for more than 1 minute (12 * 5 seconds)
          if (stuckCounter >= 12) {
            setIsStuck(true);
            setStuckMinutes(Math.floor(stuckCounter / 12));
            
            if (!stuckSince) {
              setStuckSince(new Date().toISOString());
            }
            
            // If stuck for more than 3 minutes, mark as stalled
            if (stuckCounter >= 36) {
              setOptimizationStalled(true);
              
              // Auto-complete with what we have
              if (optimizedText) {
                setIsProcessing(false);
                setIsProcessed(true);
                setProgress(100);
              }
            }
          }
        } else {
          // Reset stuck detection if progress changes
          lastProgress = progress;
          stuckCounter = 0;
          setIsStuck(false);
          setStuckMinutes(0);
          setStuckSince(null);
        }
      }, 5000); // Check every 5 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isProcessing, progress, optimizedText]);
  
  return (
    <Card className="w-full shadow-lg border-0 bg-[#1A1A1A]">
      <CardHeader className="bg-[#121212] text-white rounded-t-lg">
        <CardTitle className="text-[#B4916C] flex items-center gap-2">
          <span>Enhanced CV Optimizer</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Debug Information */}
        {debugMode && debugInfo && (
          <div className="mb-4 p-3 bg-gray-900 rounded-md text-xs font-mono overflow-x-auto">
            <div className="text-gray-400 mb-2">Debug Information:</div>
            <div className="text-gray-300">
              <div>Status: {debugInfo.status || 'Unknown'}</div>
              <div>Progress: {debugInfo.progress !== undefined 
                ? `${debugInfo.progress}%` 
                : 'Not available'}
              </div>
            </div>
                  
            {/* Advanced Debug Toggle */}
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setDebugInfo((prev: any) => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
                className="text-xs h-6 px-2 py-0 border-gray-700"
              >
                {debugInfo.showAdvanced ? 'Hide Details' : 'Show Details'}
              </Button>
              
              {debugInfo.showAdvanced && (
                <pre className="mt-2 p-2 bg-black rounded text-gray-400 text-[10px] overflow-x-auto">
                  {JSON.stringify(debugInfo.raw || {}, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
        
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
          <Alert variant="destructive" className="mb-6 bg-red-950 border-red-900 text-red-200">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>
              {error}
              {errorType === 'process' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 bg-red-800 hover:bg-red-700 border-red-700 text-white" 
                  onClick={() => processCV(true)}
                >
                  Retry
                </Button>
              )}
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
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <div className="text-white font-medium">{processingStep}</div>
              <div className="text-gray-400 text-sm">{progress}%</div>
            </div>
            <Progress value={progress} className="h-2 bg-gray-800" />
            
            {isStuck && (
              <Alert className="bg-yellow-900/20 text-yellow-400 border border-yellow-900">
                <Clock className="h-4 w-4 mr-2" />
                <AlertDescription>
                  Processing is taking longer than expected. This has been stuck at {progress}% for {stuckMinutes} minutes.
                </AlertDescription>
              </Alert>
            )}
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
                    onClick={handleReset}
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
        
        {/* Message for stalled optimization */}
        {optimizationStalled && (
          <Alert className="mt-4 bg-yellow-900/20 text-yellow-400 border border-yellow-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The optimization process took longer than expected to complete. We've proceeded with the available results. If you encounter any issues, please try the process again.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 