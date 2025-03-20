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
  Info, Download, RefreshCw, ArrowRight, Loader2, Briefcase, Star,
  User, File, Bookmark
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

// Add the cvAnalysis property to the existing AnalysisResult interface
declare module './types' {
  interface AnalysisResult {
    cvAnalysis?: {
      skills?: {
        technical?: Array<{name: string; proficiency: string; relevance: number}>;
        soft?: Array<{name: string; evidence: string; strength: number}>;
        domain?: Array<{name: string; relevance: number}>;
      };
      experience?: {
        yearsOfExperience?: number;
        experienceProgression?: string;
        keyRoles?: string[];
        achievementsHighlighted?: boolean;
        clarity?: number;
      };
      education?: {
        highestDegree?: string;
        relevance?: number;
        continuingEducation?: boolean;
      };
      atsCompatibility?: {
        score?: number;
        keywordOptimization?: number;
        formatCompatibility?: number;
        improvementAreas?: string[];
      };
      strengths?: string[];
      weaknesses?: string[];
    };
  }
}

// Define or update the AnalysisResultsContentProps interface
interface AnalysisResultsContentProps {
  result: AnalysisResult | null;
  documentId: string | number;
  tab?: string; // Make tab optional
}

export default function DocumentAnalyzer({ documents, preSelectedDocumentId }: DocumentAnalyzerProps) {
  // Check for debug mode from URL
  const [isDebugMode, setIsDebugMode] = React.useState<boolean>(false);
  
  // Effect to check for debug parameter in URL
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const debugMode = urlParams.get('debug') === 'analyzer';
      setIsDebugMode(debugMode);
      
      if (debugMode) {
        console.log("🔍 Analyzer debug mode activated via URL parameter");
      }
    }
  }, []);
  
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
      // Use our dedicated API for CV analysis
      const response = await fetch(`/api/cv-analyzer/get-cv-for-analysis?cvId=${documentId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document details: ${response.status} ${response.statusText}`);
      }
      
      // First read the response as text for debugging
      const responseText = await response.text();
      console.log(`Document details retrieved (raw):`, responseText);
      
      // Try to parse the JSON
      let document;
      try {
        document = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse document details response:", parseError);
        throw new Error("Invalid response format from document details API");
      }
      
      console.log(`Document details parsed successfully:`, {
        id: document.id,
        fileName: document.fileName || 'No fileName in response',
        filePath: document.filePath || document.filepath || 'No filePath in response',
        createdAt: document.createdAt,
        hasRawText: !!document.rawText,
        hasMetadata: !!document.metadata
      });
      
      // Validate the required fields
      if (!document.id) {
        throw new Error(`Invalid document: Missing ID`);
      }
      
      if (!document.fileName) {
        console.warn(`⚠️ Document ${document.id} has no fileName property`);
      }
      
      return document;
    } catch (error) {
      console.error(`Error fetching document details:`, error);
      throw error;
    }
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
      
      // Step 1: Get complete document details before proceeding
      console.log("Step 1: Retrieving document details");
      let completeDocumentInfo;
      try {
        completeDocumentInfo = await fetchDocumentDetails(selectedDocumentId);
        console.log("Document details retrieved successfully");
      } catch (detailsError) {
        console.error("Step 1 Failed - Could not get document details:", detailsError);
        // We'll continue with what we have from the document list, but log the issue
        completeDocumentInfo = null;
      }
      
      // Step 2: Prepare document information for analysis
      console.log("Step 2: Preparing document information");
      // Use either the complete info or the selected document from our local state
      const documentToAnalyze = completeDocumentInfo || documents.find(doc => doc.id === selectedDocumentId);
      
      if (!documentToAnalyze) {
        console.error("Step 2 Failed - Document not found in any source");
        throw new Error(`Document with ID ${selectedDocumentId} not found`);
      }
      
      // Log what we're using
      console.log("Using document for analysis:", {
        id: documentToAnalyze.id || selectedDocumentId,
        fileName: documentToAnalyze.fileName || "Unknown",
        source: completeDocumentInfo ? "API fetch" : "Local documents list",
        hasFileName: !!documentToAnalyze.fileName
      });
      
      // Step 3: Build the request body
      console.log("Step 3: Building request body");
      // Always use a properly formatted request object with all required fields
      const requestBody: {
        documentId: string;
        type: string;
        fileName?: string;
      } = {
        documentId: selectedDocumentId,
        type: analysisType,
      };

      // Always include fileName if we have it (absolutely critical for the analysis)
      if (documentToAnalyze.fileName) {
        requestBody.fileName = documentToAnalyze.fileName;
        console.log(`✅ Including fileName '${documentToAnalyze.fileName}' in analysis request`);
      } else {
        console.warn("⚠️ No fileName available for document - backend will use generic name");
        
        // Last attempt - try to create a generic filename based on the document ID
        requestBody.fileName = `document-${selectedDocumentId}.pdf`;
        console.log(`Using fallback fileName: ${requestBody.fileName}`);
      }

      console.log("Final request body:", JSON.stringify(requestBody));

      // Step 4: Make the API call
      console.log("Step 4: Sending analysis request to API");
      const makeRequestWithRetry = async (retryCount = 0, maxRetries = 3) => {
        try {
          // Set up request with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout for analysis

          console.log(`API request attempt ${retryCount + 1}/${maxRetries + 1}`);
          
          const response = await fetch("/api/document/analyze", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "X-Document-Id": selectedDocumentId,
              "X-Analysis-Type": analysisType
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
            console.error("Response text:", text);
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
        // Step 5: Execute request with retries
        console.log("Step 5: Executing API request with retry logic");
        const analysisResult = await makeRequestWithRetry();
        
        // Step 6: Process successful results
        console.log("Step 6: Processing successful analysis result");
        
        // Save to localStorage cache
        saveResultToCache(selectedDocumentId, analysisResult);
        
        // Use the ref for immediate availability
        analysisResultsRef.current = analysisResult;
        
        // Announce success to the DOM 
        const customEvent = new CustomEvent('document-analysis-complete', {
          detail: { documentId: selectedDocumentId, success: true }
        });
        document.dispatchEvent(customEvent);
        window.dispatchEvent(new Event('analysis-result-received'));
        
        console.log("Analysis complete event dispatched to DOM");
        
        // Update React state directly
        setAnalysisResults(analysisResult);
        setActiveTab("summary");
        
        // Force a render update
        forceUpdate();
        
        console.log("Analysis state updated successfully");
        return analysisResult;
      } catch (error) {
        // Step 6 (alternative): Handle analysis failure
        console.error("Analysis failed:", error);
        
        setAnalysisError(error instanceof Error ? error.message : "Unknown analysis error");
        
        // Generate fallback for display
        console.log("Generating fallback analysis result");
        const fallback = generateFallbackAnalysis();
        analysisResultsRef.current = fallback;
        setAnalysisResults(fallback);
        setActiveTab("summary");
        
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

  // Add a function to determine if the analysis is for a CV
  const isCV = React.useMemo(() => {
    return analysisResults?.analysisType === 'cv' || 
           analysisResultsRef.current?.analysisType === 'cv';
  }, [analysisResults, analysisResultsRef.current]);

  // Add a new renderer specifically for CV analysis
  const renderCVAnalysis = () => {
    const results = analysisResults || analysisResultsRef.current;
    if (!results || !results.cvAnalysis) {
      return (
        <div className="p-6 text-center">
          <p className="text-[#8A8782]">No CV-specific analysis available for this document.</p>
        </div>
      );
    }

    const { skills, experience, education, atsCompatibility, strengths, weaknesses } = results.cvAnalysis;

    return (
      <div className="space-y-8">
        {/* ATS Compatibility Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
            <h3 className="font-safiro text-[#F9F6EE] mb-4 flex items-center">
              <User className="w-5 h-5 text-[#B4916C] mr-2" /> 
              ATS Compatibility Score
            </h3>
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8A8782] text-sm">Overall Score</span>
                  <span className="text-[#F9F6EE] text-sm">{atsCompatibility?.score || 0}/100</span>
                </div>
                <Progress value={atsCompatibility?.score || 0} max={100} className="h-2 bg-[#222222]" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8A8782] text-sm">Keyword Optimization</span>
                  <span className="text-[#F9F6EE] text-sm">{atsCompatibility?.keywordOptimization || 0}/100</span>
                </div>
                <Progress value={atsCompatibility?.keywordOptimization || 0} max={100} className="h-2 bg-[#222222]" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8A8782] text-sm">Format Compatibility</span>
                  <span className="text-[#F9F6EE] text-sm">{atsCompatibility?.formatCompatibility || 0}/100</span>
                </div>
                <Progress value={atsCompatibility?.formatCompatibility || 0} max={100} className="h-2 bg-[#222222]" />
              </div>
            </div>
            <div>
              <h4 className="text-[#C5C2BA] font-semibold mb-2 text-sm">Improvement Areas</h4>
              <ul className="space-y-1.5">
                {atsCompatibility?.improvementAreas?.map((area: string, index: number) => (
                  <li key={`area-${index}`} className="text-[#8A8782] text-sm flex items-start">
                    <ArrowRight className="w-3.5 h-3.5 text-[#B4916C] mt-0.5 mr-2 shrink-0" />
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Skills Section */}
          <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
            <h3 className="font-safiro text-[#F9F6EE] mb-4 flex items-center">
              <Star className="w-5 h-5 text-[#B4916C] mr-2" /> 
              Skills Assessment
            </h3>
            <div className="space-y-6">
              <div>
                <h4 className="text-[#C5C2BA] font-semibold mb-3 text-sm">Technical Skills</h4>
                <ul className="space-y-2">
                  {skills?.technical?.map((skill: {name: string; proficiency: string; relevance: number}, index: number) => (
                    <li key={`tech-${index}`} className="flex justify-between items-center">
                      <span className="text-[#8A8782] text-sm">{skill.name}</span>
                      <span className="text-[#F9F6EE] text-xs px-2 py-1 bg-[#1A1A1A] rounded-full border border-[#333333]">
                        {skill.proficiency}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[#C5C2BA] font-semibold mb-3 text-sm">Soft Skills</h4>
                <ul className="space-y-2">
                  {skills?.soft?.map((skill: {name: string; evidence: string; strength: number}, index: number) => (
                    <li key={`soft-${index}`} className="flex justify-between items-center">
                      <span className="text-[#8A8782] text-sm">{skill.name}</span>
                      <span className="text-[#F9F6EE] text-xs px-2 py-1 bg-[#1A1A1A] rounded-full border border-[#333333]">
                        {skill.strength}/10
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[#C5C2BA] font-semibold mb-3 text-sm">Domain Skills</h4>
                <ul className="space-y-2">
                  {skills?.domain?.map((skill: {name: string; relevance: number}, index: number) => (
                    <li key={`domain-${index}`} className="flex justify-between items-center">
                      <span className="text-[#8A8782] text-sm">{skill.name}</span>
                      <span className="text-[#F9F6EE] text-xs px-2 py-1 bg-[#1A1A1A] rounded-full border border-[#333333]">
                        Relevance: {skill.relevance}/10
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Experience Section */}
        <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
          <h3 className="font-safiro text-[#F9F6EE] mb-4 flex items-center">
            <Briefcase className="w-5 h-5 text-[#B4916C] mr-2" /> 
            Experience Assessment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <span className="text-[#8A8782] text-sm block mb-1">Years of Experience</span>
                <p className="text-[#F9F6EE] text-lg font-medium">{experience?.yearsOfExperience || 'Not specified'}</p>
              </div>
              <div>
                <span className="text-[#8A8782] text-sm block mb-1">Progression</span>
                <p className="text-[#F9F6EE] text-sm">{experience?.experienceProgression || 'Not specified'}</p>
              </div>
              <div>
                <span className="text-[#8A8782] text-sm block mb-1">Achievement Clarity</span>
                <p className="text-[#F9F6EE] text-sm">{experience?.clarity ? `${experience.clarity}/10` : 'Not specified'}</p>
              </div>
            </div>
            <div>
              <div>
                <span className="text-[#8A8782] text-sm block mb-1">Key Roles</span>
                <div className="flex flex-wrap gap-2">
                  {experience?.keyRoles?.map((role: string, index: number) => (
                    <span key={`role-${index}`} className="text-[#F9F6EE] text-xs px-2 py-1 bg-[#1A1A1A] rounded-full border border-[#333333]">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Education Section */}
        <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
          <h3 className="font-safiro text-[#F9F6EE] mb-4 flex items-center">
            <Bookmark className="w-5 h-5 text-[#B4916C] mr-2" /> 
            Education Assessment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <span className="text-[#8A8782] text-sm block mb-1">Highest Degree</span>
                <p className="text-[#F9F6EE] text-lg font-medium">{education?.highestDegree || 'Not specified'}</p>
              </div>
              <div>
                <span className="text-[#8A8782] text-sm block mb-1">Relevance to Career</span>
                <p className="text-[#F9F6EE] text-sm">{education?.relevance ? `${education.relevance}/10` : 'Not specified'}</p>
              </div>
            </div>
            <div>
              <div>
                <span className="text-[#8A8782] text-sm block mb-1">Continuing Education</span>
                <p className="text-[#F9F6EE] text-sm">{education?.continuingEducation ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Strengths & Weaknesses Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
            <h3 className="font-safiro text-[#F9F6EE] mb-4 flex items-center">
              <Check className="w-5 h-5 text-[#4CAF50] mr-2" /> 
              Strengths
            </h3>
            <div className="space-y-2">
              <h4 className="text-[#C5C2BA] font-semibold mb-3 text-sm">Key Strengths</h4>
              <ul className="space-y-1.5">
                {strengths?.map((strength: string, index: number) => (
                  <li key={`strength-${index}`} className="text-[#8A8782] text-sm flex items-start">
                    <Check className="w-3.5 h-3.5 text-[#4CAF50] mt-0.5 mr-2 shrink-0" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
            <h3 className="font-safiro text-[#F9F6EE] mb-4 flex items-center">
              <ArrowRight className="w-5 h-5 text-[#B4916C] mr-2" /> 
              Areas for Improvement
            </h3>
            <div className="space-y-2">
              <h4 className="text-[#C5C2BA] font-semibold mb-3 text-sm">Areas for Improvement</h4>
              <ul className="space-y-1.5">
                {weaknesses?.map((weakness: string, index: number) => (
                  <li key={`weakness-${index}`} className="text-[#8A8782] text-sm flex items-start">
                    <ArrowRight className="w-3.5 h-3.5 text-[#B4916C] mt-0.5 mr-2 shrink-0" />
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
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

            {/* Analysis progress indicator */}
            {isAnalyzing && (
              <div className="mt-6 p-4 bg-[#1A1A1A] border border-[#333333] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#F9F6EE] font-medium flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin text-[#B4916C]" />
                    Analysis in Progress
                  </h3>
                </div>
                <Progress 
                  value={70} 
                  className="h-2 bg-[#333333] [&>div]:bg-[#B4916C]" 
                />
                <p className="mt-2 text-sm text-[#8A8782]">
                  Analyzing document content and generating insights. This may take a moment...
                </p>
              </div>
            )}

            {/* Error message */}
            {analysisError && (
              <div className="bg-[#3A1F24] border border-[#E57373]/30 p-4 rounded-lg text-[#F9F6EE]">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-[#E57373] mr-2" />
                  <p>{analysisError}</p>
                </div>
              </div>
            )}

            {/* Debug info panel - shows when debug mode is activated */}
            {(isDebugMode || process.env.NODE_ENV === 'development') && (
              <div className="mt-4 p-3 bg-[#0A0A0A] border border-purple-800/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-purple-400">Analyzer Debug Info</h4>
                  <span className="text-xs text-purple-500">{isDebugMode ? 'URL Debug Mode' : 'Dev Mode'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-[#8A8782]">
                  <div>Document ID: <span className="text-white">{selectedDocumentId || 'None'}</span></div>
                  <div>File Name: <span className="text-white">{selectedDocument?.fileName || 'Unknown'}</span></div>
                  <div>Analysis Type: <span className="text-white">{analysisType}</span></div>
                  <div>Analyzing: <span className="text-white">{isAnalyzing ? 'Yes' : 'No'}</span></div>
                  <div>Has Results: <span className="text-white">{analysisResults ? 'Yes' : 'No'}</span></div>
                  <div>Has Results (ref): <span className="text-white">{analysisResultsRef.current ? 'Yes' : 'No'}</span></div>
                  <div>Force Counter: <span className="text-white">{forceUpdateCounter}</span></div>
                  <div>Active Tab: <span className="text-white">{activeTab}</span></div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button 
                    className="text-xs px-2 py-1 bg-purple-900/50 text-purple-300 rounded hover:bg-purple-800/50 transition-colors"
                    onClick={() => {
                      console.log('Debug - Analysis State:', {
                        documentId: selectedDocumentId,
                        document: selectedDocument,
                        results: analysisResults,
                        resultsRef: analysisResultsRef.current,
                        error: analysisError,
                        isAnalyzing,
                        forceCounter: forceUpdateCounter
                      });
                    }}
                  >
                    Log State
                  </button>
                  <button 
                    className="text-xs px-2 py-1 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-800/50 transition-colors"
                    onClick={forceUpdate}
                  >
                    Force Update
                  </button>
                  {analysisResults && (
                    <button 
                      className="text-xs px-2 py-1 bg-green-900/50 text-green-300 rounded hover:bg-green-800/50 transition-colors"
                      onClick={() => {
                        // Force display of analysis results
                        setActiveTab('summary');
                        forceUpdate();
                      }}
                    >
                      Show Results
                    </button>
                  )}
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
                <Tabs 
                  value={activeTab} 
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-4 md:grid-cols-5 mb-6">
                    <TabsTrigger value="summary" className="font-borna">
                      Summary
                    </TabsTrigger>
                    <TabsTrigger value="content" className="font-borna">
                      Content
                    </TabsTrigger>
                    <TabsTrigger value="sentiment" className="font-borna">
                      Sentiment
                    </TabsTrigger>
                    <TabsTrigger value="keyinfo" className="font-borna">
                      Key Information
                    </TabsTrigger>
                    {isCV && (
                      <TabsTrigger value="cv" className="font-borna">
                        CV Analysis
                      </TabsTrigger>
                    )}
                  </TabsList>
                  
                  <TabsContent value="summary" className="py-2">
                    <AnalysisResultsContent 
                      result={analysisResults || analysisResultsRef.current} 
                      documentId={selectedDocumentId}
                    />
                  </TabsContent>
                  
                  <TabsContent value="content" className="py-2">
                    <AnalysisResultsContent 
                      result={analysisResults || analysisResultsRef.current} 
                      documentId={selectedDocumentId}
                    />
                  </TabsContent>
                  
                  <TabsContent value="sentiment" className="py-2">
                    <AnalysisResultsContent 
                      result={analysisResults || analysisResultsRef.current} 
                      documentId={selectedDocumentId}
                    />
                  </TabsContent>
                  
                  <TabsContent value="keyinfo" className="py-2">
                    <AnalysisResultsContent 
                      result={analysisResults || analysisResultsRef.current} 
                      documentId={selectedDocumentId}
                    />
                  </TabsContent>
                  
                  {isCV && (
                    <TabsContent value="cv" className="py-2">
                      {renderCVAnalysis()}
                    </TabsContent>
                  )}
                </Tabs>
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