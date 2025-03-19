"use client";

import React from 'react';
import { 
  Check, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ArrowRight 
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KeyPoint {
  type: 'positive' | 'negative' | 'info' | 'warning';
  text: string;
}

interface AnalysisKeyPointsProps {
  keyPoints: KeyPoint[];
}

export default function AnalysisKeyPoints({ keyPoints }: AnalysisKeyPointsProps) {
  if (!keyPoints || keyPoints.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Info className="h-8 w-8 mx-auto mb-2 text-gray-500/50" />
        <p>No key points available for this document.</p>
      </div>
    );
  }

  // Group key points by type
  const positivePoints = keyPoints.filter(point => point.type === 'positive');
  const negativePoints = keyPoints.filter(point => point.type === 'negative');
  const infoPoints = keyPoints.filter(point => point.type === 'info');
  const warningPoints = keyPoints.filter(point => point.type === 'warning');

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-4 space-y-6">
        <h3 className="text-[#F9F6EE] font-safiro text-lg mb-4">Key Points</h3>
        
        {/* Positive Points */}
        {positivePoints.length > 0 && (
          <div>
            <h4 className="text-[#4ADE80] font-safiro text-sm mb-2 flex items-center">
              <Check className="h-4 w-4 mr-2" />
              Strengths
            </h4>
            <ul className="space-y-2 pl-6">
              {positivePoints.map((point, index) => (
                <li key={index} className="text-[#E2DFD7] font-borna list-disc marker:text-[#4ADE80]">
                  {point.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Negative Points */}
        {negativePoints.length > 0 && (
          <div>
            <h4 className="text-[#E57373] font-safiro text-sm mb-2 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Areas for Improvement
            </h4>
            <ul className="space-y-2 pl-6">
              {negativePoints.map((point, index) => (
                <li key={index} className="text-[#E2DFD7] font-borna list-disc marker:text-[#E57373]">
                  {point.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Warning Points */}
        {warningPoints.length > 0 && (
          <div>
            <h4 className="text-[#FFB74D] font-safiro text-sm mb-2 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Considerations
            </h4>
            <ul className="space-y-2 pl-6">
              {warningPoints.map((point, index) => (
                <li key={index} className="text-[#E2DFD7] font-borna list-disc marker:text-[#FFB74D]">
                  {point.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Info Points */}
        {infoPoints.length > 0 && (
          <div>
            <h4 className="text-[#64B5F6] font-safiro text-sm mb-2 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              Additional Information
            </h4>
            <ul className="space-y-2 pl-6">
              {infoPoints.map((point, index) => (
                <li key={index} className="text-[#E2DFD7] font-borna list-disc marker:text-[#64B5F6]">
                  {point.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ScrollArea>
  );
} 