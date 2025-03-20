import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, PieChart } from 'lucide-react';
import { DocumentInsights, InsightMetric, DocumentTopic } from './types';

interface AnalysisInsightsProps {
  insights: DocumentInsights | InsightMetric[] | any;
  topics?: DocumentTopic[] | any[];
}

export default function AnalysisInsights({ insights, topics = [] }: AnalysisInsightsProps) {
  console.log("AnalysisInsights received:", { 
    insightsType: typeof insights, 
    isArray: Array.isArray(insights),
    topics: topics.length
  });

  // Normalize topics to handle different API formats
  const normalizeTopics = (inputTopics: any[]) => {
    return inputTopics.map(topic => {
      if (typeof topic === 'string') {
        return { name: topic, relevance: 0.5 };
      }
      
      // Return a normalized topic object
      return { 
        name: topic.name || topic.topic || 'Unknown Topic',
        relevance: topic.relevance || topic.value || 0.5
      };
    });
  };
  
  // Attempt to normalize the topics
  const normalizedTopics = normalizeTopics(topics);
  
  // Function to determine which rendering method to use for insights
  const renderInsights = () => {
    try {
      if (!insights) {
        console.warn("No insights data provided");
        return <p className="text-[#8A8782]">No insights available</p>;
      }

      // Handle array of metrics
      if (Array.isArray(insights)) {
        console.log("Rendering insights from array format");
        return renderMetricsFromArray(insights);
      }
      
      // Handle object format
      if (typeof insights === 'object') {
        console.log("Rendering insights from object format");
        return renderMetricsFromObject(insights);
      }
      
      // Handle unexpected format
      console.warn("Unexpected insights format:", typeof insights);
      return <p className="text-[#8A8782]">Unable to display insights in this format</p>;
    } catch (error) {
      console.error("Error rendering insights:", error);
      return <p className="text-[#8A8782]">Error displaying insights</p>;
    }
  };

  // Render insights from object format (e.g. {clarity: 80, relevance: 90})
  const renderMetricsFromObject = (insightsObj: DocumentInsights | any) => {
    // Get all metrics as key-value pairs, filtering out non-numeric values
    const metrics = Object.entries(insightsObj)
      .filter(([_, value]) => typeof value === 'number')
      .map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        value: typeof value === 'number' ? value : 0
      }));
    
    if (metrics.length === 0) {
      return <p className="text-[#8A8782]">No metric data available</p>;
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <div 
              key={metric.name} 
              className="bg-[#080808] rounded-lg p-4 border border-[#222222]"
            >
              <div className="mb-2 flex justify-between items-center">
                <span className="text-[#E2DFD7] text-sm font-medium">{metric.name}</span>
                <span className="font-bold text-[#B4916C]">{metric.value}/100</span>
              </div>
              <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#B4916C] h-full rounded-full" 
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {normalizedTopics.length > 0 && (
          <div className="mt-6">
            <h4 className="text-[#F9F6EE] text-sm font-medium mb-3">Key Topics</h4>
            <div className="flex flex-wrap gap-2">
              {normalizedTopics.map((topic, index) => (
                <div 
                  key={index}
                  className="bg-[#161616] px-3 py-1.5 rounded-full border border-[#222222]"
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[#E2DFD7] text-xs">
                      {topic.name}
                    </span>
                    {topic.relevance && (
                      <span 
                        className="text-[#B4916C] text-xs font-semibold"
                        style={{ opacity: 0.4 + (topic.relevance * 0.6) }}
                      >
                        {(topic.relevance * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render insights from array format (e.g. [{name: 'Clarity', value: 80}])
  const renderMetricsFromArray = (insightsArray: InsightMetric[] | any[]) => {
    // Normalize the metrics array to ensure consistent format
    const normalizedMetrics = insightsArray.map(item => {
      if (typeof item !== 'object' || item === null) {
        return { name: 'Unknown', value: 0 };
      }
      
      return {
        name: item.name || item.label || 'Unknown',
        value: typeof item.value === 'number' ? item.value : 0
      };
    });
    
    // Early return if no valid metrics
    if (normalizedMetrics.length === 0) {
      return <p className="text-[#8A8782]">No metric data available</p>;
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {normalizedMetrics.map((metric) => (
            <div 
              key={metric.name} 
              className="bg-[#080808] rounded-lg p-4 border border-[#222222]"
            >
              <div className="mb-2 flex justify-between items-center">
                <span className="text-[#E2DFD7] text-sm font-medium">{metric.name}</span>
                <span className="font-bold text-[#B4916C]">{metric.value}/100</span>
              </div>
              <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#B4916C] h-full rounded-full" 
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {normalizedTopics.length > 0 && (
          <div className="mt-6">
            <h4 className="text-[#F9F6EE] text-sm font-medium mb-3">Key Topics</h4>
            <div className="flex flex-wrap gap-2">
              {normalizedTopics.map((topic, index) => (
                <div 
                  key={index}
                  className="bg-[#161616] px-3 py-1.5 rounded-full border border-[#222222]"
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[#E2DFD7] text-xs">
                      {topic.name}
                    </span>
                    {topic.relevance && (
                      <span 
                        className="text-[#B4916C] text-xs font-semibold"
                        style={{ opacity: 0.4 + (topic.relevance * 0.6) }}
                      >
                        {(topic.relevance * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
        <CardTitle className="text-lg font-medium text-[#F9F6EE] flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-[#B4916C]" />
          Document Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {renderInsights()}
      </CardContent>
    </Card>
  );
}