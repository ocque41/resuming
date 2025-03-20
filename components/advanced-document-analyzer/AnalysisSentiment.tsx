import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, CheckCircle, AlertCircle, Minus } from 'lucide-react';
import { DocumentSentiment, SectionSentiment, SentimentSection } from './types';

interface AnalysisSentimentProps {
  sentiment?: DocumentSentiment;
}

export default function AnalysisSentiment({ sentiment }: AnalysisSentimentProps) {
  if (!sentiment) {
    return null;
  }

  // Get any sentiment by section data - could be in multiple formats
  const sentimentBySection = sentiment.sentimentBySection || [];

  // Function to get the appropriate icon based on sentiment value
  const getSentimentIcon = (sentimentValue: number | string) => {
    // Handle string values
    if (typeof sentimentValue === 'string') {
      const val = sentimentValue.toLowerCase();
      if (val === 'positive') return <CheckCircle className="h-5 w-5 text-[#4ADE80]" />;
      if (val === 'neutral') return <Minus className="h-5 w-5 text-[#B4916C]" />;
      if (val === 'negative') return <AlertCircle className="h-5 w-5 text-[#F87171]" />;
    }
    
    // Handle numeric values
    const score = typeof sentimentValue === 'number' ? sentimentValue : 0;
    if (score >= 0.2) return <CheckCircle className="h-5 w-5 text-[#4ADE80]" />;
    if (score >= -0.2 && score < 0.2) return <Minus className="h-5 w-5 text-[#B4916C]" />;
    return <AlertCircle className="h-5 w-5 text-[#F87171]" />;
  };

  // Function to get color based on sentiment value
  const getSentimentColor = (sentimentValue: number | string) => {
    // Handle string values
    if (typeof sentimentValue === 'string') {
      const val = sentimentValue.toLowerCase();
      if (val === 'positive') return 'bg-[#4ADE80]';
      if (val === 'neutral') return 'bg-[#B4916C]';
      if (val === 'negative') return 'bg-[#F87171]';
    }
    
    // Handle numeric values
    const score = typeof sentimentValue === 'number' ? sentimentValue : 0;
    if (score >= 0.2) return 'bg-[#4ADE80]';
    if (score >= -0.2 && score < 0.2) return 'bg-[#B4916C]';
    return 'bg-[#F87171]';
  };
  
  // Function to normalize sentiment score to a percentage (0-100)
  const normalizeScore = (score: number) => {
    // If score is between -1 and 1, convert to 0-100 scale
    if (score >= -1 && score <= 1) {
      return Math.round((score + 1) * 50); // -1 => 0%, 0 => 50%, 1 => 100%
    }
    // If score is already in percentage range
    return Math.round(Math.max(0, Math.min(100, score)));
  };

  // Get score as a normalized percentage for display
  const scorePercentage = normalizeScore(sentiment.score);

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
                {getSentimentIcon(sentiment.overall)}
                <span className="text-[#E2DFD7] text-lg font-medium capitalize">
                  {sentiment.overall}
                </span>
              </div>
              <span className="text-[#8A8782] bg-[#161616] px-2 py-1 rounded-md text-xs">
                {scorePercentage}% positive
              </span>
            </div>
            
            <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden">
              <div 
                className={`${getSentimentColor(sentiment.overall)} h-full rounded-full`} 
                style={{ width: `${scorePercentage}%` }} 
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
              {sentimentBySection.map((item, index) => {
                // Handle either SectionSentiment or SentimentSection format
                const section = 'section' in item ? item.section : '';
                const score = 'score' in item ? item.score : 0;
                const sentimentValue = 'sentiment' in item ? item.sentiment : (score >= 0.2 ? 'positive' : (score <= -0.2 ? 'negative' : 'neutral'));
                
                return (
                  <div key={index} className="bg-[#080808] rounded-lg p-3 border border-[#222222]">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        {getSentimentIcon(sentimentValue)}
                        <span className="text-[#E2DFD7] text-sm font-medium">{section}</span>
                      </div>
                      <span className="text-[#8A8782] text-xs">{normalizeScore(score)}%</span>
                    </div>
                    <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`${getSentimentColor(sentimentValue)} h-full rounded-full`} 
                        style={{ width: `${normalizeScore(score)}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
