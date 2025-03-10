"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnalyzeCVCard from "@/components/AnalyzeCVCard.client";
import EnhancedOptimizeCVCard from "@/components/EnhancedOptimizeCVCard.client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Toast functionality without using the use-toast hook
function showToast(message: { title: string; description: string; duration: number }) {
  // Simple implementation - you might want to replace this with a proper toast library
  console.log(`TOAST: ${message.title} - ${message.description}`);
  // Alternatively, create a DOM element for the toast and remove it after duration
}

interface OptimizationWorkflowProps {
  cvs: string[];
}

/**
 * Streamlined Optimization Workflow
 * A lightweight, high-performance workflow for analyzing and optimizing CVs
 */
export default function OptimizationWorkflow({ cvs }: OptimizationWorkflowProps) {
  // Core states for workflow
  const [activeStep, setActiveStep] = useState<"analyze" | "optimize">("analyze");
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<number | null>(null);
  
  // Lighter polling mechanism with backoff
  const [statusPollingInterval, setStatusPollingInterval] = useState<number>(1000);
  const [statusPollingEnabled, setStatusPollingEnabled] = useState<boolean>(false);
  
  // Check for pre-analyzed CV
  useEffect(() => {
    const checkForPreAnalyzedCV = async () => {
      // Only check when on analyze step with no selection yet
      if (activeStep === "analyze" && !selectedCVId && cvs.length > 0) {
        try {
          // Check if any CV has been analyzed but not optimized - lightweight check
          const response = await fetch(`/api/cv/get-analyzed-cvs`);
          if (response.ok) {
            const data = await response.json();
            
            if (data.analyzedCVs && data.analyzedCVs.length > 0) {
              // Find the most recently analyzed CV
              const mostRecent = data.analyzedCVs[0];
              
              // Auto-select this CV
              setSelectedCVId(String(mostRecent.id));
              setSelectedCVName(mostRecent.filename);
              
              showToast({
                title: "CV Ready for Optimization",
                description: `${mostRecent.filename} has been analyzed and is ready for optimization.`,
                duration: 5000,
              });
            }
          }
        } catch (err) {
          console.error("Error checking for pre-analyzed CVs:", err);
        }
      }
    };
    
    checkForPreAnalyzedCV();
  }, [activeStep, cvs, selectedCVId]);
  
  // Polling mechanism for process status with exponential backoff
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
            setProcessingStatus(data.processingStatus || "Processing...");
            setProcessingProgress(data.processingProgress || 0);
            
            // Continue polling, but back off if progress is slow
            const newInterval = data.processingProgress > 80 ? 1000 :
                               data.processingProgress > 60 ? 2000 :
                               data.processingProgress > 40 ? 3000 : 5000;
            
            setStatusPollingInterval(newInterval);
            timeoutId = setTimeout(checkStatus, newInterval);
          } else if (data.processingCompleted) {
            // Processing completed
            setIsProcessing(false);
            setProcessingStatus("Processing completed");
            setProcessingProgress(100);
            setStatusPollingEnabled(false);
            
            // Auto-transition to optimize step if not already there
            if (activeStep !== "optimize") {
              setActiveStep("optimize");
            }
          } else {
            // Not processing or idle
            setIsProcessing(false);
            setProcessingStatus(null);
            setProcessingProgress(null);
            
            // Stop polling if nothing is happening
            if (!data.processing && !data.processingCompleted) {
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
  }, [statusPollingEnabled, statusPollingInterval, selectedCVId, activeStep]);
  
  // Handle when analysis is complete with defensive coding 
  const handleAnalysisComplete = async (cvId: string) => {
    try {
      console.log("Analysis complete, handling completion for CV ID:", cvId);
      
      // Ensure cvId is a string
      if (typeof cvId !== 'string' || !cvId) {
        console.error("Invalid CV ID received:", cvId);
        setError("Invalid CV ID. Please try analyzing again.");
        return;
      }
      
      // Set the selected CV ID safely
      setSelectedCVId(cvId);
      
      // Find the CV name from the ID with safety checks
      if (Array.isArray(cvs) && cvs.length > 0) {
        const selectedCV = cvs.find(cv => {
          if (typeof cv !== 'string') return false;
          
          try {
            const parts = cv.split('|');
            return parts.length >= 2 && parts[1] === cvId;
          } catch (error) {
            console.error("Error parsing CV string:", error);
            return false;
          }
        });
        
        if (selectedCV) {
          try {
            const parts = selectedCV.split('|');
            if (parts.length >= 1) {
              setSelectedCVName(parts[0]);
            }
          } catch (error) {
            console.error("Error setting CV name:", error);
            // Continue without setting the name
          }
        }
      }
      
      // Start polling status
      setStatusPollingEnabled(true);
      setStatusPollingInterval(1000); // Start with 1s interval
      
      try {
        // Trigger optimization process
        const response = await fetch(`/api/cv/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cvId }),
        });
        
        if (response.ok) {
          showToast({
            title: "Optimization Started",
            description: "Your CV is being optimized. This may take a moment.",
            duration: 5000,
          });
        } else {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Error response from optimization process:", errorData);
          setError(errorData.error || "Failed to start optimization process");
          setStatusPollingEnabled(false);
        }
      } catch (err) {
        console.error("Error starting optimization:", err);
        setError(typeof err === 'object' && err !== null && 'message' in err ? 
          String(err.message) : "Failed to start optimization");
        setStatusPollingEnabled(false);
      }
    } catch (outerError) {
      console.error("Unexpected error in handleAnalysisComplete:", outerError);
      setError("An unexpected error occurred. Please try again.");
      setStatusPollingEnabled(false);
    }
  };
  
  // Filter CVs for the optimization step
  const getOptimizeCVs = () => {
    if (!selectedCVId) return [];
    
    return cvs.filter((cv: string) => {
      try {
        const parts = cv.split('|');
        return parts.length >= 2 && parts[1] === selectedCVId;
      } catch (error) {
        console.error("Error filtering CV:", error);
        return false;
      }
    });
  };
  
  // Handle tab changes
  const handleTabChange = (value: string) => {
    if (value === "optimize" && !selectedCVId) {
      setError("Please analyze a CV first before proceeding to optimization");
      return;
    }
    
    setActiveStep(value as "analyze" | "optimize");
    setError(null);
  };
  
  return (
    <div className="w-full max-w-6xl mx-auto">
      {error && (
        <Alert className="mb-4 bg-destructive/10">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {isProcessing && (
        <div className="mb-4 p-4 border rounded-md bg-background">
          <h3 className="text-lg font-semibold">Processing CV</h3>
          <p className="text-sm text-muted-foreground">{processingStatus}</p>
          <div className="w-full h-2 bg-secondary mt-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-in-out" 
              style={{ width: `${processingProgress || 0}%` }}
            />
          </div>
          <p className="text-sm text-right mt-1">{processingProgress || 0}%</p>
        </div>
      )}
      
      <Tabs defaultValue="analyze" onValueChange={handleTabChange} value={activeStep}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="analyze">Analyze</TabsTrigger>
          <TabsTrigger value="optimize" disabled={!selectedCVId}>
            Optimize
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="analyze" className="space-y-4 mt-4">
          <h2 className="text-2xl font-bold">Analyze Your CV</h2>
          <p className="text-muted-foreground">
            Upload your CV to analyze its ATS compatibility and get recommendations.
          </p>
          
          <AnalyzeCVCard onAnalysisComplete={handleAnalysisComplete} cvs={cvs} />
        </TabsContent>
        
        <TabsContent value="optimize" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Optimize Your CV</h2>
              <p className="text-muted-foreground">
                {selectedCVName ? `Optimizing: ${selectedCVName}` : 'Enhance your CV with AI-powered optimization.'}
              </p>
            </div>
            
            <Button
              variant="secondary"
              onClick={() => {
                setActiveStep("analyze");
                setError(null);
              }}
            >
              Back to Analyze
            </Button>
          </div>
          
          <EnhancedOptimizeCVCard cvs={getOptimizeCVs()} />
        </TabsContent>
      </Tabs>
    </div>
  );
} 