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
  // Create a ref to store analysis results to avoid state update issues
  const analysisResultsRef = React.useRef<AnalysisResult | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string>(preSelectedDocumentId || '');
  const [analysisType, setAnalysisType] = React.useState<string>('general');
  const [isAnalyzing, setIsAnalyzing] = React.useState<boolean>(false);
  const [analysisResults, setAnalysisResults] = React.useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<string>('summary');
  const [selectedDocument, setSelectedDocument] = React.useState<Document | null>(null);
  const [useFallbackMode, setUseFallbackMode] = React.useState<boolean>(false);
  // Add a force update state to trigger re-renders
  const [forceUpdateCounter, setForceUpdateCounter] = React.useState(0);

  // Force update function
  const forceUpdate = React.useCallback(() => {
    setForceUpdateCounter(prev => prev + 1);
  }, []);

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
    if (!fileName || typeof fileName !== 'string') return '';
    return fileName.split('.').pop()?.toLowerCase() || '';
  };

  // Helper function to determine if the selected file is supported
  const isSupportedFileType = (fileName: string): boolean => {
    if (!fileName || typeof fileName !== 'string') return true; // Consider missing filename as "supported" to let the API handle it
    const extension = getFileExtension(fileName);
    if (!extension) return true; // No extension means we can't check, so assume it's supported
    
    const supportedExtensions = ['pdf', 'docx', 'txt', 'doc', 'rtf', 'xlsx', 'pptx', 'csv', 'json', 'xml', 'html', 'md'];
    return supportedExtensions.includes(extension);
  };

  // Generate mock analysis if the API fails
  const generateFallbackAnalysis = (): AnalysisResult => {
    // Use document ID and file name if available, otherwise use placeholders
    const documentId = selectedDocumentId || "unknown";
    const fileName = selectedDocument?.fileName || "unknown.pdf";
    const fileExtension = getFileExtension(fileName) || "pdf";
    const currentTime = new Date().toISOString();
    
    return {
      documentId: documentId,
      fileName: fileName,
      summary: `This appears to be a ${fileExtension.toUpperCase()} document. Fallback analysis has been generated due to API service limitations.`,
      keyPoints: [
        "Document was processed in fallback mode",
        "Basic information has been extracted",
        "Limited analysis is available in this mode"
      ],
      recommendations: [
        "Try analyzing again later",
        "Check document format compatibility",
        "Ensure document has readable content"
      ],
      insights: {
        clarity: 50,
        relevance: 50,
        completeness: 50,
        conciseness: 50,
        overallScore: 50
      },
      topics: [
        { name: fileExtension.toUpperCase() + " Document", relevance: 1.0 },
        { name: "Document Analysis", relevance: 0.8 }
      ],
      entities: [
        { name: fileName, type: "Document", count: 1 }
      ],
      sentiment: {
        overall: "neutral",
        score: 0.5
      },
      languageQuality: {
        grammar: 75,
        spelling: 75,
        readability: 75,
        overall: 75
      },
      timeline: [
        { date: currentTime, event: "Fallback analysis generated" }
      ],
      createdAt: currentTime
    };
  };

  const analyzeDocument = async () => {
    if (!selectedDocumentId) {
      console.error("No document selected for analysis");
      setAnalysisError("Please select a document to analyze");
      return;
    }

    // Find the selected document object
    const selectedDocumentObj = documents.find(doc => doc.id === selectedDocumentId);
    
    // Log debug information about the selection
    console.log("Selected document for analysis:", {
      id: selectedDocumentId,
      document: selectedDocumentObj || "Not found in documents array",
      documentsLength: documents.length,
      availableDocumentIds: documents.map(d => d.id),
      availableFileNames: documents.map(d => d.fileName)
    });

    // Handle missing document information (shouldn't happen, but let's be safe)
    if (!selectedDocumentObj) {
      console.warn("Selected document not found in documents array - will continue with ID only");
    }

    // Get file name (if available)
    const fileName = selectedDocumentObj?.fileName;
    
    // Log file information
    console.log("Document file information:", {
      fileName: fileName || "Not available",
      hasFileName: !!fileName,
      fileNameType: fileName ? typeof fileName : "undefined",
      fileNameLength: fileName ? fileName.length : 0
    });

    // Check file type support, but only if we have a file name
    if (fileName && !isSupportedFileType(fileName)) {
      const extension = getFileExtension(fileName);
      console.error(`Unsupported file type detected: .${extension}`);
      setAnalysisError(`The file type ".${extension}" is not supported for analysis. Please select a document with a supported file type.`);
      return;
    }

    // Start analysis process
    setIsAnalyzing(true);
    setAnalysisResults(null);
    analysisResultsRef.current = null; // Clear the ref as well
    setAnalysisError(null);

    try {
      console.log("Starting document analysis process...");
      
      // Always use a properly formatted request object with all required fields
      const requestBody: {
        documentId: string;
        type: string;
        fileName?: string;
      } = {
        documentId: selectedDocumentId,
        type: analysisType,
      };

      // Always include fileName if it exists
      if (fileName) {
        requestBody.fileName = fileName;
      } else {
        console.warn("No fileName available for document ID:", selectedDocumentId, 
          "- backend will attempt to determine from database");
      }

      console.log("Sending analysis request:", JSON.stringify(requestBody));

      // Make the API request with timeout and retry handling
      const makeRequestWithRetry = async (retryCount = 0, maxRetries = 3) => {
        try {
          // Set up request with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // Increased timeout further

          console.log(`API request attempt ${retryCount + 1}/${maxRetries + 1}`);
          
          const response = await fetch("/api/document/analyze", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "X-Document-Id": selectedDocumentId, // Add ID in header too for redundancy
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          
          // Always log the raw response details
          console.log("Received response:", {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries([...response.headers.entries()])
          });

          // Handle error responses
          if (!response.ok) {
            let errorMessage;
            try {
              const errorText = await response.text();
              console.log("Error response text:", errorText);
              
              try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error || `Server returned ${response.status} ${response.statusText}`;
                console.error("API error response:", errorData);
              } catch (parseError) {
                // If we can't parse JSON, use the text directly
                errorMessage = errorText || `Server returned ${response.status} ${response.statusText}`;
                console.error("Raw error response:", errorText);
              }
            } catch (e) {
              errorMessage = `Server error: ${response.status} ${response.statusText}`;
              console.error("Failed to read error response:", e);
            }

            // Check if we should retry based on the status code
            const shouldRetry = response.status >= 500 && retryCount < maxRetries;
            
            if (shouldRetry) {
              const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
              console.log(`Will retry in ${backoffTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
              return makeRequestWithRetry(retryCount + 1, maxRetries);
            }
            
            throw new Error(errorMessage);
          }

          // Success - parse response
          console.log("Attempting to parse response...");
          
          try {
            // First read as text
            const text = await response.text();
            console.log("Response text received, length:", text.length);
            console.log("Response text sample:", text.substring(0, 200) + "...");
            
            if (text.trim() === '') {
              console.error("Empty response received from server");
              throw new Error("The server returned an empty response");
            }
            
            // Try to parse JSON from text
            try {
              const result = JSON.parse(text);
              console.log("Analysis results parsed successfully. Keys:", Object.keys(result));
              return result;
            } catch (parseError) {
              console.error("Failed to parse response as JSON:", parseError);
              
              // If the response looks like HTML, it might be an error page
              if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
                console.error("Received HTML instead of JSON");
                throw new Error("The server returned HTML instead of JSON. The API might be experiencing issues.");
              }
              
              throw new Error("Failed to parse analysis results from server");
            }
          } catch (error) {
            console.error("Error processing response:", error);
            throw error;
          }
        } catch (error) {
          // Handle AbortError (timeout)
          if (error instanceof Error && error.name === 'AbortError') {
            console.error("Request timeout occurred");
            
            if (retryCount < maxRetries) {
              console.log(`Retrying after timeout (attempt ${retryCount + 1})...`);
              return makeRequestWithRetry(retryCount + 1, maxRetries);
            }
            
            throw new Error("Analysis timed out after multiple attempts");
          }
          
          // Other errors - retry if we haven't reached max retries
          if (retryCount < maxRetries) {
            const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
            console.log(`Request error: ${error instanceof Error ? error.message : error}`);
            console.log(`Retrying in ${backoffTime}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            return makeRequestWithRetry(retryCount + 1, maxRetries);
          }
          
          throw error;
        }
      };

      // Execute request with retries
      const analysisResult = await makeRequestWithRetry();
      console.log("Document analysis completed successfully, result:", analysisResult);
      
      // Validate and process results
      if (!analysisResult || typeof analysisResult !== 'object') {
        console.error("Received invalid analysis result:", analysisResult);
        throw new Error("Invalid analysis result received from server");
      }
      
      // Log detailed structure of the result
      console.log("Analysis result structure:", {
        keys: Object.keys(analysisResult),
        docId: analysisResult.documentId,
        summaryLength: analysisResult.summary ? analysisResult.summary.length : 0,
        keyPointsCount: Array.isArray(analysisResult.keyPoints) ? analysisResult.keyPoints.length : 'not an array',
        hasInsights: !!analysisResult.insights,
        insights: analysisResult.insights,
        hasTopics: Array.isArray(analysisResult.topics) ? analysisResult.topics.length : 'not an array',
        hasSentiment: !!analysisResult.sentiment
      });
      
      // Store results in both state and ref for redundancy
      analysisResultsRef.current = analysisResult;
      
      // Update state immediately with the results
      setAnalysisResults(analysisResult);
      setActiveTab("summary");
      
      // Force a UI update after a short delay to ensure the results are displayed
      window.setTimeout(() => {
        console.log("Forcing UI update to ensure results display");
        // Double-check that results are still available
        if (analysisResultsRef.current && !analysisResults) {
          console.log("Recovering results from ref and updating state");
          setAnalysisResults({...analysisResultsRef.current});
        }
        forceUpdate();
      }, 50);
    } catch (error) {
      console.error("Document analysis failed:", error);
      
      // Set error message based on the type of error
      const errorMessage = error instanceof Error 
        ? error.message 
        : "An unknown error occurred during document analysis";
        
      setAnalysisError(errorMessage);
      
      // Generate fallback analysis as a last resort
      console.log("Generating fallback analysis due to API failure");
      const fallbackResult = generateFallbackAnalysis();
      console.log("Setting fallback results:", fallbackResult);
      analysisResultsRef.current = fallbackResult;
      setAnalysisResults(fallbackResult);
      forceUpdate(); // Force update to ensure fallback results display
    } finally {
      console.log("Analysis process complete, setting isAnalyzing to false");
      setIsAnalyzing(false);
    }
  };

  // Track results availability for debugging
  React.useEffect(() => {
    console.log("Results state changed:", 
      analysisResults ? `Results available (${typeof analysisResults})` : "No results in state", 
      "Force update counter:", forceUpdateCounter
    );
  }, [analysisResults, forceUpdateCounter]);

  // Add a backup effect to ensure results display
  React.useEffect(() => {
    if (!isAnalyzing && analysisResultsRef.current && !analysisResults) {
      console.log("Recovery effect: restoring results from ref");
      setAnalysisResults({...analysisResultsRef.current});
    }
  }, [isAnalyzing, analysisResults]);

  // Modified results section with debug info and double check
  const hasResults = analysisResults || analysisResultsRef.current;

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
          
          {/* Analysis results - modified to use both sources */}
          {hasResults && (
            <div className="mt-8 pt-6 border-t border-[#222222]">
              <h3 className="text-lg font-safiro text-[#F9F6EE] mb-4">
                Analysis Results
                <span className="ml-2 text-sm text-[#8A8782]">
                  {(analysisResults || analysisResultsRef.current)?.fileName 
                    ? `(${(analysisResults || analysisResultsRef.current)?.fileName})`
                    : ''
                  }
                </span>
              </h3>
              <AnalysisResultsContent 
                result={analysisResults || analysisResultsRef.current} 
                documentId={selectedDocumentId} 
              />
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

      {/* Add a debugging indicator for results - only visible during development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mt-2 opacity-50">
          Results state: {analysisResults ? 'Available in state' : 'Not in state'} | 
          Ref: {analysisResultsRef.current ? 'Available in ref' : 'Not in ref'} | 
          Counter: {forceUpdateCounter}
        </div>
      )}
    </div>
  );
} 