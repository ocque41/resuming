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

  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-white/90 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-[#B4916C]/10 pb-4">
        <CardTitle className="text-xl font-bold text-[#B4916C]">Analyze Your CV</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex justify-center items-center h-48 bg-gray-50 rounded-lg mb-6 overflow-hidden">
          <img
            src="/animations/leep.gif"
            alt="Animation"
            className="w-full h-full object-cover"
          />
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
          />
        </div>
        
        {loading && (
          <div className="mt-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#B4916C]"></div>
            <p className="ml-2 text-sm text-gray-600">Analyzing CV...</p>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
        
        {analysis && (
          <Article className="mt-6 p-5 border border-[#B4916C]/20 rounded-lg shadow-sm bg-white">
            <ArticleTitle className="text-lg font-semibold mb-3 text-[#B4916C]">CV Analysis Results</ArticleTitle>
            <ArticleMeta className="text-sm mb-4 flex items-center">
              <span className="font-medium mr-2">ATS Score:</span>
              <span className="px-3 py-1 bg-[#B4916C]/10 rounded-full text-[#B4916C] font-semibold">
                {analysis.atsScore}
              </span>
            </ArticleMeta>
            
            <ArticleContent className="text-sm mb-4">
              <h3 className="font-semibold mb-2 text-[#B4916C]">Strengths:</h3>
              <ul className="list-disc ml-5 space-y-1 text-gray-700">
                {analysis.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </ArticleContent>
            
            <ArticleContent className="text-sm mb-4">
              <h3 className="font-semibold mb-2 text-[#B4916C]">Weaknesses:</h3>
              <ul className="list-disc ml-5 space-y-1 text-gray-700">
                {analysis.weaknesses.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </ArticleContent>
            
            <ArticleContent className="text-sm">
              <h3 className="font-semibold mb-2 text-[#B4916C]">Recommendations:</h3>
              <ul className="list-disc ml-5 space-y-1 text-gray-700">
                {analysis.recommendations.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </ArticleContent>
          </Article>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
