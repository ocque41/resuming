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
import AnalysisResultsContent from './AnalysisResultsContent';
import { AnalysisResult } from './types';

// Define types
interface Document {
  id: string;
  fileName: string;
  createdAt: string;
}

interface DocumentAnalyzerProps {
  documents: Document[];
  preSelectedDocumentId?: string;
}

// Analysis types
const ANALYSIS_TYPES = [
  { id: 'general', label: 'General Analysis', description: 'Overall document analysis and insights' },
  { id: 'cv', label: 'CV/Resume Analysis', description: 'Resume evaluation for job applications' },
  { id: 'presentation', label: 'Presentation Analysis', description: 'Slide deck effectiveness analysis' },
  { id: 'report', label: 'Report Analysis', description: 'Business report quality assessment' },
  { id: 'spreadsheet', label: 'Spreadsheet Analysis', description: 'Data organization and quality evaluation' },
];

export default function DocumentAnalyzer({ documents, preSelectedDocumentId }: DocumentAnalyzerProps) {
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string>(preSelectedDocumentId || '');
  const [analysisType, setAnalysisType] = React.useState<string>('general');
  const [isAnalyzing, setIsAnalyzing] = React.useState<boolean>(false);
  const [analysisResults, setAnalysisResults] = React.useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<string>('summary');
  const [selectedDocument, setSelectedDocument] = React.useState<Document | null>(null);
  const [useFallbackMode, setUseFallbackMode] = React.useState<boolean>(false);

  // Effect to set the initial document when the component mounts with a preSelectedDocumentId
  React.useEffect(() => {
    if (preSelectedDocumentId) {
      console.log(`Using pre-selected document ID: ${preSelectedDocumentId}`);
      handleDocumentChange(preSelectedDocumentId);
    }
  }, [preSelectedDocumentId, documents]);

  // This function finds and sets the selected document object when an ID is selected
  const handleDocumentChange = (documentId: string) => {
    console.log(`Document selected: ${documentId}`);
    setSelectedDocumentId(documentId);
    
    // Find the complete document object to get access to file name and other properties
    const document = documents.find(doc => doc.id === documentId) || null;
    console.log("Selected document details:", document);
    
    // Log detailed info about the selected document's fileName
    if (document) {
      console.log(`Document fileName: "${document.fileName}", type: ${typeof document.fileName}, exists: ${!!document.fileName}`);
    } else {
      console.error(`Could not find document with ID ${documentId} in the documents list:`, documents);
    }
    
    setSelectedDocument(document);
    
    // Reset the analysis results and errors when changing documents
    setAnalysisResults(null);
    setAnalysisError(null);
    setUseFallbackMode(false);
  };

  // Effect to ensure we have the full document information when we have a selected document ID
  React.useEffect(() => {
    // If we have a selected document ID but not the document object, fetch the document
    if (selectedDocumentId && !selectedDocument) {
      console.log('Have document ID but not document object, trying to find in documents list');
      
      // Try to find the document in the list
      const document = documents.find(doc => doc.id === selectedDocumentId);
      if (document) {
        console.log('Found document in list:', document);
        setSelectedDocument(document);
      } else {
        console.error('Could not find document with ID:', selectedDocumentId);
        // This could happen if the documents list is not yet loaded
        // We'll let the parent component handle loading the document
      }
    }
  }, [selectedDocumentId, selectedDocument, documents]);

  const handleAnalysisTypeChange = (type: string) => {
    console.log(`Analysis type changed to: ${type}`);
    setAnalysisType(type);
    // Reset results when analysis type changes
    if (analysisResults) {
      setAnalysisResults(null);
    }
  };

  // Helper function to get file extension from filename
  const getFileExtension = (fileName: string): string => {
    return fileName.split('.').pop()?.toLowerCase() || '';
  };

  // Helper function to determine if the selected file is supported
  const isSupportedFileType = (fileName: string): boolean => {
    const extension = getFileExtension(fileName);
    const supportedExtensions = ['pdf', 'docx', 'txt', 'doc', 'rtf', 'xlsx', 'pptx', 'csv', 'json', 'xml'];
    return supportedExtensions.includes(extension);
  };

  // Generate mock analysis if the API fails
  const generateFallbackAnalysis = (): AnalysisResult => {
    if (!selectedDocument) {
      throw new Error("No document selected");
    }

    const fileExtension = getFileExtension(selectedDocument.fileName);
    const currentTime = new Date().toISOString();
    
    return {
      documentId: selectedDocumentId,
      summary: `This appears to be a ${fileExtension.toUpperCase()} document named "${selectedDocument.fileName}". Fallback analysis has been generated as the full analysis service is currently unavailable.`,
      keyPoints: [
        "Document successfully processed in fallback mode",
        "Limited analysis available due to API unavailability",
        "Basic document information extracted from filename"
      ],
      recommendations: [
        "Try analyzing again later when the full service is available",
        "Check your network connection"
      ],
      insights: {
        clarity: 50,
        relevance: 50,
        completeness: 50,
        conciseness: 50,
        overallScore: 50
      },
      topics: [
        { topic: fileExtension.toUpperCase() + " Document", relevance: 1.0 },
        { topic: "Document Analysis", relevance: 0.8 }
      ],
      entities: [
        { name: selectedDocument.fileName, type: "Document", count: 1 }
      ],
      sentiment: {
        overall: "Neutral",
        score: 0.5
      },
      timestamp: currentTime
    };
  };

  const analyzeDocument = async () => {
    if (!selectedDocumentId) {
      console.error("No document selected");
      setAnalysisError("Please select a document to analyze.");
      return;
    }

    // Find the selected document in the documents array
    const selectedDocument = documents.find(doc => doc.id === selectedDocumentId);
    if (!selectedDocument) {
      console.error("Selected document not found in documents array");
      console.log("Available documents:", documents.map(doc => `${doc.id}: ${doc.fileName}`));
      setAnalysisError("Selected document information could not be found. Please try selecting it again.");
      return;
    }

    // Log document info for debugging
    console.log("Selected document for analysis:", {
      id: selectedDocument.id,
      fileName: selectedDocument.fileName,
      fileNameExists: !!selectedDocument.fileName,
      fileNameLength: selectedDocument.fileName ? selectedDocument.fileName.length : 0
    });

    const fileName = selectedDocument.fileName;
    if (!fileName) {
      console.warn("Selected document is missing fileName, but we'll continue and let the server try to fetch it");
    }

    // Only check file type if fileName is available
    if (fileName) {
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
      if (!isSupportedFileType(fileName)) {
        console.error(`Unsupported file type: ${fileExtension}`);
        setAnalysisError(`Unsupported file type: .${fileExtension}. Please select a different document.`);
        return;
      }
    }

    setIsAnalyzing(true);
    setAnalysisResults(null);
    setAnalysisError(null);

    try {
      // Create a request body, only including fileName if it exists
      const requestBody: {
        documentId: string;
        type: string;
        fileName?: string;
      } = {
        documentId: selectedDocumentId,
        type: analysisType,
      };

      // Only add fileName if it exists
      if (fileName) {
        requestBody.fileName = fileName;
      }

      console.log("Sending analysis request with payload:", requestBody);

      // Timeout promise to handle API timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Analysis request timed out after 20 seconds")), 20000);
      });

      // Create a function that handles retries
      const makeRequestWithRetry = async (retryCount = 0, maxRetries = 2) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          console.log(`Making request (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          const response = await fetch("/api/document/analyze", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
            console.error("Analysis API error response:", errorData);
            
            if (response.status === 500 && retryCount < maxRetries) {
              // Implement exponential backoff
              const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
              console.log(`Request failed, retrying in ${backoffTime}ms...`);
              
              await new Promise(resolve => setTimeout(resolve, backoffTime));
              return makeRequestWithRetry(retryCount + 1, maxRetries);
            }
            
            throw new Error(errorData.error || `Server error: ${response.status}`);
          }

          const data = await response.json();
          console.log("Analysis complete, received data:", data);
          return data;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error("Analysis request timed out");
          }
          
          if (retryCount < maxRetries) {
            // Implement exponential backoff
            const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
            console.log(`Request failed with error: ${error instanceof Error ? error.message : error}`);
            console.log(`Retrying in ${backoffTime}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            return makeRequestWithRetry(retryCount + 1, maxRetries);
          }
          
          throw error;
        }
      };

      // Use Promise.race to handle timeouts
      const result = await Promise.race([
        makeRequestWithRetry(),
        timeoutPromise
      ]) as AnalysisResult;

      setAnalysisResults(result);
      setActiveTab("summary");
    } catch (error) {
      console.error("Error analyzing document:", error);
      setAnalysisError(
        error instanceof Error 
          ? error.message 
          : "An unexpected error occurred during analysis. Please try again later."
      );
      
      // Fall back to a client-side generated analysis in case of API failure
      console.log("Falling back to client-side generated analysis");
      const fallbackResult = generateFallbackAnalysis();
      setAnalysisResults(fallbackResult);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get the file type icon
  const getFileIcon = (fileName: string) => {
    const extension = getFileExtension(fileName);
    
    switch(extension) {
      case 'pdf':
        return <FileText className="h-6 w-6 text-[#F87171]" />;
      case 'docx':
      case 'doc':
      case 'rtf':
        return <FileText className="h-6 w-6 text-[#60A5FA]" />;
      case 'xlsx':
      case 'csv':
        return <FileText className="h-6 w-6 text-[#34D399]" />;
      case 'pptx':
        return <FileText className="h-6 w-6 text-[#F97316]" />;
      default:
        return <FileText className="h-6 w-6 text-[#B4916C]" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
            Document Analyzer
          </CardTitle>
          <CardDescription className="text-[#8A8782]">
            Analyze documents in PDF, DOCX, TXT, XLSX, PPTX and more formats.
          </CardDescription>
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
            
            {/* Selected document info */}
            {selectedDocument && (
              <div className="flex items-center gap-3 p-3 bg-[#161616] rounded-lg">
                <div className="p-2 bg-[#111111] rounded-md">
                  {getFileIcon(selectedDocument.fileName)}
                </div>
                <div>
                  <h3 className="text-[#F9F6EE] text-sm font-medium">{selectedDocument.fileName}</h3>
                  <p className="text-[#8A8782] text-xs">
                    {new Date(selectedDocument.createdAt).toLocaleDateString()} • {getFileExtension(selectedDocument.fileName).toUpperCase()}
                  </p>
                </div>
              </div>
            )}
            
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
                ) : useFallbackMode ? (
                  <>
                    <BarChart2 className="h-4 w-4 mr-2" />
                    Use Simplified Analysis
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
              <AnalysisResultsContent result={analysisResults} documentId={selectedDocumentId} />
            </div>
          )}
          
          {/* Analysis error */}
          {analysisError && (
            <div className="mt-4 p-4 bg-[#3A1F24] border border-[#E57373]/30 rounded-xl">
              <div className="flex flex-col">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-[#E57373] mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-[#F9F6EE]">{analysisError}</p>
                </div>
                
                {useFallbackMode && (
                  <Button 
                    onClick={analyzeDocument}
                    className="mt-4 self-end bg-[#3A1F24] border border-[#E57373] text-[#E57373] hover:bg-[#4A2F34]"
                    size="sm"
                  >
                    Try Simplified Analysis
                  </Button>
                )}
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