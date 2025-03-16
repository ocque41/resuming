'use client';

import React, { useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Circle, AlertCircle, Loader2, AlertTriangle } from "lucide-react";
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
      extractedSkills?: string[];
      identifiedKeywords?: string[];
    };
    error?: string;
  } | null;
  isOptimizing: boolean;
}

const styles = `
  @keyframes pulse-slow {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.95;
    }
  }
  
  .animate-pulse-slow {
    animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes slide-in {
    from {
      transform: translateX(-10px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .stage-transition-enter {
    animation: slide-in 0.3s ease forwards;
  }
`;

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
      <div 
        key={stage.id} 
        className={`flex items-center mb-3 p-2 rounded-md transition-all duration-300 stage-transition-enter ${
          inProgress ? 'bg-blue-900/20 border border-blue-800/30' : 
          completed ? 'bg-green-900/10' : ''
        }`}
        style={{ 
          animationDelay: `${stages.findIndex(s => s.id === stage.id) * 0.1}s` 
        }}
      >
        <div className="relative">
          {completed ? (
            <CheckCircle className="h-6 w-6 text-green-500 mr-3 transition-all duration-300 transform scale-100" />
          ) : inProgress ? (
            <>
              <Loader2 className="h-6 w-6 text-blue-500 mr-3 animate-spin" />
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-blue-500 rounded-full animate-ping"></span>
            </>
          ) : (
            <Circle className="h-6 w-6 text-gray-400 mr-3 transition-all duration-300" />
          )}
        </div>
        <div className="flex flex-col">
          <span className={`font-medium transition-all duration-300 ${
            completed ? 'text-green-500' : 
            inProgress ? 'text-blue-500' : 
            'text-gray-400'
          }`}>
            {stage.label}
          </span>
          {inProgress && (
            <span className="text-xs text-blue-400 animate-pulse mt-1">In progress...</span>
          )}
          {completed && (
            <span className="text-xs text-green-400 mt-1">Completed</span>
          )}
        </div>
      </div>
    );
  };
  
  // Render a progress bar with animation
  const renderProgressBar = (progress: number) => {
    const isLowProgress = progress < 20;
    
    return (
      <div className="w-full mt-4 mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-300">Progress</span>
          <span className={`text-sm font-medium ${
            progress === 100 ? 'text-green-500' : 
            progress > 50 ? 'text-blue-500' : 
            'text-gray-400'
          } transition-colors duration-500`}>
            {progress}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              progress === 100 ? 'bg-green-500' : 
              isLowProgress ? 'bg-blue-600 animate-pulse' : 
              'bg-blue-600'
            }`}
            style={{ 
              width: `${progress}%`,
              boxShadow: progress > 0 ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none'
            }}
          >
            {isLowProgress && progress > 0 && (
              <div className="h-full w-full bg-blue-400/30 animate-pulse"></div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Add custom animation styles
  useEffect(() => {
    // Add the styles to the document head
    const styleElement = document.createElement('style');
    styleElement.innerHTML = styles;
    document.head.appendChild(styleElement);
    
    // Clean up on unmount
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  
  return (
    <Card className={`w-full bg-gray-950 border-gray-800 shadow-lg transition-all duration-300 
      ${progress > 0 && progress < 100 ? 'animate-pulse-slow hover:shadow-blue-900/30' : 'hover:shadow-blue-900/20'}
    `}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex justify-between items-center">
          <span>Optimization Details</span>
          <span className={`text-sm font-medium ${
            progress === 100 ? 'text-green-500' : 
            progress > 0 ? 'text-blue-500' : 
            'text-gray-400'
          } transition-colors duration-300`}>
            {progress}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderProgressBar(progress)}
        
        <div className="space-y-1 mt-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Current Status:</h3>
          {stages.map(renderStageItem)}
        </div>
        
        {/* Results section */}
        {optimizationState?.results && optimizationState.results.optimizedContent && (
          <div className="mt-6 space-y-4 animate-in fade-in duration-500">
            <h3 className="text-sm font-medium text-gray-300 flex items-center">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              Optimization Results
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {optimizationState.results.extractedSkills && (
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800 hover:border-gray-700 transition-all duration-300">
                  <h4 className="text-xs font-medium text-gray-400 mb-2">Extracted Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {optimizationState.results.extractedSkills.map((skill, index) => (
                      <span 
                        key={index} 
                        className="px-2 py-1 text-xs rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/30 transition-colors duration-300 hover:bg-blue-900/40"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {optimizationState.results.identifiedKeywords && (
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800 hover:border-gray-700 transition-all duration-300">
                  <h4 className="text-xs font-medium text-gray-400 mb-2">Identified Keywords</h4>
                  <div className="flex flex-wrap gap-1">
                    {optimizationState.results.identifiedKeywords.map((keyword, index) => (
                      <span 
                        key={index} 
                        className="px-2 py-1 text-xs rounded-full bg-purple-900/30 text-purple-400 border border-purple-800/30 transition-colors duration-300 hover:bg-purple-900/40"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {optimizationState.results.industry && (
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800 hover:border-gray-700 transition-all duration-300">
                  <h4 className="text-xs font-medium text-gray-400 mb-1">Industry</h4>
                  <p className="text-sm">{optimizationState.results.industry}</p>
                </div>
              )}
              
              {optimizationState.results.language && (
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800 hover:border-gray-700 transition-all duration-300">
                  <h4 className="text-xs font-medium text-gray-400 mb-1">Language</h4>
                  <p className="text-sm">{optimizationState.results.language}</p>
                </div>
              )}
              
              {optimizationState.results.matchScore !== undefined && (
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800 hover:border-gray-700 transition-all duration-300">
                  <h4 className="text-xs font-medium text-gray-400 mb-1">Match Score</h4>
                  <div className="flex items-center">
                    <span className={`text-lg font-semibold ${
                      optimizationState.results.matchScore >= 80 ? 'text-green-500' :
                      optimizationState.results.matchScore >= 60 ? 'text-yellow-500' :
                      'text-red-500'
                    }`}>
                      {optimizationState.results.matchScore}%
                    </span>
                    <div className="ml-2 flex-1">
                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${
                            optimizationState.results.matchScore >= 80 ? 'bg-green-500' :
                            optimizationState.results.matchScore >= 60 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${optimizationState.results.matchScore}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Error display */}
        {optimizationState?.error && (
          <div className="mt-6 p-4 bg-red-900/20 border border-red-800/30 rounded-lg animate-in fade-in duration-300">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-400">Error Occurred</h3>
                <p className="text-sm text-red-300/80 mt-1">{optimizationState.error}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 