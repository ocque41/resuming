// AnalyzeCVCard.client.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart2, Building, FileText, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getIndustrySpecificAtsInsights } from "@/lib/cvAnalyzer";
import CVCombobox from "@/components/CVCombobox.client";

interface AnalysisResult {
  atsScore: number | string;
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

export default function AnalyzeCVCard({ cvs, onAnalysisComplete, children }: AnalyzeCVCardProps) {
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle CV selection
  const handleCVSelect = useCallback((cvId: string, cvName: string) => {
    console.log("CV selected for analysis:", cvName, "ID:", cvId);
    setSelectedCVId(cvId);
    setSelectedCVName(cvName);
  }, []);

  async function handleAnalyze() {
    if (!selectedCVName || !selectedCVId) {
      setError("Please select a CV to analyze");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      console.log(`Analyzing CV: ${selectedCVName} (ID: ${selectedCVId})`);
      const response = await fetch(`/api/analyze-cv?fileName=${encodeURIComponent(selectedCVName)}&cvId=${encodeURIComponent(selectedCVId)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to analyze CV: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        // If industry is detected but no industry insight is provided, get one
        if (data.industry && !data.industryInsight) {
          try {
            const insight = getIndustrySpecificAtsInsights(data.industry);
            data.industryInsight = insight;
          } catch (error) {
            console.error("Error getting industry insights:", error);
          }
        }
        
        // Add formatting-specific analysis
        data.formattingStrengths = generateFormattingStrengths(data);
        data.formattingWeaknesses = generateFormattingWeaknesses(data);
        data.formattingRecommendations = generateFormattingRecommendations(data);
        
        setAnalysis(data);
        
        // Store the enhanced analysis in the database
        try {
          await fetch('/api/update-cv-analysis', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cvId: selectedCVId,
              analysis: {
                ...data,
                formattingStrengths: data.formattingStrengths,
                formattingWeaknesses: data.formattingWeaknesses,
                formattingRecommendations: data.formattingRecommendations
              }
            }),
          });
        } catch (updateError) {
          console.error("Error updating analysis metadata:", updateError);
          // Continue despite the error
        }
        
        // Notify parent component that analysis is complete
        if (onAnalysisComplete && selectedCVId) {
          onAnalysisComplete(selectedCVId);
        }
      }
    } catch (error) {
      console.error("Error analyzing CV:", error);
      setError(error instanceof Error ? error.message : "An error occurred while analyzing your CV");
    } finally {
      setLoading(false);
    }
  }

  // Generate formatting-specific strengths
  function generateFormattingStrengths(analysis: AnalysisResult): string[] {
    const strengths: string[] = [];
    const sections = analysis.sectionBreakdown || {};
    
    // Check for well-structured sections
    if (Object.keys(sections).length >= 4) {
      strengths.push("Well-structured with clear section divisions");
    }
    
    // Check for appropriate length
    let totalLength = 0;
    for (const section of Object.values(sections)) {
      totalLength += section.length;
    }
    
    if (totalLength > 1500 && totalLength < 5000) {
      strengths.push("Appropriate CV length for ATS scanning");
    }
    
    // Check for consistent formatting
    if (sections.experience && sections.experience.includes('\n')) {
      const lines = sections.experience.split('\n');
      const bulletPoints = lines.filter(line => line.trim().startsWith('•') || line.trim().startsWith('-')).length;
      
      if (bulletPoints > 3) {
        strengths.push("Good use of bullet points to highlight achievements");
      }
    }
    
    // Check for contact information
    if (sections.contact && sections.contact.length > 50) {
      strengths.push("Complete contact information section");
    }
    
    // Check for skills section
    if (sections.skills && sections.skills.length > 100) {
      strengths.push("Comprehensive skills section that aids ATS matching");
    }
    
    // Return top 3 strengths
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

  const formatAtsScore = (score: number | string): string => {
    if (typeof score === 'number') {
      return `${Math.round(score)}%`;
    }
    return score.toString();
  };

  const getTopKeywords = () => {
    if (!analysis?.keywordAnalysis) return [];
    
    return Object.entries(analysis.keywordAnalysis)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword, score]) => ({ keyword, score }));
  };

  return (
    <Card className="w-full bg-[#050505] border-gray-800 shadow-xl overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-gray-800 pb-3">
        <CardTitle className="flex items-center text-white">
          <BarChart2 className="w-5 h-5 mr-2 text-[#B4916C]" />
          CV Analysis
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-6">
        {!analysis && !loading && (
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0 mb-4">
              <div className="w-full">
                <CVCombobox
                  cvs={cvs}
                  onSelect={handleCVSelect}
                  placeholder="Select a CV"
                  darkMode={true}
                  accentColor="#B4916C"
                />
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={!selectedCVId || loading}
                className="bg-[#B4916C] hover:bg-[#A3815C] text-white whitespace-nowrap w-full sm:w-auto"
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
          <Alert className="mb-4 bg-red-900/20 text-red-400 border border-red-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {analysis && (
          <div className="space-y-6 overflow-x-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-[#0A0A0A] rounded-lg border border-gray-800">
              <div>
                <h3 className="text-white font-medium mb-1">ATS Compatibility Score</h3>
                <div className="flex items-center">
                  <div className="text-3xl font-bold text-[#B4916C]">{formatAtsScore(analysis.atsScore)}</div>
                  <div className="ml-2 text-gray-400 text-sm">/ 100</div>
                </div>
              </div>
              
              <div>
                <h3 className="text-white font-medium mb-1">Industry</h3>
                <div className="flex items-center text-gray-300">
                  <Building className="w-4 h-4 mr-1 text-[#B4916C]" />
                  {analysis.industry}
                </div>
              </div>
              
              {onAnalysisComplete && (
                <Button 
                  onClick={() => selectedCVId && onAnalysisComplete(selectedCVId)}
                  className="bg-[#B4916C] hover:bg-[#A3815C] text-white mt-2 sm:mt-0 w-full sm:w-auto"
                >
                  Optimize CV <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">CV Format Strengths</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {(analysis.formattingStrengths || []).map((strength, index) => (
                  <li key={`format-strength-${index}`} className="text-sm">{strength}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">CV Format Weaknesses</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {(analysis.formattingWeaknesses || []).map((weakness, index) => (
                  <li key={`format-weakness-${index}`} className="text-sm">{weakness}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">CV Format Recommendations</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {(analysis.formattingRecommendations || []).map((recommendation, index) => (
                  <li key={`format-recommendation-${index}`} className="text-sm">{recommendation}</li>
                ))}
              </ul>
            </div>
            
            {analysis.industry && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
                  <Building className="h-4 w-4 mr-2 text-[#B4916C]" />
                  Industry
                </h3>
                <div className="text-gray-300 mb-2">
                  <span className="px-2 py-1 bg-[#B4916C]/10 text-[#B4916C] rounded-md">
                    {analysis.industry}
                  </span>
                </div>
                {analysis.industryInsight && (
                  <p className="text-gray-400 text-sm">{analysis.industryInsight}</p>
                )}
              </div>
            )}
            
            {analysis.keywordAnalysis && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Top Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {getTopKeywords().map(({ keyword, score }) => (
                    <span 
                      key={keyword} 
                      className="px-2 py-1 bg-[#B4916C]/10 text-[#B4916C] rounded-md text-sm"
                    >
                      {keyword} ({score})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
