'use client';

import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
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

  // Define the stages for each phase
  const analyzeStages = [
    { id: OptimizationStage.ANALYZE_STARTED, label: 'Analysis Started' },
    { id: OptimizationStage.SKILLS_EXTRACTED, label: 'Skills Extracted' },
    { id: OptimizationStage.KEYWORDS_EXTRACTED, label: 'Keywords Extracted' },
    { id: OptimizationStage.KEY_REQUIREMENTS_EXTRACTED, label: 'Requirements Extracted' },
    { id: OptimizationStage.FORMAT_ANALYZED, label: 'Format Analyzed' },
    { id: OptimizationStage.CONTENT_ANALYZED, label: 'Content Analyzed' },
    { id: OptimizationStage.INDUSTRY_DETERMINED, label: 'Industry Determined' },
    { id: OptimizationStage.LANGUAGE_DETECTED, label: 'Language Detected' },
    { id: OptimizationStage.SECTIONS_EXTRACTED, label: 'Sections Extracted' },
    { id: OptimizationStage.ANALYZE_COMPLETED, label: 'Analysis Completed' },
  ];

  const optimizeStages = [
    { id: OptimizationStage.OPTIMIZE_STARTED, label: 'Optimization Started' },
    { id: OptimizationStage.PROFILE_OPTIMIZED, label: 'Profile Optimized' },
    { id: OptimizationStage.EXPERIENCE_OPTIMIZED, label: 'Experience Optimized' },
    { id: OptimizationStage.SKILLS_OPTIMIZED, label: 'Skills Optimized' },
    { id: OptimizationStage.EDUCATION_OPTIMIZED, label: 'Education Optimized' },
    { id: OptimizationStage.OPTIMIZE_COMPLETED, label: 'Optimization Completed' },
  ];

  const generateStages = [
    { id: OptimizationStage.GENERATE_STARTED, label: 'Document Generation Started' },
    { id: OptimizationStage.GENERATE_COMPLETED, label: 'Document Generation Completed' },
  ];

  // Determine current phase and stage
  const currentStage = optimizationState?.stage || OptimizationStage.NOT_STARTED;
  
  let currentPhase = 'analyze';
  if (currentStage.startsWith('OPTIMIZE_') || currentStage === OptimizationStage.OPTIMIZE_COMPLETED) {
    currentPhase = 'optimize';
  } else if (currentStage.startsWith('GENERATE_') || currentStage === OptimizationStage.GENERATE_COMPLETED) {
    currentPhase = 'generate';
  }

  // Helper function to check if a stage is completed
  const isStageCompleted = (stageId: OptimizationStage) => {
    if (!optimizationState) return false;
    
    const stageOrder = [
      ...analyzeStages, 
      ...optimizeStages, 
      ...generateStages
    ].map(s => s.id);
    
    const currentIndex = stageOrder.indexOf(currentStage as OptimizationStage);
    const stageIndex = stageOrder.indexOf(stageId);
    
    return stageIndex <= currentIndex;
  };

  // Helper function to check if a stage is in progress
  const isStageInProgress = (stageId: OptimizationStage) => {
    return optimizationState?.stage === stageId && isOptimizing;
  };

  // Render a stage item
  const renderStageItem = (stage: { id: OptimizationStage; label: string }) => {
    const completed = isStageCompleted(stage.id);
    const inProgress = isStageInProgress(stage.id);
    
    return (
      <div key={stage.id} className="flex items-center space-x-2 py-1">
        {completed ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : inProgress ? (
          <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
        ) : (
          <Clock className="h-5 w-5 text-gray-400" />
        )}
        <span className={`text-sm ${completed ? 'text-white' : inProgress ? 'text-amber-300' : 'text-gray-400'}`}>
          {stage.label}
        </span>
      </div>
    );
  };

  return (
    <Card className="w-full bg-[#0D0D0D] border-gray-800">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg text-white">Optimization Progress</CardTitle>
          <Badge 
            variant="outline" 
            className={`
              ${optimizationState?.progress === 100 ? 'bg-green-900/30 text-green-400 border-green-800' : 
                optimizationState?.error ? 'bg-red-900/30 text-red-400 border-red-800' : 
                'bg-amber-900/30 text-amber-400 border-amber-800'}
            `}
          >
            {optimizationState?.progress === 100 ? 'Complete' : 
              optimizationState?.error ? 'Error' : 
              `${Math.round(optimizationState?.progress || 0)}%`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Progress 
          value={optimizationState?.progress || 0} 
          className="h-2 mb-4" 
        />
        
        {optimizationState?.error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-red-300 text-sm">
              {optimizationState.error}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <h3 className={`text-sm font-medium mb-2 ${currentPhase === 'analyze' ? 'text-amber-400' : 'text-white'}`}>
              Analysis Phase
            </h3>
            <div className="space-y-1">
              {analyzeStages.map(renderStageItem)}
            </div>
          </div>
          
          <div>
            <h3 className={`text-sm font-medium mb-2 ${currentPhase === 'optimize' ? 'text-amber-400' : 'text-white'}`}>
              Optimization Phase
            </h3>
            <div className="space-y-1">
              {optimizeStages.map(renderStageItem)}
            </div>
          </div>
          
          <div>
            <h3 className={`text-sm font-medium mb-2 ${currentPhase === 'generate' ? 'text-amber-400' : 'text-white'}`}>
              Document Generation Phase
            </h3>
            <div className="space-y-1">
              {generateStages.map(renderStageItem)}
            </div>
          </div>
        </div>
        
        {optimizationState?.results && Object.keys(optimizationState.results).length > 0 && (
          <div className="mt-6">
            <Separator className="mb-4" />
            <h3 className="text-sm font-medium mb-2 text-white">Current Results</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {optimizationState.results.skills && optimizationState.results.skills.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-1">Skills Extracted</h4>
                  <p className="text-sm text-gray-300">
                    {optimizationState.results.skills.slice(0, 5).join(', ')}
                    {optimizationState.results.skills.length > 5 && '...'}
                  </p>
                </div>
              )}
              
              {optimizationState.results.keywords && optimizationState.results.keywords.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-1">Keywords Extracted</h4>
                  <p className="text-sm text-gray-300">
                    {optimizationState.results.keywords.slice(0, 5).join(', ')}
                    {optimizationState.results.keywords.length > 5 && '...'}
                  </p>
                </div>
              )}
              
              {optimizationState.results.industry && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-1">Industry</h4>
                  <p className="text-sm text-gray-300">{optimizationState.results.industry}</p>
                </div>
              )}
              
              {optimizationState.results.language && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-1">Language</h4>
                  <p className="text-sm text-gray-300">{optimizationState.results.language}</p>
                </div>
              )}
              
              {optimizationState.results.matchScore !== undefined && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-1">Match Score</h4>
                  <p className="text-sm text-gray-300">{Math.round(optimizationState.results.matchScore * 100)}%</p>
                </div>
              )}
              
              {optimizationState.results.sections && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-1">Sections Extracted</h4>
                  <p className="text-sm text-gray-300">
                    {optimizationState.results.sections.map(s => s.name).slice(0, 5).join(', ')}
                    {optimizationState.results.sections.length > 5 && '...'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 