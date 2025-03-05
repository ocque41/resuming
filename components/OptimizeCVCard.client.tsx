// OptimizeCVCard.client.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TemplateSelector from "@/components/TemplateSelector";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowRight, Check } from "lucide-react";

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

    try {
      const response = await fetch("/api/optimize-cv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: selectedCV,
          template: selectedTemplate,
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
        setTimeout(() => pollOptimizationStatus(cv), 2000);
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
      formData.append("file", file);
      formData.append("originalCv", originalFileName);
      formData.append("template", selectedTemplate);
      
      // Send the optimized CV to be saved
      const response = await fetch("/api/cv/save-optimized", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to save optimized CV");
      }
      
      // The optimized CV is now automatically saved to the user's collection
      console.log("Optimized CV saved successfully!");
    } catch (error) {
      console.error("Error saving optimized CV:", error);
      // Don't show this error to the user since the optimization itself was successful
      // They can still download the optimized version manually
    }
  }

  async function handleDownload() {
    if (!optimizedText) return;
    
    const blob = new Blob([optimizedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    // Create filename for download
    const fileNameParts = selectedCV.split('.');
    const extension = fileNameParts.pop();
    const baseName = fileNameParts.join('.');
    a.download = `${baseName}-optimized.${extension}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg">
      <CardHeader className="bg-[#B4916C]/10 pb-4">
        <CardTitle className="text-xl font-bold text-[#B4916C]">Optimize Your CV</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex justify-center items-center mb-6">
          <div className="relative w-64 h-64 rounded-lg overflow-hidden">
            <img
              src="/Animation - 1741203848123.gif"
              alt="CV Optimization Animation"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent opacity-20"></div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select a CV to optimize
            </label>
            <select 
              className="w-full bg-[#121212] border border-[#B4916C]/30 rounded-md text-white py-2 px-3"
              onChange={(e) => handleCVSelect(e.target.value)}
              value={selectedCV}
            >
              <option value="" disabled>Select a CV</option>
              {cvs.map((cv) => (
                <option key={cv} value={cv}>{cv}</option>
              ))}
            </select>
          </div>
          
          {selectedCV && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Choose a template style
              </label>
              <TemplateSelector 
                onSelect={handleTemplateSelect} 
                selectedTemplateId={selectedTemplate}
                accentColor="#B4916C"
                darkMode={true}
              />
            </div>
          )}
          
          {optimizationError && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-md text-red-400 text-sm">
              {optimizationError}
            </div>
          )}
          
          {isOptimizing && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Optimizing your CV...</span>
                <span className="text-sm font-medium text-[#B4916C]">{optimizationProgress}%</span>
              </div>
              <div className="w-full bg-[#1A1A1A] rounded-full h-2.5">
                <div 
                  className="bg-[#B4916C] h-2.5 rounded-full" 
                  style={{ width: `${optimizationProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {!isOptimizing && !isOptimized && (
            <Button
              onClick={handleOptimize}
              disabled={!selectedCV || isOptimizing}
              className="w-full bg-[#B4916C] text-white hover:bg-[#B4916C]/90 mt-2"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  Optimize CV
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
          
          {isOptimized && (
            <div className="space-y-3">
              <div className="p-3 bg-green-900/30 border border-green-700 rounded-md text-green-400 text-sm flex items-start">
                <Check className="h-5 w-5 mr-2 flex-shrink-0" />
                <div>
                  <p className="font-medium">CV Optimized Successfully!</p>
                  <p className="mt-1">Your optimized CV has been automatically added to your collection.</p>
                </div>
              </div>
              
              <Button
                onClick={handleDownload}
                className="w-full bg-[#B4916C] text-white hover:bg-[#B4916C]/90"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Optimized CV
              </Button>
              
              <Button
                onClick={() => {
                  setSelectedCV("");
                  setIsOptimized(false);
                  setOptimizedText(null);
                }}
                variant="outline"
                className="w-full border-[#B4916C]/30 text-white hover:bg-[#B4916C]/10"
              >
                Optimize Another CV
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
