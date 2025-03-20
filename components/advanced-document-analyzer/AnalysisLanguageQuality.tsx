import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Check, BarChart2, AlertCircle } from 'lucide-react';
import { LanguageQuality } from './types';

interface AnalysisLanguageQualityProps {
  languageQuality?: LanguageQuality;
}

export default function AnalysisLanguageQuality({ languageQuality }: AnalysisLanguageQualityProps) {
  if (!languageQuality) {
    return null;
  }

  // Function to get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-[#4ADE80]'; // Excellent
    if (score >= 75) return 'bg-[#B4916C]'; // Good
    if (score >= 60) return 'bg-[#F59E0B]'; // Fair
    return 'bg-[#F87171]'; // Needs improvement
  };

  // Function to get text color based on score
  const getTextColor = (score: number) => {
    if (score >= 90) return 'text-[#4ADE80]'; // Excellent
    if (score >= 75) return 'text-[#B4916C]'; // Good
    if (score >= 60) return 'text-[#F59E0B]'; // Fair
    return 'text-[#F87171]'; // Needs improvement
  };

  // Function to get label based on score
  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  // Build metrics array based on available properties
  const metrics = [];
  
  // Always add grammar and spelling which are required
  metrics.push({ 
    name: 'Grammar', 
    score: languageQuality.grammar, 
    icon: <Check className="h-4 w-4 text-[#B4916C]" /> 
  });
  
  metrics.push({ 
    name: 'Spelling', 
    score: languageQuality.spelling, 
    icon: <Check className="h-4 w-4 text-[#B4916C]" /> 
  });
  
  // Add readability if available
  if (languageQuality.readability !== undefined) {
    metrics.push({ 
      name: 'Readability', 
      score: languageQuality.readability, 
      icon: <FileText className="h-4 w-4 text-[#B4916C]" /> 
    });
  }
  
  // Add clarity if available
  if (languageQuality.clarity !== undefined) {
    metrics.push({ 
      name: 'Clarity', 
      score: languageQuality.clarity, 
      icon: <AlertCircle className="h-4 w-4 text-[#B4916C]" /> 
    });
  }
  
  // Add overall if available
  if (languageQuality.overall !== undefined) {
    metrics.push({ 
      name: 'Overall', 
      score: languageQuality.overall, 
      icon: <BarChart2 className="h-4 w-4 text-[#B4916C]" /> 
    });
  }

  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
        <CardTitle className="text-lg font-medium text-[#F9F6EE]">
          Language Quality
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div key={metric.name} className="bg-[#080808] rounded-lg p-4 border border-[#222222]">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  {metric.icon}
                  <span className="text-[#E2DFD7] text-sm font-medium">{metric.name}</span>
                </div>
                <div className="flex items-center">
                  <span className={`text-sm font-bold ${getTextColor(metric.score)}`}>{metric.score}</span>
                  <span className="text-[#8A8782] text-xs ml-1">/100</span>
                </div>
              </div>
              <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden">
                <div
                  className={`${getScoreColor(metric.score)} h-full rounded-full`}
                  style={{ width: `${metric.score}%` }}
                />
              </div>
              <div className="mt-2 text-right">
                <span className={`text-xs font-medium ${getTextColor(metric.score)}`}>
                  {getScoreLabel(metric.score)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 