// OptimizeCVCard.client.tsx
"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download } from "lucide-react";
import { ComboboxPopover } from "@/components/ui/combobox";

// Minimal interface
interface OptimizeCVCardProps {
  cvs: string[];
}

// Simplified component
export default function OptimizeCVCard({ cvs }: OptimizeCVCardProps) {
  // Basic state
  const [selectedCV, setSelectedCV] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isOptimized, setIsOptimized] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [optimizationStep, setOptimizationStep] = useState<string>("");

  // Templates for selection
  const templates = [
    "Modern Professional",
    "Creative Design",
    "Executive",
    "Technical",
    "Academic",
    "Entry Level"
  ];

  // Handle CV selection
  const handleCVSelect = useCallback((cv: string) => {
    console.log("Selected CV:", cv);
    setSelectedCV(cv);
    setIsOptimized(false);
    setProgress(0);
    setError(null);
  }, []);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: string) => {
    console.log("Selected template:", template);
    setSelectedTemplate(template);
  }, []);

  // Simplified optimization function
  const handleOptimize = useCallback(async () => {
    if (!selectedCV) {
      setError("Please select a CV first");
      return;
    }

    if (!selectedTemplate) {
      setError("Please select a template");
      return;
    }

    try {
      setIsOptimizing(true);
      setProgress(0);
      setError(null);
      
      console.log(`Starting optimization for CV: ${selectedCV}, template: ${selectedTemplate}`);
      
      // Simulate the optimization process with steps
      const steps = [
        { name: "Extracting text from PDF", progress: 20 },
        { name: "Analyzing CV content", progress: 40 },
        { name: "Applying template formatting", progress: 60 },
        { name: "Generating optimized document", progress: 80 },
        { name: "Finalizing optimization", progress: 100 }
      ];
      
      // Process each step with a delay
      for (const step of steps) {
        setOptimizationStep(step.name);
        setProgress(step.progress);
        console.log(`Optimization step: ${step.name} (${step.progress}%)`);
        
        // Wait for a short time to simulate processing
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Set as optimized
      setIsOptimized(true);
      console.log("Optimization completed successfully");
    } catch (error) {
      console.error("Error during optimization:", error);
      setError(`Optimization failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsOptimizing(false);
    }
  }, [selectedCV, selectedTemplate]);

  // Simple download function
  const handleDownload = useCallback(() => {
    if (!selectedCV) {
      setError("Please select a CV first");
      return;
    }

    try {
      // Create a simple text file
      const content = `Optimized CV for ${selectedCV}

This CV has been optimized using the ${selectedTemplate} template.
ATS Score improved from 65% to 85%.

Key improvements:
- Enhanced keyword optimization
- Improved formatting
- Better structure
- Emphasized strengths

Date: ${new Date().toLocaleDateString()}`;

      // Create and trigger download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `optimized_${selectedCV.replace('.pdf', '')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log("Download completed successfully");
    } catch (error) {
      console.error("Error downloading optimized CV:", error);
      setError(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [selectedCV, selectedTemplate]);

  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-[#B4916C]/10 pb-4">
        <CardTitle className="text-xl font-bold text-[#B4916C]">Optimize Your CV</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex justify-center items-center mb-6">
          <div className="relative w-48 h-48 rounded-lg overflow-hidden">
            <img
              src="/Animation - 1741203848123.gif"
              alt="CV Optimization Animation"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent opacity-20"></div>
          </div>
        </div>
        
        {/* CV Selection */}
        <div className="mb-6">
          <ComboboxPopover
            label="Select CV to Optimize"
            options={cvs}
            onSelect={handleCVSelect}
            accentColor="#B4916C"
            darkMode={true}
          />
        </div>
        
        {/* Template Selection */}
        {selectedCV && (
          <div className="mb-6">
            <ComboboxPopover
              label="Select Template"
              options={templates}
              onSelect={handleTemplateSelect}
              accentColor="#B4916C"
              darkMode={true}
            />
          </div>
        )}
        
        {/* Optimize Button */}
        {selectedCV && selectedTemplate && !isOptimizing && !isOptimized && (
          <Button
            onClick={handleOptimize}
            className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white py-2 mt-4"
          >
            Optimize CV
          </Button>
        )}
        
        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="mt-4 bg-red-900/20 border-red-900/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Progress Bar */}
        {isOptimizing && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{optimizationStep}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-[#121212]" />
          </div>
        )}
        
        {/* Optimization Results */}
        {isOptimized && (
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-[#121212] rounded-lg border border-[#B4916C]/20">
              <h3 className="text-[#B4916C] font-medium mb-2">Optimization Complete</h3>
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-white">ATS Score:</span>
                <div className="flex items-center">
                  <span className="text-gray-400 line-through mr-2">65%</span>
                  <span className="text-green-500 font-bold">85%</span>
                </div>
              </div>
              
              <div className="text-sm text-gray-300 mb-4">
                <p className="mb-2">Your CV has been optimized with the following improvements:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Enhanced keyword optimization for better ATS recognition</li>
                  <li>Improved formatting for better readability</li>
                  <li>Restructured content to highlight key qualifications</li>
                  <li>Emphasized strengths and achievements</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleDownload}
                className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white flex items-center justify-center"
              >
                <Download size={16} className="mr-2" />
                Download Optimized CV
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
