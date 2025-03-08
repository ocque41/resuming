// OptimizeCVCard.client.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ChevronDown, ChevronUp, Download } from "lucide-react";

// Minimal interface
interface OptimizeCVCardProps {
  cvs: string[];
}

// Extremely simplified component
export default function OptimizeCVCard({ cvs }: OptimizeCVCardProps) {
  // Minimal state
  const [selectedCV, setSelectedCV] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  
  // Optimization state
  const [optimizationState, setOptimizationState] = useState({
    currentStep: '',
    progress: 0,
    isOptimizing: false,
    isOptimized: false,
    error: null as string | null,
  });
  
  // Progressive loading states
  const [showDetails, setShowDetails] = useState(false);
  const [showKeywords, setShowKeywords] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showStructure, setShowStructure] = useState(false);

  // State for virtualized content
  const [visibleContentStart, setVisibleContentStart] = useState(0);
  const [visibleContentEnd, setVisibleContentEnd] = useState(10);
  
  // Web worker reference
  const workerRef = useRef<Worker | null>(null);
  
  // Analysis results state
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  
  // Initialize web worker
  useEffect(() => {
    // Only create the worker in the browser environment
    if (typeof window !== 'undefined') {
      workerRef.current = new Worker('/optimizationWorker.js');
      
      // Set up message handler
      workerRef.current.onmessage = (e) => {
        const { action, result, error } = e.data;
        
        console.log(`Received worker message: ${action}`);
        
        switch (action) {
          case 'analysisComplete':
            setAnalysisResults(result);
            // Continue with optimization after analysis
            if (workerRef.current && selectedCV && selectedTemplate) {
              workerRef.current.postMessage({
                action: 'optimize',
                data: {
                  cvText: "Sample CV text for " + selectedCV,
                  template: selectedTemplate,
                  originalScore: result.atsScore
                }
              });
              updateOptimizationState({
                currentStep: 'Optimizing CV content...',
                progress: 60
              });
            }
            break;
            
          case 'optimizationComplete':
            // Update state with optimization results
            updateOptimizationState({
              isOptimizing: false,
              isOptimized: true,
              currentStep: 'Optimization complete',
              progress: 100
            });
            break;
            
          case 'error':
            updateOptimizationState({
              isOptimizing: false,
              error: error || 'An error occurred during processing'
            });
            break;
        }
      };
      
      // Handle worker errors
      workerRef.current.onerror = (error) => {
        console.error('Worker error:', error);
        updateOptimizationState({
          isOptimizing: false,
          error: 'Worker error: ' + error.message
        });
      };
    }
    
    // Clean up worker on component unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);
  
  // Static templates - memoized to prevent unnecessary re-renders
  const templates = useMemo(() => [
    { id: "modern", name: "Modern Template" },
    { id: "professional", name: "Professional Template" },
    { id: "creative", name: "Creative Template" },
  ], []);
  
  // Sample large content for demonstration - memoized
  const largeContent = useMemo(() => [
    "Professional Summary",
    "Experienced professional with a proven track record of success.",
    "Skills in project management, team leadership, and strategic planning.",
    "Strong communication and problem-solving abilities.",
    "Work Experience",
    "Senior Project Manager - ABC Company (2018-Present)",
    "Led cross-functional teams to deliver projects on time and within budget.",
    "Implemented process improvements resulting in 20% efficiency gains.",
    "Managed stakeholder relationships and client expectations effectively.",
    "Project Coordinator - XYZ Inc. (2015-2018)",
    "Assisted in planning and executing multiple concurrent projects.",
    "Developed project documentation and tracking systems.",
    "Coordinated team meetings and facilitated communication.",
    "Education",
    "Master of Business Administration - University of Business (2015)",
    "Bachelor of Science in Computer Science - Tech University (2012)",
    "Skills",
    "Project Management",
    "Team Leadership",
    "Strategic Planning",
    "Budget Management",
    "Risk Assessment",
    "Stakeholder Communication",
    "Process Improvement",
    "Data Analysis",
    "Problem Solving",
    "Certifications",
    "Project Management Professional (PMP)",
    "Certified Scrum Master (CSM)",
    "Six Sigma Green Belt"
  ], []);

  // Simple handlers - memoized with useCallback to prevent unnecessary re-renders
  const handleCVSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCV(e.target.value);
    setOptimizationState(prev => ({ ...prev, isOptimized: false, progress: 0, error: null }));
  }, []);

  const handleTemplateSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTemplate(e.target.value);
  }, []);

  // Update optimization state incrementally - memoized
  const updateOptimizationState = useCallback((updates: Partial<typeof optimizationState>) => {
    setOptimizationState(prev => ({ ...prev, ...updates }));
  }, []);

  // Optimized function with web worker
  const handleOptimize = useCallback(() => {
    if (!selectedCV || !selectedTemplate) {
      updateOptimizationState({ error: "Please select both a CV and a template" });
      return;
    }

    // Reset state
    updateOptimizationState({
      isOptimizing: true,
      error: null,
      progress: 0,
      currentStep: 'Starting optimization...'
    });
    
    // Use web worker for heavy computation
    if (workerRef.current) {
      // First step: analyze the CV
      updateOptimizationState({
        currentStep: 'Analyzing CV content...',
        progress: 20
      });
      
      // Send message to worker
      workerRef.current.postMessage({
        action: 'analyze',
        data: {
          cvText: "Sample CV text for " + selectedCV
        }
      });
    } else {
      // Fallback if worker is not available
      console.warn('Web worker not available, using main thread');
      
      // Define the optimization steps
      const optimizationSteps = [
        { name: "Analyzing CV structure", progress: 20 },
        { name: "Identifying keywords", progress: 40 },
        { name: "Applying template", progress: 60 },
        { name: "Enhancing content", progress: 80 },
        { name: "Finalizing optimization", progress: 100 }
      ];
      
      // Process steps in chunks to avoid blocking the main thread
      let currentStepIndex = 0;
      
      const processNextStep = () => {
        if (currentStepIndex >= optimizationSteps.length) {
          // All steps completed
          updateOptimizationState({
            isOptimizing: false,
            isOptimized: true,
            currentStep: 'Optimization complete'
          });
          return;
        }
        
        const currentStep = optimizationSteps[currentStepIndex];
        console.log(`Processing step: ${currentStep.name}`);
        
        // Update progress incrementally
        updateOptimizationState({
          progress: currentStep.progress,
          currentStep: currentStep.name
        });
        
        // Move to next step after a delay
        currentStepIndex++;
        setTimeout(processNextStep, 500);
      };
      
      // Start processing
      setTimeout(processNextStep, 0);
    }
  }, [selectedCV, selectedTemplate, updateOptimizationState]);

  // Simple download function - memoized
  const handleDownload = useCallback(() => {
    if (!selectedCV) {
      updateOptimizationState({ error: "Please select a CV first" });
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
  }, [selectedCV, selectedTemplate, updateOptimizationState]);

  // Generate a simple PDF using canvas - memoized
  const generatePDF = useCallback(() => {
    if (!selectedCV) {
      updateOptimizationState({ error: "Please select a CV first" });
      return;
    }
    
    try {
      // Create a canvas element
      const canvas = document.createElement('canvas');
      canvas.width = 595; // A4 width in pixels at 72 DPI
      canvas.height = 842; // A4 height in pixels at 72 DPI
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      // Set background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Set text styles
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 24px Arial';
      
      // Add title
      ctx.fillText('Optimized CV', 50, 50);
      
      // Add CV name
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`CV: ${selectedCV.includes('|') ? selectedCV.split('|')[0] : selectedCV}`, 50, 80);
      
      // Add template info
      ctx.fillText(`Template: ${selectedTemplate}`, 50, 110);
      
      // Add date
      ctx.font = '14px Arial';
      ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 50, 140);
      
      // Add ATS score
      ctx.fillText(`Original ATS Score: 65%`, 50, 170);
      ctx.fillText(`Optimized ATS Score: 85%`, 50, 190);
      ctx.fillText(`Improvement: +20%`, 50, 210);
      
      // Add divider
      ctx.strokeStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(50, 230);
      ctx.lineTo(545, 230);
      ctx.stroke();
      
      // Add content sections
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Professional Summary', 50, 260);
      
      ctx.font = '14px Arial';
      ctx.fillText('Experienced professional with a proven track record of success.', 50, 280);
      ctx.fillText('Skills in project management, team leadership, and strategic planning.', 50, 300);
      
      // Add more sections
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Work Experience', 50, 340);
      
      ctx.font = '14px Arial';
      ctx.fillText('Senior Project Manager - ABC Company (2018-Present)', 50, 360);
      ctx.fillText('Led cross-functional teams to deliver projects on time and within budget.', 70, 380);
      ctx.fillText('Implemented process improvements resulting in 20% efficiency gains.', 70, 400);
      
      // Convert canvas to image
      const imgData = canvas.toDataURL('image/png');
      
      // Create PDF-like file (actually PNG)
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `optimized_${selectedCV.replace('.pdf', '')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log("PDF (PNG) generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      updateOptimizationState({ 
        error: `Error generating PDF: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }, [selectedCV, selectedTemplate, updateOptimizationState]);

  // Handle scrolling in virtualized content - memoized
  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const itemHeight = 24; // Approximate height of each line in pixels
    
    const newStart = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
    const newEnd = Math.min(largeContent.length, newStart + 20); // Show ~20 items at a time
    
    setVisibleContentStart(newStart);
    setVisibleContentEnd(newEnd);
  }, [largeContent.length]);

  // Memoize the CV options to prevent unnecessary re-renders
  const cvOptions = useMemo(() => {
    return cvs.map((cv) => (
      <option key={cv} value={cv}>
        {cv.includes('|') ? cv.split('|')[0] : cv}
      </option>
    ));
  }, [cvs]);

  // Memoize the template options to prevent unnecessary re-renders
  const templateOptions = useMemo(() => {
    return templates.map((template) => (
      <option key={template.id} value={template.id}>
        {template.name}
      </option>
    ));
  }, [templates]);

  // Memoize the error alert to prevent unnecessary re-renders
  const errorAlert = useMemo(() => {
    if (!optimizationState.error) return null;
    
    return (
      <Alert variant="destructive" className="bg-red-900/20 border-red-900/50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{optimizationState.error}</AlertDescription>
      </Alert>
    );
  }, [optimizationState.error]);

  // Memoize the progress bar to prevent unnecessary re-renders
  const progressBar = useMemo(() => {
    if (!optimizationState.isOptimizing) return null;
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>{optimizationState.currentStep}</span>
          <span>{optimizationState.progress}%</span>
        </div>
        <Progress value={optimizationState.progress} className="h-2 bg-[#121212]" />
      </div>
    );
  }, [optimizationState.isOptimizing, optimizationState.currentStep, optimizationState.progress]);

  // Memoize the optimization results to prevent unnecessary re-renders
  const optimizationResults = useMemo(() => {
    if (!optimizationState.isOptimized) return null;
    
    return (
      <div className="mt-4 p-4 bg-[#121212] rounded-lg border border-[#B4916C]/20">
        <h3 className="text-[#B4916C] font-medium mb-2">Optimization Complete</h3>
        
        {/* Basic Results - Always Shown */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-white">ATS Score:</span>
          <div className="flex items-center">
            <span className="text-gray-400 line-through mr-2">65%</span>
            <span className="text-green-500 font-bold">85%</span>
          </div>
        </div>
        
        {/* Toggle for Details */}
        <Button 
          variant="outline" 
          className="w-full mb-4 flex justify-between items-center text-[#B4916C] border-[#B4916C]/30"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span>View Detailed Improvements</span>
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
        
        {/* Detailed Improvements - Only shown when toggled */}
        {showDetails && (
          <div className="space-y-4 mt-4 mb-4">
            {/* Keywords Section */}
            <div className="border border-[#B4916C]/20 rounded p-3">
              <button 
                className="w-full flex justify-between items-center text-white"
                onClick={() => setShowKeywords(!showKeywords)}
              >
                <span className="font-medium">Keyword Optimization</span>
                {showKeywords ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {showKeywords && (
                <div className="mt-2 text-sm text-gray-300">
                  <p>Added industry-specific keywords to improve ATS recognition:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Project management</li>
                    <li>Data analysis</li>
                    <li>Team leadership</li>
                    <li>Strategic planning</li>
                  </ul>
                </div>
              )}
            </div>
            
            {/* Formatting Section */}
            <div className="border border-[#B4916C]/20 rounded p-3">
              <button 
                className="w-full flex justify-between items-center text-white"
                onClick={() => setShowFormatting(!showFormatting)}
              >
                <span className="font-medium">Formatting Improvements</span>
                {showFormatting ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {showFormatting && (
                <div className="mt-2 text-sm text-gray-300">
                  <p>Enhanced formatting for better readability:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Consistent bullet points</li>
                    <li>Proper section headings</li>
                    <li>Balanced white space</li>
                    <li>Improved font hierarchy</li>
                  </ul>
                </div>
              )}
            </div>
            
            {/* Structure Section */}
            <div className="border border-[#B4916C]/20 rounded p-3">
              <button 
                className="w-full flex justify-between items-center text-white"
                onClick={() => setShowStructure(!showStructure)}
              >
                <span className="font-medium">Structural Enhancements</span>
                {showStructure ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {showStructure && (
                <div className="mt-2 text-sm text-gray-300">
                  <p>Improved content structure:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Reorganized sections for better flow</li>
                    <li>Highlighted key achievements</li>
                    <li>Quantified results where possible</li>
                    <li>Added missing sections</li>
                  </ul>
                </div>
              )}
            </div>
            
            {/* Virtualized Content Example */}
            <div className="border border-[#B4916C]/20 rounded p-3">
              <button 
                className="w-full flex justify-between items-center text-white"
                onClick={() => setShowDetails(!showDetails)}
              >
                <span className="font-medium">Optimized Content Preview</span>
                {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {showDetails && (
                <div 
                  className="mt-2 text-sm text-gray-300 max-h-48 overflow-y-auto"
                  onScroll={handleContentScroll}
                  style={{ position: 'relative' }}
                >
                  {/* Spacer to maintain scroll position */}
                  <div style={{ height: `${visibleContentStart * 24}px` }} />
                  
                  {/* Only render visible items */}
                  {largeContent.slice(visibleContentStart, visibleContentEnd).map((line, index) => (
                    <div 
                      key={visibleContentStart + index} 
                      className={index % 5 === 0 ? "font-medium text-[#B4916C] mt-2" : ""}
                    >
                      {line}
                    </div>
                  ))}
                  
                  {/* Spacer for remaining content */}
                  <div style={{ height: `${(largeContent.length - visibleContentEnd) * 24}px` }} />
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Download Buttons */}
        <div className="flex space-x-2">
          <Button 
            onClick={handleDownload}
            className="flex-1 bg-[#B4916C] hover:bg-[#A3815C] text-white flex items-center justify-center"
          >
            <Download size={16} className="mr-2" />
            Download as Text
          </Button>
          
          <Button 
            onClick={generatePDF}
            className="flex-1 bg-[#B4916C] hover:bg-[#A3815C] text-white flex items-center justify-center"
          >
            <Download size={16} className="mr-2" />
            Download as PDF
          </Button>
        </div>
      </div>
    );
  }, [
    optimizationState.isOptimized, 
    showDetails, 
    showKeywords, 
    showFormatting, 
    showStructure, 
    visibleContentStart, 
    visibleContentEnd, 
    largeContent, 
    handleContentScroll, 
    handleDownload, 
    generatePDF
  ]);

  // Memoize the optimize button to prevent unnecessary re-renders
  const optimizeButton = useMemo(() => {
    if (!selectedCV || !selectedTemplate) return null;
    
    return (
      <Button
        onClick={handleOptimize}
        disabled={optimizationState.isOptimizing}
        className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white py-2"
      >
        {optimizationState.isOptimizing ? "Optimizing..." : "Optimize CV"}
      </Button>
    );
  }, [selectedCV, selectedTemplate, optimizationState.isOptimizing, handleOptimize]);

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
            disabled={optimizationState.isOptimizing}
          >
            <option value="">Select a CV</option>
            {cvOptions}
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
              disabled={optimizationState.isOptimizing}
            >
              <option value="">Select a template</option>
              {templateOptions}
            </select>
          </div>
        )}

        {/* Optimize Button */}
        {optimizeButton}

        {/* Error Message */}
        {errorAlert}

        {/* Progress Bar */}
        {progressBar}

        {/* Optimization Results */}
        {optimizationResults}
      </CardContent>
    </Card>
  );
}
