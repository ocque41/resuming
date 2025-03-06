// OptimizeCVCard.client.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowRight, Check, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface OptimizeCVCardProps {
  cvs: string[];
}

export default function OptimizeCVCard({ cvs }: OptimizeCVCardProps) {
  const [selectedCV, setSelectedCV] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("google-modern");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isOptimized, setIsOptimized] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);

  // Reset state when component unmounts
  useEffect(() => {
    return () => {
      setIsPolling(false);
    };
  }, []);

  function handleCVSelect(cv: string) {
    setSelectedCV(cv);
    setIsOptimized(false);
    setOptimizedText(null);
    setOptimizationError(null);
  }

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplate(templateId);
  }

  async function handleOptimize() {
    if (!selectedCV) return;

    setIsOptimizing(true);
    setOptimizationProgress(0);
    setOptimizationError(null);
    setOptimizedText(null);
    setPollingAttempts(0);

    try {
      const response = await fetch("/api/optimize-cv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: selectedCV,
          templateId: selectedTemplate,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to optimize CV");
      }

      const data = await response.json();
      
      // Start polling for optimization status
      setIsPolling(true);
      pollOptimizationStatus(selectedCV);
    } catch (error) {
      console.error("Optimization error:", error);
      setOptimizationError((error as Error).message || "Failed to optimize CV");
      setIsOptimizing(false);
    }
  }

  async function pollOptimizationStatus(cv: string) {
    try {
      // Increment polling attempts
      setPollingAttempts(prev => prev + 1);
      
      // If we've been polling for too long (60 attempts = 2 minutes), stop
      if (pollingAttempts > 60) {
        throw new Error("Optimization is taking too long. Please try again later.");
      }
      
      console.log(`Polling optimization status for ${cv}, attempt ${pollingAttempts}`);
      const response = await fetch(`/api/optimize-cv/status?fileName=${encodeURIComponent(cv)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response from status API:", errorData);
        
        // If we need to restart optimization, do it automatically
        if (errorData.error && (
          errorData.error.includes("needs to be restarted") || 
          errorData.error.includes("timed out") || 
          errorData.error.includes("stalled") ||
          errorData.error.includes("Please try again")
        )) {
          console.log("Optimization needs to be restarted, restarting...");
          setIsPolling(false);
          setOptimizationError("Optimization process stalled. Restarting automatically...");
          
          // Wait 2 seconds before restarting
          setTimeout(() => {
            handleOptimize();
          }, 2000);
          return;
        }
        
        throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Status response for ${cv}:`, data);
      
      if (data.status === "completed") {
        console.log("Optimization completed successfully");
        
        // Verify we have optimized text
        if (!data.optimizedText) {
          console.error("No optimized text in completed response");
          throw new Error("Optimization completed but no optimized text was found");
        }
        
        setOptimizedText(data.optimizedText);
        setIsOptimized(true);
        setIsOptimizing(false);
        setIsPolling(false);
        setOptimizationProgress(100);
        
        // Automatically save the optimized CV back to the user's collection
        await saveOptimizedCV(cv, data.optimizedText);
      } else if (data.status === "processing") {
        // Update progress
        setOptimizationProgress(data.progress || 10);
        console.log(`Optimization in progress: ${data.progress || 10}%`);
        
        // Poll again after 2 seconds
        setTimeout(() => {
          if (isPolling) { // Only continue polling if we haven't stopped
            pollOptimizationStatus(cv);
          }
        }, 2000);
      } else if (data.status === "error") {
        console.error("Error status received:", data.error);
        throw new Error(data.error || "Optimization failed with an unknown error");
      } else {
        console.warn("Unknown status received:", data);
        throw new Error("Received unknown status from server");
      }
    } catch (error) {
      console.error("Error polling optimization status:", error);
      setOptimizationError((error as Error).message || "Failed to check optimization status");
      setIsOptimizing(false);
      setIsPolling(false);
    }
  }

  async function saveOptimizedCV(originalFileName: string, optimizedText: string) {
    try {
      // First, get the optimized PDF from the server
      const pdfResponse = await fetch(`/api/optimize-cv/download?fileName=${encodeURIComponent(originalFileName)}`);
      
      let pdfBlob;
      let fallbackMode = false;
      
      if (pdfResponse.status === 206) {
        // We have optimized text but no PDF, use a fallback approach
        console.log("No optimized PDF available, using fallback mode with text only");
        fallbackMode = true;
        
        // Create a simple text PDF as a fallback
        const textData = await pdfResponse.json();
        if (!textData.optimizedText) {
          throw new Error('Failed to retrieve optimized text');
        }
        
        // Create a simple text blob as fallback
        const textContent = textData.optimizedText;
        pdfBlob = new Blob([textContent], { type: 'text/plain' });
      } else if (!pdfResponse.ok) {
        throw new Error('Failed to retrieve optimized PDF');
      } else {
        // Get the PDF as a blob
        pdfBlob = await pdfResponse.blob();
      }
      
      // Create a new filename for the optimized version
      const fileNameParts = originalFileName.split('.');
      const extension = fileNameParts.pop();
      const baseName = fileNameParts.join('.');
      const optimizedFileName = `${baseName}-optimized${fallbackMode ? '-text' : ''}.${fallbackMode ? 'txt' : 'pdf'}`;
      
      // Create a File object from the blob
      const file = new File([pdfBlob], optimizedFileName, { 
        type: fallbackMode ? 'text/plain' : 'application/pdf' 
      });
      
      // Create FormData to send the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', optimizedFileName);
      formData.append('originalFileName', originalFileName);
      formData.append('optimizedText', optimizedText);
      
      // Send the optimized CV to the server to save in both Neon DB and Dropbox
      const response = await fetch('/api/cv/save-optimized', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save optimized CV');
      }
      
      const data = await response.json();
      console.log('Optimized CV saved successfully:', data);
      
      // Refresh the page after a short delay to show the updated CV collection
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('Error saving optimized CV:', error);
      // Don't show this error to the user, as the optimization itself was successful
    }
  }

  async function handleDownload() {
    if (!optimizedText || !selectedCV) return;
    
    try {
      // Get the optimized PDF from the server
      const response = await fetch(`/api/optimize-cv/download?fileName=${encodeURIComponent(selectedCV)}`);
      
      if (!response.ok) {
        throw new Error('Failed to download optimized CV');
      }
      
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // Create a filename for the download
      const fileNameParts = selectedCV.split('.');
      const extension = fileNameParts.pop();
      const baseName = fileNameParts.join('.');
      const downloadFileName = `${baseName}-optimized.pdf`;
      
      a.href = url;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading optimized CV:', error);
      setOptimizationError((error as Error).message);
    }
  }

  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg">
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
        
        <div className="space-y-4">
          {/* CV Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Select CV</label>
            <Select
              value={selectedCV}
              onValueChange={handleCVSelect}
            >
              <SelectTrigger className="w-full bg-[#121212] border border-[#B4916C]/30 text-white">
                <SelectValue placeholder="Select a CV to optimize" />
              </SelectTrigger>
              <SelectContent className="bg-[#121212] border border-[#B4916C]/30 text-white">
                {cvs.map((cv) => (
                  <SelectItem key={cv} value={cv} className="hover:bg-[#B4916C]/10">
                    {cv}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Select Company Template</label>
            <Select
              value={selectedTemplate}
              onValueChange={handleTemplateSelect}
            >
              <SelectTrigger className="w-full bg-[#121212] border border-[#B4916C]/30 text-white">
                <SelectValue placeholder="Select a company template" />
              </SelectTrigger>
              <SelectContent className="bg-[#121212] border border-[#B4916C]/30 text-white">
                <SelectItem value="google-modern" className="hover:bg-[#B4916C]/10">Google</SelectItem>
                <SelectItem value="amazon-leadership" className="hover:bg-[#B4916C]/10">Amazon</SelectItem>
                <SelectItem value="meta-impact" className="hover:bg-[#B4916C]/10">Meta</SelectItem>
                <SelectItem value="apple-minimal" className="hover:bg-[#B4916C]/10">Apple</SelectItem>
                <SelectItem value="microsoft-professional" className="hover:bg-[#B4916C]/10">Microsoft</SelectItem>
                <SelectItem value="jpmorgan-finance" className="hover:bg-[#B4916C]/10">JP Morgan</SelectItem>
                <SelectItem value="professional" className="hover:bg-[#B4916C]/10">Professional (General)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Optimization Progress */}
          {isOptimizing && (
            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Optimizing your CV...</span>
                <span className="text-sm font-medium text-[#B4916C]">{optimizationProgress}%</span>
              </div>
              <div className="w-full bg-[#1A1A1A] rounded-full h-2.5">
                <div 
                  className="bg-[#B4916C] h-2.5 rounded-full" 
                  style={{ width: `${optimizationProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This may take a minute or two. Please don't close this page.
              </p>
            </div>
          )}

          {/* Error Message */}
          {optimizationError && (
            <Alert className="mb-4 bg-red-900/20 border-red-800">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-300">
                {optimizationError}
                {!isOptimizing && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="ml-4 mt-2 bg-red-900/30 hover:bg-red-800/50 border-red-700"
                    onClick={handleOptimize}
                  >
                    Retry
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {isOptimized && !optimizationError && (
            <div className="p-3 bg-green-900/30 border border-green-700 rounded-md text-green-400 text-sm flex items-start mt-4">
              <Check className="h-5 w-5 mr-2 flex-shrink-0" />
              <div>
                <p className="font-medium">CV Optimized Successfully!</p>
                <p className="mt-1">Your optimized CV has been automatically added to your collection.</p>
                <p className="mt-1 text-xs">The page will refresh in a moment to show your updated collection.</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              onClick={handleOptimize}
              disabled={!selectedCV || isOptimizing}
              className="flex-1 bg-[#B4916C] text-white hover:bg-[#B4916C]/90"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Optimize CV
                </>
              )}
            </Button>
            
            {isOptimized && (
              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1 border-[#B4916C]/30 text-white hover:bg-[#B4916C]/10"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Optimized CV
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
