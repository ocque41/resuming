import React from 'react';
import { 
  BarChart2, 
  CheckCircle, 
  AlertCircle,
  Info, 
  FileText, 
  PieChart,
  LucideIcon,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from 'next/link';

interface AnalysisResult {
  documentId: number;
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  insights: {
    clarity: number;
    relevance: number;
    completeness: number;
    conciseness: number;
    overallScore: number;
  };
  topics: { topic: string; relevance: number }[];
  entities: { name: string; type: string }[];
  sentiment: {
    overall: string;
    score: number;
  };
  languageQuality: {
    grammar: number;
    spelling: number;
    readability: number;
    overall: number;
  };
  timestamp: string;
}

interface AnalysisSection {
  title: string;
  icon: LucideIcon;
  description: string;
}

interface AnalysisResultsProps {
  result?: AnalysisResult;
  documentId?: number;
  loading?: boolean;
  error?: string;
  onReanalyze?: () => void;
}

export default function AnalysisResults({ 
  result, 
  documentId, 
  loading = false, 
  error, 
  onReanalyze 
}: AnalysisResultsProps) {
  if (loading) {
    return <AnalysisResultsLoading />;
  }

  if (error) {
    return <AnalysisResultsError error={error} onReanalyze={onReanalyze} />;
  }

  if (!result) {
    return <AnalysisResultsEmpty documentId={documentId} />;
  }

  const { 
    summary, 
    keyPoints, 
    recommendations, 
    insights, 
    topics, 
    entities, 
    sentiment, 
    languageQuality 
  } = result;

  const sections: AnalysisSection[] = [
    {
      title: "Document Quality",
      icon: BarChart2,
      description: "Overall quality assessment of your document",
    },
    {
      title: "Key Points",
      icon: CheckCircle,
      description: "Important points extracted from your document",
    },
    {
      title: "Insights",
      icon: PieChart,
      description: "Analytical insights from your document",
    },
    {
      title: "Recommendations",
      icon: Info,
      description: "Suggestions to improve your document",
    },
  ];

  const overallScore = insights?.overallScore || 0;
  const scoreColor = getScoreColor(overallScore);
  const sentimentColor = getSentimentColor(sentiment?.score || 0);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
            Document Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#E2DFD7] text-sm font-borna leading-relaxed">
            {summary || "No summary available for this document."}
          </p>
        </CardContent>
      </Card>

      {/* Main Analysis Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-[#080808] border border-[#222222] mb-4 w-full justify-start">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
            Overview
          </TabsTrigger>
          <TabsTrigger value="insights" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
            Insights
          </TabsTrigger>
          <TabsTrigger value="language" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
            Language
          </TabsTrigger>
          <TabsTrigger value="topics" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
            Topics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab Content */}
        <TabsContent value="overview" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Overall Score */}
            <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
                    Overall Quality
                  </CardTitle>
                  <Badge className={scoreColor.badge}>
                    {overallScore}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Progress value={overallScore} className="h-2" />
                  </div>
                  <p className="text-sm text-[#8A8782]">
                    {getScoreMessage(overallScore)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Sentiment Analysis */}
            <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
                    Document Sentiment
                  </CardTitle>
                  <Badge className={sentimentColor.badge}>
                    {sentiment?.overall || "Neutral"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Progress 
                      value={(sentiment?.score || 0) * 100} 
                      className="h-2" 
                    />
                  </div>
                  <p className="text-sm text-[#8A8782]">
                    {getSentimentMessage(sentiment?.score || 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Points */}
          <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
                Key Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              {keyPoints && keyPoints.length > 0 ? (
                <ul className="space-y-2">
                  {keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-2 text-[#E2DFD7] text-sm">
                      <CheckCircle className="h-4 w-4 text-[#4ADE80] mt-0.5 flex-shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#8A8782] text-sm">No key points extracted from this document.</p>
              )}
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations && recommendations.length > 0 ? (
                <ul className="space-y-2">
                  {recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-[#E2DFD7] text-sm">
                      <Info className="h-4 w-4 text-[#FFB74D] mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#8A8782] text-sm">No recommendations available for this document.</p>
              )}
            </CardContent>
            {recommendations && recommendations.length > 0 && (
              <CardFooter className="pb-4 pt-0 px-6">
                <Link href={`/dashboard/enhance?documentId=${documentId}`}>
                  <Button size="sm" className="bg-[#B4916C] hover:bg-[#A3815C] text-white">
                    Edit with AI
                  </Button>
                </Link>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        {/* Insights Tab Content */}
        <TabsContent value="insights" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Detailed Insights */}
            <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
                  Content Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-[#8A8782]">Clarity</span>
                        <span className="text-sm text-[#F9F6EE]">{insights?.clarity || 0}%</span>
                      </div>
                      <Progress value={insights?.clarity || 0} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-[#8A8782]">Relevance</span>
                        <span className="text-sm text-[#F9F6EE]">{insights?.relevance || 0}%</span>
                      </div>
                      <Progress value={insights?.relevance || 0} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-[#8A8782]">Completeness</span>
                        <span className="text-sm text-[#F9F6EE]">{insights?.completeness || 0}%</span>
                      </div>
                      <Progress value={insights?.completeness || 0} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-[#8A8782]">Conciseness</span>
                        <span className="text-sm text-[#F9F6EE]">{insights?.conciseness || 0}%</span>
                      </div>
                      <Progress value={insights?.conciseness || 0} className="h-1.5" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Entities */}
            <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
                  Entities
                </CardTitle>
              </CardHeader>
              <CardContent>
                {entities && entities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {entities.map((entity, index) => (
                      <Badge 
                        key={index} 
                        className={getEntityBadgeColor(entity.type)}
                      >
                        {entity.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#8A8782] text-sm">No entities detected in this document.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Language Tab Content */}
        <TabsContent value="language" className="mt-0">
          <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
                  Language Quality
                </CardTitle>
                <Badge className={getLanguageQualityBadge(languageQuality?.overall || 0)}>
                  {languageQuality?.overall || 0}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#080808] rounded-lg p-4 border border-[#222222]">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[#F9F6EE] font-medium">Grammar</h4>
                      <span className="text-sm text-[#4ADE80]">{languageQuality?.grammar || 0}%</span>
                    </div>
                    <Progress value={languageQuality?.grammar || 0} className="h-1.5" />
                  </div>
                  <div className="bg-[#080808] rounded-lg p-4 border border-[#222222]">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[#F9F6EE] font-medium">Spelling</h4>
                      <span className="text-sm text-[#64B5F6]">{languageQuality?.spelling || 0}%</span>
                    </div>
                    <Progress value={languageQuality?.spelling || 0} className="h-1.5" />
                  </div>
                  <div className="bg-[#080808] rounded-lg p-4 border border-[#222222]">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[#F9F6EE] font-medium">Readability</h4>
                      <span className="text-sm text-[#FFB74D]">{languageQuality?.readability || 0}%</span>
                    </div>
                    <Progress value={languageQuality?.readability || 0} className="h-1.5" />
                  </div>
                </div>
                <div className="pt-2 border-t border-[#222222]">
                  <p className="text-sm text-[#8A8782]">
                    {getLanguageQualityMessage(languageQuality?.overall || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-4 pt-0 px-6">
              <Link href={`/dashboard/enhance?documentId=${documentId}`}>
                <Button className="bg-[#B4916C] hover:bg-[#A3815C] text-white">
                  Improve Language Quality
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Topics Tab Content */}
        <TabsContent value="topics" className="mt-0">
          <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
                Topics & Themes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topics && topics.length > 0 ? (
                <div className="space-y-3">
                  {topics.map((topic, index) => (
                    <div key={index}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-[#E2DFD7] font-medium">{topic.topic}</span>
                        <span className="text-sm text-[#8A8782]">{Math.round(topic.relevance * 100)}%</span>
                      </div>
                      <Progress 
                        value={topic.relevance * 100} 
                        className="h-2" 
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#8A8782] text-sm">No topics detected in this document.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Re-analyze button */}
      {onReanalyze && (
        <div className="flex justify-end mt-4">
          <Button 
            variant="outline" 
            onClick={onReanalyze}
            className="border-[#222222] hover:bg-[#161616]"
          >
            Re-analyze Document
          </Button>
        </div>
      )}
    </div>
  );
}

// Loading state component
function AnalysisResultsLoading() {
  return (
    <div className="space-y-6">
      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Error state component
function AnalysisResultsError({ error, onReanalyze }: { error: string; onReanalyze?: () => void }) {
  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-safiro text-[#E57373]">
          Analysis Error
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#3A1F24] p-3 rounded-full">
            <AlertCircle className="h-6 w-6 text-[#E57373]" />
          </div>
          <p className="text-[#E2DFD7] text-sm">{error}</p>
        </div>
        <p className="text-[#8A8782] text-sm mb-4">
          There was an error while analyzing your document. This could be due to:
        </p>
        <ul className="text-[#8A8782] text-sm list-disc pl-5 space-y-1 mb-4">
          <li>Temporary service disruption</li>
          <li>Issues with the document format</li>
          <li>Text extraction problems</li>
        </ul>
      </CardContent>
      {onReanalyze && (
        <CardFooter>
          <Button onClick={onReanalyze} className="bg-[#B4916C] hover:bg-[#A3815C] text-white">
            Try Again
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// Empty state component
function AnalysisResultsEmpty({ documentId }: { documentId?: number }) {
  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
          Document Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <div className="bg-[#161616] p-4 rounded-full inline-flex mb-4">
            <FileText className="h-10 w-10 text-[#8A8782]" />
          </div>
          <h3 className="text-[#F9F6EE] font-safiro text-lg mb-2">No Analysis Available</h3>
          <p className="text-[#8A8782] text-sm max-w-md mx-auto mb-6">
            This document hasn't been analyzed yet. Run an analysis to get insights about its content,
            language quality, and recommendations for improvement.
          </p>
          {documentId && (
            <Link href={`/dashboard/document-analyzer?documentId=${documentId}`}>
              <Button className="bg-[#B4916C] hover:bg-[#A3815C] text-white">
                <BarChart2 className="h-4 w-4 mr-2" />
                Analyze Document
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions for styling and messages
function getScoreColor(score: number) {
  if (score >= 80) {
    return {
      badge: 'bg-[#0D1F15] text-[#4ADE80]',
      progress: 'bg-[#4ADE80]'
    };
  } else if (score >= 60) {
    return {
      badge: 'bg-[#382917] text-[#FFB74D]',
      progress: 'bg-[#FFB74D]'
    };
  } else {
    return {
      badge: 'bg-[#3A1F24] text-[#E57373]',
      progress: 'bg-[#E57373]'
    };
  }
}

function getScoreMessage(score: number): string {
  if (score >= 80) {
    return "Your document is well-structured and of high quality.";
  } else if (score >= 60) {
    return "Your document is decent but has room for improvement.";
  } else {
    return "Your document needs significant improvements.";
  }
}

function getSentimentColor(score: number) {
  if (score >= 0.3) {
    return {
      badge: 'bg-[#0D1F15] text-[#4ADE80]',
      progress: 'bg-[#4ADE80]'
    };
  } else if (score >= -0.3) {
    return {
      badge: 'bg-[#161616] text-[#8A8782]',
      progress: 'bg-[#8A8782]'
    };
  } else {
    return {
      badge: 'bg-[#3A1F24] text-[#E57373]',
      progress: 'bg-[#E57373]'
    };
  }
}

function getSentimentMessage(score: number): string {
  if (score >= 0.3) {
    return "Your document conveys a positive tone.";
  } else if (score >= -0.3) {
    return "Your document maintains a neutral tone.";
  } else {
    return "Your document has a predominantly negative tone.";
  }
}

function getEntityBadgeColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'person':
      return 'bg-[#1A1F2A] text-[#64B5F6] border border-[#1A1F2A]';
    case 'organization':
      return 'bg-[#0D1F15] text-[#4ADE80] border border-[#0D1F15]';
    case 'location':
      return 'bg-[#382917] text-[#FFB74D] border border-[#382917]';
    case 'date':
      return 'bg-[#1F1B32] text-[#B39DDB] border border-[#1F1B32]';
    default:
      return 'bg-[#161616] text-[#8A8782] border border-[#333333]';
  }
}

function getLanguageQualityBadge(score: number): string {
  if (score >= 80) {
    return 'bg-[#0D1F15] text-[#4ADE80]';
  } else if (score >= 60) {
    return 'bg-[#382917] text-[#FFB74D]';
  } else {
    return 'bg-[#3A1F24] text-[#E57373]';
  }
}

function getLanguageQualityMessage(score: number): string {
  if (score >= 80) {
    return "The language quality of your document is excellent with few or no errors.";
  } else if (score >= 60) {
    return "The language quality is good but could be improved with some edits.";
  } else {
    return "The language quality needs significant improvement. Consider a thorough review.";
  }
}

function getTopicColor(relevance: number): string {
  if (relevance >= 0.7) {
    return 'bg-[#4ADE80]';
  } else if (relevance >= 0.4) {
    return 'bg-[#FFB74D]';
  } else {
    return 'bg-[#8A8782]';
  }
} 