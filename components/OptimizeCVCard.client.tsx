// OptimizeCVCard.client.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComboboxPopover } from "@/components/ui/combobox";
import TemplateSelector from "./TemplateSelector";

interface OptimizeCVCardProps {
  cvs: string[];
}

export default function OptimizeCVCard({ cvs }: OptimizeCVCardProps) {
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [optimizationStatus, setOptimizationStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const [optimizedPDFBase64, setOptimizedPDFBase64] = useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const maxRetries = 20;
  const pollingInterval = 5000;

  function handleCVSelect(cv: string) {
    setSelectedCV(cv);
    setShowTemplates(true);
    setError(null);
    setOptimizationStatus("idle");
    setOptimizedPDFBase64(null);
  }

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplate(templateId);
  }

  async function handleOptimize() {
    if (!selectedCV || !selectedTemplate) {
      setError("Please select both a CV and a template.");
      return;
    }

    setError(null);
    setOptimizationStatus("pending");
    setPollingAttempts(0);
    
    try {
      const response = await fetch(`/api/optimize-cv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: selectedCV,
          templateId: selectedTemplate
        }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setOptimizationStatus("error");
      } else {
        setOptimizationStatus("processing");
        setTimeout(() => pollOptimizationStatus(selectedCV), 2000);
      }
    } catch (err: any) {
      setError("Failed to initiate optimization.");
      setOptimizationStatus("error");
    }
  }

  // Poll for updated CV status with a maximum number of retries.
  async function pollOptimizationStatus(cv: string) {
    try {
      const res = await fetch(`/api/get-cv-status?fileName=${encodeURIComponent(cv)}`);
      
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }
      
      const statusData = await res.json();
      
      if (statusData.optimized && statusData.optimizedPDFBase64) {
        setOptimizedPDFBase64(statusData.optimizedPDFBase64);
        setOptimizationStatus("complete");
        return;
      }
      
      if (statusData.error) {
        setError(`Optimization error: ${statusData.error}`);
        setOptimizationStatus("error");
        return;
      }
      
      setPollingAttempts(prev => prev + 1);
      
      if (pollingAttempts >= maxRetries) {
        setError("Optimization timed out. The process may still be running in the background. Please refresh and check again in a few moments.");
        setOptimizationStatus("error");
      } else {
        setTimeout(() => pollOptimizationStatus(cv), pollingInterval);
      }
    } catch (error: any) {
      console.error("Error polling CV status:", error);
      
      setPollingAttempts(prev => prev + 1);
      
      if (pollingAttempts >= maxRetries) {
        setError(`Polling error: ${error.message}. The optimization may still be running in the background.`);
        setOptimizationStatus("error");
      } else {
        setTimeout(() => pollOptimizationStatus(cv), pollingInterval);
      }
    }
  }

  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-[#B4916C]/10 pb-4">
        <CardTitle className="text-xl font-bold text-[#B4916C]">Optimize Your CV</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex justify-center items-center h-48 bg-gray-900 rounded-lg mb-6 overflow-hidden">
          <img
            src="/animations/leep.gif"
            alt="Animation"
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Step 1: Select CV */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2 text-gray-300">Step 1: Select your CV</h3>
          <ComboboxPopover
            label="Select CV"
            options={cvs}
            onSelect={handleCVSelect}
            accentColor="#B4916C"
            darkMode={true}
          />
        </div>
        
        {/* Step 2: Select Template (only shown after CV is selected) */}
        {showTemplates && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2 text-gray-300">Step 2: Choose a template</h3>
            <TemplateSelector 
              onSelect={handleTemplateSelect}
              selectedTemplateId={selectedTemplate || undefined}
              accentColor="#B4916C"
              darkMode={true}
            />
          </div>
        )}
        
        {/* Step 3: Optimize Button (only enabled when both CV and template are selected) */}
        {selectedCV && selectedTemplate && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2 text-gray-300">Step 3: Start optimization</h3>
            <button
              className="bg-[#B4916C] hover:bg-[#B4916C]/90 text-white px-4 py-2.5 rounded-md w-full disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
              onClick={handleOptimize}
              disabled={optimizationStatus === "pending" || optimizationStatus === "processing"}
            >
              {optimizationStatus === "pending" || optimizationStatus === "processing" 
                ? "Optimizing..." 
                : "Optimize CV"}
            </button>
          </div>
        )}
        
        {/* Status Messages */}
        {optimizationStatus === "pending" && (
          <div className="mt-4 flex items-center justify-center p-3 bg-[#B4916C]/5 border border-[#B4916C]/20 rounded-md">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#B4916C]"></div>
            <p className="ml-2 text-sm text-gray-400">
              Optimization initiated. Waiting for processing...
            </p>
          </div>
        )}
        
        {optimizationStatus === "processing" && (
          <div className="mt-4 flex items-center justify-center p-3 bg-[#B4916C]/5 border border-[#B4916C]/20 rounded-md">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#B4916C]"></div>
            <p className="ml-2 text-sm text-gray-400">
              Optimizing CV... Please wait. (Attempt {pollingAttempts + 1}/{maxRetries})
            </p>
          </div>
        )}
        
        {/* Result Display */}
        {optimizationStatus === "complete" && optimizedPDFBase64 && (
          <div className="mt-6 border border-[#B4916C]/20 rounded-lg p-4 bg-gray-900/50 shadow-sm">
            <h3 className="font-semibold mb-3 text-[#B4916C]">Optimized CV Ready</h3>
            <iframe
              className="w-full h-96 border border-gray-800 rounded-md mb-3"
              src={`data:application/pdf;base64,${optimizedPDFBase64}`}
            ></iframe>
            <a
              href={`data:application/pdf;base64,${optimizedPDFBase64}`}
              download="optimized-cv.pdf"
              className="bg-[#B4916C] hover:bg-[#B4916C]/90 text-white px-4 py-2 rounded-md inline-block mt-2 transition-colors duration-200 font-medium"
            >
              Download Optimized CV
            </a>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-md">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
