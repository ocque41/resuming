import React, { useEffect, useState, useRef } from 'react';
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
import AnalysisSummary from './AnalysisSummary';
import AnalysisTopics from './AnalysisTopics';
import { Button } from '@/components/ui/button';

interface AnalysisResultsContentProps {
  result: AnalysisResult | null;
  documentId: string;
}

// Add a development-only debug flag to always try to show something
const FORCE_DISPLAY = process.env.NODE_ENV === 'development';

const AnalysisResultsContent: React.FC<AnalysisResultsContentProps> = ({ result, documentId }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [hasRendered, setHasRendered] = useState(false);
  const [debugState, setDebugState] = useState({
    forceDisplay: false,
    forcedDisplay: false
  });
  
  // Add ref to track the component's mounted state
  const mountedRef = useRef(true);
  
  // Helper function to create mock data for debugging purposes
  const createMockAnalysis = (docId: string): AnalysisResult => {
    return {
      documentId: docId,
      fileName: 'sample-document.pdf',
      analysisType: 'general',
      summary: 'This is a sample document for testing the analyzer component. The content appears to be a mock document created for UI testing purposes.',
      keyPoints: [
        'This is a sample document for testing',
        'Document analyzer UI is being tested',
        'Results display is being verified',
        'Component should handle various data formats'
      ],
      recommendations: [
        'Add more content to make the document more comprehensive',
        'Include specific details related to the subject matter',
        'Consider reorganizing sections for better flow',
        'Proofread for any grammatical errors'
      ],
      insights: {
        clarity: 0.75,
        relevance: 0.8,
        completeness: 0.65,
        conciseness: 0.9,
        structure: 0.7,
        engagement: 0.85,
        contentquality: 0.75,
        overallScore: 0.78
      },
      topics: [
        { name: 'Testing', relevance: 0.95 },
        { name: 'Analysis', relevance: 0.85 },
        { name: 'Documentation', relevance: 0.75 },
        { name: 'UI Components', relevance: 0.65 }
      ],
      sentiment: {
        overall: 'neutral',
        score: 0.6
      },
      languageQuality: {
        grammar: 0.85,
        spelling: 0.9,
        readability: 0.8,
        clarity: 0.75,
        overall: 0.82
      },
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  };

  // Helper function to ensure we always have a valid result structure
  const normalizeResult = (input: any): AnalysisResult => {
    console.log("Normalizing result input:", input ? typeof input : 'null/undefined');
    
    // If we have no input at all, return mock data
    if (!input || typeof input !== 'object') {
      console.warn("Creating mock result structure for display");
      return createMockAnalysis(documentId);
    }
    
    // For partial input, ensure all required fields exist
    const normalized: AnalysisResult = {
      documentId: input.documentId || documentId || 'unknown',
      fileName: input.fileName || 'unknown.pdf',
      analysisType: input.analysisType || 'general',
      summary: input.summary || 'No summary available for this document.',
      keyPoints: Array.isArray(input.keyPoints) ? input.keyPoints : [
        'No key points were identified in the document',
        'Consider adding more specific content',
        'The document may need more detailed information'
      ],
      recommendations: Array.isArray(input.recommendations) ? input.recommendations : [
        'Consider adding more content to the document',
        'Include specific details about the subject matter',
        'Structure the document with clear sections'
      ],
      insights: input.insights || {
        clarity: 0.5,
        relevance: 0.5,
        completeness: 0.5,
        conciseness: 0.5,
        overallScore: 0.5
      },
      topics: Array.isArray(input.topics) ? input.topics : [
        { name: 'General Content', relevance: 1.0 },
        { name: 'Document Structure', relevance: 0.8 }
      ],
      sentiment: input.sentiment || { overall: 'neutral', score: 0.5 },
      languageQuality: input.languageQuality || {
        grammar: 0.7,
        spelling: 0.7,
        readability: 0.7,
        overall: 0.7
      },
      timestamp: input.timestamp || input.createdAt || new Date().toISOString(),
      createdAt: input.createdAt || new Date().toISOString()
    };
    
    console.log("Normalized result ready with keys:", Object.keys(normalized));
    return normalized;
  };

  useEffect(() => {
    console.log("AnalysisResultsContent received result:", result ? 'Data available' : 'No data');
    if (result) {
      console.log("Result type:", typeof result);
      console.log("Result keys:", Object.keys(result));
      console.log("Has summary:", !!result.summary);
      console.log("Has insights:", !!result.insights);
      console.log("Has topics:", !!result.topics);
      console.log("Has recommendations:", !!result.recommendations);
    }
    
    // Mark component as rendered
    setHasRendered(true);
    
    return () => {
      mountedRef.current = false;
    };
  }, [result]);

  // For development: if we've tried to render multiple times with no result, force display
  useEffect(() => {
    if (FORCE_DISPLAY && !result && hasRendered && !debugState.forcedDisplay) {
      console.warn("Force-displaying analysis results for debugging");
      setDebugState(prev => ({ ...prev, forceDisplay: true }));
    }
  }, [result, hasRendered, debugState.forcedDisplay]);

  // Check if we have at least minimal data to display
  const hasMinimalData = result && (
    result.summary || 
    (result.keyPoints && result.keyPoints.length > 0) || 
    (result.recommendations && result.recommendations.length > 0) ||
    (result.topics && result.topics.length > 0)
  );
  
  // Logic to determine if we should show content
  const shouldDisplayContent = hasMinimalData || (FORCE_DISPLAY && debugState.forceDisplay);
  
  // If we don't have results and aren't forcing display, show the no-results message
  if (!shouldDisplayContent) {
    console.warn("AnalysisResultsContent: No result data provided");
    return (
      <Card className="bg-[#161616] border-[#222222]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-10 text-center">
            <div className="space-y-3">
              <AlertCircle className="h-10 w-10 text-[#E57373] mx-auto" />
              <h3 className="text-[#F9F6EE] font-medium">No Analysis Results</h3>
              <p className="text-[#8A8782] text-sm max-w-md">
                The analysis results could not be displayed. Please try running the analysis again.
              </p>
              
              {/* Debug option to force display */}
              {FORCE_DISPLAY && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 border-[#333333] text-[#8A8782]"
                  onClick={() => {
                    console.log("Forcing display of mock results");
                    setDebugState({
                      forceDisplay: true,
                      forcedDisplay: true
                    });
                  }}
                >
                  Debug: Force Display
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Normalize the result to ensure all needed fields are present
  const normalizedResult = result ? normalizeResult(result) 
    : normalizeResult({ documentId, fileName: 'debug-sample.pdf' });

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid grid-cols-4 mb-4 bg-[#161616] p-1">
        <TabsTrigger
          value="summary"
          className="data-[state=active]:bg-[#B4916C] data-[state=active]:text-white data-[state=active]:shadow-none"
        >
          Summary
        </TabsTrigger>
        <TabsTrigger
          value="insights"
          className="data-[state=active]:bg-[#B4916C] data-[state=active]:text-white data-[state=active]:shadow-none"
        >
          Insights
        </TabsTrigger>
        <TabsTrigger
          value="topics"
          className="data-[state=active]:bg-[#B4916C] data-[state=active]:text-white data-[state=active]:shadow-none"
        >
          Topics
        </TabsTrigger>
        <TabsTrigger
          value="recommendations"
          className="data-[state=active]:bg-[#B4916C] data-[state=active]:text-white data-[state=active]:shadow-none"
        >
          Improve
        </TabsTrigger>
      </TabsList>

      {/* Add debugging info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mb-2 bg-gray-900 p-2 rounded-md opacity-70">
          Rendering AnalysisResultsContent | 
          Result present: {result ? '✓' : '✗'} | 
          Using normalized: {!result ? '✓' : '✗'} |
          Tab: {activeTab} | 
          Has rendered: {hasRendered ? '✓' : '✗'} |
          Force display: {debugState.forceDisplay ? '✓' : '✗'}
        </div>
      )}

      <TabsContent value="summary" className="m-0">
        <AnalysisSummary summary={normalizedResult.summary} fileName={normalizedResult.fileName} />
      </TabsContent>

      <TabsContent value="insights" className="m-0">
        <AnalysisInsights insights={normalizedResult.insights} topics={normalizedResult.topics} />
      </TabsContent>

      <TabsContent value="topics" className="m-0">
        <AnalysisTopics topics={normalizedResult.topics} />
      </TabsContent>

      <TabsContent value="recommendations" className="m-0">
        <AnalysisRecommendations recommendations={normalizedResult.recommendations} documentId={documentId} />
      </TabsContent>
    </Tabs>
  );
};

export default AnalysisResultsContent;
