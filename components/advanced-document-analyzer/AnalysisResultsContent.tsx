import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, BarChart2, ArrowRight, AlertCircle } from 'lucide-react';
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
  // Track component mount state
  const isMounted = React.useRef(true);
  
  // Track result changes
  const [processedResult, setProcessedResult] = React.useState<any>(null);
  const resultRef = React.useRef<any>(null);
  
  // Log component lifecycle and result changes
  React.useEffect(() => {
    console.log("AnalysisResultsContent mounted");
    return () => {
      console.log("AnalysisResultsContent unmounting");
      isMounted.current = false;
    };
  }, []);

  // Process and validate result when it changes
  React.useEffect(() => {
    console.log("AnalysisResultsContent received new result:", {
      hasResult: !!result,
      resultType: result ? typeof result : 'null',
      documentId
    });

    if (result) {
      try {
        // Store in ref for comparison
        resultRef.current = result;
        
        // Validate result structure
        const isValidResult = (
          typeof result === 'object' &&
          result !== null &&
          (
            'summary' in result ||
            'keyPoints' in result ||
            'insights' in result
          )
        );

        if (!isValidResult) {
          console.error("Invalid result structure:", result);
          throw new Error("Invalid analysis result structure");
        }

        // Process the result if component is still mounted
        if (isMounted.current) {
          console.log("Setting processed result");
          setProcessedResult(result);
        }
      } catch (error) {
        console.error("Error processing analysis result:", error);
        // Set error state in processed result
        if (isMounted.current) {
          setProcessedResult({
            error: true,
            message: error instanceof Error ? error.message : "Failed to process analysis result"
          });
        }
      }
    } else {
      // Clear processed result if input is null
      if (isMounted.current) {
        setProcessedResult(null);
      }
    }
  }, [result, documentId]);

  // If we have no result or an error result, show appropriate message
  if (!processedResult) {
    console.warn("AnalysisResultsContent: No processed result available");
    return (
      <div className="p-6 border border-dashed border-[#333333] rounded-lg bg-[#0A0A0A] text-center">
        <FileText className="h-6 w-6 text-[#8A8782] mx-auto mb-3" />
        <h3 className="text-[#F9F6EE] font-medium">No Analysis Results</h3>
        <p className="text-[#8A8782] text-sm mt-1">Analysis results will appear here.</p>
      </div>
    );
  }

  if (processedResult.error) {
    return (
      <div className="p-6 border border-dashed border-[#333333] rounded-lg bg-[#0A0A0A] text-center">
        <AlertCircle className="h-6 w-6 text-[#EF4444] mx-auto mb-3" />
        <h3 className="text-[#EF4444] font-medium">Error Processing Results</h3>
        <p className="text-[#8A8782] text-sm mt-1">{processedResult.message}</p>
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
      
      const normalized = {
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

      console.log("Normalized data:", {
        hasSummary: !!normalized.summary,
        keyPointsCount: normalized.keyPoints.length,
        recommendationsCount: normalized.recommendations.length,
        hasInsights: !!normalized.insights,
        topicsCount: normalized.topics.length,
        entitiesCount: normalized.entities.length,
        hasSentiment: !!normalized.sentiment,
        hasLanguageQuality: !!normalized.languageQuality,
        timelineCount: normalized.timeline.length
      });

      return normalized;
    } catch (error) {
      console.error("Error normalizing analysis data:", error);
      throw error;
    }
  };

  // Try to normalize the data, with error boundary
  let data;
  try {
    data = normalizeData(processedResult);
  } catch (error) {
    console.error("Failed to normalize result data:", error);
    return (
      <div className="p-6 border border-dashed border-[#333333] rounded-lg bg-[#0A0A0A] text-center">
        <AlertCircle className="h-6 w-6 text-[#EF4444] mx-auto mb-3" />
        <h3 className="text-[#EF4444] font-medium">Error Processing Results</h3>
        <p className="text-[#8A8782] text-sm mt-1">Failed to process analysis results. Please try again.</p>
      </div>
    );
  }

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
