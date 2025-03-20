import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, TrendingUp, TrendingDown } from 'lucide-react';
import { DocumentSentiment, SectionSentiment } from './types';

interface AnalysisSentimentProps {
  sentiment: DocumentSentiment | any;
}

export default function AnalysisSentiment({ sentiment }: AnalysisSentimentProps) {
  console.log("Rendering AnalysisSentiment with:", sentiment);
  
  // Safety check - ensure we have valid sentiment data
  if (!sentiment || typeof sentiment !== 'object') {
    console.warn("Invalid sentiment data provided:", sentiment);
    return null;
  }

  // Extract values with fallbacks
  const overall = sentiment.overall || "neutral";
  const score = typeof sentiment.score === 'number' ? sentiment.score : 0.5;
  
  // Get sections if available, or empty array
  const sections = Array.isArray(sentiment.sentimentBySection) 
    ? sentiment.sentimentBySection 
    : Array.isArray(sentiment.sections)
      ? sentiment.sections
      : [];
  
  // Get sentiment icon and color
  const getSentimentIcon = (sentimentType: string) => {
    const type = sentimentType.toLowerCase();
    if (type.includes('positive') || type === 'good') {
      return <TrendingUp className="h-5 w-5 text-[#34D399]" />;
    } else if (type.includes('negative') || type === 'bad') {
      return <TrendingDown className="h-5 w-5 text-[#EF4444]" />;
    } else {
      return <Heart className="h-5 w-5 text-[#8A8782]" />;
    }
  };

  const getSentimentColor = (sentimentType: string) => {
    const type = sentimentType.toLowerCase();
    if (type.includes('positive') || type === 'good') {
      return 'text-[#34D399]';
    } else if (type.includes('negative') || type === 'bad') {
      return 'text-[#EF4444]';
    } else {
      return 'text-[#8A8782]';
    }
  };

  // Convert numeric score to percentage
  const scorePercentage = Math.round(score * 100);
  
  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
        <CardTitle className="text-lg font-medium text-[#F9F6EE] flex items-center gap-2">
          <Heart className="h-5 w-5 text-[#B4916C]" />
          Sentiment Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <div className="space-y-5">
          {/* Overall sentiment */}
          <div className="p-4 rounded-lg bg-[#161616] border border-[#222222]">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[#F9F6EE] text-sm font-medium">Overall Document Sentiment</h4>
              <div className="flex items-center">
                <span className={`text-sm font-semibold ${getSentimentColor(overall)}`}>{scorePercentage}%</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getSentimentIcon(overall)}
              <div>
                <span className={`text-base font-medium ${getSentimentColor(overall)}`}>
                  {overall.charAt(0).toUpperCase() + overall.slice(1)}
                </span>
                <p className="text-[#8A8782] text-xs mt-0.5">
                  {score > 0.7 
                    ? 'The document has a strongly positive tone' 
                    : score > 0.5 
                      ? 'The document has a somewhat positive tone' 
                      : score < 0.3 
                        ? 'The document has a strongly negative tone' 
                        : score < 0.5 
                          ? 'The document has a somewhat negative tone'
                          : 'The document has a neutral tone'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Section sentiment analysis - only if we have sections */}
          {sections.length > 0 && (
            <div>
              <h4 className="text-[#F9F6EE] text-sm font-medium mb-3">Sentiment By Section</h4>
              <div className="space-y-3">
                {sections.map((section: SectionSentiment, index: number) => (
                  <div key={index} className="p-3 rounded-lg bg-[#080808] border border-[#1A1A1A]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[#E2DFD7] text-sm">
                        {section.section || `Section ${index + 1}`}
                      </span>
                      <div className="flex items-center">
                        {getSentimentIcon(section.sentiment || (section.score > 0.5 ? 'positive' : section.score < 0.5 ? 'negative' : 'neutral'))}
                        <span className={`text-xs font-semibold ml-1 ${
                          getSentimentColor(section.sentiment || (section.score > 0.5 ? 'positive' : section.score < 0.5 ? 'negative' : 'neutral'))
                        }`}>
                          {typeof section.score === 'number' ? Math.round(section.score * 100) : 50}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
