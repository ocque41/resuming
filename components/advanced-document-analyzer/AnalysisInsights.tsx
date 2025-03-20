import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, FileText } from 'lucide-react';
import { DocumentInsights, DocumentTopic, InsightMetric } from './types';

interface AnalysisInsightsProps {
  insights: DocumentInsights | InsightMetric[];
  topics?: DocumentTopic[];
}

export default function AnalysisInsights({ insights, topics = [] }: AnalysisInsightsProps) {
  if (!insights && (!topics || topics.length === 0)) {
    return null;
  }

  // Check if insights is an array (new API format) or an object (old format)
  const isInsightsArray = Array.isArray(insights);

  const renderMetricsFromObject = (insightsObj: DocumentInsights) => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insightsObj.clarity !== undefined && (
          <div className="bg-[#080808] rounded-lg p-3 border border-[#222222]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#E2DFD7] text-sm font-medium">Clarity</span>
              <span className="text-[#8A8782] text-xs">{insightsObj.clarity}%</span>
            </div>
            <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#B4916C] h-full rounded-full" 
                style={{ width: `${insightsObj.clarity}%` }} 
              />
            </div>
          </div>
        )}
        {insightsObj.relevance !== undefined && (
          <div className="bg-[#080808] rounded-lg p-3 border border-[#222222]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#E2DFD7] text-sm font-medium">Relevance</span>
              <span className="text-[#8A8782] text-xs">{insightsObj.relevance}%</span>
            </div>
            <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#B4916C] h-full rounded-full" 
                style={{ width: `${insightsObj.relevance}%` }} 
              />
            </div>
          </div>
        )}
        {insightsObj.completeness !== undefined && (
          <div className="bg-[#080808] rounded-lg p-3 border border-[#222222]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#E2DFD7] text-sm font-medium">Completeness</span>
              <span className="text-[#8A8782] text-xs">{insightsObj.completeness}%</span>
            </div>
            <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#B4916C] h-full rounded-full" 
                style={{ width: `${insightsObj.completeness}%` }} 
              />
            </div>
          </div>
        )}
        {insightsObj.conciseness !== undefined && (
          <div className="bg-[#080808] rounded-lg p-3 border border-[#222222]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#E2DFD7] text-sm font-medium">Conciseness</span>
              <span className="text-[#8A8782] text-xs">{insightsObj.conciseness}%</span>
            </div>
            <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#B4916C] h-full rounded-full" 
                style={{ width: `${insightsObj.conciseness}%` }} 
              />
            </div>
          </div>
        )}
        {insightsObj.overallScore !== undefined && (
          <div className="bg-[#080808] rounded-lg p-3 border border-[#222222]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#E2DFD7] text-sm font-medium">Overall Score</span>
              <span className="text-[#8A8782] text-xs">{insightsObj.overallScore}%</span>
            </div>
            <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#B4916C] h-full rounded-full" 
                style={{ width: `${insightsObj.overallScore}%` }} 
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMetricsFromArray = (insightsArray: InsightMetric[]) => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insightsArray.map((metric, index) => (
          <div key={index} className="bg-[#080808] rounded-lg p-3 border border-[#222222]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#E2DFD7] text-sm font-medium">{metric.name}</span>
              <span className="text-[#8A8782] text-xs">{metric.value}%</span>
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
    );
  };

  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
        <CardTitle className="text-lg font-medium text-[#F9F6EE]">
          Insights & Topics
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {insights && (
          <div className="mb-6">
            <h3 className="text-[#F9F6EE] font-medium text-base mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#B4916C]" />
              Document Quality
            </h3>
            {isInsightsArray 
              ? renderMetricsFromArray(insights as InsightMetric[])
              : renderMetricsFromObject(insights as DocumentInsights)
            }
          </div>
        )}

        {topics && topics.length > 0 && (
          <div>
            <h3 className="text-[#F9F6EE] font-medium text-base mb-3 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-[#B4916C]" />
              Main Topics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topics.map((topic, index) => (
                <div key={index} className="bg-[#080808] rounded-lg p-3 border border-[#222222]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#E2DFD7] text-sm font-medium">{topic.name}</span>
                    <span className="text-[#8A8782] text-xs">{Math.round(topic.relevance * 100)}%</span>
                  </div>
                  <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#B4916C] h-full rounded-full" 
                      style={{ width: `${topic.relevance * 100}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}