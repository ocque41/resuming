// OptimizeCVCard.client.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowRight, Check, AlertCircle } from "lucide-react";
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import OptimizationSummary from "./OptimizationSummary.client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface OptimizeCVCardProps {
  cvs: string[];
}

export default function OptimizeCVCard({ cvs }: OptimizeCVCardProps) {
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("google-modern");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isOptimized, setIsOptimized] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [optimizationWarning, setOptimizationWarning] = useState<string | null>(null);
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const pollRef = useRef(true);
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState("Checking optimization status...");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [hasOptimizedContent, setHasOptimizedContent] = useState(false);
  const [hasOptimizedPDF, setHasOptimizedPDF] = useState(false);
  const [optimizedPDFBase64, setOptimizedPDFBase64] = useState<string | null>(null);
  const [updatedAtsScore, setUpdatedAtsScore] = useState<number | null>(null);
  const [includePhoto, setIncludePhoto] = useState(false);

  // Fix the linter errors by moving handleAtsScoreUpdate above its usage
  const handleAtsScoreUpdate = (newScore: number) => {
    console.log(`Updating dashboard ATS score to: ${newScore}`);
    setUpdatedAtsScore(newScore);
    
    // Additional logic could be added here to update the dashboard table
    // For example, dispatching an event or calling a parent callback
    if (onUpdateAtsScore) {
      onUpdateAtsScore(newScore);
    }
  };

  // Function to update the ATS score in the parent component
  const onUpdateAtsScore = handleAtsScoreUpdate;

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
    if (!selectedCV) {
      alert("Please select a CV to optimize");
      return;
    }
    
    try {
      setIsOptimizing(true);
      setOptimizationProgress(10);
      setOptimizationError(null);
      setOptimizedText(null);
      setPollingAttempts(0);
      pollRef.current = true;
      
      // Start the optimization process using the local route
      const response = await fetch("/api/cv/optimize-local", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: selectedCV.split('|')[0],
          templateId: selectedTemplate,
          forceReoptimize: true,
          includePhoto: includePhoto
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("Error optimizing CV:", data.error);
        setOptimizationError(data.error || "Failed to optimize CV");
        setIsOptimizing(false);
        return;
      }
      
      // Start polling for status updates
      pollOptimizationStatus(selectedCV);
      
    } catch (error) {
      console.error("Error in optimization process:", error);
      setOptimizationError(error instanceof Error ? error.message : "An unknown error occurred");
      setIsOptimizing(false);
    }
  }

  async function pollOptimizationStatus(cv: string) {
    if (!pollRef.current) return;
    
    try {
      // Extract the file name from the CV selection (it might include an ID)
      const fileName = cv.split('|')[0];
      const cvId = cv.split('|')[1];
      
      const queryParam = cvId ? `cvId=${cvId}` : `fileName=${fileName}`;
      const response = await fetch(`/api/cv/optimization-status?${queryParam}`);
      const data = await response.json();
      
      if (!response.ok) {
        console.error("Error polling status:", data.error);
        setOptimizationError(data.error || "Failed to get optimization status");
        setIsOptimizing(false);
        return;
      }
      
      // Update progress
      setOptimizationProgress(data.progress || 0);
      
      // Check if optimization is complete
      if (data.optimized) {
        setIsOptimizing(false);
        setOptimizationProgress(100);
        
        // Check for DOCX-only mode (PDF conversion failed)
        if (data.docxOnly) {
          setOptimizationWarning("PDF conversion is not available. The optimized CV will be available as a DOCX file.");
        }
        
        // Load optimized content if available
        if (data.optimizedText) {
          setOptimizedText(data.optimizedText);
          // Update the ATS score on the dashboard if the handler is provided
          if (data.atsScore && onUpdateAtsScore) {
            onUpdateAtsScore(data.atsScore);
            setUpdatedAtsScore(data.atsScore);
          }
        } else {
          setOptimizationError("Optimization marked as complete but no optimized text found");
        }
        
        // Store the optimized PDF base64 if available
        if (data.optimizedPDFBase64) {
          setOptimizedPDFBase64(data.optimizedPDFBase64);
        }
        
        return;
      }
      
      // Check for errors
      if (data.error) {
        console.error("Optimization error:", data.error);
        setOptimizationError(data.error);
        setIsOptimizing(false);
        return;
      }
      
      // Continue polling
      setPollingAttempts(prev => prev + 1);
      
      // Limit polling attempts to prevent infinite loop
      if (pollingAttempts < 60) { // 5 minutes max (60 * 5s)
        setTimeout(() => pollOptimizationStatus(cv), 5000);
      } else {
        setOptimizationError("Optimization timed out. Please try again later.");
        setIsOptimizing(false);
      }
      
    } catch (error) {
      console.error("Error polling optimization status:", error);
      setOptimizationError(error instanceof Error ? error.message : "Failed to check optimization status");
      setIsOptimizing(false);
    }
  }

  async function loadOptimizedContent(cv: string) {
    try {
      // Show loading state
      setLoading(true);
      
      // Extract the CV ID if it's in the format 'filename|id'
      const cvId = cv.includes('|') ? cv.split('|')[1] : cv;
      
      // Use our new status endpoint to get the optimized content
      const response = await fetch(`/api/cv/optimization-status?cvId=${cvId}`, {
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
        // Limit the size of the optimized text to prevent stack overflow
        const maxPreviewLength = 5000; // Limit preview to 5000 characters
        const truncatedText = data.optimizedText.length > maxPreviewLength 
          ? data.optimizedText.substring(0, maxPreviewLength) + '... (content truncated for preview)'
          : data.optimizedText;
        
        setOptimizedText(truncatedText);
        console.log("Loaded optimized text (length):", data.optimizedText.length, "Preview length:", truncatedText.length);
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
    if (!selectedCV) {
      setOptimizationError("Please select a CV first");
      return;
    }

    try {
      setLoading(true);
      
      // Extract the CV ID if it's in the format 'filename|id'
      const cvId = selectedCV.includes('|') ? selectedCV.split('|')[1] : selectedCV;
      
      // First check if the CV is optimized
      const statusResponse = await fetch(`/api/cv/optimization-status?cvId=${cvId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!statusResponse.ok) {
        throw new Error(`Server error: ${statusResponse.status}`);
      }
      
      const statusData = await statusResponse.json();
      
      if (!statusData.optimized) {
        setOptimizationError("CV has not been optimized yet");
        setErrorDetails("Please optimize the CV before downloading.");
        return;
      }
      
      // Use the download endpoint to get the full content
      const downloadUrl = `/api/cv/download-optimized?cvId=${cvId}`;
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `optimized_${statusData.fileName || 'cv'}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log("Download initiated");
    } catch (error) {
      console.error("Error downloading optimized CV:", error);
      setOptimizationError(`Error downloading: ${(error as Error).message}`);
      setErrorDetails("There was an error downloading your optimized CV. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-[#B4916C]/10 pb-4">
        <CardTitle className="text-xl font-bold text-[#B4916C]">Optimize Your CV</CardTitle>
        <CardDescription className="text-gray-400">
          Enhanced with AI - Make your CV stand out
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
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
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#B4916C]">Select CV</label>
            <Select
              value={selectedCV || ""}
              onValueChange={handleCVSelect}
            >
              <SelectTrigger className="bg-[#121212] border border-[#B4916C]/30 text-white">
                <SelectValue placeholder="Select a CV" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border border-[#B4916C]/30 text-white">
                {cvs.map((cv) => (
                  <SelectItem key={cv} value={cv} className="hover:bg-[#B4916C]/10">
                    {cv}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#B4916C]">Select Template</label>
            <Select
              value={selectedTemplate}
              onValueChange={handleTemplateSelect}
            >
              <SelectTrigger className="bg-[#121212] border border-[#B4916C]/30 text-white">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border border-[#B4916C]/30 text-white">
                <SelectItem value="google-modern" className="hover:bg-[#B4916C]/10">Google Modern</SelectItem>
                <SelectItem value="amazon-leadership" className="hover:bg-[#B4916C]/10">Amazon Leadership</SelectItem>
                <SelectItem value="meta-impact" className="hover:bg-[#B4916C]/10">Meta Impact</SelectItem>
                <SelectItem value="apple-minimal" className="hover:bg-[#B4916C]/10">Apple Minimal</SelectItem>
                <SelectItem value="microsoft-professional" className="hover:bg-[#B4916C]/10">Microsoft Pro</SelectItem>
                <SelectItem value="jpmorgan-finance" className="hover:bg-[#B4916C]/10">JP Morgan</SelectItem>
                <SelectItem value="professional" className="hover:bg-[#B4916C]/10">Professional</SelectItem>
                <SelectItem value="modern" className="hover:bg-[#B4916C]/10">Modern Classic</SelectItem>
                <SelectItem value="executive" className="hover:bg-[#B4916C]/10">Executive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Photo Option */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="include-photo"
              checked={includePhoto}
              onCheckedChange={(checked) => setIncludePhoto(checked as boolean)}
              className="border-[#B4916C]/50 data-[state=checked]:bg-[#B4916C] data-[state=checked]:border-[#B4916C]"
            />
            <Label
              htmlFor="include-photo"
              className="text-sm font-medium text-gray-200 cursor-pointer"
            >
              Include professional photo (if available)
            </Label>
          </div>

          {/* Progress Bar - only show during optimization */}
          {isOptimizing && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Optimization Progress</span>
                <span className="text-[#B4916C] font-medium">{optimizationProgress}%</span>
              </div>
              <Progress 
                value={optimizationProgress} 
                max={100} 
                className="h-2 bg-[#121212]"
              >
                <div 
                  className="h-full bg-[#B4916C] transition-all" 
                  style={{ width: `${optimizationProgress}%` }}
                />
              </Progress>
            </div>
          )}

          {/* Error Display */}
          {optimizationError && (
            <Alert className="mt-4 border-red-500/20 bg-red-500/10 text-red-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {optimizationError}
              </AlertDescription>
            </Alert>
          )}

          {/* Warning Display */}
          {optimizationWarning && (
            <Alert className="mt-4 border-yellow-500/20 bg-yellow-500/10 text-yellow-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {optimizationWarning}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Display - only show when optimization complete */}
          {optimizedText && !optimizationError && (
            <Alert className="mt-4 border-green-500/20 bg-green-500/10 text-green-300">
              <Check className="h-4 w-4" />
              <AlertDescription>
                CV optimized successfully!
              </AlertDescription>
            </Alert>
          )}
          
          {/* Updated ATS Score - show if available */}
          {updatedAtsScore !== null && (
            <div className="mt-4 p-3 bg-[#121212] border border-[#B4916C]/20 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Updated ATS Score:</span>
                <span className="text-[#B4916C] font-bold text-lg">{updatedAtsScore}%</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 space-y-4">
            {/* Optimization Button */}
            <Button
              onClick={handleOptimize}
              disabled={isOptimizing || !selectedCV}
              className="w-full bg-[#B4916C] hover:bg-[#B4916C]/80 text-white font-medium py-2 rounded-md flex items-center justify-center"
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

            {/* Download Button - only show when optimized */}
            {optimizedText && (
              <Button
                onClick={handleDownload}
                className="w-full bg-[#121212] hover:bg-[#1a1a1a] text-white font-medium py-2 rounded-md border border-[#B4916C]/30 flex items-center justify-center"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Optimized CV
              </Button>
            )}
          </div>
        </div>

        {optimizedText && (
          <div className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">
                Optimized CV
              </h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDownload}
                disabled={loading}
              >
                {loading ? "Downloading..." : "Download PDF"}
              </Button>
            </div>
          </div>
        )}

        {optimizedText && selectedCV && (
          <div className="mt-6">
            <OptimizationSummary 
              fileName={selectedCV} 
              onUpdateDashboard={handleAtsScoreUpdate}
            />
          </div>
        )}

        {/* Optimized CV Preview - show when available */}
        {optimizedText && (
          <div className="mt-6 border border-[#B4916C]/20 bg-[#121212] rounded-md p-4">
            <h3 className="text-[#B4916C] font-medium mb-2">Optimized Content Preview</h3>
            <div className="max-h-48 overflow-y-auto text-sm text-gray-300 bg-[#0A0A0A] p-3 rounded whitespace-pre-line">
              {/* Render optimized text in chunks to prevent stack overflow */}
              {optimizedText.length > 10000 ? (
                <>
                  <p>{optimizedText.substring(0, 2000)}</p>
                  <p className="text-amber-500 my-2">... (content truncated for preview) ...</p>
                  <p>{optimizedText.substring(optimizedText.length - 2000)}</p>
                </>
              ) : (
                optimizedText
              )}
            </div>
            
            {/* Show ATS Score Comparison if available */}
            {updatedAtsScore !== null && (
              <div className="mt-4">
                <OptimizationSummary 
                  fileName={selectedCV?.split('|')[0] || ''}
                  showDetails={false}
                  onUpdateDashboard={handleAtsScoreUpdate}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
