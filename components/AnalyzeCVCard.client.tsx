// AnalyzeCVCard.client.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart2, Building, FileText, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getIndustrySpecificAtsInsights } from "@/lib/cvAnalyzer";

interface AnalysisResult {
  atsScore: number | string;
  language?: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  industry: string;
  keywordAnalysis?: { [key: string]: number };
  sectionBreakdown?: { [key: string]: string };
  industryInsight?: string;
  targetRoles?: string[];
  formattingStrengths?: string[];
  formattingWeaknesses?: string[];
  formattingRecommendations?: string[];
}

interface AnalyzeCVCardProps {
  cvs: string[];
  onAnalysisComplete?: (cvId: string) => void;
  children?: React.ReactNode;
}

// Updated SimpleFileDropdown component to match ModernFileDropdown
function SimpleFileDropdown({ cvs, onSelect, selectedCVName }: { cvs: string[]; onSelect: (cvId: string, cvName: string) => void; selectedCVName?: string; }) {
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
            {(cvs || []).map(cv => {
              const parts = cv.split('|');
              if (parts.length >= 2) {
                return (
                  <li
                    key={parts[1]}
                    className="px-4 py-2 text-sm text-gray-300 hover:bg-[#1A1A1A] hover:text-white cursor-pointer"
                    role="option"
                    onClick={() => { setOpen(false); onSelect(parts[1].trim(), parts[0].trim()); }}
                  >
                    {parts[0].trim()}
                  </li>
                );
              }
              return null;
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

export default function AnalyzeCVCard({ cvs, onAnalysisComplete, children }: AnalyzeCVCardProps) {
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowProceed, setAllowProceed] = useState<boolean>(false);

  // Auto-select the first CV if available
  useEffect(() => {
    if (cvs && cvs.length > 0 && !selectedCVId) {
      const parts = cvs[0].split('|');
      if (parts.length >= 2) {
        setSelectedCVId(parts[1].trim());
        setSelectedCVName(parts[0].trim());
      }
    }
  }, [cvs, selectedCVId]);
  
  // Handle CV selection
  const handleCVSelect = useCallback((cvId: string, cvName: string) => {
    console.log("CV selected for analysis:", cvName, "ID:", cvId);
      setSelectedCVId(cvId);
    setSelectedCVName(cvName);
  }, []);

  async function handleAnalyze() {
    if (!selectedCVId) {
      setError("Please select a CV to analyze");
      return;
    }
    
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      console.log(`Analyzing CV: ${selectedCVName} (ID: ${selectedCVId})`);
      const encodedFileName = selectedCVName ? encodeURIComponent(selectedCVName) : '';
      const encodedCVId = encodeURIComponent(selectedCVId);
      const response = await fetch(`/api/analyze-cv?fileName=${encodedFileName}&cvId=${encodedCVId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze CV");
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Analysis failed");
      }
      
      // Create a safe version of the analysis data with proper type checking
      const safeData = {
        atsScore: typeof data.analysis.atsScore === 'number' || typeof data.analysis.atsScore === 'string' 
          ? data.analysis.atsScore 
          : 0,
        language: typeof data.analysis.language === 'string' ? data.analysis.language : undefined,
        industry: typeof data.analysis.industry === 'string' ? data.analysis.industry : 'General',
        strengths: Array.isArray(data.analysis.strengths) ? data.analysis.strengths : [],
        weaknesses: Array.isArray(data.analysis.weaknesses) ? data.analysis.weaknesses : [],
        recommendations: Array.isArray(data.analysis.recommendations) ? data.analysis.recommendations : [],
        keywordAnalysis: typeof data.analysis.keywordAnalysis === 'object' ? data.analysis.keywordAnalysis : {},
        formattingStrengths: Array.isArray(data.analysis.formattingStrengths) ? data.analysis.formattingStrengths : [],
        formattingWeaknesses: Array.isArray(data.analysis.formattingWeaknesses) ? data.analysis.formattingWeaknesses : [],
        formattingRecommendations: Array.isArray(data.analysis.formattingRecommendations) ? data.analysis.formattingRecommendations : [],
        sectionBreakdown: typeof data.analysis.sectionBreakdown === 'object' ? data.analysis.sectionBreakdown : {},
        industryInsight: typeof data.analysis.industryInsight === 'string' ? data.analysis.industryInsight : undefined,
        targetRoles: Array.isArray(data.analysis.targetRoles) ? data.analysis.targetRoles : undefined,
      };
      
        // If industry is detected but no industry insight is provided, get one
      if (safeData.industry && !safeData.industryInsight) {
          try {
          const insight = getIndustrySpecificAtsInsights(safeData.industry);
          safeData.industryInsight = insight;
          } catch (error) {
            console.error("Error getting industry insights:", error);
          // Continue without insight
        }
      }
      
      // Set the analysis result
      setAnalysis(safeData);
      
      // Store the analysis in the database
      try {
        const updateResponse = await fetch('/api/update-cv-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cvId: selectedCVId,
            analysis: safeData
          }),
        });
        
        if (!updateResponse.ok) {
          console.error("Failed to update CV analysis in database");
        }
      } catch (updateError) {
        console.error("Error updating CV analysis:", updateError);
      }
      
      // Call the onAnalysisComplete callback if provided
      if (onAnalysisComplete && typeof onAnalysisComplete === 'function') {
        try {
          onAnalysisComplete(selectedCVId);
        } catch (callbackError) {
          console.error("Error in onAnalysisComplete callback:", callbackError);
        }
      }
    } catch (error) {
      console.error("Analysis error:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }

  const formatAtsScore = (score: number | string | undefined | null): string => {
    // Handle undefined or null
    if (score === undefined || score === null) {
      return "0%";
    }
    
    // Convert to number if it's a string
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    
    // Check if it's a valid number
    if (isNaN(numericScore)) {
      return "0%";
    }
    
    // Format the score
    return `${Math.round(numericScore)}%`;
  };

  const getTopKeywords = () => {
    if (!analysis || !analysis.keywordAnalysis) {
      return [];
    }
    
    try {
      // Convert keywordAnalysis object to array of [keyword, count] pairs
      const keywordEntries = Object.entries(analysis.keywordAnalysis);
      
      // Sort by count (descending) and take top 5
      return keywordEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
        .map(([keyword]) => keyword);
    } catch (error) {
      console.error("Error processing keywords:", error);
      return [];
    }
  };

  // Instead, add a function to handle proceeding to the next step
  const handleProceedToOptimize = useCallback(() => {
    if (selectedCVId && onAnalysisComplete) {
      setAllowProceed(true);
      onAnalysisComplete(selectedCVId);
    }
  }, [selectedCVId, onAnalysisComplete]);

  // Add helper function to convert language code to name
  const getLanguageName = (langCode: string): string => {
    const languages: Record<string, string> = {
      "en": "English",
      "es": "Spanish",
      "fr": "French",
      "de": "German"
    };
    
    return languages[langCode] || langCode;
  };

  // Add a function to generate a CV summary
  const getCVSummary = () => {
    if (!analysis) {
      return "No analysis available yet.";
    }
    
    try {
      // Create a summary based on strengths and industry
      let summary = `This CV appears to be for a ${analysis.industry || "general"} professional. `;
      
      // Add strengths if available
      if (analysis.strengths && analysis.strengths.length > 0) {
        summary += `Key strengths include: ${analysis.strengths.slice(0, 3).join(", ")}. `;
      }
      
      // Add recommendations if available
      if (analysis.recommendations && analysis.recommendations.length > 0) {
        summary += `Consider improving: ${analysis.recommendations.slice(0, 2).join(", ")}.`;
      }
      
      return summary;
    } catch (error) {
      console.error("Error generating CV summary:", error);
      return "Unable to generate summary. Please try analyzing again.";
    }
  };

  return (
    <Card className="w-full shadow-lg border border-[#B4916C]/20 bg-[#121212]">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-[#B4916C] flex items-center gap-2">
          <BarChart2 className="w-5 h-5" />
          <span>Analyze CV</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Evaluate your CV against ATS systems and industry standards
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 md:p-6">
        {!analysis && !loading && (
          <div className="mb-6">
            <div className="mb-2 text-gray-400 text-sm">Select a CV to analyze</div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0 mb-4">
              <div className="w-full">
                <SimpleFileDropdown cvs={cvs} selectedCVName={selectedCVName || ""} onSelect={handleCVSelect} />
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={!selectedCVId || loading}
                className="bg-[#B4916C] hover:bg-[#A27D59] text-[#050505] font-medium whitespace-nowrap w-full sm:w-auto"
              >
                {loading ? "Analyzing..." : "Analyze CV"}
              </Button>
            </div>
            
            <div className="text-gray-400 text-sm">
              Select your CV to begin the AI-powered analysis. Our system will evaluate your CV against ATS systems and industry standards.
            </div>
          </div>
        )}
        
        {loading && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 border-4 border-[#B4916C] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-300 text-center">Analyzing your CV...</p>
            <p className="text-gray-500 text-sm text-center mt-2">This may take a minute or two.</p>
          </div>
        )}
        
        {error && (
          <Alert className="mb-4 bg-red-950 border-red-900 text-red-200">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {analysis && (
          <div className="space-y-6 overflow-x-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#050505] p-4 rounded-lg border border-gray-800">
                <h3 className="text-lg text-white font-semibold mb-3">ATS Compatibility Score</h3>
                <div className="flex items-center">
                  <div className="text-[#B4916C] font-bold text-4xl">
                    {formatAtsScore(analysis.atsScore)}
                  </div>
                  <div className="text-sm text-gray-400 ml-1">/&nbsp;100</div>
                </div>
              </div>
              
              <div className="bg-[#050505] p-4 rounded-lg border border-gray-800">
                <h3 className="text-lg text-white font-semibold mb-3 flex items-center">
                  <Building className="h-4 w-4 mr-2 text-[#B4916C]" />
                  Industry
                </h3>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-[#B4916C]/10 text-[#B4916C] rounded-md">
                    {analysis.industry || "General"}
                  </span>
                  {analysis.language && (
                    <span className="px-2 py-1 bg-[#050505] text-gray-400 border border-gray-700 rounded-md text-xs uppercase">
                      {getLanguageName(analysis.language)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="rounded-lg border border-gray-800 overflow-hidden mt-4">
              <div className="bg-[#050505] p-4">
                <h3 className="text-xl font-semibold mb-4 flex items-center text-white">
                  <span className="text-[#B4916C] mr-2">
                    <FileText size={20} />
                  </span>
                  CV Summary
                </h3>
                <div className="text-gray-300 text-sm">
                  {getCVSummary()}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

