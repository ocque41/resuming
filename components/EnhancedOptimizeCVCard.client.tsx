"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Clock, Info, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cacheDocument, getCachedDocument, clearCachedDocument, getCacheAge } from "@/lib/cache/documentCache";
import { toast } from "@/hooks/use-toast";

// Modern SimpleFileDropdown component
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
        className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 hover:border-[#B4916C] text-gray-300 rounded-md flex justify-between items-center transition-colors duration-200"
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
        <div className="absolute z-10 w-full mt-1 bg-[#0A0A0A] border border-gray-800 rounded-md shadow-lg max-h-60 overflow-auto">
          <ul className="py-1" role="listbox">
            {cvs.map((cv) => {
              const [name, id] = cv.split('|');
              return (
                <li 
                  key={id}
                  className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer"
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
        <div className="absolute z-10 w-full mt-1 bg-[#0A0A0A] border border-gray-800 rounded-md shadow-lg">
          <div className="px-4 py-2 text-sm text-gray-500">No CVs available</div>
        </div>
      )}
    </div>
  );
}

// Interface for the component props
interface EnhancedOptimizeCVCardProps {
  cvs?: string[]; // Format: "filename|id"
}

// Component implementation
export default function EnhancedOptimizeCVCard({ cvs = [] }: EnhancedOptimizeCVCardProps) {
  // State for CV selection
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  
  // State for processing
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>("");
  const [error, setError] = useState<string | null>(null);
  
  // State for ATS scores
  const [originalAtsScore, setOriginalAtsScore] = useState<number>(0);
  const [improvedAtsScore, setImprovedAtsScore] = useState<number>(0);
  
  // State for UI views
  const [originalText, setOriginalText] = useState<string>("");
  const [optimizedText, setOptimizedText] = useState<string>("");
  const [processedText, setProcessedText] = useState<string>("");
  const [structuredCV, setStructuredCV] = useState<{
    header: string;
    profile: string;
    achievements: string[];
    goals: string[];
    skills: string;
    languages: string;
    education: string;
  }>({
    header: "",
    profile: "",
    achievements: [],
    goals: [],
    skills: "",
    languages: "",
    education: ""
  });
  const [showStructuredView, setShowStructuredView] = useState<boolean>(true);
  const [improvements, setImprovements] = useState<string[]>([]);
  
  // State for DOCX download
  const [isDownloadingDocx, setIsDownloadingDocx] = useState<boolean>(false);
  
  // State for status polling
  const [statusPollingEnabled, setStatusPollingEnabled] = useState<boolean>(false);
  const [statusPollingInterval, setStatusPollingInterval] = useState<number>(1000);
  
  // State for processing too long detection
  const [processingTooLong, setProcessingTooLong] = useState<boolean>(false);
  
  // Auto-select first CV if available
  useEffect(() => {
    if (cvs.length > 0 && !selectedCVId) {
      const [name, id] = cvs[0].split('|');
      handleSelectCV(id, name);
    }
  }, [cvs]);
  
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
  
  // Handle CV selection with fetching original text
  const handleSelectCV = useCallback(async (cvId: string, cvName: string) => {
    setSelectedCVId(cvId);
    setSelectedCVName(cvName);
    setSelectedCV(`${cvName}|${cvId}`);
    console.log(`Selected CV: ${cvName} (ID: ${cvId})`);
    
    // Reset states when a new CV is selected
    setIsProcessed(false);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setError(null);
    
    // Fetch original text
    await fetchOriginalText(cvId);
    
    // Start polling for status
    setStatusPollingEnabled(true);
    setStatusPollingInterval(1000);
  }, [fetchOriginalText]);
  
  // Process the CV
  const processCV = useCallback(async (forceRefresh: boolean = false) => {
    if (!selectedCVId) {
      setError("Please select a CV first");
      return;
    }
    
    // Set processing state
    setIsProcessing(true);
    setIsProcessed(false);
    setProcessingProgress(0);
    setProcessingStatus("Starting optimization...");
    setError(null);
    
    try {
      console.log(`Processing CV: ${selectedCVName} (ID: ${selectedCVId}), force refresh: ${forceRefresh}`);
      
      // Start the optimization process
      const response = await fetch('/api/cv/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          forceRefresh: forceRefresh
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to optimize CV: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Optimization failed");
      }
      
      // Start polling for status
      setStatusPollingEnabled(true);
      setStatusPollingInterval(1000);
      
    } catch (error) {
      console.error("Error optimizing CV:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred during optimization");
      setIsProcessing(false);
      setProcessingProgress(0);
      setStatusPollingEnabled(false);
    }
  }, [selectedCVId, selectedCVName]);
  
  // Handle reset
  const handleResetProcessing = useCallback(async () => {
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
  }, [selectedCVId]);
  
  // Process optimized text to remove edit words and asterisks
  const processOptimizedText = (text: string) => {
    if (!text) return "";
    
    // Remove edit words and asterisks
    const editWords = ["Developed", "Achieved", "Implemented", "Created", "Managed", "Led", "Designed", "Built", "Executed", "Improved"];
    let processed = text;
    
    // Remove asterisks
    processed = processed.replace(/\*/g, "");
    
    // Remove edit words
    editWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      processed = processed.replace(regex, "");
    });
    
    return processed;
  };
  
  // Structure the CV into sections
  const structureCV = (text: string) => {
    if (!text) {
      const emptyStructure = {
        header: "",
        profile: "",
        achievements: [] as string[],
        goals: [] as string[],
        skills: "",
        languages: "",
        education: ""
      };
      setStructuredCV(emptyStructure);
      return emptyStructure;
    }
    
    const sections = {
      header: "",
      profile: "",
      achievements: [] as string[],
      goals: [] as string[],
      skills: "",
      languages: "",
      education: ""
    };
    
    const improvements: string[] = [];
    
    // Split text into lines
    const lines = text.split('\n').filter(line => line.trim() !== "");
    
    // Extract header (first 2-3 lines typically contain name and contact info)
    if (lines.length > 0) {
      sections.header = lines.slice(0, Math.min(3, lines.length)).join('\n');
    }
    
    // Process remaining lines to identify sections
    let currentSection = "";
    let sectionContent: string[] = [];
    
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for section headers
      const isProfileSection = /^(PROFILE|SUMMARY|ABOUT ME)/i.test(line);
      const isAchievementsSection = /^(ACHIEVEMENTS|ACCOMPLISHMENTS)/i.test(line);
      const isGoalsSection = /^(GOALS|OBJECTIVES)/i.test(line);
      const isSkillsSection = /^(SKILLS|TECHNICAL SKILLS|COMPETENCIES)/i.test(line);
      const isLanguagesSection = /^(LANGUAGES|LANGUAGE PROFICIENCY)/i.test(line);
      const isEducationSection = /^(EDUCATION|ACADEMIC BACKGROUND)/i.test(line);
      
      if (isProfileSection) {
        currentSection = "profile";
        sectionContent = [];
        continue;
      } else if (isAchievementsSection) {
        currentSection = "achievements";
        sectionContent = [];
        continue;
      } else if (isGoalsSection) {
        currentSection = "goals";
        sectionContent = [];
        continue;
      } else if (isSkillsSection) {
        currentSection = "skills";
        sectionContent = [];
        continue;
      } else if (isLanguagesSection) {
        currentSection = "languages";
        sectionContent = [];
        continue;
      } else if (isEducationSection) {
        currentSection = "education";
        sectionContent = [];
        continue;
      } else if (/^[A-Z\s]{2,}:?$/i.test(line) || /^[A-Z\s]{2,}$/i.test(line)) {
        // This looks like a new section header we don't explicitly handle
        currentSection = "";
        continue;
      }
      
      // Add content to current section
      if (currentSection) {
        if (currentSection === "achievements" || currentSection === "goals") {
          // For achievements and goals, each line is a separate item
          if (line.trim()) {
            // Check if line starts with a bullet point, if not add one
            const cleanLine = line.replace(/^[-•*]\s*/, "").trim();
            if (cleanLine) {
              if (currentSection === "achievements") {
                sections.achievements.push(cleanLine);
              } else {
                sections.goals.push(cleanLine);
              }
            }
          }
        } else {
          // For other sections, accumulate text
          sectionContent.push(line);
          
          if (currentSection === "profile") {
            sections.profile = sectionContent.join(' ');
          } else if (currentSection === "skills") {
            sections.skills = sectionContent.join('\n');
          } else if (currentSection === "languages") {
            sections.languages = sectionContent.join('\n');
          } else if (currentSection === "education") {
            sections.education = sectionContent.join('\n');
          }
        }
      } else if (!currentSection && i >= 3) {
        // If we haven't identified a section yet but we're past the header,
        // assume it's part of the profile
        if (!sections.profile) {
          sections.profile = line;
        } else {
          sections.profile += ' ' + line;
        }
      }
    }
    
    // Generate default sections if missing
    if (!sections.profile) {
      sections.profile = "Professional profile information not provided.";
      improvements.push("Add a professional profile summary");
    }
    
    if (sections.achievements.length === 0) {
      improvements.push("Add quantifiable achievements with metrics");
    }
    
    if (sections.goals.length === 0) {
      improvements.push("Add clear career goals and objectives");
    }
    
    if (!sections.skills) {
      sections.skills = "Skills information not provided.";
      improvements.push("Add relevant skills for your target position");
    }
    
    setStructuredCV(sections);
    setImprovements(improvements);
    
    return sections;
  };
  
  // Format structured CV as text
  const formatStructuredCV = () => {
    if (!structuredCV) return "";
    
    let formattedText = "";
    
    // Header
    if (structuredCV.header) {
      formattedText += structuredCV.header + "\n\n";
    }
    
    // Profile
    if (structuredCV.profile) {
      formattedText += "PROFILE\n" + structuredCV.profile + "\n\n";
    }
    
    // Achievements
    if (structuredCV.achievements.length > 0) {
      formattedText += "ACHIEVEMENTS\n";
      structuredCV.achievements.forEach(achievement => {
        formattedText += "• " + achievement + "\n";
      });
      formattedText += "\n";
    }
    
    // Goals
    if (structuredCV.goals.length > 0) {
      formattedText += "GOALS\n";
      structuredCV.goals.forEach(goal => {
        formattedText += "• " + goal + "\n";
      });
      formattedText += "\n";
    }
    
    // Skills
    if (structuredCV.skills) {
      formattedText += "SKILLS\n" + structuredCV.skills + "\n\n";
    }
    
    // Languages
    if (structuredCV.languages) {
      formattedText += "LANGUAGES\n" + structuredCV.languages + "\n\n";
    }
    
    // Education
    if (structuredCV.education) {
      formattedText += "EDUCATION\n" + structuredCV.education + "\n";
    }
    
    return formattedText;
  };
  
  // Process optimized text when it changes
  useEffect(() => {
    if (optimizedText) {
      const processed = processOptimizedText(optimizedText);
      setProcessedText(processed);
      structureCV(processed);
    }
  }, [optimizedText]);
  
  // Polling mechanism for process status
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
              
              // If stuck for more than 3 minutes, show error and offer retry
              if (data.stuckMinutes > 3) {
                setError(`Processing appears stuck at ${data.progress}%. You can wait or try again.`);
              }
            } else {
              // Clear error if processing is moving again
              setError(null);
            }
            
            // Continue polling, but back off if progress is slow
            const newInterval = data.progress > 80 ? 1000 :
                               data.progress > 60 ? 2000 :
                               data.progress > 40 ? 3000 : 2000;
            
            setStatusPollingInterval(newInterval);
            timeoutId = setTimeout(checkStatus, newInterval);
          } else if (data.isComplete) {
            // Processing completed
            setIsProcessing(false);
            setIsProcessed(true);
            setProcessingStatus("Processing completed");
            setProcessingProgress(100);
            setStatusPollingEnabled(false);
            
            // Update state with optimization results
            if (data.optimizedText) {
              setOptimizedText(data.optimizedText);
              // Process the optimized text
              setProcessedText(processOptimizedText(data.optimizedText));
            }
            
            if (data.improvements) {
              setImprovements(data.improvements);
            }
            
            if (data.atsScore) {
              setOriginalAtsScore(data.atsScore);
            }
            
            if (data.improvedAtsScore) {
              setImprovedAtsScore(data.improvedAtsScore);
            }
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
  }, [statusPollingEnabled, statusPollingInterval, selectedCVId, processOptimizedText]);
  
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
  
  // Update structured CV whenever processed text changes
  useEffect(() => {
    if (processedText) {
      const structured = structureCV(processedText);
      setStructuredCV(structured);
    }
  }, [processedText, structureCV]);
  
  // Handle DOCX download
  const handleDownloadDocx = useCallback(async () => {
    if (!selectedCVId) {
      toast({
        title: "No CV selected",
        description: "Please select a CV to download",
        variant: "destructive",
      });
      return;
    }

    if (!processedText && !optimizedText) {
      toast({
        title: "No optimized content",
        description: "Please optimize your CV first",
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingDocx(true);

    try {
      // Use the formatted structured CV for the DOCX
      const textToUse = formatStructuredCV() || processedText || optimizedText;
      
      const response = await fetch("/api/cv/generate-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          optimizedText: textToUse,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate DOCX file');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.docxBase64) {
        throw new Error('Failed to generate DOCX file');
      }
      
      // Create a download link for the DOCX file
      const linkSource = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${data.docxBase64}`;
      const downloadLink = document.createElement('a');
      downloadLink.href = linkSource;
      downloadLink.download = `${selectedCVName?.replace(/\.[^/.]+$/, '') || 'optimized'}-cv.docx`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      console.log('DOCX file downloaded successfully');
    } catch (error) {
      console.error('Error downloading DOCX:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsDownloadingDocx(false);
    }
  }, [selectedCVId, selectedCVName, optimizedText, processedText, formatStructuredCV]);
  
  return (
    <Card className="w-full shadow-lg border-0 bg-[#1A1A1A]">
      <CardHeader className="bg-[#121212] text-white rounded-t-lg">
        <CardTitle className="text-[#B4916C] flex items-center gap-2">
          <span>Optimize CV</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* CV Selection */}
        <div className="mb-6">
          <div className="mb-2 text-gray-400 text-sm">Select a CV to optimize</div>
          <ModernFileDropdown 
            cvs={cvs} 
            onSelect={handleSelectCV} 
            selectedCVName={selectedCVName}
          />
        </div>
        
        {/* Error Display */}
        {error && (
          <Alert className="mb-6 bg-red-950 border-red-900 text-red-200">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 bg-red-800 hover:bg-red-700 border-red-700 text-white" 
                onClick={() => processCV(true)}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Process Button */}
        {!isProcessed && !isProcessing && (
          <Button 
            onClick={() => processCV(false)} 
            disabled={!selectedCVId || isProcessing}
            className="w-full bg-[#B4916C] hover:bg-[#A27D59] text-black font-medium mb-4"
          >
            Optimize CV
          </Button>
        )}
        
        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mb-4 p-4 border rounded-md bg-[#050505]">
            <h3 className="text-lg font-semibold">Processing CV</h3>
            <p className="text-sm text-muted-foreground">
              {processingStatus || "Processing..."}. Might take a couple minutes, please wait for an accurate optimization.
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
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Taking too long? Reset
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Results Section */}
        {isProcessed && (
          <div className="mt-6">
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-800 overflow-hidden mt-4">
                <div className="bg-[#050505] p-4">
                  <h4 className="text-white font-medium mb-4">Optimization Results</h4>
                  
                  {/* View Toggle */}
                  <div className="flex items-center justify-end mb-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowStructuredView(false)}
                        className={`px-3 py-1 text-sm rounded-md ${!showStructuredView ? 'bg-[#B4916C] text-[#050505] font-medium' : 'bg-[#121212] text-gray-400'}`}
                      >
                        Raw Text
                      </button>
                      <button
                        onClick={() => setShowStructuredView(true)}
                        className={`px-3 py-1 text-sm rounded-md ${showStructuredView ? 'bg-[#B4916C] text-[#050505] font-medium' : 'bg-[#121212] text-gray-400'}`}
                      >
                        Structured View
                      </button>
                    </div>
                  </div>
                  
                  {/* Content Display */}
                  <div className="mb-4">
                    {showStructuredView ? (
                      <div className="bg-[#121212] p-4 rounded-md">
                        <h5 className="text-white font-medium mb-2">Structured CV</h5>
                        
                        {/* Header */}
                        {structuredCV.header && (
                          <div className="mb-4 text-center border-b border-[#B4916C] pb-2">
                            <div className="text-white font-bold text-lg">{structuredCV.header.split('\n')[0]}</div>
                            <div className="text-gray-400 text-sm">
                              {structuredCV.header.split('\n').slice(1).join(' | ')}
                            </div>
                          </div>
                        )}
                        
                        {/* Profile */}
                        {structuredCV.profile && (
                          <div className="mb-4">
                            <h6 className="text-[#B4916C] font-medium mb-2">PROFILE</h6>
                            <p className="text-gray-300 text-sm">{structuredCV.profile}</p>
                          </div>
                        )}
                        
                        {/* Achievements */}
                        {structuredCV.achievements.length > 0 && (
                          <div className="mb-4 bg-[#0A0A0A] p-3 rounded-md border-l-2 border-[#B4916C]">
                            <h6 className="text-[#B4916C] font-medium mb-2">ACHIEVEMENTS</h6>
                            <ul className="list-disc pl-5 space-y-1 text-gray-300 text-sm">
                              {structuredCV.achievements.map((achievement, index) => (
                                <li key={index}>{achievement}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Goals */}
                        {structuredCV.goals.length > 0 && (
                          <div className="mb-4 bg-[#0A0A0A] p-3 rounded-md border-l-2 border-[#B4916C]">
                            <h6 className="text-[#B4916C] font-medium mb-2">GOALS</h6>
                            <ul className="list-disc pl-5 space-y-1 text-gray-300 text-sm">
                              {structuredCV.goals.map((goal, index) => (
                                <li key={index}>{goal}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Skills */}
                        {structuredCV.skills && (
                          <div className="mb-4">
                            <h6 className="text-[#B4916C] font-medium mb-2">SKILLS</h6>
                            <div className="text-gray-300 text-sm whitespace-pre-wrap">
                              {structuredCV.skills}
                            </div>
                          </div>
                        )}
                        
                        {/* Languages */}
                        {structuredCV.languages && (
                          <div className="mb-4">
                            <h6 className="text-[#B4916C] font-medium mb-2">LANGUAGES</h6>
                            <div className="text-gray-300 text-sm whitespace-pre-wrap">
                              {structuredCV.languages}
                            </div>
                          </div>
                        )}
                        
                        {/* Education */}
                        {structuredCV.education && (
                          <div className="mb-4">
                            <h6 className="text-[#B4916C] font-medium mb-2">EDUCATION</h6>
                            <div className="text-gray-300 text-sm whitespace-pre-wrap">
                              {structuredCV.education}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-[#121212] p-4 rounded-md">
                        <h5 className="text-white font-medium mb-2">Optimized Content</h5>
                        <div className="text-gray-300 whitespace-pre-wrap text-sm max-h-96 overflow-y-auto p-2 bg-gray-900 rounded">
                          {formatStructuredCV() || processedText || optimizedText || "No optimized content available yet."}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Download DOCX Button */}
                  <Button
                    onClick={handleDownloadDocx}
                    disabled={isDownloadingDocx || !optimizedText}
                    className="w-full bg-[#121212] hover:bg-gray-800 text-white border border-gray-700 mb-4"
                  >
                    {isDownloadingDocx ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating DOCX...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download as DOCX
                      </>
                    )}
                  </Button>
                  
                  {improvements && improvements.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-white font-medium mb-2">Improvements Made</h5>
                      <ul className="list-disc pl-5 space-y-1 text-gray-300">
                        {improvements.map((improvement, index) => (
                          <li key={index}>{improvement}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <Button
                    onClick={handleResetProcessing}
                    className="bg-transparent hover:bg-gray-800 text-gray-400 border border-gray-700 flex items-center justify-center mt-4 w-full"
                  >
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Start Over
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 