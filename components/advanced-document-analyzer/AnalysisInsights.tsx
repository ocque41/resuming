"use client";

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, BarChart, PieChart } from 'lucide-react';

interface Insight {
  type: 'text' | 'chart' | 'metric';
  title: string;
  description?: string;
  data?: any;
  chartType?: 'bar' | 'pie' | 'line';
}

interface AnalysisInsightsProps {
  insights: Insight[];
}

export default function AnalysisInsights({ insights }: AnalysisInsightsProps) {
  if (!insights || insights.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-500/50" />
        <p>No insights available for this document.</p>
      </div>
    );
  }
  
  // Placeholder for charts - in a real implementation, this would use a chart library
  const renderPlaceholderChart = (type: string, data: any) => {
    if (type === 'bar') {
      return (
        <div className="bg-[#161616] p-4 rounded-md border border-gray-800 text-center">
          <BarChart className="h-12 w-12 mx-auto mb-2 text-[#B4916C]" />
          <p className="text-sm text-gray-400">Bar chart visualization (placeholder)</p>
          <p className="text-xs text-gray-500 mt-1">
            This would be replaced with an actual bar chart in a production environment
          </p>
        </div>
      );
    }
    
    if (type === 'pie') {
      return (
        <div className="bg-[#161616] p-4 rounded-md border border-gray-800 text-center">
          <PieChart className="h-12 w-12 mx-auto mb-2 text-[#B4916C]" />
          <p className="text-sm text-gray-400">Pie chart visualization (placeholder)</p>
          <p className="text-xs text-gray-500 mt-1">
            This would be replaced with an actual pie chart in a production environment
          </p>
        </div>
      );
    }
    
    return (
      <div className="bg-[#161616] p-4 rounded-md border border-gray-800 text-center">
        <BarChart className="h-12 w-12 mx-auto mb-2 text-[#B4916C]" />
        <p className="text-sm text-gray-400">Chart visualization (placeholder)</p>
        <p className="text-xs text-gray-500 mt-1">
          This would be replaced with an actual chart in a production environment
        </p>
      </div>
    );
  };
  
  const renderMetric = (data: Record<string, any>) => {
    if (!data) return null;
    
    return (
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="bg-[#161616] p-3 rounded-md border border-gray-800">
            <p className="text-sm text-gray-400 mb-1">{key}</p>
            <p className="text-xl font-safiro text-[#F9F6EE]">{String(value)}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-4 space-y-6">
        <h3 className="text-[#F9F6EE] font-safiro text-lg mb-4">Insights</h3>
        
        {insights.map((insight, index) => (
          <div key={index} className="mb-6">
            <h4 className="text-[#B4916C] font-safiro mb-2">{insight.title}</h4>
            
            {insight.description && (
              <p className="text-[#E2DFD7] font-borna text-sm mb-4">{insight.description}</p>
            )}
            
            {insight.type === 'chart' && insight.chartType && (
              <div className="mt-3">
                {renderPlaceholderChart(insight.chartType, insight.data)}
              </div>
            )}
            
            {insight.type === 'metric' && (
              <div className="mt-3">
                {renderMetric(insight.data || {})}
              </div>
            )}
            
            {insight.type === 'text' && insight.data && (
              <div className="mt-3 bg-[#161616] p-4 rounded-md border border-gray-800">
                <p className="text-[#E2DFD7] font-borna text-sm whitespace-pre-line">{String(insight.data)}</p>
              </div>
            )}
          </div>
        ))}
        
        <div className="p-3 rounded-md bg-[#1A1F2A] border border-[#273349] mt-6">
          <p className="text-sm text-[#E2DFD7] font-borna">
            <span className="text-[#64B5F6] font-safiro">Note:</span>{' '}
            These insights are generated based on AI analysis of your document. For more accurate visualizations, 
            export the analysis results and use a dedicated data visualization tool.
          </p>
        </div>
      </div>
    </ScrollArea>
  );
} 