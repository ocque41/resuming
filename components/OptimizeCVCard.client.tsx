// OptimizeCVCard.client.tsx
"use client";

import { useState, useEffect, useRef } from "react";
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
  const pollRef = useRef(true);
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState("Checking optimization status...");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [hasOptimizedContent, setHasOptimizedContent] = useState(false);
  const [hasOptimizedPDF, setHasOptimizedPDF] = useState(false);
  const [optimizedPDFBase64, setOptimizedPDFBase64] = useState<string | null>(null);

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
    if (!pollRef.current) return;
    
    try {
      setOptimizationStatus("Checking optimization status...");
      console.log(`Polling status for: ${cv}`);
      
      const response = await fetch(`/api/optimize-cv/status?cvId=${encodeURIComponent(cv)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error checking optimization status: ${errorText}`);
        
        // Add more detailed error status
        setOptimizationError(`Server error: ${response.status} - ${errorText}`);
        setErrorDetails(`The optimization process encountered a server error. You can try again or contact support if the issue persists.`);
        
        // Stop polling if we get a server error
        pollRef.current = false;
        setIsPolling(false);
        
        // Close loading UI after a short delay
        setTimeout(() => {
          setLoading(false);
          setIsOptimizing(false);
        }, 2000);
        
        return;
      }
      
      const data = await response.json();
      console.log("Optimization status:", data);
      
      // Check if there's an error in the response
      if (data.error) {
        console.error(`Optimization error: ${data.error}`);
        setOptimizationError(data.error);
        
        if (data.partialResultsAvailable) {
          // If we have partial results, let the user continue
          setErrorDetails(`The optimization process stalled but partial results are available. You can still download the partially optimized CV or try again.`);
          
          // Load the optimized text if available
          await loadOptimizedContent(selectedCV);
          
          // Stop polling since we have partial results
          pollRef.current = false;
          setIsPolling(false);
          
          // Close loading UI
          setLoading(false);
          setIsOptimizing(false);
        } else {
          // If no results are available, suggest retry
          setErrorDetails(`Try again or select a different template. If the issue persists, contact support.`);
          
          // Stop polling since we have an error
          pollRef.current = false;
          setIsPolling(false);
          
          // Close loading UI after a short delay
          setTimeout(() => {
            setLoading(false);
            setIsOptimizing(false);
          }, 2000);
        }
        
        return;
      }

      // Update progress based on the status
      if (data.optimizing) {
        setOptimizationProgress(data.progress || 10);
        setOptimizationStatus(`Optimizing your CV... ${data.progress || 10}%`);
        
        // Check for stalled progress
        if (data.progressStalled) {
          console.warn(`Progress is stalled at ${data.progress}%`);
          setOptimizationStatus(`Optimizing your CV... ${data.progress || 10}% (processing...)`);
        }

        // Continue polling
        setTimeout(() => {
          if (pollRef.current) pollOptimizationStatus(cv);
        }, 2000);
      } else if (data.optimized) {
        setOptimizationProgress(100);
        setOptimizationStatus("CV optimized successfully!");
        setIsOptimizing(false);
        
        // If we have optimized text, load it
        if (data.hasOptimizedText) {
          await loadOptimizedContent(selectedCV);
          setIsOptimized(true);
          pollRef.current = false;
          setIsPolling(false);
          setLoading(false);
        } else {
          // This should not happen but handle it just in case
          setOptimizationError("Optimization completed but no optimized content was found");
          setErrorDetails("There was an issue retrieving your optimized CV. Please try again.");
          pollRef.current = false;
          setIsPolling(false);
          setLoading(false);
        }
      } else {
        // Handle unexpected state
        console.warn("Optimization in an unexpected state:", data);
        setOptimizationStatus("Checking optimization status...");
        
        // Continue polling a few more times in case the status is delayed
        setTimeout(() => {
          if (pollRef.current) pollOptimizationStatus(cv);
        }, 3000);
      }
    } catch (error) {
      console.error("Error polling optimization status:", error);
      setOptimizationError(`Error checking optimization status: ${(error as Error).message}`);
      setErrorDetails(`There was a network error while checking the optimization status. Check your connection and try again.`);
      
      // Stop polling on error
      pollRef.current = false;
      setIsPolling(false);
      setLoading(false);
      setIsOptimizing(false);
    }
  }

  async function loadOptimizedContent(cv: string) {
    try {
      // Show loading state
      setLoading(true);
      
      const response = await fetch(`/api/cv/optimized-content?cvId=${cv}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.optimizedText) {
        setOptimizedText(data.optimizedText);
        console.log("Loaded optimized text (length):", data.optimizedText.length);
        if (data.optimizedText.length > 0) {
          setIsOptimized(true);
        }
      } else {
        console.warn("No optimized text found");
        setOptimizationError("No optimized content found");
        setErrorDetails("The optimization process did not produce any content. Try again or select a different template.");
      }
      
      // Check for base64 PDF content
      if (data.optimizedPDFBase64) {
        console.log("PDF base64 data is available");
        setIsOptimized(true);
      } else {
        console.warn("No optimized PDF found");
        setIsOptimized(false);
      }
    } catch (error) {
      console.error("Error loading optimized content:", error);
      setOptimizationError(`Error loading optimized content: ${(error as Error).message}`);
      setErrorDetails("There was an error retrieving your optimized CV content. Try downloading again.");
    } finally {
      setLoading(false);
    }
  }

  async function saveOptimizedCV(originalFileName: string, optimizedText: string) {
    try {
      if (!optimizedText || optimizedText.trim().length === 0) {
        console.error("No optimized text to save");
        throw new Error("No optimized text to save");
      }
      
      console.log(`Saving optimized CV for ${originalFileName} (optimized text length: ${optimizedText.length})`);
      
      // Check if the text looks valid (contains some reasonable content)
      if (optimizedText.length < 100) {
        console.warn("Optimized text is suspiciously short:", optimizedText);
        throw new Error("Optimized text appears to be incomplete");
      }

      const response = await fetch("/api/cv/save-optimized", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalCV: selectedCV,
          optimizedText: optimizedText,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save optimized CV: ${errorText}`);
      }

      const data = await response.json();
      console.log("Optimized CV saved successfully:", data);
      
      return data;
    } catch (error) {
      console.error("Error saving optimized CV:", error);
      setOptimizationError(`Error saving: ${(error as Error).message}`);
      setErrorDetails("There was an error saving your optimized CV. You can still download the current version.");
      throw error;
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
                <span className="text-sm text-gray-400">{optimizationStatus}</span>
                <span className="text-sm font-medium text-[#B4916C]">{optimizationProgress}%</span>
              </div>
              <div className="w-full bg-[#1A1A1A] rounded-full h-2.5">
                <div 
                  className="bg-[#B4916C] h-2.5 rounded-full" 
                  style={{ width: `${optimizationProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {errorDetails}
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
