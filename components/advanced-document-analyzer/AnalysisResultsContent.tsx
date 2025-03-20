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

  // Normalize the data structure to handle different API formats
  const normalizeData = (result: any) => {
    // Handle topics that might be in different formats
    const normalizedTopics = (result.topics || []).map((topic: any) => {
      if (topic.topic && topic.relevance) {
        // Handle old API format with {topic, relevance} structure
        return { name: topic.topic, relevance: topic.relevance };
      } else if (topic.name && topic.relevance) {
        // Handle new API format with {name, relevance} structure
        return topic;
      } else {
        // Handle unexpected format with a default
        const topicName = topic.name || topic.topic || String(topic);
        return { name: topicName, relevance: topic.relevance || 0.5 };
      }
    });

    // Handle entities that might be in different formats
    const normalizedEntities = (result.entities || []).map((entity: any) => {
      // Ensure all entities have standard fields
      return {
        name: entity.name || "Unknown",
        type: entity.type || "OTHER",
        count: entity.count || entity.mentions || 1
      };
    });

    // Handle sentiment data
    const normalizedSentiment = result.sentiment ? {
      overall: result.sentiment.overall || "neutral",
      score: result.sentiment.score || 0,
      sentimentBySection: result.sentiment.sentimentBySection || []
    } : undefined;

    // Handle insights data which could be an array or object
    let normalizedInsights;
    if (Array.isArray(result.insights)) {
      // Convert array format to object format
      normalizedInsights = result.insights.reduce((obj: any, item: any) => {
        obj[item.name.toLowerCase().replace(/\s+/g, '')] = item.value;
        return obj;
      }, {});
    } else if (typeof result.insights === 'object' && result.insights !== null) {
      normalizedInsights = result.insights;
    } else {
      // Default empty insights
      normalizedInsights = {
        clarity: 50,
        relevance: 50,
        completeness: 50,
        conciseness: 50
      };
    }

    // Handle timeline data
    const normalizedTimeline = (result.timeline || []).map((entry: any) => {
      return {
        date: entry.date || entry.period || "Unknown date",
        event: entry.event || entry.entity || "Unknown event"
      };
    });

    return {
      summary: result.summary || "No summary available",
      keyPoints: result.keyPoints || [],
      recommendations: result.recommendations || [],
      insights: normalizedInsights,
      topics: normalizedTopics,
      entities: normalizedEntities,
      sentiment: normalizedSentiment,
      languageQuality: result.languageQuality || undefined,
      timeline: normalizedTimeline
    };
  };

  // Normalize the data
  const normalizedResult = normalizeData(result);

  // Extract fields with null/undefined checks
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
  } = normalizedResult;

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
        <AnalysisInsights insights={insights} topics={topics} />
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
