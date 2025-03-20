"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';
import DocumentAnalyzer from '@/components/advanced-document-analyzer/DocumentAnalyzer.client';
import AnalysisResultsContent from '@/components/advanced-document-analyzer/AnalysisResultsContent';
import { AnalysisResult } from '@/components/advanced-document-analyzer/types';

// Dynamically import debug components
const DirectAPITester = dynamic(() => 
  import('@/components/advanced-document-analyzer/debug-tools/DirectAPITester'), 
  { ssr: false }
);

export default function DebugAnalyzerPage() {
  const [activeTab, setActiveTab] = useState('analyzer');
  const [documents, setDocuments] = useState([
    { id: 'debug-doc-1', fileName: 'sample-document.pdf', createdAt: new Date().toISOString() },
    { id: 'debug-doc-2', fileName: 'resume-sample.docx', createdAt: new Date().toISOString() }
  ]);
  const [directAPIResult, setDirectAPIResult] = useState<AnalysisResult | null>(null);

  // Create a sample static result for testing the renderer
  const sampleStaticResult: AnalysisResult = {
    documentId: "debug-doc-static",
    fileName: "static-test-document.pdf",
    analysisType: "general",
    summary: "This is a static test document used to validate the AnalysisResultsContent component. It contains various sections demonstrating different aspects of document analysis.",
    keyPoints: [
      "The document is structured for testing purposes",
      "All major sections appear to be properly formatted",
      "The content demonstrates various analysis features",
      "This static example helps validate the UI rendering"
    ],
    recommendations: [
      "Add more detailed examples of specific document sections",
      "Include graphics or charts to enhance visual representation",
      "Consider expanding the analysis metrics section",
      "Provide more context about document purpose"
    ],
    insights: {
      clarity: 0.82,
      relevance: 0.75,
      completeness: 0.68,
      conciseness: 0.91,
      structure: 0.77,
      engagement: 0.64,
      contentquality: 0.80,
      overallScore: 0.79
    },
    topics: [
      { name: "Document Analysis", relevance: 0.95 },
      { name: "Testing", relevance: 0.88 },
      { name: "UI Components", relevance: 0.75 },
      { name: "Validation", relevance: 0.83 },
      { name: "Sample Data", relevance: 0.69 }
    ],
    sentiment: {
      overall: "positive",
      score: 0.71
    },
    languageQuality: {
      grammar: 0.88,
      spelling: 0.92,
      readability: 0.85,
      clarity: 0.79,
      overall: 0.86
    },
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  // In development mode only!
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Debug Mode Not Available</CardTitle>
            <CardDescription>This page is only available in development mode.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Function to validate if we have a proper result to display
  const isValidResult = (result: AnalysisResult | null): boolean => {
    if (!result) return false;
    // Check for essential properties
    return Boolean(
      result.summary && 
      (Array.isArray(result.keyPoints) || Array.isArray(result.recommendations))
    );
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Document Analyzer Debug</CardTitle>
          <CardDescription>Debug tools and test environment for document analysis functionality</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="analyzer">Analyzer Component</TabsTrigger>
          <TabsTrigger value="api">Direct API Tests</TabsTrigger>
          <TabsTrigger value="results">Results Renderer</TabsTrigger>
        </TabsList>

        <TabsContent value="analyzer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Analyzer Component</CardTitle>
              <CardDescription>Test the full analyzer component with mock data</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentAnalyzer documents={documents} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Direct API Testing</CardTitle>
              <CardDescription>Test the document analysis API directly</CardDescription>
            </CardHeader>
            <CardContent>
              <DirectAPITester onResult={setDirectAPIResult} />
              
              {directAPIResult && isValidResult(directAPIResult) && (
                <div className="mt-8 pt-6 border-t border-gray-800">
                  <h3 className="text-lg font-medium mb-4 text-gray-300">API Result Preview</h3>
                  <AnalysisResultsContent 
                    result={directAPIResult} 
                    documentId={directAPIResult.documentId ? String(directAPIResult.documentId) : 'debug-doc'} 
                  />
                </div>
              )}
              
              {directAPIResult && !isValidResult(directAPIResult) && (
                <div className="mt-8 pt-6 border-t border-gray-800">
                  <h3 className="text-lg font-medium mb-4 text-red-400">Invalid API Result</h3>
                  <pre className="bg-gray-900 p-4 rounded text-xs text-gray-300 max-h-60 overflow-auto">
                    {JSON.stringify(directAPIResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Results Renderer</CardTitle>
              <CardDescription>Test the AnalysisResultsContent component with static data</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalysisResultsContent 
                result={sampleStaticResult} 
                documentId="debug-doc-static" 
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 