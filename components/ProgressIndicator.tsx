"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProgressIndicatorProps {
  progress: number;
  status?: string;
  showPercentage?: boolean;
  showReset?: boolean;
  isTakingTooLong?: boolean;
  onReset?: () => void;
  className?: string;
  progressClassName?: string;
  statusClassName?: string;
}

/**
 * A reusable progress indicator component
 */
export default function ProgressIndicator({
  progress,
  status,
  showPercentage = true,
  showReset = false,
  isTakingTooLong = false,
  onReset,
  className,
  progressClassName,
  statusClassName,
}: ProgressIndicatorProps) {
  return (
    <div className={cn("w-full", className)}>
      {status && (
        <div className="flex justify-between items-center mb-1">
          <span className={cn("text-sm text-[#F9F6EE]/60 font-borna", statusClassName)}>
            {status}
          </span>
          {showPercentage && (
            <span className="text-sm text-[#B4916C] font-borna">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      
      <div className="relative w-full h-1.5 bg-[#222222] mt-2 rounded-full overflow-hidden">
        <div 
          className={cn(
            "absolute top-0 left-0 h-full bg-[#B4916C] transition-all duration-300 ease-in-out",
            progressClassName
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {(showReset || isTakingTooLong) && onReset && (
        <div className="flex justify-end mt-2">
          <Button
            onClick={onReset}
            variant="secondary"
            size="sm"
            className="px-3 py-1.5 h-auto text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            {isTakingTooLong ? "Taking too long? Reset" : "Reset"}
          </Button>
        </div>
      )}
    </div>
  );
} 