import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, BarChart2, ArrowRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AnalysisKeyPoints from './AnalysisKeyPoints';
import AnalysisRecommendations from './AnalysisRecommendations';
import AnalysisInsights from './AnalysisInsights';
import AnalysisSentiment from './AnalysisSentiment';
import AnalysisEntities from './AnalysisEntities';
import AnalysisLanguageQuality from './AnalysisLanguageQuality';
import AnalysisTimeline from './AnalysisTimeline';
import { AnalysisResult, DocumentTopic, ApiDocumentTopic } from './types';

interface AnalysisResultsContentProps {
  result: AnalysisResult | null;
  documentId: string;
}

export default function AnalysisResultsContent({ result, documentId }: AnalysisResultsContentProps) {
  // Log a message when the component is rendered with its props
  React.useEffect(() => {
    console.log("AnalysisResultsContent rendered with:", 
      result ? "Result provided" : "No result", 
      "DocumentId:", documentId);
    if (result) {
      console.log("Result structure:", Object.keys(result));
    }
  }, [result, documentId]);

  // If result is null, show a fallback message
  if (!result) {
    console.warn("AnalysisResultsContent: No result data provided");
    return (
      <div className="p-6 border border-dashed border-[#333333] rounded-lg bg-[#0A0A0A] text-center">
        <FileText className="h-6 w-6 text-[#8A8782] mx-auto mb-3" />
        <h3 className="text-[#F9F6EE] font-medium">No Analysis Results</h3>
        <p className="text-[#8A8782] text-sm mt-1">Analysis results will appear here.</p>
      </div>
    );
  }

  // Function to normalize data from different response formats
  const normalizeData = (result: any) => {
    console.log("Normalizing data for display");
    try {
      // Check if we have the key data we need
      const hasSummary = !!result.summary;
      const hasKeyPoints = Array.isArray(result.keyPoints) && result.keyPoints.length > 0;
      const hasInsights = !!result.insights;
      
      console.log("Data validation:", { 
        hasSummary, 
        hasKeyPoints, 
        hasInsights,
        insightsType: typeof result.insights
      });

      // Process recommendations
      let recommendations = Array.isArray(result.recommendations) 
        ? result.recommendations 
        : [];
      
      // Process topics if available
      let topics = result.topics || [];
      if (!Array.isArray(topics)) {
        console.warn("Topics is not an array:", topics);
        topics = [];
      }
      
      // Process entities if available
      let entities = result.entities || [];
      if (!Array.isArray(entities)) {
        console.warn("Entities is not an array:", entities);
        entities = [];
      }
      
      return {
        summary: result.summary || "No summary available",
        keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
        recommendations,
        insights: result.insights || {},
        topics,
        entities,
        sentiment: result.sentiment || { overall: "neutral", score: 0.5 },
        languageQuality: result.languageQuality || null,
        timeline: Array.isArray(result.timeline) ? result.timeline : []
      };
    } catch (error) {
      console.error("Error normalizing analysis data:", error);
      // Return a safe default
      return {
        summary: "Error processing analysis results",
        keyPoints: [],
        recommendations: [],
        insights: {},
        topics: [],
        entities: [],
        sentiment: { overall: "neutral", score: 0.5 },
        languageQuality: null,
        timeline: []
      };
    }
  };

  // Normalize the data
  const data = normalizeData(result);
  
  // Log the normalized data for debugging
  console.log("Using normalized data with sections:", {
    keyPointsCount: data.keyPoints.length,
    recommendationsCount: data.recommendations.length,
    hasTopics: data.topics && data.topics.length > 0,
    hasEntities: data.entities && data.entities.length > 0,
    hasLanguageQuality: !!data.languageQuality,
    hasTimeline: data.timeline && data.timeline.length > 0
  });

  return (
    <>
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="w-full mb-6 bg-[#161616] border border-[#222222]">
          <TabsTrigger value="summary" className="data-[state=active]:bg-[#222222] text-sm">
            Summary
          </TabsTrigger>
          <TabsTrigger value="insights" className="data-[state=active]:bg-[#222222] text-sm">
            Insights
          </TabsTrigger>
          <TabsTrigger value="entities" className="data-[state=active]:bg-[#222222] text-sm">
            Entities
          </TabsTrigger>
          <TabsTrigger value="language" className="data-[state=active]:bg-[#222222] text-sm">
            Language
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="space-y-6">
          <div className="bg-[#0A0A0A] p-5 rounded-lg border border-[#222222]">
            <h3 className="text-lg font-medium text-[#F9F6EE] mb-3">Document Summary</h3>
            <p className="text-[#E2DFD7] text-sm leading-relaxed">{data.summary}</p>
          </div>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AnalysisKeyPoints keyPoints={data.keyPoints} />
            <AnalysisRecommendations recommendations={data.recommendations} />
          </div>
        </TabsContent>
        
        <TabsContent value="insights" className="space-y-6">
          <AnalysisInsights 
            insights={data.insights} 
            topics={data.topics} 
          />
          
          {data.sentiment && (
            <AnalysisSentiment sentiment={data.sentiment} />
          )}
          
          {data.timeline && data.timeline.length > 0 && (
            <AnalysisTimeline timeline={data.timeline} />
          )}
        </TabsContent>
        
        <TabsContent value="entities" className="space-y-6">
          {data.entities && data.entities.length > 0 ? (
            <AnalysisEntities entities={data.entities} />
          ) : (
            <div className="p-6 border border-dashed border-[#333333] rounded-lg bg-[#0A0A0A] text-center">
              <h3 className="text-[#F9F6EE] font-medium">No Entities Found</h3>
              <p className="text-[#8A8782] text-sm mt-1">No named entities were detected in this document.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="language" className="space-y-6">
          {data.languageQuality ? (
            <AnalysisLanguageQuality languageQuality={data.languageQuality} />
          ) : (
            <div className="p-6 border border-dashed border-[#333333] rounded-lg bg-[#0A0A0A] text-center">
              <h3 className="text-[#F9F6EE] font-medium">Language Analysis Not Available</h3>
              <p className="text-[#8A8782] text-sm mt-1">Language quality metrics are not available for this document.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
