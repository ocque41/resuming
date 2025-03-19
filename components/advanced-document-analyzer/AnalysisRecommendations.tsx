"use client";

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Star, ArrowRight, AlertCircle } from 'lucide-react';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category?: string;
}

interface AnalysisRecommendationsProps {
  recommendations: Recommendation[];
}

export default function AnalysisRecommendations({ recommendations }: AnalysisRecommendationsProps) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-500/50" />
        <p>No recommendations available for this document.</p>
      </div>
    );
  }
  
  // Group recommendations by priority
  const highPriority = recommendations.filter(rec => rec.priority === 'high');
  const mediumPriority = recommendations.filter(rec => rec.priority === 'medium');
  const lowPriority = recommendations.filter(rec => rec.priority === 'low');
  
  // Group by category if categories exist
  const hasCategories = recommendations.some(rec => rec.category);
  const categories = hasCategories 
    ? [...new Set(recommendations.filter(rec => rec.category).map(rec => rec.category))]
    : [];
    
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-[#3A1F24] text-[#E57373] border-[#E57373]/30';
      case 'medium':
        return 'bg-[#382917] text-[#FFB74D] border-[#FFB74D]/30';
      case 'low':
        return 'bg-[#0D1F15] text-[#4ADE80] border-[#1A4332]';
      default:
        return 'bg-[#1E293B] text-gray-300 border-gray-700';
    }
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-4 space-y-6">
        <h3 className="text-[#F9F6EE] font-safiro text-lg mb-4">Recommendations</h3>
        
        {/* Display by priority if no categories */}
        {!hasCategories && (
          <>
            {/* High Priority */}
            {highPriority.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[#E57373] font-safiro text-sm">High Priority</h4>
                {highPriority.map((rec) => (
                  <div 
                    key={rec.id} 
                    className="p-3 rounded-md bg-[#0A0A0A] border border-[#222222]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <Star className="h-5 w-5 text-[#E57373] mr-2" />
                        <h5 className="text-[#F9F6EE] font-safiro">{rec.title}</h5>
                      </div>
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-[#E2DFD7] font-borna text-sm pl-7">{rec.description}</p>
                  </div>
                ))}
              </div>
            )}
            
            {/* Medium Priority */}
            {mediumPriority.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[#FFB74D] font-safiro text-sm">Medium Priority</h4>
                {mediumPriority.map((rec) => (
                  <div 
                    key={rec.id} 
                    className="p-3 rounded-md bg-[#0A0A0A] border border-[#222222]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <Star className="h-5 w-5 text-[#FFB74D] mr-2" />
                        <h5 className="text-[#F9F6EE] font-safiro">{rec.title}</h5>
                      </div>
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-[#E2DFD7] font-borna text-sm pl-7">{rec.description}</p>
                  </div>
                ))}
              </div>
            )}
            
            {/* Low Priority */}
            {lowPriority.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[#4ADE80] font-safiro text-sm">Lower Priority</h4>
                {lowPriority.map((rec) => (
                  <div 
                    key={rec.id} 
                    className="p-3 rounded-md bg-[#0A0A0A] border border-[#222222]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <Star className="h-5 w-5 text-[#4ADE80] mr-2" />
                        <h5 className="text-[#F9F6EE] font-safiro">{rec.title}</h5>
                      </div>
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-[#E2DFD7] font-borna text-sm pl-7">{rec.description}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Display by category if categories exist */}
        {hasCategories && categories.map((category) => (
          <div key={category} className="space-y-4">
            <h4 className="text-[#B4916C] font-safiro text-sm">{category}</h4>
            {recommendations
              .filter(rec => rec.category === category)
              .map((rec) => (
                <div 
                  key={rec.id} 
                  className="p-3 rounded-md bg-[#0A0A0A] border border-[#222222]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center">
                      <Star className="h-5 w-5 text-[#B4916C] mr-2" />
                      <h5 className="text-[#F9F6EE] font-safiro">{rec.title}</h5>
                    </div>
                    <Badge className={getPriorityColor(rec.priority)}>
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-[#E2DFD7] font-borna text-sm pl-7">{rec.description}</p>
                </div>
              ))}
          </div>
        ))}
        
        {/* Implementation suggestion */}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <div className="flex items-start">
            <ArrowRight className="h-5 w-5 text-[#64B5F6] mt-0.5 mr-2" />
            <p className="text-[#E2DFD7] font-borna text-sm">
              <span className="text-[#64B5F6] font-safiro">Implementation Note:</span><br />
              Implement these recommendations in order of priority for the most significant improvements to your document.
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
} 