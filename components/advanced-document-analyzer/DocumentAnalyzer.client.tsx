"use client";

import React from 'react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertCircle, FileText, BarChart2, PieChart, LineChart, Calendar, Check, 
  Info, Download, RefreshCw, ArrowRight
} from 'lucide-react';
import AnalysisRecommendations from './AnalysisRecommendations';
import AnalysisKeyPoints from './AnalysisKeyPoints';
import AnalysisInsights from './AnalysisInsights';

// Define types
interface Document {
  id: string;
  fileName: string;
  createdAt: string;
}

interface DocumentAnalyzerProps {
  documents: Document[];
}

// Define the expected structure of analysis results
interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  insights: {
    clarity: number;
    relevance: number;
    completeness?: number;
    conciseness?: number;
    overallScore?: number;
  };
  topics?: Array<{
    name: string;
    relevance: number;
  }>;
  entities?: Array<{
    name: string;
    type: string;
  }>;
  sentiment?: {
    overall: string;
    score: number;
  };
  languageQuality?: {
    grammar: number;
    spelling: number;
    readability: number;
    overall: number;
  };
}

// Analysis types
const ANALYSIS_TYPES = [
  { id: 'general', label: 'General Analysis', description: 'Overall document analysis and insights' },
  { id: 'cv', label: 'CV/Resume Analysis', description: 'Resume evaluation for job applications' },
  { id: 'presentation', label: 'Presentation Analysis', description: 'Slide deck effectiveness analysis' },
  { id: 'report', label: 'Report Analysis', description: 'Business report quality assessment' },
  { id: 'spreadsheet', label: 'Spreadsheet Analysis', description: 'Data organization and quality evaluation' },
];

