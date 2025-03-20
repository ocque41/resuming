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
  Info, Download, RefreshCw, ArrowRight, Loader2
} from 'lucide-react';
import AnalysisRecommendations from './AnalysisRecommendations';
import AnalysisKeyPoints from './AnalysisKeyPoints';
import AnalysisInsights from './AnalysisInsights';
import AnalysisResultsContent from './AnalysisResultsContent';
import { AnalysisResult } from './types';
import { Label } from '@/components/ui/label';
import dynamic from 'next/dynamic';

// Dynamically import debug components only in development mode
const DebugAnalysisButton = process.env.NODE_ENV === 'development'
  ? dynamic(() => import('./debug-tools/DebugAnalysisButton'))
  : () => null;

const DebugPanel = process.env.NODE_ENV === 'development'
  ? dynamic(() => import('./debug-tools/DebugPanel'))
  : () => null;

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

  // Add result caching mechanism
  const saveResultToCache = (documentId: string, result: AnalysisResult) => {
    try {
      const cacheKey = `analysis_result_${documentId}`;
      localStorage.setItem(cacheKey, JSON.stringify(result));
      console.log(`Saved analysis result to localStorage cache with key: ${cacheKey}`);
      return true;
    } catch (error) {
      console.error("Failed to cache analysis result:", error);
      return false;
    }
  };

  const getResultFromCache = (documentId: string): AnalysisResult | null => {
    try {
      const cacheKey = `analysis_result_${documentId}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) {
        console.log(`No cached result found for document ID: ${documentId}`);
        return null;
      }
      
      const result = JSON.parse(cachedData) as AnalysisResult;
      console.log(`Retrieved cached analysis result for document ID: ${documentId}`);
      return result;
    } catch (error) {
      console.error("Failed to retrieve cached analysis result:", error);
      return null;
    }
  };

  // Add a function to fetch document details before analysis
  const fetchDocumentDetails = async (documentId: string): Promise<any> => {
    console.log(`Fetching complete document details for ID: ${documentId}`);
    
    try {
      const response = await fetch(`/api/documents/${documentId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document details: ${response.status} ${response.statusText}`);
      }
      
      const document = await response.json();
      console.log(`Document details retrieved:`, {
        id: document.id,
        fileName: document.fileName || 'No fileName in response',
        createdAt: document.createdAt,
      });
      
      // Validate the required fields
      if (!document.id) {
        throw new Error(`Invalid document: Missing ID`);
      }
      
      return document;
    } catch (error) {
      console.error(`Error fetching document details:`, error);
      throw error;
    }
  };

  // Make a request with retry logic
  const makeRequestWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
    let retries = 0;
    let lastError: Error | null = null;
    
    console.log(`Making API request to ${url} with retry logic (max retries: ${maxRetries})`);
    
    while (retries < maxRetries) {
      try {
        // Set a timeout for the fetch operation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const fetchOptions = {
          ...options,
          signal: controller.signal
        };
        
        console.log(`API request attempt ${retries + 1}/${maxRetries}`, { 
          url, 
          method: options.method,
          hasBody: !!options.body
        });
        
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        
        console.log(`API response received:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries([...response.headers])
        });
        
        // For server errors, we retry
        if (response.status >= 500) {
          console.warn(`Server error (${response.status}), retrying...`);
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
          continue;
        }
        
        return response;
      } catch (error: any) {
        lastError = error as Error;
        console.error(`API request error (attempt ${retries + 1}/${maxRetries}):`, error);
        
        if (error.name === 'AbortError') {
          console.warn('Request timed out');
        }
        
        retries++;
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
        }
      }
    }
    
    throw lastError || new Error(`Failed after ${maxRetries} retries`);
  };

  // The main analyze document function
  // Now update the analyzeDocument function to ensure we have complete document information
  const analyzeDocument = async () => {
    if (!selectedDocumentId) {
      console.error("No document selected for analysis");
      setAnalysisError("Please select a document to analyze");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResults(null);
    analysisResultsRef.current = null;
    setAnalysisError(null);

    try {
      console.log("Starting document analysis process...");
      
      // First check cache for previous results
      const cachedResult = getResultFromCache(selectedDocumentId);
      if (cachedResult) {
        console.log("Using cached analysis results");
        analysisResultsRef.current = cachedResult;
        setAnalysisResults(cachedResult);
        setActiveTab("summary");
        forceUpdate();
        setIsAnalyzing(false);
        return;
      }
      
      // Get complete document details before proceeding
      let completeDocumentInfo;
      try {
        completeDocumentInfo = await fetchDocumentDetails(selectedDocumentId);
      } catch (detailsError) {
        console.error("Failed to get complete document details:", detailsError);
        // Continue with what we have, but log the issue
        completeDocumentInfo = null;
      }
      
      // Use either the complete info or the selected document from our local state
      const documentToAnalyze = completeDocumentInfo || documents.find(doc => doc.id === selectedDocumentId);
      
      if (!documentToAnalyze) {
        throw new Error(`Document with ID ${selectedDocumentId} not found`);
      }
      
      console.log("Document for analysis:", {
        id: documentToAnalyze.id || selectedDocumentId,
        fileName: documentToAnalyze.fileName || "Unknown",
        hasFileName: !!documentToAnalyze.fileName
      });
      
      // Always use a properly formatted request object with all required fields
      const requestBody: {
        documentId: string;
        type: string;
        fileName?: string;
      } = {
        documentId: selectedDocumentId,
        type: analysisType,
      };

      // Always include fileName if we have it
      if (documentToAnalyze.fileName) {
        requestBody.fileName = documentToAnalyze.fileName;
        console.log(`Including fileName '${documentToAnalyze.fileName}' in analysis request`);
      } else {
        console.warn("⚠️ No fileName available for document - backend will use generic name");
      }

      console.log("Sending analysis request:", JSON.stringify(requestBody));

      // Make the API request with timeout and retry handling
      const makeRequestWithRetry = async (retryCount = 0, maxRetries = 3) => {
        try {
          // Set up request with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          console.log(`API request attempt ${retryCount + 1}/${maxRetries + 1}`);
          
          const response = await fetch("/api/document/analyze", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "X-Document-Id": selectedDocumentId
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          
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
                errorMessage = errorText || `Server returned ${response.status} ${response.statusText}`;
                console.error("Raw error response:", errorText);
              }
            } catch (e) {
              errorMessage = `Server error: ${response.status} ${response.statusText}`;
              console.error("Failed to read error response:", e);
            }

            // Check if we should retry
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
          
          // First read as text
          const text = await response.text();
          console.log("Response text received, length:", text.length);
          
          if (!text || text.trim() === '') {
            console.error("Empty response received from server");
            throw new Error("The server returned an empty response");
          }
          
          // Try to parse JSON from text
          try {
            const result = JSON.parse(text);
            console.log("Analysis results parsed successfully:", {
              keys: Object.keys(result),
              documentId: result.documentId,
              fileName: result.fileName
            });
            return result;
          } catch (parseError) {
            console.error("Failed to parse response as JSON:", parseError);
            throw new Error("Failed to parse analysis results");
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

      try {
        // Execute request with retries
        const analysisResult = await makeRequestWithRetry();
        
        // Success path - more direct state updates
        console.log("Analysis successful, updating state with result");
        
        // Save to localStorage cache
        saveResultToCache(selectedDocumentId, analysisResult);
        
        // Use a single, direct state update
        analysisResultsRef.current = analysisResult;
        
        // Announce success to the DOM 
        document.dispatchEvent(new CustomEvent('document-analysis-complete', {
          detail: { documentId: selectedDocumentId, success: true }
        }));
        
        // Update React state directly
        setAnalysisResults(analysisResult);
        setActiveTab("summary");
        
        // Force a render update
        forceUpdate();
        
        console.log("Analysis state updated successfully");
        return analysisResult;
      } catch (error) {
        console.error("Analysis failed:", error);
        
        setAnalysisError(error instanceof Error ? error.message : "Unknown analysis error");
        
        // Generate fallback for display
        const fallback = generateFallbackAnalysis();
        analysisResultsRef.current = fallback;
        setAnalysisResults(fallback);
        
        // Force a render update
        forceUpdate();
        
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    } catch (outerError) {
      console.error("Outer analysis error:", outerError);
      setAnalysisError(outerError instanceof Error ? outerError.message : "Analysis failed");
      setIsAnalyzing(false);
      return null;
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

  // Add effect to handle the DOM event approach
  React.useEffect(() => {
    // Handler for the custom event
    const handleAnalysisCompleted = (event: CustomEvent) => {
      const { documentId, success } = event.detail;
      console.log(`Analysis completion event received for document ${documentId}, success: ${success}`);
      
      // If the event is for the currently selected document, ensure we show results
      if (documentId === selectedDocumentId && success) {
        const cachedResult = getResultFromCache(documentId);
        if (cachedResult && !analysisResults) {
          console.log("Applying cached results from event handler");
          setAnalysisResults(cachedResult);
          forceUpdate();
        }
      }
    };

    // Add event listener
    window.addEventListener('analysis-result-received', handleAnalysisCompleted as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('analysis-result-received', handleAnalysisCompleted as EventListener);
    };
  }, [selectedDocumentId, analysisResults]);

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
            {/* Document selection and analysis type */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Select Document</Label>
                <Select
                  value={selectedDocumentId}
                  onValueChange={handleDocumentChange}
                >
                  <SelectTrigger className="bg-[#161616] border-[#222222]">
                    <SelectValue placeholder="Choose a document" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161616] border-[#222222]">
                    {documents.length > 0 ? (
                      documents.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.fileName || `Document ${doc.id}`}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No documents available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Analysis Type</Label>
                <Select
                  value={analysisType}
                  onValueChange={handleAnalysisTypeChange}
                >
                  <SelectTrigger className="bg-[#161616] border-[#222222]">
                    <SelectValue placeholder="Select analysis type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161616] border-[#222222]">
                    <SelectItem value="general">General Analysis</SelectItem>
                    <SelectItem value="resume">Resume Analysis</SelectItem>
                    <SelectItem value="cover-letter">Cover Letter Analysis</SelectItem>
                    <SelectItem value="professional">Professional Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected document display */}
            {selectedDocument && (
              <div className="flex items-center p-4 rounded-lg bg-[#0A0A0A] border border-[#222222]">
                <div className="mr-3 bg-[#161616] p-2 rounded-lg border border-[#222222]">
                  {getFileIcon(selectedDocument.fileName)}
                </div>
                <div>
                  <h3 className="text-[#F9F6EE] font-medium">
                    {selectedDocument.fileName || `Document ID: ${selectedDocument.id}`}
                  </h3>
                  <p className="text-[#8A8782] text-sm">
                    Uploaded on {new Date(selectedDocument.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Analysis button */}
            <div className="flex justify-center mt-2">
              <Button
                onClick={analyzeDocument}
                disabled={isAnalyzing || !selectedDocumentId}
                className="bg-[#B4916C] hover:bg-[#A3815C] text-white px-6 py-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <BarChart2 className="mr-2 h-4 w-4" />
                    Analyze Document
                  </>
                )}
              </Button>
              
              {/* Debug helper button from our component */}
              {process.env.NODE_ENV === 'development' && (
                <DebugAnalysisButton
                  documentId={selectedDocumentId}
                  fileName={selectedDocument?.fileName}
                  analysisType={analysisType}
                  onAnalysisStart={() => setIsAnalyzing(true)}
                  onAnalysisComplete={(result) => {
                    analysisResultsRef.current = result;
                    setAnalysisResults(result);
                    setActiveTab("summary");
                    forceUpdate();
                  }}
                  onAnalysisError={(errorMsg) => setAnalysisError(errorMsg)}
                  onAnalysisEnd={() => setIsAnalyzing(false)}
                  fallbackGenerator={generateFallbackAnalysis}
                />
              )}
            </div>

            {/* Error message */}
            {analysisError && (
              <div className="bg-[#3A1F24] border border-[#E57373]/30 p-4 rounded-lg text-[#F9F6EE]">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-[#E57373] mr-2" />
                  <p>{analysisError}</p>
                </div>
              </div>
            )}
            
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
          </div>
        </CardContent>
      </Card>

      {/* Replace the debug panel with our component */}
      {process.env.NODE_ENV === 'development' && (
        <DebugPanel
          analysisResults={analysisResults}
          analysisResultsRef={analysisResultsRef}
          selectedDocumentId={selectedDocumentId}
          analysisType={analysisType}
          isAnalyzing={isAnalyzing}
          forceUpdateCounter={forceUpdateCounter}
          onLogState={() => {
            console.log("Current state:", {
              selectedDocumentId,
              hasResults: !!(analysisResultsRef.current || analysisResults),
              analysisResults: analysisResults ? 'Has Results' : 'No Results',
              ref: analysisResultsRef.current ? 'Has Ref' : 'No Ref',
              isAnalyzing,
              forceUpdateCounter
            });
          }}
        />
      )}
    </div>
  );
} 