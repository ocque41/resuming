import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Check, AlertCircle, TrendingUp, TrendingDown, Star } from "lucide-react";
import { diffWords } from 'diff';

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

const ComparativeAnalysis: React.FC<ComparativeAnalysisProps> = ({
  originalText,
  optimizedText,
  matchAnalysis
}) => {
  const [differences, setDifferences] = useState<any[]>([]);
  const [keywordHighlights, setKeywordHighlights] = useState<{ [key: string]: string }>({});
  const [sectionScores, setSectionScores] = useState<{ [key: string]: number }>({});

  // Calculate differences between original and optimized text
  useEffect(() => {
    if (originalText && optimizedText) {
      const diff = diffWords(originalText, optimizedText);
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

  // Extract section scores
  useEffect(() => {
    if (matchAnalysis?.sectionAnalysis) {
      const scores: { [key: string]: number } = {};
      Object.entries(matchAnalysis.sectionAnalysis).forEach(([section, data]) => {
        scores[section] = data.score * 100;
      });
      setSectionScores(scores);
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

  // Helper function to render the diff view
  const renderDiff = () => {
    return (
      <div className="whitespace-pre-wrap font-mono text-sm">
        {differences.map((part, index) => {
          const className = part.added 
            ? 'bg-green-500/10 text-green-500' 
            : part.removed 
              ? 'bg-red-500/10 text-red-500 line-through' 
              : '';
          
          return (
            <span key={index} className={className}>
              {part.value}
            </span>
          );
        })}
      </div>
    );
  };

  // Helper function to render the side-by-side view
  const renderSideBySide = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-900 rounded-md">
          <h3 className="text-lg font-medium mb-2 text-gray-300">Original CV</h3>
          <div 
            className="whitespace-pre-wrap" 
            dangerouslySetInnerHTML={{ __html: highlightKeywords(originalText) }} 
          />
        </div>
        <div className="p-4 bg-gray-900 rounded-md">
          <h3 className="text-lg font-medium mb-2 text-gray-300">Optimized CV</h3>
          <div 
            className="whitespace-pre-wrap" 
            dangerouslySetInnerHTML={{ __html: highlightKeywords(optimizedText) }} 
          />
        </div>
      </div>
    );
  };

  // Helper function to render section improvements
  const renderSectionImprovements = () => {
    if (!matchAnalysis?.sectionAnalysis) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {Object.entries(matchAnalysis.sectionAnalysis).map(([section, data]) => (
          <Card key={section} className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg capitalize flex items-center justify-between">
                {section}
                <Badge variant={data.score > 0.7 ? "default" : data.score > 0.5 ? "secondary" : "destructive"}>
                  {Math.round(data.score * 100)}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">{data.feedback}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // Helper function to render keyword analysis
  const renderKeywordAnalysis = () => {
    if (!matchAnalysis?.matchedKeywords && !matchAnalysis?.missingKeywords) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Check className="w-5 h-5 mr-2 text-green-500" />
              Matched Keywords
            </CardTitle>
            <CardDescription>
              Keywords from the job description found in your CV
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {matchAnalysis?.matchedKeywords?.map((kw, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className="flex items-center gap-1 bg-green-500/10 border-green-500/20"
                >
                  {kw.keyword}
                  <span className="text-xs opacity-70">({Math.round(kw.relevance * 100)}%)</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-amber-500" />
              Missing Keywords
            </CardTitle>
            <CardDescription>
              Important keywords from the job description missing in your CV
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {matchAnalysis?.missingKeywords?.map((kw, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className="flex items-center gap-1 bg-amber-500/10 border-amber-500/20"
                >
                  {kw.keyword}
                  <span className="text-xs opacity-70">({Math.round(kw.importance * 100)}%)</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Helper function to render dimensional scores
  const renderDimensionalScores = () => {
    if (!matchAnalysis?.dimensionalScores) return null;
    
    const scores = matchAnalysis.dimensionalScores;
    const dimensions = [
      { name: 'Skills Match', value: scores.skillsMatch, icon: <Star className="w-4 h-4" /> },
      { name: 'Experience Match', value: scores.experienceMatch, icon: <TrendingUp className="w-4 h-4" /> },
      { name: 'Education Match', value: scores.educationMatch, icon: <TrendingUp className="w-4 h-4" /> },
      { name: 'Industry Fit', value: scores.industryFit, icon: <TrendingUp className="w-4 h-4" /> },
      { name: 'Keyword Density', value: scores.keywordDensity, icon: <TrendingUp className="w-4 h-4" /> },
      { name: 'Format Compatibility', value: scores.formatCompatibility, icon: <TrendingUp className="w-4 h-4" /> },
      { name: 'Content Relevance', value: scores.contentRelevance, icon: <TrendingUp className="w-4 h-4" /> },
    ];
    
    return (
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-4">Dimensional Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dimensions.map((dim) => (
            <div key={dim.name} className="bg-gray-900 p-4 rounded-md border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-1">
                  {dim.icon} {dim.name}
                </span>
                <Badge variant={dim.value > 0.7 ? "default" : dim.value > 0.5 ? "secondary" : "destructive"}>
                  {Math.round(dim.value * 100)}%
                </Badge>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    dim.value > 0.7 ? 'bg-green-500' : dim.value > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.round(dim.value * 100)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Comparative Analysis</h2>
      
      <Tabs defaultValue="side-by-side" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
          <TabsTrigger value="diff">Diff View</TabsTrigger>
          <TabsTrigger value="analysis">Detailed Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="side-by-side" className="mt-4">
          {renderSideBySide()}
        </TabsContent>
        
        <TabsContent value="diff" className="mt-4">
          <div className="p-4 bg-gray-900 rounded-md">
            {renderDiff()}
          </div>
        </TabsContent>
        
        <TabsContent value="analysis" className="mt-4">
          <div className="space-y-6">
            {renderDimensionalScores()}
            {renderSectionImprovements()}
            {renderKeywordAnalysis()}
            
            {matchAnalysis?.recommendations && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-4">Recommendations</h3>
                <ul className="space-y-2">
                  {matchAnalysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ArrowRight className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {matchAnalysis?.skillGap && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-4">Skill Gap Analysis</h3>
                <div className="p-4 bg-gray-900 rounded-md border border-gray-800">
                  <p className="whitespace-pre-wrap">{matchAnalysis.skillGap}</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ComparativeAnalysis; 