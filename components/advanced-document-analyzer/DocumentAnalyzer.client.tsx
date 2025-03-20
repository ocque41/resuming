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
    if (!selectedDocumentId) {
      setAnalysisError("Please select a document to analyze");
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResults(null);
    
    try {
      console.log(`Starting document analysis for documentId=${selectedDocumentId}, type=${analysisType}`);
      
      // First try with GET endpoint
      const url = `/api/document/analyze?documentId=${selectedDocumentId}&type=${analysisType}`;
      console.log(`Sending request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Analysis response status: ${response.status}`);
      
      // Make sure we got JSON back
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Non-JSON response received:', contentType);
        throw new Error(`Unexpected response format: ${contentType || 'unknown'}`);
      }
      
      // Handle error responses
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        
        // If GET fails with 404/400, try POST as fallback
        if (response.status === 404 || response.status === 400) {
          console.log('GET request failed, trying POST as fallback...');
          return await analyzeDocumentWithPost();
        }
        
        throw new Error(errorData.error || `Failed to analyze document: ${response.status} ${response.statusText}`);
      }
      
      // Process the successful response
      const data = await response.json();
      console.log('Analysis completed successfully, results:', data);
      
      // Check if we got data directly or if it's wrapped in an 'analysis' field
      const analysisData = data.analysis || data;
      
      // Validate that the response contains the expected fields
      if (!analysisData.summary && (!analysisData.keyPoints || !analysisData.recommendations)) {
        console.warn('Response may not contain all expected analysis fields:', analysisData);
        // Continue anyway since we have some data
      }
      
      // Update the state with the results
      setAnalysisResults(analysisData);
      
      // Show a success message (optional)
      console.log('Document analysis completed successfully');
      
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError(`An error occurred while analyzing the document: ${error instanceof Error ? error.message : String(error)}. Please try again.`);
      setAnalysisResults(null);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Fallback to POST method if GET fails
  const analyzeDocumentWithPost = async () => {
    try {
      console.log(`Trying POST method for document analysis...`);
      
      const response = await fetch('/api/document/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          documentId: selectedDocumentId,
          type: analysisType
        }),
      });
      
      console.log(`POST analysis response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('POST Error response:', errorData);
        throw new Error(errorData.error || `Failed to analyze document using POST: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('POST analysis completed successfully, results:', data);
      
      // Check if we got data directly or if it's wrapped in an 'analysis' field
      const analysisData = data.analysis || data;
      
      // Validate the minimum required fields
      if (!analysisData) {
        console.error('Invalid analysis result format (empty):', data);
        throw new Error('The analysis result format is invalid or empty.');
      }
      
      // Update the state with the results
      setAnalysisResults(analysisData);
      
      console.log('Document analysis completed successfully using POST method');
      
    } catch (error) {
      console.error('POST analysis error:', error);
      throw error; // Let the parent function handle this error
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
          <CardTitle className="text-lg font-medium text-[#F9F6EE]">
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
                    Analyzing Document...
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
          
          {/* Loading state for analysis */}
          {isAnalyzing && (
            <div className="mt-6 p-5 border border-[#222222] rounded-lg bg-[#080808] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[#F9F6EE] font-medium flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin text-[#B4916C]" />
                  Analyzing your document
                </h3>
                <span className="text-[#8A8782] text-sm">This may take a moment</span>
              </div>
              
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-[#161616] rounded-full overflow-hidden">
                  <div className="h-full bg-[#B4916C] rounded-full animate-pulse" style={{ width: '75%' }}></div>
                </div>
                <div className="flex justify-between text-xs text-[#8A8782]">
                  <span>Processing document</span>
                  <span>Extracting insights</span>
                  <span>Finalizing results</span>
                </div>
              </div>
              
              <p className="text-[#8A8782] text-sm italic">
                Our AI is analyzing your document to extract key insights, topics, and recommendations.
              </p>
            </div>
          )}
          
          {/* Analysis results */}
          {analysisResults && (
            <div className="mt-8 pt-6 border-t border-[#222222]">
              <h3 className="text-lg font-safiro text-[#F9F6EE] mb-4">Analysis Results</h3>
              
              <AnalysisResultsContent 
                result={analysisResults} 
                documentId={selectedDocumentId}
              />
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