"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, FileText, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert"; 
import AnalyzeCVCard from "@/components/AnalyzeCVCard.client";
import EnhancedOptimizeCVCard from "@/components/EnhancedOptimizeCVCard.client";

interface OptimizationWorkflowProps {
  cvs: string[];
}

export default function OptimizationWorkflow({ cvs }: OptimizationWorkflowProps) {
  const [activeStep, setActiveStep] = useState<"analyze" | "optimize">("analyze");
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  const [analysisCompleted, setAnalysisCompleted] = useState<boolean>(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  
  // Check for previously analyzed CVs on component mount
  useEffect(() => {
    // If no CVs available, don't do anything
    if (!cvs || cvs.length === 0) return;
    
    // Get the first CV
    const firstCV = cvs[0];
    const parts = firstCV.split('|');
    if (parts.length < 2) return;
    
    const cvId = parts[1];
    const cvName = parts[0];
    
    // Check if this CV has been analyzed before
    const checkAnalysisStatus = async () => {
      try {
        // Call the status API to check if analysis exists
        const response = await fetch(`/api/cv/process/status?cvId=${cvId}`);
        if (!response.ok) return;
        
        const data = await response.json();
        
        // If the CV has been analyzed (has an ATS score), pre-select it
        if (data.success && data.atsScore) {
          console.log(`CV ${cvName} has existing analysis, pre-selecting for workflow`);
          setSelectedCVId(cvId);
          setSelectedCVName(cvName);
          setAnalysisCompleted(true);
        }
      } catch (error) {
        console.error("Error checking analysis status:", error);
      }
    };
    
    checkAnalysisStatus();
  }, [cvs]);
  
  // Handle completion of analysis step
  const handleAnalysisComplete = useCallback((cvId: string) => {
    console.log("Analysis complete for CV ID:", cvId);
    
    // Find the CV name from the ID
    const selectedCV = cvs.find(cv => {
      const parts = cv.split('|');
      return parts.length >= 2 && parts[1] === cvId;
    });
    
    if (selectedCV) {
      const parts = selectedCV.split('|');
      setSelectedCVName(parts[0]);
    }
    
    setSelectedCVId(cvId);
    setAnalysisCompleted(true);
    setActiveStep("optimize");
    setWorkflowError(null);
  }, [cvs]);
  
  // Filter CVs for optimization step (only show the selected CV)
  const getOptimizeCVs = useCallback((): string[] => {
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
  }, [cvs, selectedCVId]);
  
  // Handle manual tab change
  const handleTabChange = useCallback((value: string) => {
    if (value === "optimize" && !analysisCompleted) {
      setWorkflowError("Please complete the analysis step before optimizing.");
      return;
    }
    
    setActiveStep(value as "analyze" | "optimize");
    setWorkflowError(null);
  }, [analysisCompleted]);
  
  return (
    <div className="flex flex-col space-y-6 transition-opacity duration-500 opacity-100">
      <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-max">
          <div 
            className={`flex items-center ${
              activeStep === "analyze" ? "text-[#B4916C]" : "text-gray-500"
            }`}
            onClick={() => handleTabChange("analyze")}
            role="button"
            tabIndex={0}
          >
            <div className={`
              flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 
              ${activeStep === "analyze" ? "border-[#B4916C] text-[#B4916C]" : 
                analysisCompleted ? "border-green-500 text-green-500" : "border-gray-700 text-gray-700"}
            `}>
              {analysisCompleted ? <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6" /> : "1"}
            </div>
            <span className="ml-2 font-medium text-sm sm:text-base">Analyze</span>
          </div>
          
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
          
          <div 
            className={`flex items-center ${
              activeStep === "optimize" ? "text-[#B4916C]" : "text-gray-500"
            } ${!analysisCompleted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={() => analysisCompleted && handleTabChange("optimize")}
            role="button"
            tabIndex={0}
          >
            <div className={`
              flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 
              ${activeStep === "optimize" ? "border-[#B4916C] text-[#B4916C]" : "border-gray-700 text-gray-700"}
            `}>
              2
            </div>
            <span className="ml-2 font-medium text-sm sm:text-base">Optimize</span>
          </div>
        </div>
      </div>
      
      {workflowError && (
        <Alert variant="destructive" className="bg-red-950 border-red-900 text-red-200">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertDescription>{workflowError}</AlertDescription>
        </Alert>
      )}
      
      {selectedCVName && activeStep === "optimize" && (
        <div className="bg-[#1A1A1A] p-3 rounded-md border border-gray-800">
          <p className="text-sm text-gray-300">
            <span className="text-[#B4916C] font-medium">Selected CV:</span> {selectedCVName}
          </p>
        </div>
      )}
      
      <Tabs value={activeStep} onValueChange={handleTabChange}>
        <TabsContent value="analyze" className="mt-0">
          <div className="flex items-center mb-2">
            <BarChart2 className="h-4 w-4 sm:h-5 sm:w-5 text-[#B4916C] mr-2" />
            <h2 className="text-base sm:text-lg font-medium text-white">Analyze Your CV</h2>
          </div>
          <AnalyzeCVCard 
            cvs={cvs} 
            onAnalysisComplete={handleAnalysisComplete} 
          />
        </TabsContent>
        
        <TabsContent value="optimize" className="mt-0">
          <div className="flex items-center mb-2">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-[#B4916C] mr-2" />
            <h2 className="text-base sm:text-lg font-medium text-white">Optimize Your CV</h2>
          </div>
          <p className="text-sm text-gray-400 mt-2 mb-4">
            The optimization uses the results from your CV analysis to improve ATS compatibility and highlight your strengths.
          </p>
          <EnhancedOptimizeCVCard 
            cvs={getOptimizeCVs()} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
} 