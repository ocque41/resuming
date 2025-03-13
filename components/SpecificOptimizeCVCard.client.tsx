"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Download, FileText, Briefcase } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface SpecificOptimizeCVCardProps {
  cvs: string[];
}

// Modern File Dropdown component for CV selection
function ModernFileDropdown({ 
  cvs, 
  onSelect, 
  selectedCVName 
}: { 
  cvs: string[]; 
  onSelect: (cvId: string, cvName: string) => void; 
  selectedCVName?: string | null; 
}) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 bg-black border border-gray-700 hover:border-[#B4916C] text-gray-300 rounded-md flex justify-between items-center transition-colors duration-200"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedCVName || "Select a CV"}</span>
        <svg 
          className={`h-5 w-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      {open && cvs.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#121212] border border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          <ul className="py-1" role="listbox">
            {cvs.map((cv) => {
              const [name, id] = cv.split('|');
              return (
                <li 
                  key={id}
                  className="px-4 py-2 text-sm text-gray-300 hover:bg-[#1A1A1A] hover:text-white cursor-pointer"
                  role="option"
                  onClick={() => {
                    onSelect(id, name);
                    setOpen(false);
                  }}
                >
                  {name}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      {open && cvs.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#121212] border border-gray-700 rounded-md shadow-lg">
          <div className="px-4 py-2 text-sm text-gray-500">No CVs available</div>
        </div>
      )}
    </div>
  );
}

export default function SpecificOptimizeCVCard({ cvs = [] }: SpecificOptimizeCVCardProps) {
  // State for CV selection
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  
  // State for job description
  const [jobDescription, setJobDescription] = useState<string>("");
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  
  // Results states
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [jobMatchScore, setJobMatchScore] = useState<number | null>(null);
  const [keywordMatches, setKeywordMatches] = useState<string[]>([]);
  const [suggestedImprovements, setSuggestedImprovements] = useState<string[]>([]);
  
  // Handle CV selection
  const handleSelectCV = (cvId: string, cvName: string) => {
    setSelectedCVId(cvId);
    setSelectedCVName(cvName);
    setIsProcessed(false);
    setOptimizedText(null);
    setJobMatchScore(null);
    setKeywordMatches([]);
    setSuggestedImprovements([]);
  };
  
  // Process the CV for job matching
  const processCV = async (forceRefresh: boolean = false) => {
    if (!selectedCVId || !jobDescription.trim()) {
      setError("Please select a CV and provide a job description");
      return;
    }
    
    setError(null);
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      // Call the job-specific optimization API
      const response = await fetch('/api/cv/job-optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          jobDescription: jobDescription,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to optimize CV');
      }
      
      const data = await response.json();
      
      // Update state with optimization results
      setOptimizedText(data.optimizedText);
      setJobMatchScore(data.jobMatchScore);
      setKeywordMatches(data.keywordMatches);
      setSuggestedImprovements(data.suggestedImprovements);
      setIsProcessed(true);
      setProcessingProgress(100);
      
    } catch (error) {
      console.error("Error processing CV:", error);
      setError(error instanceof Error ? error.message : "Failed to process CV. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle DOCX download
  const handleDownloadDocx = async () => {
    if (!optimizedText) return;
    
    try {
      const response = await fetch('/api/cv/generate-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          optimizedText: optimizedText,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate DOCX file');
      }
      
      const data = await response.json();
      
      // Convert base64 to blob
      const docxBlob = new Blob(
        [Buffer.from(data.docxBase64, 'base64')],
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
      );
      
      // Create download link
      const downloadUrl = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${selectedCVName}-job-optimized.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
    } catch (error) {
      console.error('Error downloading DOCX:', error);
      setError(error instanceof Error ? error.message : 'Failed to download DOCX');
    }
  };

  return (
    <Card className="w-full shadow-lg border border-[#B4916C]/20 bg-[#121212]">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-[#B4916C] flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          <span>Job-Specific Optimization</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Optimize your CV for a specific job position
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 md:p-6">
        {/* CV Selection */}
        <div className="mb-6">
          <div className="mb-2 text-gray-400 text-sm">Select a CV to optimize</div>
          <ModernFileDropdown 
            cvs={cvs} 
            onSelect={handleSelectCV} 
            selectedCVName={selectedCVName}
          />
        </div>
        
        {/* Job Description Input */}
        <div className="mb-6">
          <div className="mb-2 text-gray-400 text-sm">Paste the job description</div>
          <Textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            className="min-h-[200px] bg-black border-gray-700 focus:border-[#B4916C] text-white"
          />
        </div>
        
        {/* Error Display */}
        {error && (
          <Alert className="mb-6 bg-red-950 border-red-900 text-red-200">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Process Button */}
        {!isProcessed && !isProcessing && (
          <Button 
            onClick={() => processCV(false)} 
            disabled={!selectedCVId || !jobDescription.trim() || isProcessing}
            className="w-full bg-[#B4916C] hover:bg-[#A27D59] text-black font-medium mb-4"
          >
            Optimize for Job
          </Button>
        )}
        
        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mb-4 p-4 border rounded-md bg-[#050505]">
            <h3 className="text-lg font-semibold">Processing CV</h3>
            <p className="text-sm text-muted-foreground">
              {processingStatus || "Analyzing job requirements..."}
            </p>
            <div className="w-full h-2 bg-secondary mt-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-in-out" 
                style={{ width: `${processingProgress}%` }}
              />
            </div>
            <p className="text-sm mt-1">{processingProgress}%</p>
          </div>
        )}
        
        {/* Results Section */}
        {isProcessed && optimizedText && (
          <div className="mt-6">
            <div className="space-y-6">
              {/* Job Match Score */}
              <div className="p-4 bg-[#050505] rounded-lg border border-gray-800">
                <h4 className="text-lg font-semibold mb-2">Job Match Score</h4>
                <div className="flex items-center gap-2">
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#B4916C] transition-all duration-300 ease-in-out" 
                      style={{ width: `${jobMatchScore}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{Math.round(jobMatchScore || 0)}%</span>
                </div>
              </div>
              
              {/* Keyword Matches */}
              {keywordMatches.length > 0 && (
                <div className="p-4 bg-[#050505] rounded-lg border border-gray-800">
                  <h4 className="text-lg font-semibold mb-2">Matched Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {keywordMatches.map((keyword, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-[#B4916C]/10 border border-[#B4916C]/20 rounded text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Suggested Improvements */}
              {suggestedImprovements.length > 0 && (
                <div className="p-4 bg-[#050505] rounded-lg border border-gray-800">
                  <h4 className="text-lg font-semibold mb-2">Suggested Improvements</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {suggestedImprovements.map((improvement, index) => (
                      <li key={index} className="text-sm text-gray-300">{improvement}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Optimized Content */}
              <div className="p-4 bg-[#050505] rounded-lg border border-gray-800">
                <h4 className="text-lg font-semibold mb-2">Optimized Content</h4>
                <div className="whitespace-pre-wrap text-sm text-gray-300 max-h-96 overflow-y-auto">
                  {optimizedText}
                </div>
              </div>
              
              {/* Download Button */}
              <Button
                onClick={handleDownloadDocx}
                className="w-full bg-[#121212] hover:bg-gray-800 text-white border border-gray-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Download as DOCX
              </Button>
              
              {/* Reset Button */}
              <Button
                onClick={() => {
                  setIsProcessed(false);
                  setOptimizedText(null);
                  setJobMatchScore(null);
                  setKeywordMatches([]);
                  setSuggestedImprovements([]);
                }}
                className="w-full bg-transparent hover:bg-gray-800 text-gray-400 border border-gray-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Start Over
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 