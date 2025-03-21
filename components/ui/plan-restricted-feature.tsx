'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PlanRestrictedFeatureProps {
  /**
   * The minimum plan level required to access this feature
   */
  requiredPlan: string;
  
  /**
   * The current user's plan
   */
  currentPlan: string;
  
  /**
   * The content to render when the feature is available
   */
  children: React.ReactNode;
  
  /**
   * Optional tooltip text to show when feature is locked
   */
  lockedMessage: string;
}

// Helper function to determine if user has access based on plan hierarchy
const hasAccess = (currentPlan: string, requiredPlan: string) => {
  const planHierarchy: Record<string, number> = {
    'Free': 0,
    'Basic': 1,
    'Pro': 2,
    'Enterprise': 3
  };
  
  // If the plan is not in our hierarchy, default to no access
  if (!(currentPlan in planHierarchy) || !(requiredPlan in planHierarchy)) {
    return false;
  }
  
  return planHierarchy[currentPlan] >= planHierarchy[requiredPlan];
};

export function PlanRestrictedFeature({
  requiredPlan,
  currentPlan,
  lockedMessage,
  children
}: PlanRestrictedFeatureProps) {
  const hasFeatureAccess = hasAccess(currentPlan, requiredPlan);
  
  if (hasFeatureAccess) {
    return <>{children}</>;
  }
  
  // If user doesn't have access, render a locked version
  return (
    <div className="relative group">
      <div className="opacity-50 blur-[1px] pointer-events-none">
        {children}
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg cursor-not-allowed">
              <div className="bg-[#161616] p-3 rounded-full">
                <Lock className="h-6 w-6 text-[#B4916C]" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-[#0D0D0D] border-[#222222] text-[#F9F6EE]">
            <p className="text-sm">
              <span className="font-bold">{requiredPlan} plan required: </span>
              {lockedMessage}
            </p>
            <p className="text-xs text-[#8A8782] mt-1">
              Upgrade your plan to access this feature
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
} 