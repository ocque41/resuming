import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, BarChart2, ArrowRight } from 'lucide-react';
import AnalysisKeyPoints from './AnalysisKeyPoints';
import AnalysisRecommendations from './AnalysisRecommendations';
import AnalysisInsights from './AnalysisInsights';
import AnalysisSentiment from './AnalysisSentiment';
import AnalysisLanguageQuality from './AnalysisLanguageQuality';
import AnalysisEntities from './AnalysisEntities';
import AnalysisTimeline from './AnalysisTimeline';
import { AnalysisResult } from './types';

interface AnalysisResultsContentProps {
  result: AnalysisResult | null;
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
    sentimentBySection,
    languageQuality,
    timeline
  } = result;

  // Convert API topic format to component format if needed
  const formattedTopics = topics?.map(topic => {
    if ('topic' in topic) {
      return {
        name: topic.topic,
        relevance: topic.relevance
      };
    }
    return topic;
  });

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

      <AnalysisInsights insights={insights} topics={formattedTopics} />
      
      {/* Add sentiment analysis component if sentiment data is available */}
      {sentiment && <AnalysisSentiment sentiment={sentiment} sentimentBySection={sentimentBySection} />}
      
      {/* Add language quality component if language quality data is available */}
      {languageQuality && <AnalysisLanguageQuality languageQuality={languageQuality} />}
      
      {/* Add entities component if entities data is available */}
      {entities && entities.length > 0 && <AnalysisEntities entities={entities} />}
      
      {/* Add timeline component if timeline data is available */}
      {timeline && timeline.length > 0 && <AnalysisTimeline timeline={timeline} />}
    </div>
  );
}
