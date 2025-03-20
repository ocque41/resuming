import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, CheckCircle, AlertCircle, Minus } from 'lucide-react';
import { DocumentSentiment, SectionSentiment } from './types';

interface AnalysisSentimentProps {
  sentiment?: DocumentSentiment;
  sentimentBySection?: SectionSentiment[];
}

export default function AnalysisSentiment({ sentiment, sentimentBySection = [] }: AnalysisSentimentProps) {
  if (!sentiment) {
    return null;
  }

  // Function to get the appropriate icon based on sentiment score
  const getSentimentIcon = (score: number) => {
    if (score >= 0.7) return <CheckCircle className="h-5 w-5 text-[#4ADE80]" />;
    if (score >= 0.4) return <Minus className="h-5 w-5 text-[#B4916C]" />;
    return <AlertCircle className="h-5 w-5 text-[#F87171]" />;
  };

  // Function to get color based on sentiment score
  const getSentimentColor = (score: number) => {
    if (score >= 0.7) return 'bg-[#4ADE80]';
    if (score >= 0.4) return 'bg-[#B4916C]';
    return 'bg-[#F87171]';
  };

  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
        <CardTitle className="text-lg font-medium text-[#F9F6EE]">
          Sentiment Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {sentiment && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                {getSentimentIcon(sentiment.score)}
                <span className="text-[#E2DFD7] text-lg font-medium">
                  {sentiment.overall}
                </span>
              </div>
              <span className="text-[#8A8782] bg-[#161616] px-2 py-1 rounded-md text-xs">
                {Math.round(sentiment.score * 100)}% positive
              </span>
            </div>
            
            <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden">
              <div 
                className={`${getSentimentColor(sentiment.score)} h-full rounded-full`} 
                style={{ width: `${sentiment.score * 100}%` }} 
              />
            </div>
          </div>
        )}

        {sentimentBySection && sentimentBySection.length > 0 && (
          <div>
            <h3 className="text-[#F9F6EE] font-medium text-base mb-3 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-[#B4916C]" />
              Sentiment by Section
            </h3>
            <div className="space-y-3">
              {sentimentBySection.map((item, index) => (
                <div key={index} className="bg-[#080808] rounded-lg p-3 border border-[#222222]">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      {getSentimentIcon(item.score)}
                      <span className="text-[#E2DFD7] text-sm font-medium">{item.section}</span>
                    </div>
                    <span className="text-[#8A8782] text-xs">{Math.round(item.score * 100)}%</span>
                  </div>
                  <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`${getSentimentColor(item.score)} h-full rounded-full`} 
                      style={{ width: `${item.score * 100}%` }} 
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
