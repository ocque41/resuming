"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, FileText, ArrowRight, CheckCircle } from "lucide-react";
import AnalyzeCVCard from "@/components/AnalyzeCVCard.client";
import EnhancedOptimizeCVCard from "@/components/EnhancedOptimizeCVCard.client";

interface OptimizationWorkflowProps {
  cvs: string[];
}

export default function OptimizationWorkflow({ cvs }: OptimizationWorkflowProps) {
  const [activeStep, setActiveStep] = useState<"analyze" | "optimize">("analyze");
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  
  // Handle completion of analysis step
  const handleAnalysisComplete = useCallback((cvId: string) => {
    console.log("Analysis complete for CV ID:", cvId);
    setSelectedCVId(cvId);
    setActiveStep("optimize");
  }, []);
  
  // Filter CVs for optimization step (only show the selected CV)
  const getOptimizeCVs = useCallback((): string[] => {
    if (!selectedCVId) return cvs;
    
    return cvs.filter((cv: string) => {
      try {
        const parts = cv.split('|');
        return parts[1] === selectedCVId;
      } catch (error) {
        console.error("Error filtering CV:", error);
        return false;
      }
    });
  }, [cvs, selectedCVId]);
  
  // Handle manual tab change
  const handleTabChange = useCallback((value: string) => {
    if (value === "optimize" && !selectedCVId) {
      // Don't allow going to optimize step without selecting a CV
      return;
    }
    setActiveStep(value as "analyze" | "optimize");
  }, [selectedCVId]);
  
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
                activeStep === "optimize" ? "border-gray-500 text-gray-500" : "border-gray-700 text-gray-700"}
            `}>
              {activeStep === "optimize" ? <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6" /> : "1"}
            </div>
            <span className="ml-2 font-medium text-sm sm:text-base">Analyze</span>
          </div>
          
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
          
          <div 
            className={`flex items-center ${
              activeStep === "optimize" ? "text-[#B4916C]" : "text-gray-500"
            } ${!selectedCVId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={() => selectedCVId && handleTabChange("optimize")}
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
          <p className="text-sm text-gray-400 mt-2">
            Recommendation: Ensure your CV includes clear section divisions, accurate contact information, and a comprehensive skills section to maximize optimization results.
          </p>
          <EnhancedOptimizeCVCard 
            cvs={getOptimizeCVs()} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
} 