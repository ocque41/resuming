import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnalysisRecommendationsProps {
  recommendations: string[] | any[];
  documentId?: string; // Make this optional to avoid breaking changes
}

const AnalysisRecommendations: React.FC<AnalysisRecommendationsProps> = ({ 
  recommendations, 
  documentId 
}) => {
  // Normalize recommendations to always be an array of strings
  const normalizedRecommendations = React.useMemo(() => {
    if (!recommendations) return [];
    
    if (!Array.isArray(recommendations)) {
      console.warn("Recommendations is not an array:", recommendations);
      return [];
    }
    
    return recommendations
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item) return item.text;
        if (item && typeof item === 'object' && 'recommendation' in item) return item.recommendation;
        return String(item);
      })
      .filter(Boolean);
  }, [recommendations]);

  if (!normalizedRecommendations.length) {
    return (
      <Card className="bg-[#161616] border-[#222222]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-10 text-center">
            <div className="space-y-3">
              <Check className="h-10 w-10 text-[#8A8782] mx-auto" />
              <h3 className="text-[#F9F6EE] font-medium">No Recommendations</h3>
              <p className="text-[#8A8782] text-sm max-w-md">
                There are no specific recommendations for this document.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleApplyRecommendation = (recommendation: string) => {
    console.log(`Applying recommendation for document ID: ${documentId || 'unknown'}`, recommendation);
    // Here you would implement functionality to apply the recommendation
    // This could involve an API call to update the document
  };

  return (
    <Card className="bg-[#161616] border-[#222222]">
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-[#F9F6EE]">Improvements</h3>
          <div className="space-y-4">
            {normalizedRecommendations.map((recommendation, index) => (
              <div
                key={`recommendation-${index}`}
                className="p-3 rounded-lg bg-[#0A0A0A] border border-[#222222]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#B4916C]/20 text-[#B4916C] mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <p className="text-[#F9F6EE] text-sm">{recommendation}</p>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-[#222222] text-[#8A8782] hover:bg-[#222222] hover:text-[#F9F6EE]"
                        onClick={() => handleApplyRecommendation(recommendation)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalysisRecommendations;