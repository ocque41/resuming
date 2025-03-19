import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { TimelineEntry } from './types';

interface AnalysisTimelineProps {
  timeline?: TimelineEntry[];
}

export default function AnalysisTimeline({ timeline = [] }: AnalysisTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return null;
  }

  // Sort timeline entries chronologically if possible
  // This is a simple approach that might not work for all date formats
  const sortedTimeline = [...timeline].sort((a, b) => {
    // Sort by year if present, otherwise keep original order
    const yearA = a.period.match(/\b(19|20)\d{2}\b/);
    const yearB = b.period.match(/\b(19|20)\d{2}\b/);
    
    if (yearA && yearB) {
      return parseInt(yearA[0]) - parseInt(yearB[0]);
    }
    return 0;
  });

  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
        <CardTitle className="text-lg font-medium text-[#F9F6EE] flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#B4916C]" />
          Document Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-[#222222]" />
          
          <div className="space-y-6">
            {sortedTimeline.map((entry, index) => (
              <div key={index} className="relative flex items-start gap-4 pl-12">
                {/* Timeline connector dot */}
                <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-[#161616] border-2 border-[#B4916C] z-10" />
                
                <div className="bg-[#0A0A0A] p-4 rounded-lg border border-[#222222] w-full">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#B4916C]" />
                      <span className="text-[#E2DFD7] font-medium">{entry.period}</span>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-[#8A8782] text-sm flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-[#5D5D5D]" />
                    <span>{entry.entity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 