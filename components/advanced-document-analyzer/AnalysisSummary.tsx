import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface AnalysisSummaryProps {
  summary: string;
  fileName?: string;
}

const AnalysisSummary: React.FC<AnalysisSummaryProps> = ({ summary, fileName }) => {
  return (
    <Card className="bg-[#161616] border-[#222222]">
      <CardContent className="p-6">
        <div className="space-y-4">
          {fileName && (
            <div className="flex items-center text-[#F9F6EE] gap-2 mb-4">
              <FileText className="h-5 w-5 text-[#B4916C]" />
              <h3 className="font-medium">{fileName}</h3>
            </div>
          )}
          
          <div>
            <h3 className="text-lg font-medium text-[#F9F6EE] mb-3">Document Summary</h3>
            <div className="text-[#E2DFD7] text-sm leading-relaxed whitespace-pre-line">
              {summary || "No summary available for this document."}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalysisSummary; 