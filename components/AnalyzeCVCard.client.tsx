// AnalyzeCVCard.client.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComboboxPopover } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AnalysisResult {
  atsScore: number | string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
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

  async function handleAnalyze(cv: string) {
    setSelectedCV(cv);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analyze-cv?fileName=${encodeURIComponent(cv)}`);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
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

  return (
    <Card className="w-full shadow-lg border-0">
      <CardHeader className="bg-[#121212] text-white rounded-t-lg">
        <CardTitle className="text-[#B4916C] flex items-center gap-2">
          <BarChart2 className="h-5 w-5" />
          <span>Analyze Your CV</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="mb-4">
          <ComboboxPopover
            label="Select CV to Analyze"
            options={cvs}
            onSelect={handleAnalyze}
            accentColor="#B4916C"
          />
        </div>
        
        {error && (
          <Alert className="mb-4 bg-red-900/20 border-red-900/20 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#B4916C]"></div>
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
                <p className="text-gray-300">{analysis.industryInsight}</p>
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
