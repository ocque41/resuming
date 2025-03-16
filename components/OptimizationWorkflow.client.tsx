"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ProgressiveOptimizationStatus from "@/app/components/ProgressiveOptimizationStatus.client";
import { OptimizationStage } from "@/lib/services/progressiveOptimization";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
export default function OptimizationWorkflow(props: OptimizationWorkflowProps): JSX.Element {
  const { cvs } = props;

  // Core states for workflow
  const [activeStep, setActiveStep] = useState<"general" | "specific">("general");
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<number | null>(null);
  
  // Lighter polling mechanism with backoff
  const [statusPollingInterval, setStatusPollingInterval] = useState<number>(1000);
  const [statusPollingEnabled, setStatusPollingEnabled] = useState<boolean>(false);
  
  // In the component state, add a new state variable to track if processing is taking too long
  const [processingTooLong, setProcessingTooLong] = useState<boolean>(false);
  
  // State for progressive optimization
  const [optimizationState, setOptimizationState] = useState<any>(null);
  const [jobDescription, setJobDescription] = useState<string>("");
  
  // Check for pre-analyzed CV
  useEffect(() => {
    const checkForPreAnalyzedCV = async () => {
      // Only check when on general step with no selection yet
      if (activeStep === "general" && !selectedCVId && cvs.length > 0) {
        try {
          // This could be a lightweight check to see if any CVs have been analyzed before
          // For now, we'll just select the first CV in the list
          const firstCV = cvs[0];
          const [cvName, cvId] = firstCV.split('|');
          
          if (cvId) {
            setSelectedCVId(cvId);
            setSelectedCVName(cvName);
          }
        } catch (error) {
          console.error("Error checking for pre-analyzed CV:", error);
        }
      }
    };

    checkForPreAnalyzedCV();
  }, [activeStep, cvs, selectedCVId]);

  // Status polling effect
  useEffect(() => {
    let pollingTimeout: NodeJS.Timeout | null = null;
    
    const checkStatus = async () => {
      if (!statusPollingEnabled || !selectedCVId || !jobDescription) {
        return;
      }
      
      try {
        const response = await fetch('/api/cv/optimize/partial-results', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cvId: selectedCVId,
            jobDescription
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching status: ${response.status}`);
        }
        
        // Try to parse the response as JSON
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error("Error parsing JSON response from partial-results:", jsonError);
          
          // Don't stop polling on JSON parse errors, just try again later
          pollingTimeout = setTimeout(checkStatus, statusPollingInterval * 2);
          return;
        }
        
        if (data.success) {
          // Update progress
          if (data.progress !== undefined) {
            setProcessingProgress(data.progress);
          }
          
          // Update optimization state
          if (data.optimizationState) {
            setOptimizationState(data.optimizationState);
          }
          
          // Update status message based on the current stage
          if (data.optimizationState?.stage) {
            const stage = data.optimizationState.stage;
            let statusMessage = "Processing...";
            
            if (stage.startsWith('ANALYZE_')) {
              statusMessage = "Analyzing your CV...";
            } else if (stage.startsWith('OPTIMIZE_')) {
              statusMessage = "Optimizing your CV for the job description...";
            } else if (stage.startsWith('GENERATE_')) {
              statusMessage = "Generating optimized document...";
            }
            
            setProcessingStatus(statusMessage);
          }
          
          // Check if processing is complete
          if (data.progress === 100 || data.optimizationState?.stage === OptimizationStage.GENERATE_COMPLETED) {
            setIsProcessing(false);
            setStatusPollingEnabled(false);
            setProcessingStatus("Optimization complete!");
            
            // Handle completion
            if (data.partialResults?.optimizedContent) {
              handleAnalysisComplete(selectedCVId, data.partialResults);
            }
          } else {
            // Continue polling with backoff
            const newInterval = Math.min(statusPollingInterval * 1.2, 5000);
            setStatusPollingInterval(newInterval);
            
            pollingTimeout = setTimeout(checkStatus, newInterval);
          }
        } else if (data.error) {
          // If there's an error but we have partial results, show a warning instead of stopping
          if (data.optimizationState?.results?.optimizedContent) {
            setError(`Warning: ${data.error} - Continuing with partial results.`);
            // Continue polling to get any further updates
            pollingTimeout = setTimeout(checkStatus, statusPollingInterval);
          } else {
            setError(data.error);
            // Don't stop polling immediately on errors, try a few more times
            if (statusPollingInterval < 10000) {  // If we haven't backed off too much yet
              const newInterval = Math.min(statusPollingInterval * 2, 10000);
              setStatusPollingInterval(newInterval);
              pollingTimeout = setTimeout(checkStatus, newInterval);
            } else {
              setIsProcessing(false);
              setStatusPollingEnabled(false);
            }
          }
        }
      } catch (error) {
        console.error("Error checking status:", error);
        // Don't stop polling on network errors, just try again later with increased interval
        const newInterval = Math.min(statusPollingInterval * 2, 10000);
        setStatusPollingInterval(newInterval);
        pollingTimeout = setTimeout(checkStatus, newInterval);
      }
    };
    
    if (statusPollingEnabled) {
      pollingTimeout = setTimeout(checkStatus, statusPollingInterval);
    }
    
    return () => {
      if (pollingTimeout) {
        clearTimeout(pollingTimeout);
      }
    };
  }, [statusPollingEnabled, statusPollingInterval, selectedCVId, jobDescription]);
  
  // Check if processing is taking too long
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    if (isProcessing) {
      timeoutId = setTimeout(() => {
        setProcessingTooLong(true);
      }, 60000); // 60 seconds
    } else {
      setProcessingTooLong(false);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isProcessing]);

  const handleAnalysisComplete = async (cvId: string, results: any) => {
    setIsProcessing(false);
    setStatusPollingEnabled(false);
    setProcessingStatus("Optimization complete!");
    setProcessingProgress(100);
    
    // Show success message
    showToast({
      title: "Optimization Complete",
      description: "Your CV has been successfully optimized!",
      duration: 5000,
    });
  };

  const handleOptimizeCV = async (cvId: string, cvName: string, jobDesc: string) => {
    setSelectedCVId(cvId);
    setSelectedCVName(cvName);
    setJobDescription(jobDesc);
    setError(null);
    setIsProcessing(true);
    setProcessingStatus("Starting optimization process...");
    setProcessingProgress(0);
    setOptimizationState(null);
    
    try {
      // Start the optimization process
      const response = await fetch('/api/cv/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId,
          jobDescription: jobDesc,
          includeKeywords: true,
          documentFormat: 'markdown'
        }),
      });
      
      if (!response.ok) {
        // Try to parse the error response as JSON
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error ${response.status}`);
        } catch (jsonError) {
          // If we can't parse the response as JSON, use the status text
          throw new Error(`Server error (${response.status}): ${response.statusText}`);
        }
      }
      
      // Try to parse the response as JSON
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // Handle JSON parsing errors
        console.error("Error parsing JSON response:", jsonError);
        throw new Error("Invalid response from server. The optimization service may be experiencing issues.");
      }
      
      if (data.success) {
        // If the process completed immediately (unlikely)
        if (data.result) {
          handleAnalysisComplete(cvId, data.result);
        } else {
          // Start polling for status updates
          setStatusPollingInterval(1000);
          setStatusPollingEnabled(true);
        }
      } else {
        throw new Error(data.error || "Unknown error occurred");
      }
    } catch (error) {
      console.error("Error optimizing CV:", error);
      
      // Provide more user-friendly error messages
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('Unexpected token') || errorMessage.includes('not valid JSON')) {
        errorMessage = "The server returned an invalid response. This is likely due to a temporary issue with the AI service. Please try again in a few minutes.";
        
        // Start polling for partial results anyway - they might be available
        setStatusPollingInterval(2000);
        setStatusPollingEnabled(true);
      } else if (errorMessage.includes('tee is not a function')) {
        errorMessage = "There's a temporary issue with the AI service. The system will try to continue with available features.";
        
        // Start polling for partial results
        setStatusPollingInterval(2000);
        setStatusPollingEnabled(true);
      } else if (errorMessage.includes('Mistral') || errorMessage.includes('OpenAI')) {
        errorMessage = "There's a temporary issue with the AI service. Please try again in a few minutes.";
      } else if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
        errorMessage = "The request timed out. This might be due to high server load or a complex CV. The system will try to continue with partial results if available.";
        
        // Start polling for partial results
        setStatusPollingInterval(2000);
        setStatusPollingEnabled(true);
      }
      
      setError(errorMessage);
      
      // Don't stop processing completely if we're going to poll for partial results
      if (!statusPollingEnabled) {
        setIsProcessing(false);
      }
      
      // If the error is related to service availability, suggest trying again later
      if (errorMessage.includes('service') || errorMessage.includes('AI')) {
        showToast({
          title: "Service Issue",
          description: "We're experiencing some issues with our AI services. Please try again later.",
          duration: 5000,
        });
      }
    }
  };

  const handleTabChange = (value: string) => {
    setActiveStep(value as "general" | "specific");
    setError(null);
  };

  const handleResetProcessing = async () => {
    setIsProcessing(false);
    setStatusPollingEnabled(false);
    setProcessingStatus(null);
    setProcessingProgress(null);
    setProcessingTooLong(false);
    setError(null);
    setOptimizationState(null);
  };

  // General Optimization Card Component
  const GeneralOptimizationCard = () => {
    const [localJobDescription, setLocalJobDescription] = useState<string>("");
    const [selectedCV, setSelectedCV] = useState<string | null>(null);
    
    const handleCVSelect = (value: string) => {
      setSelectedCV(value);
      const [name, id] = value.split('|');
      setSelectedCVName(name);
      setSelectedCVId(id);
    };
    
    const handleOptimize = () => {
      if (selectedCV) {
        const [name, id] = selectedCV.split('|');
        handleOptimizeCV(id, name, localJobDescription);
      }
    };
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>General CV Optimization</CardTitle>
          <CardDescription>
            Optimize your CV for better ATS compatibility and readability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cv-select">Select your CV</Label>
            <Select 
              value={selectedCV || ""} 
              onValueChange={handleCVSelect}
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a CV" />
              </SelectTrigger>
              <SelectContent>
                {cvs.map((cv) => {
                  const [name, id] = cv.split('|');
                  return (
                    <SelectItem key={id} value={cv}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="job-description">Job Description (Optional)</Label>
            <Textarea
              id="job-description"
              placeholder="Paste a job description to tailor your CV (optional)"
              value={localJobDescription}
              onChange={(e) => setLocalJobDescription(e.target.value)}
              className="min-h-[100px]"
              disabled={isProcessing}
            />
          </div>
          
          <Button 
            onClick={handleOptimize} 
            disabled={!selectedCV || isProcessing}
            className="w-full"
          >
            {isProcessing ? "Optimizing..." : "Optimize CV"}
          </Button>
        </CardContent>
      </Card>
    );
  };
  
  // Specific Job Optimization Card Component
  const SpecificJobOptimizationCard = () => {
    const [localJobDescription, setLocalJobDescription] = useState<string>("");
    const [selectedCV, setSelectedCV] = useState<string | null>(null);
    
    const handleCVSelect = (value: string) => {
      setSelectedCV(value);
      const [name, id] = value.split('|');
      setSelectedCVName(name);
      setSelectedCVId(id);
    };
    
    const handleOptimize = () => {
      if (selectedCV && localJobDescription) {
        const [name, id] = selectedCV.split('|');
        handleOptimizeCV(id, name, localJobDescription);
      }
    };
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Job-Specific Optimization</CardTitle>
          <CardDescription>
            Tailor your CV for a specific job by providing the job description
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cv-select">Select your CV</Label>
            <Select 
              value={selectedCV || ""} 
              onValueChange={handleCVSelect}
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a CV" />
              </SelectTrigger>
              <SelectContent>
                {cvs.map((cv) => {
                  const [name, id] = cv.split('|');
                  return (
                    <SelectItem key={id} value={cv}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="job-description">Job Description</Label>
            <Textarea
              id="job-description"
              placeholder="Paste the job description here"
              value={localJobDescription}
              onChange={(e) => setLocalJobDescription(e.target.value)}
              className="min-h-[150px]"
              disabled={isProcessing}
            />
          </div>
          
          <Button 
            onClick={handleOptimize} 
            disabled={!selectedCV || !localJobDescription || isProcessing}
            className="w-full"
          >
            {isProcessing ? "Optimizing..." : "Optimize for This Job"}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General Optimization</TabsTrigger>
          <TabsTrigger value="specific">Specific Job Optimization</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4 mt-4">
          <GeneralOptimizationCard />
          
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {isProcessing && (
            <div className="mt-4">
              <ProgressiveOptimizationStatus 
                optimizationState={optimizationState}
                isOptimizing={isProcessing}
              />
            </div>
          )}
          
          {processingTooLong && (
            <Alert className="mt-4 bg-amber-900/30 border-amber-800">
              <AlertDescription className="text-amber-200">
                This is taking longer than expected. The optimization process can take up to 2 minutes for complex CVs.
                <div className="mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-amber-800/50 hover:bg-amber-700/50 border-amber-700/50 mr-2"
                    onClick={handleResetProcessing}
                  >
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        <TabsContent value="specific" className="space-y-4 mt-4">
          <SpecificJobOptimizationCard />
          
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {isProcessing && (
            <div className="mt-4">
              <ProgressiveOptimizationStatus 
                optimizationState={optimizationState}
                isOptimizing={isProcessing}
              />
            </div>
          )}
          
          {processingTooLong && (
            <Alert className="mt-4 bg-amber-900/30 border-amber-800">
              <AlertDescription className="text-amber-200">
                This is taking longer than expected. The optimization process can take up to 2 minutes for complex CVs.
                <div className="mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-amber-800/50 hover:bg-amber-700/50 border-amber-700/50 mr-2"
                    onClick={handleResetProcessing}
                  >
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 