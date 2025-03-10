// AnalyzeCVCard.client.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComboboxPopover } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart2, Building, FileText, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getIndustrySpecificAtsInsights } from "@/lib/cvAnalyzer";

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
}

interface AnalyzeCVCardProps {
  cvs: string[];
  onAnalysisComplete?: (cvId: string) => void;
  children?: React.ReactNode;
}

export default function AnalyzeCVCard({ cvs, onAnalysisComplete, children }: AnalyzeCVCardProps) {
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prepare CV options for the dropdown
  const dropdownOptions = useCallback(() => {
    if (!Array.isArray(cvs)) {
      console.error("CV options is not an array:", cvs);
      return [];
    }
    
    return cvs.map(cv => {
      if (typeof cv !== 'string') {
        console.error("CV option is not a string:", cv);
        return null;
      }
      
      const parts = cv.split('|');
      return parts[0] ? parts[0].trim() : null;
    }).filter(Boolean) as string[];
  }, [cvs]);
  
  // Get CV ID from filename
  const getCvIdFromName = useCallback((name: string) => {
    if (!Array.isArray(cvs)) return null;
    
    const matchingCv = cvs.find(cv => {
      if (typeof cv !== 'string') return false;
      const parts = cv.split('|');
      return parts[0] && parts[0].trim() === name;
    });
    
    if (!matchingCv) return null;
    
    const parts = matchingCv.split('|');
    return parts[1] || null;
  }, [cvs]);
  
  // Handle CV selection
  const handleCVSelect = useCallback((name: string) => {
    console.log("CV selected for analysis:", name);
    setSelectedCVName(name);
    
    const cvId = getCvIdFromName(name);
    console.log("CV ID found for analysis:", cvId);
    
    if (cvId) {
      setSelectedCVId(cvId);
      setSelectedCV(`${name}|${cvId}`);
    } else {
      setError("Could not find CV ID for the selected CV. Please try another CV.");
      setSelectedCVId(null);
      setSelectedCV(null);
    }
  }, [getCvIdFromName]);

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
        
        setAnalysis(data);
        
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

  // Debug log for props and state
  useEffect(() => {
    console.log("AnalyzeCVCard props:", { cvs });
    console.log("Dropdown options:", dropdownOptions());
  }, [cvs, dropdownOptions]);

  return (
    <Card className="bg-[#050505] border-gray-800 shadow-xl overflow-hidden">
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
              <div className="flex-grow">
                <ComboboxPopover
                  options={dropdownOptions()}
                  label="Select a CV"
                  onSelect={handleCVSelect}
                  accentColor="#B4916C"
                  darkMode={true}
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
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Strengths</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {analysis.strengths.map((strength, index) => (
                  <li key={`strength-${index}`} className="text-sm">{strength}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Weaknesses</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {analysis.weaknesses.map((weakness, index) => (
                  <li key={`weakness-${index}`} className="text-sm">{weakness}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Recommendations</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {analysis.recommendations.map((recommendation, index) => (
                  <li key={`recommendation-${index}`} className="text-sm">{recommendation}</li>
                ))}
              </ul>
            </div>
            
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
