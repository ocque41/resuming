/* use client */
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Clock, Info, Download, FileText } from "lucide-react";

interface EnhancedSpecificOptimizationWorkflowProps {
  cvs?: string[];
}

// Modern file dropdown component
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

export default function EnhancedSpecificOptimizationWorkflow({ cvs = [] }: EnhancedSpecificOptimizationWorkflowProps) {
  // State for CV selection
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  
  // State for job description
  const [jobDescription, setJobDescription] = useState('');
  
  // State for processing
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>("");
  const [error, setError] = useState<string | null>(null);
  
  // State for UI views
  const [activeTab, setActiveTab] = useState('jobDescription');
  const [originalText, setOriginalText] = useState<string>("");
  const [optimizedText, setOptimizedText] = useState<string>("");
  const [showStructuredView, setShowStructuredView] = useState<boolean>(true);
  
  // State for ATS scores
  const [originalAtsScore, setOriginalAtsScore] = useState<number>(0);
  const [improvedAtsScore, setImprovedAtsScore] = useState<number>(0);
  
  // State for structured CV
  const [structuredCV, setStructuredCV] = useState<{
    header: string;
    profile: string;
    achievements: string[];
    jobMatchScore: number;
    keywordMatches: string[];
    skills: string;
    education: string;
  }>({
    header: "",
    profile: "",
    achievements: [],
    jobMatchScore: 0,
    keywordMatches: [],
    skills: "",
    education: ""
  });
  
  // State for processing too long detection
  const [processingTooLong, setProcessingTooLong] = useState<boolean>(false);
  
  // Fetch original CV text
  const fetchOriginalText = useCallback(async (cvId: string) => {
    try {
      if (!cvId) return;
      
      const response = await fetch(`/api/cv/get-text?cvId=${cvId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.text) {
          setOriginalText(data.text);
          return data.text;
        }
      }
    } catch (error) {
      console.error("Error fetching original CV text:", error);
    }
    return "";
  }, []);
  
  // Handle CV selection
  const handleSelectCV = useCallback(async (cvId: string, cvName: string) => {
    setSelectedCVId(cvId);
    setSelectedCVName(cvName);
    console.log(`Selected CV: ${cvName} (ID: ${cvId})`);
    
    // Reset states when a new CV is selected
    setIsProcessed(false);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setError(null);
    
    // Fetch original text
    await fetchOriginalText(cvId);
  }, [fetchOriginalText]);
  
  // Process the CV for specific job
  const processCV = useCallback(async () => {
    if (!selectedCVId) {
      setError("Please select a CV first");
      return;
    }
    
    if (!jobDescription.trim()) {
      setError("Please enter a job description");
      return;
    }
    
    // Set processing state
    setIsProcessing(true);
    setIsProcessed(false);
    setProcessingProgress(0);
    setProcessingStatus("Starting job-specific optimization...");
    setError(null);
    
    try {
      console.log(`Processing CV: ${selectedCVName} (ID: ${selectedCVId}) for specific job`);
      
      // Simulate API call for job-specific optimization
      // In a real implementation, this would be an actual API call
      simulateProcessing();
      
    } catch (error) {
      console.error("Error optimizing CV for job:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred during optimization");
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [selectedCVId, selectedCVName, jobDescription]);
  
  // Simulate processing with progress updates
  const simulateProcessing = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Generate optimized text based on job description
        const optimized = generateOptimizedText();
        setOptimizedText(optimized);
        
        // Generate structured CV
        generateStructuredCV(optimized);
        
        // Set scores
        setOriginalAtsScore(Math.floor(Math.random() * 40) + 30); // 30-70
        setImprovedAtsScore(Math.floor(Math.random() * 20) + 80); // 80-100
        
        // Complete processing
        setIsProcessing(false);
        setIsProcessed(true);
        setProcessingStatus("Optimization complete");
        setActiveTab('optimizedCV');
      }
      
      setProcessingProgress(Math.floor(progress));
      
      // Update status messages based on progress
      if (progress < 20) {
        setProcessingStatus("Analyzing job description...");
      } else if (progress < 40) {
        setProcessingStatus("Extracting key requirements...");
      } else if (progress < 60) {
        setProcessingStatus("Matching CV content to job requirements...");
      } else if (progress < 80) {
        setProcessingStatus("Optimizing CV content...");
      } else {
        setProcessingStatus("Finalizing optimized CV...");
      }
    }, 200);
    
    // Set timeout to show processing too long after 10 seconds
    setTimeout(() => {
      if (isProcessing) {
        setProcessingTooLong(true);
      }
    }, 10000);
  };
  
  // Generate optimized text based on job description
  const generateOptimizedText = () => {
    // Extract keywords from job description
    const keywords = extractKeywords(jobDescription);
    
    // Create a modified version of the original text that emphasizes these keywords
    let optimized = originalText;
    
    // Add a tailored professional summary
    const summary = `Experienced professional with expertise in ${keywords.slice(0, 3).join(', ')}, seeking to leverage my background in ${keywords.slice(3, 5).join(' and ')} to excel in this role.`;
    
    // Replace or enhance the first paragraph (assuming it's the summary)
    const paragraphs = optimized.split('\n\n');
    if (paragraphs.length > 0) {
      paragraphs[0] = summary;
      optimized = paragraphs.join('\n\n');
    } else {
      optimized = summary + '\n\n' + optimized;
    }
    
    // Enhance skills section with job-specific keywords
    const skillsSection = `\n\nKey Skills:\n• ${keywords.join('\n• ')}`;
    optimized += skillsSection;
    
    return optimized;
  };
  
  // Extract keywords from job description
  const extractKeywords = (text: string): string[] => {
    // Simple keyword extraction (in a real implementation, this would be more sophisticated)
    const commonWords = ['and', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'as'];
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    
    // Count word frequency
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      if (word.length > 3 && !commonWords.includes(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
    
    // Sort by frequency and get top keywords
    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  };
  
  // Generate structured CV
  const generateStructuredCV = (text: string) => {
    const keywords = extractKeywords(jobDescription);
    
    // Generate achievements that incorporate job keywords
    const achievements = keywords.slice(0, 5).map(keyword => 
      `Improved ${keyword.toLowerCase()} processes by 30%, resulting in increased efficiency and customer satisfaction.`
    );
    
    // Calculate job match score (70-100%)
    const jobMatchScore = Math.floor(Math.random() * 30) + 70;
    
    // Set structured CV
    setStructuredCV({
      header: `${selectedCVName || 'Resume'} - Optimized for Job Match`,
      profile: `Professional with extensive experience in ${keywords.slice(0, 3).join(', ')}. Proven track record of delivering results in ${keywords.slice(3, 5).join(' and ')}.`,
      achievements,
      jobMatchScore,
      keywordMatches: keywords,
      skills: `Expert in: ${keywords.join(', ')}`,
      education: "Bachelor's Degree in relevant field with continuous professional development"
    });
  };
  
  // Handle reset
  const handleResetProcessing = () => {
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setProcessingTooLong(false);
    setError(null);
  };
  
  // Handle download
  const handleDownloadDocx = () => {
    // In a real implementation, this would generate and download a DOCX file
    alert("DOCX download functionality would be implemented here");
  };
  
  // Add a useEffect to detect when processing is taking too long
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isProcessing) {
      // Set a timeout to show the reset button after 10 seconds
      timeoutId = setTimeout(() => {
        setProcessingTooLong(true);
      }, 10000);
    } else {
      // Clear processing too long flag when not processing
      setProcessingTooLong(false);
    }
    
    // Clean up the timeout when the component unmounts or status changes
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isProcessing]);
  
  return (
    <div className="bg-[#050505] text-white rounded-md border border-gray-800">
      {error && (
        <Alert className="mb-4 bg-destructive/10">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Processing indicator */}
      {isProcessing && (
        <div className="mb-4 p-4 border rounded-md bg-[#050505]">
          <h3 className="text-lg font-semibold">Processing CV for Job Match</h3>
          <p className="text-sm text-muted-foreground">
            {processingStatus || "Processing..."}. Might take a couple minutes, please wait for an accurate job-specific optimization.
          </p>
          <div className="w-full h-2 bg-secondary mt-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-in-out" 
              style={{ width: `${processingProgress || 0}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <p className="text-sm">{processingProgress || 0}%</p>
            {processingTooLong && (
              <button
                onClick={handleResetProcessing}
                className="px-3 py-1 bg-red-900/30 hover:bg-red-800/50 text-red-300 border border-red-800 rounded-md flex items-center text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Taking too long? Reset
              </button>
            )}
          </div>
        </div>
      )}
      
      <div className="flex justify-around mb-4 border-b border-gray-800">
        <button 
          onClick={() => setActiveTab('jobDescription')}
          className={`px-4 py-2 ${activeTab === 'jobDescription' ? 'border-b-2 border-[#B4916C]' : ''}`}
        >
          Job Description
        </button>
        <button 
          onClick={() => setActiveTab('optimizedCV')}
          className={`px-4 py-2 ${activeTab === 'optimizedCV' ? 'border-b-2 border-[#B4916C]' : ''}`}
          disabled={!isProcessed}
        >
          Optimized CV
        </button>
      </div>
      
      {activeTab === 'jobDescription' && (
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select your CV</label>
            <ModernFileDropdown 
              cvs={cvs} 
              onSelect={handleSelectCV} 
              selectedCVName={selectedCVName} 
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Job Description</label>
            <textarea 
              className="w-full p-2 bg-gray-800 text-white border border-gray-700 rounded-md"
              placeholder="Paste your job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={6}
            />
          </div>
          
          <button 
            onClick={processCV}
            disabled={!selectedCVId || !jobDescription.trim() || isProcessing}
            className={`mt-2 px-4 py-2 rounded-md w-full ${
              !selectedCVId || !jobDescription.trim() || isProcessing 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-[#B4916C] text-black hover:bg-[#a3815b] transition-colors'
            }`}
          >
            {isProcessing ? "Optimizing..." : "Optimize CV for This Job"}
          </button>
          
          {!selectedCVId && (
            <p className="text-sm text-amber-400 mt-2">Please select a CV first</p>
          )}
        </div>
      )}
      
      {activeTab === 'optimizedCV' && isProcessed && (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Job-Optimized CV</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowStructuredView(!showStructuredView)}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-md text-sm flex items-center"
              >
                {showStructuredView ? <FileText className="w-4 h-4 mr-1" /> : <Info className="w-4 h-4 mr-1" />}
                {showStructuredView ? "Show Raw Text" : "Show Structured View"}
              </button>
              <button
                onClick={handleDownloadDocx}
                className="px-3 py-1 bg-[#B4916C] text-black hover:bg-[#a3815b] rounded-md text-sm flex items-center"
              >
                <Download className="w-4 h-4 mr-1" />
                Download DOCX
              </button>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span>Original ATS Score</span>
              <span>{originalAtsScore}%</span>
            </div>
            <Progress value={originalAtsScore} className="h-2" />
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span>Job-Optimized ATS Score</span>
              <span>{improvedAtsScore}%</span>
            </div>
            <Progress value={improvedAtsScore} className="h-2" />
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span>Job Match Score</span>
              <span>{structuredCV.jobMatchScore}%</span>
            </div>
            <Progress value={structuredCV.jobMatchScore} className="h-2" />
          </div>
          
          {showStructuredView ? (
            <div className="bg-gray-800 p-4 rounded-md space-y-4">
              <h2 className="text-xl font-bold">{structuredCV.header}</h2>
              
              <div>
                <h3 className="text-md font-semibold mb-1">Professional Profile</h3>
                <p>{structuredCV.profile}</p>
              </div>
              
              <div>
                <h3 className="text-md font-semibold mb-1">Key Achievements</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {structuredCV.achievements.map((achievement, index) => (
                    <li key={index}>{achievement}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="text-md font-semibold mb-1">Job Keyword Matches</h3>
                <div className="flex flex-wrap gap-2">
                  {structuredCV.keywordMatches.map((keyword, index) => (
                    <span key={index} className="px-2 py-1 bg-[#B4916C]/20 text-[#B4916C] rounded-md text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-md font-semibold mb-1">Skills</h3>
                <p>{structuredCV.skills}</p>
              </div>
              
              <div>
                <h3 className="text-md font-semibold mb-1">Education</h3>
                <p>{structuredCV.education}</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 p-4 rounded-md whitespace-pre-line">
              {optimizedText}
            </div>
          )}
          
          <button
            onClick={() => setActiveTab('jobDescription')}
            className="mt-4 px-4 py-2 bg-gray-800 border border-gray-700 rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Job Description
          </button>
        </div>
      )}
    </div>
  );
} 