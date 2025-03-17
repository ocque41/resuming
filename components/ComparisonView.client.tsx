'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ComparisonViewProps {
  originalContent?: {
    text: string;
    atsScore: number;
  };
  optimizedContent?: {
    text: string;
    atsScore: number;
    optimizationDate?: string;
  };
  improvements?: Array<string | { improvement: string; impact?: string }>;
  onDownloadOriginal?: () => void;
  onDownloadOptimized?: () => void;
  displayMode?: 'horizontal' | 'vertical';
}

export default function ComparisonView({
  originalContent,
  optimizedContent,
  improvements = [],
  onDownloadOriginal,
  onDownloadOptimized,
  displayMode = 'horizontal'
}: ComparisonViewProps) {
  const [view, setView] = useState<'split' | 'diff'>('split');
  
  // Format text for display
  const formatContent = (text: string) => {
    if (!text) return '';
    
    // Split into sections for better readability
    const sections = text.split(/\n\s*\n/);
    
    return sections.map((section, index) => (
      <div key={index} className="mb-4">
        {section.split('\n').map((line, i) => (
          <div key={i} className={i === 0 && line.match(/^[A-Z]/) ? "font-bold text-lg" : ""}>
            {line}
          </div>
        ))}
      </div>
    ));
  };
  
  // Calculate score improvement
  const scoreImprovement = optimizedContent && originalContent 
    ? Math.max(0, optimizedContent.atsScore - originalContent.atsScore) 
    : 0;
  
  return (
    <Card className="bg-[#0A0A0A] border-gray-800 shadow-xl overflow-hidden">
      <CardHeader className="bg-[#050505] border-b border-gray-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center">
            <FileText className="mr-2 h-5 w-5 text-[#B4916C]" />
            CV Comparison View
          </CardTitle>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className={view === 'split' ? 'bg-[#B4916C] text-white' : 'bg-gray-800 text-gray-300'} 
              onClick={() => setView('split')}
            >
              Split View
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className={view === 'diff' ? 'bg-[#B4916C] text-white' : 'bg-gray-800 text-gray-300'} 
              onClick={() => setView('diff')}
            >
              Improvements
            </Button>
          </div>
        </div>
        
        {optimizedContent?.optimizationDate && (
          <CardDescription className="text-gray-400">
            Optimized on {new Date(optimizedContent.optimizationDate).toLocaleDateString()} at {new Date(optimizedContent.optimizationDate).toLocaleTimeString()}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        {view === 'split' ? (
          <div className={`grid grid-cols-1 ${displayMode === 'horizontal' ? 'md:grid-cols-2' : ''} gap-0`}>
            {/* Original CV */}
            <div className={`p-6 ${displayMode === 'horizontal' ? 'border-r border-gray-800' : 'border-b border-gray-800'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-white font-medium">Original CV</h3>
                <Badge variant="outline" className="text-gray-400 border-gray-700">
                  ATS Score: {originalContent?.atsScore || 'N/A'}%
                </Badge>
              </div>
              
              <div className={`${displayMode === 'horizontal' ? 'h-[500px]' : 'h-[300px]'} overflow-y-auto pr-4 text-gray-300 text-sm`}>
                {originalContent ? formatContent(originalContent.text) : 'No original content available'}
              </div>
              
              {onDownloadOriginal && (
                <Button
                  onClick={onDownloadOriginal}
                  variant="outline"
                  size="sm"
                  className="mt-4 bg-gray-800 hover:bg-gray-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Original
                </Button>
              )}
            </div>
            
            {/* Optimized CV */}
            <div className="p-6 bg-[#050505]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-white font-medium">Optimized CV</h3>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-[#B4916C] border-[#B4916C]/30">
                    ATS Score: {optimizedContent?.atsScore || 'N/A'}%
                  </Badge>
                  {scoreImprovement > 0 && (
                    <Badge className="bg-green-900/30 text-green-400 border-green-800">
                      +{scoreImprovement}%
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className={`${displayMode === 'horizontal' ? 'h-[500px]' : 'h-[300px]'} overflow-y-auto pr-4 text-gray-300 text-sm`}>
                {optimizedContent ? formatContent(optimizedContent.text) : 'No optimized content available'}
              </div>
              
              {onDownloadOptimized && (
                <Button
                  onClick={onDownloadOptimized}
                  variant="outline"
                  size="sm"
                  className="mt-4 bg-[#B4916C] hover:bg-[#A3815C] text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Optimized
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <h3 className="text-lg text-white font-medium mb-4">Key Improvements</h3>
            
            <div className="space-y-4">
              {improvements.length > 0 ? (
                improvements.map((improvement, index) => (
                  <div key={index} className="flex items-start rounded-md bg-[#0A0A0A] border border-gray-800 p-4">
                    <ArrowRight className="h-5 w-5 text-[#B4916C] mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-gray-300">
                      {typeof improvement === 'object' && improvement !== null 
                        ? (improvement.improvement || '') + 
                          (improvement.impact ? ` (Impact: ${improvement.impact})` : '')
                        : improvement}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 text-center py-8">
                  No specific improvements identified. The optimized version may have general enhancements in wording and structure.
                </div>
              )}
              
              <div className="mt-6 flex items-center justify-center">
                <div className="text-center bg-[#0A0A0A] border border-gray-800 rounded-lg p-4 w-full md:w-auto">
                  <div className="flex flex-col md:flex-row items-center justify-center mb-2">
                    <div className="text-gray-400 mb-2 md:mb-0 md:mr-4">Original ATS Score: {originalContent?.atsScore || 'N/A'}%</div>
                    <ArrowRight className="h-5 w-5 text-[#B4916C] hidden md:block" />
                    <div className="text-[#B4916C] md:ml-4">Optimized ATS Score: {optimizedContent?.atsScore || 'N/A'}%</div>
                  </div>
                  
                  {scoreImprovement > 0 && (
                    <Badge className="bg-green-900/30 text-green-400 border-green-800">
                      {scoreImprovement}% Improvement
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 