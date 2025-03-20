import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { TimelineEntry } from './types';

interface AnalysisTimelineProps {
  timeline: TimelineEntry[] | any[];
}

export default function AnalysisTimeline({ timeline }: AnalysisTimelineProps) {
  console.log("Rendering AnalysisTimeline with", timeline ? timeline.length : 0, "entries");
  
  if (!timeline || !Array.isArray(timeline) || timeline.length === 0) {
    console.warn("Timeline is empty or invalid:", timeline);
    return null;
  }

  // Normalize timeline entries to handle different formats
  const normalizeTimelineEntries = (entries: any[]): TimelineEntry[] => {
    return entries.map(entry => {
      if (!entry || typeof entry !== 'object') {
        console.warn("Invalid timeline entry:", entry);
        return { date: 'Unknown', event: 'Unknown event' };
      }

      // Get date from various possible properties
      const date = entry.date || entry.period || entry.time || 'Unknown date';
      
      // Get event from various possible properties
      const event = entry.event || entry.entity || entry.description || entry.name || 'Unknown event';
      
      return { date, event };
    });
  };

  const normalizedTimeline = normalizeTimelineEntries(timeline);

  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
        <CardTitle className="text-lg font-medium text-[#F9F6EE] flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#B4916C]" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <div className="relative">
          {/* Vertical line for timeline */}
          <div className="absolute top-0 bottom-0 left-3 w-0.5 bg-[#222222]" />
          
          {/* Timeline entries */}
          <div className="space-y-4">
            {normalizedTimeline.map((entry, index) => (
              <div 
                key={index} 
                className="relative pl-10"
              >
                {/* Timeline dot */}
                <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-[#161616] border-2 border-[#222222] flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-[#B4916C]" />
                </div>
                
                {/* Content */}
                <div className="bg-[#161616] rounded-lg p-3 border border-[#222222]">
                  <div className="text-[#8A8782] text-xs mb-1 font-medium">{entry.date}</div>
                  <div className="text-[#F9F6EE] text-sm">{entry.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 