'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Download } from 'lucide-react';

interface PDFPreviewProps {
  pdfData: string;
  fileName?: string;
  onDownload?: () => void;
}

export default function PDFPreview({ pdfData, fileName = 'document.pdf', onDownload }: PDFPreviewProps) {
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  
  // Simple PDF viewer using iframe
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap justify-between mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
            variant="outline"
            size="sm"
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-400">{Math.round(zoom * 100)}%</span>
          <Button
            onClick={() => setZoom(prev => Math.min(prev + 0.25, 2))}
            variant="outline"
            size="sm"
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {onDownload && (
          <Button
            onClick={onDownload}
            className="bg-[#B4916C] hover:bg-[#A3815C] text-white"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        )}
      </div>
      
      <div className="flex-grow overflow-auto bg-[#050505] rounded-lg border border-gray-800 p-2">
        <div 
          className="flex justify-center"
          style={{ 
            transform: `scale(${zoom})`, 
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease'
          }}
        >
          <iframe 
            src={`data:application/pdf;base64,${pdfData}`}
            className="w-full h-full border-0 bg-white"
            style={{ minHeight: '500px' }}
            title="PDF Preview"
            sandbox="allow-scripts"
          />
        </div>
      </div>
      
      <div className="text-center mt-2 text-xs text-gray-500">
        Use your browser's PDF controls to navigate pages
      </div>
    </div>
  );
} 