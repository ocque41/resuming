// AnalyzeCVCard.client.tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
}

export default function AnalyzeCVCard({ cvs }: AnalyzeCVCardProps) {
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
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border-transparent">
      <CardContent>
        <div className="flex justify-center items-center h-32 bg-gray-100 rounded-lg mb-4">
          {/* Pure decorative animation */}
          <span className="text-gray-500">Animation Placeholder</span>
        </div>
        <ComboboxPopover
          label="Select a CV"
          options={cvs}
          onSelect={(selectedCV: string) => {
            console.log("Selected CV for analysis:", selectedCV);
            handleAnalyze(selectedCV);
          }}
        />
        {loading && <p className="mt-4">Analyzing CV...</p>}
        {error && <p className="mt-4 text-red-500">{error}</p>}
        {analysis && (
          <Article className="mt-4">
            <ArticleTitle>CV Analysis Results</ArticleTitle>
            <ArticleMeta>ATS Score: {analysis.atsScore}%</ArticleMeta>
            <ArticleContent>
              <strong>Strengths:</strong>
              <ul>
                {analysis.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
              <strong>Weaknesses:</strong>
              <ul>
                {analysis.weaknesses.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
              <strong>Recommendations:</strong>
              <ul>
                {analysis.recommendations.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </ArticleContent>
          </Article>
        )}
      </CardContent>
    </Card>
  );
}
