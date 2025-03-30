// OptimizeCVCard.client.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, RefreshCw } from "lucide-react";
import { ComboboxPopover } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";

// Minimal interface
interface OptimizeCVCardProps {
  cvs?: string[]; // Format: "filename|id"
}

// Simplified component
export default function OptimizeCVCard({ cvs = [] }: OptimizeCVCardProps) {
  // State for CV selection
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [cvOptions, setCvOptions] = useState<string[]>(cvs);
  
  // State for raw CV text (used for preview without CV ID)
  const [rawText, setRawText] = useState<string | null>(null);
  
  // State for optimization process
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isOptimized, setIsOptimized] = useState<boolean>(false);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isAccepted, setIsAccepted] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [optimizationStep, setOptimizationStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [optimizedPdfData, setOptimizedPdfData] = useState<string | null>(null);
  const [optimizedDocxData, setOptimizedDocxData] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  
  // State to track if we should force re-optimization
  const [forceReoptimize, setForceReoptimize] = useState<boolean>(false);

  // Add a state for DOCX download loading
  const [isDownloadingDocx, setIsDownloadingDocx] = useState<boolean>(false);

  // Extract display names for the CV dropdown (without the ID part)
  const displayCVOptions = cvOptions.map(cv => {
    const parts = cv.split('|');
    return parts[0].trim();
  });

  // Fetch available CVs when component mounts
  useEffect(() => {
    const fetchCVs = async () => {
      try {
        // If cvs prop is provided, use it
        if (cvs.length > 0) {
          setCvOptions(cvs);
          console.log(`Using ${cvs.length} CVs from props`);
          return;
        }
        
        // If no CVs are provided via props, try to fetch from API
        try {
          const response = await fetch('/api/cv/list');
          if (!response.ok) {
            throw new Error(`Failed to fetch CV list: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.cvs && data.cvs.length > 0) {
            const cvOptions = data.cvs.map((cv: any) => `${cv.fileName}|${cv.id}`);
            setCvOptions(cvOptions);
            console.log(`Fetched ${cvOptions.length} CVs from API`);
          } else {
            // No CVs found from API either
            setError("No CVs available. Please upload a CV first.");
          }
        } catch (apiError) {
          console.error('Error fetching CVs from API:', apiError);
          // Since we have CVs from props, don't show an error
          if (cvs.length === 0) {
            setError(`Failed to load CV list: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
          }
        }
      } catch (error) {
        console.error('Error setting up CV options:', error);
        setError(`Failed to load CV list: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    fetchCVs();
  }, [cvs]);

  // Handle CV selection
  const handleCVSelect = useCallback((cv: string) => {
    console.log(`Selected CV: ${cv}`);
    
    // Find the original CV string with ID
    const originalCVString = cvOptions.find(item => item.startsWith(cv + '|'));
    
    if (originalCVString) {
      const parts = originalCVString.split('|');
      const fileName = parts[0].trim();
      const id = parts[1].trim();
      
      console.log(`Selected CV: ${fileName}, ID: ${id}`);
      // Set the full string format "filename|id" instead of just filename
      setSelectedCV(originalCVString);
    } else {
      // If we can't find it in our options, create a proper ID format
      console.log("Could not find ID for selected CV, looking for a matching ID");
      
      // Try to find the ID in another way - perhaps it's already in the selectedCV format
      const possibleMatch = cvOptions.find(item => {
        const itemFileName = item.split('|')[0].trim();
        return itemFileName === cv;
      });
      
      if (possibleMatch) {
        console.log("Found a matching CV by filename:", possibleMatch);
        setSelectedCV(possibleMatch);
      } else {
        console.log("No matching CV found, using display name only with empty ID");
        // Create a properly formatted string but with an empty ID
        const newCVString = `${cv}|unknown`;
        setSelectedCV(newCVString);
        setCvOptions(prev => [...prev, newCVString]);
      }
    }
  }, [cvOptions]);

  // Function to poll for optimization status
  const pollOptimizationStatus = useCallback(async (fileName: string, cvId?: string) => {
    try {
      // Use the ID if available, otherwise use the filename
      const queryParam = cvId 
        ? `cvId=${encodeURIComponent(cvId)}` 
        : `fileName=${encodeURIComponent(fileName)}`;
      
      const response = await fetch(`/api/optimize-cv/status?${queryParam}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get optimization status');
      }
      
      const statusData = await response.json();
      console.log("Optimization status:", statusData);
      
      // Update progress and step based on status
      if (statusData.progress) {
        setProgress(statusData.progress);
      }
      
      // Set step based on progress
      if (statusData.progress < 20) {
        setOptimizationStep("Starting optimization process");
      } else if (statusData.progress < 40) {
        setOptimizationStep("Analyzing CV content");
      } else if (statusData.progress < 60) {
        setOptimizationStep("Applying standard formatting");
      } else if (statusData.progress < 80) {
        setOptimizationStep("Generating optimized document");
      } else if (statusData.progress < 100) {
        setOptimizationStep("Finalizing optimization");
      }
      
      // Check if optimization is complete
      if (statusData.optimized) {
        // Clear polling interval
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        setIsOptimized(true);
        setIsOptimizing(false);
        setProgress(100);
        setOptimizationStep("Optimization complete");
        
        // Enter preview mode
        setIsPreviewMode(true);
        
        // Try to get the optimized PDF for preview
        try {
          // Get the CV ID from the status data or use the filename
          const cvId = statusData.id || statusData.cvId;
          
          if (cvId) {
            console.log(`Fetching optimized PDF for CV ID: ${cvId}`);
            const pdfResponse = await fetch(`/api/cv-pdf-generator?cvId=${cvId}`);
            
            if (pdfResponse.ok) {
              const pdfData = await pdfResponse.json();
              console.log("PDF response received:", pdfData.message || "Success");
              
              if (pdfData.pdfBase64) {
                console.log(`Received PDF base64 data (${pdfData.pdfBase64.length} chars)`);
                setOptimizedPdfData(pdfData.pdfBase64);
                console.log("Retrieved optimized PDF data");
              } else if (pdfData.docxBase64) {
                // If PDF generation failed but we have DOCX data
                console.log(`Received DOCX base64 data but PDF generation failed`);
                setOptimizedDocxData(pdfData.docxBase64);
                // Set a warning message instead of an error
                setError(`Note: PDF preview is not available, but you can download the optimized DOCX file.`);
              } else {
                console.warn("PDF response did not contain base64 data");
              }
            } else {
              const errorData = await pdfResponse.json();
              console.error("Error fetching PDF:", errorData.error || "Unknown error");
            }
          } else {
            console.warn("Could not retrieve CV ID from status data");
          }
        } catch (pdfError) {
          console.error("Error retrieving optimized PDF:", pdfError);
          // Set a friendlier error message
          setError("PDF generation is temporarily unavailable. You can still download the optimized DOCX file.");
        }
      }
      
      // Check for errors
      if (statusData.error && !statusData.optimized) {
        throw new Error(statusData.error);
      }
    } catch (error) {
      console.error("Error polling optimization status:", error);
      
      // Only set error if we're still optimizing and there's no DOCX data available
      if (isOptimizing && !optimizedDocxData) {
        // Check if the error is related to PDF conversion
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("PDF conversion failed") || errorMessage.includes("DOCX to PDF")) {
          setError(`Optimization note: PDF creation is temporarily unavailable, but you can download the DOCX file.`);
        } else {
          setError(`Optimization error: ${errorMessage}`);
        }
        
        setIsOptimizing(false);
        
        // Clear polling interval
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    }
  }, [pollingInterval, isOptimizing, optimizedDocxData]);

  // Function to extract CV ID from the selectedCV string with better error handling
  const extractCvId = useCallback((selectedCVString: string | null) => {
    if (!selectedCVString) return null;
    
    const parts = selectedCVString.split('|');
    // Check if we have at least 2 parts (filename and ID)
    if (parts.length < 2 || !parts[1] || parts[1].trim() === '') {
      console.warn('Invalid CV format:', selectedCVString);
      return null;
    }
    
    return parts[1].trim();
  }, []);

  // Function to handle the preview generation
  const handlePreviewCV = useCallback(async () => {
    if (!selectedCV && !rawText) {
      setError("Please select a CV to preview");
      return;
    }
    
    // Reset states
    setError(null);
    setIsPreviewLoading(true);
    setIsPreviewMode(false);
    setPreviewSrc(null);
    
    try {
      // Extract the CV ID from the selected CV
      const cvId = extractCvId(selectedCV);
      const fileName = selectedCV ? selectedCV.split('|')[0].trim() : null;
      
      // Prepare the request payload
      const payload: any = {};
      
      if (cvId) {
        payload.cvId = cvId;
      }
      
      if (fileName) {
        payload.fileName = fileName;
      }
      
      if (rawText) {
        payload.rawText = rawText;
      }
      
      // Check if we have enough data to proceed
      if (!cvId && !fileName && !rawText) {
        throw new Error("No CV data available to preview");
      }
      
      // Call the preview API
      const response = await fetch('/api/cv/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview');
      }
      
      const data = await response.json();
      
      // Set PDF and DOCX data
      if (data.pdfBase64) {
        setOptimizedPdfData(data.pdfBase64);
        // Create a data URL for the PDF preview
        setPreviewSrc(`data:application/pdf;base64,${data.pdfBase64}`);
      }
      
      if (data.docxBase64) {
        setOptimizedDocxData(data.docxBase64);
      }
      
      // Enter preview mode
      setIsPreviewMode(true);
      setIsPreviewLoading(false);
    } catch (error) {
      console.error("Error generating preview:", error);
      setError(`Preview error: ${error instanceof Error ? error.message : String(error)}`);
      setIsPreviewLoading(false);
    }
  }, [selectedCV, rawText]);

  // Function to handle optimization
  const handleOptimize = useCallback(async () => {
    if (!selectedCV) {
      setError("Please select a CV to optimize");
      return;
    }

    try {
      setError("");
      setIsOptimizing(true);
      setIsOptimized(false);
      setIsPreviewMode(false);
      setIsAccepted(false);
      setProgress(0);
      setOptimizationStep("Starting optimization process");
      setOptimizedPdfData(null);
      setOptimizedDocxData(null);
      setPreviewSrc(null);

      // Extract the CV ID from the selected CV (if it contains a pipe character)
      const cvParts = selectedCV.split('|');
      const fileName = cvParts[0].trim();
      const cvId = cvParts.length > 1 ? cvParts[1].trim() : undefined;

      console.log(`Starting optimization for ${fileName}${cvId ? ` (ID: ${cvId})` : ''}`);

      // Call the API to start optimization
      const response = await fetch('/api/optimize-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          cvId,
          templateId: 'professional-classic', // Always use professional-classic template
          forceReoptimize: forceReoptimize,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start optimization');
      }

      const data = await response.json();
      console.log("Optimization started:", data);

      // Start polling for status updates
      const interval = setInterval(() => {
        pollOptimizationStatus(fileName, cvId);
      }, 2000); // Poll every 2 seconds

      setPollingInterval(interval);

      // Initial status check
      pollOptimizationStatus(fileName, cvId);
    } catch (error) {
      console.error("Error starting optimization:", error);
      setError(`Optimization error: ${error instanceof Error ? error.message : String(error)}`);
      setIsOptimizing(false);
    }
  }, [selectedCV, forceReoptimize, pollOptimizationStatus]);

  // Function to handle download - PDF
  const handleDownloadPDF = useCallback(() => {
    if (!optimizedPdfData) {
      setError("No optimized CV PDF available to download");
      return;
    }

    try {
      // Create a link element
      const link = document.createElement('a');
      
      // Set the href to the base64 PDF data
      link.href = `data:application/pdf;base64,${optimizedPdfData}`;
      
      // Set the download attribute with a filename
      let fileName = 'optimized-cv';
      
      if (selectedCV) {
        const parts = selectedCV.split('|');
        if (parts.length > 0) {
          fileName = `${parts[0].trim()}-optimized`;
        }
      }
      
      link.download = `${fileName}.pdf`;
      
      // Append to the document
      document.body.appendChild(link);
      
      // Trigger the download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      setError(`Download error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [optimizedPdfData, selectedCV]);

  // Function to handle download - DOCX
  const handleDownloadDOCX = useCallback(async () => {
    try {
      setIsDownloadingDocx(true);
      setError(null);
      
      if (!optimizedDocxData) {
        // If we don't have DOCX data cached, fetch it
        const cvParts = selectedCV?.split('|') || [];
        const cvId = cvParts.length > 1 ? cvParts[1]?.trim() : undefined;
        
        if (!cvId) {
          setError("Cannot retrieve CV ID for DOCX download");
          setIsDownloadingDocx(false);
          return;
        }
        
        const response = await fetch(`/api/cv/generate-docx`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cvId }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to generate DOCX file');
        }
        
        const data = await response.json();
        
        if (!data.docxBase64) {
          throw new Error('No DOCX data received from server');
        }
        
        setOptimizedDocxData(data.docxBase64);
        downloadDocx(data.docxBase64);
      } else {
        // Use the cached DOCX data
        downloadDocx(optimizedDocxData);
      }
      
      setIsDownloadingDocx(false);
    } catch (error) {
      console.error("Error downloading DOCX:", error);
      setError(`DOCX download error: ${error instanceof Error ? error.message : String(error)}`);
      setIsDownloadingDocx(false);
    }
  }, [selectedCV, optimizedDocxData]);
  
  // Helper function to download DOCX
  const downloadDocx = (docxBase64: string) => {
    try {
      // Create a link element for download
      const link = document.createElement('a');
      link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBase64}`;
      
      // Set the download attribute with a filename
      const fileName = selectedCV ? selectedCV.split('|')[0].trim() : 'optimized-cv';
      link.download = `${fileName}-optimized.docx`;
      
      // Append to the document
      document.body.appendChild(link);
      
      // Trigger the download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
    } catch (downloadError) {
      console.error("Error in download process:", downloadError);
      setError(`Download error: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
    }
  };

  // Function to handle accepting the CV optimization
  const handleAcceptCV = useCallback(async () => {
    if (!selectedCV) {
      setError("No CV selected to accept");
      return;
    }

    try {
      // Extract the CV ID from the selected CV
      const cvId = extractCvId(selectedCV);
      
      if (!cvId) {
        throw new Error("Could not determine CV ID. Please select a valid CV.");
      }
      
      // Call the accept API
      const response = await fetch('/api/cv/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept optimization');
      }
      
      // Set state to accepted
      setIsAccepted(true);
      setIsPreviewMode(false);
      
      // Show download options
      return true;
    } catch (error) {
      console.error("Error accepting optimization:", error);
      setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, [selectedCV]);

  // Function to handle accept and download
  const handleAcceptAndDownload = useCallback(async () => {
    const success = await handleAcceptCV();
    
    if (success && optimizedPdfData) {
      // Automatically download the PDF
      handleDownloadPDF();
    }
  }, [handleAcceptCV, optimizedPdfData, handleDownloadPDF]);

  return (
    <Card className="w-full shadow-lg border-0">
      <CardHeader className="bg-[#121212] text-white rounded-t-lg">
        <CardTitle className="text-[#B4916C] flex items-center gap-2">
          <span>Optimize Your CV</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* CV Selection */}
        <div className="mb-4">
          <ComboboxPopover
            label="Select CV to Optimize"
            options={displayCVOptions}
            onSelect={handleCVSelect}
            accentColor="#B4916C"
          />
        </div>
        
        {/* Main Action Buttons */}
        <div className="flex items-center space-x-3 mb-4">
          <Button 
            onClick={handleOptimize}
            disabled={isOptimizing || !selectedCV}
            className="flex-1 bg-[#B4916C] hover:bg-[#A3815C] text-white"
          >
            {isOptimizing ? (
              <>
                <span className="mr-2">Optimizing...</span>
                <span className="loading loading-spinner loading-xs"></span>
              </>
            ) : (
              "Optimize CV"
            )}
          </Button>
          
          <Button 
            onClick={handlePreviewCV}
            disabled={isPreviewLoading || !selectedCV || isOptimizing}
            className="flex-1 bg-[#121212] hover:bg-[#333333] text-white"
          >
            {isPreviewLoading ? (
              <>
                <span className="mr-2">Generating...</span>
                <span className="loading loading-spinner loading-xs"></span>
              </>
            ) : (
              "Preview"
            )}
          </Button>
        </div>
        
        {/* Error Message */}
        {error && (
          <Alert className="mb-4 bg-red-50 text-red-800 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Progress Bar */}
        {isOptimizing && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">{optimizationStep}</span>
              <span className="text-sm font-medium text-gray-700">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {/* Optimization Results - After Acceptance */}
        {isAccepted && (
          <div className="mt-4 p-4 bg-[#121212] rounded-lg border border-[#B4916C]/20">
            <h3 className="text-[#B4916C] font-medium mb-2">Optimization Results</h3>
            
            <div className="flex flex-col space-y-3">
              <div className="flex items-center space-x-3">
                <Button 
                  onClick={handleDownloadPDF}
                  disabled={!optimizedPdfData}
                  className="flex-1 bg-[#B4916C] hover:bg-[#A3815C] text-white"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                
                <Button 
                  onClick={handleDownloadDOCX}
                  disabled={isDownloadingDocx}
                  className="flex-1 bg-[#B4916C] hover:bg-[#A3815C] text-white"
                >
                  {isDownloadingDocx ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download DOCX
                    </>
                  )}
                </Button>
              </div>
              
              <div className="flex items-center">
                <div className="flex items-center space-x-2 w-full text-white">
                  <Checkbox 
                    id="force-reoptimize" 
                    checked={forceReoptimize}
                    onCheckedChange={(checked) => setForceReoptimize(checked as boolean)}
                    className="border-[#B4916C] data-[state=checked]:bg-[#B4916C]"
                  />
                  <label 
                    htmlFor="force-reoptimize" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Force re-optimization (start from scratch)
                  </label>
                </div>
              </div>
              
              <Button 
                onClick={handleOptimize}
                disabled={isOptimizing}
                variant="outline"
                className="w-full border-[#B4916C] text-[#B4916C] hover:bg-[#B4916C]/10"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Re-optimize CV
              </Button>
            </div>
          </div>
        )}
        
        {/* Preview Mode */}
        {isPreviewMode && previewSrc && (
          <div className="mt-4">
            <div className="bg-[#121212] p-4 rounded-t-lg border border-[#B4916C]/20">
              <h3 className="text-[#B4916C] font-medium mb-2">CV Preview</h3>
            </div>
            
            <div className="border border-[#B4916C]/20 border-t-0 rounded-b-lg overflow-hidden">
              {/* Console log to debug the preview source URL */}
              {typeof window !== 'undefined' && (
                console.log("PDF Preview Source:", previewSrc),
                null
              )}
              
              <iframe 
                src={previewSrc} 
                className="w-full h-[500px]" 
                title="CV Preview"
                onError={(e) => {
                  console.error("PDF iframe loading error:", e);
                  setError("Failed to load PDF document. Please try downloading the file instead.");
                }}
              ></iframe>
            </div>
            
            {/* Fallback UI for when PDF loading fails */}
            {error && error.includes("Failed to load PDF") && (
              <div className="mt-4 p-4 bg-[#121212] border border-red-400 rounded-lg">
                <h4 className="text-red-400 font-medium mb-2">Error</h4>
                <p className="text-gray-300 mb-3">{error}</p>
                <Button 
                  onClick={() => {
                    // Try to reload the preview
                    setError(null);
                    if (previewSrc) {
                      const reloadSrc = previewSrc + '#' + new Date().getTime();
                      setPreviewSrc(reloadSrc);
                    }
                  }}
                  className="bg-[#333333] hover:bg-[#444444] text-white"
                >
                  Reload
                </Button>
              </div>
            )}

            <div className="flex flex-col space-y-3 mt-4">
              <div className="flex items-center space-x-3">
                <Button 
                  onClick={handleAcceptAndDownload}
                  className="flex-1 bg-[#B4916C] hover:bg-[#A3815C] text-white"
                >
                  Accept & Download
                </Button>
                
                <Button 
                  onClick={() => {
                    setForceReoptimize(true);
                    handleOptimize();
                  }}
                  className="flex-1 bg-[#121212] hover:bg-[#333333] text-white"
                >
                  Re-optimize CV
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
