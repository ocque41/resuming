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
  const [selectedTemplate, setSelectedTemplate] = useState<string>("professional");
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
      
      // If we've been polling for too long (30 attempts = 1 minute), stop
      if (pollingAttempts > 30) {
        throw new Error("Optimization is taking too long. Please try again later.");
      }
      
      const response = await fetch(`/api/optimize-cv/status?fileName=${encodeURIComponent(cv)}`);
      
      if (!response.ok) {
        throw new Error("Failed to check optimization status");
      }
      
      const data = await response.json();
      
      if (data.status === "completed") {
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
        
        // Poll again after 2 seconds
        setTimeout(() => {
          if (isPolling) { // Only continue polling if we haven't stopped
            pollOptimizationStatus(cv);
          }
        }, 2000);
      } else if (data.status === "error") {
        throw new Error(data.error || "Optimization failed");
      }
    } catch (error) {
      console.error("Error polling optimization status:", error);
      setOptimizationError((error as Error).message);
      setIsOptimizing(false);
      setIsPolling(false);
    }
  }

  async function saveOptimizedCV(originalFileName: string, optimizedText: string) {
    try {
      // Create a new filename for the optimized version
      const fileNameParts = originalFileName.split('.');
      const extension = fileNameParts.pop();
      const baseName = fileNameParts.join('.');
      const optimizedFileName = `${baseName}-optimized.${extension}`;
      
      // Convert optimized text to a file object
      const textBlob = new Blob([optimizedText], { type: 'text/plain' });
      const file = new File([textBlob], optimizedFileName, { type: 'application/pdf' });
      
      // Create FormData to send the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', optimizedFileName);
      formData.append('originalFileName', originalFileName);
      
      // Send the optimized CV to the server
      const response = await fetch('/api/cv/save-optimized', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to save optimized CV');
      }
      
      console.log('Optimized CV saved successfully');
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Optimize Your CV</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* CV Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Select CV</label>
            <Select
              value={selectedCV}
              onValueChange={handleCVSelect}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a CV to optimize" />
              </SelectTrigger>
              <SelectContent>
                {cvs.map((cv) => (
                  <SelectItem key={cv} value={cv}>
                    {cv}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Select Template</label>
            <Select
              value={selectedTemplate}
              onValueChange={handleTemplateSelect}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="creative">Creative</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Optimization Progress */}
          {isOptimizing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Optimizing your CV...</span>
                <span className="text-sm font-medium">{optimizationProgress}%</span>
              </div>
              <Progress value={optimizationProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                This may take a minute or two. Please don't close this page.
              </p>
            </div>
          )}

          {/* Error Message */}
          {optimizationError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {optimizationError}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {isOptimized && !optimizationError && (
            <Alert className="bg-green-50 border-green-200 text-green-800 mt-4">
              <Check className="h-4 w-4" />
              <AlertDescription>
                Your CV has been successfully optimized!
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              onClick={handleOptimize}
              disabled={!selectedCV || isOptimizing}
              className="flex-1"
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
                className="flex-1"
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
