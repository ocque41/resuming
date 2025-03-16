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
  const [warning, setWarning] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<number | null>(null);
  
  // Results states
  const [optimizedContent, setOptimizedContent] = useState<string>("");
  const [matchScore, setMatchScore] = useState<number>(0);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  
  // Lighter polling mechanism with backoff
  const [statusPollingInterval, setStatusPollingInterval] = useState<number>(1000);
  const [statusPollingEnabled, setStatusPollingEnabled] = useState<boolean>(false);
  const [statusCheckErrorCount, setStatusCheckErrorCount] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  
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
      if (!selectedCVId || !jobDescription) return;
      
      try {
        const response = await fetch('/api/cv/optimize/partial-results', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cvId: selectedCVId,
            jobDescription: jobDescription
          }),
          // Set a reasonable timeout for status checks
          signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
          // If we get a 404, it means no results yet - not an error
          if (response.status === 404) {
            return;
          }
          
          // For other errors, log but don't display to user unless it persists
          console.error(`Error checking status: ${response.status} ${response.statusText}`);
          
          // Increment error count but continue polling
          setStatusCheckErrorCount(prev => prev + 1);
          
          // Only show error to user if we've had multiple consecutive errors
          if (statusCheckErrorCount > 3) {
            setWarning(`Warning: Having trouble checking optimization status. The process may still be running.`);
          }
          
          return;
        }
        
        // Reset error count on successful response
        setStatusCheckErrorCount(0);
        
        const data = await response.json();
        
        if (data.success) {
          // Update progress
          setProcessingProgress(data.progress || 0);
          
          // If we have an optimization state, update it
          if (data.optimizationState) {
            setOptimizationState(data.optimizationState);
          }
          
          // If we have partial results, update the UI
          if (data.partialResults) {
            // Update content if available
            if (data.partialResults.optimizedContent) {
              setOptimizedContent(data.partialResults.optimizedContent);
            }
            
            // Update match score if available
            if (data.partialResults.matchScore !== undefined) {
              setMatchScore(data.partialResults.matchScore);
            }
            
            // Update recommendations if available
            if (data.partialResults.recommendations) {
              setRecommendations(data.partialResults.recommendations);
            }
            
            // Check for errors in partial results
            if (data.partialResults.error) {
              // If we have partial results with content but also an error,
              // show as a warning instead of an error so the user can still use the results
              if (data.partialResults.optimizedContent) {
                setWarning(`Warning: ${data.partialResults.error}`);
              } else {
                setError(`Error: ${data.partialResults.error}`);
                setIsProcessing(false);
                setStatusPollingEnabled(false);
              }
            }
            
            // If progress is 100%, optimization is complete
            if (data.progress >= 100) {
              setIsProcessing(false);
              setStatusPollingEnabled(false);
              setProcessingStatus("Optimization complete!");
              
              // Show success message
              showToast({
                title: "Optimization Complete",
                description: "Your CV has been successfully optimized!",
                duration: 5000,
              });
            } else {
              // Update status message based on progress
              if (data.progress < 30) {
                setProcessingStatus("Analyzing your CV...");
              } else if (data.progress < 60) {
                setProcessingStatus("Optimizing content...");
              } else if (data.progress < 90) {
                setProcessingStatus("Finalizing optimization...");
              } else {
                setProcessingStatus("Almost done...");
              }
              
              // Adjust polling interval based on progress
              // Slower polling at the beginning, faster as we approach completion
              if (data.progress < 20) {
                setStatusPollingInterval(3000); // 3 seconds
              } else if (data.progress < 80) {
                setStatusPollingInterval(2000); // 2 seconds
              } else {
                setStatusPollingInterval(1000); // 1 second
              }
            }
          }
        } else if (data.error) {
          console.error('Error in partial results:', data.error);
          
          // Only set error if we don't have any partial results
          if (!optimizedContent) {
            setError(`Error: ${data.error}`);
            setIsProcessing(false);
            setStatusPollingEnabled(false);
          } else {
            // If we have partial results, show as warning instead
            setWarning(`Warning: ${data.error}`);
            
            // If we've been polling for a while with partial results, consider it done
            if (Date.now() - startTime > 60000) { // 1 minute
              setIsProcessing(false);
              setStatusPollingEnabled(false);
              setProcessingStatus("Optimization partially complete");
            }
          }
        }
      } catch (error) {
        console.error('Error checking optimization status:', error);
        
        // Increment error count
        setStatusCheckErrorCount(prev => prev + 1);
        
        // Only show error to user if we've had multiple consecutive errors
        if (statusCheckErrorCount > 3) {
          // If we already have partial results, show as warning instead of error
          if (optimizedContent) {
            setWarning(`Warning: Unable to check for further updates. Using available results.`);
            
            // If we've been polling for a while with partial results, consider it done
            if (Date.now() - startTime > 60000) { // 1 minute
              setIsProcessing(false);
              setStatusPollingEnabled(false);
              setProcessingStatus("Optimization partially complete");
            }
          } else {
            setError(`Error checking status: ${error instanceof Error ? error.message : String(error)}`);
            setIsProcessing(false);
            setStatusPollingEnabled(false);
          }
        }
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
  }, [statusPollingEnabled, statusPollingInterval, selectedCVId, isProcessing]);
  
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
    setWarning(null);
    setIsProcessing(true);
    setProcessingStatus("Starting optimization process...");
    setProcessingProgress(0);
    setOptimizationState(null);
    setStatusCheckErrorCount(0);
    setStartTime(Date.now());
    
    try {
      // Start the optimization process but don't wait for it to complete
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
        // Set a short timeout just for the initial request
        signal: AbortSignal.timeout(10000) // 10 seconds timeout for initial request
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
      
      // Start polling for results immediately
      setStatusPollingEnabled(true);
      setStatusPollingInterval(1000); // Start with 1 second interval
      
      // Show a message to the user
      setProcessingStatus("Optimization in progress. This may take a minute...");
      
    } catch (error) {
      console.error('Error starting CV optimization:', error);
      
      // Set error message based on the type of error
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide more user-friendly error messages
      if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
        errorMessage = 'The AI service is currently experiencing high demand. Please try again in a few minutes.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
        errorMessage = 'The server is taking longer than expected to respond. The optimization is still running in the background. Please wait while we check for results.';
        
        // Even if the initial request times out, we can still try polling for results
        setStatusPollingEnabled(true);
        setStatusPollingInterval(2000); // Start with 2 second interval
        return; // Continue processing
      } else if (errorMessage.includes('OpenAI')) {
        errorMessage = 'There was an issue with the AI service. Please try again later.';
      }
      
      setError(`Error: ${errorMessage}`);
      setIsProcessing(false);
      
      // Show error toast
      showToast({
        title: "Optimization Failed",
        description: errorMessage,
        duration: 5000,
      });
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