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
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border-transparent">
      <CardContent>
        <div className="flex justify-center items-center h-24 bg-gray-100 rounded-lg mb-4">
          <video
            className="w-full h-auto"
            controls
            src="/animations/Leap Back In copy.mp4"
            loop
            muted
            autoPlay
            playsInline
            style={{ objectFit: "cover" }}
          />
        </div>
        <ComboboxPopover
          label="Select a CV"
          options={cvs}
          onSelect={(selectedCV: string) => {
            console.log("Selected CV for analysis:", selectedCV);
            handleAnalyze(selectedCV);
          }}
        />
        {loading && <p className="mt-4 text-sm">Analyzing CV...</p>}
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        {analysis && (
          <Article className="mt-4 p-4 border rounded shadow-sm">
            <ArticleTitle className="text-base mb-2">CV Analysis</ArticleTitle>
            <ArticleMeta className="text-xs text-gray-600 mb-2">
              ATS Score: {analysis.atsScore}%
            </ArticleMeta>
            <ArticleContent className="text-sm mb-2">
              <strong>Strengths:</strong>
              <ul className="list-disc ml-4 mt-1">
                {analysis.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </ArticleContent>
            <ArticleContent className="text-sm mb-2">
              <strong>Weaknesses:</strong>
              <ul className="list-disc ml-4 mt-1">
                {analysis.weaknesses.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </ArticleContent>
            <ArticleContent className="text-sm">
              <strong>Recommendations:</strong>
              <ul className="list-disc ml-4 mt-1">
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
