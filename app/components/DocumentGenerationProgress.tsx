'use client';

import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw } from "lucide-react";

interface DocumentGenerationProgressProps {
  isGenerating: boolean;
  progress: number;
  status: string;
  processingTooLong: boolean;
  onRetry: () => void;
  onCancel?: () => void;
}

export default function DocumentGenerationProgress({
  isGenerating,
  progress,
  status,
  processingTooLong,
  onRetry,
  onCancel
}: DocumentGenerationProgressProps) {
  if (!isGenerating && progress === 0) {
    return null;
  }

  return (
    <div className="mt-6 p-4 bg-[#0D0D0D] border border-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-white">Document Generation</h3>
        <span className={`px-2 py-1 text-xs rounded-full ${
          progress === 100 
            ? 'bg-green-500/20 text-green-500' 
            : 'bg-[#B4916C]/20 text-[#B4916C]'
        }`}>
          {progress === 100 ? 'Complete' : `${Math.round(progress)}%`}
        </span>
      </div>
      
      <Progress 
        value={progress} 
        className="h-2 mb-4" 
      />
      
      <div className="text-sm text-gray-300">
        {status}
      </div>
      
      {processingTooLong && (
        <div className="mt-4 p-3 bg-[#B4916C]/10 border border-[#B4916C]/30 rounded-md flex items-start">
          <Clock className="w-5 h-5 text-[#B4916C] mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#B4916C] font-medium">This is taking longer than expected</p>
            <p className="text-[#B4916C]/80 text-sm mt-1">
              Document generation can take up to 2 minutes for complex CVs. You can wait or try again.
            </p>
            <div className="mt-3 flex space-x-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#B4916C]/20 hover:bg-[#B4916C]/30 border-[#B4916C]/50 text-[#B4916C]"
                onClick={onRetry}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              {onCancel && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="hover:bg-[#B4916C]/10 text-[#B4916C]"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 