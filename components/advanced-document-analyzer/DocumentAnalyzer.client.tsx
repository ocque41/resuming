"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  AlertCircle, FileText, BarChart2, PieChart, LineChart, Calendar, Check, 
  Info, Download, Lightbulb, RefreshCw, ArrowRight, ArrowUpRight, Sparkles
} from 'lucide-react';
import AnalysisResultsContent from './AnalysisResultsContent';
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

// Analysis types
const ANALYSIS_TYPES = [
  { id: 'general', label: 'General Analysis', description: 'Overall document analysis and insights' },
  { id: 'cv', label: 'CV/Resume Analysis', description: 'Resume evaluation for job applications' },
  { id: 'presentation', label: 'Presentation Analysis', description: 'Slide deck effectiveness analysis' },
  { id: 'report', label: 'Report Analysis', description: 'Business report quality assessment' },
  { id: 'spreadsheet', label: 'Spreadsheet Analysis', description: 'Data organization and quality evaluation' },
];

export default function DocumentAnalyzer({ documents }: DocumentAnalyzerProps) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [analysisType, setAnalysisType] = useState<string>('general');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('summary');

  const handleDocumentChange = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setAnalysisResults(null);
    setAnalysisError(null);
  };

  const handleAnalysisTypeChange = (type: string) => {
    setAnalysisType(type);
    // Only clear results if we already have results
    if (analysisResults) {
      setAnalysisResults(null);
      setAnalysisError(null);
    }
  };

  const analyzeDocument = async () => {
    if (!selectedDocumentId) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/document/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          analysisType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze document');
      }

      const data = await response.json();
      setAnalysisResults(data);
      setActiveTab('summary');
    } catch (error) {
      console.error('Error analyzing document:', error);
      setAnalysisError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Find the selected document
  const selectedDocument = documents.find(doc => doc.id === selectedDocumentId);

  return (
    <div className="space-y-6">
      {/* Document Selection */}
      <Card className="bg-black/20 border border-gray-800 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-safiro text-white flex items-center">
            <FileText className="h-5 w-5 text-[#B4916C] mr-2" />
            Select Document for Analysis
          </CardTitle>
          <CardDescription className="text-gray-400 font-borna">
            Choose a document to analyze and select the type of analysis to perform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Document</label>
              <Select value={selectedDocumentId} onValueChange={handleDocumentChange}>
                <SelectTrigger className="bg-black border-gray-700 text-gray-200">
                  <SelectValue placeholder="Select a document" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-gray-700 text-gray-200">
                  {documents.length === 0 ? (
                    <SelectItem value="no-documents" disabled>
                      No documents available
                    </SelectItem>
                  ) : (
                    documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.fileName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Analysis Type</label>
              <Select value={analysisType} onValueChange={handleAnalysisTypeChange}>
                <SelectTrigger className="bg-black border-gray-700 text-gray-200">
                  <SelectValue placeholder="Select analysis type" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-gray-700 text-gray-200">
                  {ANALYSIS_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <p className="text-xs text-gray-500 mt-1 italic">
                {ANALYSIS_TYPES.find(t => t.id === analysisType)?.description}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t border-gray-800 pt-4">
          <Button
            onClick={analyzeDocument}
            disabled={!selectedDocumentId || isAnalyzing}
            className="bg-[#B4916C] hover:bg-[#A3815C] text-white font-borna"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze Document
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Analysis Results */}
      {selectedDocumentId && (
        <Card className="bg-black/20 border border-gray-800 shadow-md overflow-hidden">
          <CardHeader className="pb-0">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl font-safiro text-white flex items-center">
                  <BarChart2 className="h-5 w-5 text-[#B4916C] mr-2" />
                  Document Analysis Results
                </CardTitle>
                {selectedDocument && (
                  <CardDescription className="text-gray-400 font-borna mt-1">
                    {selectedDocument.fileName}
                  </CardDescription>
                )}
              </div>
              
              {analysisResults && (
                <Badge 
                  variant="outline" 
                  className="bg-[#0D1F15] text-[#4ADE80] border-[#1A4332]"
                >
                  {analysisResults.cached ? 'From Cache' : 'Fresh Analysis'}
                </Badge>
              )}
            </div>
          </CardHeader>
          
          {analysisError && (
            <CardContent className="pt-4">
              <Alert variant="destructive" className="bg-[#3A1F24] border border-[#E57373]/30">
                <AlertCircle className="h-4 w-4 text-[#E57373]" />
                <AlertTitle className="text-[#E57373] ml-2">Analysis Failed</AlertTitle>
                <AlertDescription className="text-[#F9F6EE] ml-2">
                  {analysisError}
                </AlertDescription>
              </Alert>
            </CardContent>
          )}
          
          {!analysisResults && !analysisError && selectedDocumentId && (
            <CardContent className="pt-4">
              {isAnalyzing ? (
                <div className="space-y-4 py-4">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-10 h-10 rounded-full border-2 border-[#B4916C] border-t-transparent animate-spin"></div>
                    <div>
                      <p className="text-[#F9F6EE] font-borna">Analyzing document...</p>
                      <p className="text-[#8A8782] text-sm font-borna">This may take a minute or two</p>
                    </div>
                  </div>
                  <Progress value={45} className="h-1 bg-gray-800" indicatorClassName="bg-[#B4916C]" />
                </div>
              ) : (
                <div className="text-center py-8 text-[#8A8782]">
                  <Info className="h-10 w-10 mx-auto mb-3 text-[#B4916C]/50" />
                  <p className="font-borna">Select a document and click "Analyze Document" to begin analysis</p>
                </div>
              )}
            </CardContent>
          )}
          
          {analysisResults && analysisResults.analysis && (
            <>
              <CardContent className="pt-4">
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge className="bg-[#161616] text-[#F9F6EE] font-borna">
                      {analysisResults.analysis.documentType || 'Unknown Type'}
                    </Badge>
                    
                    {analysisResults.analysis.metadata?.confidenceScore && (
                      <Badge className="bg-[#161616] text-[#F9F6EE] font-borna">
                        Confidence: {analysisResults.analysis.metadata.confidenceScore}%
                      </Badge>
                    )}
                    
                    {analysisResults.analysis.metadata?.detectedLanguage && (
                      <Badge className="bg-[#161616] text-[#F9F6EE] font-borna">
                        Language: {analysisResults.analysis.metadata.detectedLanguage}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <Tabs defaultValue="summary" value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-black border border-gray-800 p-1">
                    <TabsTrigger value="summary" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
                      Summary
                    </TabsTrigger>
                    <TabsTrigger value="key-points" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
                      Key Points
                    </TabsTrigger>
                    <TabsTrigger value="analysis" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
                      Analysis
                    </TabsTrigger>
                    <TabsTrigger value="recommendations" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
                      Recommendations
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-4 bg-[#0A0A0A] rounded-lg border border-gray-800 overflow-hidden">
                    <TabsContent value="summary" className="m-0">
                      <div className="p-4">
                        <h3 className="text-[#F9F6EE] font-safiro text-lg mb-3">Document Summary</h3>
                        <p className="text-[#E2DFD7] font-borna whitespace-pre-line">
                          {analysisResults.analysis.summary}
                        </p>
                        
                        {analysisResults.analysis.metadata?.keyTopics && (
                          <div className="mt-4">
                            <h4 className="text-[#F9F6EE] font-safiro text-sm mb-2">Key Topics</h4>
                            <div className="flex flex-wrap gap-2">
                              {analysisResults.analysis.metadata.keyTopics.map((topic: string, index: number) => (
                                <Badge key={index} className="bg-[#111111] text-[#B4916C] border-[#333333]">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="key-points" className="m-0">
                      <AnalysisKeyPoints keyPoints={analysisResults.analysis.keyPoints} />
                    </TabsContent>
                    
                    <TabsContent value="analysis" className="m-0">
                      <AnalysisResultsContent analysis={analysisResults.analysis.analysis} />
                    </TabsContent>
                    
                    <TabsContent value="recommendations" className="m-0">
                      <AnalysisRecommendations recommendations={analysisResults.analysis.recommendations} />
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
              
              <CardFooter className="border-t border-gray-800 pt-4 flex justify-between items-center flex-wrap gap-4">
                <div className="text-xs text-gray-500 font-borna">
                  {analysisResults.analysis.analyzedAt && (
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1 text-gray-500" />
                      Analyzed on {new Date(analysisResults.analysis.analyzedAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex space-x-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[#F9F6EE] border-gray-700 hover:bg-[#161616]"
                          onClick={analyzeDocument}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Refresh
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Perform a new analysis</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[#F9F6EE] border-gray-700 hover:bg-[#161616]"
                          onClick={() => {
                            // This would typically download the analysis in a real implementation
                            console.log('Download analysis report', analysisResults);
                          }}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Export
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Export analysis as PDF</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardFooter>
            </>
          )}
        </Card>
      )}
    </div>
  );
} 