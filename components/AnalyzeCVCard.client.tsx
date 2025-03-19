// AnalyzeCVCard.client.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart2, Building, FileText, ChevronDown, CheckCircle, ArrowRight } from "lucide-react";
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
  experienceEntries?: { jobTitle?: string; company?: string; dateRange?: string; location?: string; responsibilities?: string[] }[];
}

interface AnalyzeCVCardProps {
  cvs: string[];
  onAnalysisComplete?: (cvId: string) => void;
  children?: React.ReactNode;
}

// Updated SimpleFileDropdown component to match the brand style
function SimpleFileDropdown({ cvs, onSelect, selectedCVName }: { cvs: string[]; onSelect: (cvId: string, cvName: string) => void; selectedCVName?: string; }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3.5 bg-[#111111] border border-[#222222] hover:border-[#B4916C] text-[#F9F6EE] rounded-lg flex justify-between items-center transition-colors duration-200 font-borna"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedCVName || "Select a CV"}</span>
        <ChevronDown 
          className={`h-5 w-5 text-[#B4916C] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      
      {open && cvs.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#111111] border border-[#222222] rounded-lg shadow-xl max-h-60 overflow-auto animate-fade-in">
          <ul className="py-1" role="listbox">
            {(cvs || []).map(cv => {
              const parts = cv.split('|');
              if (parts.length >= 2) {
                return (
                  <li
                    key={parts[1]}
                    className="px-4 py-3 text-sm text-[#F9F6EE] hover:bg-[#1A1A1A] hover:text-[#B4916C] cursor-pointer transition-colors duration-150 font-borna"
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
        <div className="absolute z-10 w-full mt-1 bg-[#111111] border border-[#222222] rounded-lg shadow-xl animate-fade-in">
          <div className="px-4 py-3 text-sm text-[#F9F6EE]/50 font-borna">No CVs available</div>
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
        experienceEntries: Array.isArray(data.analysis.experienceEntries) ? data.analysis.experienceEntries : undefined,
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
      return "CV summary unavailable.";
    }
  };

  // Add a function to display experience entries
  const getExperienceSection = () => {
    if (!analysis || !analysis.experienceEntries || !Array.isArray(analysis.experienceEntries) || analysis.experienceEntries.length === 0) {
      return null;
    }
    
    return (
      <div className="rounded-lg border border-[#222222] overflow-hidden mt-5">
        <div className="bg-[#111111] p-5">
          <h3 className="text-lg font-safiro font-semibold mb-4 flex items-center text-[#F9F6EE]">
            <span className="text-[#B4916C] mr-2">
              <Building size={20} />
            </span>
            Career Experience
          </h3>
          
          <div className="space-y-4">
            {analysis.experienceEntries.map((entry, index) => (
              <div key={index} className="border-b border-[#222222] pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-[#B4916C] font-safiro">{entry.jobTitle || "Position"}</h4>
                    <p className="text-[#F9F6EE]/60 text-sm font-borna">{entry.company || "Company"}</p>
                  </div>
                  <div className="text-[#F9F6EE]/50 text-sm font-borna">{entry.dateRange || ""}</div>
                </div>
                
                {entry.location && (
                  <p className="text-[#F9F6EE]/50 text-sm mt-1 font-borna">{entry.location}</p>
                )}
                
                {entry.responsibilities && entry.responsibilities.length > 0 && (
                  <div className="mt-3">
                    <ul className="list-disc list-inside text-[#F9F6EE]/80 text-sm space-y-1.5 font-borna">
                      {entry.responsibilities.slice(0, 3).map((resp, idx) => (
                        <li key={idx} className="ml-1">{resp}</li>
                      ))}
                      {entry.responsibilities.length > 3 && (
                        <li className="text-[#F9F6EE]/40 text-xs italic font-borna">+ {entry.responsibilities.length - 3} more responsibilities</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full border border-[#222222] bg-[#111111] rounded-xl shadow-md overflow-hidden">
      <CardHeader className="bg-[#0D0D0D] border-b border-[#222222] px-5 py-4">
        <CardTitle className="text-xl font-safiro text-[#F9F6EE] flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-[#B4916C]" />
          <span>Analyze Your CV</span>
        </CardTitle>
        <CardDescription className="text-[#F9F6EE]/60 font-borna mt-1">
          Evaluate against ATS systems and industry standards
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-5">
        {!analysis && !loading && (
          <div className="mb-6">
            <div className="mb-3 text-[#F9F6EE]/70 text-sm font-borna">Select a CV to analyze</div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="w-full">
                <SimpleFileDropdown cvs={cvs} selectedCVName={selectedCVName || ""} onSelect={handleCVSelect} />
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={!selectedCVId || loading}
                className="bg-[#B4916C] hover:bg-[#A27D59] text-[#050505] font-safiro whitespace-nowrap w-full sm:w-auto transition-colors duration-200 border-none h-12"
              >
                {loading ? "Analyzing..." : "Analyze CV"}
              </Button>
            </div>
            
            <div className="text-[#F9F6EE]/50 text-sm font-borna">
              Our AI will evaluate your CV against ATS systems and provide specific recommendations to improve your chances of getting an interview.
            </div>
          </div>
        )}
        
        {loading && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="relative w-16 h-16 mb-5">
              <div className="absolute inset-0 border-4 border-[#222222] rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-[#B4916C] rounded-full animate-spin"></div>
            </div>
            <p className="text-[#F9F6EE] text-center font-safiro">Analyzing your CV...</p>
            <p className="text-[#F9F6EE]/50 text-sm text-center mt-2 font-borna">This may take a minute as our AI evaluates your document.</p>
          </div>
        )}
        
        {error && (
          <Alert className="mb-5 bg-[#1a0505] border border-[#3d1a1a] text-[#f5c2c2] rounded-lg">
            <AlertCircle className="h-4 w-4 mr-2 text-red-400" />
            <AlertDescription className="font-borna">{error}</AlertDescription>
          </Alert>
        )}
        
        {analysis && !loading && (
          <div className="space-y-6 animate-fade-in-up">
            {/* ATS Score */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-5 rounded-xl bg-[#0D0D0D] border border-[#222222]">
              <div className="space-y-1">
                <h3 className="text-[#F9F6EE] font-safiro text-lg flex items-center">
                  <FileText className="text-[#B4916C] w-5 h-5 mr-2" />
                  ATS Compatibility Score
                </h3>
                <p className="text-[#F9F6EE]/60 text-sm font-borna">How well your CV performs against Applicant Tracking Systems</p>
              </div>
              <div className="flex items-center justify-center bg-[#111111] rounded-lg p-3 min-w-[90px]">
                <span className="text-2xl font-bold font-safiro" style={{ 
                  color: parseInt(formatAtsScore(analysis.atsScore)) > 80 
                    ? '#4ade80' 
                    : parseInt(formatAtsScore(analysis.atsScore)) > 60 
                      ? '#facc15' 
                      : '#f87171'
                }}>
                  {formatAtsScore(analysis.atsScore)}
                </span>
              </div>
            </div>
            
            {/* Industry and Language */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#222222]">
                <h3 className="text-[#F9F6EE] font-safiro mb-1 flex items-center">
                  <Building className="text-[#B4916C] w-4 h-4 mr-2" />
                  Industry
                </h3>
                <p className="text-[#F9F6EE]/80 font-borna">{analysis.industry || "General"}</p>
              </div>
              
              {analysis.language && (
                <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#222222]">
                  <h3 className="text-[#F9F6EE] font-safiro mb-1">Language</h3>
                  <p className="text-[#F9F6EE]/80 font-borna">{getLanguageName(analysis.language)}</p>
                </div>
              )}
            </div>
            
            {/* Keywords */}
            {analysis.keywordAnalysis && Object.keys(analysis.keywordAnalysis).length > 0 && (
              <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#222222]">
                <h3 className="text-[#F9F6EE] font-safiro mb-3">Top Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {getTopKeywords().map((keyword, index) => (
                    <span 
                      key={index} 
                      className="inline-block px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#333333] text-[#B4916C] text-sm font-borna"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Strengths, Weaknesses, Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Strengths */}
              <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#222222]">
                <h3 className="text-[#F9F6EE] font-safiro mb-3 flex items-center">
                  <CheckCircle className="text-emerald-500 w-4 h-4 mr-2" />
                  Strengths
                </h3>
                <ul className="space-y-2">
                  {analysis.strengths.map((strength, index) => (
                    <li key={index} className="text-[#F9F6EE]/80 text-sm font-borna flex items-start">
                      <span className="text-emerald-500 mr-2">•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Weaknesses */}
              <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#222222]">
                <h3 className="text-[#F9F6EE] font-safiro mb-3 flex items-center">
                  <AlertCircle className="text-amber-500 w-4 h-4 mr-2" />
                  Areas to Improve
                </h3>
                <ul className="space-y-2">
                  {analysis.weaknesses.map((weakness, index) => (
                    <li key={index} className="text-[#F9F6EE]/80 text-sm font-borna flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Recommendations */}
              <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#222222]">
                <h3 className="text-[#F9F6EE] font-safiro mb-3 flex items-center">
                  <ArrowRight className="text-[#B4916C] w-4 h-4 mr-2" />
                  Recommendations
                </h3>
                <ul className="space-y-2">
                  {analysis.recommendations.map((recommendation, index) => (
                    <li key={index} className="text-[#F9F6EE]/80 text-sm font-borna flex items-start">
                      <span className="text-[#B4916C] mr-2">•</span>
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* Experience Section */}
            {getExperienceSection()}
            
            {/* Proceed Button */}
            <div className="flex justify-center mt-6">
              <Button
                onClick={handleProceedToOptimize}
                className="bg-[#B4916C] hover:bg-[#A27D59] text-[#050505] px-6 py-3 rounded-lg font-safiro text-base transition-colors duration-200 h-auto w-full md:w-auto"
              >
                Proceed to Optimization
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

