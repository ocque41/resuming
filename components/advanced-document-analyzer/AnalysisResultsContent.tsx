import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, BarChart2, ArrowRight } from 'lucide-react';
import AnalysisKeyPoints from './AnalysisKeyPoints';
import AnalysisRecommendations from './AnalysisRecommendations';
import AnalysisInsights from './AnalysisInsights';

interface AnalysisResultsContentProps {
  result: any;
  documentId: string;
}

export default function AnalysisResultsContent({ result, documentId }: AnalysisResultsContentProps) {
  if (!result) {
    return (
      <div className="p-6 bg-[#111111] rounded-xl border border-[#222222]">
        <p className="text-[#8A8782] text-center">No analysis results available</p>
      </div>
    );
  }

  const {
    summary,
    keyPoints,
    recommendations,
    insights,
    topics,
    entities,
    sentiment,
    languageQuality
  } = result;

  return (
    <div className="space-y-6">
      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
          <CardTitle className="text-lg font-medium text-[#F9F6EE]">
            Document Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <p className="text-[#E2DFD7] text-sm leading-relaxed whitespace-pre-line">{summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnalysisKeyPoints keyPoints={keyPoints} />
        <AnalysisRecommendations recommendations={recommendations} />
      </div>

      <AnalysisInsights insights={insights} topics={topics} />
    </div>
  );
}
