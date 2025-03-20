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
    if (!selectedDocumentId || !selectedDocument) {
      console.error("No document selected for analysis");
      setAnalysisError("Please select a document to analyze");
      return;
    }
    
    // Check for missing fileName - a valid document must have a fileName
    if (!selectedDocument.fileName) {
      console.error("Selected document is missing fileName");
      setAnalysisError("The selected document is missing required information. Please try selecting it again or choose a different document.");
      return;
    }
    
    // Check if the file type is supported
    if (!isSupportedFileType(selectedDocument.fileName)) {
      console.error(`Unsupported file type: ${getFileExtension(selectedDocument.fileName)}`);
      setAnalysisError(`File type "${getFileExtension(selectedDocument.fileName)}" is not supported for analysis. Please select a supported document type (PDF, DOCX, TXT, etc).`);
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    console.log('Starting document analysis for document ID:', selectedDocumentId, 'Type:', analysisType);
    console.log('Document filename:', selectedDocument.fileName);
    
    try {
      // If fallback mode is already enabled, use the client-side analysis
      if (useFallbackMode) {
        console.log('Using client-side fallback mode for analysis');
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        const fallbackResults = generateFallbackAnalysis();
        console.log('Generated fallback analysis results:', fallbackResults);
        setAnalysisResults(fallbackResults);
        return;
      }
      
      console.log('Sending analysis request to API endpoint');
      
      try {
        const requestBody = {
          documentId: selectedDocumentId,
          type: analysisType,
          fileName: selectedDocument.fileName
        };
        console.log('Request payload:', JSON.stringify(requestBody));
        
        // Create a timeout promise to handle API timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout - API did not respond in time')), 20000); // Increase timeout to 20 seconds
        });
        
        // Function to make the API request with retries
        const makeRequestWithRetry = async (retryCount = 0, maxRetries = 2) => {
          try {
            console.log(`Making API request (attempt ${retryCount + 1} of ${maxRetries + 1})`);
            
            // Create the fetch promise
            const fetchPromise = fetch('/api/document/analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });
            
            // Race between the fetch and the timeout
            const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
            
            console.log('API response status:', response.status);
            console.log('API response status text:', response.statusText);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('Error response text:', errorText);
              
              let errorData;
              try {
                errorData = JSON.parse(errorText);
              } catch (e) {
                console.error('Failed to parse error response as JSON:', e);
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
              }
              
              console.error('Parsed error data:', errorData);
              throw new Error(errorData.error || `Failed to analyze document: ${response.status}`);
            }
            
            console.log('Successfully received response from API');
            const data = await response.json();
            console.log('Analysis result data structure:', Object.keys(data));
            return data;
          } catch (error) {
            console.error(`Request attempt ${retryCount + 1} failed:`, error);
            
            // If we've reached the max retries, throw the error
            if (retryCount >= maxRetries) {
              throw error;
            }
            
            // Otherwise, wait and retry
            const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
            console.log(`Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return makeRequestWithRetry(retryCount + 1, maxRetries);
          }
        };
        
        // Make the request with retry logic
        const data = await makeRequestWithRetry();
        console.log('Analysis result:', data);
        setAnalysisResults(data);
      } catch (apiError) {
        console.error('All API request attempts failed:', apiError);
        
        // If the API completely fails after retries, switch to fallback mode
        console.log('Switching to client-side fallback mode');
        setUseFallbackMode(true);
        
        // Ask user if they want to try fallback mode
        setAnalysisError(`Unable to reach the document analysis service. Would you like to use a simplified client-side analysis instead?`);
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('Analysis error details:', error);
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Check if it's a timeout error
        if (error.message.includes('timeout')) {
          setAnalysisError(`The analysis service is taking too long to respond. Would you like to use a simplified analysis instead?`);
          setUseFallbackMode(true);
        } else {
          setAnalysisError(`An error occurred while analyzing the document: ${error.message}. Please try again.`);
        }
      } else {
        setAnalysisError(`An unknown error occurred. Please try again.`);
      }
    } finally {
      console.log('Analysis process completed, isAnalyzing set to false');
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