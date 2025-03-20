"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart2, PieChart, AlertCircle, FileText } from 'lucide-react';
import DebugViewer from './DebugViewer.client';

interface Document {
  id: string;
  fileName: string;
  createdAt: Date;
}

interface DocumentAnalyzerProps {
  documents: Document[];
}

export default function DocumentAnalyzer({ documents }: DocumentAnalyzerProps) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Function to handle document analysis
  const handleAnalyze = async () => {
    if (!selectedDocumentId) {
      setError("Please select a document to analyze");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResults(null);
    setDebugInfo(null);

    try {
      console.log(`Analyzing document with ID: ${selectedDocumentId}`);
      
      const response = await fetch('/api/document/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: selectedDocumentId }),
      });

      const responseData = await response.json();
      console.log("Response data:", responseData);
      setDebugInfo(responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to analyze document');
      }

      if (!responseData.analysis) {
        throw new Error('Analysis results not found in response');
      }

      setAnalysisResults(responseData.analysis);
    } catch (error) {
      console.error('Error analyzing document:', error);
      setError(`Analysis error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div>
      {/* Document Selection */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select a Document to Analyze
        </label>
        <div className="flex gap-4">
          <select 
            className="flex-1 bg-black border border-gray-700 rounded-md p-2.5 text-gray-300 focus:ring-[#B4916C] focus:border-[#B4916C]"
            value={selectedDocumentId}
            onChange={(e) => setSelectedDocumentId(e.target.value)}
          >
            <option value="">Select a document...</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>{doc.fileName}</option>
            ))}
          </select>
          <Button 
            className="bg-[#B4916C] hover:bg-[#A3815C] text-white"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !selectedDocumentId}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
      </div>

      {/* Debug information */}
      {debugInfo && <DebugViewer data={debugInfo} title="API Response" />}

      {/* Error message if any */}
      {error && (
        <Alert className="mb-6 bg-red-900/20 border-red-900/30">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-300">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Analytics Tabs */}
      {!analysisResults && !isAnalyzing && (
        <Alert className="mb-6 bg-[#B4916C]/10 border-[#B4916C]/20 text-[#B4916C]">
          <AlertCircle className="h-4 w-4 text-[#B4916C]" />
          <AlertDescription className="text-gray-300">
            Select a document and click "Analyze" to generate insights. Our AI will process the document and extract meaningful information.
          </AlertDescription>
        </Alert>
      )}

      {isAnalyzing && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#B4916C] mb-4"></div>
          <p className="text-gray-300">Analyzing your document. This may take a moment...</p>
        </div>
      )}

      {analysisResults && (
        <Tabs defaultValue="content" className="mb-6">
          <TabsList className="bg-black border border-gray-800 mb-6">
            <TabsTrigger value="content" className="data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              Content Analysis
            </TabsTrigger>
            <TabsTrigger value="sentiment" className="data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              Sentiment Analysis
            </TabsTrigger>
            <TabsTrigger value="information" className="data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              Key Information
            </TabsTrigger>
            <TabsTrigger value="summary" className="data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              Summary
            </TabsTrigger>
          </TabsList>
          
          {/* Content Analysis Tab */}
          <TabsContent value="content" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Content Distribution Chart */}
              <Card className="border border-gray-800 bg-black/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#B4916C]">Content Distribution</CardTitle>
                  <CardDescription className="text-gray-500">
                    Breakdown of document content by category
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-80 flex items-center justify-center">
                    {/* Placeholder for PieChart - In a real implementation, use a charting library */}
                    <div className="w-64 h-64 rounded-full border-8 border-[#B4916C]/30 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#B4916C]">
                            {analysisResults.contentAnalysis?.contentDistribution?.[0]?.value || 0}%
                          </div>
                          <div className="text-xs text-gray-400">
                            {analysisResults.contentAnalysis?.contentDistribution?.[0]?.name || 'Primary Content'}
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-0 right-0 w-6 h-6 rounded-full bg-[#B4916C]"></div>
                      <div className="absolute top-1/4 right-0 w-5 h-5 rounded-full bg-[#B4916C]/80"></div>
                      <div className="absolute bottom-1/4 right-0 w-4 h-4 rounded-full bg-[#B4916C]/60"></div>
                      <div className="absolute bottom-0 right-1/4 w-4 h-4 rounded-full bg-[#B4916C]/40"></div>
                      <div className="absolute bottom-0 left-1/4 w-3 h-3 rounded-full bg-[#B4916C]/20"></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {analysisResults.contentAnalysis?.contentDistribution?.map((item: any, index: number) => (
                      <div key={index} className="flex items-center">
                        <div className={`w-3 h-3 rounded-full bg-[#B4916C]/${90 - index * 15} mr-2`}></div>
                        <div className="text-sm">
                          <span className="text-gray-300">{item.name}</span>
                          <span className="text-[#B4916C] ml-2">{item.value}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Top Keywords */}
              <Card className="border border-gray-800 bg-black/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#B4916C]">Top Keywords</CardTitle>
                  <CardDescription className="text-gray-500">
                    Most frequent terminology in your document
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-80 p-4 bg-black/30 rounded-lg border border-gray-800 flex flex-wrap items-center justify-center gap-3">
                    {analysisResults.contentAnalysis?.topKeywords?.map((keyword: any, index: number) => (
                      <div 
                        key={index} 
                        className="px-3 py-1.5 rounded-full bg-[#B4916C]/20 text-[#B4916C] border border-[#B4916C]/30"
                        style={{ fontSize: `${0.8 + (keyword.value / 10)}rem` }}
                      >
                        {keyword.text}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Sentiment Analysis Tab */}
          <TabsContent value="sentiment" className="mt-0">
            <Card className="border border-gray-800 bg-black/20 shadow-lg mb-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#B4916C]">Document Sentiment Score</CardTitle>
                <CardDescription className="text-gray-500">
                  Overall sentiment analysis of your document content
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-center py-8">
                  <div className="relative w-48 h-48">
                    <div className="absolute inset-0 rounded-full border-8 border-gray-800"></div>
                    <div 
                      className="absolute inset-0 rounded-full border-8 border-[#B4916C]"
                      style={{ 
                        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)', 
                        clip: 'rect(0px, 96px, 192px, 0px)' 
                      }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <div className="text-4xl font-bold text-[#B4916C]">
                        {analysisResults.sentimentAnalysis?.overallScore?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-sm text-gray-400">Positive Sentiment</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 mt-2">
                  <div className="text-white font-medium mb-2">Sentiment by Section</div>
                  {analysisResults.sentimentAnalysis?.sentimentBySection?.map((item: any, index: number) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{item.section}</span>
                        <span className="text-[#B4916C]">{item.score.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div 
                          className="bg-[#B4916C] h-2 rounded-full" 
                          style={{ width: `${item.score * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Key Information Tab */}
          <TabsContent value="information" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border border-gray-800 bg-black/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#B4916C]">Contact Information</CardTitle>
                  <CardDescription className="text-gray-500">
                    Detected contact details in your document
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3 mt-2">
                    {analysisResults.keyInformation?.contactInfo?.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-2 border-b border-gray-800">
                        <span className="text-gray-400">{item.type}</span>
                        <span className="text-[#F9F6EE] font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-gray-800 bg-black/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#B4916C]">Key Entities</CardTitle>
                  <CardDescription className="text-gray-500">
                    Important elements identified in your document
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mt-2">
                    <div className="grid grid-cols-3 p-2 border-b border-gray-800 text-gray-400 text-sm">
                      <span>Type</span>
                      <span>Name</span>
                      <span className="text-right">Occurrences</span>
                    </div>
                    {analysisResults.keyInformation?.entities?.map((entity: any, index: number) => (
                      <div key={index} className="grid grid-cols-3 p-2 border-b border-gray-800 text-sm">
                        <span className="text-gray-400">{entity.type}</span>
                        <span className="text-[#F9F6EE]">{entity.name}</span>
                        <span className="text-[#B4916C] text-right">{entity.occurrences}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Summary Tab */}
          <TabsContent value="summary" className="mt-0">
            <Card className="border border-gray-800 bg-black/20 shadow-lg mb-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#B4916C]">Document Highlights</CardTitle>
                <CardDescription className="text-gray-500">
                  Key strengths identified in your document
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mt-2">
                  <ul className="space-y-2">
                    {analysisResults.summary?.highlights?.map((highlight: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <div className="w-5 h-5 rounded-full bg-[#B4916C]/20 flex items-center justify-center text-[#B4916C] mr-3 mt-0.5">
                          <span className="text-xs">✓</span>
                        </div>
                        <span className="text-[#F9F6EE]">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-gray-800 bg-black/20 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#B4916C]">Improvement Suggestions</CardTitle>
                <CardDescription className="text-gray-500">
                  Recommendations to enhance your document
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mt-2">
                  <ul className="space-y-2">
                    {analysisResults.summary?.suggestions?.map((suggestion: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <div className="w-5 h-5 rounded-full bg-[#B4916C]/20 flex items-center justify-center text-[#B4916C] mr-3 mt-0.5">
                          <span className="text-xs">↑</span>
                        </div>
                        <span className="text-[#F9F6EE]">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-6 bg-[#222222] rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-400">Overall Score</div>
                    <div className="text-2xl font-bold text-[#B4916C]">{analysisResults.summary?.overallScore || 0}/100</div>
                  </div>
                  <div className="w-24 h-24 relative">
                    <div className="absolute inset-0 rounded-full border-8 border-gray-800"></div>
                    <div 
                      className="absolute inset-0 rounded-full border-8 border-[#B4916C]"
                      style={{ 
                        clipPath: `polygon(0 0, 100% 0, 100% 100%, 0% 100%)`,
                        clip: `rect(0px, ${(analysisResults.summary?.overallScore / 100) * 48 + 48}px, 96px, 0px)` 
                      }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                      {analysisResults.summary?.overallScore || 0}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
} 