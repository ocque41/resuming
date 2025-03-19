"use client";

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  BarChart, 
  File, 
  Calendar, 
  Users, 
  Briefcase,
  Layers,
  AlertCircle
} from 'lucide-react';

interface AnalysisCategory {
  id: string;
  title: string;
  score?: number;
  details: string;
  icon?: string;
}

interface AnalysisResultsContentProps {
  analysis: {
    categories: AnalysisCategory[];
    overallScore?: number;
    detailedAnalysis?: string;
  };
}

export default function AnalysisResultsContent({ analysis }: AnalysisResultsContentProps) {
  if (!analysis || !analysis.categories || analysis.categories.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-500/50" />
        <p>No detailed analysis available for this document.</p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#4ADE80]';
    if (score >= 60) return 'text-[#FFB74D]';
    return 'text-[#E57373]';
  };

  const getIconComponent = (iconName: string | undefined) => {
    switch (iconName) {
      case 'file-text':
        return <FileText className="h-5 w-5 text-[#B4916C] mr-2" />;
      case 'bar-chart':
        return <BarChart className="h-5 w-5 text-[#B4916C] mr-2" />;
      case 'book-open':
        return <FileText className="h-5 w-5 text-[#B4916C] mr-2" />;
      case 'calendar':
        return <Calendar className="h-5 w-5 text-[#B4916C] mr-2" />;
      case 'users':
        return <Users className="h-5 w-5 text-[#B4916C] mr-2" />;
      case 'briefcase':
        return <Briefcase className="h-5 w-5 text-[#B4916C] mr-2" />;
      case 'layers':
        return <Layers className="h-5 w-5 text-[#B4916C] mr-2" />;
      case 'spreadsheet':
        return <File className="h-5 w-5 text-[#B4916C] mr-2" />;
      default:
        return <FileText className="h-5 w-5 text-[#B4916C] mr-2" />;
    }
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-4 space-y-4">
        <div className="mb-6">
          <h3 className="text-[#F9F6EE] font-safiro text-lg mb-3">Detailed Analysis</h3>
          
          {analysis.overallScore !== undefined && (
            <div className="flex items-center mb-4">
              <div className="mr-3">
                <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-[#111111] border border-[#222222]">
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(#B4916C ${analysis.overallScore}%, transparent 0)`,
                      clipPath: 'circle(50% at 50% 50%)'
                    }}
                  />
                  <div className="absolute inset-1.5 bg-[#0A0A0A] rounded-full flex items-center justify-center">
                    <span className={`text-xl font-safiro ${getScoreColor(analysis.overallScore)}`}>
                      {analysis.overallScore}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-[#F9F6EE] font-safiro">Overall Score</h4>
                <p className="text-sm text-gray-400">
                  {
                    analysis.overallScore >= 80 ? 'Excellent document quality' :
                    analysis.overallScore >= 60 ? 'Good document with improvement areas' :
                    'Document needs significant improvement'
                  }
                </p>
              </div>
            </div>
          )}
          
          {analysis.detailedAnalysis && (
            <div className="text-[#E2DFD7] font-borna text-sm mb-6 whitespace-pre-line">
              {analysis.detailedAnalysis}
            </div>
          )}
        </div>
        
        <Accordion type="single" collapsible className="w-full">
          {analysis.categories.map((category, index) => (
            <AccordionItem 
              key={category.id || index} 
              value={category.id || `category-${index}`}
              className="border-b border-gray-800"
            >
              <AccordionTrigger className="py-4 text-[#F9F6EE]">
                <div className="flex items-center">
                  {getIconComponent(category.icon)}
                  <span>{category.title}</span>
                  {category.score !== undefined && (
                    <Badge className={`ml-2 ${getScoreColor(category.score)} bg-[#161616]`}>
                      {category.score}/100
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="py-2 px-4 text-[#E2DFD7] text-sm font-borna">
                <div className="whitespace-pre-line">{category.details}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </ScrollArea>
  );
} 