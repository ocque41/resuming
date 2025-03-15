import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Check, AlertCircle, TrendingUp, TrendingDown, Star } from "lucide-react";
import * as diffLib from 'diff';

interface ComparativeAnalysisProps {
  originalText: string;
  optimizedText: string;
  matchAnalysis: {
    score: number;
    matchedKeywords: Array<{ keyword: string; relevance: number; frequency: number; placement: string }>;
    missingKeywords: Array<{ keyword: string; importance: number; suggestedPlacement: string }>;
    recommendations: string[];
    skillGap: string;
    dimensionalScores: {
      skillsMatch: number;
      experienceMatch: number;
      educationMatch: number;
      industryFit: number;
      overallCompatibility: number;
      keywordDensity: number;
      formatCompatibility: number;
      contentRelevance: number;
    };
    detailedAnalysis: string;
    improvementPotential: number;
    sectionAnalysis: {
      profile: { score: number; feedback: string };
      skills: { score: number; feedback: string };
      experience: { score: number; feedback: string };
      education: { score: number; feedback: string };
      achievements: { score: number; feedback: string };
    };
  };
}

const ComparativeAnalysis = ({ originalText, optimizedText, matchAnalysis }: ComparativeAnalysisProps) => {
  const [activeTab, setActiveTab] = useState<string>('side-by-side');
  const [differences, setDifferences] = useState<any[]>([]);
  const [keywordHighlights, setKeywordHighlights] = useState<{ [key: string]: string }>({});

  // Calculate differences between original and optimized text
  useEffect(() => {
    if (originalText && optimizedText) {
      const diff = diffLib.diffWords(originalText, optimizedText);
      setDifferences(diff);
    }
  }, [originalText, optimizedText]);

  // Extract keywords for highlighting
  useEffect(() => {
    if (matchAnalysis?.matchedKeywords) {
      const highlights: { [key: string]: string } = {};
      matchAnalysis.matchedKeywords.forEach(kw => {
        // Determine color based on relevance
        let color = 'text-yellow-500';
        if (kw.relevance > 0.7) color = 'text-green-500';
        else if (kw.relevance < 0.4) color = 'text-orange-500';
        
        highlights[kw.keyword.toLowerCase()] = color;
      });
      setKeywordHighlights(highlights);
    }
  }, [matchAnalysis]);

  // Helper function to highlight keywords in text
  const highlightKeywords = (text: string) => {
    if (!text) return '';
    
    let result = text;
    const keywords = Object.keys(keywordHighlights).sort((a, b) => b.length - a.length);
    
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      result = result.replace(regex, (match) => 
        `<span class="${keywordHighlights[keyword.toLowerCase()]} font-medium">${match}</span>`
      );
    }
    
    return result;
  };

  // Generate diff view between original and optimized text
  const generateDiffView = (original: string, optimized: string) => {
    try {
      const diff = diffLib.diffLines(original, optimized);
      
      return (
        <div className="diff-container">
          {diff.map((part: diffLib.Change, index: number) => {
            const color = part.added 
              ? 'text-green-500' 
              : part.removed 
                ? 'text-red-500' 
                : 'text-gray-400';
            
            const bgColor = part.added 
              ? 'bg-green-950/30' 
              : part.removed 
                ? 'bg-red-950/30' 
                : '';
            
            const prefix = part.added 
              ? '+ ' 
              : part.removed 
                ? '- ' 
                : '  ';
            
            return (
              <pre 
                key={index} 
                className={`${color} ${bgColor} px-2 py-1 whitespace-pre-wrap`}
              >
                {prefix}{part.value}
              </pre>
            );
          })}
        </div>
      );
    } catch (error) {
      console.error('Error generating diff view:', error);
      return (
        <div className="p-4 text-red-500">
          Error generating diff view. Please try again.
        </div>
      );
    }
  };

  // Ensure we have text to compare
  if (!originalText || !optimizedText) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Comparative Analysis</CardTitle>
          <CardDescription>
            Compare your original CV with the optimized version
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">
              Waiting for optimization to complete...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Comparative Analysis</CardTitle>
        <CardDescription>
          Compare your original CV with the optimized version
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
            <TabsTrigger value="diff-view">Diff View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="side-by-side" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Original CV</h3>
                <div className="border rounded-md p-4 bg-muted/50 whitespace-pre-wrap h-[500px] overflow-y-auto">
                  {originalText}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Optimized CV</h3>
                <div className="border rounded-md p-4 bg-muted/50 whitespace-pre-wrap h-[500px] overflow-y-auto">
                  {optimizedText}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="diff-view" className="mt-4">
            <div className="border rounded-md p-4 bg-muted/50 whitespace-pre-wrap h-[500px] overflow-y-auto">
              {generateDiffView(originalText, optimizedText)}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ComparativeAnalysis; 