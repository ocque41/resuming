// AnalyzeCVCard.client.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComboboxPopover } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart2, Building, FileText } from "lucide-react";
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
  children?: React.ReactNode;
}

export default function AnalyzeCVCard({ cvs, children }: AnalyzeCVCardProps) {
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!selectedCV) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analyze-cv?fileName=${encodeURIComponent(selectedCV)}`);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        // If industry is detected but no industry insight is provided, get one
        if (data.industry && !data.industryInsight) {
          try {
            const insight = getIndustrySpecificAtsInsights(data.industry);
            data.industryInsight = insight;
          } catch (insightError) {
            console.error("Failed to get industry insights:", insightError);
          }
        }
        setAnalysis(data);
      }
    } catch (err: any) {
      setError("Failed to analyze CV.");
    } finally {
      setLoading(false);
    }
  }

  // Format ATS score with percentage symbol
  const formatAtsScore = (score: number | string): string => {
    if (typeof score === 'number') {
      return `${score}%`;
    }
    return String(score);
  };

  // Get the top keywords from keywordAnalysis
  const getTopKeywords = () => {
    if (!analysis?.keywordAnalysis) return [];
    
    // Convert to array, sort by count, and take top 5
    return Object.entries(analysis.keywordAnalysis)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword, count]) => ({ keyword, count }));
  };

  return (
    <Card className="bg-[#050505] border-gray-800 shadow-xl overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-gray-800 pb-3">
        <CardTitle className="flex items-center text-white">
          <BarChart2 className="w-5 h-5 mr-2 text-[#B4916C]" />
          CV Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {!analysis && (
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-2">
                <div className="flex-grow">
                  <ComboboxPopover
                    options={cvs}
                    label="Select a CV"
                    onSelect={(cv) => setSelectedCV(cv)}
                    accentColor="#B4916C"
                    darkMode={true}
                  />
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={!selectedCV || loading}
                  className="bg-[#B4916C] hover:bg-[#A3815C] text-white whitespace-nowrap"
                >
                  {loading ? "Analyzing..." : "Analyze"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <Alert className="mb-4 bg-red-900/20 text-red-400 border border-red-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-10 h-10 border-2 border-[#B4916C] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400">Analyzing your CV...</p>
          </div>
        )}

        {analysis && !loading && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">ATS Score</h3>
              <div className="text-2xl font-bold text-[#B4916C]">
                {formatAtsScore(analysis.atsScore)}
              </div>
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
              </div>
            )}
            
            {analysis.keywordAnalysis && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-[#B4916C]" />
                  Top Keywords
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {getTopKeywords().map((item, index) => (
                    <span key={index} className="px-2 py-1 bg-[#B4916C]/10 text-[#B4916C] rounded-md text-sm">
                      {item.keyword} ({item.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Strengths</h3>
              <ul className="space-y-2">
                {analysis.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="text-gray-300">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Areas for Improvement</h3>
              <ul className="space-y-2">
                {analysis.weaknesses.map((weakness, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-red-500 mr-2">✗</span>
                    <span className="text-gray-300">{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Recommendations</h3>
              <ul className="space-y-2">
                {analysis.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-[#B4916C] mr-2">→</span>
                    <span className="text-gray-300">{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {analysis.industryInsight && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Industry Insight</h3>
                <p className="text-gray-300 p-3 border border-[#B4916C]/20 rounded-md bg-[#B4916C]/5">{analysis.industryInsight}</p>
              </div>
            )}
            
            {analysis.targetRoles && analysis.targetRoles.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Suitable Roles</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.targetRoles.map((role, index) => (
                    <span 
                      key={index} 
                      className="px-2 py-1 bg-[#B4916C]/10 text-[#B4916C] rounded-full text-sm"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-4">
              <Button 
                onClick={() => setAnalysis(null)} 
                className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white"
              >
                Analyze Another CV
              </Button>
            </div>
          </div>
        )}
        
        {!analysis && !loading && !selectedCV && (
          <div className="text-center py-8 text-gray-400">
            Select a CV to analyze its strengths and weaknesses
          </div>
        )}
      </CardContent>
    </Card>
  );
}
