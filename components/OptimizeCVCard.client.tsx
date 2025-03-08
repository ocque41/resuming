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
interface OptimizeCVCardProps {}

// Simplified component
export default function OptimizeCVCard({}: OptimizeCVCardProps) {
  // State for CV selection
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [cvOptions, setCvOptions] = useState<string[]>([]);
  
  // State for template selection
  const [selectedTemplate, setSelectedTemplate] = useState<string>("professional-classic");
  
  // State for optimization process
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isOptimized, setIsOptimized] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [optimizationStep, setOptimizationStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [optimizedPdfData, setOptimizedPdfData] = useState<string | null>(null);
  
  // State to track if we should force re-optimization
  const [forceReoptimize, setForceReoptimize] = useState<boolean>(false);
  
  // State for ATS scores
  const [originalAtsScore, setOriginalAtsScore] = useState<number>(65);
  const [improvedAtsScore, setImprovedAtsScore] = useState<number>(85);

  // Extract display names for the CV dropdown (without the ID part)
  const displayCVOptions = cvOptions.map(cv => {
    const parts = cv.split('|');
    return parts[0].trim();
  });

  // Templates list
  const templates = [
    { value: "professional-classic", label: "Professional Classic" },
    { value: "modern-minimal", label: "Modern Minimal" },
    { value: "executive", label: "Executive" },
    { value: "creative", label: "Creative" },
    { value: "academic", label: "Academic" }
  ];

  // Fetch available CVs when component mounts
  useEffect(() => {
    const fetchCVs = async () => {
      try {
        const response = await fetch('/api/cv-list');
        if (!response.ok) {
          throw new Error('Failed to fetch CV list');
        }
        
        const data = await response.json();
        
        if (data.cvs && Array.isArray(data.cvs)) {
          // Format the CVs as "filename|id"
          const formattedCVs = data.cvs.map((cv: any) => {
            return `${cv.fileName}|${cv.id}`;
          });
          
          setCvOptions(formattedCVs);
          console.log(`Loaded ${formattedCVs.length} CVs`);
        } else {
          console.error('Invalid CV data format:', data);
          setError('Failed to load CV list: Invalid data format');
        }
      } catch (error) {
        console.error('Error fetching CV list:', error);
        setError(`Failed to load CV list: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    fetchCVs();
  }, []);

  // Handle CV selection
  const handleCVSelect = useCallback((cv: string) => {
    console.log("Selected CV display name:", cv);
    
    // Reset optimization state when changing CV
    setIsOptimized(false);
    setProgress(0);
    setError(null);
    setOptimizedPdfData(null);
    
    // Find the original CV string with ID
    const originalCVString = cvOptions.find(item => item.startsWith(cv + '|'));
    
    if (originalCVString) {
      const parts = originalCVString.split('|');
      const fileName = parts[0];
      const id = parts[1];
      
      console.log(`Selected CV: ${fileName}, ID: ${id}`);
      setSelectedCV(fileName);
      setCvOptions(prev => [...prev, `${fileName}|${id}`]);
    } else {
      // Fallback if we can't find the ID
      console.log("Could not find ID for selected CV, using display name only");
      setSelectedCV(cv);
      setCvOptions(prev => [...prev, `${cv}|`]);
    }
  }, [cvOptions]);

  // Handle template selection
  const handleTemplateSelect = useCallback((templateName: string) => {
    console.log("Selected template:", templateName);
    
    // Reset optimization state when changing template
    setIsOptimized(false);
    setProgress(0);
    setError(null);
    setOptimizedPdfData(null);
    
    // Find the template ID that corresponds to the selected name
    const template = templates.find(t => t.value === templateName);
    if (template) {
      setSelectedTemplate(template.value);
      console.log(`Mapped template name "${templateName}" to ID "${template.value}"`);
    } else {
      // Fallback to the name if no mapping is found
      setSelectedTemplate(templateName.toLowerCase().replace(/\s+/g, '-'));
      console.log(`No template mapping found, using formatted name: ${templateName.toLowerCase().replace(/\s+/g, '-')}`);
    }
  }, []);

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
        setOptimizationStep("Applying template formatting");
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
        
        // Update ATS scores if available
        if (statusData.originalAtsScore) {
          setOriginalAtsScore(statusData.originalAtsScore);
        }
        
        if (statusData.improvedAtsScore) {
          setImprovedAtsScore(statusData.improvedAtsScore);
        }
        
        // Try to get the optimized PDF
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
          // Continue despite PDF retrieval error
        }
      }
      
      // Check for errors
      if (statusData.error) {
        throw new Error(statusData.error);
      }
    } catch (error) {
      console.error("Error polling optimization status:", error);
      
      // Only set error if we're still optimizing
      if (isOptimizing) {
        setError(`Optimization error: ${error instanceof Error ? error.message : String(error)}`);
        setIsOptimizing(false);
        
        // Clear polling interval
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    }
  }, [pollingInterval]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Function to handle optimization
  const handleOptimize = useCallback(async () => {
    if (!selectedCV) {
      setError("Please select a CV to optimize");
      return;
    }

    if (!selectedTemplate) {
      setError("Please select a template");
      return;
    }

    try {
      setError("");
      setIsOptimizing(true);
      setIsOptimized(false);
      setProgress(0);
      setOptimizationStep("Starting optimization process");
      setOptimizedPdfData(null);

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
          templateId: selectedTemplate,
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
  }, [selectedCV, selectedTemplate, forceReoptimize, pollOptimizationStatus]);

  // Function to handle download
  const handleDownload = useCallback(() => {
    if (!optimizedPdfData) {
      setError("No optimized CV available to download");
      return;
    }

    try {
      // Create a link element
      const link = document.createElement('a');
      
      // Set the href to the base64 PDF data
      link.href = `data:application/pdf;base64,${optimizedPdfData}`;
      
      // Set the download attribute with a filename
      const fileName = selectedCV ? selectedCV.split('|')[0].trim() : 'optimized-cv';
      link.download = `${fileName}-optimized.pdf`;
      
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

  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-[#B4916C]/10 pb-4">
        <CardTitle className="text-xl font-bold text-[#B4916C]">Optimize Your CV</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex justify-center items-center mb-6">
          <div className="relative w-48 h-48 rounded-lg overflow-hidden">
            <img
              src="/Animation - 1741203848123.gif"
              alt="CV Optimization Animation"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent opacity-20"></div>
          </div>
        </div>
        
        {/* CV Selection */}
        <div className="mb-6">
          <ComboboxPopover
            label="Select CV to Optimize"
            options={displayCVOptions}
            onSelect={handleCVSelect}
            accentColor="#B4916C"
            darkMode={true}
          />
        </div>
        
        {/* Template Selection */}
        {selectedCV && (
          <div className="mb-6">
            <ComboboxPopover
              label="Select Template"
              options={templates.map(t => t.label)}
              onSelect={handleTemplateSelect}
              accentColor="#B4916C"
              darkMode={true}
            />
          </div>
        )}
        
        {/* Force Re-optimization Checkbox */}
        {selectedCV && selectedTemplate && !isOptimizing && (
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="force-reoptimize"
              checked={forceReoptimize}
              onChange={(e) => setForceReoptimize(e.target.checked)}
              className="mr-2 h-4 w-4 rounded border-gray-300 text-[#B4916C] focus:ring-[#B4916C]"
            />
            <label htmlFor="force-reoptimize" className="text-sm text-gray-300">
              Force re-optimization (use if template changes aren't applied)
            </label>
          </div>
        )}
        
        {/* Optimize Button */}
        {selectedCV && selectedTemplate && !isOptimizing && !isOptimized && (
          <Button
            onClick={handleOptimize}
            className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white py-2 mt-4"
          >
            Optimize CV
          </Button>
        )}
        
        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="mt-4 bg-red-900/20 border-red-900/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Progress Bar */}
        {isOptimizing && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{optimizationStep}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-[#121212]" />
          </div>
        )}
        
        {/* Optimization Results */}
        {isOptimized && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Optimization Results</h3>
            
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">ATS Score Improvement:</span>
                <div className="flex items-center">
                  <span className="text-gray-400 line-through mr-2">{originalAtsScore}%</span>
                  <span className="text-green-500 font-bold">{improvedAtsScore}%</span>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full" 
                  style={{ width: `${improvedAtsScore}%` }}
                ></div>
              </div>
            </div>
            
            <div className="flex flex-col space-y-3">
              <div className="flex items-center">
                <Button 
                  onClick={handleDownload}
                  disabled={!optimizedPdfData}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Optimized CV
                </Button>
              </div>
              
              <div className="flex items-center">
                <div className="flex items-center space-x-2 w-full">
                  <Checkbox 
                    id="force-reoptimize" 
                    checked={forceReoptimize}
                    onCheckedChange={(checked) => setForceReoptimize(checked as boolean)}
                  />
                  <label 
                    htmlFor="force-reoptimize" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Force re-optimization (ignore cached results)
                  </label>
                </div>
              </div>
              
              <Button 
                onClick={handleOptimize}
                disabled={isOptimizing || !selectedCV || !selectedTemplate}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Re-optimize CV
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
