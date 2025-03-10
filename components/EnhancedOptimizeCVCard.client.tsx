"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, RefreshCw, FileText, Check } from "lucide-react";
import { ComboboxPopover } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import PDFPreview from './PDFPreview.client';

// Interface for the component props
interface EnhancedOptimizeCVCardProps {
  cvs?: string[]; // Format: "filename|id"
}

// Component implementation
export default function EnhancedOptimizeCVCard({ cvs = [] }: EnhancedOptimizeCVCardProps) {
  // State for CV selection
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [cvOptions, setCvOptions] = useState<string[]>(cvs);
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  
  // State for processing
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  // State for DOCX generation
  const [isGeneratingDocx, setIsGeneratingDocx] = useState<boolean>(false);
  const [docxGenerated, setDocxGenerated] = useState<boolean>(false);
  const [docxBase64, setDocxBase64] = useState<string | null>(null);
  
  // State for PDF conversion
  const [isConvertingToPdf, setIsConvertingToPdf] = useState<boolean>(false);
  const [pdfConverted, setPdfConverted] = useState<boolean>(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  
  // State for ATS scores
  const [originalAtsScore, setOriginalAtsScore] = useState<number>(0);
  const [improvedAtsScore, setImprovedAtsScore] = useState<number>(0);
  
  // Add a new state for automatic PDF conversion
  const [autoPdfConvert, setAutoPdfConvert] = useState<boolean>(false);
  
  // Extract display names for the CV dropdown (without the ID part)
  const displayCVOptions = cvOptions.map(cv => {
    const parts = cv.split('|');
    return parts[0].trim();
  });

  // Process the selected CV
  const handleProcessCV = useCallback(async () => {
    if (!selectedCV) {
      setError("Please select a CV to optimize");
      return;
    }
    
    setError(null);
    setIsProcessing(true);
    setProgress(10);
    setProcessingStep("Initiating CV processing");
    
    try {
      // Extract CV ID from selected CV
      const cvParts = selectedCV.split('|');
      const cvIdStr = cvParts[1] || null;
      
      if (!cvIdStr) {
        throw new Error("Unable to determine CV ID");
      }
      
      setSelectedCVId(cvIdStr);
      
      // Call process API
      const response = await fetch('/api/cv/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvId: cvIdStr }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process CV");
      }
      
      // Start polling for status updates
      const statusInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/cv/process/status?cvId=${cvIdStr}`);
          
          if (!statusResponse.ok) {
            throw new Error("Failed to get processing status");
          }
          
          const statusData = await statusResponse.json();
          
          // Update progress
          setProgress(statusData.processingProgress || progress);
          setProcessingStep(statusData.processingStatus || processingStep);
          
          // Check if processing is complete
          if (statusData.completed) {
            clearInterval(statusInterval);
            setIsProcessing(false);
            setIsProcessed(true);
            setProgress(100);
            
            // Update ATS scores
            setOriginalAtsScore(statusData.atsScore || 65);
            setImprovedAtsScore(statusData.improvedAtsScore || 85);
            
            // Automatically start generating DOCX if processing is completed
            setTimeout(() => {
              handleGenerateDocx();
            }, 1000);
          }
        } catch (statusError) {
          console.error("Error checking processing status:", statusError);
        }
      }, 3000);
      
      // Set a timeout to abort if it takes too long
      setTimeout(() => {
        clearInterval(statusInterval);
        // Only update if still processing
        if (isProcessing) {
          setError("Processing is taking longer than expected. Please try again later.");
          setIsProcessing(false);
        }
      }, 2 * 60 * 1000); // 2 minutes
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to process CV");
      setIsProcessing(false);
    }
  }, [selectedCV, isProcessing, progress, processingStep]);
  
  // Generate DOCX file from processed CV
  const handleGenerateDocx = useCallback(async () => {
    if (!selectedCVId) {
      setError("CV ID not found");
      return;
    }
    
    setError(null);
    setIsGeneratingDocx(true);
    
    try {
      // Call generate-enhanced-docx API
      const response = await fetch('/api/cv/generate-enhanced-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvId: selectedCVId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate DOCX file");
      }
      
      const data = await response.json();
      
      // Store DOCX data for download
      setDocxBase64(data.docxBase64);
      setDocxGenerated(true);
      setIsGeneratingDocx(false);
      
      // Set a flag to trigger PDF conversion
      setAutoPdfConvert(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to generate DOCX file");
      setIsGeneratingDocx(false);
    }
  }, [selectedCVId]);
  
  // Convert DOCX to PDF
  const handleConvertToPdf = useCallback(async () => {
    if (!selectedCVId) {
      setError("CV ID not found");
      return;
    }
    
    setError(null);
    setIsConvertingToPdf(true);
    
    try {
      // Call convert-to-pdf API
      const response = await fetch('/api/cv/convert-to-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvId: selectedCVId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to convert to PDF");
      }
      
      const data = await response.json();
      
      // Store PDF data for download
      setPdfBase64(data.pdfBase64);
      setPdfConverted(true);
      setIsConvertingToPdf(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to convert to PDF");
      setIsConvertingToPdf(false);
    }
  }, [selectedCVId]);
  
  // Download DOCX file
  const handleDownloadDocx = useCallback(() => {
    if (!docxBase64) return;
    
    const link = document.createElement('a');
    link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBase64}`;
    link.download = `optimized-cv.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [docxBase64]);
  
  // Download PDF file
  const handleDownloadPdf = useCallback(() => {
    if (!pdfBase64) return;
    
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${pdfBase64}`;
    link.download = `optimized-cv.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [pdfBase64]);
  
  // Reset the form to try again
  const handleReset = useCallback(() => {
    setSelectedCV(null);
    setSelectedCVId(null);
    setIsProcessing(false);
    setIsProcessed(false);
    setProgress(0);
    setProcessingStep("");
    setError(null);
    setIsGeneratingDocx(false);
    setDocxGenerated(false);
    setDocxBase64(null);
    setIsConvertingToPdf(false);
    setPdfConverted(false);
    setPdfBase64(null);
    setAutoPdfConvert(false);
  }, []);
  
  // Effect to handle automatic PDF conversion
  useEffect(() => {
    if (autoPdfConvert && docxGenerated && !pdfConverted && !isConvertingToPdf) {
      // Start PDF conversion
      handleConvertToPdf();
      // Reset the flag
      setAutoPdfConvert(false);
    }
  }, [autoPdfConvert, docxGenerated, pdfConverted, isConvertingToPdf, handleConvertToPdf]);
  
  return (
    <Card className="bg-[#121212] border-gray-800 shadow-xl overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-gray-800 pb-3">
        <CardTitle className="flex items-center text-white">
          <FileText className="w-5 h-5 mr-2 text-[#B4916C]" />
          Enhanced CV Optimization
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {!isProcessed && !isProcessing && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="flex-grow">
                <ComboboxPopover
                  options={displayCVOptions.length > 0 ? displayCVOptions : []}
                  label="Select a CV"
                  onSelect={(cv) => {
                    // Find the matching full option (with ID)
                    const index = displayCVOptions.indexOf(cv);
                    if (index !== -1) {
                      setSelectedCV(cvOptions[index]);
                    } else {
                      setSelectedCV(null);
                    }
                  }}
                  accentColor="#B4916C"
                  darkMode={true}
                />
              </div>
              <Button
                onClick={handleProcessCV}
                disabled={!selectedCV || isProcessing}
                className="bg-[#B4916C] hover:bg-[#A3815C] text-white whitespace-nowrap"
              >
                {isProcessing ? "Processing..." : "Optimize CV"}
              </Button>
            </div>
            
            <div className="text-gray-400 text-sm">
              Select your CV to begin the AI-powered optimization process. Our system will analyze your CV, identify areas for improvement, and generate an optimized version.
            </div>
          </div>
        )}
        
        {error && (
          <Alert className="mb-4 bg-red-900/20 text-red-400 border border-red-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {isProcessing && (
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">{processingStep}</span>
                <span className="text-[#B4916C] font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-gray-800" />
            </div>
            
            <div className="text-gray-400 text-sm mt-4">
              Optimizing your CV using AI. This process may take a few minutes. Please wait...
            </div>
          </div>
        )}
        
        {isProcessed && !isProcessing && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">ATS Score Improvement</h3>
              <div className="flex items-center space-x-4">
                <div className="text-gray-400">
                  <span className="block text-center">{originalAtsScore}%</span>
                  <span className="text-xs">Original</span>
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#B4916C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-[#B4916C]">
                  <span className="block text-center font-bold">{improvedAtsScore}%</span>
                  <span className="text-xs">Improved</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col space-y-4">
              <Button
                onClick={handleGenerateDocx}
                disabled={isGeneratingDocx || docxGenerated}
                className="bg-[#B4916C] hover:bg-[#A3815C] text-white flex items-center justify-center"
              >
                {docxGenerated ? (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    DOCX Generated
                  </>
                ) : isGeneratingDocx ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Generating DOCX...
                  </>
                ) : (
                  'Generate Optimized DOCX'
                )}
              </Button>
              
              {docxGenerated && (
                <Button
                  onClick={handleDownloadDocx}
                  className="bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download DOCX
                </Button>
              )}
              
              {docxGenerated && (
                <Button
                  onClick={handleConvertToPdf}
                  disabled={isConvertingToPdf || pdfConverted}
                  className="bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center"
                >
                  {pdfConverted ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      PDF Converted
                    </>
                  ) : isConvertingToPdf ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Converting to PDF...
                    </>
                  ) : (
                    'Convert to PDF'
                  )}
                </Button>
              )}
              
              {pdfConverted && (
                <Button
                  onClick={handleDownloadPdf}
                  className="bg-[#B4916C] hover:bg-[#A3815C] text-white flex items-center justify-center"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download PDF
                </Button>
              )}
              
              <Button
                onClick={handleReset}
                className="bg-transparent hover:bg-gray-800 text-gray-400 border border-gray-700 flex items-center justify-center"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Start Over
              </Button>
            </div>
          </div>
        )}
        
        {!isProcessed && !isProcessing && !selectedCV && (
          <div className="text-center py-8 text-gray-400">
            Select a CV to begin the optimization process
          </div>
        )}
        
        {pdfConverted && pdfBase64 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-3">PDF Preview</h3>
            <div className="h-[500px] border border-gray-700 rounded-md overflow-hidden">
              <PDFPreview 
                pdfData={pdfBase64} 
                fileName={`optimized-cv-${selectedCVId}.pdf`}
                onDownload={handleDownloadPdf}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 