// Create a simple AnalysisResultsContent component directly in this file
function AnalysisResultsContent({ result, documentId }: { result: AnalysisResult | null; documentId: string }) {
  if (!result) {
    return (
      <div className="p-6 bg-[#111111] rounded-xl border border-[#222222]">
        <p className="text-[#8A8782] text-center">No analysis results available</p>
      </div>
    );
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

  return (
    <div className="space-y-6">
      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
          <CardTitle className="text-lg font-medium text-[#F9F6EE]">
            Document Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <p className="text-[#E2DFD7] text-sm leading-relaxed whitespace-pre-line">{summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnalysisKeyPoints keyPoints={keyPoints} />
        <AnalysisRecommendations recommendations={recommendations} />
      </div>

      <AnalysisInsights insights={insights} topics={topics} />
    </div>
  );
}

export default function DocumentAnalyzer({ documents }: DocumentAnalyzerProps) {
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string>('');
  const [analysisType, setAnalysisType] = React.useState<string>('general');
  const [isAnalyzing, setIsAnalyzing] = React.useState<boolean>(false);
  const [analysisResults, setAnalysisResults] = React.useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<string>('summary');

  const handleDocumentChange = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setAnalysisResults(null);
    setAnalysisError(null);
  };

  const handleAnalysisTypeChange = (type: string) => {
    setAnalysisType(type);
    // Reset results when analysis type changes
    if (analysisResults) {
      setAnalysisResults(null);
    }
  };

  const analyzeDocument = async () => {
    if (!selectedDocumentId) return;
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      console.log(`Initiating document analysis: documentId=${selectedDocumentId}, type=${analysisType}`);
      
      const url = `/api/document/analyze?documentId=${selectedDocumentId}&type=${analysisType}`;
      console.log(`Sending request to: ${url}`);
      
      const response = await fetch(url);
      console.log(`Analysis response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.error || `Failed to analyze document: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Analysis completed successfully:', data);
      setAnalysisResults(data);
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError(`An error occurred while analyzing the document: ${error instanceof Error ? error.message : String(error)}. Please try again.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
            Document Analyzer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Document selection */}
            <div className="space-y-2">
              <label className="text-sm text-[#8A8782]">Select Document</label>
              <select 
                className="w-full p-2 bg-[#161616] border border-[#333333] rounded-md text-[#F9F6EE]"
                value={selectedDocumentId}
                onChange={(e) => handleDocumentChange(e.target.value)}
              >
                <option value="">Choose a document...</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.fileName}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Analysis type selection */}
            <div className="space-y-2">
              <label className="text-sm text-[#8A8782]">Analysis Type</label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={analysisType === 'general' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => handleAnalysisTypeChange('general')}
                  className={analysisType === 'general' ? 'bg-[#B4916C] hover:bg-[#A3815C]' : 'border-[#333333] text-[#8A8782]'}
                >
                  General
                </Button>
                <Button 
                  variant={analysisType === 'cv' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => handleAnalysisTypeChange('cv')}
                  className={analysisType === 'cv' ? 'bg-[#B4916C] hover:bg-[#A3815C]' : 'border-[#333333] text-[#8A8782]'}
                >
                  Resume/CV
                </Button>
                <Button 
                  variant={analysisType === 'report' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => handleAnalysisTypeChange('report')}
                  className={analysisType === 'report' ? 'bg-[#B4916C] hover:bg-[#A3815C]' : 'border-[#333333] text-[#8A8782]'}
                >
                  Report
                </Button>
              </div>
            </div>
            
            {/* Analyze button */}
            <div className="pt-4">
              <Button 
                onClick={analyzeDocument} 
                disabled={!selectedDocumentId || isAnalyzing}
                className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <BarChart2 className="h-4 w-4 mr-2" />
                    Analyze Document
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Analysis results */}
          {analysisResults && (
            <div className="mt-8 pt-6 border-t border-[#222222]">
              <h3 className="text-lg font-safiro text-[#F9F6EE] mb-4">Analysis Results</h3>
              
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-[#080808] border border-[#222222] mb-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="keyPoints">Key Points</TabsTrigger>
                  <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview">
                  <div className="bg-[#080808] rounded-lg border border-[#222222] p-4">
                    <div className="mb-4">
                      <h4 className="text-[#F9F6EE] font-medium mb-2">Document Summary</h4>
                      <p className="text-[#E2DFD7] text-sm">{analysisResults.summary}</p>
                    </div>
                    
                    <h4 className="text-[#F9F6EE] font-medium mb-2">Document Quality</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#111111] p-3 rounded-md border border-[#222222]">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[#8A8782]">Clarity</span>
                          <span className="text-[#F9F6EE]">{analysisResults.insights.clarity}%</span>
                        </div>
                        <Progress value={analysisResults.insights.clarity} className="h-1 bg-gray-800" />
                      </div>
                      <div className="bg-[#111111] p-3 rounded-md border border-[#222222]">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[#8A8782]">Relevance</span>
                          <span className="text-[#F9F6EE]">{analysisResults.insights.relevance}%</span>
                        </div>
                        <Progress value={analysisResults.insights.relevance} className="h-1 bg-gray-800" />
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="keyPoints">
                  <AnalysisKeyPoints keyPoints={analysisResults.keyPoints} />
                </TabsContent>
                
                <TabsContent value="recommendations">
                  <AnalysisRecommendations recommendations={analysisResults.recommendations} />
                </TabsContent>
                
                <TabsContent value="insights">
                  <AnalysisInsights insights={analysisResults.insights} topics={analysisResults.topics} />
                </TabsContent>
              </Tabs>
            </div>
          )}
          
          {/* Analysis error */}
          {analysisError && (
            <div className="mt-4 p-4 bg-[#3A1F24] border border-[#E57373]/30 rounded-xl">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-[#E57373] mr-2" />
                <p className="text-[#F9F6EE]">{analysisError}</p>
              </div>
            </div>
          )}
          
          {/* Empty state when no document is selected */}
          {!selectedDocumentId && !isAnalyzing && !analysisResults && !analysisError && (
            <div className="text-center py-8 text-[#8A8782]">
              <Info className="h-12 w-12 mx-auto mb-4 text-[#333333]" />
              <p className="mb-2">Select a document to analyze</p>
              <p className="text-sm max-w-md mx-auto">
                Choose one of your uploaded documents and select an analysis type to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 