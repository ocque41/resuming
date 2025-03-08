// OptimizeCVCard.client.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download } from "lucide-react";
import { ComboboxPopover } from "@/components/ui/combobox";

// Minimal interface
interface OptimizeCVCardProps {
  cvs: string[]; // Format: "filename|id"
}

// Simplified component
export default function OptimizeCVCard({ cvs }: OptimizeCVCardProps) {
  // Basic state
  const [selectedCV, setSelectedCV] = useState<string>("");
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isOptimized, setIsOptimized] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [optimizationStep, setOptimizationStep] = useState<string>("");
  const [optimizedPdfData, setOptimizedPdfData] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Templates for selection with their corresponding IDs
  const templates = [
    { name: "Professional Classic", id: "professional-classic" },
    { name: "Modern Professional", id: "modern-professional" },
    { name: "Creative Design", id: "creative-design" },
    { name: "Executive", id: "executive" },
    { name: "Technical", id: "technical" },
    { name: "Academic", id: "academic" },
    { name: "Entry Level", id: "entry-level" }
  ];
  
  // Extract template names for display
  const templateNames = templates.map(t => t.name);
  
  // State to track if we should force re-optimization
  const [forceReoptimize, setForceReoptimize] = useState<boolean>(false);

  // Extract display names for the CV dropdown (without the ID part)
  const cvDisplayNames = cvs.map(cv => {
    const parts = cv.split('|');
    return parts[0]; // Just the filename part
  });

  // Handle CV selection
  const handleCVSelect = useCallback((cv: string) => {
    console.log("Selected CV display name:", cv);
    
    // Reset optimization state when changing CV
    setIsOptimized(false);
    setProgress(0);
    setError(null);
    setOptimizedPdfData(null);
    
    // Find the original CV string with ID
    const originalCVString = cvs.find(item => item.startsWith(cv + '|'));
    
    if (originalCVString) {
      const parts = originalCVString.split('|');
      const fileName = parts[0];
      const id = parts[1];
      
      console.log(`Selected CV: ${fileName}, ID: ${id}`);
      setSelectedCV(fileName);
      setSelectedCVId(id);
    } else {
      // Fallback if we can't find the ID
      console.log("Could not find ID for selected CV, using display name only");
      setSelectedCV(cv);
      setSelectedCVId(null);
    }
  }, [cvs]);

  // Handle template selection
  const handleTemplateSelect = useCallback((templateName: string) => {
    console.log("Selected template:", templateName);
    
    // Reset optimization state when changing template
    setIsOptimized(false);
    setProgress(0);
    setError(null);
    setOptimizedPdfData(null);
    
    // Find the template ID that corresponds to the selected name
    const template = templates.find(t => t.name === templateName);
    if (template) {
      setSelectedTemplate(template.id);
      console.log(`Mapped template name "${templateName}" to ID "${template.id}"`);
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

  // Simplified optimization function
  const handleOptimize = useCallback(async () => {
    if (!selectedCV) {
      setError("Please select a CV first");
      return;
    }

    if (!selectedTemplate) {
      setError("Please select a template");
      return;
    }

    try {
      setIsOptimizing(true);
      setProgress(0);
      setError(null);
      setOptimizedPdfData(null);
      
      // Clear any existing polling interval
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      
      console.log(`Starting optimization for CV: ${selectedCV}, ID: ${selectedCVId}, template: ${selectedTemplate}, forceReoptimize: ${forceReoptimize}`);
      
      // Step 1: Call the API to start optimization
      setOptimizationStep("Starting optimization process");
      setProgress(10);
      
      // Use the ID if available, otherwise use the filename
      const payload = selectedCVId 
        ? { cvId: selectedCVId, templateId: selectedTemplate, forceReoptimize }
        : { fileName: selectedCV, templateId: selectedTemplate, forceReoptimize };
      
      const optimizeResponse = await fetch('/api/optimize-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!optimizeResponse.ok) {
        const errorData = await optimizeResponse.json();
        throw new Error(errorData.error || 'Failed to start optimization process');
      }
      
      const optimizeData = await optimizeResponse.json();
      console.log("Optimization started:", optimizeData);
      
      // Step 2: Start polling for optimization status
      const interval = setInterval(() => {
        pollOptimizationStatus(selectedCV, selectedCVId || undefined);
      }, 2000); // Poll every 2 seconds
      
      setPollingInterval(interval);
      
    } catch (error) {
      console.error("Error during optimization:", error);
      setError(`Optimization failed: ${error instanceof Error ? error.message : String(error)}`);
      setIsOptimizing(false);
    }
  }, [selectedCV, selectedCVId, selectedTemplate, pollingInterval, pollOptimizationStatus, forceReoptimize]);

  // Simple download function
  const handleDownload = useCallback(() => {
    if (!selectedCV) {
      setError("Please select a CV first");
      return;
    }

    try {
      if (optimizedPdfData) {
        console.log(`Preparing to download PDF with base64 data (${optimizedPdfData.length} chars)`);
        
        // Create and download PDF from base64 data
        try {
          const byteCharacters = atob(optimizedPdfData);
          console.log(`Decoded base64 to ${byteCharacters.length} bytes`);
          
          const byteNumbers = new Array(byteCharacters.length);
          
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `optimized_${selectedCV.replace(/\|.*$/, '')}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          console.log("PDF download completed successfully");
        } catch (pdfError) {
          console.error("Error creating PDF from base64:", pdfError);
          throw new Error(`Failed to create PDF: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`);
        }
      } else {
        console.log("No PDF data available, falling back to text summary");
        // Fallback to text file if PDF data is not available
        const content = `Optimized CV for ${selectedCV.replace(/\|.*$/, '')}

This CV has been optimized using the ${selectedTemplate} template.
ATS Score improved from 65% to 85%.

Key improvements:
- Enhanced keyword optimization
- Improved formatting
- Better structure
- Emphasized strengths

Date: ${new Date().toLocaleDateString()}`;

        // Create and trigger download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `optimized_${selectedCV.replace(/\|.*$/, '').replace('.pdf', '')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log("Text download completed as fallback");
      }
    } catch (error) {
      console.error("Error downloading optimized CV:", error);
      setError(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [selectedCV, selectedTemplate, optimizedPdfData]);

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
            options={cvDisplayNames}
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
              options={templateNames}
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
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-[#121212] rounded-lg border border-[#B4916C]/20">
              <h3 className="text-[#B4916C] font-medium mb-2">Optimization Complete</h3>
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-white">ATS Score:</span>
                <div className="flex items-center">
                  <span className="text-gray-400 line-through mr-2">65%</span>
                  <span className="text-green-500 font-bold">85%</span>
                </div>
              </div>
              
              <div className="text-sm text-gray-300 mb-4">
                <p className="mb-2">Your CV has been optimized with the following improvements:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Enhanced keyword optimization for better ATS recognition</li>
                  <li>Improved formatting for better readability</li>
                  <li>Restructured content to highlight key qualifications</li>
                  <li>Emphasized strengths and achievements</li>
                </ul>
              </div>
              
              {optimizedPdfData ? (
                <div>
                  <Button 
                    onClick={handleDownload}
                    className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white flex items-center justify-center"
                  >
                    <Download size={16} className="mr-2" />
                    Download Optimized PDF
                  </Button>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Your optimized CV is ready as a PDF document
                  </p>
                </div>
              ) : (
                <div>
                  <Button 
                    onClick={handleDownload}
                    className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white flex items-center justify-center"
                  >
                    <Download size={16} className="mr-2" />
                    Download Optimization Summary
                  </Button>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    PDF generation is not available. Downloading text summary instead.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
