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
      if (!selectedCVId || !isProcessing) return;
      
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
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setProcessingProgress(data.progress || 0);
          
          // Update optimization state if available
          if (data.optimizationState) {
            setOptimizationState(data.optimizationState);
          }
          
          // Update status message based on progress
          if (data.progress < 30) {
            setProcessingStatus("Analyzing CV content...");
          } else if (data.progress < 70) {
            setProcessingStatus("Optimizing CV content...");
          } else if (data.progress < 100) {
            setProcessingStatus("Generating optimized document...");
          } else {
            setProcessingStatus("Optimization complete!");
            setIsProcessing(false);
            setOptimizedContent(data.partialResults?.optimizedContent || '');
            setMatchScore(data.partialResults?.matchScore || 0);
            setRecommendations(data.partialResults?.recommendations || []);
            
            // Show success message
            showToast({
              title: "Optimization Complete",
              description: "Your CV has been successfully optimized!",
              duration: 5000,
            });
            
            // Stop polling
            return;
          }
          
          // Check for errors but with partial results
          if (data.partialResults?.error) {
            // If we have optimized content, show a warning instead of an error
            if (data.partialResults.optimizedContent) {
              setWarning(`Warning: ${data.partialResults.error}`);
              setOptimizedContent(data.partialResults.optimizedContent);
              setMatchScore(data.partialResults.matchScore || 0);
              setRecommendations(data.partialResults.recommendations || []);
            } else {
              setError(`Error: ${data.partialResults.error}`);
              setIsProcessing(false);
              return;
            }
          }
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (error) {
        console.error('Error checking status:', error);
        setError(`Error checking optimization status: ${error instanceof Error ? error.message : String(error)}`);
        // Don't stop processing on status check errors, just try again
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
        throw new Error(`Failed to parse response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
      }
      
      // Check if the optimization was successful
      if (data.success) {
        // If we have results, update the UI
        if (data.result) {
          setOptimizedContent(data.result.optimizedContent || '');
          setMatchScore(data.result.matchScore || 0);
          setRecommendations(data.result.recommendations || []);
          setProcessingProgress(data.result.progress || 100);
          
          // If we have an optimization state, update it
          if (data.result.state) {
            setOptimizationState(data.result.state);
          }
          
          // If this is a partial result, show a warning
          if (data.isPartial) {
            setWarning(`Warning: ${data.message || 'Partial results returned'}`);
          }
          
          // If we have an error but still got results, show a warning
          if (data.result.error) {
            setWarning(`Warning: ${data.result.error}`);
          }
          
          // If we have complete results, stop processing
          if (data.result.progress >= 100 && !data.isPartial) {
            setIsProcessing(false);
            setProcessingStatus("Optimization complete!");
            
            // Show success message
            showToast({
              title: "Optimization Complete",
              description: "Your CV has been successfully optimized!",
              duration: 5000,
            });
          } else {
            // Otherwise, continue polling for updates
            setIsProcessing(true);
            setProcessingStatus("Processing...");
          }
        } else {
          // If we don't have results, something went wrong
          throw new Error('No results returned');
        }
      } else {
        // If the optimization failed, show an error
        throw new Error(data.error || data.message || 'Optimization failed');
      }
    } catch (error) {
      console.error('Error optimizing CV:', error);
      
      // Set error message based on the type of error
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide more user-friendly error messages
      if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
        errorMessage = 'The AI service is currently experiencing high demand. Please try again in a few minutes.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
        errorMessage = 'The optimization process timed out. This may be due to server load or the complexity of your CV. Please try again.';
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