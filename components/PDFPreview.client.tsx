'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Download, RefreshCw, Plus, Minus } from 'lucide-react';
import { AlertCircle } from 'lucide-react';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFPreviewProps {
  pdfData: string;
  fileName?: string;
  onDownload?: () => void;
}

export default function PDFPreview({ pdfData, fileName = 'document.pdf', onDownload }: PDFPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Reset state when PDF data changes
  useEffect(() => {
    setPageNumber(1);
    setScale(1.0);
    setRotation(0);
    setLoading(true);
    setError(null);
  }, [pdfData]);

  // Measure container width for responsive rendering
  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }

    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle PDF load success
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  // Handle PDF load error
  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF. Please try again.');
    setLoading(false);
  }

  // Navigation functions
  function goToPrevPage() {
    setPageNumber(page => Math.max(page - 1, 1));
  }

  function goToNextPage() {
    if (numPages) {
      setPageNumber(page => Math.min(page + 1, numPages));
    }
  }

  // Zoom functions
  function zoomIn() {
    setScale(s => Math.min(s + 0.2, 3.0));
  }

  function zoomOut() {
    setScale(s => Math.max(s - 0.2, 0.5));
  }

  // Rotation function
  function rotate() {
    setRotation(r => (r + 90) % 360);
  }

  // Handle download
  function handleDownload() {
    if (onDownload) {
      onDownload();
    } else {
      // Default download if no custom handler is provided
      const linkSource = `data:application/pdf;base64,${pdfData}`;
      const downloadLink = document.createElement('a');
      downloadLink.href = linkSource;
      downloadLink.download = fileName;
      downloadLink.click();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-2">
        <h3 className="text-lg font-medium text-white">{fileName}</h3>
        <div className="flex items-center space-x-2">
          <Button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            variant="outline"
            size="sm"
            className="bg-[#0A0A0A] border-gray-800 text-gray-300 hover:bg-[#1A1A1A] hover:text-white"
          >
            Previous
          </Button>
          <span className="text-sm text-gray-400">
            Page {pageNumber} of {numPages || 1}
          </span>
          <Button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            variant="outline"
            size="sm"
            className="bg-[#0A0A0A] border-gray-800 text-gray-300 hover:bg-[#1A1A1A] hover:text-white"
          >
            Next
          </Button>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <Button
            onClick={zoomOut}
            variant="outline"
            size="sm"
            className="bg-[#0A0A0A] border-gray-800 text-gray-300 hover:bg-[#1A1A1A] hover:text-white"
          >
            Zoom Out
          </Button>
          <Button
            onClick={zoomIn}
            variant="outline"
            size="sm"
            className="bg-[#0A0A0A] border-gray-800 text-gray-300 hover:bg-[#1A1A1A] hover:text-white"
          >
            Zoom In
          </Button>
          <Button
            onClick={rotate}
            variant="outline"
            size="sm"
            className="bg-[#0A0A0A] border-gray-800 text-gray-300 hover:bg-[#1A1A1A] hover:text-white"
          >
            Rotate
          </Button>
        </div>
        
        {onDownload && (
          <Button
            onClick={handleDownload}
            className="bg-[#B4916C] hover:bg-[#A3815C] text-white"
            size="sm"
          >
            Download PDF
          </Button>
        )}
      </div>
      
      <div className="flex-grow overflow-auto bg-[#0A0A0A] rounded-lg border border-gray-800 p-2 sm:p-4">
        <div className="flex justify-center">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Error Loading PDF</h3>
              <p className="text-gray-400 mb-4">{error}</p>
              <Button
                onClick={handleDownload}
                className="bg-[#B4916C] hover:bg-[#A3815C] text-white"
              >
                Download Instead
              </Button>
            </div>
          ) : (
            <Document
              file={`data:application/pdf;base64,${pdfData}`}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex flex-col items-center justify-center h-40 sm:h-60">
                  <div className="w-10 h-10 border-2 border-[#B4916C] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-400">Loading PDF...</p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                rotate={rotation}
                width={Math.min(containerWidth - 40, 800)}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={
                  <div className="flex flex-col items-center justify-center h-40 sm:h-60">
                    <div className="w-10 h-10 border-2 border-[#B4916C] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
} 