'use client';

import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Circle, AlertCircle, Loader2 } from "lucide-react";
import { OptimizationStage } from '@/lib/services/progressiveOptimization';

interface ProgressiveOptimizationStatusProps {
  optimizationState: {
    stage: string;
    progress: number;
    results: {
      skills?: string[];
      keywords?: string[];
      keyRequirements?: string[];
      formatAnalysis?: {
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
      };
      contentAnalysis?: {
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
      };
      industry?: string;
      language?: string;
      sections?: Array<{ name: string; content: string }>;
      optimizedProfile?: string;
      optimizedExperience?: string[];
      optimizedSkills?: string[];
      optimizedEducation?: string[];
      optimizedContent?: string;
      matchScore?: number;
      recommendations?: string[];
      formattedDocument?: string;
      format?: string;
    };
    error?: string;
  } | null;
  isOptimizing: boolean;
}

export default function ProgressiveOptimizationStatus({ 
  optimizationState, 
  isOptimizing 
}: ProgressiveOptimizationStatusProps) {
  if (!optimizationState && !isOptimizing) {
    return null;
  }
  
  // Calculate progress
  const progress = optimizationState?.progress || 0;
  
  // Determine current stage
  const currentStage = optimizationState?.stage || OptimizationStage.NOT_STARTED;
  
  // Define stages
  const stages = [
    { id: OptimizationStage.ANALYZE_STARTED, label: "Analyzing CV" },
    { id: OptimizationStage.OPTIMIZE_STARTED, label: "Optimizing Content" },
    { id: OptimizationStage.GENERATE_STARTED, label: "Generating Document" }
  ];
  
  // Check if a stage is completed
  const isStageCompleted = (stageId: OptimizationStage) => {
    if (!optimizationState) return false;
    
    if (stageId === OptimizationStage.ANALYZE_STARTED) {
      return currentStage === OptimizationStage.ANALYZE_COMPLETED || 
             currentStage.startsWith('OPTIMIZE_') || 
             currentStage.startsWith('GENERATE_');
    } else if (stageId === OptimizationStage.OPTIMIZE_STARTED) {
      return currentStage === OptimizationStage.OPTIMIZE_COMPLETED || 
             currentStage.startsWith('GENERATE_');
    } else if (stageId === OptimizationStage.GENERATE_STARTED) {
      return currentStage === OptimizationStage.GENERATE_COMPLETED;
    }
    
    return false;
  };
  
  // Check if a stage is in progress
  const isStageInProgress = (stageId: OptimizationStage) => {
    return currentStage === stageId;
  };
  
  // Render a stage item
  const renderStageItem = (stage: { id: OptimizationStage; label: string }) => {
    const completed = isStageCompleted(stage.id);
    const inProgress = isStageInProgress(stage.id);
    
    return (
      <div key={stage.id} className="flex items-center mb-2">
        {completed ? (
          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
        ) : inProgress ? (
          <Loader2 className="h-5 w-5 text-blue-500 mr-2 animate-spin" />
        ) : (
          <Circle className="h-5 w-5 text-gray-400 mr-2" />
        )}
        <span className={`${completed ? 'text-green-500' : inProgress ? 'text-blue-500' : 'text-gray-400'}`}>
          {stage.label}
        </span>
      </div>
    );
  };
  
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Optimization Progress</span>
          <span className="text-sm font-normal">{Math.round(progress)}%</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={progress} className="h-2 mb-4" />
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Current Status</h3>
            <div className="space-y-1">
              {stages.map(renderStageItem)}
            </div>
          </div>
          
          {optimizationState?.error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-800/50 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-red-200 text-sm">{optimizationState.error}</p>
              </div>
            </div>
          )}
          
          {optimizationState?.results && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-medium">Current Results</h3>
              
              {optimizationState.results.skills && optimizationState.results.skills.length > 0 && (
                <div>
                  <h4 className="text-xs text-gray-400 mb-1">Skills Extracted</h4>
                  <div className="flex flex-wrap gap-1">
                    {optimizationState.results.skills.slice(0, 5).map((skill, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-800 rounded-full text-xs">
                        {skill}
                      </span>
                    ))}
                    {optimizationState.results.skills.length > 5 && (
                      <span className="px-2 py-1 bg-gray-800 rounded-full text-xs">
                        +{optimizationState.results.skills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {optimizationState.results.keywords && optimizationState.results.keywords.length > 0 && (
                <div>
                  <h4 className="text-xs text-gray-400 mb-1">Keywords Identified</h4>
                  <div className="flex flex-wrap gap-1">
                    {optimizationState.results.keywords.slice(0, 5).map((keyword, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-800 rounded-full text-xs">
                        {keyword}
                      </span>
                    ))}
                    {optimizationState.results.keywords.length > 5 && (
                      <span className="px-2 py-1 bg-gray-800 rounded-full text-xs">
                        +{optimizationState.results.keywords.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {optimizationState.results.industry && (
                <div>
                  <h4 className="text-xs text-gray-400 mb-1">Industry</h4>
                  <p className="text-sm">{optimizationState.results.industry}</p>
                </div>
              )}
              
              {optimizationState.results.language && (
                <div>
                  <h4 className="text-xs text-gray-400 mb-1">Language</h4>
                  <p className="text-sm">{optimizationState.results.language}</p>
                </div>
              )}
              
              {optimizationState.results.matchScore !== undefined && (
                <div>
                  <h4 className="text-xs text-gray-400 mb-1">Match Score</h4>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-700 rounded-full h-2.5 mr-2">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${optimizationState.results.matchScore}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{Math.round(optimizationState.results.matchScore)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="text-xs text-gray-500 mt-2">
            Powered by OpenAI GPT-4o
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 