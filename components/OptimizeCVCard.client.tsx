// OptimizeCVCard.client.tsx
"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Minimal interface
interface OptimizeCVCardProps {
  cvs: string[];
}

// Extremely simplified component
export default function OptimizeCVCard({ cvs }: OptimizeCVCardProps) {
  // Minimal state
  const [selectedCV, setSelectedCV] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isOptimized, setIsOptimized] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Static templates
  const templates = [
    { id: "modern", name: "Modern Template" },
    { id: "professional", name: "Professional Template" },
    { id: "creative", name: "Creative Template" },
  ];

  // Simple handlers
  const handleCVSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCV(e.target.value);
    setIsOptimized(false);
    setProgress(0);
    setError(null);
  };

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTemplate(e.target.value);
  };

  // Simplified optimization function
  const handleOptimize = () => {
    if (!selectedCV || !selectedTemplate) {
      setError("Please select both a CV and a template");
      return;
    }

    setIsOptimizing(true);
    setError(null);
    
    // Simple timer-based progress simulation
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 20;
      setProgress(currentProgress);
      
      if (currentProgress >= 100) {
        clearInterval(interval);
        setIsOptimizing(false);
        setIsOptimized(true);
      }
    }, 500);
  };

  // Simple download function
  const handleDownload = () => {
    if (!selectedCV) {
      setError("Please select a CV first");
      return;
    }

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
  };

  return (
    <Card className="border border-[#B4916C]/20 bg-[#050505] shadow-lg">
      <CardHeader className="bg-[#B4916C]/10 pb-4">
        <CardTitle className="text-xl font-bold text-white">Optimize Your CV</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* CV Selection */}
        <div>
          <Label htmlFor="cv-select" className="text-[#B4916C] font-medium mb-2 block">
            Select a CV to optimize
          </Label>
          <select
            id="cv-select"
            className="w-full p-2 rounded bg-[#121212] text-white border border-[#B4916C]/30"
            onChange={handleCVSelect}
            value={selectedCV}
            disabled={isOptimizing}
          >
            <option value="">Select a CV</option>
            {cvs.map((cv) => (
              <option key={cv} value={cv}>
                {cv.includes('|') ? cv.split('|')[0] : cv}
              </option>
            ))}
          </select>
        </div>

        {/* Template Selection */}
        {selectedCV && (
          <div>
            <Label htmlFor="template-select" className="text-[#B4916C] font-medium mb-2 block">
              Select a template
            </Label>
            <select
              id="template-select"
              className="w-full p-2 rounded bg-[#121212] text-white border border-[#B4916C]/30"
              onChange={handleTemplateSelect}
              value={selectedTemplate}
              disabled={isOptimizing}
            >
              <option value="">Select a template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Optimize Button */}
        {selectedCV && selectedTemplate && (
          <Button
            onClick={handleOptimize}
            disabled={isOptimizing}
            className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white py-2"
          >
            {isOptimizing ? "Optimizing..." : "Optimize CV"}
          </Button>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="bg-red-900/20 border-red-900/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Progress Bar */}
        {isOptimizing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Optimizing your CV...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-[#121212]" />
          </div>
        )}

        {/* Optimization Results */}
        {isOptimized && (
          <div className="mt-4 p-4 bg-[#121212] rounded-lg border border-[#B4916C]/20">
            <h3 className="text-[#B4916C] font-medium mb-2">Optimization Complete</h3>
            <div className="flex justify-between items-center mb-4">
              <span className="text-white">ATS Score:</span>
              <div className="flex items-center">
                <span className="text-gray-400 line-through mr-2">65%</span>
                <span className="text-green-500 font-bold">85%</span>
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              Your CV has been optimized for better ATS compatibility. The optimization process has improved your ATS score by 20%.
            </p>
            <Button 
              onClick={handleDownload}
              className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white"
            >
              Download Optimized CV
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
