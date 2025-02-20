// AnalyzeCVCard.client.tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ComboboxPopover } from "@/components/ui/combobox";

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
          {/* Pure decorative animation placeholder */}
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
          <div className="mt-4 text-sm">
            <p><strong>ATS Score:</strong> {analysis.atsScore}%</p>
            <p><strong>Strengths:</strong> {analysis.strengths.join(", ")}</p>
            <p><strong>Weaknesses:</strong> {analysis.weaknesses.join(", ")}</p>
            <p><strong>Recommendations:</strong> {analysis.recommendations.join(", ")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
