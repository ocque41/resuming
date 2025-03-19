import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

interface AnalysisKeyPointsProps {
  keyPoints: string[];
}

export default function AnalysisKeyPoints({ keyPoints = [] }: AnalysisKeyPointsProps) {
  if (!keyPoints || keyPoints.length === 0) {
    return null;
  }

  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
        <CardTitle className="text-lg font-medium text-[#F9F6EE]">
          Key Points
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <ul className="space-y-3">
          {keyPoints.map((point, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-[#4ADE80] mt-0.5 flex-shrink-0" />
              <span className="text-[#E2DFD7] text-sm">{point}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}