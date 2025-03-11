// AnalyzeCVCard.client.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart2, Building, FileText, ArrowRight, Check, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getIndustrySpecificAtsInsights } from "@/lib/cvAnalyzer";
import { Progress } from "@/components/ui/progress";

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

// New SimpleFileDropdown component to replace the problematic dropdown
function SimpleFileDropdown({ cvs, onSelect, selectedCVName }: { cvs: string[]; onSelect: (cvId: string, cvName: string) => void; selectedCVName?: string | null; }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 bg-[#121212] border border-gray-700 text-gray-300 rounded"
      >
        {selectedCVName || "Select a CV"}
      </button>
      {open && (
        <ul className="absolute z-10 bg-[#121212] border border-gray-700 w-full rounded mt-1 max-h-60 overflow-auto">
          {(cvs || []).map(cv => {
            const parts = cv.split('|');
            if (parts.length >= 2) {
              return (
                <li
                  key={parts[1]}
                  className="px-3 py-2 hover:bg-gray-600 cursor-pointer"
                  onClick={() => { setOpen(false); onSelect(parts[1].trim(), parts[0].trim()); }}
                >
                  {parts[0].trim()}
                </li>
              );
            }
            return null;
          })}
        </ul>
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

  // Generate formatting-specific strengths
  function generateFormattingStrengths(analysis: AnalysisResult): string[] {
    const strengths: string[] = [];
    const sections = analysis.sectionBreakdown || {};
    
    // Extract more meaningful strengths from the CV content
    
    // Analyze industry-specific keywords
    if (analysis.keywordAnalysis) {
      const keywordEntries = Object.entries(analysis.keywordAnalysis);
      // Sort keywords by frequency (highest first)
      keywordEntries.sort((a, b) => b[1] - a[1]);
      
      if (keywordEntries.length > 3) {
        const topKeywords = keywordEntries.slice(0, 3).map(entry => entry[0]).join(', ');
        strengths.push(`Strong presence of key terms: ${topKeywords}`);
      }
    }
    
    // Check for comprehensive structure
    if (Object.keys(sections).length >= 4) {
      strengths.push("Well-structured CV with comprehensive sections");
    } else if (Object.keys(sections).length >= 2) {
      strengths.push("Basic CV structure with essential sections");
    }
    
    // Check if industry was correctly identified
    if (analysis.industry && analysis.industry !== 'General') {
      strengths.push(`CV is well-aligned with ${analysis.industry} industry standards`);
    }
    
    // Check for experience section quality
    if (sections.experience) {
      const experienceText = sections.experience.toLowerCase();
      
      // Look for action verbs and achievements
      const actionVerbs = ['achieved', 'led', 'managed', 'developed', 'created', 'improved', 'increased', 'decreased', 'implemented'];
      const hasActionVerbs = actionVerbs.some(verb => experienceText.includes(verb));
      
      // Look for metrics and quantifiable results
      const hasMetrics = /\d+%|\$\d+|\d+ years|\d+\+?/.test(experienceText);
      
      if (hasActionVerbs && hasMetrics) {
        strengths.push("Experience section effectively highlights achievements with metrics");
      } else if (hasActionVerbs) {
        strengths.push("Experience descriptions use strong action verbs");
      }
    }
    
    // Check for skills section quality
    if (sections.skills && sections.skills.length > 100) {
      // Check if skills are relevant to the detected industry
      if (analysis.industry && analysis.keywordAnalysis) {
        const skillsRelevance = Object.keys(analysis.keywordAnalysis).length;
        if (skillsRelevance > 5) {
          strengths.push(`Comprehensive and relevant skills for ${analysis.industry}`);
        } else {
          strengths.push("Detailed skills section included");
        }
      } else {
        strengths.push("Comprehensive skills section");
      }
    }
    
    // Check for education section
    if (sections.education && sections.education.length > 50) {
      strengths.push("Well-documented educational qualifications");
    }
    
    // Check for appropriate length overall
    let totalLength = 0;
    for (const section of Object.values(sections)) {
      totalLength += section.length;
    }
    
    if (totalLength > 2000 && totalLength < 6000) {
      strengths.push("Ideal CV length for thorough review");
    } else if (totalLength > 1000) {
      strengths.push("Appropriate content length");
    }
    
    // If the ATS score is good
    if (typeof analysis.atsScore === 'number') {
      if (analysis.atsScore > 75) {
        strengths.push("Excellent ATS optimization");
      } else if (analysis.atsScore > 60) {
        strengths.push("Good ATS compatibility");
      } else if (analysis.atsScore > 40) {
        strengths.push("Acceptable ATS formatting");
      }
    }
    
    // If no strengths were found, add a fallback message
    if (strengths.length === 0) {
      strengths.push("CV accepted for analysis");
      strengths.push("Additional optimization recommended");
    }
    
    // Return up to 3 strengths
    return strengths.slice(0, 3);
  }
  
  // Generate formatting-specific weaknesses
  function generateFormattingWeaknesses(analysis: AnalysisResult): string[] {
    const weaknesses: string[] = [];
    const sections = analysis.sectionBreakdown || {};
    
    // Check for missing important sections
    const importantSections = ['summary', 'experience', 'education', 'skills'];
    for (const section of importantSections) {
      if (!sections[section] || sections[section].length < 50) {
        weaknesses.push(`Missing or underdeveloped ${section} section`);
      }
    }
    
    // Check for overly long sections
    for (const [name, content] of Object.entries(sections)) {
      if (content.length > 2000) {
        weaknesses.push(`${name.charAt(0).toUpperCase() + name.slice(1)} section is too verbose`);
      }
    }
    
    // Check for keyword density
    if (analysis.keywordAnalysis && Object.keys(analysis.keywordAnalysis).length < 10) {
      weaknesses.push("Low keyword density for ATS optimization");
    }
    
    // Check for potential formatting issues
    if (analysis.atsScore && typeof analysis.atsScore === 'number' && analysis.atsScore < 70) {
      weaknesses.push("Potential formatting issues affecting ATS compatibility");
    }
    
    // Return top 3 weaknesses
    return weaknesses.slice(0, 3);
  }
  
  // Generate formatting-specific recommendations
  function generateFormattingRecommendations(analysis: AnalysisResult): string[] {
    const recommendations: string[] = [];
    const sections = analysis.sectionBreakdown || {};
    
    // Recommend adding missing sections
    const importantSections = ['summary', 'experience', 'education', 'skills'];
    for (const section of importantSections) {
      if (!sections[section] || sections[section].length < 50) {
        recommendations.push(`Add a clear ${section} section with appropriate headings`);
      }
    }
    
    // Recommend bullet points for readability
    if (sections.experience && !sections.experience.includes('•') && !sections.experience.includes('-')) {
      recommendations.push("Use bullet points to highlight achievements in your experience section");
    }
    
    // Recommend consistent formatting
    recommendations.push("Ensure consistent formatting throughout your CV (fonts, spacing, bullet styles)");
    
    // Recommend appropriate section headers
    recommendations.push("Use standard section headers that ATS systems can easily recognize");
    
    // Recommend keyword optimization
    if (analysis.industry) {
      recommendations.push(`Include more ${analysis.industry}-specific keywords throughout your CV`);
    } else {
      recommendations.push("Include more industry-specific keywords throughout your CV");
    }
    
    // Recommend quantifiable achievements
    recommendations.push("Add metrics and numbers to quantify your achievements");
    
    // Recommend appropriate length
    let totalLength = 0;
    for (const section of Object.values(sections)) {
      totalLength += section.length;
    }
    
    if (totalLength < 1000) {
      recommendations.push("Expand your CV with more detailed information about your experience and skills");
    } else if (totalLength > 6000) {
      recommendations.push("Consider condensing your CV to focus on the most relevant information");
    }
    
    // Return top 3 recommendations
    return recommendations.slice(0, 3);
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

  return (
    <>
      <Card className="rounded-lg border-t-4 border-t-[#B4916C] shadow-md bg-[#050505] text-white w-full max-w-[95vw] mx-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-[#B4916C]" />
              Analyze CV
            </div>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Analyze your CV for ATS compatibility and improvement opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* File selection area */}
          <div className="mb-6">
            <div className="text-sm text-gray-400 mb-2">
              Select a CV to analyze
            </div>
            <SimpleFileDropdown
              cvs={cvs}
              onSelect={handleCVSelect}
              selectedCVName={selectedCVName}
            />
          </div>

          {/* Analysis button */}
          <div className="mt-4">
            <Button
              onClick={handleAnalyze}
              className="w-full bg-[#B4916C] hover:bg-[#9A7A5B] text-white flex items-center justify-center"
              disabled={loading || !selectedCVName}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BarChart2 className="h-4 w-4 mr-2" />
                  Analyze CV
                </>
              )}
            </Button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="mt-4">
              <Progress value={45} className="h-2 bg-gray-700" />
              <p className="text-sm text-gray-400 mt-2 text-center">Analyzing CV for ATS compatibility...</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <Alert variant="destructive" className="mt-4 border border-red-800 bg-red-900/20">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Analysis results */}
          {analysis && !loading && (
            <div className="mt-6 space-y-6">
              {/* ATS Score */}
              <div className="rounded-lg border border-[#B4916C]/30 p-4 bg-[#1A1A1A]">
                <h3 className="text-lg font-semibold mb-4">ATS Compatibility Score</h3>
                <div className="flex items-center">
                  <div className="w-full max-w-sm">
                    <Progress value={Number(formatAtsScore(analysis.atsScore))} className="h-3 bg-gray-700" />
                  </div>
                  <span className="ml-4 text-xl font-bold text-[#B4916C]">{formatAtsScore(analysis.atsScore)}%</span>
                </div>
                
                <div className="mt-2 text-sm text-gray-400">
                  {Number(formatAtsScore(analysis.atsScore)) >= 70
                    ? "Good score! Your CV is well-optimized for ATS systems."
                    : Number(formatAtsScore(analysis.atsScore)) >= 50
                    ? "Average score. Your CV needs some improvements for better ATS compatibility."
                    : "Low score. Your CV needs significant optimization for ATS systems."}
                </div>
              </div>
              
              {/* Industry & Language */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#B4916C]/30 p-4 bg-[#1A1A1A]">
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Industry</h3>
                  <p className="text-lg font-semibold">{analysis.industry}</p>
                </div>
                
                {analysis.language && (
                  <div className="rounded-lg border border-[#B4916C]/30 p-4 bg-[#1A1A1A]">
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Language</h3>
                    <p className="text-lg font-semibold">{getLanguageName(analysis.language)}</p>
                  </div>
                )}
              </div>
              
              {/* Strengths and Weaknesses */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="rounded-lg border border-[#B4916C]/30 p-4 bg-[#1A1A1A]">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    Strengths
                  </h3>
                  <ul className="space-y-2">
                    {analysis.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-4 w-4 mr-2 text-green-500 mt-1 flex-shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Weaknesses */}
                <div className="rounded-lg border border-[#B4916C]/30 p-4 bg-[#1A1A1A]">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                    Areas to Improve
                  </h3>
                  <ul className="space-y-2">
                    {analysis.weaknesses.map((weakness, index) => (
                      <li key={index} className="flex items-start">
                        <AlertCircle className="h-4 w-4 mr-2 text-red-500 mt-1 flex-shrink-0" />
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {/* Recommendations */}
              <div className="rounded-lg border border-[#B4916C]/30 p-4 bg-[#1A1A1A]">
                <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                <ul className="space-y-2">
                  {analysis.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start">
                      <ArrowRight className="h-4 w-4 mr-2 text-[#B4916C] mt-1 flex-shrink-0" />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Children (if any) */}
          {children}
        </CardContent>
      </Card>
      <style jsx global>{`
        .h-3.bg-gray-700 > div {
          background-color: #B4916C;
        }
      `}</style>
    </>
  );
}

