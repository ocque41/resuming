"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnalyzeCVCard from "@/components/AnalyzeCVCard.client";
import EnhancedOptimizeCVCard from "@/components/EnhancedOptimizeCVCard.client";
import EnhancedSpecificOptimizationWorkflow from "../app/components/EnhancedSpecificOptimizationWorkflow.client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

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
  
  // Check for pre-analyzed CV
  useEffect(() => {
    const checkForPreAnalyzedCV = async () => {
      // Only check when on general step with no selection yet
      if (activeStep === "general" && !selectedCVId && cvs.length > 0) {
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
            setProcessingStatus(data.step || "Processing...");
            setProcessingProgress(data.progress || 0);
            
            // Check if processing is stuck
            if (data.isStuck) {
              console.warn(`Processing appears stuck at ${data.progress}% for ${data.stuckMinutes} minutes`);
              if (data.stuckMinutes > 5) {
                // Processing is definitely stuck, show reset option
                setProcessingTooLong(true);
              }
            }
            
            // Calculate next polling interval with exponential backoff
            // More progress = longer intervals (less polling)
            let newInterval = 1000; // 1s base
            
            if (data.progress > 90) {
              newInterval = 5000; // 5s when nearly done
            } else if (data.progress > 70) {
              newInterval = 3000; // 3s when well on the way
            } else if (data.progress > 40) {
              newInterval = 2000; // 2s when making progress
            }
            
            // Never let the interval get too long - cap at 5s
            newInterval = Math.min(5000, newInterval);
            
            // Keep polling more frequently at lower progress
            
            setStatusPollingInterval(newInterval);
            timeoutId = setTimeout(checkStatus, newInterval);
          } else if (data.isComplete) {
            // Processing completed
            setIsProcessing(false);
            setProcessingStatus("Processing completed");
            setProcessingProgress(100);
            setStatusPollingEnabled(false);
          } else if (data.error) {
            // Processing encountered an error
            setIsProcessing(false);
            setError(`Processing error: ${data.error}`);
            setStatusPollingEnabled(false);
          } else {
            // Not processing or idle
            setIsProcessing(false);
            setProcessingStatus("");
            setProcessingProgress(0);
            
            // Stop polling if nothing is happening
            if (!data.processing && !data.isComplete) {
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
  
  // Add a useEffect to detect when processing is taking too long
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isProcessing && processingStatus) {
      // Set a timeout to show the reset button after 30 seconds
      timeoutId = setTimeout(() => {
        setProcessingTooLong(true);
      }, 30000); // 30 seconds
    } else {
      // Clear processing too long flag when not processing
      setProcessingTooLong(false);
    }
    
    // Clean up the timeout when the component unmounts or status changes
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isProcessing, processingStatus]);
  
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
            title: "Analysis Complete",
            description: "Your CV has been analyzed. Review results and click the Optimize tab when ready.",
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
    setActiveStep(value as "general" | "specific");
    setError(null);
  };
  
  // Add a function to handle reset
  const handleResetProcessing = async () => {
    try {
      // Reset processing state
      setProcessingStatus('selecting');
      setProcessingProgress(0);
      
      // If we have a CV ID, call the API to cancel processing
      if (selectedCVId) {
        const response = await fetch(`/api/cv/process/cancel?cvId=${selectedCVId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to cancel processing');
        }
      }
      
      // Show toast notification
      showToast({
        title: 'Processing Reset',
        description: 'CV processing has been reset. You can try again.',
        duration: 5000
      });
      
      // Clear any existing error
      setError(null);
      
      // Restart the process
      if (selectedCVId) {
        const retryResponse = await fetch(`/api/cv/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cvId: selectedCVId, forceRefresh: true }),
        });
        
        if (retryResponse.ok) {
          setStatusPollingEnabled(true);
          setStatusPollingInterval(1000);
        }
      }
    } catch (error) {
      console.error('Error resetting processing:', error);
      setError('Failed to reset processing. Please try again.');
    }
  };
  
  // Format CVs for EnhancedSpecificOptimizationWorkflow
  const formattedCvsForSpecific = cvs.map(cv => {
    const [name, id] = cv.split('|');
    return { id, name };
  });
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Processing Indicator - Stays at the top */}
      {isProcessing && (!selectedCVId || activeStep !== "general") && (
        <div className="mb-6 p-5 rounded-xl bg-[#111111] border border-[#222222] shadow-lg overflow-hidden animate-fade-in-up">
          <h3 className="text-lg font-safiro font-semibold mb-2 text-[#F9F6EE]">Processing CV</h3>
          <p className="text-sm text-[#F9F6EE]/70 mb-3 font-borna">
            {processingStatus || "Processing..."}. Might take a couple minutes, please wait for an accurate optimization.
          </p>
          <div className="relative w-full h-1.5 bg-[#222222] mt-2 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-[#B4916C] transition-all duration-300 ease-in-out" 
              style={{ width: `${processingProgress || 0}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-[#F9F6EE]/50">{processingProgress || 0}%</p>
            {processingTooLong && (
              <button
                onClick={handleResetProcessing}
                className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222222] text-[#B4916C] border border-[#333333] rounded-md flex items-center text-xs transition-colors duration-200"
              >
                <RefreshCw className="w-3 h-3 mr-1.5" />
                Taking too long? Reset
              </button>
            )}
          </div>
          {error && (
            <Button
              variant="outline"
              className="mt-3 bg-[#1a1a1a] border-[#333333] text-[#F9F6EE] hover:bg-[#222222] hover:text-[#B4916C] transition-colors duration-200"
              onClick={() => {
                if (selectedCVId) {
                  handleAnalysisComplete(selectedCVId);
                }
              }}
            >
              Retry
            </Button>
          )}
        </div>
      )}
      
      {/* Tab Navigation - Clean and modern */}
      <div className="mb-8">
        <Tabs 
          defaultValue="general" 
          onValueChange={handleTabChange} 
          value={activeStep}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-2 p-1 bg-[#111111] rounded-xl">
            <TabsTrigger 
              value="general" 
              className="rounded-lg py-2.5 font-safiro data-[state=active]:bg-[#B4916C] data-[state=active]:text-[#050505] data-[state=inactive]:text-[#F9F6EE]/70 transition-all duration-200"
            >
              General Optimization
            </TabsTrigger>
            <TabsTrigger 
              value="specific"
              className="rounded-lg py-2.5 font-safiro data-[state=active]:bg-[#B4916C] data-[state=active]:text-[#050505] data-[state=inactive]:text-[#F9F6EE]/70 transition-all duration-200"
            >
              Job-Specific
            </TabsTrigger>
          </TabsList>
          
          {/* General Tab Content */}
          <TabsContent value="general" className="space-y-6 mt-6 animate-fade-in">
            <div className="mb-6">
              <h2 className="text-2xl font-bold font-safiro text-[#F9F6EE] mb-2">Optimize Your CV</h2>
              <p className="text-[#F9F6EE]/70 font-borna">
                Upload your CV to analyze and optimize it for better ATS compatibility.
              </p>
            </div>
            
            <AnalyzeCVCard onAnalysisComplete={handleAnalysisComplete} cvs={cvs} />
            
            {selectedCVId && (
              <div className="mt-8 animate-fade-in-up">
                <EnhancedOptimizeCVCard cvs={getOptimizeCVs()} />
              </div>
            )}
          </TabsContent>
          
          {/* Specific Tab Content */}
          <TabsContent value="specific" className="space-y-6 mt-6 animate-fade-in">
            <div className="mb-6">
              <h2 className="text-2xl font-bold font-safiro text-[#F9F6EE] mb-2">Job-Specific Optimization</h2>
              <p className="text-[#F9F6EE]/70 font-borna">
                Optimize your CV for a specific job by pasting the job description. Our AI will tailor your CV to match the job requirements.
              </p>
            </div>
            
            <EnhancedSpecificOptimizationWorkflow cvs={formattedCvsForSpecific} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 