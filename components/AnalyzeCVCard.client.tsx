// AnalyzeCVCard.client.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComboboxPopover } from "@/components/ui/combobox";
import { Article, ArticleTitle, ArticleMeta, ArticleContent } from "@/components/ui/article";

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
    if (typeof score === 'string') {
      // If it already has a % symbol, return as is
      if (score.includes('%')) {
        return score;
      }
      // Try to parse as number and add %
      const numericValue = parseInt(score.replace(/[^0-9]/g, ''));
      if (!isNaN(numericValue)) {
        return `${numericValue}%`;
      }
    }
    return '0%'; // Fallback
  };

  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-[#B4916C]/10 pb-4">
        <CardTitle className="text-xl font-bold text-[#B4916C]">Analyze Your CV</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex justify-center items-center mb-6">
          <div className="relative w-48 h-48 rounded-lg overflow-hidden">
            <img
              src="/Animation - 1741203789959 (1).gif"
              alt="CV Analysis Animation"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent opacity-20"></div>
          </div>
        </div>
        
        <div className="mb-6">
          <ComboboxPopover
            label="Select CV to Analyze"
            options={cvs}
            onSelect={(selectedCV: string) => {
              console.log("Selected CV for analysis:", selectedCV);
              handleAnalyze(selectedCV);
            }}
            accentColor="#B4916C"
            darkMode={true}
          />
        </div>
        
        {loading && (
          <div className="mt-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#B4916C]"></div>
            <p className="ml-2 text-sm text-gray-400">Analyzing CV...</p>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-md">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        
        {analysis && (
          <Article className="mt-6 p-5 border border-[#B4916C]/20 rounded-lg shadow-sm bg-[#050505]">
            <ArticleTitle className="text-lg font-semibold mb-3 text-[#B4916C]">CV Analysis Results</ArticleTitle>
            <ArticleMeta className="text-sm mb-4 flex items-center">
              <span className="font-medium mr-2 text-gray-300">ATS Score:</span>
              <span className="px-3 py-1 bg-[#B4916C]/10 rounded-full text-[#B4916C] font-semibold">
                {formatAtsScore(analysis.atsScore)}
              </span>
            </ArticleMeta>
            
            <ArticleContent className="text-sm mb-4">
              <h3 className="font-semibold mb-2 text-[#B4916C]">Strengths:</h3>
              <ul className="list-disc ml-5 space-y-1 text-gray-300">
                {analysis.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </ArticleContent>
            
            <ArticleContent className="text-sm mb-4">
              <h3 className="font-semibold mb-2 text-[#B4916C]">Weaknesses:</h3>
              <ul className="list-disc ml-5 space-y-1 text-gray-300">
                {analysis.weaknesses.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </ArticleContent>
            
            <ArticleContent className="text-sm mb-4">
              <h3 className="font-semibold mb-2 text-[#B4916C]">Recommendations:</h3>
              <ul className="list-disc ml-5 space-y-1 text-gray-300">
                {analysis.recommendations.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </ArticleContent>
            
            {analysis.industryInsight && (
              <ArticleContent className="text-sm mb-4">
                <h3 className="font-semibold mb-2 text-[#B4916C]">Industry Insight:</h3>
                <p className="text-gray-300">{analysis.industryInsight}</p>
              </ArticleContent>
            )}
            
            {analysis.targetRoles && analysis.targetRoles.length > 0 && (
              <ArticleContent className="text-sm">
                <h3 className="font-semibold mb-2 text-[#B4916C]">Target Roles:</h3>
                <ul className="list-disc ml-5 space-y-1 text-gray-300">
                  {analysis.targetRoles.map((role, idx) => (
                    <li key={idx}>{role}</li>
                  ))}
                </ul>
              </ArticleContent>
            )}
          </Article>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
