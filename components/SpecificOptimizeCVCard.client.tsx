// SpecificOptimizeCVCard.client.tsx
// This component provides a tailored CV optimization for a specific job description.

"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, FileText, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SpecificOptimizeCVCardProps {
  selectedCVId: string;
  selectedCVName?: string;
}

interface OptimizationResult {
  optimizedText: string;
  matchScore: number;
  keywordsMatched: string[];
  suggestedImprovements: string[];
}

export default function SpecificOptimizeCVCard({ selectedCVId, selectedCVName }: SpecificOptimizeCVCardProps) {
  const [jobDescription, setJobDescription] = useState<string>("");
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState<boolean>(false);

  const handleOptimize = async () => {
    if (!jobDescription.trim()) {
      setError("Please enter a job description.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setOptimizationResult(null);
    
    try {
      const response = await fetch("/api/cv/process/job-specific", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvId: selectedCVId, jobDescription: jobDescription }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to optimize CV for job.");
      }
      
      setOptimizationResult({
        optimizedText: data.optimizedText || "",
        matchScore: data.matchScore || 0,
        keywordsMatched: data.keywordsMatched || [],
        suggestedImprovements: data.suggestedImprovements || []
      });
    } catch (err: any) {
      console.error("Error during job-specific optimization:", err);
      setError(err.message || "An error occurred during job-specific optimization.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!optimizationResult?.optimizedText) {
      setError("No optimized content available to download.");
      return;
    }

    setIsDownloadingDocx(true);

    try {
      const response = await fetch("/api/cv/generate-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cvId: selectedCVId,
          optimizedText: optimizationResult.optimizedText,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate DOCX file');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.docxBase64) {
        throw new Error('Failed to generate DOCX file');
      }
      
      // Create a download link for the DOCX file
      const linkSource = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${data.docxBase64}`;
      const downloadLink = document.createElement('a');
      downloadLink.href = linkSource;
      
      // Use a more professional filename format
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      const cleanCVName = selectedCVName?.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_') || 'job_optimized';
      downloadLink.download = `${cleanCVName}_JobOptimized_${timestamp}.docx`;
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      console.log('DOCX file downloaded successfully');
    } catch (error) {
      console.error('Error downloading DOCX:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  // Helper function to get match score color
  const getMatchScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <Card className="shadow-lg border border-[#B4916C]/20 bg-[#121212]">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-[#B4916C] flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <span>Job-Specific Optimization</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Optimize your CV for a specific job. Please paste the job description below.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {error && (
          <Alert className="bg-red-950 border-red-900 text-red-200">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div>
          <label htmlFor="job-description" className="block text-sm font-medium text-gray-400 mb-2">
            Job Description
          </label>
          <Textarea
            id="job-description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            className="bg-[#2A2A2A] border-gray-700 text-white min-h-[150px]"
          />
        </div>
        
        <Button
          onClick={handleOptimize}
          disabled={isLoading || !jobDescription.trim()}
          className="bg-[#B4916C] hover:bg-[#A27D59] text-[#050505] w-full"
        >
          {isLoading ? "Optimizing..." : "Optimize CV for This Job"}
        </Button>
        
        {optimizationResult && (
          <div className="mt-6 space-y-4">
            {/* Match Score */}
            <div className="bg-[#0A0A0A] p-4 rounded-md border border-gray-800">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-white font-medium">Match Score</h3>
                <span className={`text-xl font-bold ${getMatchScoreColor(optimizationResult.matchScore)}`}>
                  {optimizationResult.matchScore}%
                </span>
              </div>
              <Progress 
                value={optimizationResult.matchScore} 
                className="h-2 bg-gray-700"
                style={{
                  "--progress-foreground": optimizationResult.matchScore >= 80 ? "rgb(34, 197, 94)" :
                  optimizationResult.matchScore >= 60 ? "rgb(234, 179, 8)" :
                  "rgb(239, 68, 68)"
                } as React.CSSProperties}
              />
            </div>
            
            {/* Keywords Matched */}
            {optimizationResult.keywordsMatched.length > 0 && (
              <div className="bg-[#0A0A0A] p-4 rounded-md border border-gray-800">
                <h3 className="text-white font-medium mb-2">Keywords Matched</h3>
                <div className="flex flex-wrap gap-2">
                  {optimizationResult.keywordsMatched.map((keyword, index) => (
                    <Badge key={index} className="bg-[#B4916C]/20 text-[#B4916C] hover:bg-[#B4916C]/30">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Suggested Improvements */}
            {optimizationResult.suggestedImprovements.length > 0 && (
              <div className="bg-[#0A0A0A] p-4 rounded-md border border-gray-800">
                <h3 className="text-white font-medium mb-2">Suggested Improvements</h3>
                <ul className="space-y-1 text-gray-300 text-sm">
                  {optimizationResult.suggestedImprovements.map((improvement, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-[#B4916C] mr-2">•</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Optimized CV */}
            <div className="bg-[#0A0A0A] p-4 rounded-md border border-gray-800">
              <h3 className="text-white font-medium mb-2">Optimized CV</h3>
              <div className="whitespace-pre-wrap text-sm text-gray-300 bg-[#050505] p-4 rounded-md max-h-96 overflow-y-auto">
                {optimizationResult.optimizedText}
              </div>
            </div>
            
            {/* Download Button */}
            <Button
              onClick={handleDownloadDocx}
              disabled={isDownloadingDocx || !optimizationResult.optimizedText}
              className="w-full bg-[#121212] hover:bg-gray-800 text-white border border-gray-700"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloadingDocx ? "Generating DOCX..." : "Download as DOCX"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 