/* use client */
'use client';

import React, { useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { analyzeCVContent, optimizeCVForJob } from '@/lib/services/mistral.service';

interface EnhancedSpecificOptimizationWorkflowProps {
  cvs: {
    id: string;
    name: string;
  }[];
}

export default function EnhancedSpecificOptimizationWorkflow({ cvs }: EnhancedSpecificOptimizationWorkflowProps): JSX.Element {
  // State for CV selection
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [optimizedText, setOptimizedText] = useState<string>('');

  // Handle CV selection
  const handleSelectCV = useCallback((cvId: string, cvName: string) => {
    setSelectedCVId(cvId);
    setSelectedCVName(cvName);
  }, []);

  // Process CV optimization
  const processCV = useCallback(async () => {
    if (!selectedCVId || !jobDescription.trim()) {
      setError('Please select a CV and provide a job description');
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);
      setProcessingProgress(0);
      setProcessingStatus('Analyzing CV...');

      // Get CV text
      const response = await fetch(`/api/cv/text?cvId=${selectedCVId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch CV text');
      }
      const data = await response.json();
      const cvText = data.text;

      // Analyze CV content
      const analysisResponse = await analyzeCVContent(cvText);
      setProcessingProgress(30);
      setProcessingStatus('Optimizing CV...');

      // Optimize CV for job
      const optimizationResponse = await optimizeCVForJob(cvText, jobDescription);
      setOptimizedText(optimizationResponse.optimizedContent);

      setProcessingProgress(100);
      setProcessingStatus('Complete');
      setIsProcessed(true);
      setIsProcessing(false);
    } catch (error) {
      console.error('Error processing CV:', error);
      setError(`Error processing CV: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  }, [selectedCVId, jobDescription]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* File selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Select CV</h3>
        <Select
          onValueChange={(value) => {
            const cv = cvs.find(cv => cv.id === value);
            if (cv) {
              handleSelectCV(cv.id, cv.name);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a CV" />
          </SelectTrigger>
          <SelectContent>
            {cvs.map((cv) => (
              <SelectItem key={cv.id} value={cv.id}>
                {cv.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Job description input */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Job Description</h3>
        <textarea
          className="w-full h-48 p-4 bg-[#050505] border border-gray-700 rounded-md text-white resize-none focus:border-[#B4916C] focus:ring-1 focus:ring-[#B4916C] focus:outline-none"
          placeholder="Paste the job description here..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />
      </div>

      {/* Process button */}
      <div className="mb-6">
        <button
          onClick={processCV}
          disabled={isProcessing || !selectedCVId || !jobDescription.trim()}
          className={`w-full py-3 rounded-md font-semibold transition-colors duration-200 ${
            isProcessing || !selectedCVId || !jobDescription.trim()
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-[#B4916C] text-white hover:bg-[#A37F5C]'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Optimize CV for Job'}
        </button>
      </div>

      {/* Processing status */}
      {isProcessing && (
        <div className="mb-6 p-4 border border-gray-700 rounded-md">
          <div className="flex items-center mb-2">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            <span>{processingStatus || 'Processing...'}</span>
          </div>
          <Progress value={processingProgress} className="h-2" />
          <div className="mt-1 text-sm text-gray-400">
            {processingProgress}% complete
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <Alert className="mb-6 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {isProcessed && optimizedText && (
        <div className="p-6 border border-gray-700 rounded-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Optimized CV</h3>
          </div>
          <div className="whitespace-pre-wrap font-mono text-sm bg-[#050505] p-4 rounded-md border border-gray-700">
            {optimizedText}
          </div>
        </div>
      )}
    </div>
  );
} 