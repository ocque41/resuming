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
import { AnalysisResult, DocumentTopic, ApiDocumentTopic } from './types';

interface AnalysisResultsContentProps {
  result: AnalysisResult | null;
  documentId: string;
}

export default function AnalysisResultsContent({ result, documentId }: AnalysisResultsContentProps) {
  // If result is null, show a fallback message
  if (!result) {
    return (
      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-safiro text-[#F9F6EE]">Analysis Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#8A8782]">No analysis results available. Please try analyzing the document again.</p>
        </CardContent>
      </Card>
    );
  }

  // Extract fields from result, with null/undefined checks
  const { 
    summary, 
    keyPoints = [], 
    recommendations = [], 
    insights, 
    topics = [],
    entities = [],
    sentiment,
    languageQuality,
    timeline = []
  } = result;
  
  // Format topics if needed
  const formattedTopics = topics.map((topic: any) => {
    // Handle different topic formats from API
    if ('topic' in topic) {
      return { name: topic.topic, relevance: topic.relevance };
    }
    return topic;
  });

  return (
    <div className="space-y-6">
      {/* Document Summary */}
      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-safiro text-[#F9F6EE]">Document Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#C5C2BA]">{summary || 'No summary available'}</p>
        </CardContent>
      </Card>

      {/* Key Points & Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {keyPoints && keyPoints.length > 0 && (
          <AnalysisKeyPoints keyPoints={keyPoints} />
        )}
        
        {recommendations && recommendations.length > 0 && (
          <AnalysisRecommendations recommendations={recommendations} />
        )}
      </div>

      {/* Insights */}
      {insights && (
        <AnalysisInsights insights={insights} topics={formattedTopics} />
      )}

      {/* Sentiment Analysis */}
      {sentiment && (
        <AnalysisSentiment sentiment={sentiment} />
      )}
      
      {/* Language Quality */}
      {languageQuality && (
        <AnalysisLanguageQuality languageQuality={languageQuality} />
      )}

      {/* Entities */}
      {entities && entities.length > 0 && (
        <AnalysisEntities entities={entities} />
      )}

      {/* Timeline */}
      {timeline && timeline.length > 0 && (
        <AnalysisTimeline timeline={timeline} />
      )}
    </div>
  );
}
